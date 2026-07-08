// -------------------------------------------------------------
// PiscinaLibre - Application State & Logic
// -------------------------------------------------------------

// Sanitized Swimming Pool Database (fallback if the live Google Sheet fails)
const POOLS_DATA = [
    {
        id: "pueblo-libre",
        name: "Piscina Municipal de Pueblo Libre",
        image: "https://apps.muniplibre.gob.pe/piscina/assets/img/home/image_reserv1.jpg",
        address: "Jr. José Santiago Wagner 1885, Pueblo Libre 15084",
        lat: -12.076405,
        lng: -77.0599223,
        price: "S/. 13.04 por turno",
        priceNum: 13.04,
        schedule: "M-V: 6-7, 20-22 | S: 6-8, 14-22 | D: 8-16",
        register: "https://apps.muniplibre.gob.pe/piscina/",
        regType: "online",
        whatsapp: "51982208108",
        district: "Pueblo Libre"
    },
    {
        id: "san-miguel-adelfo",
        name: "Piscina Temperada Municipal Adelfo Magallanes",
        image: "https://munisanmiguel.gob.pe/wp-content/uploads/2026/01/f1c205f7-45c9-4676-b6ea-40e3d601e239.jpg",
        address: "Calle Agustin Gamarra n° 80, Complejo Deportivo Adelfo Magallanes, San Miguel",
        lat: -12.0842375,
        lng: -77.0974244,
        price: "S/. 20.00 por turno",
        priceNum: 20.00,
        schedule: "L-V: 10-15",
        register: "Presencial",
        regType: "presencial",
        whatsapp: "51960646062",
        district: "San Miguel"
    },
    {
        id: "barranco-municipal",
        name: "Piscina Municipal de Barranco",
        image: "https://sports.munibarranco.gob.pe/presentacion/bienes/imagen/img_pscna_06.jpeg",
        address: "Av. San Martín 1, Barranco",
        lat: -12.1373805,
        lng: -77.023324,
        price: "S/. 20.00 (Compartido) / S/. 40.00 (Individual)",
        priceNum: 20.00,
        schedule: "",
        register: "https://sports.munibarranco.gob.pe/index.php",
        regType: "online",
        whatsapp: "",
        district: "Barranco"
    },
    {
        id: "campo-de-marte",
        name: "Piscina Campo de Marte",
        image: "https://cdn.joinnus.com/user/5060753/act697a97cfcd732.jpg",
        address: "Jr. Nazca 6, Jesús María 15072",
        lat: -12.0700156,
        lng: -77.0425436,
        price: "S/. 20.00 por turno",
        priceNum: 20.00,
        schedule: "",
        register: "https://www.joinnus.com/",
        regType: "online",
        whatsapp: "51981900201",
        district: "Jesús María"
    },
    {
        id: "videna-aquatico",
        name: "Centro Acuático Legado VIDENA",
        image: "https://cdn.joinnus.com/images/77308/rect/EqzMVbdQ8ll38Zp.webp",
        address: "Av. del Aire 1015, San Luis 15021",
        lat: -12.08105353,
        lng: -76.99989262,
        price: "S/. 30.00 por turno",
        priceNum: 30.00,
        schedule: "",
        register: "https://www.joinnus.com/",
        regType: "online",
        whatsapp: "",
        district: "San Luis"
    },
    {
        id: "los-olivos-juventud",
        name: "Piscina Palacio de la Juventud de Los Olivos",
        image: "https://portal.andina.pe/EDPfotografia3/Thumbnail/2025/12/21/001237010W.jpg",
        address: "Av. Universitaria 2086, Los Olivos",
        lat: -12.0030208,
        lng: -77.0832715,
        price: "S/. 10.00 por hora",
        priceNum: 10.00,
        schedule: "L-S: 13-14, 21-22",
        register: "Presencial",
        regType: "presencial",
        whatsapp: "",
        district: "Los Olivos"
    },
    {
        id: "brena-municipal",
        name: "Piscina Municipal de Breña",
        image: "",
        address: "Jirón Gral. Vidal 645, Breña 15083",
        lat: -12.0606123,
        lng: -77.0514927,
        price: "Consultar presencialmente",
        priceNum: 0,
        schedule: "",
        register: "Presencial",
        regType: "presencial",
        whatsapp: "",
        district: "Breña"
    },
    {
        id: "rimac-mercedes-cabello",
        name: "Piscina Mercedes Cabello de Carbonera",
        image: "",
        address: "Av. Túpac Amaru, Rímac (Cerca de Av. Eduardo de Habich)",
        lat: -12.0263031,
        lng: -77.0487043,
        price: "S/. 10.00 por turno",
        priceNum: 10.00,
        schedule: "L-V: 9-19 | S: 9-13",
        register: "Presencial",
        regType: "presencial",
        whatsapp: "",
        district: "Rímac"
    },
    {
        id: "san-miguel-aquaxtream",
        name: "Aquaxtream - Sede San Miguel",
        image: "",
        address: "Av. de La Marina cdra 11 (Colegio Emblemático Bartolomé Herrera), San Miguel",
        lat: -12.0811838,
        lng: -77.0734521,
        price: "S/. 22.00 promedio (Abono de 10 turnos por S/. 220)",
        priceNum: 22.00,
        schedule: "L-V: 5-9, 20-22 | S: 6-9, 13-15 | D: 9-11",
        register: "Lunes a sábado reserva por App. Domingo vía WhatsApp.",
        regType: "online",
        whatsapp: "925083830",
        district: "San Miguel"
    }
];

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LABELS_LONG = ["Domingos", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábados"];
// Order shown in the weekly availability strip (Mon..Sun)
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Application State
let map;
let tileLayer = null;
let mapMarkers = {};
let activeFilters = {
    search: "",
    regType: "all", // "all", "online", "presencial"
    district: "all", // "all" or specific district string
    day: "all",     // "all" or 0-6 (string)
    hour: "all",    // "all" or 5-22 (string)
    openNow: false
};
let currentSort = "default"; // "default", "price-asc", "price-desc", "name-asc"
let userLocationMarker = null;
let poolsList = [...POOLS_DATA];

// -------------------------------------------------------------
// Theme handling (light / dark)
// -------------------------------------------------------------
function getPreferredTheme() {
    const stored = localStorage.getItem("pl-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("pl-theme", theme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", theme === "dark" ? "#0f1725" : "#ffffff");
    const btn = document.getElementById("theme-toggle");
    if (btn) {
        btn.innerHTML = theme === "dark"
            ? '<i data-lucide="sun"></i>'
            : '<i data-lucide="moon"></i>';
    }
    updateMapTiles(theme);
    if (window.lucide) lucide.createIcons();
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
}

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getPreferredTheme());
    initMap();
    setupEventListeners();
    loadPoolsData();
});

