// -------------------------------------------------------------
// PiscinaLibre - Home (mapa + filtros)
//
// Las tarjetas ya vienen escritas en el HTML por el build, así que la
// página es legible y utilizable sin esperar a ninguna red. Este módulo
// añade el filtrado, el mapa (que se carga aparte, bajo demanda) y el
// estado en vivo de cada sede.
// -------------------------------------------------------------

import {
    escapeHtml, matchesScheduleFilter, getOpenStatus, parseSchedule,
    poolsFromCSV, distanceKm, formatDistance, DAY_LABELS_LONG, SHEET_URL
} from "./lib/pools-core.js";
import { poolCardHTML } from "./lib/card.js";
import { icon } from "./lib/icons.js";
import {
    initTheme, initTracking, onThemeChange, track, readEmbeddedPools,
    applyLiveStatus, showToast, sharePool, currentTheme
} from "./ui.js";

// -------------------------------------------------------------
// Estado
// -------------------------------------------------------------
const DEFAULT_FILTERS = {
    search: "",
    regType: "all",   // "all" | "online" | "presencial"
    district: "all",  // "all" | nombre del distrito
    day: "all",       // "all" | "0".."6"
    hour: "all",      // "all" | "5".."22"
    openNow: false
};

let poolsList = readEmbeddedPools();
let poolsById = new Map(poolsList.map(p => [p.id, p]));
let activeFilters = { ...DEFAULT_FILTERS };
let currentSort = "default";
let userPosition = null;   // { lat, lng } una vez concedida la geolocalización

// Mapa: todo lo de Leaflet vive detrás de ensureMap()
let map = null;
let tileLayer = null;
let mapMarkers = {};
let userLocationMarker = null;
let leafletPromise = null;
let mapReady = null;

const $ = (id) => document.getElementById(id);
const rel = () => document.body.dataset.rel || "";

// -------------------------------------------------------------
// Estado en la URL
// -------------------------------------------------------------
// Los filtros viven en la query string para que una vista filtrada se
// pueda compartir, enlazar desde las páginas de distrito y sobrevivir a
// una recarga.
function readFiltersFromURL() {
    const params = new URLSearchParams(location.search);
    const next = { ...DEFAULT_FILTERS };

    if (params.has("q")) next.search = params.get("q");
    if (params.has("reg")) next.regType = params.get("reg");
    if (params.has("distrito")) next.district = params.get("distrito");
    if (params.has("dia")) next.day = params.get("dia");
    if (params.has("hora")) next.hour = params.get("hora");
    next.openNow = params.get("ahora") === "1";

    let sort = params.get("orden") || "default";

    // Un distrito que ya no existe (sede retirada del Sheet) dejaría la
    // lista vacía sin explicación posible para el visitante
    if (next.district !== "all" && !poolsList.some(p => p.district === next.district)) {
        next.district = "all";
    }
    // "Más cercanas" necesita permiso de ubicación, que no se puede
    // heredar de un enlace: se pide cuando el usuario lo elige.
    if (sort === "distance") sort = "default";

    activeFilters = next;
    currentSort = sort;
}

function writeFiltersToURL({ push = false } = {}) {
    const params = new URLSearchParams();
    if (activeFilters.search) params.set("q", activeFilters.search);
    if (activeFilters.regType !== "all") params.set("reg", activeFilters.regType);
    if (activeFilters.district !== "all") params.set("distrito", activeFilters.district);
    if (activeFilters.day !== "all") params.set("dia", activeFilters.day);
    if (activeFilters.hour !== "all") params.set("hora", activeFilters.hour);
    if (activeFilters.openNow) params.set("ahora", "1");
    if (currentSort !== "default" && currentSort !== "distance") params.set("orden", currentSort);

    const qs = params.toString();
    const url = location.pathname + (qs ? "?" + qs : "") + location.hash;
    if (url === location.pathname + location.search + location.hash) return;

    // Los controles discretos (chips, selects) merecen una entrada de
    // historial; escribir en el buscador, no.
    if (push) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
}

