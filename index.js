var map = L.map('map').setView([-31.946931, -52.219278], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

function createRefList(refs) {
    let listItems = "";
    for (const ref in refs) {
        listItems += `<li>
                        <b>${ref}:</b> ${refs[ref]}
                    </li>`;
    }
    return listItems;
}

for (const item of window.data) {
    const refList = createRefList(item.refs);

    const popupContent = `
        <h3>${item.title}</h3>
        <p>${item.type}</p>
        <p>Latitude: ${item.lat}</p>
        <p>Longitude: ${item.long}</p>
        <p>Referências:</p>
        <ul>
            ${refList}
        </ul>
    `;

    L.marker([item.lat, item.long],{
        alt: item.id,
        title: item.id
    })
    .addTo(map)
    .bindPopup(popupContent)
}


