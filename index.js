const TYPE_CONFIG = {
    "Cerrito": { color: "#a0522d", label: "Cerrito" },
    "Sítio sobre dunas": { color: "#1f6feb", label: "Sítio sobre dunas" },
    "Cerrito/Sítio sobre dunas": { color: "#8e44ad", label: "Cerrito/Sítio sobre dunas" },
    "": { color: "#6b7280", label: "Não especificado" }
};

function typeConfigFor(type) {
    return TYPE_CONFIG[type] || TYPE_CONFIG[""];
}

function normalize(str) {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

const map = L.map("map").setView([-31.946931, -52.219278], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
}).addTo(map);

const clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);

function createRefList(refs) {
    let listItems = "";
    for (const ref in refs) {
        listItems += `<li>
                        <b>${ref}:</b> ${refs[ref]}
                    </li>`;
    }
    return listItems;
}

function createPopupContent(item) {
    const refList = createRefList(item.refs);
    const typeLabel = typeConfigFor(item.type).label;
    return `
        <h3>${item.title}</h3>
        <p>${typeLabel}</p>
        <p>Latitude: ${item.lat}</p>
        <p>Longitude: ${item.long}</p>
        <p>Referências:</p>
        <ul>
            ${refList}
        </ul>
    `;
}

// id -> { item, marker, listEl }
const entriesById = new Map();
const listEl = document.getElementById("site-list");
const resultCountEl = document.getElementById("result-count");

function setActiveListItem(id) {
    for (const entry of entriesById.values()) {
        entry.listEl.classList.toggle("active", entry.item.id === id);
    }
    const activeEntry = entriesById.get(id);
    if (activeEntry) {
        activeEntry.listEl.scrollIntoView({ block: "nearest" });
    }
}

for (const item of window.data) {
    const config = typeConfigFor(item.type);

    const marker = L.circleMarker([item.lat, item.long], {
        radius: 8,
        weight: 2,
        color: "#fff",
        fillColor: config.color,
        fillOpacity: 0.9,
        alt: item.id,
        title: item.title
    }).bindPopup(createPopupContent(item));

    marker.on("popupopen", () => setActiveListItem(item.id));

    const li = document.createElement("li");
    li.innerHTML = `<span class="site-swatch" style="background:${config.color}"></span>
        <span class="site-title">${item.title}</span>
        <span class="site-type">${config.label}</span>`;
    li.addEventListener("click", () => {
        clusterGroup.zoomToShowLayer(marker, () => {
            marker.openPopup();
            map.panTo(marker.getLatLng());
        });
    });

    listEl.appendChild(li);
    clusterGroup.addLayer(marker);
    entriesById.set(item.id, { item, marker, listEl: li });
}

// Legenda
const legend = L.control({ position: "bottomright" });
legend.onAdd = () => {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = Object.values(TYPE_CONFIG)
        .map(
            (config) =>
                `<div><span class="legend-swatch" style="background:${config.color}"></span>${config.label}</div>`
        )
        .join("");
    return div;
};
legend.addTo(map);

// Filtro por tipo
const typeFiltersEl = document.getElementById("type-filters");
const activeTypes = new Set(Object.keys(TYPE_CONFIG));

for (const [type, config] of Object.entries(TYPE_CONFIG)) {
    const id = `filter-${config.label.replace(/\s+/g, "-")}`;
    const label = document.createElement("label");
    label.className = "type-filter";
    label.innerHTML = `<input type="checkbox" id="${id}" checked> ${config.label}`;
    label.querySelector("input").addEventListener("change", (event) => {
        if (event.target.checked) {
            activeTypes.add(type);
        } else {
            activeTypes.delete(type);
        }
        applyFilters();
    });
    typeFiltersEl.appendChild(label);
}

// Busca
const searchInput = document.getElementById("site-search");
let searchDebounce;
searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(applyFilters, 150);
});

function applyFilters() {
    const query = normalize(searchInput.value.trim());
    let visibleCount = 0;

    for (const entry of entriesById.values()) {
        const { item, marker, listEl } = entry;
        const matchesType = activeTypes.has(item.type in TYPE_CONFIG ? item.type : "");
        const matchesSearch = query === "" || normalize(item.title).includes(query);
        const isVisible = matchesType && matchesSearch;

        if (isVisible) {
            visibleCount++;
            listEl.style.display = "";
            if (!clusterGroup.hasLayer(marker)) {
                clusterGroup.addLayer(marker);
            }
        } else {
            listEl.style.display = "none";
            if (clusterGroup.hasLayer(marker)) {
                clusterGroup.removeLayer(marker);
            }
        }
    }

    resultCountEl.textContent = `${visibleCount} de ${entriesById.size} sítios`;
}

applyFilters();

// Sidebar toggle (mobile)
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
sidebarToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
});
