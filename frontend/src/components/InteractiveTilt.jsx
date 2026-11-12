import React, { useCallback, useRef, useState } from 'react';

/**
 * Smooth mouse-reactive 3D tilt & subtle spotlight sheen wrapper.
 */
export function InteractiveTilt({ children, className = '', maxTilt = 5, scale = 1.015 }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({
    transform: 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
  });
  const [glow, setGlow] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = useCallback(
    (e) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * (maxTilt * 2);
      const rotateX = (0.5 - py) * (maxTilt * 2);

      setStyle({
        transform: `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(
          2
        )}deg) scale3d(${scale}, ${scale}, 1)`,
      });
      setGlow({ x: px * 100, y: py * 100, opacity: 1 });
    },
    [maxTilt, scale]
  );

  const handleMouseLeave = useCallback(() => {
    setStyle({
      transform: 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    });
    setGlow((g) => ({ ...g, opacity: 0 }));
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={`relative transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${className}`}
    >
      {children}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: glow.opacity,
          background: `radial-gradient(360px circle at ${glow.x}% ${glow.y}%, rgba(255,255,255,0.22), transparent 60%)`,
        }}
      />
    </div>
  );
}

/**
 * Hook returning normalized (-1..1) mouse offset relative to a container ref.
 */
export function useMouseParallax(strength = 18) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMouseMove = useCallback(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      setOffset({ x: nx * strength, y: ny * strength });
    },
    [strength]
  );

  const onMouseLeave = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  return { offset, onMouseMove, onMouseLeave };
}