// Vuelca activeFilters sobre los controles del DOM
function syncControlsFromState() {
    $("search-input").value = activeFilters.search;
    $("clear-search-btn").hidden = activeFilters.search === "";
    $("filter-day-select").value = activeFilters.day;
    $("filter-hour-select").value = activeFilters.hour;
    $("sort-select").value = currentSort;

    document.querySelectorAll(".filter-chip").forEach(chip => {
        const on = chip.dataset.filter === activeFilters.regType;
        chip.classList.toggle("active", on);
        chip.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll(".district-pill").forEach(pill => {
        const on = pill.dataset.district === activeFilters.district;
        pill.classList.toggle("active", on);
        pill.setAttribute("aria-pressed", String(on));
    });
    ["btn-filter-now-mobile", "btn-filter-now-map"].forEach(id => {
        const btn = $(id);
        btn.classList.toggle("active", activeFilters.openNow);
        btn.setAttribute("aria-pressed", String(activeFilters.openNow));
    });
}

// -------------------------------------------------------------
// Mapa (Leaflet bajo demanda)
// -------------------------------------------------------------
// Leaflet son ~150 KB entre CSS y JS que la mayoría de visitantes de
// móvil nunca llega a abrir, así que no entra en la carga inicial.
function loadLeaflet() {
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        css.crossOrigin = "";
        document.head.appendChild(css);

        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
        script.crossOrigin = "";
        script.onload = () => resolve(window.L);
        script.onerror = () => reject(new Error("No se pudo cargar Leaflet"));
        document.head.appendChild(script);
    });
    return leafletPromise;
}

function ensureMap() {
    if (mapReady) return mapReady;
    mapReady = loadLeaflet().then(() => {
        initMap();
        rebuildMapMarkers();
        syncMarkersWithFilters(filterPools());
    }).catch(err => {
        mapReady = null; // deja reintentar si fue un fallo de red puntual
        console.warn(err);
        showToast("No pudimos cargar el mapa. Revisa tu conexión.");
        throw err;
    });
    return mapReady;
}

function tileUrlFor(theme) {
    return theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
}

function updateMapTiles(theme) {
    if (!map) return;
    if (tileLayer) map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(tileUrlFor(theme), {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20
    }).addTo(map);
}

function initMap() {
    map = L.map("map", { zoomControl: false }).setView([-12.075, -77.048], 12.5);
    updateMapTiles(currentTheme());
    L.control.zoom({ position: "topright" }).addTo(map);

    const LocateControl = L.Control.extend({
        options: { position: "topright" },
        onAdd() {
            const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
            const button = L.DomUtil.create("a", "leaflet-locate-btn", container);
            button.innerHTML = icon("locate");
            button.href = "#";
            button.title = "Ir a mi ubicación actual";
            button.setAttribute("role", "button");
            button.setAttribute("aria-label", "Ir a mi ubicación actual");
            L.DomEvent.on(button, "click", (e) => {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault();
                locateUser().catch(() => { /* ya se avisó con un toast */ });
            });
            return container;
        }
    });
    map.addControl(new LocateControl());

    map.on("popupclose", () => {
        document.querySelectorAll(".pool-card").forEach(card => card.classList.remove("active-highlight"));
    });
}

