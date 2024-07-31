// templates.js

function getTemplate(templateName) {
    const templates = {
        viewWebPageHeaderBottom: `
            <div class="row">
                <select id="option1" class="bold-text">
                    <option value="a">Wikidata ID property</option>
                    <option value="b">Wikidata URL property</option>
                    <option value="c">Dataset ID column</option>
                    <option value="d">Dataset URL column</option>
                </select>
                <select id="option2">
                    <option value="P2347">YSO ID (P2347)</option>
                    <option value="P10221">UNESCO ICH ID (P10221)</option>
                    <option value="P214">VIAF ID (P214)</option>
                    <!-- Dynamically populated based on the first pulldown selection -->
                </select>
            </div>
            <div class="row">
                <input type="text" id="textInput" style="display:none;">
            </div>
            <div class="row">
                <a id="dynamicUrl" href="#" target="_blank">URL Link</a>
            </div>
        `,
        viewWikimediaHeaderBottom: `
            <div class="row">
                <div class="bold-text">Project</div>
                <select id="projectSelect">
                    <option>Wikidocumentaries</option>
                    <option>Wikipedia</option>
                    <option>Wikimedia Commons</option>
                    <option>Reasonator</option>
                    <option>Wikivoyage</option>
                </select>
                <select id="languageSelect">
                    <option value="en" selected>English</option>
                    <option value="fi">Finnish</option>
                    <option value="sv">Swedish</option>
                </select>
            </div>
            <div class="row">
                <a id="projectUrl" href="#" target="_blank">Simple text</a>
            </div>
        `,
        compareCoordinatesHeaderBottom: `
            <div class="row">
                <div class="bold-text">Dataset value</div> Coordinate value
            </div>
        `,
        viewAllPropertiesHeaderBottom: `
            <div>View all properties specific options</div>
        `,
        reconciliationSettingsHeaderBottom: `
            <div></div>
        `,
        mentionsHeaderBottom: `
            <div></div>
        `,
        defaultHeaderBottom: `
            <div>Select Wikidata property and the corresponding column in the dataset.</div>
        `,
    };

    return templates[templateName] || templates.defaultHeaderBottom;
}

function generateComponentBody(viewType) {
    const bodies = {
        viewWebPage: '<iframe src="https://example.com" style="width: 100%; height: 100%; border: none;"></iframe>',
        viewWikimedia: '<iframe id="projectIframe" style="width: 100%; height: 100%; border: none;"></iframe>',
        compareCoordinates: '<div id="map" style="width: 100%; height: 100%;"></div>',
        viewProperties: `
        <div class="grid-container">
            <div class="grid-item grid-header">Property</div>
            <div class="grid-item grid-header">Value</div>
            <div class="grid-item grid-header">Dataset</div>
            <div class="grid-item grid-header">Value</div>
            <div class="grid-item">
                <select>
                    <option value="property1">Wikidata property</option>
                </select>
            </div>
            <div class="grid-item">
                value
            </div>
            <div class="grid-item">
                <select>
                    <option value="column1">Dataset column</option>
                </select>
            </div>
            <div class="grid-item">
                value
            </div>
        </div>

        <div class="button-container">
            <button>Add property</button>
        </div>
        `,
        reconciliationSettings: `
    <div class="componentContent">
        <h2>Data source</h2>
        <div class="propgrid grid-2">
            <div class="bold-text">Type:</div>
            <div class="rowcontent">
                <select id="serviceSelect">
                    <option>Google Spreadsheet</option>
                </select>
            </div>
            <div class="bold-text">Spreadsheet ID</div>
            <div class="rowcontent"><input type="text" id="sourceInput" placeholder="Add spreadsheet ID"></div>

            <div class="bold-text">Header row range</div>
            <div class="rowcontent"><input type="text" id="sourceInput" placeholder="eg. 'Dataset!A1:H1'"></div>

            <div class="bold-text">Data column</div>
            <div class="rowcontent">
				<select id="colSelect">
                    <option>Select column</option>
                </select>
			</div>
			
			<div class="bold-text">ID column</div>
            <div class="rowcontent">
				<select id="colSelect">
                    <option>Select column</option>
                </select>
			</div>
        </div>
        <h2>Search options</h2>
        <div class="propgrid grid-3">

            <div class="check"><input type="radio" id="txtradio-1"></div>
            <h3 class="rowcontent bold-text grid-span-2">SPARQL</h3>

            <div></div>
            <div class="rowcontent">Wikibase<br />First only Wikidata will be searched.</div>
            <select id="serviceSelect">
                <option value="wikidata" selected>Wikidata</option>
            </select>

            <div></div>
            <div class="rowcontent">Endpoint<br />Wikidata SPARQL endpoint uses mwapi to make a
                text search in Wikidata, while QLever makes a link search in Wikipedia articles.</div>
            <select id="serviceSelect">
                <option value="wikidata" selected>Wikidata Query Service</option>
                <option value="QLever">QLever</option>
            </select>

            <div></div>
            <div class="rowcontent">Language</div>
            <select id="searchLanguageSelect">
                <option value="en">English</option>
                <option value="fi">Finnish</option>
                <option value="sv">Swedish</option>
            </select>

            <div class="rowcontent grid-span-2-2 bold-text">Search with properties</div>
            <div class="grid-3 grid-span-2-2 propgrid">
                <div class="check">On/off</div>
                <div class="rowcontent">Property</div>
                <div class="rowcontent">Dataset value</div>
                <div class="check"><input type="checkbox" id="propcheck-1"></div>
                <div class="rowcontent"><input type="text" placeholder="eg. 'P31'"></div>
                <select id="colSelect">
                    <option>Select column</option>
                </select>
                <div class="grid-span-3">
                    <button id="typeButton">Add property</button>
                </div>
            </div>

            <div class="check"><input type="radio" id="txtradio-2"></div>
            <h3 class="rowcontent grid-span-2">Search Wikipedias with Internet search engines</h3>
            <div class="grid-span-2-2">Make an internet search limited to Wikipedias and add the QIDs of the results as
                reconciliation candidates.</div>
            <div class="grid-span-2-2">Example search: homme-panthères site:*.wikipedia.org</div>

            <div></div>
            <div class="rowcontent">Search engine</div>
            <select id="languageSelect">
                <option value="duckduckgo" selected>DuckDuckGo</option>
                <option value="google">Google</option>
                <option value="bing">Bing</option>
            </select>
        </div>
    </div>
        `,
        mentions: '<div>Mentions from Wikipedia articles, queried with QLever.</div>',
        default: '<div>Dummy component content</div>',
    };

    return bodies[viewType] || bodies.default;
}
