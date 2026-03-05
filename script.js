let map;
let markersLayer;
let lang = 'en';
let currentPage = 0;           // ONLY DECLARATION
const resultsPerPage = 20;     // ONLY DECLARATION
let originalContext = null;
let isSearching = false;
let itemSitelinks = {};  // Cache: { qid: { projectType: [{ lang, title, url }, ...] } }
let itemAuthorityIds = {};  // Cache: { qid: [{ propertyId, propertyLabel, value, url }] }
let itemWikidataUrls = {};  // Cache: { qid: [{ propertyId, propertyLabel, url }] }
let currentDisplayedQids = [];       // QIDs currently shown in the result list
let fetchedAuthorityIdsForQids = new Set();  // QIDs whose authority IDs have already been fetched
let fetchedWikidataUrlsForQids = new Set();  // QIDs whose Wikidata URLs have already been fetched

// ===== AUTHORITY URL ACCESSIBILITY CACHE =====
// Persists iframe-embedding status of authority URLs across sessions so blocked
// sources are ranked lower in the dropdown without rechecking every page load.
// Values per URL: 'accessible' | 'blocked' | 'unknown'
const AUTHORITY_ACCESS_STORAGE_KEY = 'authorityAccessCache';

function loadAuthorityAccessCache() {
    try {
        const stored = localStorage.getItem(AUTHORITY_ACCESS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

function saveAuthorityAccessCache() {
    try {
        localStorage.setItem(AUTHORITY_ACCESS_STORAGE_KEY, JSON.stringify(authorityAccessCache));
    } catch (e) {
        console.warn('Could not save authority access cache:', e);
    }
}

// Cache object: { [url: string]: 'accessible' | 'blocked' | 'unknown' }
let authorityAccessCache = loadAuthorityAccessCache();

/**
 * AUTHORITY URL ACCESSIBILITY CHECK
 * Sends a CORS HEAD request to the URL and inspects the X-Frame-Options and
 * Content-Security-Policy response headers to determine whether the page can be
 * embedded in an iframe.
 *
 * Possible return values:
 *   'accessible' – no framing restrictions detected in headers
 *   'blocked'    – X-Frame-Options DENY/SAMEORIGIN or CSP frame-ancestors blocks embedding
 *   'unknown'    – CORS prevented reading headers (iframe may still work)
 *
 * Results are stored in authorityAccessCache and persisted to localStorage so
 * each URL is only checked once.
 */
async function checkAuthorityUrl(url) {
    if (authorityAccessCache[url] !== undefined) {
        return authorityAccessCache[url];
    }

    let status = 'unknown';

    try {
        const response = await fetch(url, { method: 'HEAD', mode: 'cors' });

        const xfo = response.headers.get('X-Frame-Options');
        const csp = response.headers.get('Content-Security-Policy');

        // Assume accessible unless a blocking header is found
        status = 'accessible';

        if (xfo) {
            const v = xfo.trim().toUpperCase();
            if (v === 'DENY' || v === 'SAMEORIGIN') {
                status = 'blocked';
            }
        }

        if (status !== 'blocked' && csp) {
            const faMatch = csp.match(/frame-ancestors\s+([^;]+)/i);
            if (faMatch) {
                const directive = faMatch[1].trim().toLowerCase();
                // 'none' blocks entirely; bare 'self' blocks all external origins
                if (directive === "'none'" || directive === "'self'") {
                    status = 'blocked';
                }
            }
        }
    } catch {
        // CORS or network error – headers are unreadable but the iframe may still
        // load successfully (many sites allow iframe embedding but not CORS fetch).
        status = 'unknown';
    }

    authorityAccessCache[url] = status;
    saveAuthorityAccessCache();
    return status;
}

/**
 * Returns the cached accessibility status for a URL, defaulting to 'unknown'.
 */
function getAuthorityStatus(url) {
    return authorityAccessCache[url] || 'unknown';
}

/**
 * CHECK AND REFRESH AUTHORITY ACCESS FOR A QID
 * Runs accessibility checks for all authority URLs of the given item in the
 * background and re-renders the dropdown only if at least one status changed,
 * preventing redundant refreshes once all URLs have been checked.
 */
async function checkAndUpdateAuthorityAccess(qid) {
    const authorities = itemAuthorityIds[qid] || [];
    if (authorities.length === 0) return;

    // Pre-compute embed URLs once to avoid repeated getEmbedUrl calls
    const embedUrls = authorities.map(auth => getEmbedUrl(auth));

    // Snapshot statuses before the checks so we can detect changes
    const statusesBefore = embedUrls.map(url => getAuthorityStatus(url));

    const checks = embedUrls.map(url => checkAuthorityUrl(url));
    await Promise.allSettled(checks);

    // Only refresh the dropdown if at least one status changed; this prevents
    // an infinite update loop on subsequent calls when the cache is already warm.
    const anyChanged = embedUrls.some((url, i) => getAuthorityStatus(url) !== statusesBefore[i]);
    if (!anyChanged) return;

    // Refresh the dropdown only if the authority view for this QID is still active
    const viewTypeSelect = document.getElementById('viewTypeSelect');
    const selectedQid = document.querySelector('.item.selected')?.getAttribute('data-qid');
    if (viewTypeSelect?.value === 'viewWebData' && selectedQid === qid) {
        updateAuthorityDropdown(qid);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup UI elements
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const mainMapContainer = document.getElementById('map');
    document.getElementById('settingsButton').onclick = () => {
    alert("Settings:\nLanguage: English\nEngine: WDQS + mwapi\nResults per page: 20");
    };
    
    if (mainMapContainer) initializeMap(mainMapContainer);

    if (!searchButton || !searchInput) {
        console.error("CRITICAL: searchButton or searchInput not found in HTML!");
        return; // Stop if UI is missing
    }

    // 2. Parse URL Parameters (Base64 version)
    const urlParams = new URLSearchParams(window.location.search);
    const ctxParam = urlParams.get('ctx');
    const searchTerm = urlParams.get('query');

    if (ctxParam) {
        try {
            // Correctly decode Base64 back to a JSON string, then to an object
            const decoded = atob(ctxParam.replace(/-/g, '+').replace(/_/g, '/'));
            originalContext = JSON.parse(decoded);
            console.log("Context decoded successfully");
        } catch (e) {
            console.error("Context decoding failed:", e);
        }
    }

    // 3. Define the search action
    const executeSearch = () => {
        const query = searchInput.value.trim();
        if (query && !isSearching) {
            populateItems(query, 0);
        }
    };

    // 4. Attach listeners
    searchButton.addEventListener('click', executeSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeSearch();
        }
    });

    // 5. Safe Auto-Trigger
    if (searchTerm) {
        searchInput.value = decodeURIComponent(searchTerm);
        // Delay helps ensure the Google Transport is stable
        setTimeout(executeSearch, 1000); 
    }

    initializeDynamicInputFields();

    const viewTypeSelect = document.getElementById('viewTypeSelect');
    if (viewTypeSelect) {
        viewTypeSelect.addEventListener('change', () => {
            const selectedQid = document.querySelector('.item.selected')?.getAttribute('data-qid');
            handleViewTypeChange(viewTypeSelect.value, selectedQid);
        });
    }
});

/**
 * RECONCILIATION BRIDGE
 */
function sendMatchToSheet(qid) {
    // Look for the Google object
    const isGoogle = (typeof google !== 'undefined' && google.script && google.script.run);
    
    if (isGoogle) {
        // Dynamically get config from your Speculo settings checkboxes
        const config = {
            includeLabel: document.getElementById('checkLabel')?.checked ?? true,
            includeDesc: document.getElementById('checkDesc')?.checked ?? true,
            langs: ['en'] // You can expand this based on your settings button logic
        };

        // UI feedback using the button that triggered the event
        const btn = event.currentTarget; 
        const originalText = btn.textContent;
        btn.textContent = "SAVING...";
        btn.disabled = true;

        

        google.script.run
            .withSuccessHandler(() => {
                // If Sidebar is open, trigger the "✓ Match Applied" toast
                if (window.top && typeof window.top.remoteMatchNotification === 'function') {
                    window.top.remoteMatchNotification();
                }
                // Close the Speculo modal after successful save
                google.script.host.close();
            })
            .withFailureHandler((err) => {
                btn.textContent = originalText;
                btn.disabled = false;
                alert("Apps Script Error: " + err);
            })
            .applyEntity(qid, "SINGLE_CELL", config, originalContext);
    } else {
        console.error("Google API not found. Context:", originalContext);
        alert("The connection to Google Sheets is not active yet. Please wait a few seconds and try again.");
    }
}

function handleMatchButtonClick(qid) {
    sendMatchToSheet(qid); // Calls the Google Sheets bridge we built
}

/**
 * WIKIDATA SEARCH & UI GENERATION
 */
async function fetchWikidataItems(query, page, limit) {
    const offset = page * limit;
    
    console.log('Fetching with offset:', offset, 'limit:', limit, 'query:', query);
    
    try {
        // Use SPARQL with mwapi, but fetch ALL results and manually paginate in JavaScript
        // This is because mwapi doesn't support offset properly
        const sparqlQuery = `
        SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coord 
            (IF(BOUND(?img), URI(CONCAT("https://commons.wikimedia.org/wiki/Special:FilePath/", 
            REPLACE(STR(?img), "http://commons.wikimedia.org/wiki/Special:FilePath/", ""), "?width=300")), "") AS ?thumb)
        WHERE {
            SERVICE wikibase:mwapi {
                bd:serviceParam wikibase:endpoint "www.wikidata.org";
                                wikibase:api "EntitySearch";
                                mwapi:search "${query}";
                                mwapi:language "${lang}";
                                mwapi:limit "500".
                ?item wikibase:apiOutputItem mwapi:item.
                ?item wikibase:apiOutputItemLabel mwapi:label.
            }
            OPTIONAL { ?item wdt:P18 ?img. }
            OPTIONAL { ?item wdt:P625 ?coord. }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${lang},mul,en". }
        } GROUP BY ?item ?itemLabel ?itemDescription ?coord ?img LIMIT 500`;
        
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
        
        console.log('SPARQL query for search:', query);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('Raw SPARQL results:', data.results.bindings.length);
        
        // Deduplicate results by QID
        const seen = new Set();
        const allResults = data.results.bindings.filter(item => {
            const qid = item.item.value.split('/').pop();
            if (seen.has(qid)) return false;
            seen.add(qid);
            return true;
        });
        
        console.log('After deduplication:', allResults.length);
        
        // Manual pagination in JavaScript
        const start = offset;
        const end = offset + limit;
        const paginatedResults = allResults.slice(start, end);
        
        console.log('Returning paginated results:', paginatedResults.length, '(from', start, 'to', end + ')');
        
        return paginatedResults;
        
    } catch (error) {
        console.error("Error fetching items:", error);
        return [];
    }
}

/**
 * SITELINKS BATCH QUERY
 * Fetches all sitelinks for a batch of Wikidata items
 */
/**
 * SITELINKS BATCH QUERY
 * Fetches all sitelinks for a batch of Wikidata items
 * Batches requests into groups of 10 to avoid Wikidata limits
 */
async function fetchSitelinksForItems(qids) {
    if (!qids || qids.length === 0) return [];

    const batchSize = 10;
    const allResults = [];

    console.log('Total QIDs to fetch:', qids.length);

    // Process QIDs in batches of 10
    for (let i = 0; i < qids.length; i += batchSize) {
        const batch = qids.slice(i, i + batchSize);
        console.log(`Batch ${Math.floor(i / batchSize) + 1} QIDs:`, batch);
        
        const values = batch.map(qid => `wd:${qid}`).join(' ');
        
        const sparqlQuery = `
        SELECT ?item ?sitelink ?wiki ?title WHERE {
            VALUES ?item { ${values} }
            
            ?sitelink schema:about ?item ;
                      schema:isPartOf ?wiki ;
                      schema:name ?title .
            
            FILTER(STRSTARTS(STR(?wiki), "https://"))
        }
        ORDER BY ?item ?wiki`;
        
        try {
            const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
            const response = await fetch(url);
            const data = await response.json();
            
            const batchResults = data.results.bindings;
            console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${batchResults.length} results`);
            console.log(`Batch ${Math.floor(i / batchSize) + 1} QIDs with results:`, [...new Set(batchResults.map(r => r.item.value.split('/').pop()))]);
            
            allResults.push(...batchResults);
        } catch (error) {
            console.error("Error fetching sitelinks batch:", error);
        }
    }

    console.log("Total sitelinks fetched:", allResults.length);
    return allResults;
}

/**
 * AUTHORITY IDS BATCH QUERY
 * Fetches external identifier values, their formatter URLs (P1630), and — where
 * available — their embed URL templates (P2720) for a batch of items.
 * Only external ID properties that have a P1630 formatter URL are included — properties
 * without one cannot produce a displayable URL and are excluded.
 * P2720 is fetched as an OPTIONAL so properties that lack an embed template are
 * still returned; the embed URL is simply omitted for those.
 * Batches requests into groups of 10 to avoid Wikidata limits.
 */
async function fetchAuthorityIdsForItems(qids) {
    if (!qids || qids.length === 0) return [];

    const batchSize = 10;
    const allResults = [];

    for (let i = 0; i < qids.length; i += batchSize) {
        const batch = qids.slice(i, i + batchSize);
        const values = batch.map(qid => `wd:${qid}`).join(' ');

        const sparqlQuery = `
        SELECT ?item ?property ?propertyLabel ?value (SAMPLE(?fmtUrl) AS ?formatterUrl) (SAMPLE(?embedFmtUrl) AS ?embedUrl) WHERE {
            VALUES ?item { ${values} }
            ?item ?p ?value .
            ?property wikibase:directClaim ?p ;
                      wikibase:propertyType wikibase:ExternalId ;
                      wdt:P1630 ?fmtUrl .
            OPTIONAL { ?property wdt:P2720 ?embedFmtUrl . }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang}". }
        }
        GROUP BY ?item ?property ?propertyLabel ?value
        ORDER BY ?item ?property`;

        try {
            const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
            const response = await fetch(url);
            const data = await response.json();
            allResults.push(...data.results.bindings);
        } catch (error) {
            console.error("Error fetching authority IDs batch:", error);
        }
    }

    return allResults;
}

/**
 * PROCESS SITELINKS RESULTS
 * Takes raw sitelinks results and caches them organized by item
 */
function processSitelinksResults(results) {
    const cache = {};
    
    results.forEach(result => {
        const qid = result.item.value.split('/').pop();  // Extract QID from URL
        
        if (!cache[qid]) {
            cache[qid] = {};
        }
        
        // Parse this single sitelink
        const wikiUrl = result.wiki.value;
        const sitelink = result.sitelink.value;
        const title = result.title.value;
        
        const match = wikiUrl.match(/https:\/\/([a-z-]+)\.([a-z]+)\.org\//);
        
        if (match) {
            const lang = match[1];
            const project = match[2];
            const projectType = `${project}`;
            
            if (!cache[qid][projectType]) {
                cache[qid][projectType] = [];
            }
            
            cache[qid][projectType].push({
                lang: lang,
                title: title,
                url: sitelink,
                wikiUrl: wikiUrl
            });
        }
    });
    
    return cache;
}

/**
 * UPDATE DROPDOWN DATA AFTER SEARCH
 * Called after items are fetched to get their sitelinks
 */
async function updateSitelinksForCurrentResults(items) {
    // Extract QIDs from items
    const qids = items.map(item => {
        const itemUrl = item.item.value;
        return itemUrl.split('/').pop();
    });
    
    // Fetch sitelinks for all items
    const sitelinksResults = await fetchSitelinksForItems(qids);
    
    // Cache the results
    const newCache = processSitelinksResults(sitelinksResults);
    itemSitelinks = { ...itemSitelinks, ...newCache };
    
    console.log("Sitelinks cached for QIDs:", qids);
    console.log("Sitelinks cache:", itemSitelinks);
}

/**
 * PROCESS AUTHORITY IDS RESULTS
 * Takes raw SPARQL results and caches authority IDs per item, constructing:
 * - `url`      from the P1630 formatter URL (always present)
 * - `embedUrl` from the P2720 embed URL template (present only when the
 *              property has one; undefined otherwise)
 * Both URLs are produced by substituting the identifier value for `$1`.
 */
function processAuthorityIdsResults(results) {
    const cache = {};

    results.forEach(result => {
        const qid = result.item.value.split('/').pop();

        if (!cache[qid]) cache[qid] = [];

        const propertyId = result.property.value.split('/').pop();
        const propertyLabel = result.propertyLabel?.value || propertyId;
        const value = result.value.value;
        const formatterUrl = result.formatterUrl?.value;

        if (formatterUrl) {
            const url = formatterUrl.replace(/\$1/g, value);
            const embedTemplate = result.embedUrl?.value;
            const embedUrl = embedTemplate ? embedTemplate.replace(/\$1/g, value) : undefined;
            cache[qid].push({ propertyId, propertyLabel, value, url, embedUrl });
        }
    });

    return cache;
}

/**
 * FETCH AND CACHE AUTHORITY IDS FOR A LIST OF QIDS
 * Skips QIDs that have already been fetched (checked against fetchedAuthorityIdsForQids).
 */
async function updateAuthorityIdsForQids(qids) {
    const unfetched = qids.filter(qid => !fetchedAuthorityIdsForQids.has(qid));
    if (unfetched.length === 0) return;

    const results = await fetchAuthorityIdsForItems(unfetched);
    const newCache = processAuthorityIdsResults(results);
    itemAuthorityIds = { ...itemAuthorityIds, ...newCache };
    unfetched.forEach(qid => fetchedAuthorityIdsForQids.add(qid));
    console.log("Authority IDs cached for QIDs:", unfetched);
}

/**
 * WIKIDATA URLS BATCH QUERY
 * Fetches direct URL property values for P856 (official website), P953 (work available at URL),
 * P973 (described at URL), and P1065 (archive URL) for a batch of items.
 * Batches requests into groups of 10 to avoid Wikidata limits.
 */
async function fetchWikidataUrlsForItems(qids) {
    if (!qids || qids.length === 0) return [];

    const batchSize = 10;
    const allResults = [];

    for (let i = 0; i < qids.length; i += batchSize) {
        const batch = qids.slice(i, i + batchSize);
        const values = batch.map(qid => `wd:${qid}`).join(' ');

        const sparqlQuery = `
        SELECT ?item ?property ?propertyLabel ?url WHERE {
            VALUES ?item { ${values} }
            VALUES ?property { wd:P856 wd:P953 wd:P973 wd:P1065 }
            ?item ?prop ?url .
            ?property wikibase:directClaim ?prop .
            SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang}". }
        }
        ORDER BY ?item ?property`;

        try {
            const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
            const response = await fetch(url);
            const data = await response.json();
            allResults.push(...data.results.bindings);
        } catch (error) {
            console.error("Error fetching Wikidata URLs batch:", error);
        }
    }

    return allResults;
}

/**
 * PROCESS WIKIDATA URLS RESULTS
 * Takes raw SPARQL results and caches Wikidata URL properties per item.
 */
function processWikidataUrlsResults(results) {
    const cache = {};

    results.forEach(result => {
        const qid = result.item.value.split('/').pop();
        if (!cache[qid]) cache[qid] = [];

        const propertyId = result.property.value.split('/').pop();
        const propertyLabel = result.propertyLabel?.value || propertyId;
        const url = result.url.value;

        cache[qid].push({ propertyId, propertyLabel, url });
    });

    return cache;
}

/**
 * FETCH AND CACHE WIKIDATA URLS FOR A LIST OF QIDS
 * Skips QIDs that have already been fetched (checked against fetchedWikidataUrlsForQids).
 */
async function updateWikidataUrlsForQids(qids) {
    const unfetched = qids.filter(qid => !fetchedWikidataUrlsForQids.has(qid));
    if (unfetched.length === 0) return;

    const results = await fetchWikidataUrlsForItems(unfetched);
    const newCache = processWikidataUrlsResults(results);
    itemWikidataUrls = { ...itemWikidataUrls, ...newCache };
    unfetched.forEach(qid => fetchedWikidataUrlsForQids.add(qid));
    console.log("Wikidata URLs cached for QIDs:", unfetched);
}

// ===== CONSTANTS FOR URL BUILDING =====
const PROJECT_MAP = {
    'Wikipedia': 'wikipedia',
    'Wikisource': 'wikisource',
    'Wikivoyage': 'wikivoyage',
    'Wikibooks': 'wikibooks',
    'Wikinews': 'wikinews'
};

const MULTILINGUAL_PROJECTS = {
    'Wikimedia Commons': 'commons',
    'Metawiki': 'meta'
};

const PROJECT_DOMAINS = {
    'wikipedia': 'wikipedia.org',
    'wikisource': 'wikisource.org',
    'wikivoyage': 'wikivoyage.org',
    'wikibooks': 'wikibooks.org',
    'wikinews': 'wikinews.org',
    'commons': 'commons.wikimedia.org',
    'meta': 'meta.wikimedia.org'
};

/**
 * GET AVAILABLE PROJECTS FOR AN ITEM
 * Only returns the 4 supported projects in the specified order.
 */
function getAvailableProjects(qid) {
    if (!itemSitelinks[qid]) return [];

    const sitelinks = itemSitelinks[qid];
    const projects = [];

    Object.entries(PROJECT_MAP).forEach(([projectName, projectKey]) => {
        if (sitelinks[projectKey]) {
            projects.push(projectName);
        }
    });

    Object.entries(MULTILINGUAL_PROJECTS).forEach(([projectName, langKey]) => {
        if (sitelinks['wikimedia']?.some(e => e.lang === langKey)) {
            projects.push(projectName);
        }
    });

    return projects;
}

/**
 * GET AVAILABLE LANGUAGES FOR AN ITEM AND PROJECT
 * Only applicable for localized projects (Wikipedia, Wikisource).
 */
function getAvailableLanguages(qid, projectType) {
    const normalizedProject = PROJECT_MAP[projectType];
    
    if (!normalizedProject || !itemSitelinks[qid]?.[normalizedProject]) return [];

    return itemSitelinks[qid][normalizedProject].map(entry => ({
        code: entry.lang,
        title: entry.title
    }));
}

/**
 * BUILD WIKIMEDIA URL WITH PROPER STRUCTURE
 * Constructs canonical URL in the format https://[lang].[domain]/wiki/[title]
 */
function buildWikimediaUrl(projectKey, langCode, title) {
    const domain = PROJECT_DOMAINS[projectKey];
    if (!domain) return null;
    
    const baseUrl = (projectKey === 'commons' || projectKey === 'meta') 
        ? `https://${domain}/wiki/${encodeURIComponent(title)}`
        : `https://${langCode}.${domain}/wiki/${encodeURIComponent(title)}`;
    
    return baseUrl;
}

/**
 * BUILD WIKIDOCUMENTARIES URL
 * Constructs URL in the format https://wikidocumentaries-demo.wmcloud.org/{qid}?language={langCode}
 */
function buildWikidocumentariesUrl(qid, langCode) {
    return `https://wikidocumentaries-demo.wmcloud.org/${encodeURIComponent(qid)}?language=${encodeURIComponent(langCode)}`;
}

/**
 * UPDATE WIKIDOCUMENTARIES DISPLAY
 * Load the Wikidocumentaries page for a QID into the iframe
 */
function updateWikidocumentariesDisplay(qid, langCode) {
    const iframe = document.getElementById('projectIframe');
    const projectUrl = document.getElementById('projectUrl');

    if (!iframe || !projectUrl) return;

    const url = buildWikidocumentariesUrl(qid, langCode);
    projectUrl.href = url;
    projectUrl.textContent = url;
    projectUrl.style.display = '';
    iframe.src = url;
}

/**
 * Returns an embed-friendly URL for the given authority entry.
 * Uses the P2720 embed URL template value when one was returned by Wikidata;
 * falls back to the standard P1630 formatter URL otherwise.
 */
function getEmbedUrl(auth) {
    return auth.embedUrl || auth.url;
}

/**
 * UPDATE AUTHORITY DROPDOWN
 * Populate the authority source selector with available external IDs for the
 * selected item.
 *
 * Sort order (ascending priority number = shown first):
 *   0 – has P2720 embed URL (declared embeddable by Wikidata)
 *   1 – accessible (no blocking headers detected by checkAuthorityUrl)
 *   2 – unknown (CORS prevented header inspection; iframe may still work)
 *   3 – blocked (X-Frame-Options or CSP frame-ancestors detected)
 *
 * Blocked entries are moved to the bottom and visually dimmed so users can
 * still select them and open the link in a new tab if needed.
 * Background URL checks are kicked off and will refresh the dropdown once
 * results are available.
 */
function updateAuthorityDropdown(qid) {
    const authoritySelect = document.getElementById('authoritySelect');
    const projectUrl = document.getElementById('projectUrl');
    const iframe = document.getElementById('projectIframe');

    if (!authoritySelect || !projectUrl || !iframe) return;

    const authorities = itemAuthorityIds[qid] || [];

    if (authorities.length === 0) {
        authoritySelect.style.display = 'none';
        projectUrl.style.display = 'none';
        iframe.src = 'no-content.html';
        return;
    }

    authoritySelect.style.display = '';
    projectUrl.style.display = '';

    // Remember the currently selected index before rebuilding the list
    const previousValue = authoritySelect.value;
    authoritySelect.innerHTML = '';

    // Numeric rank used for sorting (lower = shown higher in the list)
    const statusRank = { accessible: 1, unknown: 2, blocked: 3 };

    const sorted = authorities
        .map((auth, index) => ({ auth, index }))
        .sort((a, b) => {
            // Primary: entries with a P2720 embed URL always come first
            const aEmbed = a.auth.embedUrl ? 0 : 1;
            const bEmbed = b.auth.embedUrl ? 0 : 1;
            if (aEmbed !== bEmbed) return aEmbed - bEmbed;

            // Secondary: sort by accessibility status
            const aRank = statusRank[getAuthorityStatus(getEmbedUrl(a.auth))] ?? statusRank.unknown;
            const bRank = statusRank[getAuthorityStatus(getEmbedUrl(b.auth))] ?? statusRank.unknown;
            return aRank - bRank;
        });

    sorted.forEach(({ auth, index }) => {
        const option = document.createElement('option');
        option.value = index;

        const status = getAuthorityStatus(getEmbedUrl(auth));
        let label = `${auth.propertyLabel} (${auth.propertyId}): ${auth.value}`;
        if (status === 'blocked') {
            label += ' (blocked)';
            option.className = 'authority-option-blocked';
            option.style.color = '#999';
            option.style.fontStyle = 'italic';
        }
        option.textContent = label;
        authoritySelect.appendChild(option);
    });

    authoritySelect.onchange = () => {
        updateAuthorityDisplay(qid, parseInt(authoritySelect.value, 10));
    };

    // Restore the previous selection when the dropdown is refreshed after a
    // background check; otherwise pick the first non-blocked entry (or the
    // first entry if everything is blocked).
    const previousStillExists = Array.from(authoritySelect.options).some(o => o.value === previousValue);
    if (previousStillExists) {
        authoritySelect.value = previousValue;
    } else {
        const firstGood = sorted.find(({ auth }) => getAuthorityStatus(getEmbedUrl(auth)) !== 'blocked');
        authoritySelect.value = firstGood ? firstGood.index : sorted[0].index;
    }

    // Load the currently selected authority into the iframe
    updateAuthorityDisplay(qid, parseInt(authoritySelect.value, 10));

    // Kick off background accessibility checks; the dropdown will be refreshed
    // automatically when new status information becomes available.
    checkAndUpdateAuthorityAccess(qid);
}

/**
 * UPDATE AUTHORITY DISPLAY
 * Load the selected authority into the iframe using an embed-friendly URL where
 * one is available, and show the standard page URL as a link.
 * Sites that block iframe embedding via X-Frame-Options will not display in the
 * frame; use the link above to open them in a new tab.
 */
function updateAuthorityDisplay(qid, index) {
    const authorities = itemAuthorityIds[qid] || [];
    const auth = authorities[index];
    if (!auth) return;

    const iframe = document.getElementById('projectIframe');
    const projectUrl = document.getElementById('projectUrl');

    if (!iframe || !projectUrl) return;

    projectUrl.href = auth.url;
    projectUrl.textContent = auth.url;
    iframe.src = getEmbedUrl(auth);
}

/**
 * CHECK AND REFRESH WIKIDATA URL ACCESS FOR A QID
 * Runs accessibility checks for all Wikidata URLs of the given item in the
 * background and re-renders the dropdown only if at least one status changed.
 */
async function checkAndUpdateWikidataUrlAccess(qid) {
    const urls = (itemWikidataUrls[qid] || []).map(entry => entry.url);
    if (urls.length === 0) return;

    const statusesBefore = urls.map(url => getAuthorityStatus(url));

    await Promise.allSettled(urls.map(url => checkAuthorityUrl(url)));

    const anyChanged = urls.some((url, i) => getAuthorityStatus(url) !== statusesBefore[i]);
    if (!anyChanged) return;

    const viewTypeSelect = document.getElementById('viewTypeSelect');
    const selectedQid = document.querySelector('.item.selected')?.getAttribute('data-qid');
    if (viewTypeSelect?.value === 'viewWikidataUrls' && selectedQid === qid) {
        updateWikidataUrlDropdown(qid);
    }
}

/**
 * UPDATE WIKIDATA URL DROPDOWN
 * Populate the authority selector with available Wikidata URL properties for the
 * selected item (P856, P953, P973, P1065).
 *
 * Sort order (ascending priority = shown first):
 *   1 – accessible (no blocking headers detected)
 *   2 – unknown (CORS prevented header inspection; iframe may still work)
 *   3 – blocked (X-Frame-Options or CSP frame-ancestors detected)
 *
 * Blocked entries are dimmed so users can still open them in a new tab.
 */
function updateWikidataUrlDropdown(qid) {
    const authoritySelect = document.getElementById('authoritySelect');
    const projectUrl = document.getElementById('projectUrl');
    const iframe = document.getElementById('projectIframe');

    if (!authoritySelect || !projectUrl || !iframe) return;

    const entries = itemWikidataUrls[qid] || [];

    if (entries.length === 0) {
        authoritySelect.style.display = 'none';
        projectUrl.style.display = 'none';
        iframe.src = 'no-content.html';
        return;
    }

    authoritySelect.style.display = '';
    projectUrl.style.display = '';

    const previousValue = authoritySelect.value;
    authoritySelect.innerHTML = '';

    const statusRank = { accessible: 1, unknown: 2, blocked: 3 };

    const sorted = entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
            const aRank = statusRank[getAuthorityStatus(a.entry.url)] ?? statusRank.unknown;
            const bRank = statusRank[getAuthorityStatus(b.entry.url)] ?? statusRank.unknown;
            return aRank - bRank;
        });

    sorted.forEach(({ entry, index }) => {
        const option = document.createElement('option');
        option.value = index;

        const status = getAuthorityStatus(entry.url);
        let label = `${entry.propertyLabel} (${entry.propertyId}): ${entry.url}`;
        if (status === 'blocked') {
            label += ' (blocked)';
            option.className = 'authority-option-blocked';
            option.style.color = '#999';
            option.style.fontStyle = 'italic';
        }
        option.textContent = label;
        authoritySelect.appendChild(option);
    });

    authoritySelect.onchange = () => {
        updateWikidataUrlDisplay(qid, parseInt(authoritySelect.value, 10));
    };

    const previousStillExists = Array.from(authoritySelect.options).some(o => o.value === previousValue);
    if (previousStillExists) {
        authoritySelect.value = previousValue;
    } else {
        const firstGood = sorted.find(({ entry }) => getAuthorityStatus(entry.url) !== 'blocked');
        authoritySelect.value = firstGood ? firstGood.index : sorted[0].index;
    }

    updateWikidataUrlDisplay(qid, parseInt(authoritySelect.value, 10));

    checkAndUpdateWikidataUrlAccess(qid);
}

