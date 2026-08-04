// -------------------------------------------------------------
// PiscinaLibre - Estado de la home
//
// Un único sitio donde vive qué piscinas hay, qué filtros están puestos y
// cómo se ordenan. No toca el DOM ni sabe nada del mapa: los módulos de
// interfaz leen de aquí, nunca al revés.
// -------------------------------------------------------------

import {
    matchesScheduleFilter, getOpenStatus, distanceKm, DAY_LABELS_LONG
} from "./lib/pools-core.js";

export const DEFAULT_FILTERS = {
    search: "",
    regType: "all",   // "all" | "online" | "presencial"
    district: "all",  // "all" | nombre del distrito
    day: "all",       // "all" | "0".."6"
    hour: "all",      // "all" | "5".."22"
    openNow: false
};

// Objeto mutable en lugar de `let` exportados: las importaciones son
// enlaces de solo lectura y otros módulos necesitan escribir aquí.
export const state = {
    pools: [],
    poolsById: new Map(),
    filters: { ...DEFAULT_FILTERS },
    sort: "default",     // default | price-asc | price-desc | name-asc | distance
    userPosition: null   // { lat, lng } una vez concedida la geolocalización
};

export function setPools(pools) {
    state.pools = pools;
    state.poolsById = new Map(pools.map(p => [p.id, p]));
    computeDistances();
}

// -------------------------------------------------------------
// Estado en la URL
// -------------------------------------------------------------
// Los filtros viven en la query string para que una vista filtrada se
// pueda compartir, enlazar desde las páginas de distrito y sobrevivir a
// una recarga.
export function readFiltersFromURL() {
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
    if (next.district !== "all" && !state.pools.some(p => p.district === next.district)) {
        next.district = "all";
    }
    // "Más cercanas" necesita permiso de ubicación, que no se puede
    // heredar de un enlace: se pide cuando el usuario lo elige.
    if (sort === "distance") sort = "default";

    state.filters = next;
    state.sort = sort;
}

export function writeFiltersToURL({ push = false } = {}) {
    const { filters } = state;
    const params = new URLSearchParams();
    if (filters.search) params.set("q", filters.search);
    if (filters.regType !== "all") params.set("reg", filters.regType);
    if (filters.district !== "all") params.set("distrito", filters.district);
    if (filters.day !== "all") params.set("dia", filters.day);
    if (filters.hour !== "all") params.set("hora", filters.hour);
    if (filters.openNow) params.set("ahora", "1");
    if (state.sort !== "default" && state.sort !== "distance") params.set("orden", state.sort);

    const qs = params.toString();
    const url = location.pathname + (qs ? "?" + qs : "") + location.hash;
    if (url === location.pathname + location.search + location.hash) return;

    // Los controles discretos (chips, selects) merecen una entrada de
    // historial; escribir en el buscador, no.
    if (push) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
}

// -------------------------------------------------------------
// Filtrado y orden
// -------------------------------------------------------------
export function filterPools() {
    const { filters } = state;
    const q = filters.search.toLowerCase();
    return state.pools.filter(pool => {
        const matchesSearch = !q ||
            pool.name.toLowerCase().includes(q) ||
            pool.district.toLowerCase().includes(q) ||
            pool.address.toLowerCase().includes(q);

        return matchesSearch &&
            (filters.regType === "all" || pool.regType === filters.regType) &&
            (filters.district === "all" || pool.district === filters.district) &&
            matchesScheduleFilter(pool.parsed, filters.day, filters.hour) &&
            (!filters.openNow || getOpenStatus(pool.parsed) === true);
    });
}

export function sortPools(pools) {
    const sorted = [...pools];
    if (state.sort === "price-asc") {
        sorted.sort((a, b) => (a.priceNum || 9999) - (b.priceNum || 9999));
    } else if (state.sort === "price-desc") {
        sorted.sort((a, b) => b.priceNum - a.priceNum);
    } else if (state.sort === "name-asc") {
        sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
    } else if (state.sort === "distance" && state.userPosition) {
        sorted.sort((a, b) => (a._distance ?? Infinity) - (b._distance ?? Infinity));
    } else {
        // Por defecto, las que están abiertas ahora suben arriba
        sorted.sort((a, b) => (getOpenStatus(b.parsed) === true) - (getOpenStatus(a.parsed) === true));
    }
    return sorted;
}

export function computeDistances() {
    if (!state.userPosition) return;
    const { lat, lng } = state.userPosition;
    state.pools.forEach(p => {
        p._distance = distanceKm(lat, lng, p.lat, p.lng);
    });
}

// Etiqueta legible de cada orden, para anunciarla junto al recuento.
export const SORT_LABELS = {
    "default": "abiertas primero",
    "distance": "de más cercana a más lejana",
    "price-asc": "de menor a mayor precio",
    "price-desc": "de mayor a menor precio",
    "name-asc": "por nombre"
};

// -------------------------------------------------------------
// Filtros activos
// -------------------------------------------------------------
// Una sola lista alimenta los chips, la insignia del panel y los botones
// de "quitar" del estado vacío: así los tres no pueden discrepar.
export function activeFilterList() {
    const { filters } = state;
    const list = [];
    if (filters.search) list.push({ key: "search", label: `“${filters.search}”` });
    if (filters.regType !== "all") {
        list.push({ key: "regType", label: filters.regType === "online" ? "Registro online" : "Presencial" });
    }
    if (filters.district !== "all") list.push({ key: "district", label: filters.district });
    if (filters.day !== "all") list.push({ key: "day", label: DAY_LABELS_LONG[parseInt(filters.day, 10)] });
    if (filters.hour !== "all") {
        const h = parseInt(filters.hour, 10);
        const label = h === 12 ? "12:00 pm" : (h > 12 ? `${h - 12}:00 pm` : `${h}:00 am`);
        list.push({ key: "hour", label: `A las ${label}` });
    }
    if (filters.openNow) list.push({ key: "openNow", label: "Abiertas ahora" });
    return list;
}

export function anyFilterActive() {
    return activeFilterList().length > 0 || state.sort !== "default";
}
