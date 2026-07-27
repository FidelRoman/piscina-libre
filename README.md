# PiscinaLibre

Directorio de piscinas de nado libre en Lima: horarios, precios, distritos y cómo reservar.

**https://fidelroman.github.io/piscina-libre/**

Los datos viven en un Google Sheet. Un build sin dependencias los convierte en un sitio
estático de ~29 páginas —una por distrito, una por piscina, más guías— que se regenera
solo cada día.

## Cómo trabajar en él

```bash
node build.js            # descarga el Sheet y genera dist/
node build.js --offline  # usa data/pools.json, sin tocar la red
```

Para verlo en el navegador, `npm run dev` (o el preview `piscina-libre`, que sirve `dist/`
en el puerto 8235).

No hay `npm install`: el build solo usa Node 18+ y su `fetch` nativo.

## Estructura

```
build.js              orquesta: Sheet → data/pools.json → dist/
build/
  templates.js        <head>, cabecera, pie y ajustes del sitio (SITE)
  pages.js            home, distritos, fichas, guías, privacidad
  schema.js           JSON-LD generado desde los datos
content/guias.js      las guías; cada una recibe los datos reales
data/
  pools.json          última descarga buena; semilla y fallback del build
  district-overrides.json   distritos que no se deducen de la dirección
lib/                  compartido entre Node y el navegador
  pools-core.js       CSV, horarios, distancias, formato
  card.js             marcado de la tarjeta de piscina
  icons.js            iconos SVG inline
src/                  se copia tal cual a dist/
  index.css  app.js (home)  page.js (resto)  ui.js (común)
tools/                fuentes SVG + script de los PNG del sitio
```

`lib/card.js` es la única definición del marcado de una tarjeta, y la usan tanto el build
como el navegador. Si se duplicara, la lista daría un salto visible en cuanto el visitante
tocara un filtro.

## Ajustes

Todo lo configurable está en `SITE`, en [`build/templates.js`](build/templates.js):

| Campo | Para qué |
|---|---|
| `ga4Id` | Measurement ID de Google Analytics 4 (`G-XXXXXXXXXX`). Vacío = sin analítica. |
| `whatsappChannel` | Enlace de invitación del canal. Vacío = no se muestra el botón del pie. |
| `url`, `email`, `author` | Dominio canónico y datos de contacto. |

El build avisa por consola de los que estén vacíos.

## Publicación

`.github/workflows/deploy.yml` reconstruye y publica en cada push a `main`, a diario a las
09:00 UTC (04:00 en Lima) y a mano desde la pestaña Actions.

> El origen de GitHub Pages tiene que estar en **GitHub Actions** (Settings → Pages), no en
> una rama.

Si el Sheet no responde, el build usa `data/pools.json` y termina con éxito: publicar los
datos del último build es mejor que dejar el sitio sin actualizar.

## Añadir o corregir una piscina

Se edita el [Google Sheet](https://docs.google.com/spreadsheets/d/1sJCmPq7Ggd5UnnM-lCffzzfUxSCUcjkWQWs-3SrO-n0/edit)
y al día siguiente el sitio se regenera solo. Un par de cosas ayudan a que salga bien:

- **Pon el distrito en la dirección.** Es de donde se deduce, y de ahí salen las páginas
  `/piscinas/<distrito>/`. Si no aparece, hay que añadir una entrada en
  `data/district-overrides.json` y el build lo advierte.
- **Formato del horario:** `L-V: 6-8, 20-22 | S: 6-10 | D: 8-13`. Los bloques se separan
  con `|`, los días van antes de los dos puntos y las horas después. Lo que no encaje se
  muestra como nota, pero deja la sede fuera de los filtros de día y hora.
- **Imágenes:** que no pasen de ~1200 px de ancho. Se enlazan directamente desde el
  servidor de origen, así que una foto de 8000 px se descarga entera en cada visita.

## Regenerar las imágenes del sitio

```bash
./tools/make-images.sh
```

Genera `og-image.jpg` y los iconos de la PWA desde los SVG de `tools/`. Solo hace falta
si cambia el diseño; usa `qlmanage` y `sips`, así que es de macOS.

---

Hecho por Fidel Román · [fidel.roman@outlook.com](mailto:fidel.roman@outlook.com)
