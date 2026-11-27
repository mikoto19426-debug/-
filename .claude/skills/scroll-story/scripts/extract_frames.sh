#!/usr/bin/env bash
# Join video clips in order and turn them into numbered WebP frames for a scroll scrub.
# Usage: extract_frames.sh clip1.mp4 [clip2.mp4 ...] OUT_DIR
# Env: FPS (default 24), WIDTH (default 1600), QUALITY (default 78)
set -euo pipefail
if [ "$#" -lt 2 ]; then echo "usage: $0 clip1.mp4 [clip2.mp4 ...] OUT_DIR" >&2; exit 1; fi
OUT="${@: -1}"
CLIPS=("${@:1:$#-1}")
FPS="${FPS:-24}"; WIDTH="${WIDTH:-1600}"; QUALITY="${QUALITY:-78}"
mkdir -p "$OUT"
LIST="$(mktemp)"; trap 'rm -f "$LIST"' EXIT
for c in "${CLIPS[@]}"; do printf "file '%s'\n" "$(realpath "$c")" >> "$LIST"; done
# re-encode while joining so clips with different sizes/fps still line up
ffmpeg -v error -y -f concat -safe 0 -i "$LIST" \
  -vf "fps=${FPS},scale=${WIDTH}:-2:flags=lanczos" \
  -c:v libwebp -quality "$QUALITY" -compression_level 4 "$OUT/f%04d.webp"
N=$(ls "$OUT"/f*.webp | wc -l)
SIZE=$(du -sh "$OUT" | cut -f1)
echo "frames: $N  total: $SIZE  folder: $OUT"
if [ "$N" -gt 400 ]; then echo "note: over 400 frames; rerun with a lower FPS (e.g. FPS=15) for phones and tablets" >&2; fi
