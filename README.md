# Project page

Static project page for *The Invisible Hand of Physics* (NeurIPS 2026 Spotlight). Plain HTML, CSS and JS with no build step. Fonts and KaTeX load from Google Fonts and cdnjs.

```
website/
├── index.html
├── static/
│   ├── css/style.css
│   ├── js/main.js
│   ├── images/          figures (updated Fig. 2/3 from outputs/plots, the rest from the arXiv source), favicon, social card
│   └── videos/          benchmark clips and their poster frames
│       ├── intphys/     <category>_<scene>_{P,I}.mp4   P = plausible, I = implausible
│       ├── inflevel/    <principle>_{a,b}_{P,I}.mp4
│       └── phyworld/    parabola_<idx>.mp4, meta.json holds x0 and v0
└── tools/build_assets.sh   rebuilds everything under static/videos and static/images
```

## Preview locally

```bash
cd website
python -m http.server 8000
```

Then open http://localhost:8000. Over SSH in VS Code, the port is forwarded automatically. Opening `index.html` straight from disk also works, apart from the BibTeX copy button in some browsers.

## Deploy with GitHub Pages

Pages can only serve a branch's root or `/docs`, so publish this folder with a workflow. Add `.github/workflows/pages.yml`:

```yaml
name: Deploy project page
on:
  push:
    branches: [main]
    paths: [website/**]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: website
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then set **Settings → Pages → Source** to *GitHub Actions*. After the first deploy, change `og:image` and `twitter:image` in `index.html` to the absolute URL of `static/images/social.jpg`, since link previews need an absolute URL.

## Swapping clips

Edit the pair lists at the top of each section in `tools/build_assets.sh` and rerun it with the dataset paths set:

```bash
INTPHYS=/path/to/intphys/dev INFLEVEL=/path/to/inflevel_lab \
PHYWORLD=/path/to/parabola_eval.hdf5 PAPER_SRC=/path/to/arxiv_source \
PLOTS=/path/to/outputs/plots bash tools/build_assets.sh
```

It needs `ffmpeg`, `pdftoppm`, ImageMagick and a Python with `h5py`. Update the matching captions in `index.html`.
