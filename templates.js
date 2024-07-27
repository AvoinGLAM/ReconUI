// templates.js

function getTemplate(templateName) {
    const templates = {
        viewWebPageHeaderBottom: `
            <div>View web page specific options</div>
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
                    <!-- Add more languages as needed -->
                </select>
            </div>
            <div class="row">
                <div id="wikidocumentariesLink"></div>
                <div id="reasonatorLink"></div>
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
            <div>Reconciliation settings specific options</div>
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
        viewWikimedia: '<iframe src="https://www.wikimedia.org" style="width: 100%; height: 100%; border: none;"></iframe>',
        compareCoordinates: '<div id="map" style="width: 100%; height: 100%;"></div>',
        compareDates: '<div>Compare dates component content</div>',
        viewAllProperties: '<div>View all properties component content</div>',
        reconciliationSettings: '<div>Reconciliation settings component content</div>',
        default: '<div>Dummy component content</div>',
    };

    return bodies[viewType] || bodies.default;
}
