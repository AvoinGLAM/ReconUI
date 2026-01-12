let map;
let markersLayer;
let lang = 'en';
let currentPage = 0;           // ONLY DECLARATION
const resultsPerPage = 20;     // ONLY DECLARATION
let originalContext = null;
let isSearching = false;


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
        // Only proceed if not already in the middle of a search
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

function createItemElement(item) {
    const itemElement = document.createElement('div');
    itemElement.className = 'item';

    itemElement.addEventListener('click', () => {
        document.querySelectorAll('.item').forEach(el => el.classList.remove('selected'));
        itemElement.classList.add('selected');

        const qid = item.item.value.split('/').pop();
        const url = `https://wikidocumentaries-demo.wmcloud.org/${qid}?language=en`;

        const projectUrl = document.getElementById('projectUrl');
        if (projectUrl) {
            projectUrl.href = url;
            projectUrl.textContent = url;
        }

        const iframe = document.getElementById('projectIframe');
        if (iframe) {
            iframe.src = url;
        }
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

const executeSearch = () => {
    const query = searchInput.value.trim();
    // Only proceed if not already in the middle of a search
    if (query && !isSearching) {
        populateItems(query, 0);
    }
};

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
    if (query && !isSearching) {
        // Use the global currentPage which we just synced in populateItems
        populateItems(query, currentPage + 1);
    }
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