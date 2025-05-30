// Basic plugin initialization for TRMNL Dashboard
// Extend this as needed for TRMNL API integration or custom logic

document.addEventListener('DOMContentLoaded', function() {
  // Example: Show a console message when the plugin loads
  console.log('TRMNL Dashboard plugin loaded.');

  // Render rows of Pollen Table
  const renderPollenTable = (pollen) => {
    const tbody = document.getElementById('pollen-tbody');
    tbody.innerHTML = '';
    pollen.slice(1, 6).forEach((row) => {
      const tr = document.createElement('tr');
      const date = new Date(row.properties?.ReportDateTime);
      tr.innerHTML = `
        <td><span class="title title--small">${date.toLocaleDateString('en-US')}</span></td>
        <td class="text--center"><span class="value value--small value--tnums" data-value-format="true">${row.properties?.PollenCount}</span></td>
        <td><span class="title title--small">${row.properties?.PollenType}, ${row.properties?.PollenDescription}</span></td>
        <td class="text--center"><span class="value value--small value--tnums" data-value-format="true">${row.properties?.AQI}</span></td>
        <td><span class="title title--small">${row.properties?.Category}</span></td>
        <td><span class="title title--small">${row.properties?.ResponsiblePollutant}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  const renderTopMetrics = (pollen) => {
    const pollenCount = document.getElementById('metric-pollen-count');
    const pollenType = document.getElementById('metric-pollen-type');
    const aqi = document.getElementById('metric-aqi');

    const todaysMetrics = pollen[0];

    pollenCount.innerHTML = todaysMetrics.properties?.PollenCount;
    pollenType.innerHTML = `${todaysMetrics.properties?.PollenType}, ${todaysMetrics.properties?.PollenDescription}`;
    aqi.innerHTML = todaysMetrics.properties?.AQI;
  };

  fetch('https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Air_Quality_and_Pollen_Count_1/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson')
    .then(response => response.json())
    .then(data => {
      window.pollen = data.features;
      renderTopMetrics(data.features);
      renderPollenTable(data.features);
    })
    .catch(error => {
      console.error('Error fetching pollen count:', error);
    });
});
