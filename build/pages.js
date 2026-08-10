// -------------------------------------------------------------
// PiscinaLibre - Generadores de página
// -------------------------------------------------------------

import { icon } from "../lib/icons.js";
import {
    escapeHtml, formatPrice, parseSchedule, scheduleSummary,
    getOpenDays, buildWhatsAppLink, buildNavLinks, districtSlug, parseRegisterInfo
} from "../lib/pools-core.js";
import { poolCardHTML, renderWeekStrip, renderScheduleBlock, districtHue } from "../lib/card.js";
import { layout, header, footer, breadcrumbsHTML, breadcrumbsJsonLd, SITE, relFor } from "./templates.js";
import {
    poolSchema, websiteSchema, personSchema, itemListSchema,
    faqSchema, articleSchema
} from "./schema.js";
import { GUIAS } from "../content/guias.js";

const FAQ = [
    {
        q: "¿Qué es la modalidad de nado libre en las piscinas de Lima?",
        a: "El nado libre es una modalidad en la que compras un turno de agua para entrenar por tu cuenta, sin instructor ni clase dirigida. Está pensada para quien ya sabe nadar, dura entre 45 y 60 minutos y es la forma más económica de usar una piscina en Lima."
    },
    {
        q: "¿Qué requisitos piden en las piscinas municipales de Lima?",
        a: "En la mayoría de sedes piden DNI original o carné de extranjería, ropa de baño deportiva, gorro de natación de silicona o tela y sandalias de jebe. Algunas sedes suman un certificado médico simple o una declaración jurada de salud."
    },
    {
        q: "¿Existen piscinas temperadas y techadas para nadar en Lima?",
        a: "Sí. Temperada, techada y climatizada no significan lo mismo: temperada es que el agua se calienta, techada solo que tiene cobertura. Para nadar cómodo en invierno conviene confirmar con la sede que el agua esté temperada y que el sistema de calentamiento esté operativo."
    },
    {
        q: "¿Cuánto cuesta la entrada para nado libre por turno?",
        a: "Depende de la sede: las municipales son las más económicas y los centros acuáticos con piscina de 50 metros o agua temperada son más caros. En PiscinaLibre puedes ver el precio actualizado de cada sede y ordenarlas de menor a mayor precio."
    },
    {
        q: "¿Cómo sé qué piscinas están abiertas ahora mismo?",
        a: "PiscinaLibre cruza tu hora local con el horario de cada sede: el botón «Abiertas ahora» deja en la lista solo las que están en turno en este momento, y cada tarjeta muestra si está abierta o cerrada."
    }
];

// -------------------------------------------------------------
// Piezas compartidas
// -------------------------------------------------------------
function faqHTML() {
    return FAQ.map(({ q, a }) => `
                    <details class="faq-item">
                        <summary>${escapeHtml(q)}</summary>
                        <p>${escapeHtml(a)}</p>
                    </details>`).join("");
}

function districtChips(rel, districts, activeSlug = null) {
    return `<div class="district-links">${districts.map(d =>
        d.slug === activeSlug
            ? `<span class="district-link active" aria-current="page">${escapeHtml(d.name)} <span>${d.count}</span></span>`
            : `<a class="district-link" href="${rel}piscinas/${d.slug}/">${escapeHtml(d.name)} <span>${d.count}</span></a>`
    ).join("")}</div>`;
}

function guideCards(rel, guides, excludeSlug = null) {
    const list = guides.filter(g => g.slug !== excludeSlug);
    return `<div class="guide-cards">${list.map(g => `
        <a class="guide-card" href="${rel}guias/${g.slug}/">
            <h3>${escapeHtml(g.title)}</h3>
            <p>${escapeHtml(g.summary)}</p>
            <span class="guide-card-more">Leer la guía ${icon("arrow-right")}</span>
        </a>`).join("")}</div>`;
}

