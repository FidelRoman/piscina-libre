// -------------------------------------------------------------
// PiscinaLibre - Tarjeta de piscina
//
// Este módulo lo usan build.js (para dejar las tarjetas ya escritas en
// el HTML) y src/app.js (para repintarlas al filtrar). Tiene que ser el
// único sitio donde vive este marcado: si build y app divergen, la lista
// da un salto visible en cuanto el usuario toca un filtro.
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

    return `
            <article class="pool-card" id="card-${pool.id}" data-pool-id="${escapeHtml(pool.id)}">
                <div class="pool-image-area">
                    <span class="district-badge">${escapeHtml(pool.district)}</span>
                    <span class="price-badge">${icon("coins")} ${formatPrice(pool.priceNum)}</span>
                    <span class="status-slot" data-status-slot></span>
                    ${pool.image
                        ? `<img src="${escapeHtml(pool.image)}" alt="${escapeHtml(pool.name)}" width="560" height="172" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('img-failed');this.remove();">`
                        : ``}
                    <div class="pool-image-placeholder">${icon("waves")}</div>
                </div>

                <div class="pool-info">
                    <div class="pool-title-group">
                        <${H} class="pool-title">${title}</${H}>
                        <span class="reg-badge ${pool.regType}">${pool.regType === 'online' ? 'Online' : 'Presencial'}</span>
                    </div>

                    ${renderWeekStrip(openDays, parsed.parseable)}

                    <div class="pool-details-list">
                        <div class="detail-item">
                            ${icon("map-pin")}
                            <span>${escapeHtml(pool.address)}<span class="distance-chip" data-distance-chip hidden></span></span>
                        </div>
                        <div class="detail-item">
                            ${icon("clock")}
                            ${renderScheduleBlock(parsed, pool.schedule)}
                        </div>
                        <div class="detail-item">
                            ${icon("credit-card")}
                            <span>${escapeHtml(pool.price || 'Consultar precio')}</span>
                        </div>
                    </div>
                </div>

                <div class="pool-actions">
                    ${pool.regType === 'online' && pool.register.startsWith('http')
                        ? `<a href="${escapeHtml(pool.register)}" target="_blank" class="btn btn-primary" rel="noopener" data-track="reservar" data-pool="${escapeHtml(pool.name)}">Reservar vacante ${icon("external-link")}</a>`
                        : `<a href="${href}" class="btn btn-secondary">${icon("info")} Ver detalles y cómo llegar</a>`}
                    ${whatsAppLink ? `<a href="${whatsAppLink}" target="_blank" class="btn btn-whatsapp" title="Escribir por WhatsApp" aria-label="Escribir por WhatsApp a ${escapeHtml(pool.name)}" rel="noopener" data-track="whatsapp" data-pool="${escapeHtml(pool.name)}">${icon("phone")}</a>` : ''}
                    <div class="nav-buttons">
                        <button type="button" class="btn-icon-only" data-map-btn title="Ver en el mapa" aria-label="Ver ${escapeHtml(pool.name)} en el mapa">${icon("map")}</button>
                        <button type="button" class="btn-icon-only" data-share-btn title="Compartir" aria-label="Compartir ${escapeHtml(pool.name)}">${icon("share-2")}</button>
                        <a href="${nav.maps}" target="_blank" class="btn-icon-only" title="Abrir en Google Maps" aria-label="Abrir ${escapeHtml(pool.name)} en Google Maps" rel="noopener" data-track="navegar" data-pool="${escapeHtml(pool.name)}">${icon("navigation")}</a>
                        <a href="${nav.waze}" target="_blank" class="btn-icon-only" title="Abrir en Waze" aria-label="Abrir ${escapeHtml(pool.name)} en Waze" rel="noopener" data-track="navegar" data-pool="${escapeHtml(pool.name)}">${icon("compass")}</a>
                    </div>
                </div>
            </article>`;
}
