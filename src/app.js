// -------------------------------------------------------------
// PiscinaLibre - Home (mapa + filtros)
//
// Las tarjetas ya vienen escritas en el HTML por el build, así que la
// página es legible y utilizable sin esperar a ninguna red. Este módulo
// solo orquesta: el estado vive en state.js, el mapa en map.js y los
// controles de filtro en filters.js.
// -------------------------------------------------------------

import {
    parseSchedule, poolsFromCSV, formatDistance, SHEET_URL
} from "./lib/pools-core.js";
import { poolCardHTML } from "./lib/card.js";
import { icon } from "./lib/icons.js";
import {
    initTheme, initTracking, initImageFallback, onThemeChange, track,
    readEmbeddedPools, applyLiveStatus, showToast, sharePool,
    $, rel, isMobileView
} from "./ui.js";
import {
    state, DEFAULT_FILTERS, SORT_LABELS, setPools, readFiltersFromURL,
    writeFiltersToURL, filterPools, sortPools, activeFilterList, anyFilterActive
} from "./state.js";
import {
    ensureMap, updateMapTiles, rebuildMapMarkers, syncMarkersWithFilters,
    fitToVisible, requestPosition, setMapView, focusPoolOnMap
} from "./map.js";
import {
    syncControlsFromState, renderDistrictPills, renderActiveFilters,
    renderNoResultsActions, renderFilterCount, openFilterSheet,
    closeFilterSheet, syncSheetForViewport, trapFocus, isSheetOpen
} from "./filters.js";

