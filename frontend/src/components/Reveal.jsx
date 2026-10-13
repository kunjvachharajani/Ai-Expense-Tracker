import { motion, useReducedMotion } from 'framer-motion';

const revealEase = [0.22, 1, 0.36, 1];

/**
 * Scroll-triggered reveal wrapper.
 * Fades + rises 16px when the element enters the viewport.
 * Fires once (once: true) at 20% visibility.
 * Respects prefers-reduced-motion.
 */
export default function Reveal({
  children,
  className,
  style,
  delay = 0,
  as = 'div',
}) {
  const prefersReduced = useReducedMotion();
  const Component = motion[as] || motion.div;

  if (prefersReduced) {
    return <Component className={className} style={style}>{children}</Component>;
  }

  return (
    <Component
      className={className}
      style={style}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, ease: revealEase, delay }}
    >
      {children}
    </Component>
  );
}
