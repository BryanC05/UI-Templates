# Alex Chen — Portfolio Website

A minimal, futuristic portfolio website inspired by the dope.security design aesthetic - midnight terminal with violet beacons.

## Version 4 — Porsche 718 Spyder RS Hero

The hero background keeps version 3's pure-CSS composition — near-black sky, a warm glow low on the horizon, textured cloud banks in both bottom corners and fine film grain — but the object on it is now a Porsche 718 Spyder RS: a low, open-top mid-engine roadster rendered in real time with three.js. No photography or image assets; the car is geometry, materials and light.

The body is extruded from the model's own side profile (front shell, rear shell, door panels) with deep bevels for the fender shoulders and an affine shear for the 5° tumblehome, so the flanks roll instead of reading as slabs. Everything else is surface-mounted on the true widest point of that extrusion: arch lips, front-fender louvers, side intake scoops, rocker skirts, beltline rail, flush door handles, mirrors, the raked windshield with its frame and flyline, seat backs with headrests, roll hoops, deck humps and the ducktail seam. Wheels are lathed tires with five-spoke centre-lock rims that turn with the car.

A procedural equirectangular environment (painted once onto a canvas, filtered through PMREM) supplies the studio reflections on the paint, glass and satin trim; ACES Filmic tone mapping, PCF soft contact shadows, fog, a hemisphere fill and two headlamp spots with glow sprites finish it. The car drives through the frame on a 15.5 s cycle, and the render pauses when the hero scrolls out of view.

`car.js` is a classic script that dynamically imports three.js from the unpkg CDN. Browser module scripts are blocked by CORS on `file://`, so a plain `import()` inside a classic script is what lets the 3D render work when `index.html` is opened directly; the same code also works when served over HTTP.

If WebGL is unavailable (or the CDN cannot be reached), the `<canvas>` stays hidden and a fully shaded inline-SVG side view of the same car — matching profile, wheels, cockpit and lights, with its own CSS drive and wheel-spin animation — is shown instead. All motion is disabled under `prefers-reduced-motion`, which parks the car in frame.

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
- three.js (hero car, dynamically imported from the unpkg CDN; inline SVG fallback)

## Getting Started

1. Open `index.html` in your browser
2. Or serve it with a local server: `python -m http.server 8000`

## Design Inspiration

Based on the dope.security style reference - a midnight terminal aesthetic with geometric sans-serif, monospace section labels, and strategic use of violet as a signal color.
