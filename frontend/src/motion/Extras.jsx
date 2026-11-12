import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import { AudioWaveform } from 'lucide-react';
import { MOTION_CONFIG, isMobileViewport, prefersReducedMotion } from './motion.config';

/**
 * First-visit session loader (logo + progress count, <= 1.4s), shown once per session.
 */
export function FirstVisitLoader() {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (prefersReducedMotion()) return false;
    return !sessionStorage.getItem('propvoice_intro_seen');
  });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!show) return undefined;
    sessionStorage.setItem('propvoice_intro_seen', '1');

    const start = performance.now();
    const duration = MOTION_CONFIG.loaderMaxDurationMs - 250;
    let rafId;

    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setProgress(Math.round(p * 100));
      if (p < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setTimeout(() => setShow(false), 180);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: '0%' }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.6, ease: MOTION_CONFIG.wipeEase }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0A0A0A] text-white will-change-transform"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#0A0A0A]">
              <AudioWaveform className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">PropVoice AI</span>
          </div>
          <p className="mt-6 font-mono text-sm font-semibold tracking-widest text-neutral-400">
            {progress}%
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Thin GPU-accelerated scroll progress bar at the very top of the viewport.
 */
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 30,
    restDelta: 0.001,
  });

  if (prefersReducedMotion()) return null;

  return (
    <motion.div
      style={{ scaleX }}
      className="pointer-events-none fixed left-0 right-0 top-0 z-[70] h-[2px] origin-left bg-[#111111] will-change-transform"
    />
  );
}

/**
 * Desktop-only (>= 768px) custom cursor that scales up smoothly over links, buttons, and images.
 */
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || isMobileViewport()) return undefined;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (!finePointer) return undefined;

    setEnabled(true);

    const onMove = (e) => {
      setPos({ x: e.clientX, y: e.clientY });
      setVisible(true);
      const target = e.target?.closest?.('a, button, [role="button"], img');
      setHovered(Boolean(target));
    };
    const onLeave = () => setVisible(false);

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  if (!enabled || !visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${
          hovered ? 2.1 : 1
        })`,
      }}
      className={`pointer-events-none fixed left-0 top-0 z-[95] h-4 w-4 rounded-full border transition-transform duration-200 ease-out will-change-transform ${
        hovered
          ? 'border-[#111111]/60 bg-[#111111]/10'
          : 'border-[#111111]/40 bg-[#111111]/80'
      }`}
    />
  );
}
