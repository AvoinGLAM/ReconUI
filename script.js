let map;
let markersLayer;
let lang = 'en';
let currentPage = 0;           // ONLY DECLARATION
const resultsPerPage = 20;     // ONLY DECLARATION
let originalContext = null;
let isSearching = false;
let itemSitelinks = {};  // Cache: { qid: { projectType: [{ lang, title, url }, ...] } }


document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup UI elements
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const mainMapContainer = document.getElementById('map');
    document.getElementById('settingsButton').onclick = () => {
    alert("Settings:\nLanguage: English\nEngine: WDQS + mwapi\nResults per page: 20");
    };
    
    if (mainMapContainer) initializeMap(mainMapContainer);

    if (!searchButton || !searchInput) {
        console.error("CRITICAL: searchButton or searchInput not found in HTML!");
        return; // Stop if UI is missing
    }

    // 2. Parse URL Parameters (Base64 version)
    const urlParams = new URLSearchParams(window.location.search);
    const ctxParam = urlParams.get('ctx');
    const searchTerm = urlParams.get('query');

    if (ctxParam) {
        try {
            // Correctly decode Base64 back to a JSON string, then to an object
            const decoded = atob(ctxParam.replace(/-/g, '+').replace(/_/g, '/'));
            originalContext = JSON.parse(decoded);
            console.log("Context decoded successfully");
        } catch (e) {
            console.error("Context decoding failed:", e);
        }
    }

    // 3. Define the search action
    const executeSearch = () => {
        const query = searchInput.value.trim();
        if (query && !isSearching) {
            populateItems(query, 0);
        }
    };

    // 4. Attach listeners
    searchButton.addEventListener('click', executeSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeSearch();
        }
    });

    // 5. Safe Auto-Trigger
    if (searchTerm) {
        searchInput.value = decodeURIComponent(searchTerm);
        // Delay helps ensure the Google Transport is stable
        setTimeout(executeSearch, 1000); 
    }

    initializeDynamicInputFields();
});

/**
 * RECONCILIATION BRIDGE
 */
function sendMatchToSheet(qid) {
    // Look for the Google object
    const isGoogle = (typeof google !== 'undefined' && google.script && google.script.run);
    
    if (isGoogle) {
        // Dynamically get config from your Speculo settings checkboxes
        const config = {
            includeLabel: document.getElementById('checkLabel')?.checked ?? true,
            includeDesc: document.getElementById('checkDesc')?.checked ?? true,
            langs: ['en'] // You can expand this based on your settings button logic
        };

        // UI feedback using the button that triggered the event
        const btn = event.currentTarget; 
        const originalText = btn.textContent;
        btn.textContent = "SAVING...";
        btn.disabled = true;

        

        google.script.run
            .withSuccessHandler(() => {
                // If Sidebar is open, trigger the "✓ Match Applied" toast
                if (window.top && typeof window.top.remoteMatchNotification === 'function') {
                    window.top.remoteMatchNotification();
                }
                // Close the Speculo modal after successful save
                google.script.host.close();
            })
            .withFailureHandler((err) => {
                btn.textContent = originalText;
                btn.disabled = false;
                alert("Apps Script Error: " + err);
            })
            .applyEntity(qid, "SINGLE_CELL", config, originalContext);
    } else {
        console.error("Google API not found. Context:", originalContext);
        alert("The connection to Google Sheets is not active yet. Please wait a few seconds and try again.");
    }
}

function handleMatchButtonClick(qid) {
    sendMatchToSheet(qid); // Calls the Google Sheets bridge we built
}

/**
 * WIKIDATA SEARCH & UI GENERATION
 */
