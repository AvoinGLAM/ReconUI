let map;
let markersLayer;
let lang = 'en';
let currentPage = 0;
const resultsPerPage = 20;
let originalContext = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup UI elements
    const mainMapContainer = document.getElementById('map');
    initializeMap(mainMapContainer);

    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');

    // 2. Parse URL Parameters immediately
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('query');
    const ctxParam = urlParams.get('ctx');

    if (ctxParam) {
        try {
            originalContext = JSON.parse(decodeURIComponent(ctxParam));
        } catch (e) { console.error("Context error:", e); }
    }

    // 3. Centralized Search Trigger
    searchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            populateItems(query, 0); // Always start at 0
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); searchButton.click(); }
    });

    // 4. Handle Auto-Search (Wait for Google API to load)
    if (searchTerm) {
        searchInput.value = searchTerm;
        // Delay ensures the iframe handshake with Google is complete
        setTimeout(() => {
            if (searchInput.value) {
                populateItems(searchInput.value, 0);
            }
        }, 500);
    }
    
    initializeDynamicInputFields();
});

/**
 * RECONCILIATION BRIDGE
 */
function sendMatchToSheet(qid) {
    // Check if we are truly inside Google Sheets
    const isGoogle = (typeof google !== 'undefined' && google.script && google.script.run);
    
    if (isGoogle) {
        const config = {
            includeLabel: true,
            includeDesc: true,
            langs: ['en'] 
        };

        // UI feedback: Disable the button so the user knows it's working
        console.log("Sending to Apps Script:", qid, originalContext);
        
        google.script.run
            .withSuccessHandler(() => {
                // If you have the sidebar status message function:
                if (window.top && window.top.remoteMatchNotification) {
                    window.top.remoteMatchNotification();
                }
                google.script.host.close();
            })
            .withFailureHandler((err) => alert("Google Script Error: " + err))
            .applyEntity(qid, "SINGLE_CELL", config, originalContext);
    } else {
        // This only fires if testing the URL in a standard browser tab
        alert("MODE: Standalone\nQID: " + qid + "\nRow: " + (originalContext ? originalContext.row : "Unknown"));
    }
}

function handleMatchButtonClick(qid) {
    console.log('Match button clicked for QID:', qid);
    sendMatchToSheet(qid);
}

/**
 * WIKIDATA SEARCH & UI GENERATION
 */
async function fetchWikidataItems(query, page, limit) {
    try {
        const offset = page * limit;
        const sparqlQuery = `
        SELECT ?item ?itemLabel ?itemDescription (SAMPLE(?image) AS ?image) (SAMPLE(?coord) AS ?coord) WHERE {
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
            OPTIONAL { ?item wdt:P18 ?image. }
            OPTIONAL { ?item wdt:P625 ?coord. }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${lang},mul,en". }
        } GROUP BY ?item ?itemLabel ?itemDescription LIMIT ${limit} OFFSET ${offset}`;
        
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
        const response = await fetch(url);
        const data = await response.json();
        return data.results.bindings;
    } catch (error) {
        console.error('Error fetching Wikidata items:', error);
        return [];
    }
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
    img.src = item.image ? item.image.value : 'images/placeholder.png';
    img.alt = 'Image';

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

async function populateItems(query, page = 0) {
    const itemList = document.getElementById('itemList');
    
    // Crucial: Clear existing content to prevent "Double Population"
    if (page === 0) {
        itemList.innerHTML = '<div style="padding:20px;">Searching Wikidata...</div>';
        if (markersLayer) markersLayer.clearLayers();
    }

    const items = await fetchWikidataItems(query, page, resultsPerPage);
    
    // Clear "Searching..." before appending
    if (page === 0) itemList.innerHTML = '';

    if (items.length === 0 && page === 0) {
        itemList.innerHTML = '<div style="padding:20px;">No results found.</div>';
        return;
    }

    items.forEach((item, index) => {
        const itemElement = createItemElement(item);
        itemList.appendChild(itemElement);
        // ... marker logic ...
    });
    
    currentPage = page;
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

const resultsPerPage = 20;
let currentPage = 0;

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