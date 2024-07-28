// templates.js

function getTemplate(templateName) {
    const templates = {
        viewWebPageHeaderBottom: `
            <div class="row">
                <select class="bold-text" id="sourceweb">
                    <option>Authority ID</option>
                    <option>Dataset</option>
                </select>
                <select id="propertyselect">
                    <option value="P2347">YSO ID (P2347)</option>
                    <option value="P10221">UNESCO ICH ID (P10221)</option>
                    <option value="P214">VIAF ID (P214)</option>
                </select>
            </div>
            <div class="row">
                <div id="formatterUrl">display, add and edit formatter URL</div>
            </div>
            <div class="row">
                <div id="webLink"><a href="#">formatted link</a></div>
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
        defaultHeaderBottom: `
            <div>Default options</div>
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
                    <option value="property1">Property 1</option>
                    <option value="property2">Property 2</option>
                    <option value="property3">Property 3</option>
                </select>
            </div>
            <div class="grid-item">
                value
            </div>
            <div class="grid-item">
                <select>
                    <option value="column1">Column 1</option>
                    <option value="column2">Column 2</option>
                    <option value="column3">Column 3</option>
                </select>
            </div>
            <div class="grid-item">
                value
            </div>
            <div class="grid-item">
                <select>
                    <option value="property1">Property 1</option>
                    <option value="property2">Property 2</option>
                    <option value="property3">Property 3</option>
                </select>
            </div>
            <div class="grid-item">
                value
            </div>
            <div class="grid-item">
                <select>
                    <option value="column1">Column 1</option>
                    <option value="column2">Column 2</option>
                    <option value="column3">Column 3</option>
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
            <h3>Data source</h3>
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
                <div class="rowcontent"><input type="text" id="sourceInput" placeholder="eg. 'Dataset!A2:A'"></div>
            </div>
            <h3>Reconciliation service</h3>
            <div class="row">
                <select id="serviceSelect">
                    <option>Wikidata SPARQL</option>
                </select>
            </div>
            <h3>Action API text search</h3>
            <div class="propgrid grid-3">
                <div class="checkH">On/off</div>
                <div class="rowcontent">Project</div>
                <div class="rowcontent">Language</div>
                <div class="check"><input type="checkbox" id="txtcheck-1"></div>
                    <select id="serviceSelect">
                        <option selected>Wikidata</option>
                        <option>Wikipedia</option>
                        <option>Wikimedia Commons</option>
                    </select>
                <select id="languageSelect">
                    <option value="en" selected>English</option>
                    <option value="fi">Finnish</option>
                    <option value="sv">Swedish</option>
                </select>
            </div>
            <h3>Search with properties</h3>
            <div class="propgrid grid-3">
                <div class="checkH">On/off</div>
                <div class="rowcontent">Property</div>
                <div class="rowcontent">Dataset value</div>
                <div class="check"><input type="checkbox" id="propcheck-1"></div>
                <div class="rowcontent"><input type="text" placeholder="eg. 'P31'"></div>
                <select id="colSelect">
                    <option>Select column</option>
                </select>
            </div>

        <div class>
        <button id="typeButton">Add property</button>
</div>
        </div>
        `,
        default: '<div>Dummy component content</div>',
    };

    return bodies[viewType] || bodies.default;
}