/**
 * UPDATE WIKIDATA URL DISPLAY
 * Load the selected Wikidata URL into the iframe and show it as a clickable link.
 */
function updateWikidataUrlDisplay(qid, index) {
    const entries = itemWikidataUrls[qid] || [];
    const entry = entries[index];
    if (!entry) return;

    const iframe = document.getElementById('projectIframe');
    const projectUrl = document.getElementById('projectUrl');

    if (!iframe || !projectUrl) return;

    projectUrl.href = entry.url;
    projectUrl.textContent = entry.url;
    iframe.src = entry.url;
}

/**
 * HANDLE VIEW TYPE CHANGE
 * Switch between Wikimedia, Wikidocumentaries, Authority ID, and Wikidata URL views
 */
async function handleViewTypeChange(viewType, qid) {
    const projectSelect = document.getElementById('projectSelect');
    const languageSelect = document.getElementById('languageSelect');
    const authoritySelect = document.getElementById('authoritySelect');

    if (viewType === 'viewWikidocumentaries') {
        if (projectSelect) projectSelect.style.display = 'none';
        if (languageSelect) languageSelect.style.display = 'none';
        if (authoritySelect) authoritySelect.style.display = 'none';
        if (qid) {
            const currentLang = (languageSelect && languageSelect.value) ? languageSelect.value : lang;
            updateWikidocumentariesDisplay(qid, currentLang);
        }
    } else if (viewType === 'viewWebData') {
        if (projectSelect) projectSelect.style.display = 'none';
        if (languageSelect) languageSelect.style.display = 'none';
        if (qid) {
            // Lazy-fetch authority IDs for any currently displayed items not yet fetched
            await updateAuthorityIdsForQids(currentDisplayedQids);
            updateAuthorityDropdown(qid);
        }
    } else if (viewType === 'viewWikidataUrls') {
        if (projectSelect) projectSelect.style.display = 'none';
        if (languageSelect) languageSelect.style.display = 'none';
        if (qid) {
            // Lazy-fetch Wikidata URLs for any currently displayed items not yet fetched
            await updateWikidataUrlsForQids(currentDisplayedQids);
            updateWikidataUrlDropdown(qid);
        }
    } else if (viewType === 'viewWikimedia') {
        if (authoritySelect) authoritySelect.style.display = 'none';
        if (qid) {
            updateProjectDropdown(qid);
        } else {
            if (projectSelect) projectSelect.style.display = '';
            if (languageSelect) languageSelect.style.display = '';
        }
    }
}

