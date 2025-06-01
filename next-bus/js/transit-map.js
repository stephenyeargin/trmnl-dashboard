// Map Rendering Logic

const BUS_MARKER_IMAGE = 'https://raw.githubusercontent.com/transitnownash/wego-bus-map/refs/heads/main/public/logo192.png';

// Create direction arrow using canvas
function createArrowImage() {
    const canvas = document.createElement('canvas');
    const size = 12;
    const padding = 3; // Increased padding for more visible border
    canvas.width = size + (padding * 2);
    canvas.height = size + (padding * 2);
    const ctx = canvas.getContext('2d');
    
    // Calculate triangle points with padding
    const middle = canvas.width / 2;
    const top = padding;
    const bottom = canvas.height - padding;
    const left = padding;
    const right = canvas.width - padding;
    
    // Draw white border triangle with even larger offset for thicker border
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(middle, top - 4);  // top middle
    ctx.lineTo(right + 4, bottom + 4);  // bottom right
    ctx.lineTo(left - 4, bottom + 4);   // bottom left
    ctx.closePath();
    ctx.fill();
    
    // Draw black inner triangle
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(middle, top);     // top middle
    ctx.lineTo(right, bottom);   // bottom right
    ctx.lineTo(left, bottom);    // bottom left
    ctx.closePath();
    ctx.fill();
    
    return canvas;
}

export class TransitMap {
    constructor(containerId, mapboxToken) {
        this.containerId = containerId;
        this.mapboxToken = mapboxToken;
        this.map = null;
        this._mapLoaded = false;
        this._pendingRender = null;
    }

