    <script>
        let map;
        let markersLayer;

        document.addEventListener('DOMContentLoaded', () => {
            initializeMap();

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

            // Add event listener for help button
            document.getElementById('showHelpButton').addEventListener('click', () => {
                const helpSection = document.getElementById('helpSection');
                if (helpSection.style.display === 'none') {
                    helpSection.style.display = 'block';
                    document.getElementById('showHelpButton').textContent = 'Hide Help';
                } else {
                    helpSection.style.display = 'none';
                    document.getElementById('showHelpButton').textContent = 'Show Help';
                }
            });
        });

        const SPREADSHEET_ID = 'your_spreadsheet_id'; // Update with your actual spreadsheet ID
        const RANGE = 'Dataset!D2:D'; // Adjust range if necessary

        async function loadSheetData() {
            const url = `/api/sheet-data?spreadsheetId=${SPREADSHEET_ID}&range=${RANGE}`;
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

        function showNextValue() {
            if (values.length > 0) {
                currentIndex = (currentIndex + 1) % values.length;
                displayCurrentValue();
            }
        }

        function showPreviousValue() {
            if (values.length > 0) {
                currentIndex = (currentIndex - 1 + values.length) % values.length;
                displayCurrentValue();
            }
        }

        function initializeMap() {
            map = L.map('map').setView([51.505, -0.09], 13);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            }).addTo(map);

            // Use L.featureGroup for markers to enable getBounds()
            markersLayer = L.featureGroup().addTo(map);
        }

        async function fetchWikidataItems(query) {
            try {
                const sparqlQuery = `
                    SELECT ?item ?itemLabel ?itemDescription (SAMPLE(?image) AS ?image) (SAMPLE(?coord) AS ?coord) WHERE {
                        SERVICE wikibase:mwapi {
                            bd:serviceParam wikibase:endpoint "www.wikidata.org";
                                            wikibase:api "EntitySearch";
                                            mwapi:search "${query}";
                                            mwapi:language "en";
                                            mwapi:limit "8".
                            ?item wikibase:apiOutputItem mwapi:item.
                            ?item wikibase:apiOutputItemLabel mwapi:label.
                        }
                        OPTIONAL { ?item wdt:P18 ?image. }
                        OPTIONAL { ?item wdt:P625 ?coord. }
                        SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
                    } GROUP BY ?item ?itemLabel ?itemDescription LIMIT 8`;
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
                const url = `https://wikidocumentaries-demo.wmcloud.org/${qid}`;

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
            img.src = item.image ? item.image.value : 'https://via.placeholder.com/50';
            img.alt = 'QID Image';

            const details = document.createElement('div');
            details.className = 'item-details';
            details.innerHTML = `<span>${item.itemLabel.value}</span><br><span>${item.itemDescription ? item.itemDescription.value : ''}</span>`;

            itemElement.appendChild(img);
            itemElement.appendChild(details);

            return itemElement;
        }

        async function populateItems(query) {
            const resultsContainer = document.querySelector('.results');
            resultsContainer.innerHTML = '';

            const items = await fetchWikidataItems(query);
            items.forEach(item => {
                const itemElement = createItemElement(item);
                resultsContainer.appendChild(itemElement);
            });

            if (items.length > 0) {
                resultsContainer.firstChild.classList.add('selected');
                const firstQid = items[0].item.value.split('/').pop();
                const url = `https://wikidocumentaries-demo.wmcloud.org/${firstQid}`;
                const projectUrl = document.getElementById('projectUrl');
                projectUrl.href = url;
                projectUrl.textContent = url;

                const iframe = document.getElementById('projectIframe');
                iframe.src = url;
            } else {
                const noResultsMessage = document.createElement('div');
                noResultsMessage.textContent = 'No results found';
                resultsContainer.appendChild(noResultsMessage);
            }
        }

        function replaceComponentContent(component, selectedView) {
            const headerBottom = component.querySelector('.component-header-bottom');
            const body = component.querySelector('.component-body');

            headerBottom.innerHTML = getTemplate(selectedView + 'HeaderBottom');
            body.innerHTML = generateComponentBody(selectedView);
        }

        function navigateItems(direction) {
            const items = Array.from(document.querySelectorAll('.item'));
            if (items.length === 0) return;

            const selectedIndex = items.findIndex(item => item.classList.contains('selected'));
            let newIndex;
            if (direction === 'next') {
                newIndex = (selectedIndex + 1) % items.length;
            } else if (direction === 'previous') {
                newIndex = (selectedIndex - 1 + items.length) % items.length;
            }

            items[selectedIndex].classList.remove('selected');
            items[newIndex].classList.add('selected');

            const qid = items[newIndex].querySelector('.item-details').textContent.split('/').pop();
            const url = `https://wikidocumentaries-demo.wmcloud.org/${qid}`;
            const projectUrl = document.getElementById('projectUrl');
            projectUrl.href = url;
            projectUrl.textContent = url;

            const iframe = document.getElementById('projectIframe');
            iframe.src = url;
        }
    </script>
