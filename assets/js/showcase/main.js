import { createScene, ENTRANCE_HALF_TURNS, SPIN_HALF_TURNS } from './scene.js';
import { bindScroll, refreshScroll } from './scroll.js';

// ── Constantes ────────────────────────────────────────────
const SECTION_ID = 'celular';
const STAGE_ID = 'celStage';
const MAX_DT = 1 / 20;

export function mount() {
  const section = document.getElementById(SECTION_ID);
  const stage = document.getElementById(STAGE_ID);
  if (!section || !stage) return () => {};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const capName = document.getElementById('celName');
  const capNote = document.getElementById('celNote');
  const capLink = document.getElementById('celLink');

  let scene;
  try { scene = createScene(stage, {
    onScreen: (s) => {
      if (!capName) return;
      capName.textContent = s.name;
      capNote.textContent = s.note;
      capLink.href = s.href;
      capLink.setAttribute('aria-label', `Abrir ${s.name}`);
      if (!reduced) section.querySelector('.cel-cap')?.animate([{ opacity: .3, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' });
    },
  }); } catch (err) {
    // sem WebGL: a seção encolhe e o site segue normal
    console.warn('[celular 3D]', err);
    section.classList.add('off');
    stage.remove();
    return () => {};
  }

  let raf = 0, last = 0, inPlay = false;
  const cleanups = [];
  const loop = (now) => {
    const dt = Math.min(MAX_DT, (now - last) / 1000 || 0);
    last = now; scene.step(dt); scene.render();
    raf = requestAnimationFrame(loop);
  };
  const start = () => { if (raf || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  const onResize = () => { scene.resize(); reduced ? scene.snap() : scene.render(); };
  window.addEventListener('resize', onResize);
  cleanups.push(() => window.removeEventListener('resize', onResize));

  if (reduced) {
    // produto parado, de frente, dentro da própria seção; sem scroll nem loop
    section.classList.add('still');
    scene.resize();
  } else {
    scene.resize();
  }

  scene.load().then(() => {
    section.classList.add('ready');
    if (reduced) {
      scene.setEntrance(1); scene.setSpin((ENTRANCE_HALF_TURNS % 2) / SPIN_HALF_TURNS); scene.setExit(0);
      scene.snap();
      return;
    }
    cleanups.push(bindScroll(section, scene, {
      onPlay: () => { inPlay = true; stage.classList.add('on'); start(); },
      onPause: () => { inPlay = false; stage.classList.remove('on'); scene.step(1); scene.render(); stop(); },
    }));
    refreshScroll();

    if (window.matchMedia('(pointer: fine)').matches) {
      const onMove = (e) => { if (inPlay) scene.setTilt((e.clientY / innerHeight - .5) * 2, (e.clientX / innerWidth - .5) * 2); };
      window.addEventListener('pointermove', onMove, { passive: true });
      cleanups.push(() => window.removeEventListener('pointermove', onMove));
    }
    const onVis = () => { document.hidden ? stop() : inPlay && start(); };
    document.addEventListener('visibilitychange', onVis);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVis));
  }).catch((err) => {
    // sem WebGL ou sem os arquivos: a seção encolhe e o site segue normal
    console.warn('[celular 3D]', err);
    section.classList.add('off');
    stage.remove();
  });

  return function destroy() { stop(); cleanups.forEach((fn) => fn()); scene.dispose(); };
}

window.__celularDestroy = mount();
