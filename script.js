// Function for converting URLs to mobile format
function convertToMobileUrl(url) {
    return url.replace(/www\./, 'm.');
}

// Update getAvailableProjects to include Wikibooks and Wikivoyage
function getAvailableProjects() {
    return ['Wikipedia', 'Wikimedia Commons', 'Wikibooks', 'Wikivoyage'];
}

// Update isLocalizedProject to include all 4 localized projects
function isLocalizedProject(project) {
    return ['Wikipedia', 'Wikibooks', 'Wikivoyage', 'Wikimedia Commons'].includes(project);
}

// Update getAvailableLanguages to include Wikibooks and Wikivoyage in projectMap
function getAvailableLanguages() {
    const projectMap = {
        'Wikipedia': ['en', 'es', 'fr'],
        'Wikibooks': ['en', 'es'],
        'Wikivoyage': ['en', 'es'],
        'Wikimedia Commons': ['en', 'es']
    };
    return projectMap;
}

// Update getWikimediaUrl to apply mobile URL conversion and support all 4 localized projects
function getWikimediaUrl(project, page) {
    const baseUrl = 'https://www.wikimedia.org/';
    const fullUrl = `${baseUrl}${project}/${page}`;
    return convertToMobileUrl(fullUrl);
}