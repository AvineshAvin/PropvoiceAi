import React, { useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AudioWaveform } from 'lucide-react';
import { MOTION_CONFIG, isMobileViewport, prefersReducedMotion } from './motion.config';
import { useLenisScroll } from './LenisContext';

function getRouteLabel(pathname) {
  if (pathname.startsWith('/properties/')) return 'Property Details';
  return MOTION_CONFIG.routeTitles[pathname] || 'PropVoice AI';
}

/**
 * Wraps route views with AnimatePresence mode="wait", full-screen black wipe
 * (0.6s expo.inOut), click-blocking during transition, instant Lenis scrollToTop,
 * ScrollTrigger cleanup/refresh, and LayoutGroup for shared-element transitions.
 */
export function RouteTransition({ children }) {
  const location = useLocation();
  const { scrollToTopImmediate, resizeLenis } = useLenisScroll();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const reduced = prefersReducedMotion();
  const isSharedPropertyRoute =
    !reduced &&
    !isMobileViewport() &&
    Boolean(location.state?.sharedPropertyTransition);

  useEffect(() => {
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
      resizeLenis();
    }, 120);
    return () => clearTimeout(timer);
  }, [location.pathname, resizeLenis]);

  const handleExitComplete = () => {
    scrollToTopImmediate();
    ScrollTrigger.getAll().forEach((t) => t.kill());
    setTimeout(() => {
      ScrollTrigger.refresh();
      resizeLenis();
    }, 80);
  };

  return (
    <LayoutGroup>
      {/* Click blocker during route transition */}
      {isTransitioning && (
        <div
          className="fixed inset-0 z-[90] cursor-wait pointer-events-auto"
          aria-hidden="true"
        />
      )}

      <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
        <motion.div
          key={location.pathname}
          onAnimationStart={() => setIsTransitioning(true)}
          onAnimationComplete={() => setIsTransitioning(false)}
          initial={reduced ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 1 }}
          transition={{ duration: reduced ? 0.25 : MOTION_CONFIG.wipeDuration }}
          className="relative"
        >
          {/* Full-screen black wipe panel (skipped on reduced-motion or shared-element transition) */}
          {!reduced && !isSharedPropertyRoute && (
            <>
              {/* Enter reveal: panel starts covering screen (y: 0%) and wipes up to -100% */}
              <motion.div
                aria-hidden="true"
                initial={{ y: '0%' }}
                animate={{ y: '-100%' }}
                transition={{
                  duration: MOTION_CONFIG.wipeDuration,
                  ease: MOTION_CONFIG.wipeEase,
                }}
                className="pointer-events-none fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#0A0A0A] text-white will-change-transform"
              >
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: 0.15 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0A0A0A]">
                    <AudioWaveform className="h-5 w-5" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">
                    {getRouteLabel(location.pathname)}
                  </span>
                </motion.div>
              </motion.div>

              {/* Exit cover: panel wipes up from bottom (y: 100%) to cover screen (y: 0%) */}
              <motion.div
                aria-hidden="true"
                initial={{ y: '100%' }}
                animate={{ y: '100%' }}
                exit={{ y: '0%' }}
                transition={{
                  duration: MOTION_CONFIG.wipeDuration,
                  ease: MOTION_CONFIG.wipeEase,
                }}
                className="pointer-events-none fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#0A0A0A] text-white will-change-transform"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  exit={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: 0.25 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0A0A0A]">
                    <AudioWaveform className="h-5 w-5" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight">PropVoice AI</span>
                </motion.div>
              </motion.div>
            </>
          )}

          {children}
        </motion.div>
      </AnimatePresence>
    </LayoutGroup>
  );
}
