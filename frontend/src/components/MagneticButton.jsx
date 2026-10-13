import { useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

const springConfig = { stiffness: 300, damping: 20 };

/**
 * Magnetic button wrapper.
 * On hover, the button subtly translates toward the cursor (max 7px offset).
 * Uses a spring to revert on mouse leave.
 * No-ops on touch devices (no cursor) and when prefers-reduced-motion is set.
 */
export default function MagneticButton({
  children,
  className,
  style,
  onClick,
  disabled,
  type = 'button',
  maxOffset = 7,
  ...rest
}) {
  const ref = useRef(null);
  const prefersReduced = useReducedMotion();
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = useCallback((e) => {
    if (prefersReduced || isTouchDevice || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    // Normalize: proportion of half-width/height, clamped
    const nx = Math.max(-1, Math.min(1, dx / (rect.width / 2)));
    const ny = Math.max(-1, Math.min(1, dy / (rect.height / 2)));
    x.set(nx * maxOffset);
    y.set(ny * maxOffset);
  }, [prefersReduced, isTouchDevice, maxOffset, x, y]);

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.button
      ref={ref}
      type={type}
      className={className}
      style={{ ...style, x: springX, y: springY }}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={prefersReduced ? undefined : { scale: 1.02 }}
      whileTap={prefersReduced ? undefined : { scale: 0.98 }}
      transition={springConfig}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
