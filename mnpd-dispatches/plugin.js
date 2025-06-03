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
        const resp = await fetch('https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Metro_Nashville_Police_Department_Active_Dispatch_Table_view/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson');
        const data = await resp.json();
        const tbody = document.getElementById('dispatch-tbody');
        tbody.innerHTML = '';
        if (!data.features || !data.features.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text--center">No active dispatches.</td></tr>';
            return;
        }
        data
            .features
            .slice(0, 12)
            .forEach(f => {
                const p = f.properties;
                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td><span class="label label--small"><strong>${p.IncidentTypeCode || ''}</strong></span></td>
          <td><span class="description">${p.IncidentTypeName || ''}</span></td>
          <td><span class="label label--small text--center">${formatTime(p.CallReceivedTime)}</span></td>
          <td><span class="label label--small">${p.Location || ''}</span></td>
          <td><span class="label label--small">${p.CityName || ''}</span></td>
        `;
                tbody.appendChild(tr);
            });
    }

    loadDispatches();
});