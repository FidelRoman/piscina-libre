// -------------------------------------------------------------
// PiscinaLibre - Plantillas del sitio
//
// Dos plantillas: `appPage` (la home, con mapa y filtros) y `contentPage`
// (distritos, fichas, guías: sin mapa ni JS de terceros).
// Ambas comparten `layout`, que produce el <head>, la cabecera y el pie.
//
// Las rutas se construyen con prefijos relativos (`rel`) calculados por
// profundidad, para que el sitio funcione igual servido en la raíz
// (preview local) y bajo /piscina-libre/ (GitHub Pages).
// -------------------------------------------------------------

import { icon, logoMark } from "../lib/icons.js";
import { escapeHtml } from "../lib/pools-core.js";

export const SITE = {
    name: "PiscinaLibre",
    url: "https://fidelroman.github.io/piscina-libre/",
    description: "Directorio de piscinas de nado libre en Lima: horarios, precios, distritos y cómo reservar.",
    locale: "es_PE",
    author: "Fidel Román",
    email: "fidel.roman@outlook.com",

    // Pega aquí tu ID de Google Analytics 4 (formato G-XXXXXXXXXX).
    // Mientras esté vacío no se carga gtag.js en ninguna página.
    ga4Id: "G-XGG5D5DDHV",

    // Pega aquí el enlace de invitación de tu canal de WhatsApp
    // (https://whatsapp.com/channel/...). Mientras esté vacío, la
    // llamada a la acción del pie no se muestra.
    whatsappChannel: ""
};

export const OG_IMAGE = "og-image.jpg";

// Prefijo relativo hasta la raíz del sitio para una ruta de N niveles.
// "" → "", "guias/" → "../", "piscinas/barranco/" → "../../"
export function relFor(path) {
    const depth = path.split("/").filter(Boolean).length;
    return "../".repeat(depth);
}

function absolute(path) {
    return SITE.url + path;
}

function metaTags({ title, description, path, ogType = "website", ogImage }) {
    const canonical = absolute(path);
    const image = ogImage || absolute(OG_IMAGE);
    return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${canonical}">

    <meta property="og:site_name" content="${SITE.name}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="${ogType}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:locale" content="${SITE.locale}">
    <meta property="og:image" content="${escapeHtml(image)}">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">`;
}

function analytics() {
    if (!SITE.ga4Id) {
        return `
    <!-- Google Analytics 4: pega tu Measurement ID en SITE.ga4Id
         (build/templates.js) y se inyectará en todas las páginas. -->`;
    }
    return `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${SITE.ga4Id}"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${SITE.ga4Id}', { anonymize_ip: true });
    </script>`;
}

// Aplica el tema antes del primer pintado para evitar el destello claro
const THEME_BOOT = `<script>
        (function () {
            try {
                var t = localStorage.getItem("pl-theme");
                if (t !== "light" && t !== "dark") {
                    t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                }
                document.documentElement.setAttribute("data-theme", t);
            } catch (e) { /* sin localStorage: se queda el tema claro */ }
        })();
    </script>`;

function header(rel, { homeIsCurrent = false } = {}) {
    const brand = `
                    <span class="logo-icon">${logoMark(22)}</span>
                    <span class="brand-title">Piscina<span>Libre</span></span>`;
    return `
            <header class="hero-header">
                <div class="brand-row">
                    ${homeIsCurrent
                        ? `<div class="brand">${brand}</div>`
                        : `<a class="brand" href="${rel}">${brand}</a>`}
                    <button class="theme-toggle" id="theme-toggle" aria-label="Cambiar tema claro / oscuro" title="Cambiar tema">${icon("moon")}</button>
                </div>`;
}

export function breadcrumbsHTML(rel, trail) {
    if (!trail.length) return "";
    const items = trail.map((c, i) => {
        const last = i === trail.length - 1;
        return last
            ? `<li aria-current="page">${escapeHtml(c.name)}</li>`
            : `<li><a href="${rel}${c.path}">${escapeHtml(c.name)}</a></li>${icon("chevron-right", "crumb-sep")}`;
    }).join("");
    return `<nav class="breadcrumbs" aria-label="Ruta de navegación"><ol>${items}</ol></nav>`;
}

export function breadcrumbsJsonLd(trail) {
    return {
        "@type": "BreadcrumbList",
        itemListElement: trail.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            item: absolute(c.path)
        }))
    };
}

