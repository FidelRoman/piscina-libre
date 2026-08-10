// -------------------------------------------------------------
// PiscinaLibre - Mapa (Leaflet bajo demanda) y geolocalización
//
// Leaflet son ~150 KB entre CSS y JS que la mayoría de visitantes de
// móvil nunca llega a abrir, así que no entra en la carga inicial. Todo
// lo que dependa de `L` vive detrás de ensureMap().
// -------------------------------------------------------------

import { escapeHtml, getOpenStatus, parseRegisterInfo } from "./lib/pools-core.js";
import { icon } from "./lib/icons.js";
import { districtHue } from "./lib/card.js";
import { showToast, currentTheme, track, $, rel, isMobileView } from "./ui.js";
import { state, computeDistances, filterPools } from "./state.js";

const LIMA_CENTER = [-12.075, -77.048];
const LIMA_ZOOM = 12.5;

let map = null;
let tileLayer = null;
let mapMarkers = {};
let userLocationMarker = null;
let leafletPromise = null;
let mapReady = null;
let lastVisible = null;

export function getMap() { return map; }

// -------------------------------------------------------------
// Carga
// -------------------------------------------------------------
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

function setMapState(name) {
    const area = $("map-area-container");
    if (area) area.dataset.state = name;
}

export function ensureMap() {
    if (mapReady) return mapReady;
    setMapState("loading");
    mapReady = loadLeaflet().then(() => {
        initMap();
        rebuildMapMarkers();
        syncMarkersWithFilters(filterPools());
        setMapState("ready");
        showUserLocation();
        restoreGrantedLocation();
    }).catch(err => {
        // Un fallo de red puntual (unpkg caído, túnel de metro) no debe
        // dejar el mapa muerto para toda la sesión: se limpia la promesa
        // para que el botón de reintentar vuelva a intentarlo.
        mapReady = null;
        console.warn(err);
        setMapState("error");
        showToast("No pudimos cargar el mapa. Revisa tu conexión.", "error");
        throw err;
    });
    return mapReady;
}

// -------------------------------------------------------------
// Teselas
// -------------------------------------------------------------
function tileUrlFor(theme) {
    return theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
}

export function updateMapTiles(theme) {
    if (!map) return;
    if (tileLayer) map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(tileUrlFor(theme), {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20
    }).addTo(map);
}

// -------------------------------------------------------------
// Inicialización
// -------------------------------------------------------------
function initMap() {
    map = L.map("map", { zoomControl: false }).setView(LIMA_CENTER, LIMA_ZOOM);
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

    map.on("popupclose", clearCardHighlight);
}

