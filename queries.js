            SELECT ?item ?itemLabel ?itemDescription (SAMPLE(?image) AS ?image) (SAMPLE(?coord) AS ?coord) WHERE {
                SERVICE wikibase:mwapi {
                    bd:serviceParam wikibase:endpoint "www.wikidata.org";
                                    wikibase:api "EntitySearch";
                                    mwapi:search "${query}";
                                    mwapi:language "${lang}";
                                    mwapi:limit "${limit}";
                                    mwapi:offset "${offset}".
                    ?item wikibase:apiOutputItem mwapi:item.
                    ?item wikibase:apiOutputItemLabel mwapi:label.
                }
                OPTIONAL { ?item wdt:P18 ?image. }
                OPTIONAL { ?item wdt:P625 ?coord. }
                OPTIONAL { ?sitelink schema:about ?item;
                    schema:isPartOf <https://${lang}.wikipedia.org/>.}
                SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],${lang}". }
            } GROUP BY ?item ?itemLabel ?itemDescription LIMIT ${limit} OFFSET ${offset}`;
            const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;


            const sparqlQuery = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX wdt: <http://www.wikidata.org/prop/direct/>
            PREFIX wd: <http://www.wikidata.org/entity/>
            PREFIX ql: <http://qlever.cs.uni-freiburg.de/builtin-functions/>
            SELECT ?item ?itemLabel (SAMPLE(?text) AS ?itemDescription) (SAMPLE(?img) AS ?image) (SAMPLE(?coord) AS ?coords) (COUNT(?text) AS ?count_text) WHERE {
            ?item rdfs:label ?itemLabel .
            FILTER (LANG(?itemLabel) = "${lang}") .
            ?text ql:contains-entity ?item .
            ?text ql:contains-word "${query}".
            OPTIONAL { ?item wdt:P18 ?img. }
            OPTIONAL { ?item wdt:P625 ?coord. }
            }
            GROUP BY ?item ?itemLabel
            ORDER BY DESC(?count_text) LIMIT ${limit} OFFSET ${offset}`;
        const url = `https://qlever.cs.uni-freiburg.de/api/wikidata?query=${encodeURIComponent(sparqlQuery)}`;