import { motion, useReducedMotion } from 'framer-motion';
import './AnimatedBackground.css';

const BLOBS = [
  { id: 'accent', color: 'var(--accent-primary)', x: '12%', y: '14%', size: 'min(54vw, 720px)', opacity: 12, driftX: [0, 34, -22, 0], driftY: [0, -24, 28, 0], duration: 22 },
  { id: 'food', color: 'var(--cat-food)', x: '68%', y: '10%', size: 'min(48vw, 620px)', opacity: 10, driftX: [0, -30, 24, 0], driftY: [0, 26, -20, 0], duration: 19 },
  { id: 'education', color: 'var(--cat-education)', x: '52%', y: '62%', size: 'min(50vw, 650px)', opacity: 9, driftX: [0, 22, -32, 0], driftY: [0, -28, 18, 0], duration: 24 },
  { id: 'travel', color: 'var(--cat-travel)', x: '4%', y: '70%', size: 'min(42vw, 560px)', opacity: 8, driftX: [0, -18, 27, 0], driftY: [0, 20, -25, 0], duration: 21 },
];

/** Fixed-size, purely decorative color drift. `band` confines it to a short header region. */
export default function AnimatedBackground({ mode = 'full', className = '' }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`animated-background animated-background-${mode} ${className}`} aria-hidden="true">
      {BLOBS.map(blob => (
        <motion.span
          key={blob.id}
          className="animated-background-blob"
          style={{ '--blob-color': blob.color, '--blob-opacity': `${blob.opacity}%`, '--blob-mid-opacity': `${blob.opacity * 0.45}%`, '--blob-size': blob.size, left: blob.x, top: blob.y }}
          animate={prefersReducedMotion ? undefined : { x: blob.driftX, y: blob.driftY }}
          transition={prefersReducedMotion ? undefined : { duration: blob.duration, ease: 'linear', repeat: Infinity, repeatType: 'mirror' }}
        />
      ))}
    </div>
  );
}
