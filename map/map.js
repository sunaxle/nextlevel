document.addEventListener("DOMContentLoaded", () => {
    // PSJA Area Precinct Numbers
    const PSJA_PRECINCTS = new Set([
        4, 6, 8, 25, 35, 36, 39, 59, 60, 61, 77, 91, 115, 116, 117, 118, 
        123, 126, 127, 130, 140, 141, 144, 146, 147, 148, 150, 156, 159, 
        168, 177, 192, 208, 214, 224, 227, 228, 240, 242, 245, 246, 252, 253, 258
    ]);

    // Base Tile Layers (100% Free, High-Res, No API Key Required)
    const streetMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, METI, TomTom',
        maxZoom: 19
    });

    const osmMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    });

    const satelliteMap = L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri, Earthstar Geographics',
            maxZoom: 19
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19
        })
    ]);

    // Initialize map with Detailed Street Map by default
    const map = L.map('map', {
        center: [26.17, -98.17],
        zoom: 11,
        layers: [streetMap]
    });

    const baseMaps = {
        "🗺️ Detailed Street Map": streetMap,
        "🛣️ OpenStreetMap": osmMap,
        "🛰️ Satellite / Aerial Imagery": satelliteMap
    };

    let psjaBounds = L.latLngBounds();
    let precinctLayers = {};
    let isOnlyPSJAVisible = false;

    function getPrecinctNum(feature) {
        let p = feature.properties.PREC || feature.properties.ID || "";
        let parsed = parseInt(p, 10);
        return isNaN(parsed) ? null : parsed;
    }

    function styleFeature(feature) {
        let pct = getPrecinctNum(feature);
        let isPSJA = pct !== null && PSJA_PRECINCTS.has(pct);

        if (isPSJA) {
            return {
                fillColor: '#f59e0b', // Vibrant Amber for PSJA
                color: '#b45309',     // Solid border
                weight: 2.5,
                fillOpacity: 0.55,
                dashArray: null
            };
        } else {
            return {
                fillColor: '#64748b', // Slate for non-PSJA
                color: '#94a3b8',
                weight: 1,
                fillOpacity: isOnlyPSJAVisible ? 0 : 0.12,
                opacity: isOnlyPSJAVisible ? 0 : 0.35
            };
        }
    }

    function onEachFeature(feature, layer) {
        let pct = getPrecinctNum(feature);
        let isPSJA = pct !== null && PSJA_PRECINCTS.has(pct);
        let winnerName = feature.properties.winner_name || "No Data";

        if (pct !== null) {
            precinctLayers[pct] = layer;
        }

        if (isPSJA) {
            psjaBounds.extend(layer.getBounds());
            
            // Clean permanent label centered on PSJA precincts
            layer.bindTooltip(`${pct}`, {
                permanent: true,
                direction: 'center',
                className: 'psja-precinct-label'
            });
        }

        // Popup details with direct Google Maps link
        let center = layer.getBounds().getCenter();
        let gmapsUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${center.lat},${center.lng}`;

        let popupContent = `
            <div style="font-family: 'Inter', sans-serif; min-width: 200px; padding: 2px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
                    <strong style="font-size: 1.15rem; color: #fff;">Precinct Box ${pct !== null ? pct : 'Unknown'}</strong>
                    ${isPSJA ? '<span style="background:#f59e0b; color:#0f172a; font-weight:800; font-size:0.7rem; padding:2px 6px; border-radius:4px;">PSJA AREA</span>' : '<span style="background:#475569; color:#f8fafc; font-size:0.7rem; padding:2px 6px; border-radius:4px;">County</span>'}
                </div>
                <div style="font-size: 0.85rem; color: #cbd5e1; margin-top: 0.35rem; line-height: 1.5;">
                    <strong>Box Number:</strong> ${feature.properties.PREC || pct}<br/>
                    <strong>Primary Winner:</strong> ${winnerName}
                </div>
                <div style="margin-top: 0.6rem; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 0.5rem;">
                    <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.3rem; color: #38bdf8; font-size: 0.78rem; text-decoration: none; font-weight: 600;">
                        📍 Open Street View in Google Maps &rarr;
                    </a>
                </div>
            </div>
        `;
        layer.bindPopup(popupContent);

        layer.on({
            mouseover: (e) => {
                let l = e.target;
                if (!isOnlyPSJAVisible || isPSJA) {
                    l.setStyle({
                        weight: isPSJA ? 4 : 2,
                        color: isPSJA ? '#fbbf24' : '#38bdf8',
                        fillOpacity: isPSJA ? 0.75 : 0.35
                    });
                    l.bringToFront();
                }
            },
            mouseout: (e) => {
                geojsonLayer.resetStyle(e.target);
            }
        });
    }

    // Render precinct polygons
    let geojsonLayer = L.geoJSON(hidalgoPrecinctsData, { 
        style: styleFeature, 
        onEachFeature: onEachFeature 
    }).addTo(map);

    // Initial zoom focused on PSJA bounds
    if (psjaBounds.isValid()) {
        map.fitBounds(psjaBounds.pad(0.08));
    } else {
        map.fitBounds(geojsonLayer.getBounds());
    }

    // Polling Sites Layer Loader
    let earlyVotingLayer = L.layerGroup().addTo(map);
    let electionDayLayer = L.layerGroup().addTo(map); 

    function loadPollingSites() {
        const ONE_MILE_METERS = 1609.34;
        let earlyIcon = L.divIcon({ className: 'custom-polling-icon early-voting-icon', html: '🗳️', iconSize: [26, 26], iconAnchor: [13, 13] });
        let electionDayIcon = L.divIcon({ className: 'custom-polling-icon election-day-icon', html: '🇺🇸', iconSize: [26, 26], iconAnchor: [13, 13] });

        // Early Voting
        L.geoJSON(pollingLocationsData, {
             pointToLayer: function (feature, latlng) {
                 let circle = L.circle(latlng, { radius: ONE_MILE_METERS, color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.18, weight: 2, dashArray: '5, 5' });
                 let marker = L.marker(latlng, { icon: earlyIcon });
                 circle.addTo(earlyVotingLayer); 
                 return marker.addTo(earlyVotingLayer);
             },
             onEachFeature: function (feature, layer) {
                 if (feature.properties && feature.properties.name) {
                     let coords = feature.geometry.coordinates;
                     let gmapsStreetView = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords[1]},${coords[0]}`;
                     let gmapsDirections = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(feature.properties.name + ' ' + (feature.properties.address || ''))}`;
                     
                     layer.bindPopup(`
                        <div style="min-width: 220px; font-family: 'Inter', sans-serif;">
                            <div style="color: #22c55e; font-weight: 800; font-size: 0.75rem; text-transform: uppercase;">🗳️ Early Voting Site</div>
                            <strong style="font-size: 1.05rem; color: #fff; display:block; margin: 0.25rem 0 0.1rem;">${feature.properties.name}</strong>
                            <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.5rem;">${feature.properties.address}</div>
                            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 0.4rem;">
                                <a href="${gmapsStreetView}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; font-size: 0.78rem; text-decoration: none; font-weight: 600;">📍 Street View</a>
                                <a href="${gmapsDirections}" target="_blank" rel="noopener noreferrer" style="color: #34d399; font-size: 0.78rem; text-decoration: none; font-weight: 600;">🚗 Directions</a>
                            </div>
                        </div>
                     `);
                 }
             }
         });

         // Election Day
         L.geoJSON(electionDayLocationsData, {
             pointToLayer: function (feature, latlng) {
                 let circle = L.circle(latlng, { radius: ONE_MILE_METERS, color: '#9333ea', fillColor: '#a855f7', fillOpacity: 0.18, weight: 2, dashArray: '5, 5' });
                 let marker = L.marker(latlng, { icon: electionDayIcon });
                 circle.addTo(electionDayLayer); 
                 return marker.addTo(electionDayLayer);
             },
             onEachFeature: function (feature, layer) {
                 if (feature.properties && feature.properties.name) {
                     let coords = feature.geometry.coordinates;
                     let gmapsStreetView = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords[1]},${coords[0]}`;
                     let gmapsDirections = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(feature.properties.name + ' ' + (feature.properties.address || ''))}`;

                     layer.bindPopup(`
                        <div style="min-width: 220px; font-family: 'Inter', sans-serif;">
                            <div style="color: #c084fc; font-weight: 800; font-size: 0.75rem; text-transform: uppercase;">🇺🇸 Election Day Site</div>
                            <strong style="font-size: 1.05rem; color: #fff; display:block; margin: 0.25rem 0 0.1rem;">${feature.properties.name}</strong>
                            <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.5rem;">${feature.properties.address}</div>
                            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 0.4rem;">
                                <a href="${gmapsStreetView}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; font-size: 0.78rem; text-decoration: none; font-weight: 600;">📍 Street View</a>
                                <a href="${gmapsDirections}" target="_blank" rel="noopener noreferrer" style="color: #34d399; font-size: 0.78rem; text-decoration: none; font-weight: 600;">🚗 Directions</a>
                            </div>
                        </div>
                     `);
                 }
             }
         });
    }
    
    loadPollingSites();

    // Layer Control for Basemaps and Overlays
    const overlays = {
        "🗺️ Precincts (PSJA Area)": geojsonLayer,
        "🗳️ Early Voting Sites (1mi Radius)": earlyVotingLayer,
        "🇺🇸 Election Day Sites (1mi Radius)": electionDayLayer
    };

    L.control.layers(baseMaps, overlays, { collapsed: false, position: 'topright' }).addTo(map);

    // Global UI Interactive Hooks
    window.zoomToPSJA = function() {
        if (psjaBounds.isValid()) {
            map.fitBounds(psjaBounds.pad(0.08), { animate: true, duration: 1 });
        }
    };

    window.zoomToCounty = function() {
        map.fitBounds(geojsonLayer.getBounds(), { animate: true, duration: 1 });
    };

    window.togglePSJAOnly = function(checkbox) {
        isOnlyPSJAVisible = checkbox.checked;
        geojsonLayer.setStyle(styleFeature);
    };

    window.searchPrecinct = function(input) {
        let val = parseInt(input.value.trim(), 10);
        if (!isNaN(val) && precinctLayers[val]) {
            let targetLayer = precinctLayers[val];
            map.fitBounds(targetLayer.getBounds().pad(0.4), { animate: true });
            targetLayer.openPopup();
        }
    };
});
