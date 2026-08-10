// -------------------------------------------------------------
// PiscinaLibre - Núcleo compartido
//
// Este módulo lo consumen tanto build.js (Node, al generar el sitio)
// como src/app.js (navegador). Todo lo que viva aquí debe ser JS puro:
// sin `document`, sin `window`, sin `fs`.
// -------------------------------------------------------------

export const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DAY_LABELS_LONG = ["Domingos", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábados"];
// Orden de la tira semanal de disponibilidad (Lun..Dom)
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
// Códigos de día de schema.org, indexados igual que DAY_LABELS
export const DAY_SCHEMA = [
    "https://schema.org/Sunday", "https://schema.org/Monday", "https://schema.org/Tuesday",
    "https://schema.org/Wednesday", "https://schema.org/Thursday", "https://schema.org/Friday",
    "https://schema.org/Saturday"
];

export const SHEET_URL = "https://docs.google.com/spreadsheets/d/1sJCmPq7Ggd5UnnM-lCffzzfUxSCUcjkWQWs-3SrO-n0/export?format=csv&gid=0";

// -------------------------------------------------------------
// Utilidades de texto
// -------------------------------------------------------------
export function escapeHtml(str) {
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function generateId(name) {
    return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const match = priceStr.replace(/\s+/g, '').replace(/,/g, '.').match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
}

export function parseRegisterInfo(register) {
    const raw = String(register == null ? "" : register).trim();
    if (!raw) return { url: "", text: "" };
    const match = raw.match(/https?:\/\/\S+/i);
    if (!match) return { url: "", text: raw };
    const url = match[0].replace(/[),.;]+$/, "");
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const text = `${raw.slice(0, start)} ${raw.slice(end)}`
        .replace(/\s+/g, " ")
        .replace(/^[,\-:\s]+|[,\-:\s]+$/g, "")
        .trim();
    return { url, text };
}

const DISTRICTS = [
    "Pueblo Libre", "San Miguel", "Barranco", "Jesús María",
    "San Luis", "Los Olivos", "Breña", "Rímac",
    "Miraflores", "San Isidro", "Santiago de Surco", "Surco",
    "Lince", "Chorrillos", "La Molina", "Ate", "Magdalena"
];

export function extractDistrict(address, name) {
    const text = ((address || "") + " " + (name || "")).toLowerCase();
    for (const d of DISTRICTS) {
        if (text.includes(d.toLowerCase())) return d === "Santiago de Surco" ? "Surco" : d;
    }
    return "Lima";
}

// -------------------------------------------------------------
// CSV
// -------------------------------------------------------------
// Parser robusto que soporta comillas y saltos de línea dentro de celdas
export function parseCSV(text) {
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

// Una celda de horario que solo dice "consultar" no aporta días ni horas
function normalizeSchedule(raw) {
    if (!raw) return "";
    return raw.trim();
}

// Convierte el CSV del Google Sheet en la lista de piscinas de la app.
// Devuelve [] si no hay ninguna fila utilizable, para que quien llame
// pueda decidir si cae al fallback.
export function poolsFromCSV(csvText) {
    const rows = parseCSV(csvText);
    const pools = [];
    rows.forEach(row => {
        const name = row[0] ? row[0].trim() : "";
        if (!name || name === "Nombre" || name === "Aquaxtream" || !row[4] || !row[5]) return;
        const address = row[2] ? row[2].trim() : "";
        const districtCell = row[3] ? row[3].trim() : "";
        pools.push({
            id: generateId(name),
            name,
            image: row[1] ? row[1].trim() : "",
            address,
            lat: parseFloat(row[4]) || 0,
            lng: parseFloat(row[5]) || 0,
            price: row[6] ? row[6].trim() : "",
            priceNum: parsePrice(row[6]),
            schedule: normalizeSchedule(row[7]),
            register: row[8] ? row[8].trim() : "Presencial",
            regType: parseRegisterInfo(row[8]).url ? "online" : "presencial",
            whatsapp: row[9] ? row[9].trim() : "",
            // La columna Distrito del Sheet manda; el texto solo es red de
            // seguridad para una fila que la deje en blanco.
            district: districtCell || extractDistrict(address, name)
        });
    });
    return pools;
}

// -------------------------------------------------------------
// Horarios (única fuente de verdad)
// parseSchedule devuelve
//   { blocks: [{ days:[0-6], ranges:[[inicio, fin, esHoraSuelta]], daysRaw, hoursRaw }],
//     notes: [str], parseable: bool }
// -------------------------------------------------------------
export function parseDay(str) {
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

export function parseSchedule(raw) {
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

// Filtro ESTRICTO: al elegir día u hora, la piscina debe PROBAR que abre entonces.
// Los horarios desconocidos quedan fuera para que no ensucien los resultados.
export function matchesScheduleFilter(parsed, dayFilter, hourFilter) {
    if (dayFilter === "all" && hourFilter === "all") return true;
    if (!parsed || !parsed.parseable) return false;

    const day = dayFilter === "all" ? null : parseInt(dayFilter, 10);
    const hour = hourFilter === "all" ? null : parseInt(hourFilter, 10);

    for (const block of parsed.blocks) {
        if (day !== null && !block.days.includes(day)) continue;
        if (hour === null) return true; // el día coincide y no hay restricción de hora
        const hourOk = block.ranges.some(([s, e]) => hour >= Math.floor(s) && hour < e);
        if (hourOk) return true;
    }
    return false;
}

// true (abierta), false (cerrada) o null (horario desconocido)
export function getOpenStatus(parsed, now = new Date()) {
    if (!parsed || !parsed.parseable) return null;
    const day = now.getDay();
    const t = now.getHours() + now.getMinutes() / 60;
    for (const block of parsed.blocks) {
        if (!block.days.includes(day)) continue;
        if (block.ranges.some(([s, e]) => t >= s && t < e)) return true;
    }
    return false;
}

// Si está abierta, la hora a la que termina el turno en curso; si no, null.
// Con turnos solapados gana el que acaba más tarde: es el dato útil para el
// visitante ("hasta cuándo puedo llegar").
export function getOpenUntil(parsed, now = new Date()) {
    if (!parsed || !parsed.parseable) return null;
    const day = now.getDay();
    const t = now.getHours() + now.getMinutes() / 60;
    let end = null;
    for (const block of parsed.blocks) {
        if (!block.days.includes(day)) continue;
        for (const [s, e] of block.ranges) {
            if (t >= s && t < e && (end === null || e > end)) end = e;
        }
    }
    return end;
}

// Si está cerrada pero todavía abre hoy, la hora del próximo turno; si no, null.
export function getOpensNext(parsed, now = new Date()) {
    if (!parsed || !parsed.parseable) return null;
    const day = now.getDay();
    const t = now.getHours() + now.getMinutes() / 60;
    let next = null;
    for (const block of parsed.blocks) {
        if (!block.days.includes(day)) continue;
        for (const [s] of block.ranges) {
            if (s > t && (next === null || s < next)) next = s;
        }
    }
    return next;
}

export function getOpenDays(parsed) {
    const set = new Set();
    if (parsed && parsed.parseable) {
        parsed.blocks.forEach(b => b.days.forEach(d => set.add(d)));
    }
    return set;
}

export function formatHour(h) {
    const hour = Math.floor(h);
    const min = Math.round((h - hour) * 60);
    const mm = min === 0 ? "" : ":" + String(min).padStart(2, "0");
    if (hour === 0 || hour === 24) return `12${mm} am`;
    if (hour === 12) return `12${mm} pm`;
    return hour > 12 ? `${hour - 12}${mm} pm` : `${hour}${mm} am`;
}

// Hora en formato 24h "HH:MM", que es lo que espera schema.org
export function formatHour24(h) {
    const hour = Math.min(23, Math.floor(h));
    const min = Math.round((h - Math.floor(h)) * 60);
    return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function formatDaysRaw(daysRaw) {
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

// Devuelve un string (cuando no hay bloques que formatear) o
// un array de { days, hours[] } listo para pintar.
export function formatScheduleToHuman(parsed, raw) {
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

// Texto plano de una línea, para meta descripciones y resúmenes
export function scheduleSummary(parsed, raw) {
    const formatted = formatScheduleToHuman(parsed, raw);
    if (typeof formatted === "string") return formatted;
    return formatted.map(l => `${l.days}: ${l.hours.join(", ")}`).join(" · ");
}

// -------------------------------------------------------------
// Enlaces
// -------------------------------------------------------------
export function buildWhatsAppLink(pool, text = "Hola, quisiera consultar sobre el horario de nado libre.") {
    let num = pool.whatsapp ? pool.whatsapp.replace(/\s+/g, '') : "";
    if (num && num.length === 9 && !num.startsWith("51")) num = "51" + num;
    return num ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : "";
}

export function buildNavLinks(pool) {
    return {
        maps: `https://www.google.com/maps/search/?api=1&query=${pool.lat},${pool.lng}`,
        waze: `https://waze.com/ul?ll=${pool.lat},${pool.lng}&navigate=yes`
    };
}

export function districtSlug(district) {
    return generateId(district);
}

// -------------------------------------------------------------
// Distancia
// -------------------------------------------------------------
// Haversine en kilómetros
export function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1).replace(".", ",")} km`;
}

export function formatPrice(priceNum) {
    return priceNum > 0 ? `S/. ${priceNum.toFixed(2)}` : "Consultar";
}
