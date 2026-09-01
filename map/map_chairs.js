document.addEventListener("DOMContentLoaded", () => {
    // Inject Custom Styles for Map Labels Let them look like just text.
    const style = document.createElement('style');
    style.innerHTML = `
        .precinct-label {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            font-weight: bold;
            font-size: 11px;
            color: #0f172a;
            text-shadow: 1px 1px 2px rgba(255,255,255,0.9), -1px -1px 2px rgba(255,255,255,0.9), 1px -1px 2px rgba(255,255,255,0.9), -1px 1px 2px rgba(255,255,255,0.9);
        }
    `;
    document.head.appendChild(style);

    // We already have chairDataList defined from chair_data.js
    let chairData = chairDataList || [];

    const map = L.map('map').setView([26.3, -98.2], 9);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let currentFilter = 'all'; // 'all', 'filled', 'vacant'

    function getPrecinctStatus(pct) {
        let cleanPct = pct ? parseInt(pct, 10).toString() : '';
        if (cleanPct === 'NaN') cleanPct = pct; // Fallback
        
        let officials = chairData.filter(c => c.precinct === cleanPct);
        return officials.length > 0 ? 'filled' : 'vacant';
    }

    function styleFeature(feature) {
        let pct = feature.properties.PREC || feature.properties.ID;
        if(!pct && feature.properties.tooltip) {
            let match = feature.properties.tooltip.match(/Precinct\s*(\d+)/i);
            if(match) pct = match[1];
        }

        let status = getPrecinctStatus(pct);
        let pctInt = parseInt(pct, 10);
        
        let matchesDistrict = true;
        if (window.activeDistrict === '15' && window.cd15List) matchesDistrict = window.cd15List.includes(pctInt);
        if (window.activeDistrict === '28' && window.cd28List) matchesDistrict = window.cd28List.includes(pctInt);

        let matchesCity = true;
        if (window.activeCity && window.activeCity !== 'ALL' && typeof precinctDistricts !== 'undefined') {
            // precinctDistricts is from precinct_mapping_data.js
            const precinctMapData = precinctDistricts.find(p => parseInt(p.PRECINCT, 10) === pctInt);
            if (precinctMapData) {
                matchesCity = (precinctMapData.CITY === window.activeCity);
            } else {
                matchesCity = false;
            }
        }

        let isFilteredOut = !(matchesDistrict && matchesCity);
        let hasActiveTableFilter = (window.activeDistrict && window.activeDistrict !== 'ALL') || (window.activeCity && window.activeCity !== 'ALL');
        
        let style = { 
            fillColor: '#3b82f6', 
            color: '#1d4ed8', 
            weight: 1, 
            fillOpacity: 0.2
        };

        if (isFilteredOut) {
            style.fillColor = '#94a3b8'; // Grayed out entirely
            style.fillOpacity = 0.05;
            style.color = 'rgba(255,255,255,0.05)';
            return style;
        }

        // If a city/district filter is active, highlight filled seats in bright blue.
        if (hasActiveTableFilter && currentFilter === 'all') {
            if (status === 'filled') {
                style.fillColor = '#3b82f6'; // Bright blue
                style.fillOpacity = 0.7;
                style.color = '#2563eb';
                style.weight = 2;
            } else {
                style.fillColor = '#94a3b8'; // Vacant
                style.fillOpacity = 0.15;
                style.color = '#cbd5e1';
            }
            return style;
        }

        if (currentFilter === 'filled') {
            if (status === 'filled') {
                style.fillColor = '#10b981'; // Green for filled
                style.fillOpacity = 0.6;
                style.color = '#059669';
                style.weight = 2;
            } else {
                style.fillColor = '#94a3b8'; // Grayed out for others
                style.fillOpacity = 0.1;
                style.color = '#cbd5e1';
            }
        } else if (currentFilter === 'vacant') {
            if (status === 'vacant') {
                style.fillColor = '#ef4444'; // Red for vacant
                style.fillOpacity = 0.6;
                style.color = '#b91c1c';
                style.weight = 2;
            } else {
                style.fillColor = '#94a3b8'; // Grayed out for others
                style.fillOpacity = 0.1;
                style.color = '#cbd5e1';
            }
        }

        return style;
    }

    window.updateMapFromFilters = function() {
        if(geojsonLayer) {
            geojsonLayer.setStyle(styleFeature);
            updateLabels();
        }
    };

    function onEachFeature(feature, layer) {
        let pct = feature.properties.PREC || feature.properties.ID; // Assuming precinct number is in ID property based on tooltip data
        if(!pct && feature.properties.tooltip) {
            // fallback extraction
            let match = feature.properties.tooltip.match(/Precinct\s*(\d+)/i);
            if(match) pct = match[1];
        }

        let cleanPct = pct ? parseInt(pct, 10).toString() : '';
        if (cleanPct === 'NaN') cleanPct = pct; // Fallback

        let popupContent = `<div style="min-width: 200px;">
            <h3 style="margin-top:0; color:#0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 5px;">Precinct ${cleanPct || 'Unknown'}</h3>`;
        
        // Add split precinct warning if it falls into both districts
        if (window.cd15List && window.cd28List && cleanPct) {
            let pInt = parseInt(cleanPct, 10);
            if (window.cd15List.includes(pInt) && window.cd28List.includes(pInt)) {
                popupContent += `<div style="background: rgba(234, 88, 12, 0.1); border: 1px solid #ea580c; color: #ea580c; font-size: 0.8em; font-weight: bold; margin-bottom: 8px; padding: 4px; border-radius: 4px;">⚠️ Split District (TX-15 & TX-28)</div>`;
            }
        }
        
        let officials = chairData.filter(c => c.precinct === cleanPct);
        
        if (officials.length > 0) {
            let chair = officials.find(o => o.role.includes("Precinct Chair"));
            if (chair) {
                popupContent += `<div style="margin-bottom: 8px;">
                    <strong><span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#facc15; margin-right:5px;"></span>Precinct Chair</strong><br>
                    <span style="font-size: 1.1em; color: #1e293b;">${chair.name}</span><br>
                    <a href="mailto:${chair.email}" style="color: #3b82f6; text-decoration: none;">${chair.email}</a><br>
                    <span style="color: #64748b; font-size: 0.9em;">${chair.phone}</span>
                </div>`;
            } else {
                popupContent += `<p style="color: #64748b; font-style: italic;">No Chair Assigned</p>`;
            }

            let captains = officials.filter(o => o.role === "Block Captain");
            if (captains.length > 0) {
                popupContent += `<div style="margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 5px;">
                    <strong><span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#94a3b8; margin-right:5px;"></span>Block Captain(s)</strong>`;
                captains.forEach(cap => {
                    popupContent += `<div style="margin-top: 5px; margin-left:17px; font-size: 0.95em;">
                        <span style="color: #334155;">${cap.name}</span><br>
                        <a href="mailto:${cap.email}" style="color: #3b82f6; text-decoration: none;">${cap.email}</a>
                    </div>`;
                });
                popupContent += `</div>`;
            }
        } else {
            popupContent += `<p style="color: #ef4444; font-weight: bold; margin-top:10px;">🔴 Vacant</p>
            <a href="volunteer.html" style="display: inline-block; margin-top: 5px; padding: 5px 10px; background: #3b82f6; color: white; border-radius: 4px; text-decoration: none; font-size: 0.9em;">Volunteer Now</a>`;
        }
        
        popupContent += `</div>`;
        layer.bindPopup(popupContent, {maxWidth: 300});

        layer.on({
            mouseover: (e) => {
                let l = e.target;
                // Highlight color when hovered, regardless of filter, but keep it obvious it's hovered
                l.setStyle({ weight: 3, color: '#22d3ee', fillOpacity: 0.7 });
                l.bringToFront();
            },
            mouseout: (e) => { geojsonLayer.resetStyle(e.target); }
        });
    }

    let geojsonLayer = L.geoJSON(hidalgoPrecinctsData, { 
        style: styleFeature, 
        onEachFeature: onEachFeature 
    }).addTo(map);

    map.fitBounds(geojsonLayer.getBounds());

    function updateLabels() {
        geojsonLayer.eachLayer(function(layer) {
            let pct = layer.feature.properties.PREC || layer.feature.properties.ID;
            if(!pct && layer.feature.properties.tooltip) {
                let match = layer.feature.properties.tooltip.match(/Precinct\s*(\d+)/i);
                if(match) pct = match[1];
            }
            let cleanPct = pct ? parseInt(pct, 10).toString() : '';
            if (cleanPct === 'NaN') cleanPct = pct;

            if (!cleanPct || cleanPct === 'Unknown') {
                return;
            }

            let status = getPrecinctStatus(pct);
            let pctInt = parseInt(pct, 10);
            
            let matchesDistrict = true;
            if (window.activeDistrict === '15' && window.cd15List) matchesDistrict = window.cd15List.includes(pctInt);
            if (window.activeDistrict === '28' && window.cd28List) matchesDistrict = window.cd28List.includes(pctInt);

            let matchesCity = true;
            if (window.activeCity && window.activeCity !== 'ALL' && typeof precinctDistricts !== 'undefined') {
                const precinctMapData = precinctDistricts.find(p => parseInt(p.PRECINCT, 10) === pctInt);
                if (precinctMapData) {
                    matchesCity = (precinctMapData.CITY === window.activeCity);
                } else {
                    matchesCity = false;
                }
            }

            let isFilteredOut = !(matchesDistrict && matchesCity);
            
            let showLabel = false;
            if (!isFilteredOut) {
                if (currentFilter === 'all') showLabel = true;
                else if (currentFilter === 'filled' && status === 'filled') showLabel = true;
                else if (currentFilter === 'vacant' && status === 'vacant') showLabel = true;
            }

            if (showLabel) {
                if (!layer.getTooltip()) {
                    layer.bindTooltip(cleanPct, {
                        permanent: true,
                        direction: 'center',
                        className: 'precinct-label',
                        interactive: false
                    });
                }
            } else {
                if (layer.getTooltip()) {
                    layer.unbindTooltip();
                }
            }
        });
    }

    // Expose updateMapFromSearch for table search integration
    window.updateMapFromSearch = function(visiblePrecincts, searchTerm) {
        // Remove old search styles
        geojsonLayer.eachLayer(layer => {
            layer.options.isSearchResult = false;
            layer.options.isSearchedPrecinct = false;
            layer.options.isNearbyPrecinct = false;
        });

        const panel = document.getElementById('precinct-info-panel');
        if (!panel) return;

        // Is it an exact number search?
        const isPrecinctSearch = /^\d+$/.test(searchTerm);
        const searchPct = isPrecinctSearch ? parseInt(searchTerm, 10).toString() : null;
        
        let targetLayer = null;

        if (isPrecinctSearch) {
            geojsonLayer.eachLayer(layer => {
                let pct = layer.feature.properties.PREC || layer.feature.properties.ID;
                if(!pct && layer.feature.properties.tooltip) {
                    let match = layer.feature.properties.tooltip.match(/Precinct\s*(\d+)/i);
                    if(match) pct = match[1];
                }
                let cleanPct = pct ? parseInt(pct, 10).toString() : '';
                if(cleanPct === searchPct) {
                    targetLayer = layer;
                    layer.options.isSearchedPrecinct = true;
                }
            });
        }
        
        if (targetLayer) {
                // Style and zoom to precinct
                geojsonLayer.setStyle(feature => {
                    let pct = feature.properties.PREC || feature.properties.ID;
                    if(!pct && feature.properties.tooltip) {
                        let match = feature.properties.tooltip.match(/Precinct\s*(\d+)/i);
                        if(match) pct = match[1];
                    }
                    let cleanPct = pct ? parseInt(pct, 10).toString() : '';
                    if (cleanPct === searchTerm) {
                        return { fillColor: '#facc15', fillOpacity: 0.6, color: '#ca8a04', weight: 3 };
                    }
                    return styleFeature(feature);
                });
                
                map.flyToBounds(targetLayer.getBounds(), {
                    padding: [50, 50],
                    duration: 0.5,
                    maxZoom: 12
                });

                // Get District and City info
                let pctInt = parseInt(searchTerm, 10);
                let distString = [];
                if (window.cd15List && window.cd15List.includes(pctInt)) distString.push("TX-15");
                if (window.cd28List && window.cd28List.includes(pctInt)) distString.push("TX-28");
                
                let cityString = "Unknown City";
                if (typeof precinctDistricts !== 'undefined') {
                    const pData = precinctDistricts.find(p => parseInt(p.PRECINCT, 10) === pctInt);
                    if (pData && pData.CITY) cityString = pData.CITY;
                }

                // Update Info Panel
                document.getElementById('info-panel-title').innerText = `Precinct ${searchTerm}`;
                document.getElementById('info-panel-district').innerHTML = `<span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; margin-right: 8px;">📍 ${cityString}</span> <span style="background: rgba(56, 189, 248, 0.2); padding: 4px 8px; border-radius: 4px; color: #38bdf8; font-weight: bold;">Congressional District: ${distString.join(' / ') || 'Unknown'}</span>`;

                // Find nearby precincts (naive bounding box intersection)
                let nearby = [];
                let targetBounds = targetLayer.getBounds();
                // Expand bounds slightly to catch neighbors
                let expandedBounds = targetBounds.pad(0.3);
                
                geojsonLayer.eachLayer(layer => {
                    if (layer === targetLayer) return;
                    if (expandedBounds.intersects(layer.getBounds())) {
                        let pct = layer.feature.properties.PREC || layer.feature.properties.ID;
                        if(!pct && layer.feature.properties.tooltip) {
                            let match = layer.feature.properties.tooltip.match(/Precinct\s*(\d+)/i);
                            if(match) pct = match[1];
                        }
                        let cleanPct = pct ? parseInt(pct, 10).toString() : '';
                        if (cleanPct) {
                            nearby.push(cleanPct);
                            layer.options.isNearbyPrecinct = true;
                        }
                    }
                });

                // Deduplicate and limit
                nearby = [...new Set(nearby)].slice(0, 8);
                
                let nearbyHtml = nearby.map(p => {
                    let status = getPrecinctStatus(p);
                    let color = status === 'filled' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                    let border = status === 'filled' ? '#10b981' : '#ef4444';
                    return `<span style="background: ${color}; border: 1px solid ${border}; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;" onclick="document.getElementById('searchInput').value='${p}'; document.getElementById('searchInput').dispatchEvent(new Event('input'));">Pct ${p}</span>`;
                }).join('');
                
                document.getElementById('info-panel-nearby').innerHTML = nearbyHtml || '<span style="color: #64748b;">None detected</span>';
                panel.style.display = 'block';

                // Style nearby
                geojsonLayer.eachLayer(layer => {
                    if (layer.options.isNearbyPrecinct) {
                        layer.setStyle({ fillColor: '#22d3ee', fillOpacity: 0.3, color: '#0ea5e9', weight: 2 });
                    }
                });
                
                // Dispatch custom event with the nearby list so table can update
                if (window.activeNearbyPrecincts !== nearby) {
                    const event = new CustomEvent('nearbyPrecinctsFound', { detail: { nearby: nearby, searchPct: searchPct } });
                    window.dispatchEvent(event);
                }

        } else {
            panel.style.display = 'none';
            // Reset to normal map styles based on filters
            geojsonLayer.setStyle(styleFeature);
            if (!searchTerm) {
                map.flyToBounds(geojsonLayer.getBounds(), {duration: 0.5});
            }
        }
        updateLabels();
    };

    // Button Logic
    function updateActiveButton(activeBtnId) {
        ['btn-show-all', 'btn-show-filled', 'btn-show-vacant'].forEach(id => {
            const btn = document.getElementById(id);
            if(btn) {
                if (id === activeBtnId) {
                    btn.classList.add('active'); // Could style .active in css if we wanted
                    btn.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
                } else {
                    btn.classList.remove('active');
                    btn.style.boxShadow = 'none';
                }
            }
        });
    }

    const btnAll = document.getElementById('btn-show-all');
    const btnFilled = document.getElementById('btn-show-filled');
    const btnVacant = document.getElementById('btn-show-vacant');

    if (btnAll) btnAll.addEventListener('click', () => {
        currentFilter = 'all';
        geojsonLayer.setStyle(styleFeature);
        updateLabels();
        updateActiveButton('btn-show-all');
    });

    if (btnFilled) btnFilled.addEventListener('click', () => {
        currentFilter = 'filled';
        geojsonLayer.setStyle(styleFeature);
        updateLabels();
        updateActiveButton('btn-show-filled');
    });

    if (btnVacant) btnVacant.addEventListener('click', () => {
        currentFilter = 'vacant';
        geojsonLayer.setStyle(styleFeature);
        updateLabels();
        updateActiveButton('btn-show-vacant');
    });

    updateActiveButton('btn-show-all');
    updateLabels();
});