/**
 * GET URL FOR SPECIFIC ITEM, PROJECT, AND LANGUAGE
 * Now returns FORMATTED URL, not raw sitelink
 */
function getWikimediaUrl(qid, projectType, langCode) {
    if (!itemSitelinks[qid]) return null;

    const normalizedProject = PROJECT_MAP[projectType];
    
    // Localized projects
    if (normalizedProject) {
        const sitelinks = itemSitelinks[qid][normalizedProject];
        const entry = sitelinks?.find(e => e.lang === langCode);
        if (!entry) return null;
        return buildWikimediaUrl(normalizedProject, langCode, entry.title);
    }

    // Multilingual projects
    const langKey = MULTILINGUAL_PROJECTS[projectType];
    if (!langKey) return null;
    
    const sitelinks = itemSitelinks[qid]['wikimedia'];
    const entry = sitelinks?.find(e => e.lang === langKey);
    if (!entry) return null;
    return buildWikimediaUrl(langKey, langCode, entry.title);
}

function createItemElement(item) {
    const itemElement = document.createElement('div');
    itemElement.className = 'item';
    
    const qid = item.item.value.split('/').pop();
    itemElement.setAttribute('data-qid', qid);
    
    console.log('Creating item element for QID:', qid);  // ADD THIS

    itemElement.addEventListener('click', () => {
        document.querySelectorAll('.item').forEach(el => el.classList.remove('selected'));
        itemElement.classList.add('selected');

        const clickedQid = itemElement.getAttribute('data-qid');
        console.log('Item clicked - clickedQid from data-qid:', clickedQid);  // ADD THIS
        console.log('itemSitelinks keys:', Object.keys(itemSitelinks));  // ADD THIS
        console.log('itemSitelinks[clickedQid]:', itemSitelinks[clickedQid]);  // ADD THIS
        
        updateProjectDropdown(clickedQid);
    });

    const img = document.createElement('img');
    
    // Use the 'thumb' variable from the new SPARQL query
    // It already includes the width=300 parameter and HTTPS
    img.src = (item.thumb && item.thumb.value) ? item.thumb.value : 'images/placeholder.png';
    img.alt = 'Thumbnail';

    const details = document.createElement('div');
    details.className = 'item-details';

    const label = document.createElement('span');
    label.style.fontWeight = 'bold';
    label.textContent = (item.itemLabel ? item.itemLabel.value : 'No label') + ' ';
    details.appendChild(label);

    const labelLink = document.createElement('a');
    labelLink.href = `https://www.wikidata.org/wiki/${qid}`;
    labelLink.className = 'qid-link';
    labelLink.textContent = qid;
    labelLink.target = '_blank';
    details.appendChild(labelLink);

    const description = document.createElement('div');
    description.textContent = item.itemDescription ? item.itemDescription.value : 'No description available';
    details.appendChild(description);

    const button = document.createElement('button');
    button.textContent = 'Match';
    button.addEventListener('click', (e) => {
        e.stopPropagation(); // Stops the 'item click' from selecting/refreshing the preview
        const matchQid = itemElement.getAttribute('data-qid');  // CHANGE THIS
        sendMatchToSheet(matchQid);
    }); 

    itemElement.appendChild(img);
    itemElement.appendChild(details);
    itemElement.appendChild(button);

    return itemElement;
}

