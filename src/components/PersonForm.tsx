import { useState, useEffect } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { Camera } from 'lucide-react';
import { SmartDateInput } from './SmartDateInput';
import { showToast } from './InlineToast';

/**
 * PersonForm — compact form inside BottomSheet.
 * Handles both "create new" and "edit existing" modes.
 */

/* ─── Reusable field ─── */
const Field = ({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{
      display: 'block',
      fontSize: 10,
      fontWeight: 600,
      color: 'var(--color-text-muted)',
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    }}>
      {label}
    </label>
    <input
      type="text"
      placeholder={placeholder || ''}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        height: 36,
        padding: '0 12px',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13,
        color: 'var(--color-text)',
        background: 'var(--color-surface)',
        outline: 'none',
        fontFamily: 'var(--font-family)',
        boxSizing: 'border-box',
      }}
    />
  </div>
);

interface PersonFormProps {
  personId: string | null; // 'new' for create mode, existing id for edit
  onSave: () => void;
  onCancel: () => void;
}

export const PersonForm = ({ personId, onSave, onCancel }: PersonFormProps) => {
  const { nodes, setNodes } = useTreeStore();

  const isNew = personId === 'new';
  const personNode = nodes.find(n => n.id === personId);
  const existingData = personNode?.data;

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'M' as string,
    birthDate: '',
    deathDate: '',
    birthPlace: '',
    deathPlace: '',
  });

  // Load data when editing existing person
  useEffect(() => {
    if (existingData && !isNew) {
      setForm({
        firstName: (existingData.firstName as string) || '',
        lastName: (existingData.lastName as string) || '',
        gender: (existingData.gender as string) || 'M',
        birthDate: (existingData.birthDate as string) || '',
        deathDate: (existingData.deathDate as string) || '',
        birthPlace: (existingData.birthPlace as string) || '',
        deathPlace: (existingData.deathPlace as string) || '',
      });
    } else if (isNew) {
      setForm({ firstName: '', lastName: '', gender: 'M', birthDate: '', deathDate: '', birthPlace: '', deathPlace: '' });
    }
  }, [personId, existingData, isNew]);

  const setField = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!form.firstName.trim()) {
      showToast('Введите имя', 'warning');
      return;
    }

    // Date cross-validation: death can't be before birth
    if (form.birthDate && form.deathDate) {
      const bYear = extractYear(form.birthDate);
      const dYear = extractYear(form.deathDate);
      if (bYear && dYear && dYear < bYear) {
        showToast('Дата смерти не может быть раньше даты рождения', 'error');
        return;
      }
      if (bYear && dYear && dYear - bYear > 130) {
        showToast(`Возраст ${dYear - bYear} лет нереалистичен`, 'warning');
        return;
      }
    }

    if (isNew) {
      const id = `p_${Date.now()}`;
      const newNode = {
        id,
        type: 'person' as const,
        position: { x: Math.random() * 400, y: Math.random() * 300 },
        data: { ...form, id },
        draggable: true,
      };
      setNodes([...nodes, newNode]);
      showToast(`${form.firstName} добавлен(а)`, 'success');
    } else if (personId) {
      setNodes(nodes.map(n =>
        n.id === personId ? { ...n, data: { ...n.data, ...form } } : n,
      ));
      showToast('Сохранено', 'success');
    }

    onSave();
  };

  return (
    <div style={{ fontFamily: 'var(--font-family)' }}>
      {/* Header */}
      <h2 style={{
        fontSize: 16,
        fontWeight: 700,
        color: 'var(--color-text)',
        marginBottom: 16,
      }}>
        {isNew ? 'Новый человек' : 'Редактировать'}
      </h2>

      {/* Photo placeholder */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--color-bg)',
          border: '2px dashed var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          gap: 2,
        }}>
          <Camera size={18} color="var(--color-text-muted)" />
          <span style={{ fontSize: 8, color: 'var(--color-text-muted)', fontWeight: 600 }}>Фото</span>
        </div>
      </div>

      {/* Gender picker */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
        {['M', 'F'].map(g => (
          <button
            key={g}
            onClick={() => setField('gender', g)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-sm)',
              border: form.gender === g ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: form.gender === g
                ? (g === 'M' ? 'var(--color-male-light)' : 'var(--color-female-light)')
                : 'var(--color-surface)',
              color: form.gender === g ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: 700,
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            {g === 'M' ? '♂' : '♀'}
          </button>
        ))}
      </div>

      {/* Fields */}
      <Field label="Имя" value={form.firstName} onChange={v => setField('firstName', v)} />
      <Field label="Фамилия" value={form.lastName} onChange={v => setField('lastName', v)} />

      {/* Dates — side by side */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <SmartDateInput
            label="Дата рождения"
            value={form.birthDate}
            onChange={v => setField('birthDate', v)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <SmartDateInput
            label="Дата смерти"
            value={form.deathDate}
            onChange={v => setField('deathDate', v)}
          />
        </div>
      </div>

      <Field label="Место рождения" value={form.birthPlace} onChange={v => setField('birthPlace', v)} placeholder="Город, страна" />
      <Field label="Место смерти" value={form.deathPlace} onChange={v => setField('deathPlace', v)} placeholder="Город, страна" />

      {/* Actions — sticky at bottom */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginTop: 20,
        position: 'sticky',
        bottom: 0,
        background: 'var(--color-surface)',
        paddingTop: 12,
        paddingBottom: 4,
      }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
          }}
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--color-primary)',
            fontWeight: 600,
            fontSize: 13,
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
            boxShadow: '0 2px 8px rgba(79,70,229,0.3)',
          }}
        >
          Сохранить
        </button>
      </div>

      {/* Delete button for existing persons */}
      {!isNew && personId && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <button
            onClick={() => {
              setNodes(nodes.filter(n => n.id !== personId));
              showToast('Удалено', 'info');
              onSave();
            }}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--color-error)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
            }}
          >
            Удалить человека
          </button>
        </div>
      )}
    </div>
  );
};

/* ─── Utility: extract year from flexible date format ─── */
function extractYear(dateStr: string): number | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (/^\d{4}$/.test(s)) return parseInt(s, 10);
  const mmYyyy = s.match(/^(\d{2})\.(\d{4})$/);
  if (mmYyyy) return parseInt(mmYyyy[2], 10);
  const ddMmYyyy = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ddMmYyyy) return parseInt(ddMmYyyy[3], 10);
  const iso = s.match(/(\d{4})/);
  return iso ? parseInt(iso[1], 10) : null;
}
