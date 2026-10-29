(function () {
'use strict';

const THREE_URL = 'https://unpkg.com/three@0.169.0/build/three.module.js';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const container = document.querySelector('.coffee-cup');
let THREE = null;

if (container) {
    import(THREE_URL).then((module) => {
        THREE = module;
        init(container);
    }).catch(() => {});
}

function init(root) {
    const canvas = root.querySelector('.mug-canvas');
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) {
        return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
    camera.position.set(0.18, 1.92, 3.18);
    camera.lookAt(0, 0.46, 0);

    scene.environment = buildEnvironment(renderer);
    scene.environmentIntensity = 0.65;

    const grain = grainTexture();
    const glaze = glazeTexture();

    const ceramic = new THREE.MeshPhysicalMaterial({
        color: 0xf7f1e7,
        map: ceramicColorTexture(),
        roughness: 0.33,
        metalness: 0,
        clearcoat: 0.75,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.0,
        bumpMap: grain,
        bumpScale: 0.0022,
        roughnessMap: glaze,
        side: THREE.DoubleSide,
    });

    const ceramicBody = ceramic.clone();
    ceramicBody.vertexColors = true;

    const saucerMaterial = ceramic.clone();
    saucerMaterial.color.setHex(0xcdb695);
    saucerMaterial.roughness = 0.58;
    saucerMaterial.clearcoat = 0.12;
    saucerMaterial.clearcoatRoughness = 0.34;
    saucerMaterial.envMapIntensity = 0.6;

    const handleMaterial = ceramic.clone();
    handleMaterial.vertexColors = true;
    handleMaterial.color.setHex(0xf6ede0);
    handleMaterial.roughness = 0.33;
    handleMaterial.envMapIntensity = 1.05;

    const mug = new THREE.Group();
    mug.position.y = -0.006;
    scene.add(mug);
    mug.add(buildBody(ceramicBody));
    mug.add(buildHandle(handleMaterial));

    scene.add(buildCoffee());

    const steam = buildSteam();
    steam.group.position.y = 0.894;
    scene.add(steam.group);

    scene.add(buildSaucer(saucerMaterial));
    scene.add(buildGroundShadow());
    scene.add(buildContact());

    const key = new THREE.DirectionalLight(0xfff8ee, 2.5);
    key.position.set(4.2, 2.83, 1.13);
    key.target.position.set(0, 0.42, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1.2;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -1.7;
    key.shadow.camera.right = 1.7;
    key.shadow.camera.top = 1.7;
    key.shadow.camera.bottom = -1.7;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.006;
    scene.add(key);
    scene.add(key.target);

    const top = new THREE.DirectionalLight(0xfff6e8, 0.35);
    top.position.set(0.7, 4.4, 1.3);
    top.target.position.set(0, 0.4, 0);
    scene.add(top);
    scene.add(top.target);

    const fillLeft = new THREE.DirectionalLight(0xffe4c4, 0.18);
    fillLeft.position.set(-2.6, 1.2, 1.6);
    scene.add(fillLeft);

    const rim = new THREE.DirectionalLight(0xffd8ae, 0.55);
    rim.position.set(-2.2, 2.6, -3.2);
    scene.add(rim);

    const edge = new THREE.DirectionalLight(0xffe8ca, 0.22);
    edge.position.set(1.6, 2.4, -3.0);
    scene.add(edge);

    const fill = new THREE.HemisphereLight(0xfff4e6, 0x2a1a0e, 0.18);
    scene.add(fill);

    const bounce = new THREE.DirectionalLight(0xffc08a, 0.26);
    bounce.position.set(-0.5, -1.4, 1.2);
    scene.add(bounce);

    const resize = () => {
        const size = Math.max(root.clientWidth, 1);
        renderer.setSize(size, size, false);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
    };
    resize();
    new ResizeObserver(resize).observe(root);

    root.classList.add('is-3d');

    const clock = new THREE.Clock();
    let elapsed = 0;
    let visible = true;
    new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
    }).observe(root);

    renderer.compile(scene, camera);

    function frame() {
        requestAnimationFrame(frame);
        const delta = Math.min(clock.getDelta(), 0.05);
        if (!visible) return;
        elapsed += delta;
        if (!REDUCED) {
            mug.rotation.y += delta * 0.55;
            updateSteam(steam.puffs, elapsed, delta);
        }
        renderer.render(scene, camera);
    }
    frame();
}

function buildBody(material) {
    const rows = [
        [0.000, 0.030, 0.62], [0.315, 0.030, 0.52], [0.362, 0.022, 0.58],
        [0.388, 0.044, 0.7], [0.404, 0.080, 0.90], [0.418, 0.150, 0.97],
        [0.430, 0.240, 1.00], [0.444, 0.380, 1.00], [0.458, 0.520, 1.00],
        [0.470, 0.660, 1.00], [0.480, 0.790, 1.00], [0.488, 0.890, 1.00],
        [0.494, 0.938, 0.99], [0.498, 0.958, 0.95], [0.494, 0.968, 0.86],
        [0.488, 0.966, 0.74], [0.484, 0.952, 0.62], [0.478, 0.918, 0.56],
        [0.470, 0.860, 0.54], [0.460, 0.740, 0.52], [0.448, 0.600, 0.50],
        [0.436, 0.440, 0.48], [0.424, 0.300, 0.46], [0.412, 0.180, 0.44],
        [0.396, 0.100, 0.42], [0.300, 0.082, 0.40], [0.000, 0.076, 0.38],
    ];

    const profile = rows.map(([r, y]) => new THREE.Vector2(r, y));
    const geometry = new THREE.LatheGeometry(profile, 160);
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const joints = [
        new THREE.Vector3(0.478, 0.846, 0),
        new THREE.Vector3(0.438, 0.376, 0),
    ];
    const v = new THREE.Vector3();

    for (let i = 0; i < positions.count; i += 1) {
        v.fromBufferAttribute(positions, i);
        let shade = rows[i % rows.length][2];
        for (const joint of joints) {
            const d = v.distanceTo(joint);
            shade *= 0.68 + 0.32 * THREE.MathUtils.smoothstep(d, 0.03, 0.17);
        }
        colors[i * 3] = shade;
        colors[i * 3 + 1] = shade;
        colors[i * 3 + 2] = shade;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function buildHandle(material) {
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.478, 0.846, 0),
        new THREE.Vector3(0.660, 0.870, 0),
        new THREE.Vector3(0.790, 0.806, 0),
        new THREE.Vector3(0.838, 0.608, 0),
        new THREE.Vector3(0.790, 0.406, 0),
        new THREE.Vector3(0.660, 0.324, 0),
        new THREE.Vector3(0.438, 0.376, 0),
    ], true, 'catmullrom', 0.4);

    const geometry = new THREE.TubeGeometry(curve, 220, 0.064, 32, true);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const top = new THREE.Vector3(0.478, 0.846, 0);
    const bottom = new THREE.Vector3(0.438, 0.376, 0);
    const center = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const colors = new Float32Array(position.count * 3);

    for (let i = 0; i < position.count; i += 1) {
        curve.getPointAt(uv.getX(i), center);
        offset.set(position.getX(i), position.getY(i), position.getZ(i)).sub(center);
        const d = Math.min(center.distanceTo(top), center.distanceTo(bottom));
        offset.multiplyScalar(1 + 0.26 * Math.exp(-(d * d) / 0.006));
        position.setXYZ(i, center.x + offset.x, center.y + offset.y, center.z + offset.z);

        const shade = 0.72 + 0.28 * THREE.MathUtils.smoothstep(d, 0.02, 0.16);
        colors[i * 3] = shade;
        colors[i * 3 + 1] = shade;
        colors[i * 3 + 2] = shade;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.z = 0.8;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function buildSaucer(material) {
    const profile = [
        [0.000, -0.066], [0.560, -0.066], [0.620, -0.058], [0.672, -0.038],
        [0.706, -0.012], [0.714, 0.006], [0.702, 0.018], [0.676, 0.002],
        [0.650, -0.018], [0.614, -0.027], [0.606, -0.020], [0.590, -0.019],
        [0.580, -0.027], [0.430, -0.033], [0.000, -0.035],
    ].map(([r, y]) => new THREE.Vector2(r, y));

    const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 128), material);
    mesh.scale.set(0.95, 1, 0.95);
    mesh.position.y = 0.056;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function buildCoffee() {
    const radius = 0.474;
    const group = new THREE.Group();
    group.position.y = -0.006;
    const texture = cremaTexture();

    const material = new THREE.MeshPhysicalMaterial({
        map: texture,
        bumpMap: rippleTexture(),
        bumpScale: 0.0009,
        roughness: 0.08,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.5,
        ior: 1.34,
    });

    const surface = new THREE.Mesh(new THREE.CircleGeometry(radius, 160), material);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.938;
    surface.receiveShadow = true;
    group.add(surface);

    const meniscus = new THREE.Mesh(
        new THREE.TorusGeometry(radius - 0.006, 0.009, 12, 160),
        new THREE.MeshPhysicalMaterial({
            color: 0x3a1f0e,
            roughness: 0.16,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.06,
            envMapIntensity: 1.4,
        })
    );
    meniscus.rotation.x = -Math.PI / 2;
    meniscus.position.y = 0.940;
    group.add(meniscus);

    return group;
}

function cremaTexture() {
    const size = 512;
    const c = size / 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#241207';
    ctx.fillRect(0, 0, size, size);

    const pool = ctx.createRadialGradient(c, c, 0, c, c, c);
    pool.addColorStop(0, 'rgba(44, 23, 11, 0.95)');
    pool.addColorStop(0.5, 'rgba(72, 40, 20, 0.92)');
    pool.addColorStop(0.76, 'rgba(110, 68, 36, 0.92)');
    pool.addColorStop(0.9, 'rgba(146, 99, 57, 0.94)');
    pool.addColorStop(0.96, 'rgba(120, 76, 42, 0.96)');
    pool.addColorStop(1, 'rgba(52, 27, 13, 0.96)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.filter = 'blur(3px)';
    for (let i = 0; i < 120; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const dist = (0.08 + Math.random() * 0.84) * c;
        const r = 6 + Math.random() * 30;
        const alpha = 0.04 + Math.random() * 0.1;
        const blob = ctx.createRadialGradient(
            c + Math.cos(angle) * dist, c + Math.sin(angle) * dist, 0,
            c + Math.cos(angle) * dist, c + Math.sin(angle) * dist, r
        );
        blob.addColorStop(0, Math.random() > 0.4
            ? `rgba(206, 156, 102, ${alpha})`
            : `rgba(44, 22, 10, ${alpha * 1.3})`);
        blob.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = blob;
        ctx.fillRect(0, 0, size, size);
    }
    ctx.restore();

    for (let i = 0; i < 380; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * c * 0.98;
        ctx.fillStyle = Math.random() > 0.5
            ? `rgba(228, 180, 126, ${0.05 + Math.random() * 0.13})`
            : `rgba(28, 14, 6, ${0.05 + Math.random() * 0.12})`;
        ctx.beginPath();
        ctx.arc(c + Math.cos(angle) * dist, c + Math.sin(angle) * dist, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.save();
    ctx.filter = 'blur(9px)';
    ctx.strokeStyle = 'rgba(16, 7, 3, 0.5)';
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.95, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.filter = 'blur(6px)';
    ctx.strokeStyle = 'rgba(255, 236, 208, 0.18)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.975, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 240, 216, 0.16)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.965, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(c * 1.16, c * 0.66);
    ctx.rotate(-0.32);
    ctx.scale(1, 0.4);
    const glare = ctx.createRadialGradient(0, 0, 0, 0, 0, c * 0.78);
    glare.addColorStop(0, 'rgba(255, 245, 226, 0.22)');
    glare.addColorStop(0.4, 'rgba(255, 238, 212, 0.09)');
    glare.addColorStop(1, 'rgba(255, 234, 204, 0)');
    ctx.fillStyle = glare;
    ctx.fillRect(-c, -c, c * 2, c * 2);
    ctx.restore();

    const edge = ctx.createRadialGradient(c, c, c * 0.86, c, c, c);
    edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edge.addColorStop(1, 'rgba(8, 4, 2, 0.55)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

function buildEnvironment(renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const room = ctx.createLinearGradient(0, 0, 0, 512);
    room.addColorStop(0, '#0b0907');
    room.addColorStop(0.34, '#16110d');
    room.addColorStop(0.49, '#211a15');
    room.addColorStop(0.54, '#0b0806');
    room.addColorStop(0.8, '#050403');
    room.addColorStop(1, '#020202');
    ctx.fillStyle = room;
    ctx.fillRect(0, 0, 1024, 512);

    const softbox = (cx, cy, rx, alpha, sx, sy) => {
        const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, rx);
        glow.addColorStop(0, `rgba(255, 251, 243, ${alpha})`);
        glow.addColorStop(0.34, `rgba(255, 247, 234, ${alpha * 0.66})`);
        glow.addColorStop(0.66, `rgba(255, 242, 224, ${alpha * 0.2})`);
        glow.addColorStop(1, 'rgba(255, 242, 224, 0)');
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(sx, sy);
        ctx.translate(-cx, -cy);
        ctx.fillStyle = glow;
        ctx.fillRect(cx - rx * 1.4, cy - rx * 1.4, rx * 2.8, rx * 2.8);
        ctx.restore();
    };

    softbox(628, 150, 168, 1, 0.2, 3.1);
    softbox(505, 172, 190, 0.28, 0.36, 2.2);
    softbox(770, 188, 210, 0.22, 1.25, 0.55);
    softbox(545, 44, 300, 0.1, 1.8, 0.4);

    const floor = ctx.createLinearGradient(0, 268, 0, 512);
    floor.addColorStop(0, 'rgba(108, 76, 52, 0.6)');
    floor.addColorStop(0.3, 'rgba(74, 50, 33, 0.46)');
    floor.addColorStop(0.7, 'rgba(34, 22, 15, 0.22)');
    floor.addColorStop(1, 'rgba(8, 4, 2, 0)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 300, 1024, 212);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(texture).texture;
    pmrem.dispose();
    texture.dispose();
    return env;
}

function ceramicColorTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f2e9dc';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.filter = 'blur(7px)';
    for (let i = 0; i < 70; i += 1) {
        const x = Math.random() * size;
        const w = 3 + Math.random() * 26;
        const h = size * (0.2 + Math.random() * 0.8);
        ctx.fillStyle = Math.random() > 0.45
            ? `rgba(150, 110, 70, ${0.02 + Math.random() * 0.04})`
            : `rgba(255, 255, 255, ${0.02 + Math.random() * 0.04})`;
        ctx.fillRect(x, Math.random() * size - h / 2, w, h);
    }
    ctx.restore();

    for (let i = 0; i < 240; i += 1) {
        ctx.fillStyle = `rgba(88, 58, 32, ${Math.random() * 0.05})`;
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, 0.4 + Math.random() * 1.6, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    texture.anisotropy = 4;
    return texture;
}

function glazeTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 160; i += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 8 + Math.random() * 46;
        const light = Math.random() > 0.5;
        const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
        blob.addColorStop(0, light ? 'rgba(255,255,255,0.05)' : 'rgba(120,120,120,0.05)');
        blob.addColorStop(1, 'rgba(128,128,128,0)');
        ctx.fillStyle = blob;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
}

function rippleTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 54; i += 1) {
        const radius = 12 + Math.random() * (c - 16);
        const start = Math.random() * Math.PI * 2;
        const span = 0.25 + Math.random() * 1.1;
        ctx.strokeStyle = Math.random() > 0.5
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        ctx.arc(c, c, radius, start, start + span);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
}

function grainTexture() {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i += 1) {
        const v = 96 + Math.random() * 96;
        data[i * 4] = v;
        data[i * 4 + 1] = v;
        data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

function buildContact() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    const shade = ctx.createRadialGradient(c, c, c * 0.5, c, c, c * 0.95);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
    shade.addColorStop(0.55, 'rgba(0, 0, 0, 0.4)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.46, 96),
        new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            opacity: 0.9,
        })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.0262;
    return mesh;
}

function buildGroundShadow() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;

    ctx.save();
    ctx.translate(c, c);
    ctx.scale(1, 0.6);
    const shade = ctx.createRadialGradient(0, 0, c * 0.1, 0, 0, c);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
    shade.addColorStop(0.5, 'rgba(0, 0, 0, 0.32)');
    shade.addColorStop(0.8, 'rgba(0, 0, 0, 0.1)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(0, 0, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 1.9),
        new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            opacity: 0.7,
        })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(-0.1, -0.022, -0.04);
    return mesh;
}

function steamTexture() {
    const width = 128;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < 12; i += 1) {
        const t = i / 11;
        const cx = width * (0.5 + Math.sin(t * 4.6 + 0.7) * 0.08);
        const cy = height * (0.18 + t * 0.64);
        const r = width * (0.16 + Math.random() * 0.1);
        const alpha = 0.16 + 0.16 * Math.sin(t * Math.PI);
        const blob = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        blob.addColorStop(0, `rgba(255, 248, 238, ${alpha.toFixed(3)})`);
        blob.addColorStop(0.45, `rgba(255, 248, 238, ${(alpha * 0.6).toFixed(3)})`);
        blob.addColorStop(1, 'rgba(255, 248, 238, 0)');
        ctx.fillStyle = blob;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // feather every edge of the sprite to zero alpha so quads never show a seam
    ctx.globalCompositeOperation = 'destination-in';
    const vertical = ctx.createLinearGradient(0, 0, 0, height);
    vertical.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vertical.addColorStop(0.2, 'rgba(0, 0, 0, 0.9)');
    vertical.addColorStop(0.4, 'rgba(0, 0, 0, 1)');
    vertical.addColorStop(0.72, 'rgba(0, 0, 0, 0.75)');
    vertical.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, width, height);
    const horizontal = ctx.createLinearGradient(0, 0, width, 0);
    horizontal.addColorStop(0, 'rgba(0, 0, 0, 0)');
    horizontal.addColorStop(0.32, 'rgba(0, 0, 0, 1)');
    horizontal.addColorStop(0.68, 'rgba(0, 0, 0, 1)');
    horizontal.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = horizontal;
    ctx.fillRect(0, 0, width, height);

    const blurred = document.createElement('canvas');
    blurred.width = width;
    blurred.height = height;
    const bctx = blurred.getContext('2d');
    bctx.filter = 'blur(6px)';
    bctx.drawImage(canvas, 0, 0);

    const texture = new THREE.CanvasTexture(blurred);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function buildSteam() {
    const texture = steamTexture();
    const group = new THREE.Group();
    const puffs = [];

    for (let i = 0; i < 16; i += 1) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture,
            color: 0xfff4e4,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.NormalBlending,
        }));

        const puff = {
            sprite,
            t: Math.random(),
            angle: Math.random() * Math.PI * 2,
            radius: 0.04 + Math.random() * 0.26,
            speed: 0.16 + Math.random() * 0.13,
            phase: Math.random() * Math.PI * 2,
            sway: 0.5 + Math.random() * 0.7,
            size: 0.12 + Math.random() * 0.05,
            spin: (Math.random() - 0.5) * 0.4,
        };

        sprite.material.rotation = puff.spin;
        puffs.push(puff);
        group.add(sprite);
        placePuff(puff, 0);
    }

    return { group, puffs };
}

function placePuff(puff, elapsed) {
    const { sprite, t } = puff;
    const sway = Math.sin(elapsed * puff.sway + puff.phase) * 0.1 * t;
    sprite.position.set(
        Math.cos(puff.angle) * puff.radius + sway,
        0.05 + t * 0.28,
        Math.sin(puff.angle) * puff.radius + sway * 0.5
    );
    const fade = Math.min(t / 0.18, 1) * (1 - Math.max((t - 0.3) / 0.62, 0));
    sprite.material.opacity = 0.32 * fade;
    const s = puff.size * (0.8 + t * 0.5);
    sprite.scale.set(s, s * 1.35, 1);
}

function updateSteam(puffs, elapsed, delta) {
    for (const puff of puffs) {
        puff.t += delta * puff.speed;
        if (puff.t > 1) {
            puff.t -= 1;
            puff.angle = Math.random() * Math.PI * 2;
            puff.radius = 0.05 + Math.random() * 0.24;
        }
        placePuff(puff, elapsed);
    }
}

})();
