var map = L.map('map').setView([-31.946931, -52.219278], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

for (const item of window.data) {
    const popupContent = `
    <p>Latitude: ${item.lat}<p>
    <p>Longitude: ${item.long}<p>
    `

    L.marker([item.lat, item.long]).addTo(map)
    .bindPopup(popupContent)
}