function initializePlaceholder() {
    const iframe = document.getElementById('projectIframe');
    const projectSelect = document.getElementById('projectSelect');
    const languageSelect = document.getElementById('languageSelect');
    const authoritySelect = document.getElementById('authoritySelect');
    const projectUrl = document.getElementById('projectUrl');
    
    if (!iframe) return;
    
    // Hide dropdowns and link by default
    projectSelect.style.display = 'none';
    languageSelect.style.display = 'none';
    authoritySelect.style.display = 'none';
    projectUrl.style.display = 'none';
    
    // Load placeholder from file
    iframe.src = 'placeholder.html';
}

function updateProjectDropdown(qid) {
    const viewTypeSelect = document.getElementById('viewTypeSelect');
    if (viewTypeSelect && viewTypeSelect.value === 'viewWikidocumentaries') {
        handleViewTypeChange('viewWikidocumentaries', qid);
        return;
    }

    if (viewTypeSelect && viewTypeSelect.value === 'viewWebData') {
        handleViewTypeChange('viewWebData', qid);
        return;
    }

    if (viewTypeSelect && viewTypeSelect.value === 'viewWikidataUrls') {
        handleViewTypeChange('viewWikidataUrls', qid);
        return;
    }

    const projectSelect = document.getElementById('projectSelect');
    const languageSelect = document.getElementById('languageSelect');
    const authoritySelect = document.getElementById('authoritySelect');
    const projectUrl = document.getElementById('projectUrl');
    const iframe = document.getElementById('projectIframe');
    
    if (!projectSelect || !languageSelect || !authoritySelect || !projectUrl || !iframe) return;

    // Hide authority select for Wikimedia view
    authoritySelect.style.display = 'none';
    
    const availableProjects = getAvailableProjects(qid);
    
    // If no projects available, show placeholder
    if (availableProjects.length === 0) {
        projectSelect.style.display = 'none';
        languageSelect.style.display = 'none';
        projectUrl.style.display = 'none';
        
        // Load no-content page
        iframe.src = 'no-content.html';
        return;
    }
    
    // Show controls if projects available
    projectSelect.style.display = '';
    languageSelect.style.display = '';
    projectUrl.style.display = '';
    
    // Clear current options
    projectSelect.innerHTML = '';
    languageSelect.innerHTML = '';
    
    // Add available projects
    availableProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = project;
        projectSelect.appendChild(option);
    });
    
    // Remove old listener and add new one
    projectSelect.onchange = () => {
        updateLanguageDropdown(qid, projectSelect.value);
    };
    
    // Trigger language dropdown update for first project
    if (availableProjects.length > 0) {
        updateLanguageDropdown(qid, projectSelect.value);
    }
}

