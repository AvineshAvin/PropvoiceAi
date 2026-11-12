import React, { useEffect, useRef, useState } from 'react';

/**
 * Viewport observer supporting smooth bi-directional (down & up) triggers without edge flicker.
 */
function useInView(threshold = 0.12, once = false) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: '-24px 0px -24px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  return { ref, visible };
}

/**
 * Smooth fade-in + upward slide for headings, descriptions, buttons, and sections.
 */
export default function Reveal({ children, delay = 0, y = 24, once = false, className = '' }) {
  const { ref, visible } = useInView(0.12, once);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${visible ? delay : 0}ms`,
        transform: visible ? 'translate3d(0, 0, 0)' : `translate3d(0, ${y}px, 0)`,
      }}
      className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Clip-path mask + subtle scale reveal for architectural images entering the viewport.
 */
export function ImageReveal({ children, delay = 100, once = false, className = '' }) {
  const { ref, visible } = useInView(0.1, once);

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <div
        style={{
          transitionDelay: `${visible ? delay : 0}ms`,
          clipPath: visible ? 'inset(0% 0% 0% 0%)' : 'inset(8% 0% 0% 0%)',
          transform: visible ? 'scale(1)' : 'scale(1.06)',
        }}
        className={`h-full w-full transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Sequential staggered entrance for cards & listing rows.
 */
export function StaggerItem({ children, index = 0, stepMs = 75, once = false, className = '' }) {
  const { ref, visible } = useInView(0.08, once);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${visible ? Math.min(index * stepMs, 450) : 0}ms`,
        transform: visible ? 'translate3d(0, 0, 0) scale(1)' : 'translate3d(0, 22px, 0) scale(0.985)',
      }}
      className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Smooth number count-up animation triggered when entering viewport.
 */
export function AnimatedCounter({ value = 0, suffix = '', prefix = '', duration = 900 }) {
  const { ref, visible } = useInView(0.2, false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    if (!visible) {
      setDisplay(0);
      return undefined;
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplay(target);
      return undefined;
    }

    let start = null;
    let rafId;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [visible, value, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