async function fetchWikidataItems(query, page, limit) {
    const offset = page * limit;
    const sparqlQuery = `
    SELECT ?item ?itemLabel ?itemDescription ?coord 
        (IF(BOUND(?img), URI(CONCAT("https://commons.wikimedia.org/wiki/Special:FilePath/", 
        REPLACE(STR(?img), "http://commons.wikimedia.org/wiki/Special:FilePath/", ""), "?width=300")), "") AS ?thumb)
    WHERE {
        SERVICE wikibase:mwapi {
            bd:serviceParam wikibase:endpoint "www.wikidata.org";
                            wikibase:api "EntitySearch";
                            mwapi:search "${query}";
                            mwapi:language "${lang}";
                            mwapi:limit "${limit}";
                            mwapi:offset "${offset}".
            ?item wikibase:apiOutputItem mwapi:item.
            ?item wikibase:apiOutputItemLabel mwapi:label.
        }
        OPTIONAL { ?item wdt:P18 ?img. }
        OPTIONAL { ?item wdt:P625 ?coord. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${lang},en". }
    } GROUP BY ?item ?itemLabel ?itemDescription ?coord ?img LIMIT ${limit} OFFSET ${offset}`;
    
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    return data.results.bindings;
}

/**
 * SITELINKS BATCH QUERY
 * Fetches all sitelinks for a batch of Wikidata items
 */
async function fetchSitelinksForItems(qids) {
    if (!qids || qids.length === 0) return [];

    // Build VALUES clause for SPARQL
    const values = qids.map(qid => `wd:${qid}`).join(' ');
    
    const sparqlQuery = `
    SELECT ?item ?sitelink ?wiki ?title WHERE {
        VALUES ?item { ${values} }
        
        ?sitelink schema:about ?item ;
                  schema:isPartOf ?wiki ;
                  schema:name ?title .
        
        FILTER(STRSTARTS(STR(?wiki), "https://"))
    }
    ORDER BY ?item ?wiki`;
    
    try {
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
        const response = await fetch(url);
        const data = await response.json();
        
        console.log("Sitelinks fetched:", data.results.bindings.length, "results");
        return data.results.bindings;
    } catch (error) {
        console.error("Error fetching sitelinks:", error);
        return [];
    }
}

/**
 * PROCESS SITELINKS RESULTS
 * Takes raw sitelinks results and caches them organized by item
 */
