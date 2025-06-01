import { fetchStop, fetchTrips, fetchRoute, fetchAlerts } from './js/api.js';
import { parseTime, formatTime, getTimeUntil, findNextDepartureTime } from './js/time-utils.js';
import { TransitMap } from './js/transit-map.js';

// Set it to ?stop=:value or use default
const STOP_ID = new URLSearchParams(window?.location?.search)?.get('stop') || 'PORGRESF';
const MAPBOX_TOKEN = 'pk.eyJ1Ijoic3RlcGhlbnllYXJnaW4iLCJhIjoiY2tobnVwczF0MDQ2dDJ0cXF3cHprZWhmciJ9.ScjCsGrht5g5AtAHMC28Iw';
let transitMap = null;

document.addEventListener('DOMContentLoaded', async function() {
  transitMap = new TransitMap('wego-map-canvas', MAPBOX_TOKEN).initialize();

  async function loadStopAndTrips() {
    const stop = await fetchStop(STOP_ID);
    const trips = await fetchTrips(STOP_ID);
    return [{ stop, trips }];
  };

  const renderStopAndTrip = (stop, trip, route, timeToNext) => {
    const routeItem = document.getElementById('route-name')?.closest('.item');
    const departsItem = document.getElementById('next-stop-time')?.closest('.item');
    const stopNameEl = document.getElementById('stop-name');
    const tripNameEl = document.getElementById('trip-name');
    const stopTimesContainer = document.getElementById('next-stop-time');
    const routeNameEl = document.getElementById('route-name');

    // If no route or no next trip, show a special view
    if (!route || !trip) {
      if (routeItem) routeItem.style.display = 'none';
      if (departsItem) departsItem.style.display = 'none';
      stopNameEl.textContent = stop?.stop_name || '-';
      tripNameEl.textContent = 'No more departures today';
      // Optionally, add a dimmed style
      stopNameEl.classList.add('text--muted');
      tripNameEl.classList.add('text--muted');
      // Hide map and alerts
      const mapContainer = document.getElementById('wego-map-canvas');
      if (mapContainer) mapContainer.innerHTML = '';
      const alertsContainer = document.getElementById('alerts-list');
      if (alertsContainer) alertsContainer.innerHTML = '';
      return;
    }

    // Remove dimmed style and show items if present
    if (routeItem) routeItem.style.display = '';
    if (departsItem) departsItem.style.display = '';
    stopNameEl.classList.remove('text--muted');
    tripNameEl.classList.remove('text--muted');

    if (route) {
      routeNameEl.textContent = `${route.route_short_name} - ${route.route_long_name}`;
      routeNameEl.style.color = `#${route.route_color || '1a237e'}`;
      routeNameEl.style.background = route.route_text_color ? `#${route.route_text_color}` : '';
    } else {
      routeNameEl.textContent = '-';
    }

    const stopName = stop.stop_name;
    const tripName = trip?.trip_headsign || trip?.route_long_name || trip?.route_short_name || 'Unknown Route';
    stopNameEl.textContent = stopName;
    tripNameEl.textContent = tripName + (route ? ` (${route.route_long_name || route.route_short_name || ''})` : '');

    // Render the next departure time
    if (!trip?.stop_times?.length) {
      stopTimesContainer.textContent = 'No stop times available';
      return;
    }

    const nextDepartureTime = findNextDepartureTime(trip.stop_times);
    if (!nextDepartureTime) {
      stopTimesContainer.textContent = 'No more stops today';
      return;
    }

    stopTimesContainer.textContent = `${formatTime(nextDepartureTime)} (${timeToNext || ''})`;
  };

  function getTimeUntilNextStop(trip) {
    if (!trip?.stop_times) return null;
    const nextDepartureTime = findNextDepartureTime(trip.stop_times);
    return nextDepartureTime ? getTimeUntil(nextDepartureTime) : null;
  }

  const renderMap = (shape, stop, tripGid) => {
    if (!shape?.points?.length) {
      const mapContainer = document.getElementById('wego-map-canvas');
      if (mapContainer) {
        mapContainer.innerHTML = '<span class="label label--small">No shape data</span>';
      }
      return;
    }
    transitMap?.render(shape, stop, tripGid);
  };

  function findNextTrip(trips) {
    if (!Array.isArray(trips) || trips.length === 0) return null;
    let soonestTrip = null;
    let soonestTime = null;
    
    for (const trip of trips) {
      if (!trip.stop_times?.length) continue;
      const depTime = findNextDepartureTime(trip.stop_times);
      if (depTime && (!soonestTime || depTime < soonestTime)) {
        soonestTrip = trip;
        soonestTime = depTime;
      }
    }
    return soonestTrip;
  }

  function renderAlerts(alerts) {
    const alertsContainer = document.getElementById('alerts-list');
    alertsContainer.innerHTML = '';
    if (!alerts.length) {
      alertsContainer.style.display = 'none';
      return;
    }
    alertsContainer.style.display = '';
    // Only show the first alert, with indicator if more exist
    const headline = alerts[0].alert.header_text?.translation?.[0]?.text || 'Alert';
    const description = alerts[0].alert.description_text?.translation?.[0]?.text || '';
    const item = document.createElement('div');
    item.className = 'item mb--2 bg--black text--white p--4';
    const headlineDiv = document.createElement('div');
    headlineDiv.className = 'title title--small';
    headlineDiv.textContent = headline;
    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'description clamp--2';
    descriptionDiv.textContent = description;
    const content = document.createElement('div');
    content.className = '';
    content.appendChild(headlineDiv);
    content.appendChild(descriptionDiv);
    item.appendChild(content);
    alertsContainer.appendChild(item);
    if (alerts.length > 1) {
      const more = document.createElement('div');
      more.className = 'label label--medium w--40';
      more.textContent = `+${alerts.length - 1} more alert${alerts.length > 2 ? 's' : ''}`;
      alertsContainer.appendChild(more);
    }
  }

  loadStopAndTrips().then(async (stopsWithTrips) => {
    if (!stopsWithTrips?.length) return;
    
    const { stop, trips } = stopsWithTrips[0];
    const nextTrip = findNextTrip(trips);
    
    let route = null;
    if (nextTrip?.route_gid) {
      route = await fetchRoute(nextTrip.route_gid);
    }

    const timeToNext = getTimeUntilNextStop(nextTrip);
    renderStopAndTrip(stop, nextTrip, route, timeToNext);
    
    if (nextTrip?.shape) {
      renderMap(nextTrip.shape, stop, nextTrip.trip_gid);
    }
    
    if (route) {
      const alerts = await fetchAlerts(route.route_gid);
      renderAlerts(alerts);
    }
  });

});




