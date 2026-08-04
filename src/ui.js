// -------------------------------------------------------------
// PiscinaLibre - UI compartida entre la home y las páginas de contenido
// -------------------------------------------------------------

import { icon } from "./lib/icons.js";
import { parseSchedule, getOpenStatus, getOpenUntil, getOpensNext, formatHour } from "./lib/pools-core.js";

// -------------------------------------------------------------
// Atajos de DOM
// -------------------------------------------------------------
export const $ = (id) => document.getElementById(id);

// Prefijo relativo hasta la raíz del sitio; lo escribe el build en <body>.
export const rel = () => document.body.dataset.rel || "";

// El mismo umbral que usa el CSS para pasar de dos columnas a una.
export function isMobileView() {
    return window.matchMedia("(max-width: 900px)").matches;
}

// -------------------------------------------------------------
// Tema (claro / oscuro)
// -------------------------------------------------------------
const THEME_KEY = "pl-theme";
const themeListeners = [];

export function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
}

export function onThemeChange(fn) {
    themeListeners.push(fn);
}

export function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* modo privado */ }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0f1725" : "#ffffff");

    const btn = document.getElementById("theme-toggle");
    if (btn) {
        btn.innerHTML = icon(theme === "dark" ? "sun" : "moon");
        btn.setAttribute("aria-label", theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
    }
    themeListeners.forEach(fn => fn(theme));
}

export function initTheme() {
    // El <head> ya fijó data-theme antes del primer pintado; aquí solo
    // sincronizamos el icono del botón y enganchamos el listener.
    applyTheme(currentTheme());
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));
}

// -------------------------------------------------------------
// Analítica
// -------------------------------------------------------------
// Registra un evento en GA4. Si gtag no está cargado (o el visitante lo
// bloquea) no pasa nada: la función es un no-op silencioso.
export function track(event, params = {}) {
    if (typeof window.gtag === "function") window.gtag("event", event, params);
}

// Los enlaces salientes se marcan con data-track en las plantillas, así
// que un solo listener delegado cubre toda la página.
export function initTracking() {
    document.addEventListener("click", (e) => {
        const el = e.target.closest("[data-track]");
        if (!el) return;
        track(el.getAttribute("data-track") + "_click", {
            piscina: el.getAttribute("data-pool") || undefined,
            destino: el.tagName === "A" ? el.href : undefined
        });
    });
}

// -------------------------------------------------------------
// Datos incrustados
// -------------------------------------------------------------
// El build escribe la lista de piscinas de cada página en un bloque JSON.
// Evita una petición extra y deja la interfaz utilizable en el primer
// pintado, sin esperar a ninguna red.
export function readEmbeddedPools() {
    const node = document.getElementById("pools-data");
    if (!node) return [];
    try {
        const pools = JSON.parse(node.textContent);
        pools.forEach(p => { p.parsed = parseSchedule(p.schedule); });
        return pools;
    } catch (e) {
        console.warn("No se pudo leer el bloque de datos incrustado:", e);
        return [];
    }
}

// -------------------------------------------------------------
// Estado "abierto ahora"
// -------------------------------------------------------------
// El HTML se sirve cacheado, así que el estado en vivo no puede venir
// escrito de fábrica: cada tarjeta trae un hueco que rellenamos aquí con
// la hora real del visitante. El badge va posicionado en absoluto, de
// modo que insertarlo no desplaza nada.
export function statusBadge(parsed, now = new Date()) {
    const status = getOpenStatus(parsed, now);
    if (status === null) return "";

    if (status) {
        const until = getOpenUntil(parsed, now);
        const detail = until == null ? "" : ` <span class="status-detail">· cierra ${formatHour(until)}</span>`;
        return `<span class="status-badge open"><span class="dot"></span> Abierto${detail}</span>`;
    }

    // Si vuelve a abrir hoy, decir a qué hora ahorra abrir la ficha entera.
    const next = getOpensNext(parsed, now);
    const detail = next == null ? "" : ` <span class="status-detail">· abre ${formatHour(next)}</span>`;
    return `<span class="status-badge closed"><span class="dot"></span> Cerrado${detail}</span>`;
}

export function applyLiveStatus(root, poolsById) {
    root.querySelectorAll("[data-status-slot]").forEach(slot => {
        const card = slot.closest("[data-pool-id]");
        const pool = card && poolsById.get(card.getAttribute("data-pool-id"));
        slot.outerHTML = pool ? statusBadge(pool.parsed) : "";
    });
}

