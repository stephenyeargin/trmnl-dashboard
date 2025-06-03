// WeGo Transit API Methods

export async function fetchStop(stopId) {
    const stopsUrl = `https://gtfs.transitnownash.org/stops/${stopId}.json`;
    const stopsResp = await fetch(stopsUrl);
    return await stopsResp.json();
}

export async function fetchTrips(stopId) {
    const tripsUrl = `https://gtfs.transitnownash.org/stops/${stopId}/trips.json?per_page=200`;
    const tripsResp = await fetch(tripsUrl);
    const tripsData = await tripsResp.json();
    return tripsData.data || [];
}

export async function fetchRoute(routeId) {
    const routeUrl = `https://gtfs.transitnownash.org/routes/${routeId}.json`;
    const routeResp = await fetch(routeUrl);
    return await routeResp.json();
}

export async function fetchAlerts(routeId) {
    if (!routeId) return [];
    try {
        const resp = await fetch('https://gtfs.transitnownash.org/realtime/alerts.json');
        const alerts = await resp.json();
        return alerts.filter(a =>
            a.alert &&
            Array.isArray(a.alert.informed_entity) &&
            a.alert.informed_entity.some(e => String(e.route_id) === String(routeId)) &&
            (!a.alert.active_period || !a.alert.active_period[0] ||
                (typeof a.alert.active_period[0].start === 'undefined') ||
                (a.alert.active_period[0].start * 1000 <= Date.now()))
        );
    } catch (e) {
        console.error('Error fetching alerts:', e);
        return [];
    }
}
