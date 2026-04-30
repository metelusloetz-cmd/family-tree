import { useState } from 'react';
import { TreesIcon } from 'lucide-react';

const CORRECT_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'family2024';

/** Simple password gate. Stores session in sessionStorage (cleared when tab closes). */
export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem('tree_auth') === '1'
  );
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === CORRECT_PASSWORD) {
      sessionStorage.setItem('tree_auth', '1');
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput('');
    }
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)',
      fontFamily: 'var(--font-family)',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 20,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(16px)',
          borderRadius: 20,
          padding: '40px 36px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
          border: '1px solid rgba(255,255,255,0.8)',
          width: 300,
          animation: shake ? 'shake 0.4s ease' : 'none',
        }}
      >
        {/* Logo */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #818cf8, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
        }}>
          <TreesIcon size={24} color="#fff" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#1e293b' }}>
            Семейное древо
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            Введите пароль для входа
          </div>
        </div>

        <div style={{ width: '100%' }}>
          <input
            type="password"
            autoFocus
            value={input}
            onChange={e => { setInput(e.target.value); setError(false); }}
            placeholder="Пароль"
            style={{
              width: '100%',
              height: 44,
              border: `1.5px solid ${error ? '#f87171' : '#e2e8f0'}`,
              borderRadius: 12,
              padding: '0 14px',
              fontSize: 15,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
              fontFamily: 'var(--font-family)',
              background: error ? '#fff1f1' : '#fff',
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6, textAlign: 'center' }}>
              Неверный пароль
            </div>
          )}
        </div>

        <button
          type="submit"
          style={{
            width: '100%', height: 44,
            borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #818cf8, #6366f1)',
            color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
            fontFamily: 'var(--font-family)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Войти
        </button>
      </form>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
};