function rebuildMapMarkers() {
    if (!map) return;
    Object.values(mapMarkers).forEach(marker => {
        if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    mapMarkers = {};

    poolsList.forEach(pool => {
        const customIcon = L.divIcon({
            className: "custom-leaflet-marker",
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -32],
            html: icon("waves")
        });

        const marker = L.marker([pool.lat, pool.lng], { icon: customIcon, title: pool.name })
            .bindPopup(() => popupHTML(pool), {
                className: "custom-map-popup", offset: [0, -30],
                maxWidth: 260, minWidth: 230, autoPanPadding: [30, 30]
            })
            .addTo(map);

        marker.on("popupopen", () => highlightPoolCard(pool.id));
        mapMarkers[pool.id] = marker;
    });
}

// El popup se genera al abrirlo, no al crear el marcador, para que el
// "Abierto ahora" sea el de este momento y no el de la carga de página.
function popupHTML(pool) {
    const status = getOpenStatus(pool.parsed);
    const statusHtml = status === true
        ? `<span class="tooltip-status open">Abierto ahora</span>`
        : (status === false ? `<span class="tooltip-status closed">Cerrado ahora</span>` : "");

    const reserveHtml = (pool.regType === "online" && pool.register.startsWith("http"))
        ? `<a href="${escapeHtml(pool.register)}" target="_blank" rel="noopener" class="popup-btn popup-btn-primary" data-track="reservar" data-pool="${escapeHtml(pool.name)}">Reservar ${icon("external-link")}</a>`
        : "";

    return `
        <div class="rich-tooltip">
            <div class="tooltip-img-wrapper">
                ${pool.image
                    ? `<img src="${escapeHtml(pool.image)}" alt="${escapeHtml(pool.name)}" loading="lazy" decoding="async">`
                    : `<div class="tooltip-placeholder"><span>${escapeHtml(pool.district)}</span></div>`}
            </div>
            <div class="tooltip-info">
                <span class="tooltip-district">${escapeHtml(pool.district)}</span>
                <h3 class="tooltip-title">${escapeHtml(pool.name)}</h3>
                <div class="tooltip-foot">
                    <span class="tooltip-price">${pool.priceNum > 0 ? `S/. ${pool.priceNum.toFixed(2)}` : "Consultar"}</span>
                    ${statusHtml}
                </div>
            </div>
            <div class="tooltip-actions${reserveHtml ? "" : " no-primary"}">
                ${reserveHtml}
                <a href="https://www.google.com/maps/search/?api=1&query=${pool.lat},${pool.lng}" target="_blank" rel="noopener" class="popup-btn popup-btn-icon" title="Abrir en Google Maps" aria-label="Abrir en Google Maps" data-track="navegar" data-pool="${escapeHtml(pool.name)}">${icon("navigation")}</a>
                <a href="https://waze.com/ul?ll=${pool.lat},${pool.lng}&navigate=yes" target="_blank" rel="noopener" class="popup-btn popup-btn-icon" title="Abrir en Waze" aria-label="Abrir en Waze" data-track="navegar" data-pool="${escapeHtml(pool.name)}">${icon("compass")}</a>
            </div>
            <a class="popup-view-list" href="${rel()}piscina/${pool.id}/">${icon("info")} Ver ficha completa</a>
        </div>`;
}

function syncMarkersWithFilters(visiblePools) {
    if (!map) return;
    const visible = new Set(visiblePools.map(p => p.id));
    poolsList.forEach(pool => {
        const marker = mapMarkers[pool.id];
        if (!marker) return;
        const shouldShow = visible.has(pool.id);
        if (shouldShow && !map.hasLayer(marker)) marker.addTo(map);
        if (!shouldShow && map.hasLayer(marker)) marker.remove();
    });
}

// -------------------------------------------------------------
// Filtrado y orden
// -------------------------------------------------------------
function filterPools() {
    const q = activeFilters.search.toLowerCase();
    return poolsList.filter(pool => {
        const matchesSearch = !q ||
            pool.name.toLowerCase().includes(q) ||
            pool.district.toLowerCase().includes(q) ||
            pool.address.toLowerCase().includes(q);

        return matchesSearch &&
            (activeFilters.regType === "all" || pool.regType === activeFilters.regType) &&
            (activeFilters.district === "all" || pool.district === activeFilters.district) &&
            matchesScheduleFilter(pool.parsed, activeFilters.day, activeFilters.hour) &&
            (!activeFilters.openNow || getOpenStatus(pool.parsed) === true);
    });
}

function sortPools(pools) {
    const sorted = [...pools];
    if (currentSort === "price-asc") {
        sorted.sort((a, b) => (a.priceNum || 9999) - (b.priceNum || 9999));
    } else if (currentSort === "price-desc") {
        sorted.sort((a, b) => b.priceNum - a.priceNum);
    } else if (currentSort === "name-asc") {
        sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
    } else if (currentSort === "distance" && userPosition) {
        sorted.sort((a, b) => (a._distance ?? Infinity) - (b._distance ?? Infinity));
    } else {
        // Por defecto, las que están abiertas ahora suben arriba
        sorted.sort((a, b) => (getOpenStatus(b.parsed) === true) - (getOpenStatus(a.parsed) === true));
    }
    return sorted;
}

function computeDistances() {
    if (!userPosition) return;
    poolsList.forEach(p => {
        p._distance = distanceKm(userPosition.lat, userPosition.lng, p.lat, p.lng);
    });
}

// -------------------------------------------------------------
// Filtros activos
// -------------------------------------------------------------
function activeFilterList() {
    const list = [];
    if (activeFilters.search) list.push({ key: "search", label: `“${activeFilters.search}”` });
    if (activeFilters.regType !== "all") {
        list.push({ key: "regType", label: activeFilters.regType === "online" ? "Registro online" : "Presencial" });
    }
    if (activeFilters.district !== "all") list.push({ key: "district", label: activeFilters.district });
    if (activeFilters.day !== "all") list.push({ key: "day", label: DAY_LABELS_LONG[parseInt(activeFilters.day, 10)] });
    if (activeFilters.hour !== "all") {
        const h = parseInt(activeFilters.hour, 10);
        const label = h === 12 ? "12:00 pm" : (h > 12 ? `${h - 12}:00 pm` : `${h}:00 am`);
        list.push({ key: "hour", label: `A las ${label}` });
    }
    if (activeFilters.openNow) list.push({ key: "openNow", label: "Abiertas ahora" });
    return list;
}

function clearFilter(key) {
    activeFilters[key] = DEFAULT_FILTERS[key];
    onFilterChange({ push: true });
}

function renderActiveFilters(list) {
    const container = $("active-filters");
    container.hidden = list.length === 0;
    if (!list.length) { container.innerHTML = ""; return; }
    container.innerHTML = `<span class="active-filters-label">Filtros:</span>` + list.map(f =>
        `<button type="button" class="active-filter-chip" data-clear-filter="${f.key}">
            <span>${escapeHtml(f.label)}</span>${icon("x", "chip-x")}
            <span class="sr-only">Quitar este filtro</span>
        </button>`
    ).join("");
}

function anyFilterActive() {
    return activeFilterList().length > 0 || currentSort !== "default";
}

// -------------------------------------------------------------
// Render
// -------------------------------------------------------------
function renderDistrictPills() {
    const counts = {};
    poolsList.forEach(p => { counts[p.district] = (counts[p.district] || 0) + 1; });
    const districts = Object.keys(counts).sort((a, b) => a.localeCompare(b, "es"));

    const isAll = activeFilters.district === "all";
    let html = `<button class="district-pill${isAll ? " active" : ""}" data-district="all" aria-pressed="${isAll}">Todos <span>${poolsList.length}</span></button>`;
    districts.forEach(dist => {
        const on = activeFilters.district === dist;
        html += `<button class="district-pill${on ? " active" : ""}" data-district="${escapeHtml(dist)}" aria-pressed="${on}">${escapeHtml(dist)} <span>${counts[dist]}</span></button>`;
    });
    $("district-pills-container").innerHTML = html;
}

function renderNoResultsActions(list) {
    // La etiqueta ya viene entrecomillada cuando hace falta (la búsqueda),
    // así que aquí no se vuelve a envolver
    $("no-results-actions").innerHTML = list.map(f =>
        `<button type="button" class="btn btn-secondary btn-inline" data-clear-filter="${f.key}">Quitar ${escapeHtml(f.label)}</button>`
    ).join("");
}

function renderPools() {
    const filtered = sortPools(filterPools());
    const listContainer = $("pools-list");
    const noResults = $("no-results");
    const n = filtered.length;

    $("results-count").textContent = `${n} ${n === 1 ? "piscina encontrada" : "piscinas encontradas"}`;

    const active = activeFilterList();
    renderActiveFilters(active);
    $("clear-filters-btn").hidden = !anyFilterActive();

    // La búsqueda tiene su propio botón de limpiar, así que no cuenta
    // para la insignia del panel de filtros
    const count = active.filter(f => f.key !== "search").length;
    ["filter-count-badge", "filter-count-badge-map"].forEach(id => {
        const badge = $(id);
        badge.textContent = count;
        badge.hidden = count === 0;
    });
    $("filters-toggle-btn").classList.toggle("has-filters", count > 0);
    $("sheet-apply-btn").textContent = `Ver ${n} ${n === 1 ? "piscina" : "piscinas"}`;

    syncMarkersWithFilters(filtered);

    if (n === 0) {
        listContainer.innerHTML = "";
        noResults.hidden = false;
        renderNoResultsActions(active);
        return;
    }
    noResults.hidden = true;

    listContainer.innerHTML = filtered.map(p => poolCardHTML(p, { rel: rel(), heading: 2 })).join("");
    applyLiveStatus(listContainer, poolsById);

    if (currentSort === "distance" && userPosition) {
        filtered.forEach(p => {
            if (p._distance == null) return;
            const card = $(`card-${p.id}`);
            const chip = card && card.querySelector("[data-distance-chip]");
            if (chip) {
                chip.textContent = `a ${formatDistance(p._distance)}`;
                chip.hidden = false;
            }
        });
    }
}

function onFilterChange({ push = false } = {}) {
    syncControlsFromState();
    writeFiltersToURL({ push });
    renderPools();
}

function resetAllFilters() {
    activeFilters = { ...DEFAULT_FILTERS };
    currentSort = "default";
    onFilterChange({ push: true });
    track("filtros_limpiados");
}

// -------------------------------------------------------------
// Geolocalización
// -------------------------------------------------------------
function requestPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            showToast("La geolocalización no está soportada por tu navegador.");
            reject(new Error("unsupported"));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                computeDistances();
                resolve(userPosition);
            },
            error => {
                let msg = "No pudimos obtener tu ubicación.";
                if (error.code === error.PERMISSION_DENIED) msg = "Permiso denegado. Habilita el acceso a la ubicación en tu navegador.";
                else if (error.code === error.POSITION_UNAVAILABLE) msg = "La señal de ubicación no está disponible en este momento.";
                else if (error.code === error.TIMEOUT) msg = "Se agotó el tiempo de espera para obtener la ubicación.";
                showToast(msg);
                reject(error);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    });
}