    initialize() {
        if (!window.mapboxgl) return;
        const container = document.getElementById(this.containerId);
        if (!container) return;

        mapboxgl.accessToken = this.mapboxToken;
        this.map = new mapboxgl.Map({
            container: this.containerId,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-86.7816, 36.1627], // Nashville, TN
            zoom: 12, // Reasonable city-level zoom
            interactive: false,
            attributionControl: false,
            preserveDrawingBuffer: true
        });
        this._mapLoaded = false;
        this._pendingRender = null;
        this.map.on('load', () => {
            this._mapLoaded = true;
            if (this._pendingRender) {
                this._pendingRender();
                this._pendingRender = null;
            }
        });
        return this;
    }

    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }

    async render(shape, stop, tripGid, routeColor) {
        if (!this.map || !shape?.points?.length) {
            return;
        }

        const validPoints = this._validatePoints(shape.points);
        if (!validPoints.length) {
            return;
        }

        const lineCoords = validPoints.map(pt => [pt.lon, pt.lat]);
        const bounds = this._calculateBounds(validPoints);
        const stopFeature = this._createStopFeature(stop);

        // Remove previous sources/layers if they exist
        try {
            if (this.map.getLayer('route-line')) this.map.removeLayer('route-line');
            if (this.map.getSource('route')) this.map.removeSource('route');
            if (this.map.getLayer('stop-border')) this.map.removeLayer('stop-border');
            if (this.map.getLayer('stop-marker')) this.map.removeLayer('stop-marker');
            if (this.map.getSource('stop')) this.map.removeSource('stop');
            if (this.map.getLayer('bus-marker')) this.map.removeLayer('bus-marker');
            if (this.map.getSource('bus')) this.map.removeSource('bus');
        } catch (e) {}

        // Fit bounds
        try {
            this.map.fitBounds(bounds, { padding: 40, duration: 0 });
        } catch (e) {}

        const addLayers = async () => {
            this._addRouteLayer(lineCoords, routeColor);
            if (stopFeature) {
                this._addStopMarker(stopFeature);
            }
            if (tripGid) {
                await this.renderBusMarker(tripGid);
            }
        };

        if (this._mapLoaded) {
            await addLayers();
        } else {
            this._pendingRender = addLayers;
        }
    }

    async renderBusMarker(tripGid) {
        try {
            console.log('[TransitMap] Fetching vehicle positions for trip:', tripGid);
            const resp = await fetch('https://gtfs.transitnownash.org/realtime/vehicle_positions.json');
            const vehicles = await resp.json();
            console.log('[TransitMap] Found vehicles:', vehicles.length);
            
            const match = vehicles.find(v => v.vehicle?.trip?.trip_id && String(v.vehicle.trip.trip_id) === String(tripGid));
            console.log('[TransitMap] Matching vehicle:', match);
            
            if (!match || !match.vehicle?.position) return;
            const { latitude, longitude, bearing } = match.vehicle.position;
            console.log('[TransitMap] Vehicle position:', { latitude, longitude, bearing });

            // Load both images if not already loaded
            if (!this.map.hasImage('bus-marker-img')) {
                console.log('[TransitMap] Loading bus marker image');
                await new Promise((resolve, reject) => {
                    this.map.loadImage(BUS_MARKER_IMAGE, (error, image) => {
                        if (error) {
                            console.error('[TransitMap] Error loading bus image:', error);
                            reject(error);
                        }
                        this.map.addImage('bus-marker-img', image, { pixelRatio: 2 });
                        console.log('[TransitMap] Bus marker image loaded');
                        resolve();
                    });
                });
            }

            if (!this.map.hasImage('direction-arrow')) {
                console.log('[TransitMap] Creating direction arrow');
                const arrowCanvas = createArrowImage();
                this.map.addImage('direction-arrow', arrowCanvas.getContext('2d').getImageData(0, 0, arrowCanvas.width, arrowCanvas.height));
                console.log('[TransitMap] Direction arrow created');
            }

            // Add bus source and layers
            this.map.addSource('bus', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [longitude, latitude] },
                            properties: { bearing: bearing || 0 }
                        }
                    ]
                }
            });
            console.log('[TransitMap] Added bus source');

            // Add bus icon (no rotation)
            this.map.addLayer({
                id: 'bus-marker',
                type: 'symbol',
                source: 'bus',
                layout: {
                    'icon-image': 'bus-marker-img',
                    'icon-size': 0.25,
                    'icon-allow-overlap': true,
                    'icon-anchor': 'center'
                }
            });
            console.log('[TransitMap] Added bus marker layer');

            // Add direction arrow (with rotation)
            this.map.addLayer({
                id: 'direction-arrow',
                type: 'symbol',
                source: 'bus',
                layout: {
                    'icon-image': 'direction-arrow',
                    'icon-size': 0.75,
                    'icon-allow-overlap': true,
                    'icon-offset': [0, -15],
                    'icon-rotate': ['get', 'bearing'],
                    'icon-rotation-alignment': 'map',
                    'icon-anchor': 'bottom'
                }
            });
            console.log('[TransitMap] Added direction arrow layer');

        } catch (e) {
            console.error('[TransitMap] Error in renderBusMarker:', e);
        }
    }

    _validatePoints(points) {
        return points
            .map(pt => ({
                lat: typeof pt.lat === 'number' ? pt.lat : parseFloat(pt.lat),
                lon: typeof pt.lon === 'number' ? pt.lon : parseFloat(pt.lon)
            }))
            .filter(pt => 
                typeof pt.lat === 'number' &&
                typeof pt.lon === 'number' &&
                !isNaN(pt.lat) &&
                !isNaN(pt.lon)
            );
    }

    _calculateBounds(points) {
        const lats = points.map(pt => pt.lat);
        const lngs = points.map(pt => pt.lon);
        return [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)]
        ];
    }

    _createStopFeature(stop) {
        if (!stop?.stop_lat || !stop?.stop_lon) return null;
        
        const stopLat = parseFloat(stop.stop_lat);
        const stopLon = parseFloat(stop.stop_lon);
        if (isNaN(stopLat) || isNaN(stopLon)) return null;

        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [stopLon, stopLat] },
            properties: {}
        };
    }

    _addRouteLayer(coordinates, routeColor) {
        this.map.addSource('route', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates },
                properties: {}
            }
        });

        this.map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': routeColor || '#1a237e',
                'line-width': 6
            }
        });
    }

    _addStopMarker(stopFeature) {
        this.map.addSource('stop', {
            type: 'geojson',
            data: stopFeature
        });

        this.map.addLayer({
            id: 'stop-border',
            type: 'circle',
            source: 'stop',
            paint: {
                'circle-radius': 8,
                'circle-color': '#ffffff',
                'circle-stroke-width': 0
            }
        });

        this.map.addLayer({
            id: 'stop-marker',
            type: 'circle',
            source: 'stop',
            paint: {
                'circle-radius': 6,
                'circle-color': '#000000',
                'circle-stroke-width': 0
            }
        });
    }
}