// -------------------------------------------------------------
// Home (mapa + filtros)
// -------------------------------------------------------------
export function homePage({ pools, districts, builtAt }) {
    const rel = "";
    const cards = pools.map(p => poolCardHTML(p, { rel, heading: 2 })).join("");

    const main = `    <div class="app-container">
        <main class="content-area">
${header(rel, { homeIsCurrent: true })}
                <p class="brand-subtitle">Encuentra y reserva horarios de nado libre en las piscinas de Lima.</p>
            </header>

            <h1 class="sr-only">Piscinas de nado libre en Lima: horarios, precios y reservas</h1>

            <section class="controls-section" aria-label="Buscador y filtros">
                <div class="search-wrapper">
                    <label class="sr-only" for="search-input">Buscar piscina</label>
                    ${icon("search", "search-icon")}
                    <input type="search" id="search-input" placeholder="Buscar piscina, distrito o dirección" autocomplete="off">
                    <kbd class="search-hint" aria-hidden="true">/</kbd>
                    <button id="clear-search-btn" class="clear-btn" hidden aria-label="Limpiar búsqueda">${icon("x")}</button>
                </div>

                <div class="filter-bar">
                    <button class="filter-bar-btn" id="filters-toggle-btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="filter-sheet">
                        ${icon("sliders-horizontal")}
                        <span>Filtros</span>
                        <span class="filter-count-badge" id="filter-count-badge" data-filter-count hidden>0</span>
                        ${icon("chevron-down", "filter-bar-chevron")}
                    </button>
                    <button class="filter-bar-btn" data-action="filter-now" id="btn-filter-now-mobile" aria-pressed="false" title="Mostrar solo las abiertas ahora mismo">
                        ${icon("zap")}
                        <span>Abiertas ahora</span>
                    </button>
                    <button class="filter-bar-btn" id="btn-near-me" title="Ordenar de la más cercana a la más lejana">
                        ${icon("locate")}
                        <span>Cerca de mí</span>
                    </button>
                </div>

                <div class="filter-sheet" id="filter-sheet" role="dialog" aria-label="Filtros" aria-hidden="true">
                    <div class="sheet-header">
                        <span class="sheet-handle" aria-hidden="true"></span>
                        <h2 class="sheet-title">Filtros</h2>
                        <button class="sheet-close" id="sheet-close-btn" aria-label="Cerrar filtros">${icon("x")}</button>
                    </div>

                    <div class="sheet-body">
                        <div class="filter-group">
                            <span class="filter-label" id="label-registro">Registro</span>
                            <div class="filter-options" role="group" aria-labelledby="label-registro">
                                <button class="filter-chip active" data-filter="all" aria-pressed="true">Todas</button>
                                <button class="filter-chip" data-filter="online" aria-pressed="false">Registro online</button>
                                <button class="filter-chip" data-filter="presencial" aria-pressed="false">Presencial</button>
                            </div>
                        </div>

                        <div class="filter-group">
                            <span class="filter-label">Horario</span>
                            <div class="schedule-filter-options">
                                <div class="select-wrapper">
                                    ${icon("calendar", "select-icon")}
                                    <select id="filter-day-select" aria-label="Filtrar por día">
                                        <option value="all">Cualquier día</option>
                                        <option value="1">Lunes</option>
                                        <option value="2">Martes</option>
                                        <option value="3">Miércoles</option>
                                        <option value="4">Jueves</option>
                                        <option value="5">Viernes</option>
                                        <option value="6">Sábado</option>
                                        <option value="0">Domingo</option>
                                    </select>
                                    ${icon("chevron-down", "chevron")}
                                </div>

                                <div class="select-wrapper">
                                    ${icon("clock", "select-icon")}
                                    <select id="filter-hour-select" aria-label="Filtrar por hora">
                                        <option value="all">Cualquier hora</option>
${Array.from({ length: 18 }, (_, i) => i + 5).map(h => {
        const label = h === 12 ? "12:00 pm" : (h > 12 ? `${String(h - 12).padStart(2, "0")}:00 pm` : `${String(h).padStart(2, "0")}:00 am`);
        return `                                        <option value="${h}">${label}</option>`;
    }).join("\n")}
                                    </select>
                                    ${icon("chevron-down", "chevron")}
                                </div>
                            </div>
                        </div>

                        <div class="district-section">
                            <span class="filter-label" id="label-distritos">Distritos</span>
                            <div class="district-pills" id="district-pills-container" role="group" aria-labelledby="label-distritos"></div>
                        </div>
                    </div>

                    <div class="sheet-footer">
                        <button class="sheet-clear-btn" id="sheet-clear-btn">${icon("filter-x")} Limpiar</button>
                        <button class="sheet-apply-btn" id="sheet-apply-btn">Ver piscinas</button>
                    </div>
                </div>
            </section>

            <section class="pools-section" id="resultados" aria-label="Listado de piscinas" tabindex="-1">
                <div class="results-meta">
                    <p class="results-count" id="results-count" role="status" aria-live="polite">${pools.length} piscinas encontradas<span class="sr-only">, abiertas primero</span></p>
                    <div class="results-meta-actions">
                        <button id="clear-filters-btn" class="clear-filters-btn" hidden>
                            ${icon("filter-x")} Limpiar
                        </button>
                        <div class="select-wrapper sort-wrapper">
                            <label class="sr-only" for="sort-select">Ordenar resultados</label>
                            <select id="sort-select">
                                <option value="default">Abiertas primero</option>
                                <option value="distance">Más cercanas</option>
                                <option value="price-asc">Precio: menor a mayor</option>
                                <option value="price-desc">Precio: mayor a menor</option>
                                <option value="name-asc">Nombre: A-Z</option>
                            </select>
                            ${icon("chevron-down", "chevron")}
                        </div>
                    </div>
                </div>

                <div class="active-filters" id="active-filters" hidden></div>

                <p class="data-freshness" id="data-freshness" hidden></p>

                <div id="pools-list" class="pools-grid">${cards}
                </div>

                <div id="no-results" class="no-results-state" hidden>
                    <span class="no-results-art" aria-hidden="true">${icon("search-x")}</span>
                    <h2>Ninguna piscina coincide</h2>
                    <p>Ningún resultado con estos filtros. Prueba quitando alguno:</p>
                    <div class="no-results-actions" id="no-results-actions"></div>
                    <button id="reset-filters-btn" class="btn btn-secondary">${icon("filter-x")} Limpiar todos los filtros</button>
                </div>
            </section>

            <section class="seo-content-section" aria-label="Información sobre nado libre en Lima">
                <article class="seo-guide-block">
                    <h2>Piscinas de nado libre en Lima</h2>
                    <p>
                        <strong>PiscinaLibre</strong> reúne las piscinas municipales y públicas de Lima que ofrecen
                        turnos de <strong>nado libre</strong>: el horario real de cada sede, cuánto cuesta el turno,
                        si se reserva online o presencialmente y cómo llegar. Ahora mismo hay
                        <strong>${pools.length} sedes</strong> en ${districts.length} distritos, y los datos se
                        actualizan a diario.
                    </p>
                    <p>Busca por distrito:</p>
                    ${districtChips(rel, districts)}
                </article>

                <article class="seo-faq-block">
                    <h2>Preguntas frecuentes sobre nado libre en Lima</h2>
${faqHTML()}
                </article>

                <article class="seo-guide-block">
                    <h2>Guías para nadar en Lima</h2>
                    ${guideCards(rel, GUIAS)}
                </article>
            </section>

${footer(rel, { districts, guides: GUIAS, builtAt })}
        </main>

        <aside class="map-area" id="map-area-container" data-state="idle" aria-label="Mapa de las piscinas">
            <div id="map" role="application" aria-label="Mapa de piscinas de nado libre en Lima"></div>

            <div class="map-skeleton" aria-hidden="true">
                <span class="map-skeleton-grid"></span>
                <span class="map-skeleton-shimmer"></span>
            </div>

            <div class="map-error" role="alert">
                ${icon("circle-alert", "map-error-icon")}
                <p>No pudimos cargar el mapa.</p>
                <button type="button" class="btn btn-secondary" id="map-retry-btn">${icon("refresh-cw")} Reintentar</button>
            </div>

            <button type="button" class="map-fit-btn" id="map-fit-btn" hidden>
                ${icon("maximize")} Ver todos los resultados
            </button>
        </aside>

        <div class="mobile-fabs">
            <button class="mobile-view-toggle" id="mobile-view-toggle-btn" aria-label="Cambiar entre lista y mapa">
                <span class="toggle-content-list">${icon("map")} Ver mapa</span>
                <span class="toggle-content-map" hidden>${icon("list")} Ver lista</span>
            </button>
            <button class="mobile-view-toggle map-filters-btn" id="map-filters-btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="filter-sheet">
                ${icon("sliders-horizontal")} Filtros
                <span class="filter-count-badge" id="filter-count-badge-map" data-filter-count hidden>0</span>
            </button>
            <button class="mobile-view-toggle map-now-btn" data-action="filter-now" id="btn-filter-now-map" aria-pressed="false" aria-label="Mostrar solo las abiertas ahora mismo" title="Mostrar solo las abiertas ahora mismo">
                ${icon("zap")}
            </button>
        </div>

        <div class="sheet-backdrop" id="sheet-backdrop"></div>
    </div>`;

    return layout({
        title: "Piscinas de nado libre en Lima | Horarios, precios y reservas | PiscinaLibre",
        description: `Encuentra piscinas de nado libre en Lima. Filtra por distrito, precio, día y hora, y mira cuáles están abiertas ahora mismo. Datos actualizados a diario.`,
        path: "",
        main,
        pools,
        jsonLd: [
            websiteSchema(),
            personSchema(),
            itemListSchema(pools, "Piscinas de nado libre en Lima"),
            faqSchema(FAQ)
        ]
    });
}