/**
 * UPDATE LANGUAGE DROPDOWN
 * Populate with available languages for the selected item and project.
 * For multilingual projects, directly update display without language selection.
 */
function updateLanguageDropdown(qid, projectType) {
    const languageSelect = document.getElementById('languageSelect');
    if (!languageSelect) return;

    const availableLanguages = getAvailableLanguages(qid, projectType);

    // For multilingual projects (no languages)
    if (availableLanguages.length === 0) {
        languageSelect.style.display = 'none';
        updateWikimediaDisplay(qid, projectType);
        return;
    }

    // For localized projects (show language dropdown)
    languageSelect.style.display = '';
    languageSelect.innerHTML = '';

    availableLanguages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = `${lang.code} - ${lang.title}`;
        languageSelect.appendChild(option);
    });

    languageSelect.onchange = () => {
        updateWikimediaDisplay(qid, projectType, languageSelect.value);
    };

    // Trigger display update for first language
    if (availableLanguages.length > 0) {
        updateWikimediaDisplay(qid, projectType, availableLanguages[0].code);
    }
}

/**
 * UPDATE WIKIMEDIA DISPLAY
 * Load the selected Wikimedia page into the iframe using srcdoc with nested iframe wrapper
 */
function updateWikimediaDisplay(qid, projectType, langCode) {
    const url = getWikimediaUrl(qid, projectType, langCode);
    const iframe = document.getElementById('projectIframe');
    const projectUrl = document.getElementById('projectUrl');
    
    if (!iframe || !projectUrl) return;
    
    if (url) {
        projectUrl.href = url;
        projectUrl.textContent = url;
        iframe.src = url;  // Direct load - no srcdoc!
    } else {
        console.warn(`No URL found for QID ${qid}, project ${projectType}, language ${langCode}`);
    }
}

