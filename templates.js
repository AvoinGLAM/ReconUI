// templates.js

function getTemplate(templateName) {
    const templates = {
        viewWebPageHeaderBottom: `
            <div class="row">
                <select class="bold-text" id="sourceweb">
                    <option>Wikidata property</option>
                    <option>Dataset</option>
                </select>
                <select id="propertyselect">
                    <option value="P10221">UNESCO ICH ID (P10221)</option>
                    <option value="P214">VIAF ID (P214)</option>
                    <!-- Add more languages as needed -->
                </select>
            </div>
            <div class="row">
                <div id="webLink"></div>
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
                <div class="bold-text">Dataset value</div> <a id="projectUrl" href="#" target="_blank">Simple text</a>
            </div>
        `,
        compareDatesHeaderBottom: `
            <div>Compare dates specific options</div>
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
        compareDates: '<div>Compare dates component content</div>',
        viewProperties: '<div>View all properties component content</div>',
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

                <div class="bold-text">Key column</div>
                <div class="rowcontent"><input type="text" id="sourceInput" placeholder="eg. 'Dataset!A2:A'"></div>
            </div>
            <h3>Reconciliation service</h3>
            <div class="row">
                <select id="serviceSelect">
                    <option>Wikidata Action API via SPARQL</option>
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
