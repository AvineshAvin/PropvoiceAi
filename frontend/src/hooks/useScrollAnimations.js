import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// TWEAKABLE ANIMATION CONSTANTS
// ============================================================================
export const ANIMATION_CONFIG = {
  // Global Lenis smooth scroll
  lenisDuration: 1.15,
  scrubSmooth: 1,
  mobileBreakpoint: 768,

  // Durations (seconds)
  headlineDuration: 1.0,
  subcopyDuration: 0.85,
  subcopyDelay: 0.15,
  cardDuration: 0.8,
  searchCardDuration: 0.75,
  countUpDuration: 1.2,
  barGrowDuration: 0.6,

  // Easings
  defaultEase: 'power3.out',
  headlineEase: 'expo.out',
  scrubEase: 'none',

  // Staggers (seconds)
  cardStagger: 0.12,
  propertyStagger: 0.1,
  barStagger: 0.05,
  collageStagger: 0.15,
};

/**
 * Centralized GSAP + ScrollTrigger + Lenis scroll animation hook.
 * Keeps all scroll choreography in one removable module.
 */
export function useScrollAnimations(containerRef, deps = []) {
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return undefined;

    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return undefined;

    // GSAP Context + MatchMedia for clean desktop/mobile behavior & unmount cleanup
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // ----------------------------------------------------------------------
      // DESKTOP (>= 768px): Full shared-image transition, pinning, & morphing
      // ----------------------------------------------------------------------
      mm.add(`(min-width: ${ANIMATION_CONFIG.mobileBreakpoint}px)`, () => {
        const heroImg = container.querySelector('[data-anim="hero-image"]');
        const heroSection = container.querySelector('[data-anim="hero-section"]');
        const morphSection = container.querySelector('[data-anim="morph-section"]');
        const morphSlot = container.querySelector('[data-anim="morph-slot"]');
        const morphImg2 = container.querySelector('[data-anim="morph-img-2"]');
        const floorplanThumb = container.querySelector('[data-anim="floorplan-thumb"]');
        const agentsSection = container.querySelector('[data-anim="agents-section"]');

        // 1. HERO -> NEXT SECTION (shared image transition using transforms only)
        if (heroImg && heroSection && morphSlot) {
          gsap.to(heroImg, {
            x: () => {
              const from = heroImg.getBoundingClientRect();
              const to = morphSlot.getBoundingClientRect();
              return to.left + to.width / 2 - (from.left + from.width / 2);
            },
            y: () => {
              const from = heroImg.getBoundingClientRect();
              const to = morphSlot.getBoundingClientRect();
              return to.top + to.height / 2 - (from.top + from.height / 2);
            },
            scale: () => {
              const from = heroImg.getBoundingClientRect();
              const to = morphSlot.getBoundingClientRect();
              return Math.min(to.width / from.width, to.height / from.height);
            },
            borderRadius: '16px',
            ease: ANIMATION_CONFIG.scrubEase,
            scrollTrigger: {
              trigger: heroSection,
              start: 'top top',
              endTrigger: morphSection || heroSection,
              end: 'top 35%',
              scrub: ANIMATION_CONFIG.scrubSmooth,
              invalidateOnRefresh: true,
            },
          });
        }

        // 2. PINNED IMAGE MORPH (Property Selection -> Expert Agents)
        if (morphSection && morphSlot) {
          const morphTl = gsap.timeline({
            scrollTrigger: {
              trigger: morphSection,
              start: 'top 20%',
              end: '+=90%',
              pin: morphSlot,
              pinSpacing: false,
              scrub: ANIMATION_CONFIG.scrubSmooth,
              invalidateOnRefresh: true,
            },
          });

          if (morphImg2) {
            morphTl.to(
              morphImg2,
              {
                opacity: 1,
                scale: 1.06,
                objectPosition: '50% 35%',
                ease: ANIMATION_CONFIG.scrubEase,
              },
              0.2
            );
          }

          if (floorplanThumb) {
            morphTl.fromTo(
              floorplanThumb,
              { opacity: 0, scale: 0.8 },
              { opacity: 1, scale: 1, ease: ANIMATION_CONFIG.scrubEase },
              0.45
            );
          }

          // Slide image upward and out when Expert Agents section arrives
          if (agentsSection) {
            gsap.to(morphSlot, {
              y: -70,
              opacity: 0,
              ease: ANIMATION_CONFIG.scrubEase,
              scrollTrigger: {
                trigger: agentsSection,
                start: 'top 85%',
                end: 'top 45%',
                scrub: ANIMATION_CONFIG.scrubSmooth,
              },
            });
          }
        }
      });

      // ----------------------------------------------------------------------
      // ALL VIEWPORTS: Headlines, Staggered Cards, Counters, Bars, Collage, Grid
      // ----------------------------------------------------------------------

      // 3. HEADLINE REVEALS (slide from left -80 -> 0, expo.out, once)
      gsap.utils.toArray(container.querySelectorAll('[data-anim="headline"]')).forEach((el) => {
        gsap.fromTo(
          el,
          { x: -80, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: ANIMATION_CONFIG.headlineDuration,
            ease: ANIMATION_CONFIG.headlineEase,
            scrollTrigger: {
              trigger: el,
              start: 'top 80%',
              once: true,
            },
          }
        );
      });

      gsap.utils.toArray(container.querySelectorAll('[data-anim="subcopy"]')).forEach((el) => {
        gsap.fromTo(
          el,
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: ANIMATION_CONFIG.subcopyDuration,
            delay: ANIMATION_CONFIG.subcopyDelay,
            ease: ANIMATION_CONFIG.defaultEase,
            scrollTrigger: {
              trigger: el,
              start: 'top 82%',
              once: true,
            },
          }
        );
      });

      // 4. STAGGERED CARD REVEALS (Agent cards, Stat cards, Metric cards)
      const staggerGroups = [
        { parent: '[data-anim="agents-section"]', item: '[data-anim="agent-card"]' },
        { parent: '[data-anim="stats-section"]', item: '[data-anim="stat-card"]' },
        { parent: '[data-anim="stats-section"]', item: '[data-anim="metric-card"]' },
      ];

      staggerGroups.forEach(({ parent, item }) => {
        const parentEl = container.querySelector(parent);
        const items = container.querySelectorAll(item);
        if (parentEl && items.length) {
          gsap.fromTo(
            items,
            { y: 60, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: ANIMATION_CONFIG.cardDuration,
              stagger: ANIMATION_CONFIG.cardStagger,
              ease: ANIMATION_CONFIG.defaultEase,
              scrollTrigger: {
                trigger: parentEl,
                start: 'top 85%',
                once: true,
              },
            }
          );
        }
      });

      // Stat numbers count up from 0 when entering viewport
      gsap.utils.toArray(container.querySelectorAll('[data-anim="count-up"]')).forEach((el) => {
        const targetVal = Number(el.getAttribute('data-target') || 0);
        const prefix = el.getAttribute('data-prefix') || '';
        const suffix = el.getAttribute('data-suffix') || '';
        const counter = { val: 0 };

        gsap.to(counter, {
          val: targetVal,
          duration: ANIMATION_CONFIG.countUpDuration,
          ease: ANIMATION_CONFIG.defaultEase,
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true,
          },
          onUpdate: () => {
            el.textContent = `${prefix}${Math.round(counter.val).toLocaleString('en-IN')}${suffix}`;
          },
        });
      });

      // Small bar charts inside stat cards grow scaleY 0 -> 1 with 0.05s stagger
      gsap.utils.toArray(container.querySelectorAll('[data-anim="metric-card"]')).forEach((card) => {
        const bars = card.querySelectorAll('[data-anim="stat-bar"]');
        if (bars.length) {
          gsap.fromTo(
            bars,
            { scaleY: 0, transformOrigin: 'bottom' },
            {
              scaleY: 1,
              duration: ANIMATION_CONFIG.barGrowDuration,
              stagger: ANIMATION_CONFIG.barStagger,
              ease: ANIMATION_CONFIG.defaultEase,
              scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                once: true,
              },
            }
          );
        }
      });

      // 5. COLLAGE ASSEMBLY ("Smart selection of premium real estate")
      const collageSection = container.querySelector('[data-anim="collage-section"]');
      if (collageSection) {
        const collageLeft = collageSection.querySelector('[data-anim="collage-left"]');
        const collagePhotos = collageSection.querySelectorAll('[data-anim="collage-photo"]');

        if (collageLeft) {
          gsap.fromTo(
            collageLeft,
            { x: -60, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              ease: ANIMATION_CONFIG.scrubEase,
              scrollTrigger: {
                trigger: collageSection,
                start: 'top 85%',
                end: 'top 40%',
                scrub: ANIMATION_CONFIG.scrubSmooth,
              },
            }
          );
        }

        if (collagePhotos.length) {
          gsap.fromTo(
            collagePhotos,
            { x: 200, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              stagger: ANIMATION_CONFIG.collageStagger,
              ease: ANIMATION_CONFIG.scrubEase,
              scrollTrigger: {
                trigger: collageSection,
                start: 'top 85%',
                end: 'top 35%',
                scrub: ANIMATION_CONFIG.scrubSmooth,
              },
            }
          );
        }
      }

      // 6. SEARCH + NEW PROPERTIES GRID
      const searchCard = container.querySelector('[data-anim="search-card"]');
      const propGrid = container.querySelector('[data-anim="property-grid"]');
      const propCards = container.querySelectorAll('[data-anim="property-card"]');

      if (searchCard) {
        gsap.fromTo(
          searchCard,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: ANIMATION_CONFIG.searchCardDuration,
            ease: ANIMATION_CONFIG.defaultEase,
            scrollTrigger: {
              trigger: searchCard,
              start: 'top 85%',
              once: true,
            },
          }
        );
      }

      if (propGrid && propCards.length) {
        gsap.fromTo(
          propCards,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: ANIMATION_CONFIG.cardDuration,
            stagger: ANIMATION_CONFIG.propertyStagger,
            ease: ANIMATION_CONFIG.defaultEase,
            scrollTrigger: {
              trigger: propGrid,
              start: 'top 85%',
              once: true,
            },
          }
        );

        const cardImgs = propGrid.querySelectorAll('[data-anim="property-card"] img');
        if (cardImgs.length) {
          gsap.fromTo(
            cardImgs,
            { scale: 1.1 },
            {
              scale: 1,
              duration: 1.0,
              stagger: ANIMATION_CONFIG.propertyStagger,
              ease: ANIMATION_CONFIG.defaultEase,
              scrollTrigger: {
                trigger: propGrid,
                start: 'top 85%',
                once: true,
              },
            }
          );
        }
      }
    }, container);

    // Clean up all ScrollTrigger instances & GSAP context on unmount
    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