// -------------------------------------------------------------
// Map
// -------------------------------------------------------------
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
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
}

function initMap() {
    map = L.map("map", { zoomControl: false }).setView([-12.075, -77.048], 12.5);
    updateMapTiles(document.documentElement.getAttribute("data-theme") || "light");

    L.control.zoom({ position: 'topright' }).addTo(map);

    const LocateControl = L.Control.extend({
        options: { position: 'topright' },
        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            const button = L.DomUtil.create('a', 'leaflet-locate-btn', container);
            button.innerHTML = '<i data-lucide="locate"></i>';
            button.href = '#';
            button.title = 'Ir a mi ubicación actual';
            L.DomEvent.on(button, 'click', function (e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault();
                locateUser();
            });
            return container;
        }
    });
    map.addControl(new LocateControl());

    map.on('popupclose', () => {
        document.querySelectorAll('.pool-card').forEach(card => card.classList.remove('active-highlight'));
    });
}

function rebuildMapMarkers() {
    Object.values(mapMarkers).forEach(marker => {
        if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    mapMarkers = {};

    poolsList.forEach(pool => {
        const customIcon = L.divIcon({
            className: 'custom-leaflet-marker',
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -32],
            html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.6 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.6 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.6 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`
        });

        const status = getOpenStatus(pool.parsed);
        const statusHtml = status === true
            ? `<span class="tooltip-status open">Abierto ahora</span>`
            : (status === false ? `<span class="tooltip-status closed">Cerrado ahora</span>` : "");

        const tooltipContent = `
            <div class="rich-tooltip">
                <div class="tooltip-img-wrapper">
                    ${pool.image ? `<img src="${escapeHtml(pool.image)}" alt="${escapeHtml(pool.name)}">` : `
                        <div class="tooltip-placeholder"><span>${escapeHtml(pool.district)}</span></div>`}
                </div>
                <div class="tooltip-info">
                    <span class="tooltip-district">${escapeHtml(pool.district)}</span>
                    <h4 class="tooltip-title">${escapeHtml(pool.name)}</h4>
                    <div class="tooltip-foot">
                        <span class="tooltip-price">${pool.priceNum > 0 ? `S/. ${pool.priceNum.toFixed(2)}` : 'Consultar'}</span>
                        ${statusHtml}
                    </div>
                </div>
            </div>`;

        const marker = L.marker([pool.lat, pool.lng], { icon: customIcon })
            .bindTooltip(tooltipContent, { direction: 'top', offset: [0, -35], className: 'custom-map-tooltip' })
            .addTo(map);

        marker.on('click', () => scrollToCard(pool.id));
        mapMarkers[pool.id] = marker;
    });
}

// -------------------------------------------------------------
// Data loading
// -------------------------------------------------------------
async function loadPoolsData() {
    const sheetUrl = "https://docs.google.com/spreadsheets/d/1sJCmPq7Ggd5UnnM-lCffzzfUxSCUcjkWQWs-3SrO-n0/export?format=csv&gid=0";
    const statusText = document.getElementById("results-count");
    if (statusText) statusText.textContent = "Cargando datos en vivo…";
    renderSkeletons();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(sheetUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("No se pudo descargar de Google Sheets");
        const csvText = await response.text();
        if (csvText.includes("<!DOCTYPE html>") || csvText.includes("<html")) {
            throw new Error("El Sheet es privado o requiere inicio de sesión.");
        }

        const parsedRows = parseCSV(csvText);
        if (parsedRows && parsedRows.length > 0) {
            const livePools = [];
            parsedRows.forEach(row => {
                const name = row[0] ? row[0].trim() : "";
                if (name && name !== "Nombre" && name !== "Aquaxtream" && row[3] && row[4]) {
                    livePools.push({
                        id: generateId(name),
                        name: name,
                        image: row[1] ? row[1].trim() : "",
                        address: row[2] ? row[2].trim() : "",
                        lat: parseFloat(row[3]) || 0,
                        lng: parseFloat(row[4]) || 0,
                        price: row[5] ? row[5].trim() : "",
                        priceNum: parsePrice(row[5]),
                        schedule: normalizeSchedule(row[6]),
                        register: row[7] ? row[7].trim() : "Presencial",
                        regType: (row[7] && row[7].toLowerCase().includes("http")) ? "online" : "presencial",
                        whatsapp: row[8] ? row[8].trim() : "",
                        district: extractDistrict(row[2], name)
                    });
                }
            });
            if (livePools.length > 0) {
                poolsList = livePools;
                console.log("Cargados en vivo " + poolsList.length + " locales desde Google Sheets.");
            }
        }
    } catch (e) {
        console.warn("Fallo la carga del Google Sheet en vivo. Cargando base de datos estática:", e);
        poolsList = [...POOLS_DATA];
    } finally {
        // Precompute parsed schedule for every pool once
        poolsList.forEach(p => { p.parsed = parseSchedule(p.schedule); });
        rebuildMapMarkers();
        renderDistrictPills();
        renderPools();
        if (window.lucide) lucide.createIcons();
    }
}

// A schedule cell that is just a "consultar" note carries no day/hour info
function normalizeSchedule(raw) {
    if (!raw) return "";
    const t = raw.trim();
    if (/^consultar/i.test(t)) return t; // keep note but it won't parse into day blocks
    return t;
}

// Robust CSV Parser supporting quotes and line breaks
function parseCSV(text) {
    const lines = [];
    let row = [""];
    let insideQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        if (char === '"') {
            if (insideQuote && nextChar === '"') { row[row.length - 1] += '"'; i++; }
            else insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
            row.push("");
        } else if ((char === '\r' || char === '\n') && !insideQuote) {
            if (char === '\r' && nextChar === '\n') i++;
            lines.push(row);
            row = [""];
        } else {
            row[row.length - 1] += char;
        }
    }
    if (row.length > 1 || row[0] !== "") lines.push(row);
    return lines.map(r => r.map(cell => cell.replace(/^"|"$/g, '').trim()));
}

function generateId(name) {
    return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const match = priceStr.replace(/\s+/g, '').replace(/,/g, '.').match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
}

function extractDistrict(address, name) {
    const districts = [
        "Pueblo Libre", "San Miguel", "Barranco", "Jesús María",
        "San Luis", "Los Olivos", "Breña", "Rímac",
        "Miraflores", "San Isidro", "Santiago de Surco", "Surco",
        "Lince", "Chorrillos", "La Molina", "Ate", "Magdalena"
    ];
    const text = ((address || "") + " " + (name || "")).toLowerCase();
    for (const d of districts) {
        if (text.includes(d.toLowerCase())) return d === "Santiago de Surco" ? "Surco" : d;
    }
    return "Lima";
}

// -------------------------------------------------------------
// Schedule parsing (single source of truth)
// Returns { blocks: [{days:[0-6], ranges:[[start,end,single]], daysRaw, hoursRaw}], notes:[str], parseable }
// -------------------------------------------------------------
function parseDay(str) {
    str = str.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!str) return -1;
    if (str.startsWith("do") || str === "d") return 0;
    if (str.startsWith("lu") || str === "l") return 1;
    if (str.startsWith("mi")) return 3;
    if (str.startsWith("ma") || str === "m") return 2;
    if (str.startsWith("ju") || str === "j") return 4;
    if (str.startsWith("vi") || str === "v") return 5;
    if (str.startsWith("sa") || str === "s") return 6;
    return -1;
}

function parseDaysPart(part) {
    part = part.trim();
    const sep = part.includes('-') ? '-' : (/\sa\s/i.test(part) ? 'a' : null);
    if (sep) {
        const pieces = sep === '-' ? part.split('-') : part.split(/\sa\s/i);
        const start = parseDay(pieces[0]);
        const end = parseDay(pieces[1]);
        if (start === -1 || end === -1) return [];
        const days = [];
        let c = start;
        let guard = 0;
        while (c !== end && guard < 8) { days.push(c); c = (c + 1) % 7; guard++; }
        days.push(end);
        return days;
    }
    return part.split(',').map(parseDay).filter(d => d !== -1);
}

function parseHm(str) {
    const m = str.trim().match(/(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
}

function parseHoursPart(part) {
    const ranges = [];
    for (const r of part.split(',')) {
        const rt = r.trim();
        if (!rt) continue;
        const sep = rt.includes('-') ? '-' : (/\sa\s/i.test(rt) ? 'a' : null);
        if (sep) {
            const pieces = sep === '-' ? rt.split('-') : rt.split(/\sa\s/i);
            const s = parseHm(pieces[0]);
            const e = parseHm(pieces[1]);
            if (s != null && e != null) ranges.push([s, e, false]);
        } else {
            const h = parseHm(rt);
            if (h != null) ranges.push([h, h + 1, true]);
        }
    }
    return ranges;
}

function parseSchedule(raw) {
    const result = { blocks: [], notes: [], parseable: false };
    if (!raw) return result;
    const s = raw.trim();
    if (!s) return result;

    for (const seg of s.split('|')) {
        const segment = seg.trim();
        if (!segment) continue;
        const ci = segment.indexOf(':');
        if (ci === -1) { result.notes.push(segment); continue; }

        const daysRaw = segment.slice(0, ci).trim();
        const hoursRaw = segment.slice(ci + 1).trim();
        const days = parseDaysPart(daysRaw);
        const ranges = parseHoursPart(hoursRaw);
        if (days.length && ranges.length) {
            result.blocks.push({ days, ranges, daysRaw, hoursRaw });
        } else {
            result.notes.push(segment);
        }
    }
    result.parseable = result.blocks.length > 0;
    return result;
}

// STRICT filter: when a day/hour is chosen, a pool must PROVE it is open then.
// Unknown/unparseable schedules are excluded so they don't pollute results.
function matchesScheduleFilter(parsed, dayFilter, hourFilter) {
    if (dayFilter === "all" && hourFilter === "all") return true;
    if (!parsed || !parsed.parseable) return false;

    const day = dayFilter === "all" ? null : parseInt(dayFilter, 10);
    const hour = hourFilter === "all" ? null : parseInt(hourFilter, 10);

    for (const block of parsed.blocks) {
        if (day !== null && !block.days.includes(day)) continue;
        if (hour === null) return true; // day matches, no hour constraint
        const hourOk = block.ranges.some(([s, e]) => hour >= Math.floor(s) && hour < e);
        if (hourOk) return true;
    }
    return false;
}

// Returns true (open), false (closed), or null (unknown schedule)
function getOpenStatus(parsed, now = new Date()) {
    if (!parsed || !parsed.parseable) return null;
    const day = now.getDay();
    const t = now.getHours() + now.getMinutes() / 60;
    for (const block of parsed.blocks) {
        if (!block.days.includes(day)) continue;
        if (block.ranges.some(([s, e]) => t >= s && t < e)) return true;
    }
    return false;
}

function getOpenDays(parsed) {
    const set = new Set();
    if (parsed && parsed.parseable) {
        parsed.blocks.forEach(b => b.days.forEach(d => set.add(d)));
    }
    return set;
}

function formatHour(h) {
    const hour = Math.floor(h);
    const min = Math.round((h - hour) * 60);
    const mm = min === 0 ? "" : ":" + String(min).padStart(2, "0");
    if (hour === 0 || hour === 24) return `12${mm} am`;
    if (hour === 12) return `12${mm} pm`;
    return hour > 12 ? `${hour - 12}${mm} pm` : `${hour}${mm} am`;
}

function formatDaysRaw(daysRaw) {
    const sep = daysRaw.includes('-') ? '-' : (/\sa\s/i.test(daysRaw) ? 'a' : null);
    if (sep) {
        const pieces = sep === '-' ? daysRaw.split('-') : daysRaw.split(/\sa\s/i);
        const a = parseDay(pieces[0]), b = parseDay(pieces[1]);
        if (a !== -1 && b !== -1) return `${DAY_LABELS_LONG[a]} a ${DAY_LABELS_LONG[b]}`;
    }
    return daysRaw.split(',').map(d => {
        const n = parseDay(d);
        return n !== -1 ? DAY_LABELS_LONG[n] : d.trim();
    }).join(', ');
}

function formatScheduleToHuman(parsed, raw) {
    if (!parsed || (!parsed.parseable && parsed.notes.length === 0)) {
        return "Consultar horarios en boletería o registro web.";
    }
    const lines = [];
    parsed.blocks.forEach(block => {
        const hours = block.ranges.map(([s, e, single]) =>
            single ? formatHour(s) : `${formatHour(s)} – ${formatHour(e)}`
        );
        lines.push({ days: formatDaysRaw(block.daysRaw), hours });
    });
    if (lines.length === 0) {
        return parsed.notes.join(' ') || (raw || "Consultar horarios.");
    }
    return lines;
}

// -------------------------------------------------------------
// Rendering
// -------------------------------------------------------------
function escapeHtml(str) {
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderDistrictPills() {
    const container = document.getElementById("district-pills-container");
    const counts = {};
    poolsList.forEach(p => { counts[p.district] = (counts[p.district] || 0) + 1; });
    const districts = Object.keys(counts).sort();

    let html = `<button class="district-pill active" data-district="all" aria-pressed="true">Todos <span>${poolsList.length}</span></button>`;
    districts.forEach(dist => {
        html += `<button class="district-pill" data-district="${escapeHtml(dist)}" aria-pressed="false">${escapeHtml(dist)} <span>${counts[dist]}</span></button>`;
    });
    container.innerHTML = html;
}

function renderSkeletons() {
    const listContainer = document.getElementById("pools-list");
    document.getElementById("no-results").style.display = "none";
    let html = "";
    for (let i = 0; i < 4; i++) {
        html += `
            <div class="pool-card skeleton-card">
                <div class="skeleton skeleton-img"></div>
                <div class="skeleton-body">
                    <div class="skeleton skeleton-line lg"></div>
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line sm"></div>
                </div>
            </div>`;
    }
    listContainer.innerHTML = html;
}

function renderWeekStrip(openDays, parseable) {
    if (!parseable) {
        return `<div class="week-strip unknown"><span class="week-unknown">Horario por confirmar</span></div>`;
    }
    let cells = WEEK_ORDER.map(d => {
        const on = openDays.has(d);
        return `<span class="day-cell ${on ? 'on' : 'off'}" title="${DAY_LABELS_LONG[d]}">${DAY_LABELS[d][0]}</span>`;
    }).join('');
    return `<div class="week-strip">${cells}</div>`;
}

function renderScheduleBlock(parsed, raw) {
    const formatted = formatScheduleToHuman(parsed, raw);
    if (typeof formatted === "string") {
        return `<span class="schedule-text">${escapeHtml(formatted)}</span>`;
    }
    return `<div class="schedule-list">${formatted.map(l => `
        <div class="schedule-row">
            <span class="schedule-days">${escapeHtml(l.days)}</span>
            <span class="schedule-hours">${l.hours.map(h => `<span>${escapeHtml(h)}</span>`).join('')}</span>
        </div>`).join('')}</div>`;
}

function renderPools() {
    const listContainer = document.getElementById("pools-list");
    const noResultsContainer = document.getElementById("no-results");

    let filteredPools = poolsList.filter(pool => {
        const q = activeFilters.search.toLowerCase();
        const matchesSearch = !q ||
            pool.name.toLowerCase().includes(q) ||
            pool.district.toLowerCase().includes(q) ||
            pool.address.toLowerCase().includes(q);

        const matchesReg = activeFilters.regType === "all" || pool.regType === activeFilters.regType;
        const matchesDistrict = activeFilters.district === "all" || pool.district === activeFilters.district;
        const matchesSchedule = matchesScheduleFilter(pool.parsed, activeFilters.day, activeFilters.hour);
        const matchesOpenNow = !activeFilters.openNow || getOpenStatus(pool.parsed) === true;

        return matchesSearch && matchesReg && matchesDistrict && matchesSchedule && matchesOpenNow;
    });

    // Sort
    if (currentSort === "price-asc") {
        filteredPools.sort((a, b) => (a.priceNum || 9999) - (b.priceNum || 9999));
    } else if (currentSort === "price-desc") {
        filteredPools.sort((a, b) => b.priceNum - a.priceNum);
    } else if (currentSort === "name-asc") {
        filteredPools.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        // Default: pools open right now float to the top
        filteredPools.sort((a, b) => (getOpenStatus(b.parsed) === true) - (getOpenStatus(a.parsed) === true));
    }

    const countSpan = document.getElementById("results-count");
    const n = filteredPools.length;
    countSpan.textContent = `${n} ${n === 1 ? 'piscina encontrada' : 'piscinas encontradas'}`;

    // Show the "clear filters" button only when at least one filter is active
    const clearBtn = document.getElementById("clear-filters-btn");
    if (clearBtn) clearBtn.style.display = anyFilterActive() ? "inline-flex" : "none";

    // Sync the mobile filter-sheet controls (active count badges + apply button)
    const activeCount = getActiveFilterCount();
    ["filter-count-badge", "filter-count-badge-map"].forEach(id => {
        const badge = document.getElementById(id);
        if (badge) { badge.textContent = activeCount; badge.hidden = activeCount === 0; }
    });
    const filtersBtn = document.getElementById("filters-toggle-btn");
    if (filtersBtn) filtersBtn.classList.toggle("has-filters", activeCount > 0);
    const applyBtn = document.getElementById("sheet-apply-btn");
    if (applyBtn) applyBtn.textContent = `Ver ${n} ${n === 1 ? 'piscina' : 'piscinas'}`;

    // Sync map markers with the filtered list
    poolsList.forEach(pool => {
        const isVisible = filteredPools.some(fp => fp.id === pool.id);
        const marker = mapMarkers[pool.id];
        if (!marker) return;
        if (isVisible && !map.hasLayer(marker)) marker.addTo(map);
        if (!isVisible && map.hasLayer(marker)) marker.remove();
    });

    if (filteredPools.length === 0) {
        listContainer.innerHTML = "";
        noResultsContainer.style.display = "flex";
        return;
    }
    noResultsContainer.style.display = "none";

    let cardsHtml = "";
    filteredPools.forEach(pool => {
        let cleanWhatsapp = pool.whatsapp ? pool.whatsapp.replace(/\s+/g, '') : "";
        if (cleanWhatsapp && cleanWhatsapp.length === 9 && !cleanWhatsapp.startsWith("51")) cleanWhatsapp = "51" + cleanWhatsapp;
        const whatsAppLink = cleanWhatsapp
            ? `https://wa.me/${cleanWhatsapp}?text=Hola,%20quisiera%20consultar%20sobre%20el%20horario%20de%20nado%20libre.` : "";

        const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${pool.lat},${pool.lng}`;
        const wazeLink = `https://waze.com/ul?ll=${pool.lat},${pool.lng}&navigate=yes`;

        const status = getOpenStatus(pool.parsed);
        const statusBadge = status === true
            ? `<span class="status-badge open"><span class="dot"></span> Abierto ahora</span>`
            : (status === false ? `<span class="status-badge closed"><span class="dot"></span> Cerrado ahora</span>` : "");

        const openDays = getOpenDays(pool.parsed);

        cardsHtml += `
            <article class="pool-card" id="card-${pool.id}" onclick="onCardClick(event, '${pool.id}')">
                <div class="pool-image-area">
                    <span class="district-badge">${escapeHtml(pool.district)}</span>
                    <span class="price-badge"><i data-lucide="coins"></i> ${pool.priceNum > 0 ? `S/. ${pool.priceNum.toFixed(2)}` : 'Consultar'}</span>
                    ${statusBadge}
                    ${pool.image
                        ? `<img src="${escapeHtml(pool.image)}" alt="${escapeHtml(pool.name)}" loading="lazy" onerror="this.parentElement.classList.add('img-failed');this.remove();">`
                        : ``}
                    <div class="pool-image-placeholder"><i data-lucide="waves"></i></div>
                </div>

                <div class="pool-info">
                    <div class="pool-title-group">
                        <h2 class="pool-title">${escapeHtml(pool.name)}</h2>
                        <span class="reg-badge ${pool.regType}">${pool.regType === 'online' ? 'Online' : 'Presencial'}</span>
                    </div>

                    ${renderWeekStrip(openDays, pool.parsed.parseable)}

                    <div class="pool-details-list">
                        <div class="detail-item">
                            <i data-lucide="map-pin"></i>
                            <span>${escapeHtml(pool.address)}</span>
                        </div>
                        <div class="detail-item">
                            <i data-lucide="clock"></i>
                            ${renderScheduleBlock(pool.parsed, pool.schedule)}
                        </div>
                        <div class="detail-item">
                            <i data-lucide="credit-card"></i>
                            <span>${escapeHtml(pool.price || 'Consultar precio')}</span>
                        </div>
                    </div>
                </div>

                <div class="pool-actions">
                    ${pool.regType === 'online' && pool.register.startsWith('http')
                        ? `<a href="${escapeHtml(pool.register)}" target="_blank" class="btn btn-primary" rel="noopener">Reservar vacante <i data-lucide="external-link"></i></a>`
                        : `<span class="btn btn-secondary presencial-note"><i data-lucide="info"></i> Registro presencial</span>`}
                    ${whatsAppLink ? `<a href="${whatsAppLink}" target="_blank" class="btn btn-whatsapp" title="Escribir por WhatsApp" rel="noopener"><i data-lucide="phone"></i></a>` : ''}
                    <div class="nav-buttons">
                        <a href="${googleMapsLink}" target="_blank" class="btn-icon-only" title="Abrir en Google Maps" rel="noopener"><i data-lucide="navigation"></i></a>
                        <a href="${wazeLink}" target="_blank" class="btn-icon-only" title="Abrir en Waze" rel="noopener"><i data-lucide="compass"></i></a>
                    </div>
                </div>
            </article>`;
    });

    listContainer.innerHTML = cardsHtml;
    if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// Events
// -------------------------------------------------------------
function setupEventListeners() {
    const searchInput = document.getElementById("search-input");
    const clearSearchBtn = document.getElementById("clear-search-btn");

    searchInput.addEventListener("input", (e) => {
        activeFilters.search = e.target.value.trim();
        clearSearchBtn.style.display = activeFilters.search.length > 0 ? "flex" : "none";
        renderPools();
    });

    clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        activeFilters.search = "";
        clearSearchBtn.style.display = "none";
        renderPools();
        searchInput.focus();
    });

    document.querySelectorAll(".filter-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".filter-chip").forEach(c => {
                c.classList.remove("active");
                c.setAttribute("aria-pressed", "false");
            });
            chip.classList.add("active");
            chip.setAttribute("aria-pressed", "true");
            activeFilters.regType = chip.getAttribute("data-filter");
            renderPools();
        });
    });

    document.getElementById("district-pills-container").addEventListener("click", (e) => {
        const pill = e.target.closest(".district-pill");
        if (!pill) return;
        document.querySelectorAll(".district-pill").forEach(p => {
            p.classList.remove("active");
            p.setAttribute("aria-pressed", "false");
        });
        pill.classList.add("active");
        pill.setAttribute("aria-pressed", "true");
        activeFilters.district = pill.getAttribute("data-district");
        renderPools();
    });

    document.getElementById("reset-filters-btn").addEventListener("click", resetAllFilters);
    document.getElementById("clear-filters-btn").addEventListener("click", resetAllFilters);

    document.getElementById("sort-select").addEventListener("change", (e) => {
        currentSort = e.target.value;
        renderPools();
    });

    // Mobile view toggle
    const mobileToggle = document.getElementById("mobile-view-toggle-btn");
    mobileToggle.addEventListener("click", () => {
        const isMapShown = document.body.classList.toggle("show-map");
        mobileToggle.querySelector(".toggle-content-list").style.display = isMapShown ? "none" : "flex";
        mobileToggle.querySelector(".toggle-content-map").style.display = isMapShown ? "flex" : "none";
        if (isMapShown) setTimeout(() => map.invalidateSize({ animate: true }), 60);
    });

    document.getElementById("filter-day-select").addEventListener("change", (e) => {
        activeFilters.day = e.target.value;
        renderPools();
    });

    document.getElementById("filter-hour-select").addEventListener("change", (e) => {
        activeFilters.hour = e.target.value;
        renderPools();
    });

    document.getElementById("btn-filter-now").addEventListener("click", () => applyOpenNow(!activeFilters.openNow));
    document.getElementById("btn-filter-now-mobile").addEventListener("click", () => applyOpenNow(!activeFilters.openNow));

    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

    // Mobile filter sheet
    document.getElementById("filters-toggle-btn").addEventListener("click", (e) => {
        if (document.body.classList.contains("filters-sheet-open")) closeFilterSheet();
        else openFilterSheet(e.currentTarget);
    });
    document.getElementById("map-filters-btn").addEventListener("click", (e) => openFilterSheet(e.currentTarget));
    document.getElementById("sheet-close-btn").addEventListener("click", closeFilterSheet);
    document.getElementById("sheet-apply-btn").addEventListener("click", closeFilterSheet);
    document.getElementById("sheet-backdrop").addEventListener("click", closeFilterSheet);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("filters-sheet-open")) closeFilterSheet();
    });
    window.addEventListener("resize", syncSheetForViewport);
    syncSheetForViewport();
}