// -------------------------------------------------------------
// Render
// -------------------------------------------------------------
// animate: solo en cambios discretos (un chip, un distrito, un select).
// Al escribir en el buscador se repinta cada 220 ms y animarlo marea.
function renderPools({ animate = false } = {}) {
    const filtered = sortPools(filterPools());
    const listContainer = $("pools-list");
    const noResults = $("no-results");
    const n = filtered.length;

    // El orden ya se ve en el desplegable de al lado, así que en pantalla
    // sobra; al lector de pantalla, que anuncia este bloque al cambiar los
    // filtros, sí le hace falta para saber qué está leyendo.
    const orden = SORT_LABELS[state.sort] || "";
    $("results-count").innerHTML =
        `${n} ${n === 1 ? "piscina encontrada" : "piscinas encontradas"}` +
        (orden ? `<span class="sr-only">, ${orden}</span>` : "");

    const active = activeFilterList();
    renderActiveFilters(active);
    $("clear-filters-btn").hidden = !anyFilterActive();

    // La búsqueda tiene su propio botón de limpiar, así que no cuenta
    // para la insignia del panel de filtros
    renderFilterCount(active.filter(f => f.key !== "search").length);
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
    applyLiveStatus(listContainer, state.poolsById);
    if (animate) replayListTransition(listContainer);

    if (state.sort === "distance" && state.userPosition) {
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

// Reinicia la animación de entrada de la lista. Hay que forzar un
// reflow: quitar y volver a poner la clase en el mismo fotograma no
// reinicia nada.
function replayListTransition(listContainer) {
    listContainer.classList.remove("is-repainting");
    void listContainer.offsetWidth;
    listContainer.classList.add("is-repainting");
}

function onFilterChange({ push = false, animate = true } = {}) {
    syncControlsFromState();
    writeFiltersToURL({ push });
    renderPools({ animate });
}

function clearFilter(key) {
    state.filters[key] = DEFAULT_FILTERS[key];
    onFilterChange({ push: true });
}

function resetAllFilters() {
    state.filters = { ...DEFAULT_FILTERS };
    state.sort = "default";
    onFilterChange({ push: true });
    track("filtros_limpiados");
}

async function sortByDistance() {
    const select = $("sort-select");
    select.disabled = true;
    try {
        if (!state.userPosition) await requestPosition();
        state.sort = "distance";
        renderPools({ animate: true });
        syncControlsFromState();
        track("orden_cercania");
    } catch (e) {
        // Sin ubicación no hay orden por cercanía: se vuelve al anterior
        state.sort = "default";
        select.value = "default";
        renderPools();
    } finally {
        select.disabled = false;
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

let lastCheck = null;

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

        // Llegó respuesta buena del Sheet: los datos están verificados,
        // hayan cambiado o no.
        lastCheck = Date.now();
        renderFreshness();

        if (dataFingerprint(fresh) === dataFingerprint(state.pools)) return;

        // Los distritos que el build resolvió a mano (porque no se deducen
        // de la dirección) se conservan al refrescar.
        const knownDistricts = new Map(state.pools.map(p => [p.id, p.district]));
        fresh.forEach(p => {
            if (p.district === "Lima" && knownDistricts.has(p.id)) p.district = knownDistricts.get(p.id);
            p.parsed = parseSchedule(p.schedule);
        });

        setPools(fresh);
        renderDistrictPills();
        rebuildMapMarkers();
        renderPools();
    } catch (e) {
        // Sin conexión o Sheet caído: nos quedamos con los datos del build
    }
}

function renderFreshness() {
    const el = $("data-freshness");
    if (!el || lastCheck === null) return;
    const mins = Math.floor((Date.now() - lastCheck) / 60000);
    el.textContent = mins < 1 ? "Datos verificados ahora" : `Datos verificados hace ${mins} min`;
    el.hidden = false;
}

// -------------------------------------------------------------
// Eventos
// -------------------------------------------------------------
function setupEventListeners() {
    const searchInput = $("search-input");
    let searchTimer = null;

    searchInput.addEventListener("input", (e) => {
        state.filters.search = e.target.value.trim();
        $("clear-search-btn").hidden = state.filters.search === "";
        clearTimeout(searchTimer);
        // Se repinta al dejar de escribir: así el lector de pantalla no
        // anuncia un recuento nuevo en cada tecla.
        searchTimer = setTimeout(() => {
            writeFiltersToURL();
            renderPools();
        }, 220);
    });

    $("clear-search-btn").addEventListener("click", () => {
        state.filters.search = "";
        onFilterChange({ push: true });
        searchInput.focus();
    });

    document.querySelectorAll(".filter-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            state.filters.regType = chip.dataset.filter;
            onFilterChange({ push: true });
            track("filtro_usado", { filtro: "registro", valor: state.filters.regType });
        });
    });

    $("district-pills-container").addEventListener("click", (e) => {
        const pill = e.target.closest(".district-pill");
        if (!pill) return;
        state.filters.district = pill.dataset.district;
        onFilterChange({ push: true });
        track("filtro_usado", { filtro: "distrito", valor: state.filters.district });
    });

    $("filter-day-select").addEventListener("change", (e) => {
        state.filters.day = e.target.value;
        onFilterChange({ push: true });
        track("filtro_usado", { filtro: "dia", valor: state.filters.day });
    });

    $("filter-hour-select").addEventListener("change", (e) => {
        state.filters.hour = e.target.value;
        onFilterChange({ push: true });
        track("filtro_usado", { filtro: "hora", valor: state.filters.hour });
    });

    $("sort-select").addEventListener("change", (e) => {
        if (e.target.value === "distance") { sortByDistance(); return; }
        state.sort = e.target.value;
        writeFiltersToURL({ push: true });
        renderPools({ animate: true });
    });

    // Un botón en la barra de filtros y otro sobre el mapa
    document.querySelectorAll('[data-action="filter-now"]').forEach(btn => {
        btn.addEventListener("click", () => {
            state.filters.openNow = !state.filters.openNow;
            if (state.filters.openNow) {
                // Un día u hora sueltos contradicen "abiertas ahora"
                state.filters.day = "all";
                state.filters.hour = "all";
            }
            onFilterChange({ push: true });
            track("filtro_usado", { filtro: "abiertas_ahora", valor: String(state.filters.openNow) });
        });
    });

    $("btn-near-me").addEventListener("click", sortByDistance);

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
            const pool = state.poolsById.get(poolId);
            const url = new URL(`${rel()}piscina/${poolId}/`, location.href).href;
            const result = await sharePool(pool, url);
            if (result === "copied") showToast("Enlace copiado al portapapeles.", "success");
            else if (result === "failed") showToast("No pudimos compartir el enlace.", "error");
            return;
        }

        // Cualquier otro enlace o botón hace lo suyo
        if (e.target.closest("a") || e.target.closest("button")) return;
        focusPoolOnMap(poolId);
    });

    $("mobile-view-toggle-btn").addEventListener("click", () => {
        setMapView(!document.body.classList.contains("show-map"));
    });

    $("map-fit-btn").addEventListener("click", fitToVisible);
    $("map-retry-btn").addEventListener("click", () => {
        ensureMap().catch(() => { /* ya se avisó con un toast */ });
    });

    $("filters-toggle-btn").addEventListener("click", (e) => {
        if (isSheetOpen()) closeFilterSheet();
        else openFilterSheet(e.currentTarget);
    });
    $("map-filters-btn").addEventListener("click", (e) => openFilterSheet(e.currentTarget));
    $("sheet-close-btn").addEventListener("click", closeFilterSheet);
    $("sheet-apply-btn").addEventListener("click", closeFilterSheet);
    $("sheet-backdrop").addEventListener("click", closeFilterSheet);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (isSheetOpen()) { closeFilterSheet(); return; }
            // Esc dentro del buscador lo vacía, como en cualquier campo de
            // búsqueda nativo
            if (document.activeElement === searchInput && state.filters.search) {
                state.filters.search = "";
                onFilterChange({ push: true });
            }
            return;
        }

        // "/" para saltar al buscador, salvo si ya se está escribiendo
        if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isFormField(e.target)) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
            return;
        }

        trapFocus(e);
    });

    // En escritorio es un desplegable: clicar fuera lo cierra
    document.addEventListener("click", (e) => {
        if (isMobileView() || !isSheetOpen()) return;
        const sheet = $("filter-sheet");
        if (sheet.contains(e.target) || e.target.closest("#filters-toggle-btn")) return;
        closeFilterSheet();
    });

    window.addEventListener("resize", () => {
        syncSheetForViewport();
        // Al ensanchar hasta escritorio el mapa pasa a estar a la vista. Si
        // la página arrancó en ancho de móvil, la precarga se saltó y sin
        // esto el área se quedaría vacía hasta que alguien la tocara.
        scheduleDesktopMapPreload();
    });

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
    watchScroll();
    hideFabsOverFooter();
}

