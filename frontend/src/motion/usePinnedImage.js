import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MOTION_CONFIG, prefersReducedMotion } from './motion.config';

gsap.registerPlugin(ScrollTrigger);

/**
 * Reusable hook for the pinned/scrubbed image morph behavior on desktop (>=768px).
 */
export function usePinnedImage({ sectionRef, slotRef, secondImgRef, thumbRef }) {
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const section = sectionRef?.current;
    const slot = slotRef?.current;
    if (!section || !slot) return undefined;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(`(min-width: ${MOTION_CONFIG.mobileBreakpoint}px)`, () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top 20%',
            end: '+=90%',
            pin: slot,
            pinSpacing: false,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });

        if (secondImgRef?.current) {
          tl.to(
            secondImgRef.current,
            { opacity: 1, scale: 1.06, ease: 'none' },
            0.2
          );
        }
        if (thumbRef?.current) {
          tl.fromTo(
            thumbRef.current,
            { opacity: 0, scale: 0.8 },
            { opacity: 1, scale: 1, ease: 'none' },
            0.45
          );
        }
      });
    }, section);

    return () => ctx.revert();
  }, [sectionRef, slotRef, secondImgRef, thumbRef]);
}