function processSitelinksResults(results) {
    const cache = {};
    
    results.forEach(result => {
        const qid = result.item.value.split('/').pop();  // Extract QID from URL
        
        if (!cache[qid]) {
            cache[qid] = {};
        }
        
        // Parse this single sitelink
        const wikiUrl = result.wiki.value;
        const sitelink = result.sitelink.value;
        const title = result.title.value;
        
        const match = wikiUrl.match(/https:\/\/([a-z-]+)\.([a-z]+)\.org\//);
        
        if (match) {
            const lang = match[1];
            const project = match[2];
            const projectType = `${project}`;
            
            if (!cache[qid][projectType]) {
                cache[qid][projectType] = [];
            }
            
            cache[qid][projectType].push({
                lang: lang,
                title: title,
                url: sitelink,
                wikiUrl: wikiUrl
            });
        }
    });
    
    return cache;
}

/**
 * UPDATE DROPDOWN DATA AFTER SEARCH
 * Called after items are fetched to get their sitelinks
 */
async function updateSitelinksForCurrentResults(items) {
    // Extract QIDs from items
    const qids = items.map(item => {
        const itemUrl = item.item.value;
        return itemUrl.split('/').pop();
    });
    
    // Fetch sitelinks for all items
    const sitelinksResults = await fetchSitelinksForItems(qids);
    
    // Cache the results
    const newCache = processSitelinksResults(sitelinksResults);
    itemSitelinks = { ...itemSitelinks, ...newCache };
    
    console.log("Sitelinks cached for QIDs:", qids);
    console.log("Sitelinks cache:", itemSitelinks);
}

// ===== CONSTANTS FOR URL BUILDING =====
const PROJECT_MAP = {
    'Wikipedia': 'wikipedia',
    'Wikisource': 'wikisource',
    'Wikivoyage': 'wikivoyage',
    'Wikibooks': 'wikibooks'
};

const MULTILINGUAL_PROJECTS = {
    'Wikimedia Commons': 'commons',
    'Metawiki': 'meta'
};

const PROJECT_DOMAINS = {
    'wikipedia': 'wikipedia.org',
    'wikisource': 'wikisource.org',
    'wikivoyage': 'wikivoyage.org',
    'wikibooks': 'wikibooks.org',
    'commons': 'commons.wikimedia.org',
    'meta': 'meta.wikimedia.org'
};

/**
 * GET AVAILABLE PROJECTS FOR AN ITEM
 * Only returns the 4 supported projects in the specified order.
 */
function getAvailableProjects(qid) {
    if (!itemSitelinks[qid]) return [];

    const sitelinks = itemSitelinks[qid];
    const projects = [];

    Object.entries(PROJECT_MAP).forEach(([projectName, projectKey]) => {
        if (sitelinks[projectKey]) {
            projects.push(projectName);
        }
    });

    Object.entries(MULTILINGUAL_PROJECTS).forEach(([projectName, langKey]) => {
        if (sitelinks['wikimedia']?.some(e => e.lang === langKey)) {
            projects.push(projectName);
        }
    });

    return projects;
}

/**
 * GET AVAILABLE LANGUAGES FOR AN ITEM AND PROJECT
 * Only applicable for localized projects (Wikipedia, Wikisource).
 */
function getAvailableLanguages(qid, projectType) {
    const normalizedProject = PROJECT_MAP[projectType];
    
    if (!normalizedProject || !itemSitelinks[qid]?.[normalizedProject]) return [];

    return itemSitelinks[qid][normalizedProject].map(entry => ({
        code: entry.lang,
        title: entry.title
    }));
}

/**
 * BUILD WIKIMEDIA URL WITH PROPER STRUCTURE
 * Constructs formatted URL with &mobileaction=toggle_view_mobile
 */
function buildWikimediaUrl(projectKey, langCode, title) {
    const domain = PROJECT_DOMAINS[projectKey];
    if (!domain) return null;
    
    const baseUrl = (projectKey === 'commons' || projectKey === 'meta') 
        ? `https://${domain}/w/index.php?title=${encodeURIComponent(title)}&mobileaction=toggle_view_mobile`
        : `https://${langCode}.${domain}/w/index.php?title=${encodeURIComponent(title)}&mobileaction=toggle_view_mobile`;
    
    return baseUrl;
}

/**
 * GET URL FOR SPECIFIC ITEM, PROJECT, AND LANGUAGE
 * Now returns FORMATTED URL, not raw sitelink
 */
function getWikimediaUrl(qid, projectType, langCode) {
    if (!itemSitelinks[qid]) return null;

    const normalizedProject = PROJECT_MAP[projectType];
    
    // Localized projects
    if (normalizedProject) {
        const sitelinks = itemSitelinks[qid][normalizedProject];
        const entry = sitelinks?.find(e => e.lang === langCode);
        if (!entry) return null;
        return buildWikimediaUrl(normalizedProject, langCode, entry.title);
    }

    // Multilingual projects
    const langKey = MULTILINGUAL_PROJECTS[projectType];
    if (!langKey) return null;
    
    const sitelinks = itemSitelinks[qid]['wikimedia'];
    const entry = sitelinks?.find(e => e.lang === langKey);
    if (!entry) return null;
    return buildWikimediaUrl(langKey, langCode, entry.title);
}

function createItemElement(item) {
    const itemElement = document.createElement('div');
    itemElement.className = 'item';

    itemElement.addEventListener('click', () => {
        document.querySelectorAll('.item').forEach(el => el.classList.remove('selected'));
        itemElement.classList.add('selected');

        const qid = item.item.value.split('/').pop();
        
        // Update project and language dropdowns with available options
        updateProjectDropdown(qid);
    });

    const img = document.createElement('img');
    
    // Use the 'thumb' variable from the new SPARQL query
    // It already includes the width=300 parameter and HTTPS
    img.src = (item.thumb && item.thumb.value) ? item.thumb.value : 'images/placeholder.png';
    img.alt = 'Thumbnail';

    const details = document.createElement('div');
    details.className = 'item-details';

    const label = document.createElement('span');
    label.style.fontWeight = 'bold';
    label.textContent = (item.itemLabel ? item.itemLabel.value : 'No label') + ' ';
    details.appendChild(label);

    const labelLink = document.createElement('a');
    const qid = item.item.value.split('/').pop();
    labelLink.href = `https://www.wikidata.org/wiki/${qid}`;
    labelLink.className = 'qid-link';
    labelLink.textContent = qid;
    labelLink.target = '_blank';
    details.appendChild(labelLink);

    const description = document.createElement('div');
    description.textContent = item.itemDescription ? item.itemDescription.value : 'No description available';
    details.appendChild(description);

    const button = document.createElement('button');
    button.textContent = 'Match';
    button.addEventListener('click', (e) => {
        e.stopPropagation(); // Stops the 'item click' from selecting/refreshing the preview
        sendMatchToSheet(qid);
    }); 

    itemElement.appendChild(img);
    itemElement.appendChild(details);
    itemElement.appendChild(button);

    return itemElement;
}

/**
 * UPDATE PROJECT DROPDOWN
 * Populate with available projects for the selected item
 */
function updateProjectDropdown(qid) {
    const projectSelect = document.getElementById('projectSelect');
    if (!projectSelect) return;
    
    const availableProjects = getAvailableProjects(qid);
    
    // Clear current options
    projectSelect.innerHTML = '';
    
    // Add available projects
    availableProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        projectSelect.appendChild(option);
    });
    
    // Remove old listener and add new one
    projectSelect.onchange = () => {
        updateLanguageDropdown(qid, projectSelect.value);
    };
    
    // Trigger language dropdown update for first project
    if (availableProjects.length > 0) {
        updateLanguageDropdown(qid, projectSelect.value);
    }
}

