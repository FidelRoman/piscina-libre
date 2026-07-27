// -------------------------------------------------------------
// PiscinaLibre - JS de las páginas de contenido
//
// Distritos, fichas y guías no cargan Leaflet ni el motor de filtros:
// solo necesitan el tema, la analítica, el estado en vivo de las
// tarjetas y el botón de compartir.
// -------------------------------------------------------------

import { initTheme, initTracking, readEmbeddedPools, applyLiveStatus, initCardActions } from "./ui.js";

const pools = readEmbeddedPools();
const poolsById = new Map(pools.map(p => [p.id, p]));

initTheme();
initTracking();
applyLiveStatus(document, poolsById);
// data-rel lo escribe el build: es el prefijo relativo hasta la raíz del
// sitio, que cambia según la profundidad de la página.
const rel = document.body.dataset.rel || "";
initCardActions(poolsById, (pool) => new URL(`${rel}piscina/${pool.id}/`, location.href).href);
