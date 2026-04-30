import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';

/**
 * FloatingActionBar — minimal pill: Edit + Delete.
 * Connections are made by dragging handles directly.
 */

interface FloatingActionBarProps {
  cardRect: { x: number; y: number; width: number; height: number } | null;
  onEdit: () => void;
  onDelete: () => void;
}

const ACTIONS = [
  { key: 'edit', icon: Pencil, label: 'Редактировать', color: 'var(--color-primary)' },
  { key: 'delete', icon: Trash2, label: 'Удалить', color: 'var(--color-error)' },
] as const;

export const FloatingActionBar = ({ cardRect, onEdit, onDelete }: FloatingActionBarProps) => {
  if (!cardRect) return null;

  const barWidth = ACTIONS.length * 40 + 16;
  const left = Math.max(8, Math.min(
    cardRect.x + cardRect.width / 2 - barWidth / 2,
    window.innerWidth - barWidth - 8,
  ));
  const spaceAbove = cardRect.y;
  const top = spaceAbove > 56
    ? cardRect.y - 48
    : cardRect.y + cardRect.height + 8;

  const handleAction = (key: string) => {
    if (key === 'edit') onEdit();
    if (key === 'delete') onDelete();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.9 }}
        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        style={{
          position: 'fixed',
          left,
          top,
          zIndex: 35,
          display: 'flex',
          gap: 2,
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-full)',
          padding: '4px 6px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
        }}
      >
        {ACTIONS.map(({ key, icon: Icon, label, color }) => (
          <button
            key={key}
            onClick={(e) => { e.stopPropagation(); handleAction(key); }}
            onMouseDown={(e) => e.stopPropagation()}
            title={label}
            style={{
              width: 34, height: 34,
              borderRadius: '50%', border: 'none',
              background: 'transparent', color, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon size={16} />
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};
