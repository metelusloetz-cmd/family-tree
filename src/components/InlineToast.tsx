import { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

/* ═══════════════════════════════════════════
   InlineToast — thin, pill-shaped notifications.
   Replaces browser alert() with elegant toasts.
   ═══════════════════════════════════════════ */

type ToastType = 'info' | 'success' | 'error' | 'warning';

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

let toastId = 0;
let addToastFn: ((text: string, type?: ToastType) => void) | null = null;

/** Show a toast notification. Call anywhere in the app. */
export const showToast = (text: string, type: ToastType = 'info') => {
  addToastFn?.(text, type);
};

const ICONS: Record<ToastType, React.ReactNode> = {
  info: <Info size={14} />,
  success: <Check size={14} />,
  error: <X size={14} />,
  warning: <AlertTriangle size={14} />,
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  info: { bg: 'rgba(30, 41, 59, 0.88)', border: 'rgba(255,255,255,0.1)', icon: '#94a3b8' },
  success: { bg: 'rgba(16, 185, 129, 0.92)', border: 'rgba(255,255,255,0.15)', icon: '#fff' },
  error: { bg: 'rgba(239, 68, 68, 0.92)', border: 'rgba(255,255,255,0.15)', icon: '#fff' },
  warning: { bg: 'rgba(245, 158, 11, 0.92)', border: 'rgba(255,255,255,0.15)', icon: '#fff' },
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    addToastFn = (text, type = 'info') => {
      const id = ++toastId;
      setToasts(prev => [...prev, { id, text, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
    };
    return () => { addToastFn = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 60,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const c = COLORS[t.type];
        return (
          <div
            key={t.id}
            style={{
              background: c.bg,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: `1px solid ${c.border}`,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-family)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              maxWidth: 320,
              boxShadow: 'var(--shadow-lg)',
              animation: 'toastSlideIn 0.2s ease, toastFadeOut 0.3s ease 2.2s forwards',
            }}
          >
            <span style={{ color: c.icon, flexShrink: 0 }}>{ICONS[t.type]}</span>
            {t.text}
          </div>
        );
      })}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastFadeOut {
          from { opacity: 1; }
          to { opacity: 0; transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
};