// -------------------------------------------------------------
// Compartir
// -------------------------------------------------------------
export async function sharePool(pool, url) {
    const data = {
        title: `${pool.name} — PiscinaLibre`,
        text: `${pool.name}, ${pool.district}. Horarios y precio del turno de nado libre.`,
        url
    };
    if (navigator.share) {
        try {
            await navigator.share(data);
            track("compartir_piscina", { piscina: pool.name, via: "share" });
            return "shared";
        } catch (e) {
            // AbortError = el usuario cerró la hoja de compartir a propósito
            if (e.name === "AbortError") return "cancelled";
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        track("compartir_piscina", { piscina: pool.name, via: "copy" });
        return "copied";
    } catch (e) {
        return "failed";
    }
}

// -------------------------------------------------------------
// Avisos
// -------------------------------------------------------------
let toastTimer = null;
const TOAST_ICON = { info: "info", success: "circle-check", error: "circle-alert" };

// type: "info" (por defecto) | "success" | "error".
// Los errores se anuncian como alerta porque interrumpen algo que el
// visitante acaba de pedir; el resto son avisos de cortesía.
export function showToast(message, type = "info") {
    let toast = document.getElementById("app-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "app-toast";
        document.body.appendChild(toast);

        // Con el cursor encima el aviso se queda: da tiempo a leerlo y a
        // llegar hasta un enlace si lo lleva.
        toast.addEventListener("mouseenter", () => clearTimeout(toastTimer));
        toast.addEventListener("mouseleave", () => scheduleToastHide(toast));
    }

    toast.className = `app-toast toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    toast.innerHTML = `${icon(TOAST_ICON[type] || TOAST_ICON.info, "toast-icon")}<span>${message}</span>`;
    toast.classList.add("visible");
    scheduleToastHide(toast);
}

function scheduleToastHide(toast) {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 4000);
}

// -------------------------------------------------------------
// Imágenes que no cargan
// -------------------------------------------------------------
// Las fotos son enlaces directos a servidores municipales, que caen o
// bloquean el hotlinking sin avisar. El evento "error" no burbujea, así
// que se escucha en fase de captura: un solo listener cubre las tarjetas
// que ya vienen en el HTML y las que se repintan al filtrar.
// Un fallo no siempre significa que la foto no exista: la home pide ocho
// imágenes a la vez a servidores municipales distintos y basta con que uno
// vaya lento o limite el ritmo para perderla. Por eso se reintenta un par
// de veces antes de dar el respaldo por definitivo.
const IMG_RETRIES = 2;
const IMG_RETRY_DELAY = 500;

export function initImageFallback() {
    document.addEventListener("error", (e) => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement)) return;
        handleImageError(img);
    }, true);

    // Este módulo es diferido, así que una imagen puede haber fallado
    // antes de que el listener existiera. Las que ya terminaron sin
    // píxeles pasan por el mismo camino, reintentos incluidos.
    document.querySelectorAll("[data-img-holder] img").forEach(img => {
        if (img.complete && img.naturalWidth === 0) handleImageError(img);
    });
}

function handleImageError(img) {
    const holder = img.closest("[data-img-holder]");
    if (!holder) return;

    const tries = Number(img.dataset.imgRetry || 0);
    if (tries < IMG_RETRIES) {
        img.dataset.imgRetry = tries + 1;
        // El parámetro es lo que fuerza una petición nueva: reasignar el
        // mismo src no la dispara, y un error puede quedar cacheado.
        const next = new URL(img.src, location.href);
        next.searchParams.set("_r", String(tries + 1));
        setTimeout(() => { img.src = next.href; }, IMG_RETRY_DELAY * (tries + 1));
        return;
    }

    holder.classList.add("img-failed");
    img.remove();
}

// -------------------------------------------------------------
// Tarjetas: acciones comunes (compartir) presentes en toda página
// -------------------------------------------------------------
export function initCardActions(poolsById, urlFor) {
    document.addEventListener("click", async (e) => {
        const shareBtn = e.target.closest("[data-share-btn]");
        if (!shareBtn) return;
        const card = shareBtn.closest("[data-pool-id]");
        const pool = card && poolsById.get(card.getAttribute("data-pool-id"));
        if (!pool) return;
        const result = await sharePool(pool, urlFor(pool));
        if (result === "copied") showToast("Enlace copiado al portapapeles.");
        else if (result === "failed") showToast("No pudimos compartir el enlace.");
    });
}
