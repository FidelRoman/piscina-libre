// -------------------------------------------------------------
// PiscinaLibre - Tarjeta de piscina
//
// Este módulo lo usan build.js (para dejar las tarjetas ya escritas en
// el HTML) y src/app.js (para repintarlas al filtrar). Tiene que ser el
// único sitio donde vive este marcado: si build y app divergen, la lista
// da un salto visible en cuanto el usuario toca un filtro.
//
// Corre también en Node, así que aquí no se pueden usar APIs del DOM.
//
// El estado "Abierto ahora" NO se genera aquí, porque depende de la hora
// en que se mira la página y el HTML estático se sirve cacheado. Se deja
// un hueco con altura reservada que app.js rellena al cargar.
// -------------------------------------------------------------

import { icon } from "./icons.js";
import {
    escapeHtml, buildWhatsAppLink, buildNavLinks, formatPrice,
    getOpenDays, formatScheduleToHuman, parseSchedule,
    DAY_LABELS, DAY_LABELS_LONG, WEEK_ORDER
} from "./pools-core.js";

export function poolPath(pool, rel = "") {
    return `${rel}piscina/${pool.id}/`;
}

export function renderWeekStrip(openDays, parseable) {
    if (!parseable) {
        return `<div class="week-strip unknown"><span class="week-unknown">Horario por confirmar</span></div>`;
    }
    const cells = WEEK_ORDER.map(d => {
        const on = openDays.has(d);
        return `<span class="day-cell ${on ? 'on' : 'off'}"><span class="sr-only">${DAY_LABELS_LONG[d]}: ${on ? 'abierto' : 'cerrado'}</span><span aria-hidden="true">${DAY_LABELS[d][0]}</span></span>`;
    }).join('');
    return `<div class="week-strip" role="group" aria-label="Días en que abre">${cells}</div>`;
}

export function renderScheduleBlock(parsed, raw) {
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

// -------------------------------------------------------------
// Imagen de respaldo
// -------------------------------------------------------------
// Muchas sedes no tienen foto en el Sheet y las que la tienen apuntan a
// servidores municipales que caen o bloquean el hotlinking. En vez de un
// hueco gris igual para todas, cada distrito recibe un tono estable
// derivado de su nombre, de modo que la lista sigue siendo legible de un
// vistazo aunque no cargue ninguna imagen.
// El tono se acota a la franja acuática (turquesa → azul → índigo): un
// hash libre sobre los 360° saca marrones y mostazas que en una web de
// piscinas se leen como una foto mal cargada.
export function districtHue(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return 170 + (h % 90);
}

export function districtInitials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function mediaFallback(district) {
    return `<div class="pool-media-fallback" aria-hidden="true">
                        <span class="fallback-initials">${escapeHtml(districtInitials(district))}</span>
                        ${icon("waves", "fallback-waves")}
                    </div>`;
}

// opts.rel        prefijo relativo hasta la raíz del sitio ("", "../../", …)
// opts.heading    nivel de encabezado del título (2 por defecto)
// opts.linkTitle  si el título enlaza a la ficha de la piscina
export function poolCardHTML(pool, opts = {}) {
    const { rel = "", heading = 2, linkTitle = true } = opts;
    const parsed = pool.parsed || (pool.parsed = parseSchedule(pool.schedule));
    const whatsAppLink = buildWhatsAppLink(pool);
    const nav = buildNavLinks(pool);
    const openDays = getOpenDays(parsed);
    const href = poolPath(pool, rel);
    const H = `h${heading}`;

    const title = linkTitle
        ? `<a href="${href}" class="pool-title-link">${escapeHtml(pool.name)}</a>`
        : escapeHtml(pool.name);

    // alt vacío a propósito: el título va justo debajo, así que la foto no
    // aporta información nueva, y si falla no deja un texto roto encima
    // del respaldo.
    const image = pool.image
        ? `<img class="pool-media-img" src="${escapeHtml(pool.image)}" alt="" loading="lazy" decoding="async">`
        : ``;

    return `
            <article class="pool-card" id="card-${pool.id}" data-pool-id="${escapeHtml(pool.id)}">
                <div class="pool-media" data-img-holder style="--district-hue:${districtHue(pool.district)}">
                    ${mediaFallback(pool.district)}
                    ${image}
                    <div class="pool-media-badges">
                        <span class="badge badge-district">${escapeHtml(pool.district)}</span>
                        <span class="badge badge-price">${formatPrice(pool.priceNum)}</span>
                    </div>
                    <span class="status-slot" data-status-slot></span>
                </div>

                <div class="pool-info">
                    <${H} class="pool-title">${title}</${H}>

                    <p class="pool-address">
                        ${icon("map-pin")}
                        <span>${escapeHtml(pool.address)}<span class="distance-chip" data-distance-chip hidden></span></span>
                    </p>

                    <div class="pool-week">
                        ${renderWeekStrip(openDays, parsed.parseable)}
                        <span class="reg-badge ${pool.regType}">${pool.regType === 'online' ? 'Registro online' : 'Presencial'}</span>
                    </div>

                    <div class="pool-schedule">
                        ${icon("clock")}
                        ${renderScheduleBlock(parsed, pool.schedule)}
                    </div>
                </div>

                <div class="pool-actions">
                    ${pool.regType === 'online' && pool.register.startsWith('http')
                        ? `<a href="${escapeHtml(pool.register)}" target="_blank" class="btn btn-primary" rel="noopener" data-track="reservar" data-pool="${escapeHtml(pool.name)}">Reservar vacante ${icon("external-link")}</a>`
                        : `<a href="${href}" class="btn btn-secondary">${icon("info")} Ver detalles</a>`}
                    <div class="pool-action-icons">
                        <button type="button" class="btn-icon-only" data-map-btn title="Ver en el mapa" aria-label="Ver ${escapeHtml(pool.name)} en el mapa">${icon("map")}</button>
                        <button type="button" class="btn-icon-only" data-share-btn title="Compartir" aria-label="Compartir ${escapeHtml(pool.name)}">${icon("share-2")}</button>
                        <a href="${nav.maps}" target="_blank" class="btn-icon-only" title="Abrir en Google Maps" aria-label="Abrir ${escapeHtml(pool.name)} en Google Maps" rel="noopener" data-track="navegar" data-pool="${escapeHtml(pool.name)}">${icon("navigation")}</a>
                        <a href="${nav.waze}" target="_blank" class="btn-icon-only" title="Abrir en Waze" aria-label="Abrir ${escapeHtml(pool.name)} en Waze" rel="noopener" data-track="navegar" data-pool="${escapeHtml(pool.name)}">${icon("compass")}</a>
                        ${whatsAppLink ? `<a href="${whatsAppLink}" target="_blank" class="btn-icon-only btn-whatsapp" title="Escribir por WhatsApp" aria-label="Escribir por WhatsApp a ${escapeHtml(pool.name)}" rel="noopener" data-track="whatsapp" data-pool="${escapeHtml(pool.name)}">${icon("phone")}</a>` : ''}
                    </div>
                </div>
            </article>`;
}