// "Abiertas ahora" quick filter — shared by the desktop and mobile buttons
function applyOpenNow(active) {
    activeFilters.openNow = active;
    if (active) {
        // Align the day/hour selects for clarity
        document.getElementById("filter-day-select").value = "all";
        document.getElementById("filter-hour-select").value = "all";
        activeFilters.day = "all";
        activeFilters.hour = "all";
    }
    ["btn-filter-now", "btn-filter-now-mobile"].forEach(id => {
        const btn = document.getElementById(id);
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
    });
    renderPools();
}

// -------------------------------------------------------------
// Mobile filter sheet
// -------------------------------------------------------------
function isMobileView() {
    return window.matchMedia("(max-width: 900px)").matches;
}

// Button that opened the sheet, to restore focus on close
let sheetTrigger = null;

function setSheetTriggersExpanded(expanded) {
    ["filters-toggle-btn", "map-filters-btn"].forEach(id => {
        document.getElementById(id).setAttribute("aria-expanded", String(expanded));
    });
}

function openFilterSheet(trigger) {
    sheetTrigger = trigger || document.getElementById("filters-toggle-btn");
    document.body.classList.add("filters-sheet-open");
    setSheetTriggersExpanded(true);
    document.getElementById("filter-sheet").setAttribute("aria-hidden", "false");
    if (isMobileView()) document.getElementById("sheet-close-btn").focus();
}