// -------------------------------------------------------------
// Plantilla de contenido (sin mapa ni Leaflet)
// -------------------------------------------------------------
function contentPage({ path, title, description, jsonLd, trail, hero, body, districts, builtAt, ogImage, ogType, pools = [] }) {
    const rel = relFor(path);
    const main = `    <div class="page-shell">
        <div class="page-inner">
${header(rel)}
            </header>

            ${breadcrumbsHTML(rel, trail)}

            <main class="page-main" id="contenido" tabindex="-1">
                ${hero}
                ${body}
            </main>

${footer(rel, { districts, guides: GUIAS, builtAt })}
        </div>
    </div>`;

    return layout({
        title, description, path, main, jsonLd, ogImage, ogType, pools,
        bodyClass: "page-content"
    });
}

// -------------------------------------------------------------
// Página de distrito
// -------------------------------------------------------------
export function districtPage({ district, pools, districts, builtAt }) {
    const path = `piscinas/${district.slug}/`;
    const rel = relFor(path);
    const min = pools.reduce((m, p) => (p.priceNum > 0 && (m === null || p.priceNum < m) ? p.priceNum : m), null);
    const online = pools.filter(p => p.regType === "online").length;

    const title = `Piscinas de nado libre en ${district.name} | Horarios y precios | PiscinaLibre`;
    const description = `${pools.length} ${pools.length === 1 ? "piscina" : "piscinas"} con nado libre en ${district.name}, Lima.` +
        (min !== null ? ` Turnos desde ${formatPrice(min)}.` : "") +
        ` Horarios, precios y cómo reservar.`;

    const hero = `
                <div class="page-hero">
                    <span class="page-eyebrow">${icon("map-pin")} ${escapeHtml(district.name)}, Lima</span>
                    <h1>Piscinas de nado libre en ${escapeHtml(district.name)}</h1>
                    <p class="page-lead">
                        ${pools.length === 1
            ? `Hay <strong>1 piscina</strong> con turnos de nado libre registrada en ${escapeHtml(district.name)}.`
            : `Hay <strong>${pools.length} piscinas</strong> con turnos de nado libre registradas en ${escapeHtml(district.name)}.`}
                        ${min !== null ? ` El turno más económico cuesta <strong>${formatPrice(min)}</strong>.` : ""}
                        ${online > 0 ? ` ${online === 1 ? "Una acepta" : `${online} aceptan`} reserva online.` : " Todas se reservan presencialmente."}
                    </p>
                    <a class="page-cta" href="${rel}?distrito=${encodeURIComponent(district.name)}">
                        ${icon("map")} Ver ${escapeHtml(district.name)} en el mapa
                    </a>
                </div>`;

    const body = `
                <section class="pools-section page-pools" aria-label="Piscinas en ${escapeHtml(district.name)}">
                    <div class="pools-grid">${pools.map(p => poolCardHTML(p, { rel, heading: 2 })).join("")}
                    </div>
                </section>

                <section class="page-section">
                    <h2>Otros distritos con piscinas de nado libre</h2>
                    ${districtChips(rel, districts, district.slug)}
                </section>

                <section class="page-section">
                    <h2>Antes de ir a nadar</h2>
                    ${guideCards(rel, GUIAS)}
                </section>`;

    return contentPage({
        path, title, description, districts, builtAt, pools,
        trail: [
            { name: "Inicio", path: "" },
            { name: "Distritos", path: "piscinas/" },
            { name: district.name, path }
        ],
        jsonLd: [
            websiteSchema(),
            personSchema(),
            breadcrumbsJsonLd([
                { name: "Inicio", path: "" },
                { name: "Distritos", path: "piscinas/" },
                { name: district.name, path }
            ]),
            itemListSchema(pools, `Piscinas de nado libre en ${district.name}`),
            ...pools.map(p => poolSchema(p))
        ],
        hero, body
    });
}