function isFormField(el) {
    return el instanceof HTMLElement &&
        (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

// La cabecera se despega con una sombra y desenfoque en cuanto la lista
// empieza a pasar por debajo. En escritorio el que desplaza es
// .content-area; en móvil, la ventana.
function watchScroll() {
    const area = document.querySelector(".content-area");
    const update = () => {
        const y = isMobileView() ? window.scrollY : (area ? area.scrollTop : 0);
        document.body.classList.toggle("is-scrolled", y > 8);
    };
    if (area) area.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    update();
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
// Se llama también en cada `resize`, así que lleva pestillo: sin él se
// encolaría un requestIdleCallback por cada píxel que se arrastra el borde
// de la ventana. Ojo: el pestillo NO se echa en el caso móvil, porque ahí
// justamente queremos volver a intentarlo si la ventana se ensancha.
let mapPreloadScheduled = false;

function scheduleDesktopMapPreload() {
    if (mapPreloadScheduled) return;

    if (document.visibilityState === "hidden") {
        mapPreloadScheduled = true;
        document.addEventListener("visibilitychange", function onVisible() {
            if (document.visibilityState === "hidden") return;
            document.removeEventListener("visibilitychange", onVisible);
            mapPreloadScheduled = false;
            scheduleDesktopMapPreload();
        });
        return;
    }
    if (isMobileView()) return;   // sin echar el pestillo: al ensanchar se reintenta

    mapPreloadScheduled = true;
    const loadMap = () => ensureMap().catch(() => { /* ya se avisó con un toast */ });
    if (window.requestIdleCallback) window.requestIdleCallback(loadMap, { timeout: 1500 });
    else setTimeout(loadMap, 600);
}

// Sin datos no hay nada que filtrar y una lista vacía sin explicación
// parece un sitio roto. Mejor decirlo y ofrecer recargar.
function showLoadError() {
    const listContainer = $("pools-list");
    listContainer.innerHTML = `
        <div class="load-error" role="alert">
            ${icon("circle-alert", "load-error-icon")}
            <h2>No pudimos cargar el listado</h2>
            <p>Los datos de esta página no se leyeron bien. Recargar suele bastar.</p>
            <button type="button" class="btn btn-primary" id="reload-btn">${icon("refresh-cw")} Recargar</button>
        </div>`;
    $("reload-btn").addEventListener("click", () => location.reload());
}

function init() {
    initTheme();
    initTracking();
    initImageFallback();

    const pools = readEmbeddedPools();
    if (!pools.length) { showLoadError(); return; }
    setPools(pools);

    readFiltersFromURL();
    renderDistrictPills();
    syncControlsFromState();
    setupEventListeners();
    syncSheetForViewport();
    renderPools();

    scheduleDesktopMapPreload();
    refreshFromSheet();
    setInterval(renderFreshness, 60000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