function closeFilterSheet() {
    const sheet = document.getElementById("filter-sheet");
    const hadFocusInside = sheet.contains(document.activeElement);
    document.body.classList.remove("filters-sheet-open");
    setSheetTriggersExpanded(false);
    if (isMobileView()) {
        sheet.setAttribute("aria-hidden", "true");
        if (hadFocusInside && sheetTrigger) sheetTrigger.focus();
    }
    sheetTrigger = null;
}

// Keep sheet state coherent across the mobile/desktop breakpoint.
// On mobile the sheet is reparented to .app-container: inside
// .controls-section it is trapped in the .content-area/.controls-section
// stacking contexts and the fixed backdrop (root context) paints over it.
function syncSheetForViewport() {
    const sheet = document.getElementById("filter-sheet");
    if (isMobileView()) {
        const appContainer = document.querySelector(".app-container");
        if (sheet.parentElement !== appContainer) appContainer.appendChild(sheet);
        if (!document.body.classList.contains("filters-sheet-open")) {
            sheet.setAttribute("aria-hidden", "true");
        }
    } else {
        // Desktop: filters render inline and are always available
        const controls = document.querySelector(".controls-section");
        if (sheet.parentElement !== controls) controls.appendChild(sheet);
        document.body.classList.remove("filters-sheet-open");
        sheet.setAttribute("aria-hidden", "false");
        setSheetTriggersExpanded(false);
    }
}

