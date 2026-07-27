#!/usr/bin/env bash
#
# Genera los PNG del sitio (imagen social e iconos de la PWA) a partir de
# los SVG de esta carpeta y los deja en src/, donde el build los copia.
#
#   ./tools/make-images.sh
#
# Solo usa herramientas de macOS (qlmanage y sips) para no añadir
# dependencias al proyecto. Los PNG resultantes se versionan: este script
# solo hace falta cuando cambie el diseño de los SVG.
#
# qlmanage siempre rasteriza sobre un lienzo cuadrado y centra el
# contenido, así que la imagen social (1200×630) se genera cuadrada y
# después se recorta al alto real.

set -euo pipefail

cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

render() {  # render <svg> <lado-px> <destino.png>
    qlmanage -t -s "$2" -o "$TMP" "$1" >/dev/null 2>&1
    mv "$TMP/$(basename "$1").png" "$3"
}

# La imagen social va en JPEG: es un degradado a pantalla completa, que
# en PNG pesa ~750 KB y en JPEG de calidad alta baja a unas decenas.
echo "· og-image.jpg (1200×630)"
render tools/og-image.svg 1200 "$TMP/og-square.png"
sips --cropToHeightWidth 630 1200 "$TMP/og-square.png" --out "$TMP/og.png" >/dev/null
sips -s format jpeg -s formatOptions 82 "$TMP/og.png" --out src/og-image.jpg >/dev/null

echo "· icon-512.png"
render tools/app-icon.svg 512 src/icon-512.png

echo "· icon-192.png"
render tools/app-icon.svg 192 src/icon-192.png

echo
echo "Listo:"
for f in src/og-image.jpg src/icon-512.png src/icon-192.png; do
    printf "  %-22s %s(%s KB)\n" "$f" "$(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/ {printf "%sx", $2}')" "$(( $(stat -f%z "$f") / 1024 ))"
done
