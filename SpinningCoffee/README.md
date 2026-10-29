# Alex Chen — Portfolio Website

A minimal, futuristic portfolio website inspired by the dope.security design aesthetic - midnight terminal with violet beacons.

## Version 3 — Coffee Hero

The hero background is built from version 1's composition in pure CSS, recolored to coffee: a near-black espresso sky overhead, a crema glow low on the horizon, textured crema-cloud banks rising in both bottom corners (layered radial gradients plus an inline SVG turbulence displacement), and fine film grain. No photography, video, or image assets — only CSS gradients and an inline SVG filter.

The mug itself is rendered in real time with three.js: a lathed, lightly tapered ceramic body with baked contact shading and subtle glaze roughness, a true tube-geometry handle with an oval cross-section, a coffee surface with a procedural crema texture, meniscus ring and faint ripples, a dished saucer, contact shadow, and sprite-based steam wisps. A procedural environment map supplies the studio softbox reflections, so the ceramic, handle and coffee all pick up matching highlights as the mug turns on its saucer. A raking key light plus warm rim and bounce fills carve out the terminator; the render pauses when the hero scrolls out of view.

`mug.js` is a classic script that dynamically imports three.js from the unpkg CDN. Browser module scripts are blocked by CORS on `file://`, so a plain `import()` inside a classic script is what lets the 3D render work when `index.html` is opened directly; the same code also works when served over HTTP.

If WebGL is unavailable (or the CDN cannot be reached), the `<canvas>` stays hidden and a fully shaded inline-SVG mug (with its own CSS steam and handle orbit animation) is shown instead. All motion is disabled under `prefers-reduced-motion`.

## Features
- **Dark Terminal Aesthetic**: Near-black canvas (#090909) with violet accents (#af50ff)
- **Typography**: Inter for body/UI, JetBrains Mono for monospace elements, serif for display
- **Responsive Design**: Optimized for desktop and mobile devices
- **Smooth Animations**: Subtle hover effects and transitions
- **Interactive Elements**: Dynamic coordinates in footer, smooth scrolling

## Sections

- **Hero**: Introduction with boarding pass card design
- **Work**: Key focus areas and capabilities
- **About**: Personal introduction and quick info
- **Projects**: Featured project showcase
- **Skills**: Technical expertise breakdown
- **Experience**: Professional timeline
- **Contact**: Get in touch information

## Tech Stack

- HTML5
- CSS3 (Custom Properties, Grid, Flexbox)
- Vanilla JavaScript
- three.js (hero mug, dynamically imported from the unpkg CDN; inline SVG fallback)

## Getting Started

1. Open `index.html` in your browser
2. Or serve it with a local server: `python -m http.server 8000`

## Design Inspiration

Based on the dope.security style reference - a midnight terminal aesthetic with geometric sans-serif, monospace section labels, and strategic use of violet as a signal color.