async function locateUser() {
    const btn = document.querySelector(".leaflet-locate-btn");
    if (btn) btn.classList.add("locating");
    try {
        const { lat, lng } = userPosition || await requestPosition();
        await ensureMap();
        map.setView([lat, lng], 14.5, { animate: true, duration: 0.8 });

        if (userLocationMarker) {
            userLocationMarker.setLatLng([lat, lng]);
        } else {
            const userIcon = L.divIcon({
                className: "user-location-marker",
                iconSize: [20, 20],
                iconAnchor: [10, 10],
                html: '<div class="user-marker-pulse"></div>'
            });
            userLocationMarker = L.marker([lat, lng], { icon: userIcon })
                .bindTooltip("Tu ubicación actual", { direction: "top", className: "custom-map-tooltip" })
                .addTo(map);
        }
    } finally {
        if (btn) btn.classList.remove("locating");
    }
}

async function sortByDistance() {
    const select = $("sort-select");
    select.disabled = true;
    try {
        if (!userPosition) await requestPosition();
        currentSort = "distance";
        renderPools();
        track("orden_cercania");
    } catch (e) {
        // Sin ubicación no hay orden por cercanía: se vuelve al anterior
        currentSort = "default";
        select.value = "default";
        renderPools();
    } finally {
        select.disabled = false;
    }
}