// -------------------------------------------------------------
// Marcadores
// -------------------------------------------------------------
export function rebuildMapMarkers() {
    if (!map) return;
    Object.values(mapMarkers).forEach(marker => {
        if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    mapMarkers = {};

    state.pools.forEach(pool => {
        const customIcon = L.divIcon({
            className: "custom-leaflet-marker",
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -30],
            html: `<span class="marker-pin">${icon("waves")}</span>`
        });

        const marker = L.marker([pool.lat, pool.lng], { icon: customIcon, title: pool.name })
            .bindPopup(() => popupHTML(pool), {
                className: "custom-map-popup", offset: [0, -30],
                maxWidth: 280, minWidth: 240, autoPanPadding: [30, 30]
            })
            .addTo(map);

        // Leaflet ya deja el marcador enfocable con `keyboard: true` y
        // responde a Enter, pero no le pone nombre accesible.
        const el = marker.getElement();
        if (el) el.setAttribute("aria-label", `${pool.name}, ${pool.district}. Ver detalles en el mapa`);

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

    const registerUrl = parseRegisterInfo(pool.register).url;
    const reserveHtml = (pool.regType === "online" && registerUrl)
        ? `<a href="${escapeHtml(registerUrl)}" target="_blank" rel="noopener" class="popup-btn popup-btn-primary" data-track="reservar" data-pool="${escapeHtml(pool.name)}">Reservar ${icon("external-link")}</a>`
        : "";

    return `
        <div class="rich-tooltip">
            <div class="tooltip-img-wrapper" data-img-holder style="--district-hue:${districtHue(pool.district)}">
                <div class="tooltip-placeholder"><span>${escapeHtml(pool.district)}</span></div>
                ${pool.image
                    ? `<img src="${escapeHtml(pool.image)}" alt="" loading="lazy" decoding="async">`
                    : ``}
            </div>
            <div class="tooltip-info">
                <span class="tooltip-district">${escapeHtml(pool.district)}</span>
                <h3 class="tooltip-title">${escapeHtml(pool.name)}</h3>
                <div class="tooltip-foot">
                    <span class="tooltip-price">${pool.priceNum > 0 ? `S/ ${pool.priceNum.toFixed(2)}` : "Consultar"}</span>
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

export function syncMarkersWithFilters(visiblePools) {
    lastVisible = visiblePools;
    const fitBtn = $("map-fit-btn");
    // El botón solo tiene sentido cuando el filtro esconde marcadores y
    // queda más de uno al que encuadrar.
    if (fitBtn) fitBtn.hidden = !(visiblePools.length > 1 && visiblePools.length < state.pools.length);

    if (!map) return;
    const visible = new Set(visiblePools.map(p => p.id));
    state.pools.forEach(pool => {
        const marker = mapMarkers[pool.id];
        if (!marker) return;
        const shouldShow = visible.has(pool.id);
        if (shouldShow && !map.hasLayer(marker)) marker.addTo(map);
        if (!shouldShow && map.hasLayer(marker)) marker.remove();
    });
}

// Encuadra los resultados visibles; sin filtros, vuelve a toda Lima.
export function fitToVisible() {
    ensureMap().then(() => {
        const pools = lastVisible && lastVisible.length ? lastVisible : state.pools;
        if (pools.length < 2) {
            map.setView(LIMA_CENTER, LIMA_ZOOM, { animate: true });
            return;
        }
        map.fitBounds(L.latLngBounds(pools.map(p => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 15 });
    }).catch(() => { /* ya se avisó con un toast */ });
}

// -------------------------------------------------------------
// Geolocalización
// -------------------------------------------------------------
// silent: no avisar de los fallos. Se usa cuando la posición se pide sin
// que el visitante haya hecho nada (permiso ya concedido de una visita
// anterior): un error ahí no responde a ninguna acción suya.
export function requestPosition({ silent = false } = {}) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            if (!silent) showToast("La geolocalización no está soportada por tu navegador.", "error");
            reject(new Error("unsupported"));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                state.userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                computeDistances();
                // Sepa el visitante cómo llegó hasta aquí (el botón del mapa
                // o el orden por cercanía), en cuanto conocemos su posición
                // el mapa la muestra.
                showUserLocation();
                resolve(state.userPosition);
            },
            error => {
                let msg = "No pudimos obtener tu ubicación.";
                if (error.code === error.PERMISSION_DENIED) msg = "Permiso denegado. Habilita el acceso a la ubicación en tu navegador.";
                else if (error.code === error.POSITION_UNAVAILABLE) msg = "La señal de ubicación no está disponible en este momento.";
                else if (error.code === error.TIMEOUT) msg = "Se agotó el tiempo de espera para obtener la ubicación.";
                if (!silent) showToast(msg, "error");
                reject(error);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    });
}

// Punto de "estás aquí". Idempotente: si ya existe solo se mueve, así que
// puede llamarse desde cualquier sitio que consiga la posición sin
// preocuparse de duplicar el marcador. No hace nada si el mapa todavía no
// está montado; ensureMap() lo vuelve a intentar al terminar.
export function showUserLocation() {
    if (!map || !state.userPosition) return;
    const { lat, lng } = state.userPosition;

    if (userLocationMarker) {
        userLocationMarker.setLatLng([lat, lng]);
        return;
    }

    const userIcon = L.divIcon({
        className: "user-location-marker",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        html: '<div class="user-marker-pulse"></div>'
    });
    // Por encima de las piscinas y fuera del recorrido del tabulador: es
    // una referencia, no algo con lo que se interactúe.
    userLocationMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000, keyboard: false })
        .bindTooltip("Estás aquí", { direction: "top", offset: [0, -12], className: "custom-map-tooltip" })
        .addTo(map);
}

// Si el navegador ya tenía el permiso concedido de una visita anterior,
// la posición se puede leer sin enseñar ningún diálogo. Pedirlo de golpe
// al cargar sí sería intrusivo; aprovechar un permiso ya dado, no.
async function restoreGrantedLocation() {
    if (state.userPosition || !navigator.permissions) return;
    try {
        const status = await navigator.permissions.query({ name: "geolocation" });
        if (status.state !== "granted") return;
        await requestPosition({ silent: true });
    } catch (e) {
        // Navegador sin Permissions API o consulta rechazada: se espera a
        // que el visitante pulse el botón de ubicación.
    }
}

export async function locateUser() {
    const btn = document.querySelector(".leaflet-locate-btn");
    if (btn) btn.classList.add("locating");
    try {
        const { lat, lng } = state.userPosition || await requestPosition();
        await ensureMap();
        showUserLocation();
        map.setView([lat, lng], 14.5, { animate: true, duration: 0.8 });
    } finally {
        if (btn) btn.classList.remove("locating");
    }
}

// -------------------------------------------------------------
// Vista de mapa en móvil
// -------------------------------------------------------------
export function setMapView(show) {
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

export function focusPoolOnMap(poolId) {
    const pool = state.poolsById.get(poolId);
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

function clearCardHighlight() {
    document.querySelectorAll(".pool-card").forEach(card => card.classList.remove("active-highlight"));
}

export function highlightPoolCard(poolId) {
    clearCardHighlight();
    const card = $(`card-${poolId}`);
    if (card) card.classList.add("active-highlight");
}