function footer(rel, { districts = [], guides = [], builtAt }) {
    const districtLinks = districts.map(d =>
        `<li><a href="${rel}piscinas/${d.slug}/">Piscinas en ${escapeHtml(d.name)}</a></li>`
    ).join("");
    const guideLinks = guides.map(g =>
        `<li><a href="${rel}guias/${g.slug}/">${escapeHtml(g.title)}</a></li>`
    ).join("");

    const suggestMail = `mailto:${SITE.email}?subject=${encodeURIComponent("Sugerir una piscina para PiscinaLibre")}&body=${encodeURIComponent("Nombre de la piscina:\nDirección y distrito:\nPrecio del turno:\nHorarios de nado libre:\nCómo se reserva (web o presencial):\nTeléfono o WhatsApp:\n")}`;
    const reportMail = `mailto:${SITE.email}?subject=${encodeURIComponent("Reportar un dato incorrecto en PiscinaLibre")}&body=${encodeURIComponent("Piscina:\nDato incorrecto:\nDato correcto:\nCómo lo sabes (opcional):\n")}`;
    const adminMail = `mailto:${SITE.email}?subject=${encodeURIComponent("Quiero publicar mi piscina en PiscinaLibre")}&body=${encodeURIComponent("Nombre de la sede:\nDirección y distrito:\nPrecio del turno de nado libre:\nHorarios:\nCómo se reserva:\nContacto:\n")}`;

    const channelCta = SITE.whatsappChannel
        ? `<a class="footer-cta-btn" href="${SITE.whatsappChannel}" target="_blank" rel="noopener" data-track="canal_whatsapp">${icon("message-circle")} Unirme al canal</a>`
        : `<!-- Canal de WhatsApp: pega el enlace de invitación en SITE.whatsappChannel
             (build/templates.js) y este botón aparecerá en todas las páginas. -->`;

    return `
            <footer class="main-footer">
                <div class="footer-cta">
                    <div class="footer-cta-text">
                        <strong>${icon("sparkles")} ¿Nuevas piscinas y cambios de horario?</strong>
                        <span>Avisamos cuando se suma una sede o cambia un horario.</span>
                    </div>
                    ${channelCta}
                </div>

                <div class="footer-grid">
                    <nav class="footer-col" aria-label="Piscinas por distrito">
                        <h2>Por distrito</h2>
                        <ul>${districtLinks}</ul>
                    </nav>
                    <nav class="footer-col" aria-label="Guías">
                        <h2>Guías</h2>
                        <ul>${guideLinks}</ul>
                    </nav>
                    <div class="footer-col">
                        <h2>Colabora</h2>
                        <ul>
                            <li><a href="${suggestMail}">Sugerir una piscina</a></li>
                            <li><a href="${reportMail}">Reportar un dato incorrecto</a></li>
                            <li><a href="${adminMail}"><strong>¿Administras una piscina?</strong></a></li>
                        </ul>
                    </div>
                </div>

                <div class="footer-admin">
                    ${icon("users")}
                    <p><strong>¿Administras una piscina o eres de una municipalidad?</strong>
                    Publicamos tu sede gratis: horarios, precio y enlace de reserva.
                    Escríbenos a <a href="${adminMail}">${SITE.email}</a>.</p>
                </div>

                <div class="footer-bottom">
                    <p>Hecho por <strong>${SITE.author}</strong> · <a href="mailto:${SITE.email}">${SITE.email}</a></p>
                    <p>Datos actualizados el <time datetime="${builtAt.iso}">${builtAt.human}</time>. Los horarios y precios pueden cambiar sin aviso: confirma siempre con la sede.</p>
                    <p>&copy; ${builtAt.year} ${SITE.name} · <a href="${rel}privacidad/">Privacidad</a> · Información recopilada para fomentar el deporte y el bienestar.</p>
                </div>
            </footer>`;
}

// -------------------------------------------------------------
// Layout
// -------------------------------------------------------------
export function layout({
    title, description, path, ogType, ogImage,
    jsonLd = [], bodyClass = "", main, pools = [],
    headExtra = "", bodyExtra = ""
}) {
    const rel = relFor(path);
    const graph = jsonLd.length
        ? `\n    <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": jsonLd })}</script>`
        : "";

    // Los datos de las piscinas de esta página viajan incrustados: el JS
    // los tiene disponibles en el primer pintado, sin una petición extra.
    // `parsed` se recalcula en el navegador, así que no se serializa.
    const poolsData = pools.length
        ? `\n    <script type="application/json" id="pools-data">${JSON.stringify(pools.map(({ parsed, ...rest }) => rest)).replace(/</g, "\\u003c")}</script>`
        : "";

    // Primer elemento tabulable de la página: salta la cabecera y, en la
    // home, también el buscador y los filtros.
    const skipLink = bodyClass === "page-content"
        ? `<a class="skip-link" href="#contenido">Saltar al contenido</a>`
        : `<a class="skip-link" href="#resultados">Saltar a los resultados</a>`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${metaTags({ title, description, path, ogType, ogImage })}
    <meta name="google-site-verification" content="google4f3e50847f098ecf">
    <meta name="theme-color" content="#ffffff">${graph}

    ${THEME_BOOT}

    <link rel="icon" type="image/svg+xml" href="${rel}favicon.svg">
    <!-- iOS ignora los SVG en apple-touch-icon, así que aquí va el PNG -->
    <link rel="apple-touch-icon" href="${rel}icon-192.png">
    <link rel="manifest" href="${rel}manifest.webmanifest">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800&display=swap">

    <link rel="stylesheet" href="${rel}index.css">${headExtra}${analytics()}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""} data-rel="${rel}">
    ${skipLink}
${main}
${bodyExtra}${poolsData}
    <script type="module" src="${rel}${bodyClass === "page-content" ? "page.js" : "app.js"}"></script>
</body>
</html>
`;
}

export { header, footer, absolute };
