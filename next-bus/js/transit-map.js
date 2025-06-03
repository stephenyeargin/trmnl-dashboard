const BUS_MARKER_IMAGE = 'https://raw.githubusercontent.com/transitnownash/wego-bus-map/refs/heads/main/public/logo192.png';

export class TransitMap {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.routeLayer = null;
        this.stopMarker = null;
        this.busMarker = null;
    }

    initialize() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        // Remove any previous map instance
        if (this.map) {
            this.map.remove();
        }
        this.map = L.map(this.containerId, {
            center: [36.1627, -86.7816], // Nashville
            zoom: 12,
            zoomControl: false,
            attributionControl: true
        });
        // Use CartoDB Positron tiles for a clean look
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);
        return this;
    }

    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }

    async render(shape, stop, tripGid, routeColor) {
        if (!this.map || !shape?.points?.length) return;
        const validPoints = this._validatePoints(shape.points);
        if (!validPoints.length) return;
        const lineCoords = validPoints.map(pt => [pt.lat, pt.lon]);
        // Remove previous layers/markers
        if (this.routeLayer) { this.map.removeLayer(this.routeLayer); this.routeLayer = null; }
        if (this.stopMarker) { this.map.removeLayer(this.stopMarker); this.stopMarker = null; }
        if (this.busMarker) { this.map.removeLayer(this.busMarker); this.busMarker = null; }
        // Fit bounds
        const bounds = L.latLngBounds(lineCoords);
        this.map.fitBounds(bounds, { padding: [40, 40] });
        // Add route polyline
        this.routeLayer = L.polyline(lineCoords, {
            color: routeColor || '#1a237e',
            weight: 6,
            opacity: 1
        }).addTo(this.map);
        // Add stop marker
        if (stop?.stop_lat && stop?.stop_lon) {
            this.stopMarker = L.circleMarker([parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)], {
                radius: 8,
                color: '#fff',
                weight: 3,
                fillColor: '#000',
                fillOpacity: 1
            }).addTo(this.map);
        }
        // Add bus marker
        if (tripGid) {
            await this.renderBusMarker(tripGid);
        }
    }

    async renderBusMarker(tripGid) {
        try {
            const resp = await fetch('https://gtfs.transitnownash.org/realtime/vehicle_positions.json');
            const vehicles = await resp.json();
            const match = vehicles.find(v => v.vehicle?.trip?.trip_id && String(v.vehicle.trip.trip_id) === String(tripGid));
            if (!match || !match.vehicle?.position) return;
            const { latitude, longitude } = match.vehicle.position;
            // Add bus marker (icon) at the vehicle position
            if (this.busMarker) { this.map.removeLayer(this.busMarker); this.busMarker = null; }
            if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
                this.busMarker = L.marker([parseFloat(latitude), parseFloat(longitude)], {
                    icon: L.icon({
                        iconUrl: BUS_MARKER_IMAGE,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10],
                    }),
                    zIndexOffset: 1000 // ensure bus is above other markers
                }).addTo(this.map);
            }
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
}