/**
 * UPDATE LANGUAGE DROPDOWN
 * Populate with available languages for the selected item and project.
 * Hides the dropdown for multilingual projects (Wikimedia Commons, Metawiki).
 */
/**
 * UPDATE LANGUAGE DROPDOWN
 * Populate with available languages for the selected item and project.
 * For multilingual projects, directly update display without language selection.
 */
function updateLanguageDropdown(qid, projectType) {
    const languageSelect = document.getElementById('languageSelect');
    if (!languageSelect) return;

    const availableLanguages = getAvailableLanguages(qid, projectType);

    // For multilingual projects (no languages)
    if (availableLanguages.length === 0) {
        languageSelect.style.display = 'none';
        updateWikimediaDisplay(qid, projectType);
        return;
    }

    // For localized projects (show language dropdown)
    languageSelect.style.display = '';
    languageSelect.innerHTML = '';

    availableLanguages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = `${lang.code} - ${lang.title}`;
        languageSelect.appendChild(option);
    });

    languageSelect.onchange = () => {
        updateWikimediaDisplay(qid, projectType, languageSelect.value);
    };

    // Trigger display update for first language
    if (availableLanguages.length > 0) {
        updateWikimediaDisplay(qid, projectType, availableLanguages[0].code);
    }
}

/**
 * UPDATE WIKIMEDIA DISPLAY
 * Load the selected Wikimedia page into the iframe
 */
function updateWikimediaDisplay(qid, projectType, langCode) {
    const url = getWikimediaUrl(qid, projectType, langCode);
    
    if (url) {
        const projectUrl = document.getElementById('projectUrl');
        if (projectUrl) {
            projectUrl.href = url;
            projectUrl.textContent = url;
        }

        const iframe = document.getElementById('projectIframe');
        if (iframe) {
            iframe.src = url;
        }
    } else {
        console.warn(`No URL found for QID ${qid}, project ${projectType}, language ${langCode}`);
    }
}

