// -------------------------------------------------------------
// PiscinaLibre - UI compartida entre la home y las páginas de contenido
// -------------------------------------------------------------

import { icon } from "./lib/icons.js";
import { parseSchedule, getOpenStatus } from "./lib/pools-core.js";

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
    return status
        ? `<span class="status-badge open"><span class="dot"></span> Abierto ahora</span>`
        : `<span class="status-badge closed"><span class="dot"></span> Cerrado ahora</span>`;
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
export function showToast(message) {
    let toast = document.getElementById("app-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "app-toast";
        toast.className = "app-toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 4000);
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
