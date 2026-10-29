(function () {
'use strict';

const THREE_URL = 'https://unpkg.com/three@0.169.0/build/three.module.js';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.querySelector('.car-stage');
let THREE = null;

if (stage) {
    import(THREE_URL).then((module) => {
        THREE = module;
        init(stage);
    }).catch(() => {});
}

function init(root) {
    const canvas = root.querySelector('.car-canvas');
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) {
        return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0806, 10, 26);

    const camera = new THREE.PerspectiveCamera(21, 3.2, 0.1, 90);
    /* a few degrees of yaw: dead-side flattens the car into a cut-out, while
       this keeps the profile readable and still shows the nose and glass.
       The height and the look target leave a band of asphalt under the wheels
       so the car is visibly on the road rather than in front of it. */
    camera.position.set(1.45, 1.62, 6.00);
    camera.lookAt(0.15, 0.72, 0);

    scene.environment = buildEnvironment(renderer);
    scene.environmentIntensity = 1.0;

    scene.add(buildGround());
    buildMarkings().forEach((m) => scene.add(m));

    const car = buildCar();
    scene.add(car.group);

    scene.add(new THREE.HemisphereLight(0x33405e, 0x120c08, 0.42));

    let range = 8;
    const resize = () => {
        const width = Math.max(root.clientWidth, 1);
        const height = Math.max(root.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        /* Half the frame's width at the car's depth, plus the car's own half
           length and a margin. The drive has to start and end with the whole
           body outside the picture — anything less and it appears to be parked
           at the edge, then pop into view instead of driving in. */
        const halfFrame = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
        range = halfFrame + 2.3 + 1.4;
    };
    resize();
    new ResizeObserver(resize).observe(root);

    const CYCLE = 12.8;
    const DRIVE = 11.0;
    /* A fixed camera watching a drive-by does not see constant speed: the car
       arrives, accelerates through the frame and eases away. f(p) = p - k·sin
       gives exactly that velocity curve, monotone and C-infinity, so there is
       no seam where the easing hands over to the cruise. */
    const EASE = 0.5;
    const driveF = (p) => p - (EASE * Math.sin(2 * Math.PI * p)) / (2 * Math.PI);
    const driveA = (p) => EASE * 2 * Math.PI * Math.sin(2 * Math.PI * p);
    let cycleT = 0;
    let squat = 0;

    const clock = new THREE.Clock();
    let elapsed = 0;
    let visible = true;
    new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
    }).observe(root);

    root.classList.add('is-3d');
    renderer.compile(scene, camera);

    car.group.position.x = REDUCED ? 1.1 : -range;

    const params = new URLSearchParams(location.search);
    const SEEK = parseFloat(params.get('t')) || 0;
    const FREEZE = params.has('freeze');
    /* QA hook: ?cam=x,y,z&look=x,y,z to inspect the model from any angle */
    const lookTarget = new THREE.Vector3(0.15, 0.72, 0);
    if (params.get('cam')) {
        const v = params.get('cam').split(',').map(Number);
        camera.position.set(v[0], v[1], v[2]);
        const t = (params.get('look') || '0,0.84,0').split(',').map(Number);
        lookTarget.set(t[0], t[1], t[2]);
        camera.lookAt(lookTarget);
        resize();
    }
    const CAM0 = camera.position.clone();
    const LOOK0 = lookTarget.clone();
    const LOOK = lookTarget.clone();
    if (SEEK > 0 && !REDUCED) {
        cycleT = SEEK % CYCLE;
        elapsed = SEEK;
        const p = Math.min(cycleT / DRIVE, 1);
        const x = -range + driveF(p) * range * 2;
        car.group.position.x = x;
        squat = 0.0035 * driveA(p);
    }

    function frame() {
        requestAnimationFrame(frame);
        const delta = Math.min(clock.getDelta(), 0.05);
        if (!visible) return;
        elapsed += delta;

        /* the frame is never quite still, so the gap between passes does not
           read as the animation stopping */
        if (!FREEZE) {
            camera.position.x = CAM0.x + Math.sin(elapsed * 0.19) * 0.05;
            camera.position.y = CAM0.y + Math.sin(elapsed * 0.15 + 2.1) * 0.028;
            LOOK.y = LOOK0.y + Math.sin(elapsed * 0.12 + 0.7) * 0.011;
            camera.lookAt(LOOK);
        }

        if (REDUCED) {
            car.group.position.x = 1.1;
        } else if (!FREEZE) {
            const was = cycleT;
            cycleT = (cycleT + delta) % CYCLE;
            if (cycleT < was) cycleT = 0;
            if (cycleT <= DRIVE) {
                const p = cycleT / DRIVE;
                const x = -range + driveF(p) * range * 2;
                /* the wrap teleports the car back off the left edge; both ends
                   are outside the frame, but the wheel spin must not see that
                   jump or the rims flicker a full turn on the seam frame */
                const dx = x - car.group.position.x;
                car.group.position.x = x;
                if (Math.abs(dx) < range) car.spin(dx);
                /* longitudinal squat: the nose lifts while it is still
                   accelerating and dips as it coasts out of frame */
                squat = 0.0035 * driveA(p);
            }
        }

        if (!FREEZE) {
            /* suspension shimmer, not a hop: the body travels under a
               millimetre while the wheels stay planted */
            car.body.position.y = 0.003 + Math.sin(elapsed * 19.0) * 0.0015 + Math.sin(elapsed * 11.3 + 1.2) * 0.001;
            car.body.rotation.z = Math.sin(elapsed * 8.6) * 0.0009 + squat;
        }

        renderer.render(scene, camera);
    }
    frame();
}

/* ------------------------------------------------------------------ */
/* Car — Porsche 718 Spyder RS                                         */
/* ------------------------------------------------------------------ */