// -------------------------------------------------------------
// Vista de mapa en móvil
// -------------------------------------------------------------
function setMapView(show) {
    document.body.classList.toggle("show-map", show);
    const toggle = $("mobile-view-toggle-btn");
    toggle.querySelector(".toggle-content-list").hidden = show;
    toggle.querySelector(".toggle-content-map").hidden = !show;
    if (show) {
        ensureMap()
            .then(() => setTimeout(() => map.invalidateSize({ animate: true }), 60))
            .catch(() => { /* ya se avisó con un toast */ });
        track("ver_mapa");
    }
}

function focusPoolOnMap(poolId) {
    const pool = poolsById.get(poolId);
    if (!pool) return;
    highlightPoolCard(poolId);

    ensureMap().then(() => {
        const openIt = () => {
            map.setView([pool.lat, pool.lng], 14.5, { animate: true, duration: 0.8 });
            const marker = mapMarkers[poolId];
            if (marker) marker.openPopup();
        };
        if (isMobileView()) {
            setMapView(true);
            setTimeout(() => { map.invalidateSize(); openIt(); }, 120);
        } else {
            openIt();
        }
    }).catch(() => { /* ya se avisó con un toast */ });
}

function highlightPoolCard(poolId) {
    document.querySelectorAll(".pool-card").forEach(card => card.classList.remove("active-highlight"));
    const card = $(`card-${poolId}`);
    if (card) card.classList.add("active-highlight");
}

