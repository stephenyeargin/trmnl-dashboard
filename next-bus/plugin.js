// Set it to ?stop=:value or use default
const STOP_ID = new URLSearchParams(window?.location?.search)?.get('stop') || 'PORGRESF';

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
    const mapContainer = document.getElementById('wego-map');
    mapContainer.innerHTML = '';
    // Simple SVG polyline for shape
    const pointsArr = shape?.points || [];
    if (!Array.isArray(pointsArr) || pointsArr.length === 0) {
      mapContainer.innerHTML = '<span class="label label--small">No shape data</span>';
      return;
    }
    // Normalize lat/lng to fit SVG viewBox
    // Ensure input is parsed as numbers and use correct property names (lat/lon instead of shape_pt_lat/shape_pt_lon)
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
      mapContainer.innerHTML = '<span class="label label--small">No valid shape data</span>';
      return;
    }
    const lats = validPoints.map(pt => pt.lat);
    const lngs = validPoints.map(pt => pt.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const padding = 20; // px
    const width = 300, height = 300;
    const innerWidth = width - 2 * padding;
    const innerHeight = height - 2 * padding;
    const points = validPoints.map(pt => {
      const x = (maxLng - minLng) === 0 ? width/2 : padding + ((pt.lon - minLng) / (maxLng - minLng)) * innerWidth;
      const y = (maxLat - minLat) === 0 ? height/2 : height - padding - ((pt.lat - minLat) / (maxLat - minLat)) * innerHeight;
      return `${x},${y}`;
    }).join(' ');
    mapContainer.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline points="${points}" fill="none" stroke="#1a237e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;
    // Plot stop as a star in a circle
    if (typeof stop === 'object' && stop.stop_lat	 && stop.stop_lon) {
      const stopLat = typeof stop.stop_lat === 'number' ? stop.stop_lat	 : parseFloat(stop.stop_lat	);
      const stopLon = typeof stop.stop_lon === 'number' ? stop.stop_lon : parseFloat(stop.stop_lon);
      if (!isNaN(stopLat) && !isNaN(stopLon)) {
        const x = (maxLng - minLng) === 0 ? width/2 : padding + ((stopLon - minLng) / (maxLng - minLng)) * innerWidth;
        const y = (maxLat - minLat) === 0 ? height/2 : height - padding - ((stopLat - minLat) / (maxLat - minLat)) * innerHeight;
        // SVG star path centered at (x, y)
        const rOuter = 14, rInner = 6, n = 5;
        let starPath = '';
        for (let i = 0; i < 2 * n; i++) {
          const r = i % 2 === 0 ? rOuter : rInner;
          const angle = Math.PI / n * i - Math.PI / 2;
          const sx = x + r * Math.cos(angle);
          const sy = y + r * Math.sin(angle);
          starPath += (i === 0 ? 'M' : 'L') + sx + ',' + sy;
        }
        starPath += 'Z';
        // Insert star and circle on top of polyline
        mapContainer.querySelector('svg').innerHTML += `
          <path d="${starPath}" fill="#000" stroke="#FFF" stroke-width="2" />
        `;
      }
    }
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
    // .meta and .content structure
    const meta = document.createElement('div');
    meta.className = 'meta';
    const headlineDiv = document.createElement('div');
    headlineDiv.className = 'title title--small';
    headlineDiv.textContent = headline;
    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'description';
    descriptionDiv.textContent = description;
    const content = document.createElement('div');
    content.className = 'content';
    content.appendChild(headlineDiv);
    content.appendChild(descriptionDiv);
    item.appendChild(meta);
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




