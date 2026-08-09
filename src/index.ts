const TYPE_CONFIG = {
    "Cerrito": { color: "#a0522d", label: "Cerrito" },
    "Sítio sobre dunas": { color: "#1f6feb", label: "Sítio sobre dunas" },
    "Cerrito/Sítio sobre dunas": { color: "#8e44ad", label: "Cerrito/Sítio sobre dunas" },
    "": { color: "#6b7280", label: "Não especificado" }
};

type SiteType = keyof typeof TYPE_CONFIG;

function typeConfigFor(type: SiteType) {
    return TYPE_CONFIG[type] || TYPE_CONFIG[""];
}

function normalize(str: string): string {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function assertDataIntegrity(sites: Site[], references: Record<string, Reference>): void {
    const seenIds = new Set<number>();
    const duplicateIds = new Set<number>();
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
const plainGroup = L.layerGroup();
let clusteringEnabled = true;
let activeGroup: L.LayerGroup = clusterGroup;
map.addLayer(activeGroup);

function setClusteringEnabled(enabled: boolean): void {
    if (enabled === clusteringEnabled) {
        return;
    }
    const newGroup = enabled ? clusterGroup : plainGroup;
    const oldGroup = activeGroup;
    for (const entry of entriesById.values()) {
        if (oldGroup.hasLayer(entry.marker)) {
            oldGroup.removeLayer(entry.marker);
            newGroup.addLayer(entry.marker);
        }
    }
    map.removeLayer(oldGroup);
    map.addLayer(newGroup);
    activeGroup = newGroup;
    clusteringEnabled = enabled;
}

function createRefList(refs: Record<string, string>): string {
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

function createPopupContent(item: Site): string {
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

interface Entry {
    item: Site;
    marker: L.CircleMarker;
    listEl: HTMLLIElement;
    baseColor: string;
    baseWeight: number;
}

const SELECTED_MARKER_COLOR = "#e11d48";
const SELECTED_MARKER_WEIGHT = 4;

// id -> { item, marker, listEl, baseColor, baseWeight }
const entriesById = new Map<number, Entry>();
const listEl = document.getElementById("site-list") as HTMLUListElement;
const resultCountEl = document.getElementById("result-count") as HTMLElement;

function setActiveListItem(id: number | null): void {
    for (const entry of entriesById.values()) {
        const isSelected = entry.item.id === id;
        entry.listEl.classList.toggle("active", isSelected);
        if (isSelected) {
            entry.marker.setStyle({ color: SELECTED_MARKER_COLOR, weight: SELECTED_MARKER_WEIGHT });
            entry.marker.bringToFront();
        } else {
            entry.marker.setStyle({ color: entry.baseColor, weight: entry.baseWeight });
        }
    }
    if (id !== null) {
        const activeEntry = entriesById.get(id);
        if (activeEntry) {
            activeEntry.listEl.scrollIntoView({ block: "nearest" });
        }
    }
}

const sitePanel = document.getElementById("site-panel") as HTMLElement;
const sitePanelContent = document.getElementById("site-panel-content") as HTMLElement;
const sitePanelClose = document.getElementById("site-panel-close") as HTMLElement;

function openSitePanel(item: Site): void {
    sitePanelContent.innerHTML = createPopupContent(item);
    sitePanel.classList.add("open");
    sitePanel.setAttribute("aria-hidden", "false");
    setActiveListItem(item.id);
}

function closeSitePanel(): void {
    sitePanel.classList.remove("open");
    sitePanel.setAttribute("aria-hidden", "true");
    setActiveListItem(null);
}

sitePanelClose.addEventListener("click", closeSitePanel);

for (const item of window.data) {
    const config = typeConfigFor(item.type);
    const refCount = Object.keys(item.refs).length;
    const hasDatacao = Boolean(item.datacao);
    const baseColor = hasDatacao ? "#d4a017" : "#fff";
    const baseWeight = hasDatacao ? 3 : 2;

    const marker = L.circleMarker([item.lat, item.long], {
        radius: 8,
        weight: baseWeight,
        color: baseColor,
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
        if (clusteringEnabled) {
            clusterGroup.zoomToShowLayer(marker, () => {
                openSitePanel(item);
                map.panTo(marker.getLatLng());
            });
        } else {
            map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
            openSitePanel(item);
        }
    });

    listEl.appendChild(li);
    activeGroup.addLayer(marker);
    entriesById.set(item.id, { item, marker, listEl: li, baseColor, baseWeight });
}

// Legenda
const legend = L.control({ position: "bottomright" });
legend.onAdd = () => {
    const div = L.DomUtil.create("div", "legend");
    const typeItems = Object.values(TYPE_CONFIG)
        .map(
            (config) =>
                `<div><span class="legend-swatch" style="background:${config.color}"></span>${config.label}</div>`
        )
        .join("");
    const datacaoItem = `<div><span class="legend-swatch legend-swatch-outline"></span>Datação por C14</div>`;
    div.innerHTML = typeItems + datacaoItem;
    return div;
};
legend.addTo(map);

// Filtro por tipo
const typeFiltersEl = document.getElementById("type-filters") as HTMLElement;
const activeTypes = new Set<SiteType>(Object.keys(TYPE_CONFIG) as SiteType[]);

for (const [type, config] of Object.entries(TYPE_CONFIG) as [SiteType, { color: string; label: string }][]) {
    const id = `filter-${config.label.replace(/\s+/g, "-")}`;
    const label = document.createElement("label");
    label.className = "type-filter";
    label.innerHTML = `<input type="checkbox" id="${id}" checked> ${config.label}`;
    label.querySelector("input")!.addEventListener("change", (event) => {
        if ((event.target as HTMLInputElement).checked) {
            activeTypes.add(type);
        } else {
            activeTypes.delete(type);
        }
        applyFilters();
    });
    typeFiltersEl.appendChild(label);
}

// Filtro por fonte bibliográfica
const sourceFiltersEl = document.getElementById("source-filters") as HTMLElement;
const allRefIds: string[] = [];
for (const item of window.data) {
    for (const refId of Object.keys(item.refs)) {
        if (!allRefIds.includes(refId)) {
            allRefIds.push(refId);
        }
    }
}
allRefIds.sort((a, b) => Number(a) - Number(b));
const activeRefs = new Set<string>(allRefIds);

for (const refId of allRefIds) {
    const refLabel = window.references[refId].label;
    const id = `filter-source-${refId}`;
    const label = document.createElement("label");
    label.className = "type-filter";
    label.innerHTML = `<input type="checkbox" id="${id}" checked> ${refLabel}`;
    label.querySelector("input")!.addEventListener("change", (event) => {
        if ((event.target as HTMLInputElement).checked) {
            activeRefs.add(refId);
        } else {
            activeRefs.delete(refId);
        }
        applyFilters();
    });
    sourceFiltersEl.appendChild(label);
}

// Busca
const searchInput = document.getElementById("site-search") as HTMLInputElement;
let searchDebounce: number | undefined;
searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(applyFilters, 150);
});

function applyFilters(): void {
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
            if (!activeGroup.hasLayer(marker)) {
                activeGroup.addLayer(marker);
            }
        } else {
            listEl.style.display = "none";
            if (activeGroup.hasLayer(marker)) {
                activeGroup.removeLayer(marker);
            }
        }
    }

    resultCountEl.textContent = `${visibleCount} de ${entriesById.size} sítios`;
}

