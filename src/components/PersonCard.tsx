import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from '@xyflow/react';
import { useTreeStore } from '../store/useTreeStore';
import { Camera, Check, X, Users, Eye, MoreHorizontal, ChevronDown, ChevronUp, Plus, Trash2, Mic, MicOff, Sparkles, Loader2 } from 'lucide-react';
import { SmartDateInput } from './SmartDateInput';
import { ImageCropper } from './ImageCropper';
import { showToast } from './InlineToast';
import { ProfilePanel } from './ProfilePanel';
import { extractPersonInfo } from '../services/aiService';

/**
 * PersonCard — compact card that expands inline for editing.
 * No BottomSheet needed — all editing happens right on the card.
 *
 * Compact mode: 160px, shows name + years
 * Edit mode: ~280px, shows all fields with save/cancel
 */
export const PersonCard = memo(({ id, data, selected }: any) => {
  const isMale = data.gender === 'M';
  const isFemale = data.gender === 'F';
  const isDead = Boolean(data.deathDate);
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const editingPersonId = useTreeStore(s => s.editingPersonId);
  const editPerson = useTreeStore(s => s.editPerson);
  const isEditing = editingPersonId === id;

  const profilePersonId = useTreeStore(s => s.profilePersonId);
  const openProfile = useTreeStore(s => s.openProfile);
  const isProfileOpen = profilePersonId === id;

  const collapsedNodes = useTreeStore(s => s.collapsedNodes);
  const toggleCollapse = useTreeStore(s => s.toggleCollapse);
  const isCollapsed = collapsedNodes.has(id);

  const pendingConnection = useTreeStore(s => s.pendingConnection);
  const startPendingConnection = useTreeStore(s => s.startPendingConnection);
  const isSourceCard = pendingConnection?.nodeId === id;

  // Long-press detection for mobile connection
  const LONG_PRESS_MS = 400;
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpTouchStart = useRef<{ x: number; y: number } | null>(null);

  const makeLongPress = (handleId: string) => ({
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const el = e.currentTarget as HTMLElement;
      lpTouchStart.current = { x: touch.clientX, y: touch.clientY };
      lpTimer.current = setTimeout(() => {
        const rect = el.getBoundingClientRect();
        startPendingConnection({
          nodeId: id,
          handleId,
          screenX: rect.left + rect.width / 2,
          screenY: rect.top + rect.height / 2,
        });
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      const s = lpTouchStart.current;
      if (s && Math.hypot(t.clientX - s.x, t.clientY - s.y) > 8) {
        if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
      }
    },
    onTouchEnd: () => {
      if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
    },
  });

  // Check existing relationships to decide which handles to show
  const nodes = useTreeStore(s => s.nodes);
  const edges = useTreeStore(s => s.edges);

  // Has spouse? → hide left/right handles
  const hasSpouse = nodes.some(n =>
    n.type === 'family' &&
    (n.data.fromId === id || n.data.toId === id)
  );

  // Count parents → hide top handle if >= 2
  // Edge from family bridge = 2 parents (both spouses)
  const parentCount = edges.reduce((count, e) => {
    if (e.target !== id || e.targetHandle !== 'top') return count;
    const srcNode = nodes.find(n => n.id === e.source);
    if (srcNode?.type === 'family') return count + 2;
    if (srcNode?.type === 'person') return count + 1;
    return count;
  }, 0);
  const canAcceptParent = parentCount < 2;

  // Does this node have any outgoing edges (i.e. children or family bridges with children)?
  const hasDescendants = edges.some(e => e.source === id);

  const years = [data.birthDate, data.deathDate].filter(Boolean).join('–') || '';
  const borderColor = isMale ? 'var(--color-male)' : isFemale ? 'var(--color-female)' : 'var(--color-border)';

  const showHandles = isHovered || selected || isSourceCard || !!pendingConnection;

  const handleStyle = (extra: React.CSSProperties): React.CSSProperties => ({
    width: pendingConnection ? 14 : 10,
    height: pendingConnection ? 14 : 10,
    background: isSourceCard ? 'var(--color-primary)' : borderColor,
    border: '2px solid #fff',
    opacity: showHandles ? 1 : 0,
    transition: 'opacity 0.2s ease, width 0.15s, height 0.15s',
    zIndex: 5,
    boxShadow: isSourceCard ? '0 0 0 4px rgba(99,102,241,0.25)' : undefined,
    ...extra,
  });

  // Disabled handle: greyed out, non-interactive
  const disabledHandleStyle = (extra: React.CSSProperties): React.CSSProperties => ({
    width: 10,
    height: 10,
    background: '#d1d5db',
    border: '2px solid #fff',
    opacity: 0,
    pointerEvents: 'none' as const,
    zIndex: 5,
    ...extra,
  });

  // Colors shared between edit and compact modes
  const accentColor = isMale ? '#60a5fa' : isFemale ? '#f472b6' : '#818cf8';
  const bgLight = isFemale ? '#fdf2f8' : '#eff6ff';

  /* ═══════ EDIT MODE ═══════ */
  if (isEditing) {
    return (
      <>
        {/* Keep the compact card visible under the modal */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: 168, padding: '10px 12px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            borderRadius: 14,
            border: `1.5px solid ${borderColor}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            fontFamily: 'var(--font-family)',
            position: 'relative',
            opacity: isDead ? 0.65 : 1,
          }}
        >
          <Handle type="target" position={Position.Top} id="top"
            style={canAcceptParent ? handleStyle({ top: -6 }) : disabledHandleStyle({ top: -6 })}
            isConnectable={canAcceptParent}
          />
          <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle({ bottom: -6 })} />
          <Handle type="source" position={Position.Left} id="left"
            style={!hasSpouse ? handleStyle({ left: -6 }) : disabledHandleStyle({ left: -6 })}
            isConnectable={!hasSpouse}
          />
          <Handle type="target" position={Position.Left} id="left-target"
            style={!hasSpouse ? handleStyle({ left: -6 }) : disabledHandleStyle({ left: -6 })}
            isConnectable={!hasSpouse}
          />
          <Handle type="source" position={Position.Right} id="right"
            style={!hasSpouse ? handleStyle({ right: -6 }) : disabledHandleStyle({ right: -6 })}
            isConnectable={!hasSpouse}
          />
          <Handle type="target" position={Position.Right} id="right-target"
            style={!hasSpouse ? handleStyle({ right: -6 }) : disabledHandleStyle({ right: -6 })}
            isConnectable={!hasSpouse}
          />
          <div style={{
            width: 54, height: 62, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
            background: data.photoUrl
              ? `url(${data.photoUrl}) center/cover no-repeat`
              : `linear-gradient(135deg, ${bgLight}, #f8fafc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {!data.photoUrl && (
              <span style={{ fontSize: 15, fontWeight: 700, color: isFemale ? '#ec4899' : '#3b82f6', opacity: 0.7 }}>
                {data.firstName?.[0]}{data.lastName?.[0]}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.3, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.firstName}</div>
            <div style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.3, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{data.lastName}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{years}</div>
          </div>
        </div>
        {/* Draggable edit form rendered in portal */}
        <InlineEditCard
          id={id}
          data={data}
          borderColor={borderColor}
          bgLight={bgLight}
          isFemale={isFemale}
          handleStyle={handleStyle}
          canAcceptParent={canAcceptParent}
          hasSpouse={hasSpouse}
          disabledHandleStyle={disabledHandleStyle}
          onClose={() => editPerson(null)}
        />
      </>
    );
  }

  /* ═══════ COMPACT MODE ═══════ */
  return (
    <>
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setShowMenu(false); }}
      onDoubleClick={() => editPerson(id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: 168,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        borderRadius: 14,
        border: selected
          ? `1.5px solid ${accentColor}`
          : '1px solid rgba(255,255,255,0.6)',
        boxShadow: selected
          ? '0 8px 24px rgba(0,0,0,0.08)'
          : isHovered
            ? '0 8px 28px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.04)'
            : '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
        cursor: 'pointer',
        fontFamily: 'var(--font-family)',
        transition: 'box-shadow 0.25s ease, border-color 0.2s ease, transform 0.2s ease',
        position: 'relative',
        opacity: isDead ? (isHovered ? 1 : 0.65) : 1,
        transform: isHovered ? 'translateY(-1px)' : 'none',
      }}
    >
      {/* Top — disabled if already has 2 parents */}
      <Handle type="target" position={Position.Top} id="top"
        style={canAcceptParent ? handleStyle({ top: -6 }) : disabledHandleStyle({ top: -6 })}
        isConnectable={canAcceptParent}
        {...makeLongPress('top')}
      />
      {/* Bottom — always active */}
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle({ bottom: -6 })} {...makeLongPress('bottom')} />
      {/* Left/Right — always in DOM, disabled if has spouse */}
      <Handle type="source" position={Position.Left} id="left"
        style={!hasSpouse ? handleStyle({ left: -6 }) : disabledHandleStyle({ left: -6 })}
        isConnectable={!hasSpouse}
        {...makeLongPress('left')}
      />
      <Handle type="target" position={Position.Left} id="left-target"
        style={!hasSpouse ? handleStyle({ left: -6 }) : disabledHandleStyle({ left: -6 })}
        isConnectable={!hasSpouse}
        {...makeLongPress('left-target')}
      />
      <Handle type="source" position={Position.Right} id="right"
        style={!hasSpouse ? handleStyle({ right: -6 }) : disabledHandleStyle({ right: -6 })}
        isConnectable={!hasSpouse}
        {...makeLongPress('right')}
      />
      <Handle type="target" position={Position.Right} id="right-target"
        style={!hasSpouse ? handleStyle({ right: -6 }) : disabledHandleStyle({ right: -6 })}
        isConnectable={!hasSpouse}
        {...makeLongPress('right-target')}
      />

      {/* Photo / initials */}
      <div style={{
        width: 54, height: 62,
        borderRadius: 6,
        flexShrink: 0,
        overflow: 'hidden',
        background: data.photoUrl
          ? `url(${data.photoUrl}) center/cover no-repeat`
          : `linear-gradient(135deg, ${bgLight}, #f8fafc)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {!data.photoUrl && (
          <span style={{
            fontSize: 15, fontWeight: 700, letterSpacing: -0.5,
            color: isFemale ? '#ec4899' : '#3b82f6',
            opacity: 0.7,
          }}>
            {data.firstName?.[0]}{data.lastName?.[0]}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: 12, lineHeight: 1.3,
          color: '#1e293b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {data.firstName}
        </div>
        <div style={{
          fontWeight: 600, fontSize: 12, lineHeight: 1.3,
          color: '#1e293b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 3,
        }}>
          {data.lastName}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
          {years}
        </div>
        {/* Collapse + View icons row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {/* Collapse descendants */}
          <button className="nodrag nopan"
            onClick={(e) => { e.stopPropagation(); if (hasDescendants) toggleCollapse(id); }}
            title={isCollapsed ? 'Развернуть потомков' : 'Свернуть потомков'}
            style={{ background: 'none', border: 'none', padding: 0, cursor: hasDescendants ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center',
              color: hasDescendants ? (isCollapsed ? accentColor : '#94a3b8') : '#d1d5db', transition: 'color 0.2s' }}
          >
            <Users size={13} strokeWidth={2} />
            {isCollapsed && hasDescendants && <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 2, color: accentColor }}>+</span>}
          </button>
          {/* View profile */}
          <button className="nodrag nopan"
            onClick={(e) => { e.stopPropagation(); openProfile(id); }}
            title="Открыть профиль"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', color: '#94a3b8', transition: 'color 0.2s' }}
          >
            <Eye size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
      {/* ⋮ menu button — top right */}
      {(isHovered || selected) && (
        <div style={{ position: 'absolute', top: 4, right: 4 }} className="nodrag nopan">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(m => !m); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex', borderRadius: 4 }}
          >
            <MoreHorizontal size={14} />
          </button>
          {showMenu && (
            <div style={{ position: 'absolute', top: 22, right: 0, background: '#fff', borderRadius: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #f1f5f9',
              zIndex: 999, minWidth: 130, overflow: 'hidden' }}>
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); editPerson(id); }}
                style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'none', textAlign: 'left', fontSize: 12, cursor: 'pointer', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-family)' }}>
                ✏️ Редактировать
              </button>
              <button onClick={(e) => {
                e.stopPropagation(); setShowMenu(false);
                const { nodes, edges, setNodes, setEdges } = useTreeStore.getState();
                setNodes(nodes.filter(n => n.id !== id));
                setEdges(edges.filter(e => e.source !== id && e.target !== id));
                showToast('Удалено', 'success');
              }}
                style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'none', textAlign: 'left', fontSize: 12, cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-family)' }}>
                🗑 Удалить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
    {/* Profile panel portal — double-click opens this */}
    {isProfileOpen && <ProfilePanel id={id} data={data} />}
    </>
  );
});


/* ═══════════════════════════════════════════
   InlineEditCard — expanded card with form fields
   ═══════════════════════════════════════════ */

/* Small reusable input */
const MiniField = ({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) => (
  <div style={{ marginBottom: 6 }}>
    <label style={{
      display: 'block', fontSize: 8, fontWeight: 700,
      color: 'var(--color-text-muted)', marginBottom: 2,
      textTransform: 'uppercase', letterSpacing: 0.6,
    }}>
      {label}
    </label>
    <input
      type="text"
      className="nodrag nopan nowheel"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', height: 28,
        padding: '0 8px',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 12, color: 'var(--color-text)',
        background: '#fff', outline: 'none',
        fontFamily: 'var(--font-family)',
        boxSizing: 'border-box',
      }}
      onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
      onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
    />
  </div>
);

function InlineEditCard({ id, data, borderColor, bgLight, isFemale, handleStyle, canAcceptParent, hasSpouse, disabledHandleStyle, onClose }: {
  id: string; data: any; borderColor: string; bgLight: string;
  isFemale: boolean; handleStyle: (extra: React.CSSProperties) => React.CSSProperties;
  canAcceptParent: boolean; hasSpouse: boolean;
  disabledHandleStyle: (extra: React.CSSProperties) => React.CSSProperties;
  onClose: () => void;
}) {
  const { setNodes } = useTreeStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Mobile detection (touch device)
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 1;

  // Draggable position — desktop only, start centered
  const [pos, setPos] = useState<{ x: number; y: number } | null>(
    isMobile ? { x: 0, y: 0 } : null,
  );
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  // Desktop: set initial centered position on mount
  useEffect(() => {
    if (!isMobile) {
      setPos({
        x: Math.round(window.innerWidth / 2 - 130),
        y: Math.max(16, Math.round(window.innerHeight / 2 - 220)),
      });
    }
  }, [isMobile]);

  // Desktop mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    if ((e.target as HTMLElement).closest('input, button, textarea, select')) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos!.x, originY: pos!.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.originX + ev.clientX - dragRef.current.startX,
        y: dragRef.current.originY + ev.clientY - dragRef.current.startY,
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const [form, setForm] = useState({
    firstName: (data.firstName as string) || '',
    lastName: (data.lastName as string) || '',
    gender: (data.gender as string) || 'M',
    birthDate: (data.birthDate as string) || '',
    deathDate: (data.deathDate as string) || '',
    birthPlace: (data.birthPlace as string) || '',
    deathPlace: (data.deathPlace as string) || '',
    photoUrl: (data.photoUrl as string) || '',
    // Extended fields
    occupation: (data.occupation as string) || '',
    education: (data.education as string) || '',
    bio: (data.bio as string) || '',
    photos: (data.photos as string[]) || (data.photoUrl ? [data.photoUrl] : []),
    events: (data.events as Array<{ id: string; year: string; title: string; emoji: string }>) || [],
    socials: (data.socials as Record<string, string>) || {},
  });

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [slideCropFile, setSlideCropFile] = useState<File | null>(null);
  const slideFileRef = useRef<HTMLInputElement>(null);

  // Open cropper when file selected (no size limit — cropper handles downscale)
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, []);

  const handleCropDone = useCallback((base64: string) => {
    set('photoUrl', base64);
    setCropFile(null);
  }, []);

  // Slideshow photo added (landscape 16:9)
  const handleSlideSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSlideCropFile(file);
    e.target.value = '';
  }, []);

  const handleSlideCropDone = useCallback((base64: string) => {
    setForm(f => ({ ...f, photos: [...f.photos, base64] }));
    setSlideCropFile(null);
  }, []);

  const handleSave = () => {
    if (!form.firstName.trim()) {
      showToast('Введите имя', 'warning');
      return;
    }
    if (form.birthDate && form.deathDate) {
      const bYear = extractYear(form.birthDate);
      const dYear = extractYear(form.deathDate);
      if (bYear && dYear && dYear < bYear) {
        showToast('Дата смерти раньше рождения', 'error');
        return;
      }
    }
    // Always read fresh nodes from store to avoid stale closure
    const { nodes: freshNodes } = useTreeStore.getState();
    setNodes(freshNodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, ...form } } : n,
    ));
    showToast('Сохранено', 'success');
    onClose();
  };

  const accentColor = isFemale ? '#f472b6' : '#60a5fa';

  if (!isMobile && !pos) return null;

  return createPortal(
    <div
      onMouseDown={onMouseDown}
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      style={isMobile ? {
        // Mobile: full-screen dimmed overlay, aligns sheet to bottom
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-end',
      } : {
        // Desktop: draggable floating card
        position: 'fixed',
        left: pos!.x,
        top: pos!.y,
        zIndex: 9999,
        width: 260,
        padding: 12,
        background: 'rgba(255,255,255,0.98)',
        backdropFilter: 'blur(12px)',
        borderRadius: 14,
        border: `1.5px solid ${accentColor}`,
        boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        fontFamily: 'var(--font-family)',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {/* Inner content — on mobile wrapped in a bottom sheet panel */}
      <div
        onMouseDown={isMobile ? undefined : onMouseDown}
        onClick={e => e.stopPropagation()}
        style={isMobile ? {
          width: '100%',
          maxHeight: '92dvh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          background: '#fff',
          borderRadius: '18px 18px 0 0',
          padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
          border: `2px solid ${accentColor}`,
          borderBottom: 'none',
          boxSizing: 'border-box',
          fontFamily: 'var(--font-family)',
        } : {
          // Desktop: no inner wrapper needed, content sits directly
          display: 'contents',
        }}
      >
      {/* Smart handles — same rules as compact mode */}
      <Handle type="target" position={Position.Top} id="top"
        style={canAcceptParent ? handleStyle({ top: -6 }) : disabledHandleStyle({ top: -6 })}
        isConnectable={canAcceptParent}
      />
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle({ bottom: -6 })} />
      <Handle type="source" position={Position.Left} id="left"
        style={!hasSpouse ? handleStyle({ left: -6 }) : disabledHandleStyle({ left: -6 })}
        isConnectable={!hasSpouse}
      />
      <Handle type="target" position={Position.Left} id="left-target"
        style={!hasSpouse ? handleStyle({ left: -6 }) : disabledHandleStyle({ left: -6 })}
        isConnectable={!hasSpouse}
      />
      <Handle type="source" position={Position.Right} id="right"
        style={!hasSpouse ? handleStyle({ right: -6 }) : disabledHandleStyle({ right: -6 })}
        isConnectable={!hasSpouse}
      />
      <Handle type="target" position={Position.Right} id="right-target"
        style={!hasSpouse ? handleStyle({ right: -6 }) : disabledHandleStyle({ right: -6 })}
        isConnectable={!hasSpouse}
      />

        {/* Photo + Gender row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        {/* Photo */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            width: 48, height: 48,
            borderRadius: 'var(--radius-sm)',
            flexShrink: 0, overflow: 'hidden', cursor: 'pointer',
            background: form.photoUrl
              ? `url(${form.photoUrl}) center/cover no-repeat`
              : bgLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px dashed ${borderColor}`,
          }}
        >
          {!form.photoUrl && <Camera size={16} color="var(--color-text-muted)" />}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Gender buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['M', 'F'].map(g => (
            <button
              key={g}
              className="nodrag nopan"
              onClick={() => set('gender', g)}
              style={{
                width: 30, height: 30,
                borderRadius: 'var(--radius-sm)',
                border: form.gender === g ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: form.gender === g
                  ? (g === 'M' ? 'var(--color-male-light)' : 'var(--color-female-light)')
                  : '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: form.gender === g ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              {g === 'M' ? '♂' : '♀'}
            </button>
          ))}
        </div>

        {/* Save / Cancel */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button
            className="nodrag nopan"
            onClick={(e) => { e.stopPropagation(); handleSave(); }}
            title="Сохранить"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: 'none', background: 'var(--color-success)',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Check size={14} />
          </button>
          <button
            className="nodrag nopan"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            title="Отмена"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid var(--color-border)', background: '#fff',
              color: 'var(--color-text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Name fields */}
      <MiniField label="Имя" value={form.firstName} onChange={v => set('firstName', v)} />
      <MiniField label="Фамилия" value={form.lastName} onChange={v => set('lastName', v)} />

      {/* Dates */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1 }}>
          <SmartDateInput label="Рождение" value={form.birthDate} onChange={v => set('birthDate', v)} />
        </div>
        <div style={{ flex: 1 }}>
          <SmartDateInput label="Смерть" value={form.deathDate} onChange={v => set('deathDate', v)} />
        </div>
      </div>

      {/* Places */}
      <MiniField label="Место рождения" value={form.birthPlace} onChange={v => set('birthPlace', v)} placeholder="Город" />
      <MiniField label="Место смерти" value={form.deathPlace} onChange={v => set('deathPlace', v)} placeholder="Город" />

      {/* Expand/Collapse toggle */}
      <button
        className="nodrag nopan"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', marginTop: 8, padding: '6px 0',
          background: 'none', border: '1px dashed #e2e8f0',
          borderRadius: 8, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          color: '#94a3b8', fontSize: 11, fontWeight: 600,
          fontFamily: 'var(--font-family)', letterSpacing: 0.3,
          transition: 'border-color 0.2s, color 0.2s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLButtonElement).style.color = '#6366f1'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? 'Свернуть' : 'Развернуть'}
        {!expanded && <ChevronDown size={13} />}
      </button>

      {/* ═══ EXPANDED SECTIONS ═══ */}
      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Slideshow photos (landscape) */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 8, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>📸 Фото (горизонтальные)</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {form.photos.map((src: string, i: number) => (
                <div key={i} style={{ position: 'relative', width: 64, height: 36, borderRadius: 4, overflow: 'hidden' }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => setForm(f => ({ ...f, photos: f.photos.filter((_: any, j: number) => j !== i) }))}
                    className="nodrag nopan"
                    style={{ position: 'absolute', top: 1, right: 1, width: 14, height: 14, background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8 }}>×</button>
                </div>
              ))}
              <button onClick={() => slideFileRef.current?.click()} className="nodrag nopan"
                style={{ width: 64, height: 36, borderRadius: 4, border: '1px dashed #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 18 }}>+</button>
            </div>
            <input ref={slideFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSlideSelect} />
          </div>

          {/* Bio & occupation */}
          <MiniField label="Профессия" value={form.occupation} onChange={v => set('occupation', v)} placeholder="Род деятельности" />
          <MiniField label="Образование" value={form.education} onChange={v => set('education', v)} placeholder="Школа / вуз" />
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', fontSize: 8, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Биография</label>
            <textarea className="nodrag nopan nowheel" rows={3} placeholder="Краткая биография…"
              value={form.bio} onChange={e => set('bio', e.target.value)}
              style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-family)', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
          </div>

          {/* Events */}
          <ExpandedEvents form={form} setForm={setForm} />

          {/* Socials */}
          <ExpandedSocials form={form} setForm={setForm} />

          {/* AI Voice */}
          <ExpandedAI form={form} setForm={setForm} />
        </div>
      )}

      {/* Avatar Cropper Modal (portrait 5:6) */}
      {cropFile && (
        <ImageCropper imageFile={cropFile} onCrop={handleCropDone} onCancel={() => setCropFile(null)} mode="avatar" />
      )}
      {/* Slide Cropper Modal (landscape 16:9) */}
      {slideCropFile && (
        <ImageCropper imageFile={slideCropFile} onCrop={handleSlideCropDone} onCancel={() => setSlideCropFile(null)} mode="slide" />
      )}
      </div> {/* end inner content div */}
    </div>,
    document.body,
  );
}

