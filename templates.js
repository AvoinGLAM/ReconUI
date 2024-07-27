// templates.js

function getTemplate(templateName) {
    const templates = {
        displayValueHeaderBottom: `
            <div>Display value specific options</div>
        `,
        viewWebPageHeaderBottom: `
            <div>View web page specific options</div>
        `,
        viewWikimediaHeaderBottom: `
            <div>View Wikimedia site specific options</div>
        `,
        compareCoordinatesHeaderBottom: `
            <div>Compare coordinates specific options</div>
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
        displayValue: '<div>Display value component content</div>',
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
