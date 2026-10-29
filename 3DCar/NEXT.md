# Variant 4 — next steps

Paused state: the 718 Spyder RS model now has a correct top surface, a plan-view
taper, and the hero loop is eased. A CSS city/road backdrop is in. Everything
below is ordered by visual payoff.

All paths are in `E:\Project\new ui\4\`. Line numbers are as of this commit.

---

## 1. The side intake is the worst thing on the car

[car.js:627](car.js#L627) — `scoop` / `ventBlade` / `ventLip`.

It renders as a black rectangle standing **off** the flank above the rear arch
(see `_v_side.png`). Cause: `roundedSlab` extrudes 0.100 deep and only 0.060 of
it is buried, and `rotation.x = side * TUMBLE` is applied *after* the position,
so the slab tilts away from the body at its forward edge.

Do:
- Bury it. Make it an inset, not an appendage: keep the dark `scoop` but push it
  fully into the body (`inset` > half its depth) so only the recess shows, and
  give the surrounding paint a raised lip that overlaps it on all four sides.
- Match the slab's tilt to the flank's local slope instead of `TUMBLE`
  (`rotation.x = side * (TUMBLE + dzdx of the taper at that x)`).
- Shrink it: a real 718RS door-top intake is ~0.30 m wide, not 0.46.

## 2. Windshield reads as a solid black fin

[car.js:847](car.js#L847) — `wsBase {0.505, 0.900}`, `wsTop {0.318, 1.120}`,
`wsWide 0.664`, `wsNarrow 0.588`.

- Lower the top: `wsTop.y ≈ 1.055` (a Spyder RS screen is short) and rake it more
  by moving `wsTop.x` aft to `0.270`.
- The `glass` material is too opaque at grazing angles — that is what makes it a
  slab. Drop `opacity` toward 0.28 and raise `transmission`/`ior` so the cockpit
  shows through.
- The A-pillar `strut()` radius 0.029 is too thick for a 0.22 m screen; 0.020.
- `header` box at `wsTop` currently caps the screen with a 0.05 × 0.044 bar that
  reads as a roll bar. Thin it to 0.034 × 0.030.

## 3. Verify the new taper numerically, then push it

[car.js:284](car.js#L284) `TAPER_PTS`, [:317](car.js#L317) `taperZ`,
[:338](car.js#L338) `fz`, [:343](car.js#L343) `bakeTaper`.

Applied to: `frontGeo`, `rearGeo`, `doorGeo`, `noseGeo`, `tailGeo`, the arch lips,
the seams/rolls, and every `fz()`-placed fitting. **Not** applied to: the wheels
(fine), the interior, `undertray` (3.30 × 1.52 box — it now pokes past the waist
at the doors; narrow to 1.42), the `diffuser`, and the nose `noseFit` children
(they live in a Group at x = 2.340 where taper is 0.945, so they are ~5 % wider
than the cap around them — check the lamp pods against the cap edge).

Add a debug overlay that draws the `taperAt(x)` curve as an SVG polyline over the
top view (`?cam=0,8,0.01&look=0,0,0`) to confirm the silhouette before tuning.

## 4. Nose is still bus-like

[car.js:925](car.js#L925) `noseShape` + the fittings after it.

- The cap's top corners are square in plan. Pull the shoulder in:
  `noseShape` `0.860 → 0.780` at `y 0.262`, and drop the top edge from 0.628 to
  0.596 so the fascia tapers forward instead of standing up.
- `grilleFrame` is 1.070 × 0.240 — a single huge mouth. Split it into a centre
  intake plus two outboard intakes with a body-colour dividing rib, which is what
  the 718 actually has.
- The lamps at local `y 0.328, z ±0.492` sit too low and too far in. A 718RS
  headlamp is an oval high on the wing: try `y 0.392, z ±0.548`.

## 5. Panel seams / skin rolls

[car.js:446](car.js#L446). The `SKIN` sign is now correct (`+ bevelSize`, the
bevel *expands* a clockwise contour — proven with `_probe.html`), so the rolls
finally show. Two follow-ups:

- `skinRoll` lift 0.052 / 0.058 makes the blisters a hard plateau in side view.
  Try 0.036 and widen `half` to 0.150 so the shoulder rolls into the flank.
- The roll's end taper (`k*k*(3-2k)` over 16 % of the span) leaves a visible step
  at the front. Extend the run-out to ~24 % and start it before `x = 0.560`.

## 6. Deck fittings re-rooted — re-check against the new surface

Raised by `+2 × bevelSize` this session: roll hoops
([:808](car.js#L808), legs 0.978 / arch 1.044 / cap 1.076), rear deck humps
([:838](car.js#L838), y 0.981, narrowed to `z ±0.252`, scale z 0.168 so they stay
inside the pan), slatted engine cover ([:1119](car.js#L1119), `deck.position.y`
0.941, `rotation.z` 0.155), cowl 0.906, cowlSeal 0.918, mirrorRear 1.090.

The hoops now stand ~0.21 m above the deck, which is tall for a Spyder RS. Drop
`arch` to 1.010 and `cap` to 1.042 if they still read as submarine fairings.

## 7. Road composition

[styles.css:227](styles.css#L227) is the whole backdrop. [car.js:1541](car.js#L1541)
`buildMarkings`, [:1500](car.js#L1500) `buildGround`.

Three painted strips ride 4 mm above the asphalt at `z = 1.18` (solid edge line),
`z = -1.55` (dashed centre) and `z = -3.40` (far edge). The bottom edge of the
frame meets the ground near `z = 1.4`, so anything nearer than that scrolls off
the stage — that is why the first pass looked like it had no markings at all.

- The asphalt pool in the lower left is bright enough to read as water at the
  full 860 px hero. Try dropping `roughness` back toward 0.8 and cutting
  `envMapIntensity`, or narrowing the spotlight, so the road stays charcoal.
- The near edge line crosses the whole stage diagonally and is the brightest
  thing down there. If it fights the headline, take its opacity under 0.45.
- `--r: 21%` is still a single tuned number. At 1440 and 1024 the city/road join
  reads correctly; at 390 the hero stacks, `--r` no longer matches the stage, and
  the lane line cuts across behind the paragraph. Tie it to the stage clamp
  (`calc()` on `clamp(210px, 22vw, 400px)`) and re-check all three widths — the
  extra backdrop detail makes the misalignment much more obvious than it was.
- Fixtures are placed in **band** coordinates while the skyline `clip-path`
  polygons are in **tile** coordinates, and a band is two tiles. Every `--x`
  above is half the tile's x. Any new mast, crane, sign or beacon has to follow
  that, or it will float out over the road instead of sitting on a roof.

## 8. Before delivery

- [ ] Strip the QA hooks from `car.js`: `?cam=`, `?look=`, `?t=`, `?freeze=`
      (lines 88–120) and the `params` block.
- [ ] Delete scratch files: `_carview.html`, `_probe.html`, `_dbg.html`, `_dbg.js`,
      and every `_v_*.png`.
- [ ] `mug.js` is an unreferenced Version-3 leftover — confirm with the user
      before deleting.
- [ ] `index.html`'s inline SVG fallback still uses the old untapered silhouette;
      re-sync its rear body path and confirm the fallback looks right with
      `?nofallback` removed and JS disabled.
- [ ] `styles.css` `.hero-car-bg` `--r: 18%` is tuned for a 1440 × 860 viewport.
      Check the city/road join at 1024 and 390 px wide — the 3D ground's horizon
      moves with `clamp(210px, 22vw, 400px)` stage height, so `--r` probably needs
      to be `calc()`-based on the same clamp.

---

## Done this session (for reference)

- Loop re-cut so the car drives in instead of spawning: `range` is now
  `halfFrame + 2.3 + 1.4`, which puts the whole body outside the picture at both
  ends of the pass; the `car.group.visible` toggle is gone (the wrap happens
  off-frame, so there is nothing to hide and nothing to pop); `EASE` 0.42 → 0.5
  for a slower entry; `CYCLE`/`DRIVE` 13.0/10.4 → 12.8/11.0, which cuts the empty
  road between passes to 1.8 s; wheel spin skips the wrap frame.
- Bounce cut roughly four times: body travel 0.010 → 0.0025 m at higher
  frequency, roll 0.0025 → 0.0009, squat 0.008 → 0.0035, camera drift
  0.075/0.045 → 0.05/0.028. The CSS fallback keyframe re-timed to 12.8 s / 86 %
  with `cubic-bezier(0.5, 0.25, 0.5, 0.75)`, the sine ease at k = 0.5.

- `SKIN` convention flipped from `contour − bevelSize` to `contour + bevelSize`
  in `yAt`, `skinTube`, `skinRoll` — this un-buried the deck, hoops, humps, slats
  and fender rolls.
- Plan-view taper: `TAPER_PTS` spline → `taperAt(x)` → `taperZ(geo)` with
  inverse-transpose normal transform (keeps `ExtrudeGeometry`'s smooth shading),
  `fz(x, y, out)` for transform-placed fittings, `bakeTaper()` for long ones.
- Hero loop: `CYCLE` 15.5 → 13.0 s, `DRIVE` 12.5 → 10.4 s, position eased with
  `driveF(p) = p − k·sin(2πp)/2π` (accelerate in, cruise, ease out, no seam),
  acceleration-linked nose squat on `body.rotation.z`, slow camera drift so the
  gap between passes is never dead, CSS fallback matched to 13 s with
  `cubic-bezier(0.42, 0.02, 0.58, 0.98)`.
- Road under the car: ground plane widened to `90 × 22` and re-anchored at
  `z = 4.0` with its alpha fade pushed to `v = 0.10 / 0.78` so asphalt runs past
  the body instead of stopping at its wheels, hero camera raised to
  `(1.45, 1.62, 6.00)` looking at `y = 0.72`, CSS `--r` lifted to 21 % with the
  guardrail and far lane line dimmed so nothing bright crosses the car, and
  `buildMarkings()` added.
- Transparent objects are sorted by centre distance, not by depth: the ground
  slab's centre sits nearer the camera than any strip's, so it painted over the
  lane markings. Fixed with `renderOrder` — ground 0, markings 1, contact shadow
  2. Worth remembering for anything else blended on the road.
- CSS city road background: three parallax skyline bands (dot-grid windows,
  clip-path silhouettes, seamless two-tile slide), guardrail band, far
  carriageway with a scrolling lane line, seven streetlights with sodium pools,
  horizon haze, blinking rooftop beacons. All gradients/clip-paths — no bitmaps.

- Backdrop detail pass: a fifth skyline band (`city-haze`, no windows, 380 s),
  rewritten far/mid/near `clip-path` silhouettes with spires and setbacks, two
  coprime window grids plus broad glow patches per band, a `.city-tile::after`
  that blacks out whole storeys so the grids read as rooms rather than wallpaper,
  rooftop aerials, two tower cranes, three hazard beacons and two lit signs (each
  painted twice through `::before`/`::after` at `calc(var(--x) + 50%)` so the
  parallax loop stays seamless), stars with a twinkle layer, two light-pollution
  domes, drifting low cloud, a moon, guardrail cat's-eyes, two counter-running
  traffic streams on the far carriageway, and a blurred near-side pylon that
  sweeps overhead once per pass.

## QA commands

```bash
# side / 3/4 / top
chrome --headless=new --disable-gpu --window-size=1100,620 \
  --virtual-time-budget=14000 \
  --screenshot="E:/Project/new ui/4/_v_34.png" \
  "file:///E:/Project/new%20ui/4/_carview.html?t=5.0&freeze=1&cam=5.6,1.9,5.6&look=-0.1,0.66,0"

# full page (hero + city backdrop)
chrome --headless=new --disable-gpu --window-size=1440,860 \
  --virtual-time-budget=14000 \
  --screenshot="E:/Project/new ui/4/_v_city.png" \
  "file:///E:/Project/new%20ui/4/index.html"
```

Note: `t=` now feeds the eased curve, so a given `t` puts the car somewhere
different than before. Because `range` is derived from `camera.position.z`, a
close `cam` makes the car fill the frame — widen `cam` if the shot is cropped.
Screenshot paths must be absolute.
