import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { prefersReducedMotion } from './motion.config';

gsap.registerPlugin(ScrollTrigger);

const LenisContext = createContext({
  scrollToTopImmediate: () => window.scrollTo(0, 0),
  resizeLenis: () => {},
});

export function LenisProvider({ children }) {
  const lenisRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const tick = (time) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  const scrollToTopImmediate = useCallback(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  const resizeLenis = useCallback(() => {
    lenisRef.current?.resize();
  }, []);

  return (
    <LenisContext.Provider value={{ scrollToTopImmediate, resizeLenis }}>
      {children}
    </LenisContext.Provider>
  );
}

export function useLenisScroll() {
  return useContext(LenisContext);
}
