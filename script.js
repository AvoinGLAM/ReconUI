let map;
let markersLayer;
let lang = 'en';
let page = 0;

document.addEventListener('DOMContentLoaded', () => {
    const mainMapContainer = document.getElementById('map');
    initializeMap(mainMapContainer);

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

    document.getElementById('searchLanguageSelect').addEventListener('change', function() {
        selectedLanguage = this.value;
        updateLanguageDisplay();
    });

    // Initialize the new dynamic input fields
            initializeDynamicInputFields();
});

// Function to initialize dynamic input fields
function initializeDynamicInputFields() {
    const option1 = document.getElementById('option1');
    const option2 = document.getElementById('option2');
    const textInput = document.getElementById('textInput');
    const dynamicUrl = document.getElementById('dynamicUrl');

    const optionsMap = {
        'a': ['P2347', 'P10221', 'P214'], // Example values for Wikidata ID property
        'b': ['https://wikidata.org/wiki/P2347', 'https://wikidata.org/wiki/P10221', 'https://wikidata.org/wiki/P214'], // Example values for Wikidata URL property
        'c': ['ID1', 'ID2', 'ID3'], // Example values for Dataset ID column
        'd': ['https://dataset.org/ID1', 'https://dataset.org/ID2', 'https://dataset.org/ID3'] // Example values for Dataset URL column
    };

    option1.addEventListener('change', () => {
        const selectedOption = option1.value;
        populateOption2(selectedOption);
        toggleTextInput(selectedOption);
        updateUrl();
    });

    option2.addEventListener('change', updateUrl);

    function populateOption2(selectedOption) {
        option2.innerHTML = '';
        const options = optionsMap[selectedOption];
        options.forEach(value => {
            const optionElement = document.createElement('option');
            optionElement.value = value;
            optionElement.textContent = value;
            option2.appendChild(optionElement);
        });
    }

    function toggleTextInput(selectedOption) {
        if (selectedOption === 'a' || selectedOption === 'c') {
            textInput.style.display = 'block';
            textInput.value = 'https://www.yso.fi/onto/yso/p$1'; // Example formatter URL
        } else {
            textInput.style.display = 'none';
        }
    }

    function updateUrl() {
        const selectedOption = option1.value;
        const option2Value = option2.value;

        if (selectedOption === 'a' || selectedOption === 'c') {
            const formatterUrl = textInput.value;
            const finalUrl = formatterUrl.replace('$1', option2Value);
            dynamicUrl.href = finalUrl;
            dynamicUrl.textContent = finalUrl;
        } else if (selectedOption === 'b' || selectedOption === 'd') {
            dynamicUrl.href = option2Value;
            dynamicUrl.textContent = option2Value;
        }
    }

    // Initial population of the second pulldown and URL update
    populateOption2(option1.value);
    toggleTextInput(option1.value);
    updateUrl();
}

//Read Google Sheets
//To do: Use reconciliation settings to input source

const API_KEY = 'AIzaSyC2CAd7eAwQmNdt4ZBIdQYw-iYD_ckFlZU'; // Replace with your API key
const SPREADSHEET_ID = '1Nm6_ntHwhbHt2_TAUieRAQ8eT9Ue_CcTggl0AgnehSo'; // Replace with your spreadsheet ID
const RANGE = 'elements!B2:B'; // Adjust range if necessary

async function loadSheetData() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        values = data.values ? data.values.map(row => row[0]) : [];
        currentIndex = 0;
        displayCurrentValue();
    } catch (error) {
        console.error('Error loading sheet data:', error);
    }
}

function displayCurrentValue() {
    const searchInput = document.getElementById('searchInput');
    if (values.length > 0) {
        searchInput.value = values[currentIndex];
    } else {
        searchInput.value = 'No data available';
    }
}

//Stepper to be used with a data source
function showNextValue() {
    if (values.length > 0) {
        currentIndex = (currentIndex + 1) % values.length;
        displayCurrentValue();
    }
}

//Stepper to be used with a data source
function showPreviousValue() {
    if (values.length > 0) {
        currentIndex = (currentIndex - 1 + values.length) % values.length;
        displayCurrentValue();
    }
}

//Map display
function initializeMap(mapContainer) {
    const newMap = L.map(mapContainer).setView([51.505, -0.09], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(newMap);

    // Use L.featureGroup for markers to enable getBounds()
    if (mapContainer.id === 'map') {
        map = newMap;
        markersLayer = L.featureGroup().addTo(map);
    } else {
        L.featureGroup().addTo(newMap); // Add an empty feature group for markers
    }

    return newMap;
}

//Load results
//To do: Querying for more items is not working, must debug
let currentPage = 0;
const resultsPerPage = 20; // Number of results to fetch per page
let limit = resultsPerPage;

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
            OPTIONAL { ?sitelink schema:about ?item;
                schema:isPartOf <https://${lang}.wikipedia.org/>.}
            SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${lang},mul,en". }
        } GROUP BY ?item ?itemLabel ?itemDescription LIMIT ${limit} OFFSET ${offset}`;
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
        const response = await fetch(url);
        // Log the raw response
        console.log('Raw response:', response);

        const data = await response.json();

        // Log the parsed data
        console.log('Parsed data:', data);
        return data.results.bindings;
    } catch (error) {
        console.error('Error fetching Wikidata items:', error);
        return [];
    }
}

//Test: Wikidata query to return available

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
            iframe.onload = () => {
                // Avoid cross-origin issues; skip iframe content manipulation
            };
        }
    });

    const img = document.createElement('img');
    img.src = item.image ? item.image.value : 'images/placeholder.png';
    img.alt = 'Image';

    const details = document.createElement('div');
    details.className = 'item-details';

    const label = document.createElement('span');
    label.style.fontWeight = 'bold';
    label.textContent = item.itemLabel.value + ' ';
    details.appendChild(label);

    const labelLink = document.createElement('a');
    labelLink.href = `https://www.wikidata.org/wiki/${item.item.value.split('/').pop()}`;
    labelLink.className = 'qid-link';
    labelLink.textContent = item.item.value.split('/').pop();
    labelLink.target = '_blank';
    details.appendChild(labelLink);

    const description = document.createElement('div');
    description.textContent = item.itemDescription ? item.itemDescription.value : 'No description available';
    details.appendChild(description);

    const button = document.createElement('button');
    button.textContent = 'Match';

    itemElement.appendChild(img);
    itemElement.appendChild(details);
    itemElement.appendChild(button);

    return itemElement;
}