function buildCar() {
    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);

    const paint = new THREE.MeshPhysicalMaterial({
        color: 0x959ca4,
        metalness: 0.86,
        roughness: 0.100,
        clearcoat: 1,
        clearcoatRoughness: 0.015,
        envMapIntensity: 2.70,
    });
    const carbon = new THREE.MeshStandardMaterial({ color: 0x121316, metalness: 0.5, roughness: 0.42 });
    const glass = new THREE.MeshPhysicalMaterial({
        color: 0x16202c,
        metalness: 0.2,
        roughness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 2.0,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const trim = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, metalness: 0.3, roughness: 0.48 });
    const intake = new THREE.MeshStandardMaterial({ color: 0x050607, metalness: 0.5, roughness: 0.62 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x1b1d21, metalness: 0.05, roughness: 0.5 });
    const carpet = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, metalness: 0, roughness: 0.95 });
    const strap = new THREE.MeshStandardMaterial({ color: 0x7c1a13, metalness: 0.05, roughness: 0.5 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd6dde3, metalness: 1, roughness: 0.12, envMapIntensity: 1.6 });
    const satin = new THREE.MeshStandardMaterial({ color: 0x3d4249, metalness: 0.85, roughness: 0.32 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 0, roughness: 0.82 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 0.72, roughness: 0.24, envMapIntensity: 1.5 });
    const rimDark = new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: 0.7, roughness: 0.4 });
    const discMat = new THREE.MeshStandardMaterial({ color: 0x4f5358, metalness: 0.9, roughness: 0.38 });
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xb32b16, metalness: 0.25, roughness: 0.42 });
    const lensMat = new THREE.MeshPhysicalMaterial({
        color: 0x15181d,
        metalness: 0.4,
        roughness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 1.7,
    });
    const drlMat = new THREE.MeshBasicMaterial({
        color: 0xfff3dc,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2c12 });

    const add = (mesh, cast) => {
        mesh.castShadow = cast !== false;
        mesh.receiveShadow = true;
        body.add(mesh);
        return mesh;
    };

    /* ---- outer shells ------------------------------------------------ */
    /* split into front / rear so the cockpit is a real opening */
    const AXLE_F = 1.262;
    const AXLE_R = -1.245;
    const WHEEL_R = 0.345;
    const ARCH_F = 0.372;
    const ARCH_R = 0.388;
    /* ExtrudeGeometry with a bevel spans z from -bevelThickness to
       depth + bevelThickness, so the widest point of the flank sits at
       (depth + 2 * bevelThickness) / 2 — not at depth / 2. Everything that
       rides on the body side is placed against FLANK. A deep bevel with a
       small in-plane offset turns the shoulder into a wide, gentle roll
       instead of a hard crease: the difference between a car and a slab. */
    const TUMBLE = 0.082;
    const FLANK = 0.905;
    const BOTTOM = 0.190;
    const archFEnd = Math.asin((BOTTOM - WHEEL_R) / ARCH_F);
    const archREnd = Math.asin((BOTTOM - WHEEL_R) / ARCH_R);

    const shellOpts = {
        depth: 1.410,
        bevelEnabled: true,
        bevelThickness: 0.200,
        bevelSize: 0.055,
        bevelSegments: 6,
        curveSegments: 28,
        steps: 1,
    };

    /* z of the body surface at height y, `out` metres proud of it */
    const flankZ = (y, out) => FLANK + TUMBLE * (y - 0.870) + out;

    /* tuck the flanks in toward the sill: affine, so every face stays planar
       and the normals can be transformed instead of recomputed */
    function tumble(geo, c) {
        const p = geo.attributes.position;
        const n = geo.attributes.normal;
        const y0 = 0.870;
        for (let i = 0; i < p.count; i += 1) {
            const z = p.getZ(i);
            const s = z >= 0 ? 1 : -1;
            p.setZ(i, z + s * c * (p.getY(i) - y0));
            const nx = n.getX(i);
            const nz = n.getZ(i);
            const ny = n.getY(i) - s * c * nz;
            const len = Math.hypot(nx, ny, nz) || 1;
            n.setXYZ(i, nx / len, ny / len, nz / len);
        }
        p.needsUpdate = true;
        n.needsUpdate = true;
    }

    /* ---- plan taper --------------------------------------------------- */
    /* An extrusion is a slab seen from above. The waist has to come from a
       z-scale that varies along x: it is smooth and single-valued so the mesh
       stays watertight, and every fitting that rides the flank is multiplied
       by the same taperAt(x) or it will float off the body at the doors. */
    const TAPER_PTS = [
        [2.260, 0.945], [1.900, 0.985], [1.620, 1.000], [AXLE_F, 1.015],
        [0.900, 1.000], [0.400, 0.965], [-0.200, 0.935], [-0.700, 0.930],
        [-1.000, 0.965], [AXLE_R, 1.020], [-1.600, 1.005], [-1.950, 0.960],
        [-2.200, 0.930],
    ];
    const taperSamples = new THREE.SplineCurve(
        TAPER_PTS.map((p) => new THREE.Vector2(p[0], p[1]))
    ).getPoints(360);
    /* strictly decreasing in x, so a bisection finds the bracket */
    function taperAt(x) {
        const s = taperSamples;
        if (x >= s[0].x) return s[0].y;
        const last = s[s.length - 1];
        if (x <= last.x) return last.y;
        let lo = 0;
        let hi = s.length - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (s[mid].x > x) lo = mid;
            else hi = mid;
        }
        const t = (x - s[lo].x) / (s[hi].x - s[lo].x);
        return s[lo].y + t * (s[hi].y - s[lo].y);
    }

    function taperSlope(x) {
        const h = 0.030;
        return (taperAt(x + h) - taperAt(x - h)) / (2 * h);
    }

    /* z' = k(x)·z. Normals go through the inverse-transpose so the smooth
       shading ExtrudeGeometry built survives the warp. */
    function taperZ(geo) {
        const p = geo.attributes.position;
        const n = geo.attributes.normal;
        for (let i = 0; i < p.count; i += 1) {
            const x = p.getX(i);
            const z = p.getZ(i);
            const k = taperAt(x);
            p.setZ(i, z * k);
            const dzdx = taperSlope(x) * z;
            const nx = n.getX(i) - (dzdx / k) * n.getZ(i);
            const ny = n.getY(i);
            const nz = n.getZ(i) / k;
            const len = Math.hypot(nx, ny, nz) || 1;
            n.setXYZ(i, nx / len, ny / len, nz / len);
        }
        p.needsUpdate = true;
        n.needsUpdate = true;
        return geo;
    }

    /* flank z at a given station, so fittings follow the taper */
    const fz = (x, y, out) => flankZ(y, out) * taperAt(x);

    /* a long flank part cannot sit at one constant z across a tapered body —
       bake its transform into the geometry and warp that, or the ends either
       float off the surface or sink into it */
    function bakeTaper(m, x, y, z) {
        m.geometry.translate(x, y, z);
        taperZ(m.geometry);
        m.position.set(0, 0, 0);
        return m;
    }

    const frontShape = new THREE.Shape();
    frontShape.moveTo(0.500, 0.845);
    /* the hood pan dips and the fender blisters stand above it — that step is
       what makes a Porsche side profile instead of a smooth boat bow */
    frontShape.quadraticCurveTo(0.700, 0.826, 0.930, 0.828);
    frontShape.quadraticCurveTo(1.110, 0.852, 1.340, 0.916);
    frontShape.quadraticCurveTo(1.600, 0.902, 1.840, 0.816);
    frontShape.quadraticCurveTo(2.030, 0.752, 2.150, 0.668);
    frontShape.quadraticCurveTo(2.234, 0.604, 2.252, 0.516);
    frontShape.quadraticCurveTo(2.262, 0.418, 2.240, 0.330);
    frontShape.quadraticCurveTo(2.214, 0.238, 2.150, 0.170);
    frontShape.lineTo(2.112, 0.148);
    frontShape.lineTo(1.742, 0.146);
    frontShape.quadraticCurveTo(1.700, 0.148, 1.688, 0.176);
    frontShape.lineTo(AXLE_F + ARCH_F * Math.cos(archFEnd), BOTTOM);
    frontShape.absarc(AXLE_F, WHEEL_R, ARCH_F, archFEnd, Math.PI - archFEnd, false);
    frontShape.lineTo(0.500, BOTTOM);
    frontShape.closePath();

    const frontGeo = new THREE.ExtrudeGeometry(frontShape, shellOpts);
    frontGeo.translate(0, 0, -0.705);
    tumble(frontGeo, TUMBLE);
    taperZ(frontGeo);
    const frontShell = new THREE.Mesh(frontGeo, paint);
    frontShell.castShadow = true;
    frontShell.receiveShadow = true;
    body.add(frontShell);

    const rearShape = new THREE.Shape();
    rearShape.moveTo(-0.625, 0.870);
    /* the deck crests behind the seats and falls away to the tail: a level
       deck ending in a vertical wall is what made the rear read as a loaf */
    rearShape.quadraticCurveTo(-0.760, 0.902, -0.940, 0.924);
    rearShape.quadraticCurveTo(-1.180, 0.930, -1.440, 0.906);
    rearShape.quadraticCurveTo(-1.760, 0.868, -2.020, 0.812);
    rearShape.quadraticCurveTo(-2.190, 0.776, -2.252, 0.722);
    rearShape.quadraticCurveTo(-2.292, 0.660, -2.286, 0.560);
    rearShape.quadraticCurveTo(-2.280, 0.440, -2.236, 0.336);
    rearShape.quadraticCurveTo(-2.206, 0.268, -2.140, 0.224);
    rearShape.lineTo(-2.100, 0.188);
    rearShape.lineTo(AXLE_R - ARCH_R * Math.cos(archREnd), BOTTOM);
    rearShape.absarc(AXLE_R, WHEEL_R, ARCH_R, Math.PI - archREnd, archREnd, true);
    rearShape.lineTo(-0.625, BOTTOM);
    rearShape.closePath();

    const rearGeo = new THREE.ExtrudeGeometry(rearShape, shellOpts);
    rearGeo.translate(0, 0, -0.705);
    tumble(rearGeo, TUMBLE);
    taperZ(rearGeo);
    const rearShell = new THREE.Mesh(rearGeo, paint);
    rearShell.castShadow = true;
    rearShell.receiveShadow = true;
    body.add(rearShell);

    /* wheel wells keep the arches from reading as see-through tunnels */
    for (const x of [AXLE_F, AXLE_R]) {
        const well = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.50, 1.74), trim);
        well.position.set(x, 0.575, 0);
        add(well, false);
    }

    /* a proud lip around each arch gives the fenders their rolled edge. It is
       a tube along a curve whose z follows the flank, so it hugs the body all
       the way round instead of floating off the bottom of the arc */
    const archLip = [[AXLE_F, ARCH_F, archFEnd], [AXLE_R, ARCH_R, archREnd]];
    for (const [x, r, a0] of archLip) {
        for (const side of [1, -1]) {
            const pts = [];
            for (let i = 0; i <= 24; i += 1) {
                const a = a0 + ((Math.PI - 2 * a0) * i) / 24;
                const y = WHEEL_R + r * Math.sin(a);
                const px = x + r * Math.cos(a);
                pts.push(new THREE.Vector3(px, y, side * fz(px, y, 0.005)));
            }
            const lip = new THREE.Mesh(
                new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 44, 0.012, 8, false),
                paint
            );
            add(lip, false);
        }
    }

    const undertray = new THREE.Mesh(new THREE.BoxGeometry(3.30, 0.07, 1.52), carbon);
    undertray.position.set(0, 0.150, 0);
    add(undertray, false);

    /* front fender louvers just aft of the arch — a strong 718 cue */
    for (const side of [1, -1]) {
        for (let i = 0; i < 3; i += 1) {
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.150), intake);
            blade.position.set(0.760 - i * 0.070, 0.700 + i * 0.052, side * fz(0.760 - i * 0.070, 0.72, 0.006));
            blade.rotation.z = 0.10;
            add(blade, false);
        }
    }

    /* ---- panel seams -------------------------------------------------- */
    /* These shells are drawn clockwise, so the extrude bevel ADDS to the
       section instead of shrinking it: anywhere |z| <= depth/2 the top skin
       sits bevelSize ABOVE the silhouette line. Fittings that ride the deck
       have to be measured against that, not against the profile. */
    const SKIN = shellOpts.bevelSize;
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x040506, metalness: 0.15, roughness: 0.9 });

    const hoodLine = new THREE.Path();
    hoodLine.moveTo(0.500, 0.845);
    hoodLine.quadraticCurveTo(0.700, 0.826, 0.930, 0.828);
    hoodLine.quadraticCurveTo(1.110, 0.852, 1.340, 0.916);
    hoodLine.quadraticCurveTo(1.600, 0.902, 1.840, 0.816);
    hoodLine.quadraticCurveTo(2.030, 0.752, 2.150, 0.668);

    const deckLine = new THREE.Path();
    deckLine.moveTo(-0.625, 0.870);
    deckLine.quadraticCurveTo(-0.760, 0.902, -0.940, 0.924);
    deckLine.quadraticCurveTo(-1.180, 0.930, -1.440, 0.906);
    deckLine.quadraticCurveTo(-1.760, 0.868, -2.020, 0.812);

    const yAt = (line, x) => {
        let best = null;
        for (const p of line.getPoints(200)) {
            if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
        }
        return best.y + SKIN;
    };

    function seamAlong(line, z0, x0, x1, r) {
        skinTube(line, z0, x0, x1, r, 0.002, seamMat, false);
    }

    /* a half-buried roll following the profile — the only way a constant
       section extrusion can get fender shoulders above a lower hood pan. It
       runs itself out at both ends so the crease dies into the skin instead
       of stopping on a visible open tube. */
    function skinTube(line, z0, x0, x1, r, lift, mat, taper) {
        const lo = Math.min(x0, x1);
        const hi = Math.max(x0, x1);
        const pts = line.getPoints(120).filter(p => p.x >= lo && p.x <= hi);
        const n = pts.length - 1;
        for (const side of [1, -1]) {
            const v = pts.map((p, i) => {
                let k = 1;
                if (taper !== false) {
                    const e = Math.min(i, n - i) / (0.16 * n);
                    k = Math.min(1, Math.max(0, e));
                    k = k * k * (3 - 2 * k);
                }
                return new THREE.Vector3(
                    p.x,
                    p.y + SKIN + lift * k - r * (1 - k),
                    side * (z0 + TUMBLE * (p.y + SKIN - 0.870)) * taperAt(p.x)
                );
            });
            add(new THREE.Mesh(
                new THREE.TubeGeometry(new THREE.CatmullRomCurve3(v), v.length, r, 10, false),
                mat
            ), false);
        }
    }

    function seamAcross(x, y, half, r) {
        const k = taperAt(x);
        const line = new THREE.Mesh(new THREE.CylinderGeometry(r, r, half * 2 * k, 6), seamMat);
        line.rotation.x = Math.PI / 2;
        line.position.set(x, y + 0.002, TUMBLE * (y - 0.870) * k);
        add(line, false);
    }

    /* A shallow shoulder roll laid on the skin. A round tube only works for a
       crease; a fender is a wide, low swell, and the only way to get one on a
       constant-section extrusion is a surface patch whose edges tuck back
       below the body so no seam shows. */
    function skinRoll(line, z0, half, lift, x0, x1, mat) {
        const lo = Math.min(x0, x1);
        const hi = Math.max(x0, x1);
        const pts = line.getPoints(120).filter(p => p.x >= lo && p.x <= hi);
        const cols = 10;
        const pos = [];
        const idx = [];
        for (const side of [1, -1]) {
            const first = pos.length / 3;
            for (let i = 0; i < pts.length; i += 1) {
                const y0 = pts[i].y + SKIN;
                const zs = TUMBLE * (y0 - 0.870);
                for (let j = 0; j <= cols; j += 1) {
                    const dz = (j / cols) * 2 - 1;
                    const k = Math.cos(dz * Math.PI / 2);
                    pos.push(pts[i].x, y0 + lift * (k * k - 0.18),
                        side * (z0 + dz * half + zs) * taperAt(pts[i].x));
                }
            }
            for (let i = 0; i < pts.length - 1; i += 1) {
                for (let j = 0; j < cols; j += 1) {
                    const a = first + i * (cols + 1) + j;
                    const b = a + cols + 1;
                    /* the columns run outward on the near side and inward on
                       the far one, so the two halves need opposite winding or
                       one of them is culled away */
                    if (side > 0) idx.push(a, a + 1, b, b, a + 1, b + 1);
                    else idx.push(a, b, a + 1, b, b + 1, a + 1);
                }
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        add(new THREE.Mesh(geo, mat));
    }

    /* the hood pan sits between the two fender blisters, so its edges run the
       length of the car and pick up a shadow line all the way to the nose */
    seamAlong(hoodLine, 0.418, 0.500, 2.050, 0.0070);
    seamAcross(2.050, yAt(hoodLine, 2.050), 0.418, 0.0070);

    /* same for the engine cover, whose slats already stand inside this frame */
    seamAlong(deckLine, 0.418, -1.900, -0.630, 0.0070);
    seamAcross(-1.900, yAt(deckLine, -1.900), 0.418, 0.0070);

    /* the blisters themselves: without a crest the whole front is one
       continuous dome, which is what reads as a toy rather than a car */
    skinRoll(hoodLine, 0.560, 0.132, 0.052, 0.560, 2.010, paint);
    skinRoll(deckLine, 0.560, 0.132, 0.058, -0.660, -1.930, paint);

    /* ---- doors / sills ---------------------------------------------- */
    const doorShape = new THREE.Shape();
    doorShape.moveTo(-0.625, BOTTOM);
    doorShape.lineTo(0.500, BOTTOM);
    doorShape.lineTo(0.500, 0.845);
    doorShape.quadraticCurveTo(0.200, 0.836, -0.200, 0.842);
    doorShape.quadraticCurveTo(-0.430, 0.854, -0.625, 0.870);
    doorShape.closePath();

    const doorGeoBase = new THREE.ExtrudeGeometry(doorShape, {
        depth: 0.040,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.008,
        bevelSegments: 2,
        curveSegments: 8,
        steps: 1,
    });
    doorGeoBase.translate(0, 0, -0.020);

    /* creates the planted look: body-colour rocker instead of a black box */
    for (const side of [1, -1]) {
        const doorGeo = doorGeoBase.clone();
        doorGeo.translate(0, 0, side * 0.883);
        tumble(doorGeo, TUMBLE);
        taperZ(doorGeo);
        const skin = new THREE.Mesh(doorGeo, paint);
        add(skin);

        /* lower rocker flare, dark so the flank reads as a lit shoulder over a
           shaded lower body instead of one flat plane */
        const rocker = roundedSlab(1.020, 0.085, 0.055, 0.030, carbon);
        add(bakeTaper(rocker, -0.060, 0.232, side * (fz(-0.060, 0.232, 0.022) - 0.0375)));

        const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.030, 0.050), carbon);
        add(bakeTaper(skirt, -0.060, 0.196, side * (fz(-0.060, 0.196, 0.014) - 0.025)), false);

        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.13, 14), paint);
        rail.geometry.rotateZ(Math.PI / 2);
        add(bakeTaper(rail, -0.060, 0.850, side * (fz(-0.060, 0.850, 0.006) - 0.028)), false);

        const handleCup = roundedSlab(0.155, 0.048, 0.030, 0.014, trim);
        handleCup.position.set(0.075, 0.748, side * (fz(0.075, 0.748, 0.010) - 0.025));
        add(handleCup, false);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.016, 0.026), chrome);
        handle.position.set(0.070, 0.752, side * (fz(0.070, 0.752, 0.026) - 0.013));
        add(handle, false);

        /* the door's lower shadow line — the flank needs one horizontal break
           or it reads as a single flat plane */
        const crease = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.014, 0.016), trim);
        add(bakeTaper(crease, -0.060, 0.478, side * (fz(-0.060, 0.478, 0.010) - 0.008)), false);

        /* side intake at the door's trailing edge. It has to stay well below
           the beltline: a recess that breaks the top of the flank reads as a
           rolled-down window instead of a scoop. */
        const scoop = roundedSlab(0.460, 0.116, 0.100, 0.034, intake);
        scoop.position.set(-0.850, 0.738, side * (fz(-0.850, 0.738, 0.010) - 0.060));
        scoop.rotation.x = side * TUMBLE;
        add(scoop, false);

        const ventBlade = roundedSlab(0.440, 0.026, 0.086, 0.011, paint);
        ventBlade.position.set(-0.850, 0.744, side * (fz(-0.850, 0.744, 0.042) - 0.053));
        ventBlade.rotation.x = side * TUMBLE;
        add(ventBlade);

        const ventLip = roundedSlab(0.480, 0.028, 0.078, 0.012, paint);
        ventLip.position.set(-0.850, 0.668, side * (fz(-0.850, 0.668, 0.030) - 0.049));
        ventLip.rotation.x = side * TUMBLE;
        add(ventLip);

        /* mirrors on the door top */
        const mirror = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14), paint);
        mirror.scale.set(0.072, 0.034, 0.062);
        mirror.position.set(0.452, 0.876, side * (fz(0.452, 0.876, 0.050) - 0.062));
        add(mirror);

        const mirrorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.044, 0.088), glass);
        mirrorGlass.position.set(0.388, 0.876, side * (fz(0.452, 0.876, 0.050) - 0.062));
        add(mirrorGlass, false);

        const mirrorStalk = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.026, 0.070), trim);
        mirrorStalk.position.set(0.462, 0.850, side * (fz(0.462, 0.850, 0.004) - 0.035));
        add(mirrorStalk, false);
    }

    /* ---- cockpit ---------------------------------------------------- */
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.03, 1.24), carpet);
    floor.position.set(-0.070, 0.555, 0);
    add(floor, false);

    for (const side of [1, -1]) {
        const card = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.33, 0.04), leather);
        card.position.set(-0.070, 0.700, side * 0.585);
        add(card, false);
    }

    const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 1.24), leather);
    bulkhead.position.set(-0.588, 0.700, 0);
    add(bulkhead, false);

    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.10, 1.26), leather);
    dash.position.set(0.39, 0.785, 0);
    add(dash, false);

    const dashTop = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.03, 1.30), carpet);
    dashTop.position.set(0.41, 0.845, 0);
    add(dashTop, false);

    const binnacle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.30), leather);
    binnacle.position.set(0.30, 0.862, 0.31);
    add(binnacle, false);

    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 24), satin);
    gauge.rotation.z = Math.PI / 2;
    gauge.position.set(0.232, 0.852, 0.31);
    add(gauge, false);

    const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.09, 0.22), leather);
    consoleBox.position.set(-0.06, 0.63, 0);
    add(consoleBox, false);

    function roundedSlab(w, h, d, r, mat) {
        const s = new THREE.Shape();
        s.moveTo(-w / 2 + r, -h / 2);
        s.lineTo(w / 2 - r, -h / 2);
        s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
        s.lineTo(w / 2, h / 2 - r);
        s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
        s.lineTo(-w / 2 + r, h / 2);
        s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
        s.lineTo(-w / 2, -h / 2 + r);
        s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
        const g = new THREE.ExtrudeGeometry(s, {
            depth: d,
            bevelEnabled: true,
            bevelThickness: 0.010,
            bevelSize: 0.010,
            bevelSegments: 3,
            curveSegments: 4,
            steps: 1,
        });
        g.translate(0, 0, -d / 2);
        const m = new THREE.Mesh(g, mat);
        m.castShadow = true;
        m.receiveShadow = true;
        return m;
    }

    function buildSeat(z) {
        const seat = new THREE.Group();
        seat.position.set(-0.30, 0, z);

        const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.075, 0.40), leather);
        cushion.position.set(0.04, 0.605, 0);
        seat.add(cushion);

        for (const s of [1, -1]) {
            const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.085, 0.075), leather);
            bolster.position.set(0.04, 0.625, s * 0.185);
            seat.add(bolster);
        }

        const back = new THREE.Group();
        back.position.set(-0.185, 0.600, 0);
        back.rotation.z = 0.24;
        seat.add(back);

        const backrest = roundedSlab(0.39, 0.40, 0.10, 0.05, leather);
        backrest.rotation.y = Math.PI / 2;
        backrest.position.set(0, 0.185, 0);
        back.add(backrest);

        const shell = roundedSlab(0.42, 0.43, 0.026, 0.05, carbon);
        shell.rotation.y = Math.PI / 2;
        shell.position.set(-0.066, 0.185, 0);
        back.add(shell);

        for (const s of [1, -1]) {
            const wing = roundedSlab(0.10, 0.28, 0.13, 0.04, leather);
            wing.rotation.y = Math.PI / 2;
            wing.position.set(0.020, 0.185, s * 0.168);
            back.add(wing);

            const belt = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.30, 0.048), strap);
            belt.position.set(-0.052, 0.185, s * 0.058);
            belt.rotation.z = s * 0.03;
            back.add(belt);
        }

        const headrest = roundedSlab(0.25, 0.13, 0.10, 0.05, leather);
        headrest.rotation.y = Math.PI / 2;
        headrest.position.set(0, 0.400, 0);
        back.add(headrest);

        seat.traverse((o) => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });
        body.add(seat);
    }

    buildSeat(0.31);
    buildSeat(-0.31);

    /* steering wheel */
    const steering = new THREE.Group();
    steering.position.set(0.255, 0.805, 0.31);
    steering.rotation.set(0, -Math.PI / 2, -0.42);

    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.017, 12, 36), leather);
    steering.add(wheelRim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.03, 20), trim);
    hub.rotation.x = Math.PI / 2;
    steering.add(hub);

    for (const [sx, sy] of [[0, -0.9], [0.78, 0.46], [-0.78, 0.46]]) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.028, 0.012), satin);
        spoke.position.set(sx * 0.083, sy * 0.083, 0);
        spoke.rotation.z = Math.atan2(sy, sx);
        steering.add(spoke);
    }

    steering.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
    body.add(steering);

    /* roll hoops — legs start under the deck skin and rise above the glass */
    for (const z of [0.31, -0.31]) {
        const hoop = new THREE.Group();
        hoop.position.set(-0.645, 0, z);

        for (const s of [1, -1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.036, 0.24, 12), paint);
            leg.position.set(0, 0.978, s * 0.066);
            hoop.add(leg);
        }

        const arch = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.030, 10, 24, Math.PI), paint);
        arch.rotation.y = Math.PI / 2;
        arch.position.set(0, 1.044, 0);
        hoop.add(arch);

        const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), trim);
        cap.scale.set(0.030, 0.014, 0.066);
        cap.position.set(0, 1.076, 0);
        hoop.add(cap);

        hoop.traverse((o) => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });
        body.add(hoop);
    }

    /* rear deck humps — they stay inside the pan bounded by the shoulder
       rolls, otherwise they slice straight through the shutlines */
    for (const z of [0.252, -0.252]) {
        const hump = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), paint);
        hump.scale.set(0.34, 0.100, 0.168);
        hump.position.set(-0.98, 0.981, z);
        add(hump);
    }

    /* ---- windshield ------------------------------------------------- */
    /* the hood pan's skin rides SKIN above the silhouette, so the glass foot
       starts there and not on the profile line */
    const wsBase = { x: 0.505, y: 0.900 };
    const wsTop = { x: 0.318, y: 1.120 };
    const wsWide = 0.664;
    const wsNarrow = 0.588;

    /* glass bows forward slightly so the side reflection is not a flat sheet */
    const wsRows = [
        [0, wsBase.y],
        [0.34, wsBase.y + (wsTop.y - wsBase.y) * 0.378],
        [0.67, wsBase.y + (wsTop.y - wsBase.y) * 0.702],
        [1, wsTop.y],
    ];
    const wsPos = [];
    const wsHalf = (t) => wsWide + (wsNarrow - wsWide) * t;
    const wsX = (t) => wsBase.x + (wsTop.x - wsBase.x) * t;
    for (let r = 0; r < wsRows.length - 1; r += 1) {
        const [t0, y0] = wsRows[r];
        const [t1, y1] = wsRows[r + 1];
        const x0 = wsX(t0) + Math.sin(t0 * Math.PI) * 0.026;
        const x1 = wsX(t1) + Math.sin(t1 * Math.PI) * 0.026;
        const h0 = wsHalf(t0);
        const h1 = wsHalf(t1);
        wsPos.push(
            x0, y0, -h0, x0, y0, h0, x1, y1, h1,
            x0, y0, -h0, x1, y1, h1, x1, y1, -h1,
        );
    }
    const wsGeo = new THREE.BufferGeometry();
    wsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wsPos), 3));
    wsGeo.computeVertexNormals();
    const windshield = new THREE.Mesh(wsGeo, glass);
    add(windshield, false);

    function strut(ax, ay, az, bx, by, bz, r, mat) {
        const a = new THREE.Vector3(ax, ay, az);
        const b = new THREE.Vector3(bx, by, bz);
        const dir = new THREE.Vector3().subVectors(b, a);
        const len = dir.length();
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        add(m, false);
        return m;
    }

    for (const side of [1, -1]) {
        strut(wsBase.x, wsBase.y - 0.012, side * wsWide, wsTop.x, wsTop.y, side * wsNarrow, 0.029, satin);
        strut(wsBase.x, wsBase.y, side * wsWide, wsBase.x + 0.020, wsBase.y - 0.060, side * (wsWide + 0.008), 0.040, trim);
    }

    const header = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.044, wsNarrow * 2 + 0.06), satin);
    header.position.set(wsTop.x, wsTop.y, 0);
    header.rotation.z = Math.atan2(wsTop.x - wsBase.x, wsTop.y - wsBase.y);
    add(header, false);

    const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.030, 1.36), paint);
    cowl.position.set(0.492, 0.906, 0);
    add(cowl, false);

    const cowlSeal = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.022, 1.31), trim);
    cowlSeal.position.set(0.515, 0.918, 0);
    add(cowlSeal, false);

    const mirrorRear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.054, 0.20), trim);
    mirrorRear.position.set(0.336, 1.090, 0);
    add(mirrorRear, false);

    /* ---- nose cap ---------------------------------------------------- */
    /* The shells are extruded at constant width, so the front of the car has
       to bring its own taper. This fascia is a profile drawn in the y-z plane
       and extruded forward: it gives a flat face to hang lamps and intakes on
       and stands narrower than the flanks, which is what reads as a nose.
       Its top edge has to land on the shell's own leading curve, or the cap
       presents a shelf across the front instead of a nose; tilting it puts the
       rake back that a constant-section extrusion cannot express. */
    const noseShape = new THREE.Shape();
    noseShape.moveTo(-0.806, 0.188);
    noseShape.lineTo(0.806, 0.188);
    noseShape.quadraticCurveTo(0.872, 0.192, 0.860, 0.262);
    noseShape.lineTo(0.668, 0.548);
    noseShape.quadraticCurveTo(0.640, 0.622, 0.560, 0.628);
    noseShape.lineTo(-0.560, 0.628);
    noseShape.quadraticCurveTo(-0.640, 0.622, -0.668, 0.548);
    noseShape.lineTo(-0.860, 0.262);
    noseShape.quadraticCurveTo(-0.872, 0.192, -0.806, 0.188);

    const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
        depth: 0.348,
        bevelEnabled: true,
        bevelThickness: 0.088,
        bevelSize: 0.048,
        bevelSegments: 5,
        curveSegments: 10,
        steps: 1,
    });
    noseGeo.rotateY(Math.PI / 2);
    noseGeo.translate(1.904, 0, 0);
    noseGeo.translate(-2.340, -0.188, 0);
    noseGeo.rotateZ(0.140);
    noseGeo.translate(2.340, 0.188, 0);
    taperZ(noseGeo);
    add(new THREE.Mesh(noseGeo, paint));

    const NOSE_X = 2.340;
    const NOSE_RAKE = 0.140;

    /* Everything hung on the nose face lives in this frame: local x is
       measured forward from the face plane and local y up from the bottom
       edge, so the tilt that rakes the cap rakes its fittings with it. */
    const noseFit = new THREE.Group();
    noseFit.position.set(NOSE_X, 0.188, 0);
    noseFit.rotation.z = NOSE_RAKE;
    body.add(noseFit);

    /* a panel standing on the nose face: w across, h tall, d forward */
    const facePanel = (w, h, d, r, mat, proud) => {
        const m = roundedSlab(w, h, d, r, mat);
        m.rotation.y = Math.PI / 2;
        m.position.x = proud - d / 2 - 0.010;
        return m;
    };

    /* ---- front end -------------------------------------------------- */
    for (const side of [1, -1]) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.010, 0.080), intake);
        vent.position.set(0.800, 0.784, side * 0.280);
        add(vent, false);
    }

    /* wide lower grille with a chrome hairline and vertical bars */
    const grilleFrame = facePanel(1.070, 0.240, 0.030, 0.055, trim, 0.010);
    grilleFrame.position.y = 0.118;
    noseFit.add(grilleFrame);

    const grille = facePanel(1.020, 0.200, 0.050, 0.050, intake, 0.014);
    grille.position.y = 0.118;
    noseFit.add(grille);

    for (const z of [-0.360, -0.120, 0.120, 0.360]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.175, 0.020), satin);
        bar.position.set(0.014, 0.118, z);
        noseFit.add(bar);
    }

    for (const side of [1, -1]) {
        const duct = facePanel(0.215, 0.165, 0.040, 0.045, intake, 0.012);
        duct.position.set(duct.position.x, 0.128, side * 0.660);
        noseFit.add(duct);

        const lamp = new THREE.Group();
        lamp.position.set(0, 0.328, side * 0.492);
        lamp.rotation.x = side * 0.10;
        noseFit.add(lamp);

        const bezel = facePanel(0.330, 0.140, 0.030, 0.055, chrome, 0.014);
        lamp.add(bezel);

        const housing = facePanel(0.296, 0.108, 0.055, 0.042, lensMat, 0.024);
        lamp.add(housing);

        const drl = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.020, 0.216), drlMat);
        drl.position.set(0.022, -0.032, 0);
        lamp.add(drl);

        const projector = new THREE.Mesh(new THREE.SphereGeometry(0.020, 16, 12), bulbMat);
        projector.scale.set(0.5, 1, 1.25);
        projector.position.set(0.020, 0.012, -side * 0.052);
        lamp.add(projector);

        /* the lens wraps onto the fender so the lamp still reads from the side */
        const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.042, 0.075), lensMat);
        wrap.position.set(2.246, 0.560, side * (fz(2.246, 0.560, 0.000) - 0.030));
        add(wrap, false);

        const wrapDrl = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.014, 0.052), drlMat);
        wrapDrl.position.set(2.266, 0.554, side * (fz(2.266, 0.554, 0.004) - 0.026));
        add(wrapDrl, false);
    }

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.030, 1.50), carbon);
    splitter.position.set(2.090, 0.150, 0);
    add(splitter, false);

    /* ---- tail cap ---------------------------------------------------- */
    /* same trick as the nose: the shell is constant width, so the tail needs
       its own tapered fascia or the rear reads as the stern of a boat */
    const tailShape = new THREE.Shape();
    tailShape.moveTo(-0.800, 0.192);
    tailShape.lineTo(0.800, 0.192);
    tailShape.quadraticCurveTo(0.862, 0.196, 0.850, 0.262);
    tailShape.lineTo(0.660, 0.640);
    tailShape.quadraticCurveTo(0.640, 0.712, 0.560, 0.716);
    tailShape.lineTo(-0.560, 0.716);
    tailShape.quadraticCurveTo(-0.640, 0.712, -0.660, 0.640);
    tailShape.lineTo(-0.850, 0.262);
    tailShape.quadraticCurveTo(-0.862, 0.196, -0.800, 0.192);

    const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
        depth: 0.240,
        bevelEnabled: true,
        bevelThickness: 0.075,
        bevelSize: 0.045,
        bevelSegments: 5,
        curveSegments: 10,
        steps: 1,
    });
    tailGeo.rotateY(-Math.PI / 2);
    tailGeo.translate(-2.015, 0, 0);
    taperZ(tailGeo);
    add(new THREE.Mesh(tailGeo, paint));

    const TAIL_X = -2.330;

    /* a panel standing on the tail face: w across, h tall, d rearward */
    const backPanel = (w, h, d, r, mat, backX) => {
        const m = roundedSlab(w, h, d, r, mat);
        m.rotation.y = -Math.PI / 2;
        m.position.x = backX + d / 2 + 0.010;
        return m;
    };

    /* ---- rear end --------------------------------------------------- */
    const bar = backPanel(1.340, 0.086, 0.030, 0.030, trim, TAIL_X - 0.010);
    bar.position.y = 0.638;
    add(bar, false);

    const tailCore = new THREE.MeshBasicMaterial({ color: 0xff7a55 });
    for (const side of [1, -1]) {
        const lens = backPanel(0.380, 0.062, 0.034, 0.026, tailMat, TAIL_X - 0.020);
        lens.position.y = 0.638;
        lens.position.z = side * 0.450;
        add(lens, false);

        const core = backPanel(0.300, 0.026, 0.020, 0.012, tailCore, TAIL_X - 0.028);
        core.position.y = 0.646;
        core.position.z = side * 0.450;
        add(core, false);

        /* the lens wraps onto the rear corner for the side view */
        const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.062, 0.150), tailMat);
        wrap.position.set(-2.252, 0.646, side * (fz(-2.252, 0.646, 0.004) - 0.068));
        add(wrap, false);

        const wrapCore = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.024, 0.100), tailCore);
        wrapCore.position.set(-2.268, 0.652, side * (fz(-2.268, 0.652, 0.010) - 0.060));
        add(wrapCore, false);
    }

    const rearGrille = backPanel(0.940, 0.190, 0.040, 0.055, intake, TAIL_X - 0.008);
    rearGrille.position.y = 0.398;
    add(rearGrille, false);

    /* twin centre exhausts sitting in the grille */
    for (const z of [0.155, -0.155]) {
        const tip = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.008, 8, 26), chrome);
        tip.rotation.y = Math.PI / 2;
        tip.position.set(TAIL_X - 0.030, 0.398, z);
        add(tip, false);

        const soot = new THREE.Mesh(new THREE.CircleGeometry(0.040, 20), intake);
        soot.rotation.y = -Math.PI / 2;
        soot.position.set(TAIL_X - 0.026, 0.398, z);
        add(soot, false);
    }

    const plate = backPanel(0.340, 0.098, 0.018, 0.012, satin, TAIL_X - 0.014);
    plate.position.y = 0.262;
    add(plate, false);

    /* slatted engine cover — the deck falls away aft, so the whole grille is
       tilted to sit on the skin rather than hover over it */
    const deck = new THREE.Group();
    deck.position.set(-1.600, 0.941, 0);
    deck.rotation.z = 0.155;
    body.add(deck);

    const deckBed = new THREE.Mesh(new THREE.BoxGeometry(0.500, 0.010, 0.840), intake);
    deckBed.position.y = 0.004;
    deck.add(deckBed);

    for (let i = 0; i < 6; i += 1) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.016, 0.780), paint);
        blade.position.set(-0.200 + i * 0.080, 0.013, 0);
        blade.castShadow = true;
        deck.add(blade);
    }

    const deckLip = new THREE.Mesh(new THREE.BoxGeometry(0.520, 0.012, 0.026), trim);
    deckLip.position.set(0, 0.010, 0.420);
    deck.add(deckLip);
    const deckLip2 = deckLip.clone();
    deckLip2.position.z = -0.420;
    deck.add(deckLip2);

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.13, 1.26), carbon);
    diffuser.position.set(-2.200, 0.170, 0);
    add(diffuser, false);

    for (const z of [-0.42, -0.14, 0.14, 0.42]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.012), trim);
        fin.position.set(-2.200, 0.165, z);
        add(fin, false);
    }

    /* ---- wheels ----------------------------------------------------- */    const wheels = [];
    const mats = { rubber, rim: rimMat, rimDark, disc: discMat, caliper: caliperMat };
    const setup = [
        [AXLE_F, 0.748, 0.126],
        [AXLE_F, -0.748, 0.126],
        [AXLE_R, 0.740, 0.140],
        [AXLE_R, -0.740, 0.140],
    ];
    for (const [x, z, halfW] of setup) {
        const wheel = buildWheel(z > 0 ? 1 : -1, halfW, mats);
        wheel.group.position.set(x, WHEEL_R, z);
        group.add(wheel.group);
        wheels.push(wheel);
    }

    /* ---- lighting rig ---------------------------------------------- */
    const lights = [];
    for (const z of [-0.492, 0.492]) {
        const spot = new THREE.SpotLight(0xfff0ce, 80, 24, 0.32, 0.7, 1.6);
        spot.position.set(2.312, 0.516, z);
        spot.target.position.set(10, -0.05, z * 2.4);
        group.add(spot);
        group.add(spot.target);
        lights.push(spot);
    }

    const tailGlow = new THREE.PointLight(0xff3018, 1.1, 3.2, 1.8);
    tailGlow.position.set(-2.40, 0.64, 0.35);
    group.add(tailGlow);

    /* keeps the tub from reading as a black hole */
    const cabin = new THREE.PointLight(0xffe2c0, 1.0, 2.0, 2);
    cabin.position.set(0.10, 1.42, 0.35);
    group.add(cabin);

    const beam = new THREE.Mesh(
        new THREE.PlaneGeometry(7.2, 4.4),
        new THREE.MeshBasicMaterial({
            map: beamTexture(), color: 0xffe3b8, transparent: true,
            opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending,
        })
    );
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(4.4, 0.005, 0);
    group.add(beam);

    const tailPool = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.4),
        new THREE.MeshBasicMaterial({
            map: poolTexture(), color: 0xff3518, transparent: true,
            opacity: 0.30, depthWrite: false, blending: THREE.AdditiveBlending,
        })
    );
    tailPool.rotation.x = -Math.PI / 2;
    tailPool.position.set(-3.2, 0.005, 0);
    group.add(tailPool);

    const halo = glowTexture();
    for (const z of [-0.492, 0.492]) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: halo, color: 0xffeccb, transparent: true, opacity: 0.50,
            depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        sprite.position.set(2.336, 0.516, z);
        sprite.scale.set(0.19, 0.10, 1);
        group.add(sprite);
    }

    const tailHalo = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 0.55),
        new THREE.MeshBasicMaterial({
            map: halo, color: 0xff3a1c, transparent: true, opacity: 0.55,
            depthWrite: false, blending: THREE.AdditiveBlending,
        })
    );
    tailHalo.rotation.y = -Math.PI / 2;
    tailHalo.position.set(-2.37, 0.638, 0);
    group.add(tailHalo);

    const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
    key.position.set(3.6, 6.8, 3.4);
    key.target.position.set(0, 0.4, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -3.4;
    key.shadow.camera.right = 3.4;
    key.shadow.camera.top = 3.4;
    key.shadow.camera.bottom = -3.4;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.018;
    group.add(key);
    group.add(key.target);

    const rim = new THREE.DirectionalLight(0xb4c6f0, 1.25);
    rim.position.set(-3.8, 2.9, -4.4);
    rim.target.position.set(0, 0.6, 0);
    group.add(rim);
    group.add(rim.target);

    const kicker = new THREE.DirectionalLight(0xffa468, 0.32);
    kicker.position.set(-4.4, 1.5, 3.2);
    kicker.target.position.set(0, 0.5, 0);
    group.add(kicker);
    group.add(kicker.target);

    const fill = new THREE.DirectionalLight(0xc9d7ea, 0.7);
    fill.position.set(2.4, 1.9, 5.6);
    fill.target.position.set(0, 0.5, 0);
    group.add(fill);
    group.add(fill.target);

    const contact = new THREE.Mesh(
        new THREE.PlaneGeometry(5.0, 2.25),
        new THREE.MeshBasicMaterial({
            map: contactTexture(),
            transparent: true,
            depthWrite: false,
            opacity: 0.55,
        })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(0, 0.01, 0);
    contact.renderOrder = 2;
    group.add(contact);

    function spin(dx) {
        for (const wheel of wheels) {
            wheel.spin.rotation.z -= dx / 0.35;
        }
    }

    return { group, body, spin, wheels, lights };
}

function buildWheel(side, halfW, M) {
    const group = new THREE.Group();
    const spin = new THREE.Group();
    group.add(spin);

    const profile = [
        [0.246, -halfW], [0.297, -halfW], [0.328, -halfW * 0.84], [0.341, -halfW * 0.52],
        [0.345, 0], [0.341, halfW * 0.52], [0.328, halfW * 0.84], [0.297, halfW], [0.246, halfW],
    ].map(([r, y]) => new THREE.Vector2(r, y));

    const tireGeo = new THREE.LatheGeometry(profile, 48);
    tireGeo.rotateX(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, M.rubber);
    tire.castShadow = true;
    tire.receiveShadow = true;
    spin.add(tire);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.232, 0.232, 0.21, 36, 1, true), M.rimDark);
    barrel.rotation.x = Math.PI / 2;
    spin.add(barrel);

    /* dark well behind the spokes: without it the brake disc fills the whole
       face and the wheel reads as one bright disc instead of an open rim */
    const well = new THREE.Mesh(new THREE.CircleGeometry(0.230, 40), M.rimDark);
    well.position.z = side * 0.022;
    if (side < 0) well.rotation.y = Math.PI;
    spin.add(well);

    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.247, 0.018, 10, 48), M.rim);
    lip.position.z = side * 0.118;
    spin.add(lip);

    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.234, 0.011, 8, 44), M.rim);
    innerRing.position.z = side * 0.112;
    spin.add(innerRing);

    /* five twin spokes, thin enough to read as forged rather than cast */
    for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 10;
        for (const off of [-0.078, 0.078]) {
            const angle = a + off;
            const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.246, 0.030), M.rim);
            spoke.position.set(Math.cos(angle) * 0.114, Math.sin(angle) * 0.114, side * 0.118);
            spoke.rotation.z = angle - Math.PI / 2;
            spin.add(spoke);
        }
    }

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.032, 24), M.rim);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = side * 0.132;
    spin.add(hub);

    const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.024, 6), M.rimDark);
    lock.rotation.x = Math.PI / 2;
    lock.position.z = side * 0.152;
    spin.add(lock);

    const cap = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.005, 8, 28), M.rim);
    cap.position.z = side * 0.148;
    spin.add(cap);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.026, 40), M.disc);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = side * 0.055;
    spin.add(disc);

    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.055), M.caliper);
    caliper.position.set(-0.14, 0.1, side * 0.070);
    caliper.rotation.z = 0.75;
    group.add(caliper);

    return { group, spin };
}

