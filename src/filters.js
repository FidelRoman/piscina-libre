// -------------------------------------------------------------
// PiscinaLibre - Controles de filtro
//
// Pinta las pastillas de distrito, los chips de filtros activos y maneja
// el panel de filtros (desplegable en escritorio, hoja inferior en
// móvil). No decide nada: lee de state.js y app.js le conecta los
// eventos.
// -------------------------------------------------------------

import { escapeHtml } from "./lib/pools-core.js";
import { icon } from "./lib/icons.js";
import { $, isMobileView } from "./ui.js";
import { state } from "./state.js";

// -------------------------------------------------------------
// Sincronizar controles con el estado
// -------------------------------------------------------------
export function syncControlsFromState() {
    const { filters } = state;
    $("search-input").value = filters.search;
    $("clear-search-btn").hidden = filters.search === "";
    $("filter-day-select").value = filters.day;
    $("filter-hour-select").value = filters.hour;
    $("sort-select").value = state.sort;

    document.querySelectorAll(".filter-chip").forEach(chip => {
        const on = chip.dataset.filter === filters.regType;
        chip.classList.toggle("active", on);
        chip.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll(".district-pill").forEach(pill => {
        const on = pill.dataset.district === filters.district;
        pill.classList.toggle("active", on);
        pill.setAttribute("aria-pressed", String(on));
    });
    // Hay un botón de "abiertas ahora" en la barra de filtros y otro sobre
    // el mapa; los dos reflejan el mismo estado.
    document.querySelectorAll('[data-action="filter-now"]').forEach(btn => {
        btn.classList.toggle("active", filters.openNow);
        btn.setAttribute("aria-pressed", String(filters.openNow));
    });
}

// -------------------------------------------------------------
// Pintado
// -------------------------------------------------------------
export function renderDistrictPills() {
    const counts = {};
    state.pools.forEach(p => { counts[p.district] = (counts[p.district] || 0) + 1; });
    const districts = Object.keys(counts).sort((a, b) => a.localeCompare(b, "es"));

    const isAll = state.filters.district === "all";
    let html = `<button class="district-pill${isAll ? " active" : ""}" data-district="all" aria-pressed="${isAll}">Todos <span>${state.pools.length}</span></button>`;
    districts.forEach(dist => {
        const on = state.filters.district === dist;
        html += `<button class="district-pill${on ? " active" : ""}" data-district="${escapeHtml(dist)}" aria-pressed="${on}">${escapeHtml(dist)} <span>${counts[dist]}</span></button>`;
    });
    $("district-pills-container").innerHTML = html;
}

export function renderActiveFilters(list) {
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

export function renderNoResultsActions(list) {
    // La etiqueta ya viene entrecomillada cuando hace falta (la búsqueda),
    // así que aquí no se vuelve a envolver
    $("no-results-actions").innerHTML = list.map(f =>
        `<button type="button" class="btn btn-secondary btn-inline" data-clear-filter="${f.key}">Quitar ${escapeHtml(f.label)}</button>`
    ).join("");
}

// Insignia con el número de filtros puestos, en la barra y sobre el mapa.
export function renderFilterCount(count) {
    document.querySelectorAll("[data-filter-count]").forEach(badge => {
        badge.textContent = count;
        badge.hidden = count === 0;
    });
    $("filters-toggle-btn").classList.toggle("has-filters", count > 0);
}

// -------------------------------------------------------------
// Panel de filtros
// -------------------------------------------------------------
let sheetTrigger = null;
const FOCUSABLE = 'a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])';

export function isSheetOpen() {
    return document.body.classList.contains("filters-sheet-open");
}

// Con el panel abierto el backdrop tapa la página entera, así que el
// tabulador no debe poder salirse por detrás.
export function trapFocus(e) {
    if (e.key !== "Tab" || !isSheetOpen()) return;
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
    document.querySelectorAll('[aria-controls="filter-sheet"]').forEach(btn => {
        btn.setAttribute("aria-expanded", String(expanded));
    });
}

export function openFilterSheet(trigger) {
    sheetTrigger = trigger || $("filters-toggle-btn");
    document.body.classList.add("filters-sheet-open");
    setSheetTriggersExpanded(true);
    $("filter-sheet").setAttribute("aria-hidden", "false");
    // El panel no es enfocable hasta que termina de deslizarse
    // (--transition-smooth, 0.32 s)
    setTimeout(() => {
        if (isSheetOpen()) $("sheet-close-btn").focus();
    }, 350);
}

export function closeFilterSheet() {
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
export function syncSheetForViewport() {
    const sheet = $("filter-sheet");
    const target = isMobileView()
        ? document.querySelector(".app-container")
        : document.querySelector(".controls-section");
    if (sheet.parentElement !== target) {
        target.appendChild(sheet);
        closeFilterSheet();
    }
    if (!isSheetOpen()) {
        sheet.setAttribute("aria-hidden", "true");
    }
}