async function populateItems(query, page = 0) {
    const itemList = document.getElementById('itemList');
    
    // 1. Reset UI for new searches
    if (page === 0) {
        itemList.innerHTML = ''; 
        if (markersLayer) markersLayer.clearLayers();
    }

    // 2. Fetch data from SPARQL
    const items = await fetchWikidataItems(query, page, resultsPerPage);

    // 3. FETCH SITELINKS FOR ALL ITEMS (new step)
    await updateSitelinksForCurrentResults(items);

    items.forEach((item, index) => {
        // 4. Populate the Left-Pane List
        const itemElement = createItemElement(item);
        itemList.appendChild(itemElement);

        // 5. Populate the Map (Right-Pane)
        if (item.coord && markersLayer) {
            // Parse "Point(lon lat)" format
            const coords = item.coord.value.replace('Point(', '').replace(')', '').split(' ');
            const lat = parseFloat(coords[1]);
            const lon = parseFloat(coords[0]);
            
            const qid = item.item.value.split('/').pop();
            
            // Extract display values with fallbacks
            // Consistently use 'item.thumb' to match your updated SPARQL SELECT ?thumb
            const label = item.itemLabel ? item.itemLabel.value : 'No label';
            const desc = item.itemDescription ? item.itemDescription.value : 'No description available';

            // Safety check: if item.thumb exists, use its value; otherwise, use the placeholder
            const imgUrl = (item.thumb && item.thumb.value) ? item.thumb.value : 'images/placeholder.png';

            const popupContent = `
                <div class="popup">
                    <img src="${imgUrl}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;"/>
                    <div>
                        <strong>${label}</strong>
                        <a href="https://www.wikidata.org/wiki/${qid}" target="_blank" class="popup-link">${qid}</a><br />
                        <div>${desc}</div>
                        <button class="match-button blue" onclick="sendMatchToSheet('${qid}')">Match</button>
                    </div>
                </div>`;
            
            const marker = L.marker([lat, lon]).bindPopup(popupContent);
            markersLayer.addLayer(marker);
        }

        // 6. Auto-select the first result to trigger the preview iframe
        if (index === 0 && page === 0) {
            itemElement.click();
        }
    });

    // 7. Update pagination counter
    currentPage = page;

    // 8. Adjust Map View to fit all markers
    if (markersLayer.getLayers().length > 0) {
        map.fitBounds(markersLayer.getBounds(), { padding: [50, 50] });
    }
}

/**
 * UTILITY & UI FUNCTIONS
 */
function initializeMap(mapContainer) {
    if (!mapContainer) return;
    const newMap = L.map(mapContainer).setView([0, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(newMap);

    map = newMap;
    markersLayer = L.featureGroup().addTo(map);
    return newMap;
}

function navigateItems(direction) {
    const items = Array.from(document.querySelectorAll('.item'));
    const selectedIndex = items.findIndex(item => item.classList.contains('selected'));
    if (selectedIndex === -1) return;

    let newIndex = direction === 'next' ? 
        (selectedIndex + 1) % items.length : 
        (selectedIndex - 1 + items.length) % items.length;

    items[newIndex].click();
    items[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showNextValue() {
    if (values.length > 0) {
        currentIndex = (currentIndex + 1) % values.length;
        document.getElementById('searchInput').value = values[currentIndex];
    }
}

function showPreviousValue() {
    if (values.length > 0) {
        currentIndex = (currentIndex - 1 + values.length) % values.length;
        document.getElementById('searchInput').value = values[currentIndex];
    }
}

document.getElementById('loadMoreButton').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.trim();
    if (query) populateItems(query, currentPage + 1);
});

// Dynamic Input Field Logic (Kept as per your original)
function initializeDynamicInputFields() {
    const option1 = document.getElementById('option1');
    const option2 = document.getElementById('option2');
    if (!option1 || !option2) return;

    const optionsMap = {
        'a': ['P2347', 'P10221', 'P214'],
        'b': ['https://wikidata.org/wiki/P2347', 'https://wikidata.org/wiki/P10221', 'https://wikidata.org/wiki/P214'],
        'c': ['ID1', 'ID2', 'ID3'],
        'd': ['https://dataset.org/ID1', 'https://dataset.org/ID2', 'https://dataset.org/ID3']
    };

    option1.addEventListener('change', () => {
        const selectedOption = option1.value;
        option2.innerHTML = '';
        (optionsMap[selectedOption] || []).forEach(val => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = val;
            option2.appendChild(opt);
        });
    });
}

function replaceComponentContent(component, viewType) {
    const body = component.querySelector('.component-body');
    const headerBottom = component.querySelector('.component-header-bottom');
    if (typeof generateComponentBody === 'function') body.innerHTML = generateComponentBody(viewType);
    if (typeof getTemplate === 'function') headerBottom.innerHTML = getTemplate(`${viewType}HeaderBottom`);
    if (viewType === 'compareCoordinates') initializeMap(component.querySelector('#map'));
}