/* ------------------------------------------------------------------ */
/* Environment, road, textures                                         */
/* ------------------------------------------------------------------ */

function buildEnvironment(renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const horizon = 470;

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#3a4757');
    sky.addColorStop(0.08, '#2a3542');
    sky.addColorStop(0.45, '#161d27');
    sky.addColorStop(0.8, '#1d2833');
    sky.addColorStop(1, '#3d4d60');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 2048, horizon);

    const ground = ctx.createLinearGradient(0, horizon, 0, 1024);
    ground.addColorStop(0, '#3d4755');
    ground.addColorStop(0.18, '#1b2028');
    ground.addColorStop(0.55, '#0d1014');
    ground.addColorStop(1, '#050506');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, 2048, 1024 - horizon);

    /* horizon line: the long highlight that runs the length of the flanks */
    ctx.filter = 'blur(3px)';
    const strip = ctx.createLinearGradient(0, 432, 0, 500);
    strip.addColorStop(0, 'rgba(236, 245, 255, 0)');
    strip.addColorStop(0.5, 'rgba(248, 252, 255, 0.95)');
    strip.addColorStop(1, 'rgba(236, 245, 255, 0)');
    ctx.fillStyle = strip;
    ctx.fillRect(0, 432, 2048, 68);
    ctx.filter = 'none';

    /* narrow, bright panels: they read as streaks travelling along the flanks */
    const panels = [
        [280, 360, 108, 96, 0.62],
        [1190, 330, 84, 110, 0.50],
        [1760, 372, 120, 80, 0.38],
    ];
    ctx.filter = 'blur(16px)';
    for (const [x, y, rx, ry, a] of panels) {
        ctx.fillStyle = `rgba(214, 228, 248, ${a})`;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    /* broad overhead source for the hood, deck and humps */
    ctx.filter = 'blur(46px)';
    ctx.fillStyle = 'rgba(196, 212, 234, 0.16)';
    ctx.fillRect(0, 0, 2048, 130);

    /* warm low sun on the far side keeps the dusk cast */
    ctx.fillStyle = 'rgba(255, 152, 82, 0.34)';
    ctx.beginPath();
    ctx.ellipse(1760, 520, 260, 84, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 194, 136, 0.26)';
    ctx.beginPath();
    ctx.ellipse(1780, 498, 100, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';

    /* crisp overhead strips: specular streaks along hood, deck and humps */
    ctx.filter = 'blur(7px)';
    ctx.fillStyle = 'rgba(240, 247, 255, 0.62)';
    ctx.fillRect(560, 168, 300, 12);
    ctx.fillRect(1180, 126, 230, 10);
    ctx.fillRect(1560, 196, 200, 8);
    ctx.filter = 'none';

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(texture).texture;
    texture.dispose();
    pmrem.dispose();
    return env;
}

function buildGround() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0e0e10';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 2600; i += 1) {
        const v = Math.random();
        ctx.fillStyle = v > 0.55
            ? `rgba(255, 250, 240, ${(0.008 + Math.random() * 0.026).toFixed(3)})`
            : `rgba(0, 0, 0, ${(0.05 + Math.random() * 0.12).toFixed(3)})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
    }

    for (let i = 0; i < 52; i += 1) {
        ctx.fillStyle = `rgba(255, 246, 232, ${(0.005 + Math.random() * 0.014).toFixed(3)})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 26 + Math.random() * 200, 1);
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
        ctx.beginPath();
        let px = Math.random() * size;
        let py = Math.random() * size;
        ctx.moveTo(px, py);
        for (let j = 0; j < 4; j += 1) {
            px += (Math.random() - 0.5) * 60;
            py += (Math.random() - 0.5) * 22;
            ctx.lineTo(px, py);
        }
        ctx.stroke();
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(16, 5);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;

    /* alpha: v=0 is the near edge (fades in), v=1 the far end (fades into the haze).
       The solid band has to run well past the car's own z, otherwise the road
       stops at the car and it reads as driving off the edge of the world. */
    const rows = 128;
    const alphaData = new Uint8Array(rows * 4);
    for (let y = 0; y < rows; y += 1) {
        const v = y / (rows - 1);
        const near = THREE.MathUtils.smoothstep(v, 0.0, 0.10);
        const far = 1 - THREE.MathUtils.smoothstep(v, 0.78, 1.0);
        const byte = Math.round(Math.min(near, far) * 255);
        alphaData[y * 4] = byte;
        alphaData[y * 4 + 1] = byte;
        alphaData[y * 4 + 2] = byte;
        alphaData[y * 4 + 3] = 255;
    }
    const alphaMap = new THREE.DataTexture(alphaData, 1, rows, THREE.RGBAFormat);
    alphaMap.magFilter = THREE.LinearFilter;
    alphaMap.minFilter = THREE.LinearFilter;
    alphaMap.wrapS = THREE.ClampToEdgeWrapping;
    alphaMap.wrapT = THREE.ClampToEdgeWrapping;
    alphaMap.needsUpdate = true;

    const material = new THREE.MeshPhysicalMaterial({
        map,
        color: 0xffffff,
        metalness: 0.0,
        roughness: 0.72,
        clearcoat: 0.04,
        clearcoatRoughness: 0.6,
        envMapIntensity: 0.14,
        transparent: true,
        alphaMap,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 22), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0, 4.0);
    mesh.receiveShadow = true;
    /* The paint sits four millimetres above this plane, but three.js sorts
       transparent objects by centre distance and this slab's centre is nearer
       the camera than any strip's, so it would paint over them. Render it
       first and let the markings blend on top. */
    mesh.renderOrder = 0;
    return mesh;
}

