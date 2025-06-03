document.addEventListener('DOMContentLoaded', async function () {
    function formatTime(ts) {
        if (!ts)
            return '-';
        const d = new Date(ts);
        return d.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }) + '<br><span class="label label--small">' + d.toLocaleDateString() + '</span>';
    }
    async function loadDispatches() {
        const resp = await fetch('https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Nashville_Fire_Department_Active_Incidents_view/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson');
        const data = await resp.json();
        const tbody = document.getElementById('dispatch-tbody');
        tbody.innerHTML = '';
        if (!data.features || !data.features.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text--center">No active incidents.</td></tr>';
            return;
        }
        // Deduplicate by event_number and aggregate UNIT_IDs
        const events = {};
        data.features.forEach(f => {
            const p = f.properties;
            if (!events[p.event_number]) {
                events[p.event_number] = {
                    ...p,
                    UNIT_IDs: [p.Unit_ID]
                };
            } else {
                events[p.event_number].UNIT_IDs.push(p.Unit_ID);
            }
        });
        // Sort by DispatchDateTime descending
        const sortedEvents = Object.values(events).sort((a, b) => {
            const ta = new Date(a.DispatchDateTime).getTime();
            const tb = new Date(b.DispatchDateTime).getTime();
            return tb - ta;
        });
        sortedEvents
            .slice(0, 12)
            .forEach(ev => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td><span class="label label--small"><strong>${ev.incident_type_id || ''}</strong></span></td>
          <td><span class="label label--small text--center">${formatTime(ev.DispatchDateTime)}</span></td>
          <td><span class="label label--small">${ev.PostalCode || ''}</span></td>
          <td><span class="label label--small">${ev.UNIT_IDs.join(', ')}</span></td>
          `;
                tbody.appendChild(tr);
            });
    }

    loadDispatches();
});