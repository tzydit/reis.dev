import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ── Constantes ────────────────────────────────────────────
const BASE = new URL('../../3d/', import.meta.url);
export const MODEL_URL = new URL('phone.glb', BASE).href;
export const BACK_URL = new URL('back.webp', BASE).href;

// Telas que aparecem na frente, uma por volta completa. A troca acontece
// quando a tela está virada para trás, então o visitante nunca vê o corte.
export const SCREENS = [
  { url: new URL('screen-financasiq.webp', BASE).href, name: 'FinançasIQ', note: 'Produto próprio · no ar', href: 'https://www.financasiq.com' },
  { url: new URL('screen-drandre.webp', BASE).href, name: 'Dr. André Reis', note: 'Site de cliente · no ar', href: 'https://drandrereis.vercel.app' },
];

export const MESH_FRONT = 'Front';
export const MESH_BACK = 'Back';
export const BASE_FRONT = '#0b0c0f';   // moldura da tela (aparece onde a arte é transparente)
export const BASE_BACK = '#1d3f9e';    // céu escuro da marca, nas margens do verso
export const MODEL_SIZE = 2.6;

export const ENTRANCE_HALF_TURNS = 1;
export const SPIN_HALF_TURNS = 3;

export const PEEK_Y = -2.5;
export const CENTER_Y = -0.1;
export const EXIT_Y = 2.4;
export const SCALE_PEEK = 0.6;
export const SCALE_CENTER = 1;
export const EXIT_PUNCH = 1.12;
export const EXIT_PUNCH_AT = 0.3;
export const HIDE_AT_EXIT = 0.985;

export const TILT_MAX = 0.16;
export const DAMPING = 10;
export const SETTLE_EPSILON = 1e-4;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Arte no map; o alpha mistura com a cor base do produto, sem furar o mesh
function makeArtMaterial(texture, baseColor) {
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(baseColor), map: texture, roughness: 0.32, metalness: 0.0, transparent: false });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec4 art = texture2D( map, vMapUv );
        diffuseColor.rgb = mix( diffuseColor.rgb, art.rgb, art.a );
      #endif`
    );
  };
  mat.customProgramCacheKey = () => 'art-mix-v1';
  return mat;
}

export function createScene(container, { onScreen } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 7.5);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 4, 5);
  scene.add(key);

  const group = new THREE.Group();
  const tiltGroup = new THREE.Group();
  group.add(tiltGroup);
  scene.add(group);

  const target = { entrance: 0, spin: 0, exit: 0, tiltX: 0, tiltY: 0 };
  const current = { ...target };
  let visible = true;
  let frontMat = null, screenTex = [], screenIdx = -1;
  const disposables = [envTex, pmrem];

  const prep = (t) => { t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };

  async function load() {
    const tl = new THREE.TextureLoader();
    const [gltf, back, ...screens] = await Promise.all([
      new GLTFLoader().loadAsync(MODEL_URL),
      tl.loadAsync(BACK_URL).then(prep),
      ...SCREENS.map((s) => tl.loadAsync(s.url).then(prep)),
    ]);
    screenTex = screens;
    const model = gltf.scene;

    const front = model.getObjectByName(MESH_FRONT);
    const backMesh = model.getObjectByName(MESH_BACK);
    frontMat = makeArtMaterial(screens[0], BASE_FRONT);
    front.material = frontMat;
    backMesh.material = makeArtMaterial(back, BASE_BACK);
    disposables.push(frontMat, backMesh.material, back, ...screens);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));
    const holder = new THREE.Group();
    holder.scale.setScalar(MODEL_SIZE / Math.max(size.x, size.y, size.z));
    holder.add(model);
    tiltGroup.add(holder);
    model.traverse((o) => { if (o.isMesh) disposables.push(o.geometry); });
    apply();
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // em telas estreitas afasta a câmera para o aparelho caber na largura
    camera.position.z = w / h < 0.7 ? 9.5 : 7.5;
    camera.updateProjectionMatrix();
  }

  function apply() {
    const e = easeOut(clamp01(current.entrance));
    const x = clamp01(current.exit);
    const halfTurns = current.entrance * ENTRANCE_HALF_TURNS + clamp01(current.spin) * SPIN_HALF_TURNS;
    group.rotation.y = halfTurns * Math.PI;

    // troca a tela enquanto ela está de costas (meia-volta ímpar)
    if (frontMat && screenTex.length) {
      const idx = Math.floor((halfTurns + 1) / 2) % screenTex.length;
      if (idx !== screenIdx) {
        screenIdx = idx;
        frontMat.map = screenTex[idx];
        frontMat.needsUpdate = true;
        onScreen && onScreen(SCREENS[idx], idx);
      }
    }

    const exitScale = x <= EXIT_PUNCH_AT
      ? lerp(1, EXIT_PUNCH, easeOut(x / EXIT_PUNCH_AT))
      : lerp(EXIT_PUNCH, 0, (x - EXIT_PUNCH_AT) / (1 - EXIT_PUNCH_AT));
    group.scale.setScalar(lerp(SCALE_PEEK, SCALE_CENTER, e) * exitScale);
    group.position.y = lerp(PEEK_Y, CENTER_Y, e) + lerp(0, EXIT_Y, x * x);
    group.visible = visible && x < HIDE_AT_EXIT;
    tiltGroup.rotation.x = current.tiltX;
    tiltGroup.rotation.z = current.tiltY * 0.4;
  }

  function step(dt) {
    const k = 1 - Math.exp(-DAMPING * dt);
    let moving = false;
    for (const key of Object.keys(target)) {
      const d = target[key] - current[key];
      if (Math.abs(d) > SETTLE_EPSILON) { current[key] += d * k; moving = true; } else current[key] = target[key];
    }
    apply();
    return moving;
  }

  const render = () => renderer.render(scene, camera);
  const snap = () => { Object.assign(current, target); apply(); render(); };
  function dispose() { disposables.forEach((d) => d && d.dispose && d.dispose()); renderer.dispose(); renderer.domElement.remove(); }

  return {
    load, resize, step, render, snap, dispose,
    setEntrance: (v) => { target.entrance = v; },
    setSpin: (v) => { target.spin = v; },
    setExit: (v) => { target.exit = v; },
    setVisible: (v) => { visible = v; },
    setTilt: (x, y) => { target.tiltX = x * TILT_MAX; target.tiltY = y * TILT_MAX; },
  };
}