function getActiveFilterCount() {
    let count = 0;
    if (activeFilters.regType !== "all") count++;
    if (activeFilters.district !== "all") count++;
    if (activeFilters.day !== "all") count++;
    if (activeFilters.hour !== "all") count++;
    if (activeFilters.openNow) count++;
    return count;
}

function anyFilterActive() {
    return activeFilters.search !== "" ||
        activeFilters.regType !== "all" ||
        activeFilters.district !== "all" ||
        activeFilters.day !== "all" ||
        activeFilters.hour !== "all" ||
        activeFilters.openNow === true ||
        currentSort !== "default";
}

function resetAllFilters() {
    activeFilters = { search: "", regType: "all", district: "all", day: "all", hour: "all", openNow: false };
    currentSort = "default";

    document.getElementById("search-input").value = "";
    document.getElementById("clear-search-btn").style.display = "none";
    document.getElementById("sort-select").value = "default";
    document.getElementById("filter-day-select").value = "all";
    document.getElementById("filter-hour-select").value = "all";
    ["btn-filter-now", "btn-filter-now-mobile"].forEach(id => {
        const btn = document.getElementById(id);
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
    });

    document.querySelectorAll(".filter-chip").forEach(c => {
        const on = c.getAttribute("data-filter") === "all";
        c.classList.toggle("active", on);
        c.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll(".district-pill").forEach(p => {
        const on = p.getAttribute("data-district") === "all";
        p.classList.toggle("active", on);
        p.setAttribute("aria-pressed", String(on));
    });

    renderPools();
}

// -------------------------------------------------------------
// Card ↔ Map interaction
// -------------------------------------------------------------
function onCardClick(e, poolId) {
    if (e.target.closest('a') || e.target.closest('button')) return;
    const pool = poolsList.find(p => p.id === poolId);
    if (!pool) return;

    map.setView([pool.lat, pool.lng], 14.5, { animate: true, duration: 0.8 });
    const marker = mapMarkers[poolId];
    if (marker) marker.openTooltip();
    highlightPoolCard(poolId);

    if (window.innerWidth <= 900) {
        document.body.classList.add("show-map");
        const t = document.getElementById("mobile-view-toggle-btn");
        t.querySelector(".toggle-content-list").style.display = "none";
        t.querySelector(".toggle-content-map").style.display = "flex";
        setTimeout(() => {
            map.invalidateSize();
            map.setView([pool.lat, pool.lng], 14.5);
            if (marker) marker.openTooltip();
        }, 120);
    }
}

function highlightPoolCard(poolId) {
    document.querySelectorAll('.pool-card').forEach(card => card.classList.remove('active-highlight'));
    const activeCard = document.getElementById(`card-${poolId}`);
    if (activeCard) activeCard.classList.add('active-highlight');
}

window.scrollToCard = function (poolId) {
    const card = document.getElementById(`card-${poolId}`);
    if (window.innerWidth <= 900) {
        document.body.classList.remove("show-map");
        const t = document.getElementById("mobile-view-toggle-btn");
        t.querySelector(".toggle-content-list").style.display = "flex";
        t.querySelector(".toggle-content-map").style.display = "none";
    }
    if (card) {
        setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
        highlightPoolCard(poolId);
    }
};

// -------------------------------------------------------------
// Geolocation
// -------------------------------------------------------------
function locateUser() {
    if (!navigator.geolocation) {
        alert("La geolocalización no está soportada por tu navegador.");
        return;
    }
    const btn = document.querySelector('.leaflet-locate-btn');
    if (btn) btn.classList.add('locating');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude: lat, longitude: lng } = position.coords;
            if (btn) btn.classList.remove('locating');
            map.setView([lat, lng], 14.5, { animate: true, duration: 0.8 });

            if (userLocationMarker) {
                userLocationMarker.setLatLng([lat, lng]);
            } else {
                const userIcon = L.divIcon({
                    className: 'user-location-marker',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                    html: '<div class="user-marker-pulse"></div>'
                });
                userLocationMarker = L.marker([lat, lng], { icon: userIcon })
                    .bindTooltip("Tu ubicación actual", { direction: 'top', className: 'custom-map-tooltip' })
                    .addTo(map);
            }
        },
        (error) => {
            if (btn) btn.classList.remove('locating');
            let msg = "No pudimos obtener tu ubicación.";
            if (error.code === error.PERMISSION_DENIED) msg = "Permiso denegado. Habilita el acceso a la ubicación en tu navegador.";
            else if (error.code === error.POSITION_UNAVAILABLE) msg = "La señal de ubicación no está disponible en este momento.";
            else if (error.code === error.TIMEOUT) msg = "Se agotó el tiempo de espera para obtener la ubicación.";
            alert(msg);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
}