// -------------------------------------------------------------
// Panel de filtros
// -------------------------------------------------------------
function isMobileView() {
    return window.matchMedia("(max-width: 900px)").matches;
}

let sheetTrigger = null;
const FOCUSABLE = 'a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])';

// Con el panel abierto el backdrop tapa la página entera, así que el
// tabulador no debe poder salirse por detrás.
function trapFocus(e) {
    if (e.key !== "Tab" || !document.body.classList.contains("filters-sheet-open")) return;
    const sheet = $("filter-sheet");
    const items = [...sheet.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (!sheet.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

function setSheetTriggersExpanded(expanded) {
    ["filters-toggle-btn", "map-filters-btn"].forEach(id => {
        $(id).setAttribute("aria-expanded", String(expanded));
    });
}

function openFilterSheet(trigger) {
    sheetTrigger = trigger || $("filters-toggle-btn");
    document.body.classList.add("filters-sheet-open");
    setSheetTriggersExpanded(true);
    $("filter-sheet").setAttribute("aria-hidden", "false");
    // El panel no es enfocable hasta que termina de deslizarse
    // (--transition-smooth, 0.32 s)
    setTimeout(() => {
        if (document.body.classList.contains("filters-sheet-open")) $("sheet-close-btn").focus();
    }, 350);
}

function closeFilterSheet() {
    const sheet = $("filter-sheet");
    const hadFocusInside = sheet.contains(document.activeElement);
    document.body.classList.remove("filters-sheet-open");
    setSheetTriggersExpanded(false);
    sheet.setAttribute("aria-hidden", "true");
    if (hadFocusInside && sheetTrigger) sheetTrigger.focus();
    sheetTrigger = null;
}

// Mantiene el panel coherente al cruzar el breakpoint. En móvil se
// reparenta a .app-container: dentro de .controls-section queda atrapado
// en los contextos de apilamiento de .content-area/.controls-section y el
// backdrop fijo (contexto raíz) lo taparía. En escritorio vuelve a
// .controls-section, donde se ancla como desplegable.
function syncSheetForViewport() {
    const sheet = $("filter-sheet");
    const target = isMobileView()
        ? document.querySelector(".app-container")
        : document.querySelector(".controls-section");
    if (sheet.parentElement !== target) {
        target.appendChild(sheet);
        closeFilterSheet();
    }
    if (!document.body.classList.contains("filters-sheet-open")) {
        sheet.setAttribute("aria-hidden", "true");
    }
}

// -------------------------------------------------------------
// Refresco silencioso desde el Google Sheet
// -------------------------------------------------------------
// El HTML se regenera una vez al día. Esto recoge los cambios que el
// Sheet haya tenido desde entonces, sin bloquear nada: si falla, el
// visitante se queda con los datos del build, que son válidos.
function dataFingerprint(pools) {
    return pools.map(p => `${p.id}|${p.schedule}|${p.price}|${p.register}`).join("\n");
}

async function refreshFromSheet() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(SHEET_URL, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return;

        const csv = await res.text();
        if (csv.includes("<!DOCTYPE html>") || csv.includes("<html")) return;

        const fresh = poolsFromCSV(csv);
        if (!fresh.length) return;
        if (dataFingerprint(fresh) === dataFingerprint(poolsList)) return;

        // Los distritos que el build resolvió a mano (porque no se deducen
        // de la dirección) se conservan al refrescar.
        const knownDistricts = new Map(poolsList.map(p => [p.id, p.district]));
        fresh.forEach(p => {
            if (p.district === "Lima" && knownDistricts.has(p.id)) p.district = knownDistricts.get(p.id);
            p.parsed = parseSchedule(p.schedule);
        });

        poolsList = fresh;
        poolsById = new Map(fresh.map(p => [p.id, p]));
        computeDistances();
        renderDistrictPills();
        if (map) rebuildMapMarkers();
        renderPools();
    } catch (e) {
        // Sin conexión o Sheet caído: nos quedamos con los datos del build
    }
}

// -------------------------------------------------------------
// Eventos
// -------------------------------------------------------------
function setupEventListeners() {
    const searchInput = $("search-input");
    let searchTimer = null;

    searchInput.addEventListener("input", (e) => {
        activeFilters.search = e.target.value.trim();
        $("clear-search-btn").hidden = activeFilters.search === "";
        clearTimeout(searchTimer);
        // Se repinta al dejar de escribir: así el lector de pantalla no
        // anuncia un recuento nuevo en cada tecla.
        searchTimer = setTimeout(() => {
            writeFiltersToURL();
            renderPools();
        }, 220);
    });

    $("clear-search-btn").addEventListener("click", () => {
        activeFilters.search = "";
        onFilterChange({ push: true });
        searchInput.focus();
    });

    document.querySelectorAll(".filter-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            activeFilters.regType = chip.dataset.filter;
            onFilterChange({ push: true });
            track("filtro_usado", { filtro: "registro", valor: activeFilters.regType });
        });
    });

    $("district-pills-container").addEventListener("click", (e) => {
        const pill = e.target.closest(".district-pill");
        if (!pill) return;
        activeFilters.district = pill.dataset.district;
        onFilterChange({ push: true });
        track("filtro_usado", { filtro: "distrito", valor: activeFilters.district });
    });

    $("filter-day-select").addEventListener("change", (e) => {
        activeFilters.day = e.target.value;
        onFilterChange({ push: true });
        track("filtro_usado", { filtro: "dia", valor: activeFilters.day });
    });

    $("filter-hour-select").addEventListener("change", (e) => {
        activeFilters.hour = e.target.value;
        onFilterChange({ push: true });
        track("filtro_usado", { filtro: "hora", valor: activeFilters.hour });
    });

    $("sort-select").addEventListener("change", (e) => {
        if (e.target.value === "distance") { sortByDistance(); return; }
        currentSort = e.target.value;
        writeFiltersToURL({ push: true });
        renderPools();
    });

    ["btn-filter-now-mobile", "btn-filter-now-map"].forEach(id => {
        $(id).addEventListener("click", () => {
            activeFilters.openNow = !activeFilters.openNow;
            if (activeFilters.openNow) {
                // Un día u hora sueltos contradicen "abiertas ahora"
                activeFilters.day = "all";
                activeFilters.hour = "all";
            }
            onFilterChange({ push: true });
            track("filtro_usado", { filtro: "abiertas_ahora", valor: String(activeFilters.openNow) });
        });
    });

    $("reset-filters-btn").addEventListener("click", resetAllFilters);
    $("clear-filters-btn").addEventListener("click", resetAllFilters);
    $("sheet-clear-btn").addEventListener("click", resetAllFilters);

    // Quitar un filtro concreto, desde los chips o desde el estado vacío
    document.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-clear-filter]");
        if (btn) clearFilter(btn.dataset.clearFilter);
    });

    // Tarjetas: el mapa y el compartir son botones reales (accesibles con
    // teclado) y, además, la tarjeta entera responde al clic de puntero.
    $("pools-list").addEventListener("click", async (e) => {
        const card = e.target.closest("[data-pool-id]");
        if (!card) return;
        const poolId = card.dataset.poolId;

        if (e.target.closest("[data-map-btn]")) { focusPoolOnMap(poolId); return; }

        if (e.target.closest("[data-share-btn]")) {
            const pool = poolsById.get(poolId);
            const url = new URL(`${rel()}piscina/${poolId}/`, location.href).href;
            const result = await sharePool(pool, url);
            if (result === "copied") showToast("Enlace copiado al portapapeles.");
            else if (result === "failed") showToast("No pudimos compartir el enlace.");
            return;
        }

        // Cualquier otro enlace o botón hace lo suyo
        if (e.target.closest("a") || e.target.closest("button")) return;
        focusPoolOnMap(poolId);
    });

    $("mobile-view-toggle-btn").addEventListener("click", () => {
        setMapView(!document.body.classList.contains("show-map"));
    });

    $("filters-toggle-btn").addEventListener("click", (e) => {
        if (document.body.classList.contains("filters-sheet-open")) closeFilterSheet();
        else openFilterSheet(e.currentTarget);
    });
    $("map-filters-btn").addEventListener("click", (e) => openFilterSheet(e.currentTarget));
    $("sheet-close-btn").addEventListener("click", closeFilterSheet);
    $("sheet-apply-btn").addEventListener("click", closeFilterSheet);
    $("sheet-backdrop").addEventListener("click", closeFilterSheet);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("filters-sheet-open")) closeFilterSheet();
        else trapFocus(e);
    });

    // En escritorio es un desplegable: clicar fuera lo cierra
    document.addEventListener("click", (e) => {
        if (isMobileView() || !document.body.classList.contains("filters-sheet-open")) return;
        const sheet = $("filter-sheet");
        if (sheet.contains(e.target) || e.target.closest("#filters-toggle-btn")) return;
        closeFilterSheet();
    });

    window.addEventListener("resize", syncSheetForViewport);

    // Una pestaña en segundo plano (Cmd+clic, restaurar sesión) informa
    // innerWidth 0, así que al arrancar todo parece móvil. Cuando pasa a
    // primer plano hay que recolocar el panel con las medidas reales.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") syncSheetForViewport();
    });

    // Atrás / adelante entre estados de filtro
    window.addEventListener("popstate", () => {
        readFiltersFromURL();
        renderDistrictPills();
        syncControlsFromState();
        renderPools();
    });

    onThemeChange(updateMapTiles);
    hideFabsOverFooter();
}