//Navigating the results uses also arrow keys
//To do: When data source reading works, left/right should be used to navigate data input and up/down to navigate the results.
function navigateItems(direction) {
    const items = Array.from(document.querySelectorAll('.item'));
    const selectedIndex = items.findIndex(item => item.classList.contains('selected'));

    if (selectedIndex === -1) return;

    let newIndex;
    if (direction === 'next') {
        newIndex = (selectedIndex + 1) % items.length;
    } else if (direction === 'previous') {
        newIndex = (selectedIndex - 1 + items.length) % items.length;
    }

    if (newIndex !== selectedIndex) {
        items[selectedIndex].classList.remove('selected');
        items[newIndex].classList.add('selected');
        items[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });

        items[newIndex].click();
    }
}

//Create the list of results
//To do: Use the special feature of MediaWiki to return smaller images. Fix load more.
async function populateItems(query, page = 0) {
    const itemList = document.getElementById('itemList');
    if (page === 0) {
        itemList.innerHTML = ''; // Clear existing items if starting a new query
        markersLayer.clearLayers();
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
                            <strong>${item.itemLabel.value}</strong> <a href="https://www.wikidata.org/wiki/${qid}" target="_blank" class="popup-link">${qid}</a><br />
                            ${item.itemDescription ? item.itemDescription.value : 'No description available'}
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
                        handleMatchButtonClick(matchButton.dataset.qid);
                    });
                }
            });
        }

        if (index === 0) {
            itemElement.click();
        }
    });

    if (markers.length > 0) {
        markersLayer.addLayer(L.featureGroup(markers));
        map.fitBounds(markersLayer.getBounds());
    }

    currentPage = page; // Update the current page after loading items
}

function handleMatchButtonClick(qid) {
    console.log('Match button clicked for QID:', qid);
    // Add your logic here for handling the match button click
    // For example, you could highlight the item in the item list or perform some other action
}


//Listener for the Load more-button
//To do: Debug, arrange nicely in the code
document.getElementById('loadMoreButton').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.trim();
    if (query) {
        populateItems(query, currentPage + 1);
    }
});

//Code to generate components
//To do: This is a mess now and needs a human to organize. Goal: Dynamically create the right kind of component to display, also at app start. Component parts exist in templates.js.
function generateComponentHTML(viewType) {
    return `
            <div class="component-header">
                <div class="component-header-top">
                    <select>
                        <option value="displayValue" ${viewType === 'displayValue' ? 'selected' : ''}>Display value</option>
                        <option value="viewWebPage" ${viewType === 'viewWebPage' ? 'selected' : ''}>View web page</option>
                        <option value="viewWikimedia" ${viewType === 'viewWikimedia' ? 'selected' : ''}>View Wikimedia site</option>
                        <option value="compareCoordinates" ${viewType === 'compareCoordinates' ? 'selected' : ''}>Compare coordinates</option>
                        <option value="viewProperties" ${viewType === 'viewProperties' ? 'selected' : ''}>View properties</option>
                        <option value="reconciliationSettings" ${viewType === 'reconciliationSettings' ? 'selected' : ''}>Reconciliation settings</option>
                        <option value="mentions" ${viewType === 'mentions' ? 'selected' : ''}>Mentions in Wikipedia articles</option>
                    </select>
                </div>
                <div class="component-header-bottom">
                    ${getTemplate(`${viewType}HeaderBottom`)}
                </div>
            </div>
            <div class="component-body">
                ${generateComponentBody(viewType)}
            </div>
        `;
}

// Function to replace the component content and header
function replaceComponentContent(component, viewType) {
    const componentBody = component.querySelector('.component-body');
    const componentHeaderBottom = component.querySelector('.component-header-bottom');

    // Replace the component body with the appropriate content
    componentBody.innerHTML = generateComponentBody(viewType);

    // Replace the component-header-bottom with the specific options for the selected viewType
    componentHeaderBottom.innerHTML = getTemplate(`${viewType}HeaderBottom`);

    // Reinitialize map if compareCoordinates is selected
    if (viewType === 'compareCoordinates') {
        initializeMap(component.querySelector('#map'));
    }
}

// Sample function call for `viewWebPage` selection
function onComponentSelect(viewType) {
    const component = document.querySelector('#component');

    replaceComponentContent(component, viewType);
}

// Function to construct the project URL
function constructProjectUrl(qid, project, language) {
    let projectUrl = '';

    switch (project) {
        case 'Wikidocumentaries':
            projectUrl = `https://wikidocumentaries-demo.wmcloud.org/${qid}?language=${language}`;
            break;
        case 'Reasonator':
            projectUrl = `https://reasonator.toolforge.org/?q=${qid}&lang=${language}`;
            break;
        default:
            projectUrl = '#';
            break;
    }

    return projectUrl;
}