async function populateItems(query, page = 0) {
    const itemList = document.getElementById('itemList');
    const loadMoreButton = document.getElementById('loadMoreButton');
    
    console.log('populateItems called with query:', query, 'page:', page);
    
    // 1. Reset UI only for NEW searches (page 0)
    if (page === 0) {
        itemList.innerHTML = ''; 
        currentPage = 0;  // Reset page counter
        currentDisplayedQids = [];  // Reset lazy-fetch tracking
        if (markersLayer) markersLayer.clearLayers();
    }

    // 2. Fetch data from SPARQL
    const items = await fetchWikidataItems(query, page, resultsPerPage);
    
    console.log('Fetched items:', items.length);
    
    // If no items fetched, hide load more button
    if (items.length === 0) {
        loadMoreButton.style.display = 'none';
        return;
    }
    
    // Show load more button if we got a full page of results
    loadMoreButton.style.display = '';

    // 3. FETCH SITELINKS FOR ALL ITEMS; authority IDs are fetched lazily on viewWebData selection
    await updateSitelinksForCurrentResults(items);

    // Track which QIDs are now displayed for lazy authority ID fetching
    const newQids = items.map(item => item.item.value.split('/').pop());
    currentDisplayedQids = currentDisplayedQids.concat(newQids);

    items.forEach((item, index) => {
        // 4. Populate the Left-Pane List
        const itemElement = createItemElement(item);
        itemList.appendChild(itemElement);

        // 5. Populate the Map (Right-Pane)
        if (item.coord && markersLayer) {
            // Parse "Point(lon lat)" format
            const coords = item.coord.value.replace('Point(', '').replace(')', '').split(' ');
            const lat = parseFloat(coords[1]);
            const lon = parseFloat(coords[0]);
            
            const qid = item.item.value.split('/').pop();
            
            // Extract display values with fallbacks
            const label = item.itemLabel ? item.itemLabel.value : 'No label';
            const desc = item.itemDescription ? item.itemDescription.value : 'No description available';

            const imgUrl = (item.thumb && item.thumb.value) ? item.thumb.value : 'images/placeholder.png';

            const popupContent = `
                <div class="popup">
                    <img src="${imgUrl}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;"/>
                    <div>
                        <strong>${label}</strong>
                        <a href="https://www.wikidata.org/wiki/${qid}" target="_blank" class="popup-link">${qid}</a><br />
                        <div>${desc}</div>
                        <button class="match-button blue" onclick="sendMatchToSheet('${qid}')">Match</button>
                    </div>
                </div>`;
            
            const marker = L.marker([lat, lon]).bindPopup(popupContent);
            markersLayer.addLayer(marker);
        }

        // 6. Auto-select the first result ONLY on first page
        if (index === 0 && page === 0) {
            itemElement.click();
        }
    });

    // 7. Update pagination counter
    currentPage = page;

    // 8. Adjust Map View to fit all markers
    if (markersLayer.getLayers().length > 0) {
        map.fitBounds(markersLayer.getBounds(), { padding: [50, 50] });
    }
}

