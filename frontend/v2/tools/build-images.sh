#!/usr/bin/env sh
# Generates the responsive WebP set used by Version B.
# The source PNGs stay untouched: the original version still references them,
# and they double as the <picture> fallback.
set -e
cd "$(dirname "$0")/../../images"
mkdir -p webp

Q=82
M="-define webp:method=6 -strip"

# Pizzas are square; widths cover cart thumb -> card -> feature card -> sheet/hero.
for f in pizza_*.png; do
  base="${f%.png}"
  for w in 1254 800 480 160; do
    magick "$f" -resize "${w}x${w}" -quality $Q $M "webp/${base}-${w}.webp"
  done
done

# The two location photographs are 16:9 landscape.
for f in hero_section interior; do
  for w in 1672 1200 800 480; do
    magick "${f}.png" -resize "${w}x" -quality $Q $M "webp/${f}-${w}.webp"
  done
done

echo "--- generated ---"
ls webp | wc -l
du -sh webp
echo "--- source PNGs ---"
du -ch ./*.png | tail -1