// Índice de distritos
export function districtIndexPage({ districts, pools, builtAt }) {
    const path = "piscinas/";
    const rel = relFor(path);
    const trail = [{ name: "Inicio", path: "" }, { name: "Distritos", path }];

    const hero = `
                <div class="page-hero">
                    <span class="page-eyebrow">${icon("map-pin")} Lima</span>
                    <h1>Piscinas de nado libre por distrito</h1>
                    <p class="page-lead">${pools.length} sedes repartidas en ${districts.length} distritos de Lima. Elige el tuyo para ver horarios, precios y cómo reservar.</p>
                </div>`;

    const body = `
                <section class="page-section">
                    <div class="district-cards">${districts.map(d => `
                        <a class="district-card" href="${rel}piscinas/${d.slug}/">
                            <h2>${escapeHtml(d.name)}</h2>
                            <p>${d.count} ${d.count === 1 ? "piscina" : "piscinas"}${d.minPrice !== null ? ` · desde ${formatPrice(d.minPrice)}` : ""}</p>
                            <span class="guide-card-more">Ver piscinas ${icon("arrow-right")}</span>
                        </a>`).join("")}
                    </div>
                </section>

                <section class="page-section">
                    <h2>Guías para nadar en Lima</h2>
                    ${guideCards(rel, GUIAS)}
                </section>`;

    return contentPage({
        path,
        title: "Piscinas de nado libre por distrito en Lima | PiscinaLibre",
        description: `Piscinas con nado libre en ${districts.map(d => d.name).slice(0, 6).join(", ")} y más distritos de Lima. Horarios, precios y reservas.`,
        districts, builtAt, trail, hero, body,
        jsonLd: [
            websiteSchema(), personSchema(), breadcrumbsJsonLd(trail),
            itemListSchema(pools, "Piscinas de nado libre en Lima")
        ]
    });
}

