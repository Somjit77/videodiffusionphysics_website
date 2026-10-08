#!/usr/bin/env bash
# Build the videos, posters and figures used by the project page.
#
# Inputs (set these to your local copies):
#   INTPHYS    IntPhys dev set, the folder with O1/ O2/ O3/
#   INFLEVEL   InfLevel-Lab, the folder with continuity/ gravity/ solidity/
#   PHYWORLD   parabola_eval.hdf5 from magicr/phyworld (needs h5py to read)
#   PAPER_SRC  unpacked arXiv source of 2606.05328 (for figures/)
#   PLOTS      outputs/plots, holding the updated Fig. 2 / Fig. 3 PDFs
#
# Usage: INTPHYS=... INFLEVEL=... PHYWORLD=... PAPER_SRC=... PLOTS=... bash tools/build_assets.sh
set -euo pipefail

WEB="$(cd "$(dirname "$0")/.." && pwd)"
: "${INTPHYS:?set INTPHYS}" "${INFLEVEL:?set INFLEVEL}" "${PHYWORLD:?set PHYWORLD}" "${PAPER_SRC:?set PAPER_SRC}" "${PLOTS:?set PLOTS}"

VID="$WEB/static/videos"
IMG="$WEB/static/images"
mkdir -p "$VID/intphys" "$VID/inflevel" "$VID/phyworld" "$IMG"

X264=(-c:v libx264 -preset slow -pix_fmt yuv420p -movflags +faststart -an -threads 2)

poster() {  # first frame of a video as a JPEG
  ffmpeg -v error -y -i "$1" -frames:v 1 -q:v 4 "${1%.mp4}.jpg"
}

# ── IntPhys: one plausible / implausible pair per scene ──────────────────────
# category scene plausible_movie implausible_movie
INTPHYS_PAIRS=(
  "O1 19 3 1"
  "O1 12 3 1"
  "O2 22 2 4"
  "O2 16 2 4"
  "O3 28 1 2"
  "O3 24 2 4"
)
for row in "${INTPHYS_PAIRS[@]}"; do
  read -r c s p i <<<"$row"
  for kind in P I; do
    m=$p; [[ $kind == I ]] && m=$i
    out="$VID/intphys/${c}_${s}_${kind}.mp4"
    ffmpeg -v error -y -framerate 20 -i "$INTPHYS/$c/$s/$m/scene/scene_%03d.png" -crf 22 "${X264[@]}" "$out"
    poster "$out"
  done
done

# ── InfLevel-Lab: one plausible / implausible pair per object set ────────────
# output_name plausible_file implausible_file
INFLEVEL_PAIRS=(
  "gravity_a gravity/center__gravity__bigbluecup__blueball__cv.mp4 gravity/center__gravity__bigbluecup__blueball__ci.mp4"
  "gravity_b gravity/center__gravity__orangebowl__duck__ui.mp4 gravity/center__gravity__orangebowl__duck__uv.mp4"
  "solidity_a solidity/center__solidity__greycup__blueclover__cv.mp4 solidity/center__solidity__greycup__blueclover__ci.mp4"
  "solidity_b solidity/center__solidity__pot6__apple1__ui.mp4 solidity/center__solidity__pot6__apple1__uv.mp4"
  "continuity_a continuity/center__continuity__darkbluecup__blueclover__vv__LR.mp4 continuity/center__continuity__darkbluecup__blueclover__vi__LR.mp4"
  "continuity_b continuity/center__continuity__pinkcup__duck__ii__RL.mp4 continuity/center__continuity__pinkcup__duck__iv__RL.mp4"
)
for row in "${INFLEVEL_PAIRS[@]}"; do
  read -r name p i <<<"$row"
  for kind in P I; do
    src=$p; [[ $kind == I ]] && src=$i
    out="$VID/inflevel/${name}_${kind}.mp4"
    ffmpeg -v error -y -i "$INFLEVEL/$src" -vf "scale=464:256" -crf 25 "${X264[@]}" "$out"
    poster "$out"
  done
done

# ── PhyWorld parabolas: clips are stored as mp4 bytes inside the HDF5 ────────
python - "$PHYWORLD" "$VID/phyworld" <<'EOF'
import json, sys, h5py
src, out = sys.argv[1], sys.argv[2]
IDX = [320, 448, 23, 497, 563, 626]          # spread over x0 and v0
with h5py.File(src, "r") as f:
    init = f["init_streams/00000"][:]
    meta = []
    for i in IDX:
        open(f"{out}/raw_{i:04d}.mp4", "wb").write(bytes(f["video_streams/00000"][i]))
        meta.append({"idx": i, "x0": round(float(init[i, 0]), 2), "v0": round(float(init[i, 1]), 2)})
json.dump(meta, open(f"{out}/meta.json", "w"), indent=1)
EOF
for raw in "$VID"/phyworld/raw_*.mp4; do
  out="$VID/phyworld/parabola_${raw##*raw_}"
  ffmpeg -v error -y -i "$raw" -crf 20 "${X264[@]}" "$out"
  rm "$raw"
  poster "$out"
done

# ── Updated Fig. 2 / Fig. 3 (7 models, best block per seed) ──────────────────
for f in fig2_combined_pervideo fig2_percategory fig3_pairwise_percategory; do
  pdftoppm -png -singlefile -scale-to-x 2200 -scale-to-y -1 "$PLOTS/$f.pdf" "$IMG/$f"
done

# ── Remaining figures from the paper source ──────────────────────────────────
# name:pixel_width (full-width figures at 2200, half-width ones at 1200)
FIGS=(
  noiswise_blockwise_plausibility:2200
  intervention_intphys:2200
  beyond_plausibility:2200
  compression_representation:1200
  ablation:1200
  figure_integrator_ablation:1200
)
for entry in "${FIGS[@]}"; do
  f=${entry%%:*}; w=${entry##*:}
  pdftoppm -png -singlefile -scale-to-x "$w" -scale-to-y -1 "$PAPER_SRC/figures/$f.pdf" "$IMG/$f"
done
convert "$PAPER_SRC/figures/conceptual2.jpg" -resize 2000x -strip -quality 86 "$IMG/overview.jpg"
convert "$PAPER_SRC/figures/conceptual2.jpg" -resize 1200x630 -background white -gravity center -extent 1200x630 -strip -quality 85 "$IMG/social.jpg"

du -sh "$VID" "$IMG"
