"use strict";
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
function assertDataIntegrity(sites, references) {
    const seenIds = new Set();
    const duplicateIds = new Set();
    for (const site of sites) {
        if (seenIds.has(site.id)) {
            duplicateIds.add(site.id);
        }
        seenIds.add(site.id);
    }
    if (duplicateIds.size > 0) {
        throw new Error(`Sítios com id duplicado: ${[...duplicateIds].join(", ")}`);
    }
    for (const site of sites) {
        for (const refId of Object.keys(site.refs)) {
            if (!(refId in references)) {
                throw new Error(`Sítio ${site.id} ("${site.title}") referencia fonte inexistente: ${refId}`);
            }
        }
    }
}
assertDataIntegrity(window.data, window.references);
const map = L.map("map").setView([-31.946931, -52.219278], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
}).addTo(map);
const clusterGroup = L.markerClusterGroup();
map.addLayer(clusterGroup);
function createRefList(refs) {
    let listItems = "";
    for (const refId in refs) {
        const meta = window.references[refId];
        const label = meta.label;
        const metaHtml = `<br><span class="ref-meta">${meta.institution} · ${meta.period}</span>
               <br><span class="ref-citation">${meta.citation}</span>`;
        listItems += `<li>
                        <b>${label}:</b> ${refs[refId]}
                        ${metaHtml}
                    </li>`;
    }
    return listItems;
}
function createPopupContent(item) {
    const refList = createRefList(item.refs);
    const typeLabel = typeConfigFor(item.type).label;
    const refCount = Object.keys(item.refs).length;
    const datacaoHtml = item.datacao
        ? `<p class="site-datacao">Datação (C14): ${item.datacao}</p>`
        : "";
    return `
        <h3>${item.title}</h3>
        <p>${typeLabel}</p>
        <p>Latitude: ${item.lat}</p>
        <p>Longitude: ${item.long}</p>
        ${datacaoHtml}
        <p>Referências (${refCount} fonte${refCount === 1 ? "" : "s"}):</p>
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
const sitePanel = document.getElementById("site-panel");
const sitePanelContent = document.getElementById("site-panel-content");
const sitePanelClose = document.getElementById("site-panel-close");
const sitePanelBackdrop = document.getElementById("site-panel-backdrop");
function openSitePanel(item) {
    sitePanelContent.innerHTML = createPopupContent(item);
    sitePanel.classList.add("open");
    sitePanel.setAttribute("aria-hidden", "false");
    sitePanelBackdrop.classList.add("open");
    setActiveListItem(item.id);
}
function closeSitePanel() {
    sitePanel.classList.remove("open");
    sitePanel.setAttribute("aria-hidden", "true");
    sitePanelBackdrop.classList.remove("open");
}
sitePanelClose.addEventListener("click", closeSitePanel);
sitePanelBackdrop.addEventListener("click", closeSitePanel);
for (const item of window.data) {
    const config = typeConfigFor(item.type);
    const refCount = Object.keys(item.refs).length;
    const hasDatacao = Boolean(item.datacao);
    const marker = L.circleMarker([item.lat, item.long], {
        radius: Math.min(6 + (refCount - 1) * 2, 14),
        weight: hasDatacao ? 3 : 2,
        color: hasDatacao ? "#d4a017" : "#fff",
        fillColor: config.color,
        fillOpacity: 0.9
    });
    marker.on("click", () => openSitePanel(item));
    const li = document.createElement("li");
    li.innerHTML = `<span class="site-swatch" style="background:${config.color}"></span>
        <span class="site-title">${item.title}</span>
        <span class="site-type">${config.label}</span>
        <span class="site-refcount" title="${refCount} fonte${refCount === 1 ? "" : "s"} bibliográfica${refCount === 1 ? "" : "s"}">${refCount}×</span>`;
    li.addEventListener("click", () => {
        clusterGroup.zoomToShowLayer(marker, () => {
            openSitePanel(item);
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
    const typeItems = Object.values(TYPE_CONFIG)
        .map((config) => `<div><span class="legend-swatch" style="background:${config.color}"></span>${config.label}</div>`)
        .join("");
    const datacaoItem = `<div><span class="legend-swatch legend-swatch-outline"></span>Datação por C14</div>`;
    const refCountItem = `<div class="legend-note">Tamanho do marcador = nº de fontes bibliográficas</div>`;
    div.innerHTML = typeItems + datacaoItem + refCountItem;
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
        }
        else {
            activeTypes.delete(type);
        }
        applyFilters();
    });
    typeFiltersEl.appendChild(label);
}
// Filtro por fonte bibliográfica
const sourceFiltersEl = document.getElementById("source-filters");
const allRefIds = [];
for (const item of window.data) {
    for (const refId of Object.keys(item.refs)) {
        if (!allRefIds.includes(refId)) {
            allRefIds.push(refId);
        }
    }
}
allRefIds.sort((a, b) => Number(a) - Number(b));
const activeRefs = new Set(allRefIds);
for (const refId of allRefIds) {
    const refLabel = window.references[refId].label;
    const id = `filter-source-${refId}`;
    const label = document.createElement("label");
    label.className = "type-filter";
    label.innerHTML = `<input type="checkbox" id="${id}" checked> ${refLabel}`;
    label.querySelector("input").addEventListener("change", (event) => {
        if (event.target.checked) {
            activeRefs.add(refId);
        }
        else {
            activeRefs.delete(refId);
        }
        applyFilters();
    });
    sourceFiltersEl.appendChild(label);
}
// Busca
const searchInput = document.getElementById("site-search");
let searchDebounce;
searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(applyFilters, 150);
});
function applyFilters() {
    const query = normalize(searchInput.value.trim());
    let visibleCount = 0;
    for (const entry of entriesById.values()) {
        const { item, marker, listEl } = entry;
        const matchesType = activeTypes.has(item.type in TYPE_CONFIG ? item.type : "");
        const matchesSource = Object.keys(item.refs).some((ref) => activeRefs.has(ref));
        const matchesSearch = query === "" || normalize(item.title).includes(query);
        const isVisible = matchesType && matchesSource && matchesSearch;
        if (isVisible) {
            visibleCount++;
            listEl.style.display = "";
            if (!clusterGroup.hasLayer(marker)) {
                clusterGroup.addLayer(marker);
            }
        }
        else {
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
