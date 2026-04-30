import { memo, useState, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTreeStore } from '../store/useTreeStore';
import { Camera, Check, X } from 'lucide-react';
import { SmartDateInput } from './SmartDateInput';
import { ImageCropper } from './ImageCropper';
import { showToast } from './InlineToast';

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

  const editingPersonId = useTreeStore(s => s.editingPersonId);
  const editPerson = useTreeStore(s => s.editPerson);
  const isEditing = editingPersonId === id;

  // ─── Check existing relationships to decide which handles to show ───
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

  const years = [data.birthDate, data.deathDate].filter(Boolean).join('–') || '';
  const borderColor = isMale ? 'var(--color-male)' : isFemale ? 'var(--color-female)' : 'var(--color-border)';

  const showHandles = isHovered || selected;

  const handleStyle = (extra: React.CSSProperties): React.CSSProperties => ({
    width: 10,
    height: 10,
    background: borderColor,
    border: '2px solid #fff',
    opacity: showHandles ? 1 : 0,
    transition: 'opacity 0.2s ease',
    zIndex: 5,
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
    );
  }

  /* ═══════ COMPACT MODE ═══════ */
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
      />
      {/* Bottom — always active */}
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle({ bottom: -6 })} />
      {/* Left/Right — always in DOM, disabled if has spouse */}
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
        <div style={{
          fontSize: 10, color: '#94a3b8', fontWeight: 500,
        }}>
          {years}
        </div>
      </div>
    </div>
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
  const { nodes, setNodes } = useTreeStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: (data.firstName as string) || '',
    lastName: (data.lastName as string) || '',
    gender: (data.gender as string) || 'M',
    birthDate: (data.birthDate as string) || '',
    deathDate: (data.deathDate as string) || '',
    birthPlace: (data.birthPlace as string) || '',
    deathPlace: (data.deathPlace as string) || '',
    photoUrl: (data.photoUrl as string) || '',
  });

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const [cropFile, setCropFile] = useState<File | null>(null);

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

  const handleSave = () => {
    if (!form.firstName.trim()) {
      showToast('Введите имя', 'warning');
      return;
    }
    // Date validation
    if (form.birthDate && form.deathDate) {
      const bYear = extractYear(form.birthDate);
      const dYear = extractYear(form.deathDate);
      if (bYear && dYear && dYear < bYear) {
        showToast('Дата смерти раньше рождения', 'error');
        return;
      }
    }
    setNodes(nodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, ...form } } : n,
    ));
    showToast('Сохранено', 'success');
    onClose();
  };

  const accentColor = isFemale ? '#f472b6' : '#60a5fa';

  return (
    <div
      className="nodrag"
      style={{
        width: 260,
        padding: 12,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: 14,
        border: `1.5px solid ${accentColor}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        fontFamily: 'var(--font-family)',
        position: 'relative',
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

      {/* Image Cropper Modal */}
      {cropFile && (
        <ImageCropper
          imageFile={cropFile}
          onCrop={handleCropDone}
          onCancel={() => setCropFile(null)}
        />
      )}
    </div>
  );
}

/* Utility: extract year from flexible date */
function extractYear(s: string): number | null {
  if (!s) return null;
  const m = s.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}
