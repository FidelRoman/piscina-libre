// -------------------------------------------------------------
// PiscinaLibre - Build
//
//   node build.js            descarga el Google Sheet y genera dist/
//   node build.js --offline  usa data/pools.json sin tocar la red
//
// Si la descarga falla (Sheet privado, red caída, formato roto) el build
// NO se interrumpe: cae a data/pools.json y avisa. Publicar el sitio con
// datos de ayer es siempre mejor que publicarlo vacío.
// -------------------------------------------------------------

import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { poolsFromCSV, parseSchedule, districtSlug, SHEET_URL } from "./lib/pools-core.js";
import { SITE } from "./build/templates.js";
import {
    homePage, districtPage, districtIndexPage, poolPage,
    guidePage, guideIndexPage, privacyPage
} from "./build/pages.js";
import { GUIAS } from "./content/guias.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const DATA = path.join(ROOT, "data", "pools.json");
const OVERRIDES = path.join(ROOT, "data", "district-overrides.json");

const OFFLINE = process.argv.includes("--offline");

const log = (...a) => console.log("  ", ...a);
const warn = (...a) => console.warn("  ⚠ ", ...a);

// -------------------------------------------------------------
// Datos
// -------------------------------------------------------------
async function readJSON(file, fallback = null) {
    try {
        return JSON.parse(await readFile(file, "utf8"));
    } catch {
        return fallback;
    }
}

async function fetchOnce() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(SHEET_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const csv = await res.text();
        if (csv.includes("<!DOCTYPE html>") || csv.includes("<html")) {
            throw new Error("el Sheet respondió HTML: probablemente ya no es público");
        }
        const pools = poolsFromCSV(csv);
        if (!pools.length) throw new Error("el CSV no tenía ninguna fila utilizable");
        return pools;
    } finally {
        clearTimeout(timeout);
    }
}

// Google corta conexiones de vez en cuando; un fallo de red aislado no
// debería degradar el build a los datos de ayer.
async function fetchPools(attempts = 3) {
    let last;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await fetchOnce();
        } catch (e) {
            last = e.cause?.code ? new Error(`${e.message} (${e.cause.code})`) : e;
            if (i < attempts) await new Promise(r => setTimeout(r, i * 1500));
        }
    }
    throw last;
}

async function loadPools() {
    const seed = await readJSON(DATA, []);

    if (OFFLINE) {
        if (!seed.length) throw new Error("--offline pero data/pools.json está vacío o no existe");
        log(`modo offline: ${seed.length} piscinas desde data/pools.json`);
        return { pools: seed, live: false };
    }

    try {
        const pools = await fetchPools();
        log(`Google Sheet: ${pools.length} piscinas`);
        return { pools, live: true };
    } catch (e) {
        if (!seed.length) throw new Error(`no se pudo descargar el Sheet (${e.message}) y data/pools.json está vacío`);
        warn(`no se pudo descargar el Sheet (${e.message}); usando data/pools.json (${seed.length} piscinas)`);
        return { pools: seed, live: false };
    }
}

// La columna Distrito del Sheet es la fuente de verdad. Este override solo
// actúa como último recurso, para una fila que la traiga vacía y cuya
// dirección tampoco se deje deducir por texto — nunca pisa un distrito que
// ya vino resuelto, para que un cambio legítimo en el Sheet no se revierta
// en silencio por una entrada vieja de este archivo.
async function applyDistrictOverrides(pools) {
    const overrides = await readJSON(OVERRIDES, {});
    const unresolved = [];
    for (const pool of pools) {
        if (pool.district === "Lima" && overrides[pool.id]) pool.district = overrides[pool.id];
        if (pool.district === "Lima") unresolved.push(pool);
    }
    if (unresolved.length) {
        warn(`sin distrito reconocible (quedan como "Lima"): ${unresolved.map(p => p.id).join(", ")}`);
        warn(`   añade el distrito en la columna Distrito del Sheet, o una entrada en data/district-overrides.json`);
    }
    return pools;
}

function buildDistricts(pools) {
    const map = new Map();
    for (const pool of pools) {
        if (!map.has(pool.district)) {
            map.set(pool.district, { name: pool.district, slug: districtSlug(pool.district), count: 0, minPrice: null, pools: [] });
        }
        const d = map.get(pool.district);
        d.count++;
        d.pools.push(pool);
        if (pool.priceNum > 0 && (d.minPrice === null || pool.priceNum < d.minPrice)) d.minPrice = pool.priceNum;
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}

// -------------------------------------------------------------
// Escritura
// -------------------------------------------------------------
const written = [];

async function writePage(routePath, html) {
    const dir = path.join(DIST, routePath);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), html, "utf8");
    written.push(routePath);
}

