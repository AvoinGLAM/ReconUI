function convertToMobileUrl(url) {
    // Convert standard Wikimedia URL to mobile URL
    return url.replace(/(www|en)\./, 'm.');
}

function getWikimediaUrl(project, title) {
    const baseUrl = `https://${project}.wikimedia.org/wiki/`;
    return convertToMobileUrl(baseUrl + encodeURIComponent(title));
}

function isLocalizedProject(project) {
    const localizedProjects = ['wikipedia', 'wiktionary', 'wikinews', 'wikiquote', 'wikimedia', 'commons', 'wikivoyage', 'wikibooks'];
    return localizedProjects.includes(project);
}

function getAvailableProjects() {
    return ['wikipedia', 'wiktionary', 'wikinews', 'wikiquote', 'wikimedia', 'commons', 'wikivoyage', 'wikibooks'];
}