// -------------------------------------------------------------
// Ficha de piscina
// -------------------------------------------------------------
export function poolPage({ pool, districtPools, districts, builtAt }) {
    const path = `piscina/${pool.id}/`;
    const rel = relFor(path);
    const parsed = pool.parsed || parseSchedule(pool.schedule);
    const registerInfo = parseRegisterInfo(pool.register);
    const wa = buildWhatsAppLink(pool);
    const nav = buildNavLinks(pool);
    const others = districtPools.filter(p => p.id !== pool.id);
    const dSlug = districtSlug(pool.district);

    const trail = [
        { name: "Inicio", path: "" },
        { name: "Distritos", path: "piscinas/" },
        { name: pool.district, path: `piscinas/${dSlug}/` },
        { name: pool.name, path }
    ];

    const title = `${pool.name} — nado libre en ${pool.district} | Horarios y precio | PiscinaLibre`;
    const description = `${pool.name}, ${pool.district}. ${pool.priceNum > 0 ? `Turno de nado libre a ${formatPrice(pool.priceNum)}. ` : ""}${scheduleSummary(parsed, pool.schedule)}`.slice(0, 300);

    const hero = `
                <div class="page-hero pool-hero">
                    <span class="page-eyebrow">${icon("map-pin")} <a href="${rel}piscinas/${dSlug}/">${escapeHtml(pool.district)}</a>,&nbsp;Lima</span>
                    <h1>${escapeHtml(pool.name)}</h1>
                    <p class="page-lead">Turnos de nado libre en ${escapeHtml(pool.district)}${pool.priceNum > 0 ? ` desde <strong>${formatPrice(pool.priceNum)}</strong>` : ""}. ${pool.regType === "online" ? "Acepta reserva online." : "El registro es presencial en la sede."}</p>
                </div>`;

    // Las imágenes son enlaces a los servidores de cada municipalidad, que
    // caen o cambian de ruta sin aviso: si falla, initImageFallback marca
    // el contenedor y el CSS lo colapsa, en vez de dejar un hueco vacío
    // del alto del héroe. Mientras tanto se ve el color del distrito, el
    // mismo que usan las tarjetas.
    //
    // Sin fetchpriority alto a propósito: son ficheros ajenos y sin
    // optimizar (los hay de 40 megapíxeles), así que adelantarlos al resto
    // de la página sale caro y no lo controlamos.
    const gallery = pool.image
        ? `<div class="pool-page-image" data-img-holder style="--district-hue:${districtHue(pool.district)}"><img src="${escapeHtml(pool.image)}" alt="${escapeHtml(pool.name)}" width="1040" height="420" decoding="async"></div>`
        : "";

    const facts = `
                    <dl class="fact-grid">
                        <div class="fact">
                            <dt>${icon("coins")} Precio del turno</dt>
                            <dd>${escapeHtml(pool.price || "Consultar en la sede")}</dd>
                        </div>
                        <div class="fact">
                            <dt>${icon("map-pin")} Dirección</dt>
                            <dd>${escapeHtml(pool.address)}</dd>
                        </div>
                        <div class="fact">
                            <dt>${icon("info")} Registro</dt>
                            <dd>${pool.regType === "online" && registerInfo.url
            ? `${registerInfo.text ? `${escapeHtml(registerInfo.text)}. ` : ""}Online — <a href="${escapeHtml(registerInfo.url)}" target="_blank" rel="noopener" data-track="reservar" data-pool="${escapeHtml(pool.name)}">reservar aquí</a>`
            : escapeHtml(pool.register || "Presencial")}</dd>
                        </div>
                        <div class="fact">
                            <dt>${icon("clock")} Días que abre</dt>
                            <dd>${renderWeekStrip(getOpenDays(parsed), parsed.parseable)}</dd>
                        </div>
                    </dl>`;

    const actions = `
                    <div class="pool-page-actions">
                        ${pool.regType === "online" && registerInfo.url
            ? `<a class="btn btn-primary" href="${escapeHtml(registerInfo.url)}" target="_blank" rel="noopener" data-track="reservar" data-pool="${escapeHtml(pool.name)}">Reservar vacante ${icon("external-link")}</a>`
            : ""}
                        ${wa ? `<a class="btn btn-whatsapp" href="${wa}" target="_blank" rel="noopener" data-track="whatsapp" data-pool="${escapeHtml(pool.name)}">${icon("phone")} Consultar por WhatsApp</a>` : ""}
                        <a class="btn btn-secondary" href="${nav.maps}" target="_blank" rel="noopener" data-track="navegar" data-pool="${escapeHtml(pool.name)}">${icon("navigation")} Google Maps</a>
                        <a class="btn btn-secondary" href="${nav.waze}" target="_blank" rel="noopener" data-track="navegar" data-pool="${escapeHtml(pool.name)}">${icon("compass")} Waze</a>
                    </div>`;

    const body = `
                <section class="page-section">
                    ${gallery}
                    ${facts}
                    ${actions}
                </section>

                <section class="page-section">
                    <h2>Horarios de nado libre</h2>
                    <div class="pool-page-schedule">${renderScheduleBlock(parsed, pool.schedule)}</div>
                    <p class="guide-note">${icon("circle-alert")} Los horarios de las piscinas municipales cambian por mantenimiento, feriados y campeonatos. Confirma con la sede antes de ir.</p>
                </section>

                <section class="page-section">
                    <h2>Qué necesitas para entrar</h2>
                    <p>La mayoría de sedes municipales de Lima piden DNI, gorro de natación, ropa de baño deportiva y sandalias de jebe. Algunas suman certificado médico o declaración jurada de salud. Lo tienes detallado en la guía de <a href="${rel}guias/requisitos-piscina-municipal-lima/">requisitos para entrar a una piscina municipal</a>.</p>
                </section>

                ${others.length ? `
                <section class="page-section">
                    <h2>Otras piscinas en ${escapeHtml(pool.district)}</h2>
                    <div class="pools-grid">${others.map(p => poolCardHTML(p, { rel, heading: 3 })).join("")}
                    </div>
                </section>` : `
                <section class="page-section">
                    <h2>Piscinas en otros distritos</h2>
                    ${districtChips(rel, districts, dSlug)}
                </section>`}

                <section class="page-section">
                    <h2>Guías para nadar en Lima</h2>
                    ${guideCards(rel, GUIAS)}
                </section>`;

    return contentPage({
        path, title, description, districts, builtAt, trail, hero, body,
        pools: [pool, ...others],
        ogType: "article",
        ogImage: pool.image || undefined,
        jsonLd: [
            websiteSchema(), personSchema(), breadcrumbsJsonLd(trail), poolSchema(pool)
        ]
    });
}

