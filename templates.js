// templates.js

// Define HTML snippets for different components
const templates = {
    viewWebPageHeaderBottom: `
        <div class="header-bottom-row">
            <div class="component-header-bottom-left">
                <strong>Property</strong>
                <select id="propertySelect">
                    <!-- Options will be populated dynamically -->
                </select>
            </div>
            <div class="component-header-bottom-right">
                <!-- Other potential options -->
            </div>
        </div>
    `,
    displayValueHeaderBottom: `
        <div class="header-bottom-row">
            <div class="component-header-bottom-left">
                <!-- Specific options for Display Value -->
            </div>
            <div class="component-header-bottom-right">
                <!-- Other potential options -->
            </div>
        </div>
    `,
    viewWikimedia: `
    <div class="component-header">
        <div class="component-header-top">
            <select>
                <option value="displayValue">Display value</option>
                <option value="viewWebPage">View web page</option>
                <option value="viewWikimedia" selected>View Wikimedia site</option>
                <option value="compareCoordinates">Compare coordinates</option>
                <option value="compareDates">Compare dates</option>
                <option value="viewAllProperties">View all properties</option>
                <option value="reconciliationSettings">Reconciliation settings</option>
            </select>
            <select>
                <option value="view">View</option>
                <option value="maximize">Maximize</option>
                <option value="close">Close</option>
            </select>
        </div>
        <div class="component-header-bottom">
            <div class="row">
                <div class="bold-text">Project</div>
                <select id="projectSelect">
                    <option>Wikidocumentaries</option>
                    <option>Wikipedia</option>
                    <option>Wikimedia Commons</option>
                </select>
                <select id="languageSelect">
                    <option>English</option>
                    <option>Finnish</option>
                </select>
            </div>
            <div class="rowb">
                <a id="projectUrl" href="#" target="_blank">Simple text</a>
            </div>
        </div>
    </div>
    <div class="component-body">
        <iframe id="projectIframe" style="width: 100%; height: 100%; border: none;"></iframe>
    </div>
    `,
    compareCoordinates: `
    <div class="component-header">
        <div class="component-header-top">
            <select>
                <option value="displayValue">Display value</option>
                <option value="viewWebPage">View web page</option>
                <option value="viewWikimedia">View Wikimedia site</option>
                <option value="compareCoordinates" selected>Compare coordinates</option>
                <option value="compareDates">Compare dates</option>
                <option value="viewAllProperties">View all properties</option>
                <option value="reconciliationSettings">Reconciliation settings</option>
            </select>
            <select>
                <option value="view">View</option>
                <option value="maximize">Maximize</option>
                <option value="close">Close</option>
            </select>
        </div>
        <div class="component-header-bottom">
            <div class="row">
            </div>
        </div>
    </div>
    <div class="component-body">
        <div id="map" style="width: 100%; height: 100%;"></div>
    </div>
    `,
    compareDatesHeaderBottom: `
        <div class="header-bottom-row">
            <div class="component-header-bottom-left">
                <!-- Options for Compare Dates -->
            </div>
        </div>
    `,
    viewAllPropertiesHeaderBottom: `
        <div class="header-bottom-row">
            <div class="component-header-bottom-left">
                <!-- Options for View All Properties -->
            </div>
        </div>
    `,
    reconciliationSettingsHeaderBottom: `
        <div class="header-bottom-row">
            <div class="component-header-bottom-left">
                <!-- Options for Reconciliation Settings -->
            </div>
        </div>
    `,
};

// Function to get a template by ID
function getTemplate(templateId) {
    return templates[templateId] || '';
}

// Function to generate the component body based on the view type
function generateComponentBody(viewType) {
    switch (viewType) {
        case 'viewWebPage':
            return `
                <div id="webPageContent">
                    <iframe id="webPageIframe" style="width: 100%; height: 100%; border: none;"></iframe>
                </div>
            `;
        case 'displayValue':
            return '<div>Display value component content</div>';
        case 'viewWikimedia':
            return '<iframe src="https://www.wikimedia.org" style="width: 100%; height: 100%; border: none;"></iframe>';
        case 'compareCoordinates':
            return '<div id="map" style="width: 100%; height: 100%;"></div>';
        case 'compareDates':
            return '<div>Compare dates component content</div>';
        case 'viewAllProperties':
            return '<div>View all properties component content</div>';
        case 'reconciliationSettings':
            return '<div>Reconciliation settings component content</div>';
        default:
            return '<div>Dummy component content</div>';
    }
}

// Function to replace the component content and header
function replaceComponentContent(component, viewType) {
    const componentBody = component.querySelector('.component-body');
    componentBody.innerHTML = generateComponentBody(viewType);

    const componentHeaderBottom = component.querySelector('.component-header-bottom');
    componentHeaderBottom.innerHTML = getTemplate(`${viewType}HeaderBottom`);

    // Reinitialize map if compareCoordinates is selected
    if (viewType === 'compareCoordinates') {
        initializeMapInNewComponent(component.querySelector('#map'));
    }
}