// En móvil los botones flotantes se quedan encima del pie, que es
// justo donde viven las llamadas a la acción. Mientras el pie está a la
// vista se apartan; vuelven en cuanto se sube.
function hideFabsOverFooter() {
    const footer = document.querySelector(".main-footer");
    if (!footer || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(
        ([entry]) => document.body.classList.toggle("footer-in-view", entry.isIntersecting),
        { rootMargin: "0px 0px -40px 0px" }
    ).observe(footer);
}

// -------------------------------------------------------------
// Arranque
// -------------------------------------------------------------
// En escritorio el mapa se ve desde el principio, así que conviene
// tenerlo listo; en móvil vive detrás de un botón y no se carga hasta
// que se pide. Dos detalles que parecen menores y no lo son:
//   · en una pestaña oculta el navegador nunca reporta tiempo ocioso, de
//     ahí el `timeout` de requestIdleCallback;
//   · y tampoco reporta un ancho real, así que la decisión móvil/escritorio
//     se aplaza hasta que la pestaña se ve.
function scheduleDesktopMapPreload() {
    if (document.visibilityState === "hidden") {
        document.addEventListener("visibilitychange", function onVisible() {
            if (document.visibilityState === "hidden") return;
            document.removeEventListener("visibilitychange", onVisible);
            scheduleDesktopMapPreload();
        });
        return;
    }
    if (isMobileView()) return;

    const loadMap = () => ensureMap().catch(() => { /* ya se avisó con un toast */ });
    if (window.requestIdleCallback) window.requestIdleCallback(loadMap, { timeout: 1500 });
    else setTimeout(loadMap, 600);
}

function init() {
    initTheme();
    initTracking();

    readFiltersFromURL();
    renderDistrictPills();
    syncControlsFromState();
    setupEventListeners();
    syncSheetForViewport();
    renderPools();

    scheduleDesktopMapPreload();
    refreshFromSheet();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