function sitemap(routes, builtAt) {
    const priority = (r) => (r === "" ? "1.0" : r.startsWith("piscina/") ? "0.8" : r.startsWith("piscinas/") ? "0.9" : "0.6");
    const urls = routes.map(r => `  <url>
    <loc>${SITE.url}${r}</loc>
    <lastmod>${builtAt.date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority(r)}</priority>
  </url>`).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function manifest() {
    return JSON.stringify({
        name: "PiscinaLibre — Piscinas de nado libre en Lima",
        short_name: "PiscinaLibre",
        description: SITE.description,
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#f4f7fb",
        theme_color: "#0ea5e9",
        lang: "es-PE",
        categories: ["sports", "health", "travel"],
        icons: [
            { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
            { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
    }, null, 2);
}

// -------------------------------------------------------------
// Main
// -------------------------------------------------------------
async function main() {
    const started = Date.now();
    const now = new Date();
    const builtAt = {
        iso: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        year: now.getFullYear(),
        human: now.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima" })
    };

    console.log("\n🏊 PiscinaLibre — build\n");

    const { pools, live } = await loadPools();
    await applyDistrictOverrides(pools);
    pools.forEach(p => { p.parsed = parseSchedule(p.schedule); });

    // Guardamos la última descarga buena como semilla y fallback del
    // próximo build. `parsed` se recalcula siempre, no se persiste.
    if (live) {
        const clean = pools.map(({ parsed, ...rest }) => rest);
        await writeFile(DATA, JSON.stringify(clean, null, 2) + "\n", "utf8");
        log("data/pools.json actualizado");
    }

    const districts = buildDistricts(pools);
    log(`${districts.length} distritos: ${districts.map(d => `${d.name} (${d.count})`).join(", ")}`);

    await rm(DIST, { recursive: true, force: true });
    await mkdir(DIST, { recursive: true });

    // Estáticos. lib/ va aparte porque lo comparten el build y el
    // navegador: los módulos de src/ lo importan como ./lib/…
    await cp(SRC, DIST, { recursive: true });
    await cp(path.join(ROOT, "lib"), path.join(DIST, "lib"), { recursive: true });
    log("estáticos copiados desde src/ y lib/");

    // Páginas
    await writePage("", homePage({ pools, districts, builtAt }));
    await writePage("piscinas", districtIndexPage({ districts, pools, builtAt }));

    for (const district of districts) {
        await writePage(`piscinas/${district.slug}`, districtPage({ district, pools: district.pools, districts, builtAt }));
    }
    for (const pool of pools) {
        const districtPools = districts.find(d => d.name === pool.district)?.pools ?? [pool];
        await writePage(`piscina/${pool.id}`, poolPage({ pool, districtPools, districts, builtAt }));
    }
    await writePage("guias", guideIndexPage({ districts, builtAt }));
    for (const guide of GUIAS) {
        await writePage(`guias/${guide.slug}`, guidePage({ guide, pools, districts, builtAt }));
    }
    await writePage("privacidad", privacyPage({ districts, builtAt }));

    // sitemap.xml y robots.txt: robots vive en src/ y solo lo generamos
    // aquí si no está, para que la URL del sitemap no se desincronice.
    const routes = written.map(r => (r === "" ? "" : r + "/"));
    await writeFile(path.join(DIST, "sitemap.xml"), sitemap(routes, builtAt), "utf8");
    await writeFile(path.join(DIST, "manifest.webmanifest"), manifest(), "utf8");
    if (!existsSync(path.join(DIST, "robots.txt"))) {
        await writeFile(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}sitemap.xml\n`, "utf8");
    }

    // GitHub Pages sirve tal cual, sin Jekyll: evita que ignore rutas
    // que empiecen por guion bajo si alguna vez las hubiera.
    await writeFile(path.join(DIST, ".nojekyll"), "", "utf8");

    if (!SITE.ga4Id) warn('SITE.ga4Id vacío: el sitio se publica sin analítica (build/templates.js)');
    if (!SITE.whatsappChannel) warn('SITE.whatsappChannel vacío: no se muestra la llamada al canal (build/templates.js)');

    console.log(`\n✅ ${written.length} páginas en dist/ · ${live ? "datos en vivo" : "datos locales"} · ${Date.now() - started} ms\n`);
}

main().catch(e => {
    console.error("\n❌ Build fallido:", e.message, "\n");
    process.exit(1);
});
