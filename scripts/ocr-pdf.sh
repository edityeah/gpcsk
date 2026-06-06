#!/usr/bin/env bash
# OCR a scanned/image-only PDF using pdftoppm + tesseract.
# Drops a sibling .txt next to the PDF so apps/api/src/rag/ingest-pdfs.ts
# can pick it up automatically.
#
# Usage: scripts/ocr-pdf.sh path/to/file.pdf
#
# Requirements (free, open-source):
#   brew install tesseract poppler

set -euo pipefail

PDF="${1:?Usage: $0 path/to/file.pdf}"
if [[ ! -f "$PDF" ]]; then
  echo "❌ Not found: $PDF" >&2
  exit 1
fi

OUT="${PDF%.pdf}.txt"
WORK=$(mktemp -d -t gpcsk-ocr)
trap 'rm -rf "$WORK"' EXIT

PAGES=$(pdfinfo "$PDF" | awk '/^Pages:/ {print $2}')
echo "📄 $(basename "$PDF") — $PAGES pages"
echo "→ work dir: $WORK"

echo "🖼  Step 1/3  rasterise to PNG @ 200 dpi"
pdftoppm -png -r 200 "$PDF" "$WORK/page"

echo "🔤 Step 2/3  tesseract OCR (parallel × 4)"
find "$WORK" -name 'page-*.png' -print0 \
  | xargs -0 -n 1 -P 4 -I{} bash -c 'tesseract "$1" "${1%.png}" -l eng --psm 1 >/dev/null 2>&1' _ {}

echo "📝 Step 3/3  concatenate → $OUT"
cat "$WORK"/page-*.txt > "$OUT"
echo "✅ done  $(wc -c <"$OUT" | tr -d ' ') chars  →  $OUT"
