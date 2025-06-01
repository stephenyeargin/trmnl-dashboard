// Set it to ?stop=:value or use default
const STOP_ID = new URLSearchParams(window?.location?.search)?.get('stop') || 'PORGRESF';

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic3RlcGhlbnllYXJnaW4iLCJhIjoiY2tobnVwczF0MDQ2dDJ0cXF3cHprZWhmciJ9.ScjCsGrht5g5AtAHMC28Iw';

document.addEventListener('DOMContentLoaded', function() {

  const fetchNearbyStopsAndTrips = async () => {
    // Hardcoded stop
    const stop_gid = STOP_ID;
    const stopsUrl = `https://gtfs.transitnownash.org/stops/${stop_gid}.json`;
    const stopsResp = await fetch(stopsUrl);
    const stopData = await stopsResp.json();
    const stop = stopData;
    // Fetch trips for this stop
    const tripsUrl = `https://gtfs.transitnownash.org/stops/${stop_gid}/trips.json`;
    const tripsResp = await fetch(tripsUrl);
    const tripsData = await tripsResp.json();
    const trips = tripsData.data || [];
    return [{ stop, trips }];
  };

  const renderStopAndTrip = (stop, trip, route, timeToNext) => {
    if (route) {
      document.getElementById('route-name').textContent = `${route.route_short_name	} - ${route.route_long_name}`;
    } else {
      document.getElementById('route-name').textContent = '-';
    }
    const stopName = stop.stop_name;
    const tripName = trip?.trip_headsign || trip?.route_long_name || trip?.route_short_name || 'Unknown Route';
    document.getElementById('stop-name').textContent = stopName;
    document.getElementById('trip-name').textContent = tripName + (route ? ` (${route.route_long_name || route.route_short_name || ''})` : '');
    if (route) {
      document.getElementById('route-name').style.color = `#${route.route_color || '1a237e'}`;
      document.getElementById('route-name').style.background = route.route_text_color ? `#${route.route_text_color}` : '';
    }
    // Render all stop times
    const stopTimesContainer = document.getElementById('next-stop-time');
    stopTimesContainer.innerHTML = '';
    if (trip && Array.isArray(trip.stop_times) && trip.stop_times.length > 0) {
      // Find the next stop time after now
      const nowLocal = new Date();
      let found = false;
      for (const st of trip.stop_times) {
        const dep = st.departure_time && st.departure_time.trim();
        if (!dep) continue;
        const depParts = dep.split(":");
        if (depParts.length !== 3) continue;
        const depDate = new Date(nowLocal);
        depDate.setHours(parseInt(depParts[0], 10));
        depDate.setMinutes(parseInt(depParts[1], 10));
        depDate.setSeconds(parseInt(depParts[2], 10));
        if (depDate > nowLocal && !found) {
          // Format as h:mm am/pm
          const options = { hour: 'numeric', minute: '2-digit', hour12: true };
          const formatted = depDate.toLocaleTimeString([], options).replace(/^0/, '');
          stopTimesContainer.textContent = `${formatted} (${timeToNext || ''})`;
          found = true;
          break;
        }
      }
      if (!found) {
        stopTimesContainer.textContent = 'No more stops today';
      }
    } else {
      stopTimesContainer.textContent = 'No stop times available';
    }
  };

  function getTimeUntilNextStop(trip) {
    if (!trip || !Array.isArray(trip.stop_times)) return null;
    // Use local time directly, since API times are always local
    const nowLocal = new Date();
    const todayStr = nowLocal.toISOString().slice(0, 10);
    for (const st of trip.stop_times) {
      const dep = st.departure_time && st.departure_time.trim();
      if (!dep) continue;
      // Compose a datetime for today in local time
      const depParts = dep.split(":");
      if (depParts.length !== 3) continue;
      const depDate = new Date(nowLocal);
      depDate.setHours(parseInt(depParts[0], 10));
      depDate.setMinutes(parseInt(depParts[1], 10));
      depDate.setSeconds(parseInt(depParts[2], 10));
      if (depDate > nowLocal) {
        const diffMs = depDate - nowLocal;
        const min = Math.floor(diffMs / 60000);
        const sec = Math.floor((diffMs % 60000) / 1000);
        return min > 0 ? `${min} min` : `${sec} sec`;
      }
    }
    return null;
  }

  const renderMap = (shape, stop) => {
    // Use Mapbox GL JS to render the map, route, and stop
    if (!window.mapboxgl) return;
    const mapContainer = document.getElementById('wego-map-canvas');
    if (!mapContainer) return;
    // Remove any previous map instance
    if (window._wegoMapInstance) {
      window._wegoMapInstance.remove();
      window._wegoMapInstance = null;
    }
    // Prepare GeoJSON for the route
    const pointsArr = shape?.points || [];
    const validPoints = pointsArr.map(pt => ({
      lat: typeof pt.lat === 'number' ? pt.lat : parseFloat(pt.lat),
      lon: typeof pt.lon === 'number' ? pt.lon : parseFloat(pt.lon)
    })).filter(pt =>
      typeof pt.lat === 'number' &&
      typeof pt.lon === 'number' &&
      !isNaN(pt.lat) &&
      !isNaN(pt.lon)
    );
    if (validPoints.length === 0) {
      mapContainer.innerHTML = '<span class="label label--small">No shape data</span>';
      return;
    }
    const lineCoords = validPoints.map(pt => [pt.lon, pt.lat]);
    // Center and bounds
    const lats = validPoints.map(pt => pt.lat);
    const lngs = validPoints.map(pt => pt.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const bounds = [[minLng, minLat], [maxLng, maxLat]];
    // Stop marker
    let stopFeature = null;
    if (stop && stop.stop_lat && stop.stop_lon) {
      const stopLat = typeof stop.stop_lat === 'number' ? stop.stop_lat : parseFloat(stop.stop_lat);
      const stopLon = typeof stop.stop_lon === 'number' ? stop.stop_lon : parseFloat(stop.stop_lon);
      if (!isNaN(stopLat) && !isNaN(stopLon)) {
        stopFeature = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [stopLon, stopLat] },
          properties: {}
        };
      }
    }
    // Initialize Mapbox map
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/light-v11',
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true
    });
    window._wegoMapInstance = map;
    map.fitBounds(bounds, { padding: 40, duration: 0 });
    map.on('load', () => {
      // Add route line
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: lineCoords },
          properties: {}
        }
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1a237e',
          'line-width': 6
        }
      });
      // Add stop as a circle marker (more reliable than SVG)
      if (stopFeature) {
        console.log('Adding stop marker at', stopFeature.geometry.coordinates);
        map.addSource('stop', {
          type: 'geojson',
          data: stopFeature
        });
        // Add white border circle
        map.addLayer({
          id: 'stop-border',
          type: 'circle',
          source: 'stop',
          paint: {
            'circle-radius': 8,
            'circle-color': '#ffffff',
            'circle-stroke-width': 0
          }
        });
        // Add black inner circle
        map.addLayer({
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
    });
  };

  // Find the next trip based on the soonest stop_times[0].departure_time after now (local time)
  function findNextTrip(trips) {
    if (!Array.isArray(trips) || trips.length === 0) return null;
    const nowLocal = new Date();
    let soonestTrip = null;
    let soonestTime = null;
    for (const trip of trips) {
      if (!trip.stop_times || !trip.stop_times.length) {
        console.log('Skipping trip (no stop_times):', trip);
        continue;
      }
      const dep = trip.stop_times[0].departure_time && trip.stop_times[0].departure_time.trim();
      if (!dep) {
        console.log('Skipping trip (no departure_time):', trip);
        continue;
      }
      const depParts = dep.split(":");
      if (depParts.length !== 3) {
        console.log('Skipping trip (bad departure_time format):', dep);
        continue;
      }
      const depDate = new Date(nowLocal);
      depDate.setHours(parseInt(depParts[0], 10));
      depDate.setMinutes(parseInt(depParts[1], 10));
      depDate.setSeconds(parseInt(depParts[2], 10));
      if (depDate > nowLocal && (!soonestTime || depDate < soonestTime)) {
        soonestTrip = trip;
        soonestTime = depDate;
      }
    }
    return soonestTrip;
  }

  async function fetchAlertsForRoute(route) {
    if (!route || !route.route_gid) return [];
    try {
      const resp = await fetch('https://gtfs.transitnownash.org/realtime/alerts.json');
      const alerts = await resp.json();
      // Filter for alerts that match the current route_id
      return alerts.filter(a =>
        a.alert &&
        Array.isArray(a.alert.informed_entity) &&
        a.alert.informed_entity.some(e => String(e.route_id) === String(route.route_gid))
      );
    } catch (e) {
      console.error('Error fetching alerts:', e);
      return [];
    }
  }

  function renderAlerts(alerts) {
    const alertsContainer = document.getElementById('alerts-list');
    alertsContainer.innerHTML = '';
    if (!alerts.length) {
      alertsContainer.style.display = 'none';
      // Remove any margin so the main content fills the space
      alertsContainer.classList.remove('mb--4');
      return;
    }
    alertsContainer.style.display = '';
    alertsContainer.classList.add('mb--4');
    // Only show the first alert, with indicator if more exist
    const headline = alerts[0].alert.header_text?.translation?.[0]?.text || 'Alert';
    const description = alerts[0].alert.description_text?.translation?.[0]?.text || '';
    const item = document.createElement('div');
    item.className = 'item mb--2';
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

  fetchNearbyStopsAndTrips().then(async (stopsWithTrips) => {
    if (!stopsWithTrips.length) return;
    const { stop, trips } = stopsWithTrips[0];
    const nextTrip = findNextTrip(trips);
    let route = null;
    if (nextTrip && nextTrip.route_gid) {
      try {
        const routeResp = await fetch(`https://gtfs.transitnownash.org/routes/${nextTrip.route_gid}.json`);
        const routeData = await routeResp.json();
        route = routeData;
      } catch (e) {}
    }
    const timeToNext = getTimeUntilNextStop(nextTrip);
    renderStopAndTrip(stop, nextTrip, route, timeToNext);
    if (nextTrip && nextTrip.shape) {
      renderMap(nextTrip.shape, stop);
    }
    let alerts = [];
    if (route) {
      alerts = await fetchAlertsForRoute(route);
    }
    renderAlerts(alerts);
  });

});