// -------------------------------------------------------------
// Guías
// -------------------------------------------------------------
export function guidePage({ guide, pools, districts, builtAt }) {
    const path = `guias/${guide.slug}/`;
    const rel = relFor(path);
    const trail = [
        { name: "Inicio", path: "" },
        { name: "Guías", path: "guias/" },
        { name: guide.title, path }
    ];

    const ctx = {
        pools, rel, formatPrice, escapeHtml,
        poolPath: (p) => `${rel}piscina/${p.id}/`,
        districtPath: (slug) => `${rel}piscinas/${slug}/`
    };

    const hero = `
                <div class="page-hero">
                    <span class="page-eyebrow">${icon("sparkles")} Guía</span>
                    <h1>${escapeHtml(guide.title)}</h1>
                    <p class="page-lead">${escapeHtml(guide.summary)}</p>
                </div>`;

    const body = `
                <article class="guide-body">${guide.html(ctx)}</article>

                <section class="page-section">
                    <h2>Sigue leyendo</h2>
                    ${guideCards(rel, GUIAS, guide.slug)}
                </section>

                <section class="page-section">
                    <h2>Busca tu piscina</h2>
                    ${districtChips(rel, districts)}
                </section>`;

    return contentPage({
        path,
        title: `${guide.title} | PiscinaLibre`,
        description: guide.description,
        districts, builtAt, trail, hero, body,
        ogType: "article",
        jsonLd: [
            websiteSchema(), personSchema(), breadcrumbsJsonLd(trail),
            articleSchema({ title: guide.title, description: guide.description, path, builtAt })
        ]
    });
}