/* Utility: extract year from flexible date */
function extractYear(s: string): number | null {
  if (!s) return null;
  const m = s.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

const EVENT_EMOJIS = ['🎂','💍','🎓','💼','✈️','🏠','⭐','🏆','💔','🙏','⚰️','👶'];

/* ── Events section ── */
function ExpandedEvents({ form, setForm }: { form: any; setForm: any }) {
  const [showAdd, setShowAdd] = useState(false);
  const [ev, setEv] = useState({ year: '', title: '', emoji: '⭐' });
  const addEvent = () => {
    if (!ev.title.trim()) return;
    const newEv = { id: Date.now().toString(), ...ev };
    setForm((f: any) => ({ ...f, events: [...f.events, newEv].sort((a: any, b: any) => a.year.localeCompare(b.year)) }));
    setEv({ year: '', title: '', emoji: '⭐' });
    setShowAdd(false);
  };
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ display: 'block', fontSize: 8, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>События</label>
      {form.events.map((e: any) => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 14 }}>{e.emoji}</span>
          <span style={{ fontSize: 11, color: '#64748b', minWidth: 32 }}>{e.year}</span>
          <span style={{ fontSize: 12, flex: 1, color: '#1e293b' }}>{e.title}</span>
          <button onClick={() => setForm((f: any) => ({ ...f, events: f.events.filter((x: any) => x.id !== e.id) }))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 2 }} className="nodrag nopan">
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      {showAdd ? (
        <div style={{ marginTop: 4, background: '#f8fafc', borderRadius: 6, padding: 6 }}>
          <div style={{ display: 'flex', gap: 3, overflowX: 'auto', marginBottom: 4 }}>
            {EVENT_EMOJIS.map(e => (
              <button key={e} onClick={() => setEv(n => ({ ...n, emoji: e }))} className="nodrag nopan"
                style={{ fontSize: 14, background: ev.emoji === e ? '#ede9fe' : 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 3px', flexShrink: 0 }}>{e}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <input className="nodrag nopan nowheel" placeholder="Год" value={ev.year} onChange={e => setEv(n => ({ ...n, year: e.target.value }))}
              style={{ width: 58, height: 26, border: '1px solid #e2e8f0', borderRadius: 6, padding: '0 6px', fontSize: 12, outline: 'none', fontFamily: 'var(--font-family)' }} />
            <input className="nodrag nopan nowheel" placeholder="Событие" value={ev.title} onChange={e => setEv(n => ({ ...n, title: e.target.value }))}
              style={{ flex: 1, height: 26, border: '1px solid #e2e8f0', borderRadius: 6, padding: '0 6px', fontSize: 12, outline: 'none', fontFamily: 'var(--font-family)' }} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={addEvent} className="nodrag nopan" style={{ flex: 1, height: 24, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-family)' }}>Добавить</button>
            <button onClick={() => setShowAdd(false)} className="nodrag nopan" style={{ height: 24, padding: '0 8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-family)' }}>Отмена</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="nodrag nopan"
          style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-family)', padding: 0 }}>
          <Plus size={12} /> Добавить событие
        </button>
      )}
    </div>
  );
}

/* ── Socials section ── */
function detectSocial(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('vk.com') || u.startsWith('vk.')) return 'vk';
  if (u.includes('instagram') || u.includes('instagr.am')) return 'instagram';
  if (u.includes('t.me') || u.includes('telegram')) return 'telegram';
  if (u.includes('facebook') || u.includes('fb.com')) return 'facebook';
  return 'link';
}
const SOCIAL_ICONS: Record<string, string> = { vk: '🔵', instagram: '📸', telegram: '✈️', facebook: '👤', link: '🔗' };
const SOCIAL_LABELS: Record<string, string> = { vk: 'ВКонтакте', instagram: 'Instagram', telegram: 'Telegram', facebook: 'Facebook', link: 'Ссылка' };

function ExpandedSocials({ form, setForm }: { form: any; setForm: any }) {
  const [inputVal, setInputVal] = useState('');
  const addSocial = () => {
    if (!inputVal.trim()) return;
    const key = detectSocial(inputVal);
    setForm((f: any) => ({ ...f, socials: { ...f.socials, [key]: inputVal } }));
    setInputVal('');
  };
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ display: 'block', fontSize: 8, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>Соцсети</label>
      {Object.entries(form.socials).filter(([, v]) => v).map(([key]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span>{SOCIAL_ICONS[key] || '🔗'}</span>
          <span style={{ fontSize: 11, flex: 1, color: '#6366f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{SOCIAL_LABELS[key]}</span>
          <button onClick={() => setForm((f: any) => { const s = { ...f.socials }; delete s[key]; return { ...f, socials: s }; })}
            className="nodrag nopan" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}><Trash2 size={11} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="nodrag nopan nowheel" placeholder="Вставьте ссылку на соцсеть" value={inputVal} onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSocial()}
          style={{ flex: 1, height: 26, border: '1px solid #e2e8f0', borderRadius: 6, padding: '0 8px', fontSize: 12, outline: 'none', fontFamily: 'var(--font-family)' }} />
        <button onClick={addSocial} className="nodrag nopan"
          style={{ width: 26, height: 26, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

/* ── AI voice section ── */
const SpeechRec: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

function ExpandedAI({ setForm }: { form?: any; setForm: any }) {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recRef = useRef<any>(null);

  const start = () => {
    if (!SpeechRec) { showToast('Голосовой ввод не поддерживается', 'error'); return; }
    const r = new SpeechRec();
    r.lang = 'ru-RU'; r.continuous = false; r.interimResults = true;
    r.onresult = (e: any) => setTranscript(Array.from(e.results as any[]).map((x: any) => x[0].transcript).join(''));
    r.onend = () => setIsRecording(false);
    r.onerror = () => { setIsRecording(false); showToast('Ошибка микрофона', 'error'); };
    recRef.current = r; r.start(); setIsRecording(true);
  };
  const stop = () => { recRef.current?.stop(); setIsRecording(false); };
  useEffect(() => () => recRef.current?.stop(), []);

  const applyAI = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);
    try {
      const info = await extractPersonInfo(transcript);
      setForm((f: any) => ({
        ...f,
        firstName: info.firstName ?? f.firstName,
        lastName: info.lastName ?? f.lastName,
        gender: info.gender ?? f.gender,
        birthDate: info.birthDate ?? f.birthDate,
        birthPlace: info.birthPlace ?? f.birthPlace,
        deathDate: info.deathDate ?? f.deathDate,
        deathPlace: info.deathPlace ?? f.deathPlace,
        occupation: info.occupation ?? f.occupation,
        education: info.education ?? f.education,
        bio: info.bio ?? f.bio,
        events: info.events ? [...f.events, ...info.events.map((e: any) => ({ id: `${Date.now()}_${e.year}`, ...e }))].sort((a: any, b: any) => a.year.localeCompare(b.year)) : f.events,
        socials: { ...f.socials, ...(info.socials ?? {}) },
      }));
      setTranscript('');
      showToast('ИИ заполнил поля', 'success');
    } catch {
      showToast('Ошибка ИИ', 'error');
    } finally { setIsProcessing(false); }
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ display: 'block', fontSize: 8, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>🎤 ИИ Помощник</label>
      <button onClick={isRecording ? stop : start} className="nodrag nopan"
        style={{ width: '100%', height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: isRecording ? '#ef4444' : '#6366f1', color: '#fff', fontWeight: 600, fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-family)',
          animation: isRecording ? 'pulse 1s infinite' : 'none' }}>
        {isRecording ? <><MicOff size={13} /> Остановить</> : <><Mic size={13} /> Наговорить голосом</>}
      </button>
      {transcript && (
        <>
          <textarea className="nodrag nopan nowheel" rows={2} value={transcript} onChange={e => setTranscript(e.target.value)}
            style={{ width: '100%', marginTop: 4, border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 12, fontFamily: 'var(--font-family)', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
          <button onClick={applyAI} disabled={isProcessing} className="nodrag nopan"
            style={{ width: '100%', height: 28, marginTop: 4, borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: isProcessing ? 0.7 : 1 }}>
            {isProcessing ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Обработка…</> : <><Sparkles size={11} /> Заполнить из текста</>}
          </button>
        </>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