/* Painted strips on the asphalt. The camera is static and the car travels
   along x, so the markings stay fixed — but they have to run under and past
   the car or the road looks like it ends at its wheels. */
function buildMarkings() {
    /* The bottom edge of the frame meets the asphalt around z = 1.4, so the
       near strip has to sit inside that or it scrolls off the stage. The far
       ones are mostly hidden behind the body, which is what makes the car look
       like it is driving in a lane rather than standing in front of a wall. */
    const strips = [
        [1.18, 0.13, 1, 0.55, 256],
        [-1.55, 0.15, 15, 0.34, 96],
        [-3.40, 0.18, 12, 0.2, 110],
    ];

    return strips.map(([z, wide, tiles, opacity, dash]) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(228, 218, 198, 0.95)';
        ctx.shadowColor = 'rgba(228, 218, 198, 0.5)';
        ctx.shadowBlur = 2;
        ctx.fillRect(0, 5, dash, 6);

        const map = new THREE.CanvasTexture(canvas);
        map.wrapS = THREE.RepeatWrapping;
        map.wrapT = THREE.ClampToEdgeWrapping;
        map.repeat.set(tiles, 1);
        map.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(90, wide),
            new THREE.MeshBasicMaterial({
                map,
                transparent: true,
                opacity,
                depthWrite: false,
                toneMapped: false,
            })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, 0.004, z);
        mesh.renderOrder = 1;
        return mesh;
    });
}

function contactTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    const grad = ctx.createRadialGradient(c, c, c * 0.06, c, c, c * 0.96);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.66)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.36)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function beamTexture() {
    const w = 512;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255, 236, 204, 0.9)');
    grad.addColorStop(0.18, 'rgba(255, 226, 186, 0.55)');
    grad.addColorStop(0.55, 'rgba(255, 208, 158, 0.18)');
    grad.addColorStop(1, 'rgba(255, 190, 130, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-in';
    const feather = ctx.createLinearGradient(0, 0, 0, h);
    feather.addColorStop(0, 'rgba(0,0,0,0)');
    feather.addColorStop(0.22, 'rgba(0,0,0,1)');
    feather.addColorStop(0.78, 'rgba(0,0,0,1)');
    feather.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = feather;
    ctx.fillRect(0, 0, w, h);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function poolTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.3)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function glowTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255, 250, 238, 1)');
    grad.addColorStop(0.35, 'rgba(255, 240, 210, 0.5)');
    grad.addColorStop(1, 'rgba(255, 230, 190, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

})();
