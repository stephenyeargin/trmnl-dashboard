// Basic plugin initialization for TRMNL Dashboard
// Extend this as needed for TRMNL API integration or custom logic

document.addEventListener('DOMContentLoaded', function () {
  // Render rows of Pollen Table
  const renderPollenTable = (pollen) => {
    if (!pollen) return;

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

  function renderGauge(container, value, max, label) {
    Highcharts.chart(container, {
      accessibility: {
        enabled: false, // not necessary for TRMNL
      },
      chart: {
        type: "gauge",
        height: 120,
        backgroundColor: "transparent"
      },
      title: null,
      pane: {
        startAngle: -150,
        endAngle: 150,
        background: [{ backgroundColor: "transparent", borderWidth: 0 }]
      },
      yAxis: {
        min: 0,
        max: max,
        endOnTick: false,
        tickPositions: [0, max],
        tickAmount: 0, // Hide ticks
        tickWidth: 0,
        lineWidth: 0,
        labels: {
          enabled: false // Hide axis labels
        },
        title: {
          text: null
        },
        plotBands: [{
          from: 0,
          to: value,
          color: {
            pattern: {
              image: "https://usetrmnl.com/images/grayscale/gray-2.png",
              width: 12,
              height: 12
            }
          },
          innerRadius: "82%",
          borderRadius: "50%"
        }, {
          from: value,
          to: max,
          color: {
            pattern: {
              image: "https://usetrmnl.com/images/grayscale/gray-5.png",
              width: 12,
              height: 12
            }
          },
          innerRadius: "82%",
          borderRadius: "50%"
        }]
      },
      plotOptions: {
        gauge: {
          animation: false,
          dial: { backgroundColor: "transparent", baseWidth: 0 },
          pivot: { backgroundColor: "transparent" }
        }
      },
      series: [{
        name: label,
        data: [value],
        dataLabels: {
          borderWidth: 0,
          useHTML: true,
          style: { fontSize: "2.8em", fontWeight: "600", color: "#000" },
          format: '<span style="font-size:0.5em;font-weight:600;color:#000">{y}</span>'
        }
      }],
      credits: { enabled: false }
    });
  }

  const renderTopMetrics = (pollen) => {
    if (!pollen) return;

    const pollenType = document.getElementById('metric-pollen-type');
    const todaysMetrics = pollen[0];
    const forecastHeading = document.getElementById('forecast-heading');
    const date = new Date(todaysMetrics.properties?.ReportDateTime);
    forecastHeading.textContent = `Pollen and air quality report for ${date.toLocaleDateString('en-US')}`;

    pollenType.innerHTML = `${todaysMetrics.properties?.PollenType}, ${todaysMetrics.properties?.PollenDescription}`;

    // Render gauges
    renderGauge(
      "gauge-pollen-count",
      Number(todaysMetrics.properties?.PollenCount) || 0,
      12, // Pollen max is 12
      "Pollen"
    );
    renderGauge(
      "gauge-aqi",
      Number(todaysMetrics.properties?.AQI) || 0,
      500, // AQI max is 500
      "AQI"
    );
  };

  fetch('https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Air_Quality_and_Pollen_Count_1/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson')
    .then(response => response.json())
    .then(data => {
      // Sort by ReportDateTime in descending order
      data.features.sort((a, b) => new Date(b.properties.ReportDateTime) - new Date(a.properties.ReportDateTime));

      window.pollen = data.features;
      renderTopMetrics(data.features);
      renderPollenTable(data.features);
    })
    .catch(error => {
      console.error('Error fetching pollen count:', error);
    });
});