applyFilters();

// Sidebar toggle (mobile)
const sidebar = document.getElementById("sidebar") as HTMLElement;
const sidebarToggle = document.getElementById("sidebar-toggle") as HTMLElement;
sidebarToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
});

// Modal de opções
const optionsToggle = document.getElementById("options-toggle") as HTMLElement;
const optionsModal = document.getElementById("options-modal") as HTMLElement;
const optionsModalBackdrop = document.getElementById("options-modal-backdrop") as HTMLElement;
const optionsModalClose = document.getElementById("options-modal-close") as HTMLElement;
const clusteringToggle = document.getElementById("clustering-toggle") as HTMLInputElement;

function openOptionsModal(): void {
    optionsModal.classList.add("open");
    optionsModal.setAttribute("aria-hidden", "false");
    optionsModalBackdrop.classList.add("open");
}

function closeOptionsModal(): void {
    optionsModal.classList.remove("open");
    optionsModal.setAttribute("aria-hidden", "true");
    optionsModalBackdrop.classList.remove("open");
}

optionsToggle.addEventListener("click", openOptionsModal);
optionsModalClose.addEventListener("click", closeOptionsModal);
optionsModalBackdrop.addEventListener("click", closeOptionsModal);

clusteringToggle.addEventListener("change", (event) => {
    setClusteringEnabled((event.target as HTMLInputElement).checked);
});
