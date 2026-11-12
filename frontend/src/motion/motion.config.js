/**
 * Centralized animation constants for PropVoice AI.
 * Tweak durations, easings, staggers, and breakpoints here.
 */
export const MOTION_CONFIG = {
  mobileBreakpoint: 768,

  // Durations (seconds)
  wipeDuration: 0.6,
  revealDuration: 0.75,
  splitLineDuration: 0.8,
  countUpDuration: 1.1,
  loaderMaxDurationMs: 1400,

  // Easings
  wipeEase: [0.87, 0, 0.13, 1], // expo.inOut
  revealEase: [0.22, 1, 0.36, 1], // power3.out / expo.out
  gsapRevealEase: 'power3.out',
  gsapHeadlineEase: 'expo.out',

  // Staggers (seconds)
  staggerChildren: 0.1,
  splitLineStagger: 0.08,

  // Route titles shown mid-transition on the black wipe panel
  routeTitles: {
    '/': 'Overview',
    '/voice-assistant': 'Voice AI Assistant',
    '/properties': 'Property Inventory',
    '/leads': 'Lead Qualification CRM',
    '/conversations': 'Conversation History',
    '/followups': 'Follow-ups & Site Visits',
    '/settings': 'Settings',
  },
};

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOTION_CONFIG.mobileBreakpoint;
}