export function guideIndexPage({ districts, builtAt }) {
    const path = "guias/";
    const rel = relFor(path);
    const trail = [{ name: "Inicio", path: "" }, { name: "Guías", path }];

    const hero = `
                <div class="page-hero">
                    <span class="page-eyebrow">${icon("sparkles")} Guías</span>
                    <h1>Guías para nadar en Lima</h1>
                    <p class="page-lead">Todo lo que conviene saber antes de tu primer turno de nado libre: requisitos, qué llevar, cuánto cuesta y dónde nadar en invierno.</p>
                </div>`;

    const body = `
                <section class="page-section">
                    ${guideCards(rel, GUIAS)}
                </section>`;

    return contentPage({
        path,
        title: "Guías para nadar en Lima | PiscinaLibre",
        description: "Requisitos, qué llevar, precios y piscinas temperadas: las guías para empezar a nadar en las piscinas públicas de Lima.",
        districts, builtAt, trail, hero, body,
        jsonLd: [websiteSchema(), personSchema(), breadcrumbsJsonLd(trail)]
    });
}

// -------------------------------------------------------------
// Privacidad
// -------------------------------------------------------------
export function privacyPage({ districts, builtAt }) {
    const path = "privacidad/";
    const trail = [{ name: "Inicio", path: "" }, { name: "Privacidad", path }];

    const hero = `
                <div class="page-hero">
                    <h1>Política de privacidad</h1>
                    <p class="page-lead">Qué datos maneja PiscinaLibre y qué no.</p>
                </div>`;

    const body = `
                <article class="guide-body">
                    <h2>Quién es responsable</h2>
                    <p>PiscinaLibre es un proyecto personal de ${SITE.author}. Para cualquier consulta sobre privacidad puedes escribir a <a href="mailto:${SITE.email}">${SITE.email}</a>.</p>

                    <h2>Datos que no recogemos</h2>
                    <p>Este sitio no tiene cuentas de usuario, ni formularios, ni base de datos propia. No te pedimos nombre, correo, teléfono ni ningún otro dato personal para usarlo.</p>

                    <h2>Datos que se quedan en tu navegador</h2>
                    <p>Usamos el almacenamiento local de tu navegador para recordar dos cosas: el tema claro u oscuro que elegiste y una copia del listado de piscinas para que la página cargue rápido la siguiente vez. Esa información nunca sale de tu dispositivo y puedes borrarla vaciando los datos del sitio.</p>

                    <h2>Ubicación</h2>
                    <p>Si pulsas el botón de ubicación o eliges ordenar por cercanía, tu navegador te pedirá permiso para compartir tu ubicación. Se usa únicamente para centrar el mapa y calcular a qué distancia tienes cada piscina, se procesa en tu propio dispositivo y no se envía ni se guarda en ningún servidor.</p>

                    <h2>Analítica</h2>
                    <p>Usamos Google Analytics 4 para saber cuántas personas visitan el sitio y qué secciones les resultan útiles. Se recogen datos agregados de navegación con la IP anonimizada. Puedes bloquearlo con cualquier extensión de bloqueo o con la <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">extensión de inhabilitación de Google Analytics</a>.</p>

                    <h2>Servicios de terceros</h2>
                    <p>Al cargar la página, tu navegador solicita recursos a otros servicios, que reciben tu dirección IP como parte de esa petición: Google Fonts (tipografías), OpenStreetMap y CARTO (mapas), y GitHub Pages (alojamiento). Los enlaces de reserva, WhatsApp, Google Maps y Waze te llevan a sitios externos con sus propias políticas.</p>

                    <h2>Datos de las piscinas</h2>
                    <p>La información de horarios, precios y direcciones se recopila de fuentes públicas de municipalidades y plataformas de reserva. Puede contener errores o quedar desactualizada. Si detectas algo incorrecto, escríbenos a <a href="mailto:${SITE.email}">${SITE.email}</a> y lo corregimos.</p>

                    <h2>Cambios</h2>
                    <p>Si esta política cambia, se actualizará esta página. Última revisión: ${builtAt.human}.</p>
                </article>`;

    return contentPage({
        path,
        title: "Política de privacidad | PiscinaLibre",
        description: "Qué datos recoge PiscinaLibre, qué se guarda en tu navegador y qué servicios de terceros intervienen.",
        districts, builtAt, trail, hero, body,
        jsonLd: [websiteSchema(), personSchema(), breadcrumbsJsonLd(trail)]
    });
}

export { FAQ };
