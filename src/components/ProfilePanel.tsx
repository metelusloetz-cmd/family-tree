import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTreeStore } from '../store/useTreeStore';

/**
 * ProfilePanel — read-only view of a person's profile.
 * Shows only filled fields. Carousel of slideshow photos.
 * Opened by clicking the 👁 icon on the compact card.
 */

const SOCIAL_META: Record<string, { label: string; icon: string; color: string }> = {
  vk:        { label: 'ВКонтакте', icon: '🔵', color: '#0077ff' },
  instagram: { label: 'Instagram',  icon: '📸', color: '#e1306c' },
  telegram:  { label: 'Telegram',   icon: '✈️', color: '#2aabee' },
  facebook:  { label: 'Facebook',   icon: '👤', color: '#1877f2' },
  link:      { label: 'Ссылка',     icon: '🔗', color: '#6366f1' },
};

export const ProfilePanel = ({ id, data }: { id: string; data: any }) => {
  const { closeProfile, editPerson } = useTreeStore();
  const [photoIdx, setPhotoIdx] = useState(0);

  /* ── Drag ── */
  const dragState = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [pos, setPos] = useState({
    x: Math.max(20, (window.innerWidth - 320) / 2),
    y: Math.max(20, (window.innerHeight - 520) / 2),
  });

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragState.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    const move = (ev: MouseEvent) => {
      if (!dragState.current) return;
      setPos({
        x: Math.max(0, dragState.current.ox + ev.clientX - dragState.current.sx),
        y: Math.max(0, dragState.current.oy + ev.clientY - dragState.current.sy),
      });
    };
    const up = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [pos]);

  /* ── Data shortcuts ── */
  const name = [data.firstName, data.lastName].filter(Boolean).join(' ');
  const slides: string[] = data.photos ?? [];
  const events: Array<{ id: string; year: string; title: string; emoji: string }> = data.events ?? [];
  const socials: Record<string, string> = data.socials ?? {};
  const socialEntries = Object.entries(socials).filter(([, v]) => Boolean(v));

  const hasDates = data.birthDate || data.deathDate;
  const hasPlaces = data.birthPlace || data.deathPlace;
  const hasOccupation = Boolean(data.occupation);
  const hasEducation = Boolean(data.education);
  const hasBio = Boolean(data.bio);
  const hasEvents = events.length > 0;
  const hasSocials = socialEntries.length > 0;

  /* ── Styles ── */
  const sectionLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
    color: '#94a3b8', textTransform: 'uppercase', margin: '12px 0 6px',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'baseline', gap: 6,
    fontSize: 13, color: '#1e293b', marginBottom: 4,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: '#94a3b8', minWidth: 56, flexShrink: 0,
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 200,
        width: 300, maxHeight: '82vh',
        background: '#fff', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        border: '1px solid #f1f5f9',
        fontFamily: 'var(--font-family)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Header (drag handle) ── */}
      <div
        onMouseDown={onDragStart}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px 10px', borderBottom: '1px solid #f8fafc',
          cursor: 'grab', userSelect: 'none', flexShrink: 0,
          background: '#fafbff',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{name || 'Без имени'}</div>
          {data.birthDate && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
              {data.birthDate}{data.deathDate ? ` — ${data.deathDate}` : ''}
            </div>
          )}
        </div>
        <button onClick={closeProfile}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
          <X size={17} />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ overflowY: 'auto', padding: '0 14px 14px', flex: 1 }}>

        {/* Avatar + name row */}
        {data.photoUrl && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '12px 0 4px' }}>
            <img src={data.photoUrl} alt={name}
              style={{ width: 54, height: 65, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #f1f5f9' }} />
            <div style={{ flex: 1 }}>
              {hasOccupation && <div style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{data.occupation}</div>}
              {hasEducation && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{data.education}</div>}
            </div>
          </div>
        )}

        {/* Slideshow carousel */}
        {slides.length > 0 && (
          <div style={{ margin: '8px 0', position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
            <img src={slides[photoIdx]} alt=""
              style={{ width: '100%', height: 148, objectFit: 'cover', display: 'block' }} />
            {slides.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                  style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', width: 26, height: 26, color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <button onClick={() => setPhotoIdx(i => Math.min(slides.length - 1, i + 1))}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', width: 26, height: 26, color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                {/* Dots */}
                <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
                  {slides.map((_, i) => (
                    <div key={i} onClick={() => setPhotoIdx(i)}
                      style={{ width: i === photoIdx ? 14 : 5, height: 5, borderRadius: 3, background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'width 0.2s' }} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Bio */}
        {hasBio && (
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '10px 0 0' }}>
            {data.bio}
          </p>
        )}

        {/* Basic info — only filled fields */}
        {(hasDates || hasPlaces || (hasOccupation && !data.photoUrl) || (hasEducation && !data.photoUrl)) && (
          <>
            <div style={sectionLabel}>Данные</div>
            {hasDates && (
              <div style={rowStyle}>
                <span style={labelStyle}>Годы</span>
                <span>{data.birthDate || '?'}{data.deathDate ? ` — ${data.deathDate}` : ''}</span>
              </div>
            )}
            {hasPlaces && (
              <div style={rowStyle}>
                <span style={labelStyle}>Место</span>
                <span>{[data.birthPlace, data.deathPlace].filter(Boolean).join(' / ')}</span>
              </div>
            )}
            {hasOccupation && !data.photoUrl && (
              <div style={rowStyle}>
                <span style={labelStyle}>Работа</span>
                <span>{data.occupation}</span>
              </div>
            )}
            {hasEducation && !data.photoUrl && (
              <div style={rowStyle}>
                <span style={labelStyle}>Учёба</span>
                <span>{data.education}</span>
              </div>
            )}
          </>
        )}

        {/* Events timeline */}
        {hasEvents && (
          <>
            <div style={sectionLabel}>События</div>
            {events.map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{ev.emoji}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 32, flexShrink: 0, paddingTop: 1 }}>{ev.year}</span>
                <span style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>{ev.title}</span>
              </div>
            ))}
          </>
        )}

        {/* Social links */}
        {hasSocials && (
          <>
            <div style={sectionLabel}>Соцсети</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {socialEntries.map(([key, url]) => {
                const meta = SOCIAL_META[key] ?? SOCIAL_META.link;
                return (
                  <a key={key} href={url.startsWith('http') ? url : `https://${url}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 20,
                      background: `${meta.color}10`,
                      border: `1px solid ${meta.color}30`,
                      fontSize: 12, color: meta.color, textDecoration: 'none',
                      fontWeight: 500,
                    }}>
                    {meta.icon} {meta.label}
                  </a>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
        <button
          onClick={() => { closeProfile(); editPerson(id); }}
          style={{
            width: '100%', height: 36, borderRadius: 10, border: 'none',
            background: '#6366f1', color: '#fff', cursor: 'pointer',
            fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-family)',
          }}
        >
          ✏️ Редактировать
        </button>
      </div>
    </div>,
    document.body,
  );
};
