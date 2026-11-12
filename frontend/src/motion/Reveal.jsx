import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { MOTION_CONFIG, prefersReducedMotion } from './motion.config';

/**
 * Fade-up entrance on enter (y: 60 -> 0, opacity: 0 -> 1).
 */
export function Reveal({ children, delay = 0, y = 60, className = '' }) {
  const reduced = prefersReducedMotion();
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: MOTION_CONFIG.revealDuration,
        delay,
        ease: MOTION_CONFIG.revealEase,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggers its direct children (default 0.1s).
 */
export function StaggerGroup({ children, stagger = MOTION_CONFIG.staggerChildren, className = '' }) {
  const reduced = prefersReducedMotion();

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduced ? 0 : stagger,
      },
    },
  };

  const itemVariants = {
    hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 36 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: MOTION_CONFIG.revealDuration,
        ease: MOTION_CONFIG.revealEase,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.08 }}
      className={className}
    >
      {React.Children.map(children, (child) =>
        child ? <motion.div variants={itemVariants}>{child}</motion.div> : null
      )}
    </motion.div>
  );
}

/**
 * Reveals headlines line by line using transform + opacity only.
 */
export function SplitHeading({ children, as = 'h2', className = '' }) {
  const Tag = motion[as] || motion.h2;
  const reduced = prefersReducedMotion();

  if (typeof children !== 'string') {
    return (
      <Tag
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 32 }}
        whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: MOTION_CONFIG.splitLineDuration, ease: MOTION_CONFIG.revealEase }}
        className={className}
      >
        {children}
      </Tag>
    );
  }

  const lines = children.split('\n');
  return (
    <Tag className={className}>
      {lines.map((line, idx) => (
        <span key={idx} className="block overflow-hidden">
          <motion.span
            className="block"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: '100%' }}
            whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: '0%' }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: MOTION_CONFIG.splitLineDuration,
              delay: idx * MOTION_CONFIG.splitLineStagger,
              ease: MOTION_CONFIG.revealEase,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/**
 * Animates numbers from 0 to target when visible in viewport.
 */
export function CountUp({ value = 0, prefix = '', suffix = '', duration = MOTION_CONFIG.countUpDuration }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    if (!inView) return undefined;
    if (prefersReducedMotion()) {
      setDisplay(target);
      return undefined;
    }

    let start = null;
    let rafId;
    const durMs = duration * 1000;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / durMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [inView, value, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {display.toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}
