import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ── Constantes ────────────────────────────────────────────
export const SCRUB = 0.35;
export const SPIN_PORTION = 0.72;

gsap.registerPlugin(ScrollTrigger);

// O scroll só manda progresso; a cena faz o lerp.
export function bindScroll(section, scene, { onPlay, onPause }) {
  const entrance = ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'top top', scrub: SCRUB,
    onUpdate: (self) => scene.setEntrance(self.progress),
  });

  const main = ScrollTrigger.create({
    trigger: section, start: 'top top', end: 'bottom top', scrub: SCRUB,
    onUpdate: (self) => {
      const p = self.progress;
      if (p <= SPIN_PORTION) { scene.setSpin(p / SPIN_PORTION); scene.setExit(0); }
      else { scene.setSpin(1); scene.setExit((p - SPIN_PORTION) / (1 - SPIN_PORTION)); }
    },
  });

  const play = ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'bottom top',
    onToggle: (self) => { scene.setVisible(self.isActive); self.isActive ? onPlay() : onPause(); },
  });

  // o site rola com Lenis; mantém o ScrollTrigger em dia a cada quadro dele
  const lenis = window.__lenis;
  const sync = () => ScrollTrigger.update();
  if (lenis) lenis.on('scroll', sync);

  return () => { entrance.kill(); main.kill(); play.kill(); if (lenis) lenis.off('scroll', sync); };
}

export const refreshScroll = () => ScrollTrigger.refresh();
