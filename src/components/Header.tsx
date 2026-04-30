import { TreesIcon, Search, Sparkles } from 'lucide-react';

/**
 * Compact header for mobile-first layout (48px height).
 * Shows: logo, search, auto-align button.
 * Zoom controls hidden on mobile (pinch-to-zoom instead).
 */
export const Header = ({ onLayout }: { onLayout: () => void }) => (
  <header style={{
    height: 48,
    width: '100%',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 10,
    fontFamily: 'var(--font-family)',
    zIndex: 30,
    paddingTop: 'var(--safe-top)',
  }}>
    {/* Logo */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-primary))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
      }}>
        <TreesIcon size={14} />
      </div>
      <span style={{
        fontWeight: 800,
        fontSize: 14,
        color: 'var(--color-text)',
      }}>
        FamilyStory
      </span>
    </div>

    {/* Search — expandable later */}
    <div style={{
      flex: 1,
      maxWidth: 300,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    }}>
      <Search size={14} style={{
        position: 'absolute',
        left: 8,
        color: 'var(--color-text-muted)',
      }} />
      <input
        style={{
          width: '100%',
          height: 32,
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '0 10px 0 28px',
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          background: 'var(--color-bg)',
          outline: 'none',
          fontFamily: 'var(--font-family)',
        }}
        placeholder="Поиск…"
        readOnly
      />
    </div>

    {/* Spacer */}
    <div style={{ flex: 1 }} />

    {/* Auto-align button */}
    <button
      onClick={onLayout}
      title="Умное выравнивание"
      style={{
        width: 32,
        height: 32,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--color-text-secondary)',
        flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <Sparkles size={16} />
    </button>
  </header>
);
