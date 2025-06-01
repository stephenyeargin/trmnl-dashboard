import { fetchStop, fetchTrips, fetchRoute, fetchAlerts } from './js/api.js';
import { parseTime, formatTime, getTimeUntil, findNextDepartureTime } from './js/time-utils.js';
import { TransitMap } from './js/transit-map.js';

// Set it to ?stop=:value or use default
const STOP_ID = new URLSearchParams(window?.location?.search)?.get('stop') || 'PORGRESF';
const MAPBOX_TOKEN = 'pk.eyJ1Ijoic3RlcGhlbnllYXJnaW4iLCJhIjoiY2tobnVwczF0MDQ2dDJ0cXF3cHprZWhmciJ9.ScjCsGrht5g5AtAHMC28Iw';
let transitMap = null;

document.addEventListener('DOMContentLoaded', async function() {
  transitMap = new TransitMap('wego-map-canvas', MAPBOX_TOKEN).initialize();

  async function loadStopTripsAndUpdates() {
    // Fetch stop, trips, and trip updates in parallel
    const [stop, trips, tripUpdates] = await Promise.all([
      fetchStop(STOP_ID),
      fetchTrips(STOP_ID),
      fetchTripUpdates()
    ]);
    return { stop, trips, tripUpdates };
  };

  // Update function signature to accept scheduledDeparture and delayText
  const renderStopAndTrip = (stop, trip, route, timeToNext, delayText, scheduledDeparture) => {
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
    if (!timeToNext) {
      stopTimesContainer.textContent = 'No more stops today';
      return;
    }
    stopTimesContainer.innerHTML = `${formatTime(scheduledDeparture)} <span class="label label--small">(${timeToNext}${delayText ? ', ' + delayText : ''})</span>`;
  };

  function getTimeUntilNextStop(trip) {
    if (!trip?.stop_times) return null;
    const nextDepartureTime = findNextDepartureTime(trip.stop_times);
    return nextDepartureTime ? getTimeUntil(nextDepartureTime) : null;
  }

  const renderMap = (shape, stop, tripGid, routeColor) => {
    if (!shape?.points?.length) {
      const mapContainer = document.getElementById('wego-map-canvas');
      if (mapContainer) {
        mapContainer.innerHTML = '<span class="label label--small">No shape data</span>';
      }
      return;
    }
    transitMap?.render(shape, stop, tripGid, routeColor);
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

  // Helper to fetch trip updates
  async function fetchTripUpdates() {
    try {
      const resp = await fetch('https://gtfs.transitnownash.org/realtime/trip_updates.json');
      return await resp.json();
    } catch (e) {
      console.error('Error fetching trip updates:', e);
      return [];
    }
  }

  // Helper to format lateness/earliness
  function formatDelay(scheduled, realtime) {
    if (!scheduled || !realtime) return '';
    const diffSec = realtime - Math.floor(scheduled.getTime() / 1000);
    if (Math.abs(diffSec) < 60) return 'on time';
    const min = Math.round(Math.abs(diffSec) / 60);
    return diffSec > 0 ? `${min} min late` : `${min} min early`;
  }

  loadStopTripsAndUpdates().then(async ({ stop, trips, tripUpdates }) => {
    if (!stop || !trips) return;
    const nextTrip = findNextTrip(trips);
    let route = null;
    if (nextTrip?.route_gid) {
      // Fetch route and alerts only if we have a next trip
      route = await fetchRoute(nextTrip.route_gid);
    }
    // Real-time trip update logic
    let tripUpdate = tripUpdates.find(tu => tu.trip_update?.trip?.trip_id === nextTrip?.trip_gid);
    let nextStopTime = nextTrip?.stop_times?.find(st => {
      const dep = parseTime(st.departure_time);
      return dep && dep > new Date();
    });
    let scheduledDeparture = nextStopTime ? parseTime(nextStopTime.departure_time) : null;
    let realtimeDeparture = null;
    let delayText = '';
    if (tripUpdate && nextStopTime) {
      const stuArr = tripUpdate.trip_update?.stop_time_update || [];
      const stu = stuArr.find(
        s => String(s.stop_id).trim() === String(nextStopTime.stop_gid).trim() && s.departure && s.departure.time
      );
      if (stu && scheduledDeparture) {
        realtimeDeparture = stu.departure.time;
        const realtimeDate = new Date(realtimeDeparture * 1000);
        delayText = formatDelay(scheduledDeparture, realtimeDeparture);
        scheduledDeparture = realtimeDate;
      }
    }
    const timeToNext = scheduledDeparture ? getTimeUntil(scheduledDeparture) : null;
    renderStopAndTrip(stop, nextTrip, route, timeToNext, delayText, scheduledDeparture);
    if (nextTrip?.shape) {
      const routeColor = route?.route_color ? `#${route.route_color}` : undefined;
      renderMap(nextTrip.shape, stop, nextTrip.trip_gid, routeColor);
    }
    if (route) {
      const alerts = await fetchAlerts(route.route_gid);
      renderAlerts(alerts);
    }
  });

});




