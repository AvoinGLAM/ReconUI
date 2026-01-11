let map;
let markersLayer;
let lang = 'en';
let page = 0;
let originalContext = null; // Global variable to store Google Sheet coordinates
let values = []; // To store stepper values if needed
let currentIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Map
    const mainMapContainer = document.getElementById('map');
    initializeMap(mainMapContainer);

    // 2. Handle URL Parameters from Google Sheets (The Authoritative Search)
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('query');
    const ctxParam = urlParams.get('ctx');

    if (ctxParam) {
        try {
            originalContext = JSON.parse(decodeURIComponent(ctxParam));
        } catch (e) {
            console.error("Error parsing context:", e);
        }
    }

    // 3. Setup Search Elements
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');

    searchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            populateItems(query);
        }
    });

    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchButton.click();
        }
    });

    // 4. Auto-trigger search if query is passed from Sidebar
    if (searchTerm) {
        searchInput.value = searchTerm;
        // Small delay to ensure all listeners are ready
        setTimeout(() => searchButton.click(), 300);
    }

    // 5. Navigation & UI Listeners
    document.getElementById('nextButton').addEventListener('click', showNextValue);
    document.getElementById('prevButton').addEventListener('click', showPreviousValue);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            navigateItems('next');
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            navigateItems('previous');
        }
    });

    document.querySelectorAll('.component-header-top select').forEach(select => {
        select.addEventListener('change', (event) => {
            const selectedView = event.target.value;
            const component = event.target.closest('.component');
            if (selectedView === 'Close') {
                component.remove();
            } else {
                replaceComponentContent(component, selectedView);
            }
        });
    });

    // Note: ensure 'searchLanguageSelect' exists in HTML or this will error
    const langSelect = document.getElementById('searchLanguageSelect');
    if (langSelect) {
        langSelect.addEventListener('change', function() {
            lang = this.value;
            // updateLanguageDisplay(); // Call if function exists
        });
    }

    initializeDynamicInputFields();
});

/**
 * RECONCILIATION BRIDGE
 * Sends selected QID back to Google Sheets
 */
function sendMatchToSheet(qid) {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        const config = {
            includeLabel: true,
            includeDesc: true,
            langs: [document.getElementById('languageSelect')?.value || 'en']
        };

        google.script.run
            .withSuccessHandler(() => {
                console.log("Match applied successfully to sheet.");
                google.script.host.close(); // Close modal and return to sheet
            })
            .withFailureHandler((err) => {
                alert("Error applying match: " + err);
            })
            .applyEntity(qid, "SINGLE_CELL", config, originalContext);
    } else {
        alert("Local Test Match: " + qid + "\n(Spreadsheet would be updated if running in Google Sheets)");
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
        e.stopPropagation(); 
        sendMatchToSheet(qid);
    });

    itemElement.appendChild(img);
    itemElement.appendChild(details);
    itemElement.appendChild(button);

    return itemElement;
}

async function populateItems(query, page = 0) {
    const itemList = document.getElementById('itemList');
    if (page === 0) {
        itemList.innerHTML = '';
        if (markersLayer) markersLayer.clearLayers();
    }

    const items = await fetchWikidataItems(query, page, resultsPerPage);
    const markers = [];

    items.forEach((item, index) => {
        const itemElement = createItemElement(item);
        itemList.appendChild(itemElement);

        if (item.coord) {
            const coords = item.coord.value.replace('Point(', '').replace(')', '').split(' ');
            const lat = parseFloat(coords[1]);
            const lon = parseFloat(coords[0]);

            const imageUrl = item.image ? item.image.value : 'images/placeholder.png';
            const qid = item.item.value.split('/').pop();
            const popupContent = `
                <div class="popup">
                    <img src="${imageUrl}" alt="Image" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;"/>
                    <div class="popuptxt">
                        <div>
                            <strong>${item.itemLabel.value}</strong><br />
                            ${item.itemDescription ? item.itemDescription.value : 'No description'}
                        </div>
                        <div>
                            <button class="match-button" data-qid="${qid}">Match</button>
                        </div>
                    </div>
                </div>
            `;
            const marker = L.marker([lat, lon]).bindPopup(popupContent);
            markers.push(marker);
            marker.on('popupopen', () => {
                const matchButton = document.querySelector('.match-button');
                if (matchButton) {
                    matchButton.addEventListener('click', () => {
                        sendMatchToSheet(matchButton.dataset.qid);
                    });
                }
            });
        }

        if (index === 0 && page === 0) {
            itemElement.click();
        }
    });

    if (markers.length > 0 && map) {
        markersLayer.addLayer(L.featureGroup(markers));
        map.fitBounds(markersLayer.getBounds());
    }

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