/**
 * UTILITY & UI FUNCTIONS
 */
function initializeMap(mapContainer) {
    if (!mapContainer) return;
    const newMap = L.map(mapContainer).setView([0, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(newMap);

    map = newMap;
    markersLayer = L.featureGroup().addTo(map);
    return newMap;
}

function navigateItems(direction) {
    const items = Array.from(document.querySelectorAll('.item'));
    const selectedIndex = items.findIndex(item => item.classList.contains('selected'));
    if (selectedIndex === -1) return;

    let newIndex = direction === 'next' ? 
        (selectedIndex + 1) % items.length : 
        (selectedIndex - 1 + items.length) % items.length;

    items[newIndex].click();
    items[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showNextValue() {
    if (values.length > 0) {
        currentIndex = (currentIndex + 1) % values.length;
        document.getElementById('searchInput').value = values[currentIndex];
    }
}

function showPreviousValue() {
    if (values.length > 0) {
        currentIndex = (currentIndex - 1 + values.length) % values.length;
        document.getElementById('searchInput').value = values[currentIndex];
    }
}

document.getElementById('loadMoreButton').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.trim();
    if (query) {
        currentPage++;  // Increment BEFORE calling populateItems
        populateItems(query, currentPage);
    }
});

// Dynamic Input Field Logic (Kept as per your original)
function initializeDynamicInputFields() {
    const option1 = document.getElementById('option1');
    const option2 = document.getElementById('option2');
    if (!option1 || !option2) return;

    const optionsMap = {
        'a': ['P2347', 'P10221', 'P214'],
        'b': ['https://wikidata.org/wiki/P2347', 'https://wikidata.org/wiki/P10221', 'https://wikidata.org/wiki/P214'],
        'c': ['ID1', 'ID2', 'ID3'],
        'd': ['https://dataset.org/ID1', 'https://dataset.org/ID2', 'https://dataset.org/ID3']
    };

    option1.addEventListener('change', () => {
        const selectedOption = option1.value;
        option2.innerHTML = '';
        (optionsMap[selectedOption] || []).forEach(val => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = val;
            option2.appendChild(opt);
        });
    });
}

function replaceComponentContent(component, viewType) {
    const body = component.querySelector('.component-body');
    const headerBottom = component.querySelector('.component-header-bottom');
    if (typeof generateComponentBody === 'function') body.innerHTML = generateComponentBody(viewType);
    if (typeof getTemplate === 'function') headerBottom.innerHTML = getTemplate(`${viewType}HeaderBottom`);
    if (viewType === 'compareCoordinates') initializeMap(component.querySelector('#map'));
}
