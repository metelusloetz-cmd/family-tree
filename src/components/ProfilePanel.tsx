import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Camera, Plus, Trash2, Mic, MicOff,
  ChevronLeft, ChevronRight, Sparkles, Loader2,
} from 'lucide-react';
import { useTreeStore } from '../store/useTreeStore';
import { ImageCropper } from './ImageCropper';
import { SmartDateInput } from './SmartDateInput';
import { showToast } from './InlineToast';
import { extractPersonInfo } from '../services/aiService';

/* ─── Types ──────────────────────────────────────────────────────── */
interface LifeEvent { id: string; year: string; title: string; emoji: string }
interface Socials { vk?: string; instagram?: string; telegram?: string; facebook?: string }
interface FormState {
  firstName: string; lastName: string; gender: 'M' | 'F' | '';
  birthDate: string; birthPlace: string;
  deathDate: string; deathPlace: string;
  occupation: string; education: string; bio: string;
  photos: string[];
  events: LifeEvent[];
  socials: Socials;
}

const EVENT_EMOJIS = ['🎂','💍','🎓','💼','✈️','🏠','⭐','🏆','💔','🙏','⚰️','👶'];

/* ─── SpeechRecognition shim ─────────────────────────────────────── */
const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

/* ═══════════════════════════════════════════════════════════════════
   ProfilePanel — draggable centered portal with full person profile
   ═══════════════════════════════════════════════════════════════════ */
export const ProfilePanel = ({ id, data }: { id: string; data: any }) => {
  const { nodes, setNodes, closeProfile } = useTreeStore();

  /* ── Init form (migrate single photoUrl → photos[]) ── */
  const initForm = (): FormState => ({
    firstName: data.firstName ?? '',
    lastName: data.lastName ?? '',
    gender: data.gender ?? '',
    birthDate: data.birthDate ?? '',
    birthPlace: data.birthPlace ?? '',
    deathDate: data.deathDate ?? '',
    deathPlace: data.deathPlace ?? '',
    occupation: data.occupation ?? '',
    education: data.education ?? '',
    bio: data.bio ?? '',
    photos: data.photos ?? (data.photoUrl ? [data.photoUrl] : []),
    events: data.events ?? [],
    socials: data.socials ?? {},
  });

  const [form, setForm] = useState<FormState>(initForm);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [newEvent, setNewEvent] = useState({ year: '', title: '', emoji: '⭐' });
  const [showEventForm, setShowEventForm] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Drag ── */
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [pos, setPos] = useState({ x: Math.max(0, (window.innerWidth - 360) / 2), y: Math.max(0, (window.innerHeight - 600) / 2) });

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    const move = (ev: MouseEvent) => {
      if (!dragState.current) return;
      setPos({
        x: Math.max(0, dragState.current.origX + ev.clientX - dragState.current.startX),
        y: Math.max(0, dragState.current.origY + ev.clientY - dragState.current.startY),
      });
    };
    const up = () => { dragState.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [pos]);

  const upd = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  /* ── Photo add / remove ── */
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCropFile(file);
    e.target.value = '';
  };
  const onCropDone = (base64: string) => {
    const photos = [...form.photos, base64];
    upd({ photos });
    setPhotoIdx(photos.length - 1);
    setCropFile(null);
  };
  const removePhoto = (idx: number) => {
    const photos = form.photos.filter((_, i) => i !== idx);
    upd({ photos });
    setPhotoIdx(Math.max(0, idx - 1));
  };

  /* ── Events ── */
  const addEvent = () => {
    if (!newEvent.title.trim()) return;
    const ev: LifeEvent = { id: Date.now().toString(), ...newEvent };
    upd({ events: [...form.events, ev].sort((a, b) => a.year.localeCompare(b.year)) });
    setNewEvent({ year: '', title: '', emoji: '⭐' });
    setShowEventForm(false);
  };

  /* ── Voice ── */
  const startRecording = () => {
    if (!SR) { showToast('Голосовой ввод не поддерживается', 'error'); return; }
    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => setTranscript(Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(''));
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => { setIsRecording(false); showToast('Ошибка микрофона', 'error'); };
    recognitionRef.current = rec;
    rec.start();
    setIsRecording(true);
  };
  const stopRecording = () => { recognitionRef.current?.stop(); setIsRecording(false); };

  const applyAI = async () => {
    if (!transcript.trim()) return;
    setIsProcessingAI(true);
    try {
      const info = await extractPersonInfo(transcript);
      upd({
        firstName: info.firstName ?? form.firstName,
        lastName: info.lastName ?? form.lastName,
        gender: info.gender ?? form.gender,
        birthDate: info.birthDate ?? form.birthDate,
        birthPlace: info.birthPlace ?? form.birthPlace,
        deathDate: info.deathDate ?? form.deathDate,
        deathPlace: info.deathPlace ?? form.deathPlace,
        occupation: info.occupation ?? form.occupation,
        education: info.education ?? form.education,
        bio: info.bio ?? form.bio,
        events: info.events
          ? [...form.events, ...info.events.map(e => ({ id: `${Date.now()}_${e.year}`, ...e }))]
              .sort((a, b) => a.year.localeCompare(b.year))
          : form.events,
        socials: { ...form.socials, ...(info.socials ?? {}) },
      });
      setTranscript('');
      showToast('ИИ заполнил поля', 'success');
    } catch {
      showToast('Ошибка ИИ — проверьте подключение', 'error');
    } finally {
      setIsProcessingAI(false);
    }
  };

  /* ── Save ── */
  const save = () => {
    setNodes(nodes.map(n => n.id !== id ? n : {
      ...n,
      data: { ...n.data, ...form, photoUrl: form.photos[0] ?? '' },
    }));
    closeProfile();
    showToast('Сохранено', 'success');
  };

  /* ── Stop recording on unmount ── */
  useEffect(() => () => recognitionRef.current?.stop(), []);

  /* ── Shared styles ── */
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 34, border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '0 10px', fontSize: 13, outline: 'none',
    fontFamily: 'var(--font-family)', boxSizing: 'border-box', color: '#1e293b',
    background: '#fff',
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: 1,
    color: '#94a3b8', textTransform: 'uppercase', margin: '16px 0 8px',
  };
  const smallBtn: React.CSSProperties = {
    height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid #e2e8f0',
    background: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex',
    alignItems: 'center', gap: 4, color: '#64748b', fontFamily: 'var(--font-family)',
  };

  /* ─── Render ─────────────────────────────────────────────────── */
  return createPortal(
    <>
      {/* ImageCropper fullscreen portal */}
      {cropFile && (
        <ImageCropper
          imageFile={cropFile}
          onCrop={onCropDone}
          onCancel={() => setCropFile(null)}
        />
      )}

      <div
        style={{
          position: 'fixed', left: pos.x, top: pos.y,
          width: 355, maxHeight: '85vh',
          background: '#fff', borderRadius: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
          border: '1px solid rgba(99,102,241,0.12)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-family)', zIndex: 100,
          overflow: 'hidden',
        }}
      >
        {/* ── Drag header ── */}
        <div
          onMouseDown={onDragStart}
          style={{
            padding: '12px 14px 10px', cursor: 'grab', userSelect: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid #f1f5f9', background: '#fafbff', flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
            {form.firstName || 'Новый'} {form.lastName}
          </span>
          <button onClick={closeProfile}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: 'auto', padding: '0 14px 14px', flex: 1 }}>

          {/* ── PHOTOS ── */}
          <div style={{ margin: '12px 0 4px' }}>
            {form.photos.length > 0 ? (
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 175, background: '#f8fafc' }}>
                <img src={form.photos[photoIdx]} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {form.photos.length > 1 && <>
                  <button onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                    style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setPhotoIdx(i => Math.min(form.photos.length - 1, i + 1))}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={16} />
                  </button>
                </>}
                <button onClick={() => removePhoto(photoIdx)}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: '50%', width: 26, height: 26, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={12} />
                </button>
                <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
                  {form.photos.map((_, i) => (
                    <div key={i} onClick={() => setPhotoIdx(i)}
                      style={{ width: i === photoIdx ? 16 : 6, height: 6, borderRadius: 3, background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'width 0.2s' }} />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ height: 90, borderRadius: 12, border: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, gap: 6 }}>
                <Camera size={16} /> Нет фото
              </div>
            )}
            <button onClick={() => fileRef.current?.click()}
              style={{ ...smallBtn, marginTop: 8, width: '100%', justifyContent: 'center' }}>
              <Camera size={13} /> Добавить фото
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
          </div>

          {/* ── BASIC INFO ── */}
          <div style={sectionTitle}>Основное</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <input style={inputStyle} placeholder="Имя" value={form.firstName} onChange={e => upd({ firstName: e.target.value })} />
            <input style={inputStyle} placeholder="Фамилия" value={form.lastName} onChange={e => upd({ lastName: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {(['M', 'F', ''] as const).map(g => (
              <button key={g} onClick={() => upd({ gender: g })}
                style={{ flex: 1, height: 32, borderRadius: 8, border: '1px solid', fontSize: 12, cursor: 'pointer',
                  borderColor: form.gender === g ? '#6366f1' : '#e2e8f0',
                  background: form.gender === g ? '#6366f1' : '#fff',
                  color: form.gender === g ? '#fff' : '#64748b', fontFamily: 'var(--font-family)' }}>
                {g === 'M' ? '♂ Мужской' : g === 'F' ? '♀ Женский' : '— Неизв.'}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
            <SmartDateInput label="Год рождения" value={form.birthDate} onChange={v => upd({ birthDate: v })} />
            <input style={{ ...inputStyle, height: 28, fontSize: 12 }} placeholder="Место рождения" value={form.birthPlace} onChange={e => upd({ birthPlace: e.target.value })} />
            <SmartDateInput label="Год смерти" value={form.deathDate} onChange={v => upd({ deathDate: v })} />
            <input style={{ ...inputStyle, height: 28, fontSize: 12 }} placeholder="Место смерти" value={form.deathPlace} onChange={e => upd({ deathPlace: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
            <input style={inputStyle} placeholder="Профессия" value={form.occupation} onChange={e => upd({ occupation: e.target.value })} />
            <input style={inputStyle} placeholder="Образование" value={form.education} onChange={e => upd({ education: e.target.value })} />
          </div>
          <textarea placeholder="Биография…" value={form.bio} onChange={e => upd({ bio: e.target.value })} rows={3}
            style={{ ...inputStyle, height: 'auto', padding: '8px 10px', marginTop: 6, resize: 'none', lineHeight: 1.5 }} />

          {/* ── EVENTS ── */}
          <div style={sectionTitle}>События жизни</div>
          {form.events.map(ev => (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 17 }}>{ev.emoji}</span>
              <span style={{ fontSize: 12, color: '#64748b', flexShrink: 0, minWidth: 34 }}>{ev.year}</span>
              <span style={{ fontSize: 13, color: '#1e293b', flex: 1 }}>{ev.title}</span>
              <button onClick={() => upd({ events: form.events.filter(e => e.id !== ev.id) })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 2 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {showEventForm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, background: '#f8fafc', borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
                {EVENT_EMOJIS.map(e => (
                  <button key={e} onClick={() => setNewEvent(n => ({ ...n, emoji: e }))}
                    style={{ fontSize: 17, background: newEvent.emoji === e ? '#ede9fe' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}>
                    {e}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inputStyle, width: 72 }} placeholder="Год" value={newEvent.year} onChange={e => setNewEvent(n => ({ ...n, year: e.target.value }))} />
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Событие" value={newEvent.title} onChange={e => setNewEvent(n => ({ ...n, title: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={addEvent} style={{ ...smallBtn, flex: 1, justifyContent: 'center', background: '#6366f1', color: '#fff', border: 'none' }}>Добавить</button>
                <button onClick={() => setShowEventForm(false)} style={smallBtn}>Отмена</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowEventForm(true)} style={{ ...smallBtn, marginTop: 8 }}>
              <Plus size={13} /> Добавить событие
            </button>
          )}

          {/* ── SOCIALS ── */}
          <div style={sectionTitle}>Соцсети</div>
          {([
            { key: 'vk' as const, icon: '🔵', label: 'ВКонтакте' },
            { key: 'instagram' as const, icon: '📸', label: 'Instagram' },
            { key: 'telegram' as const, icon: '✈️', label: 'Telegram' },
            { key: 'facebook' as const, icon: '👤', label: 'Facebook' },
          ]).map(({ key, icon, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <input style={{ ...inputStyle, flex: 1 }} placeholder={`${label} — ник или ссылка`}
                value={form.socials[key] ?? ''}
                onChange={e => upd({ socials: { ...form.socials, [key]: e.target.value } })} />
            </div>
          ))}

          {/* ── AI VOICE ── */}
          <div style={sectionTitle}>ИИ помощник 🎤</div>
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12 }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              style={{
                width: '100%', height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: isRecording ? '#ef4444' : '#6366f1', color: '#fff',
                fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'var(--font-family)',
              }}
            >
              {isRecording ? <><MicOff size={16} /> Остановить запись</> : <><Mic size={16} /> Наговорить голосом</>}
            </button>
            {transcript && (
              <div style={{ marginTop: 8 }}>
                <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={3}
                  style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'none', lineHeight: 1.5, background: '#fff' }} />
                <button onClick={applyAI} disabled={isProcessingAI}
                  style={{ ...smallBtn, marginTop: 6, background: '#6366f1', color: '#fff', border: 'none', width: '100%', justifyContent: 'center', height: 34, opacity: isProcessingAI ? 0.7 : 1 }}>
                  {isProcessingAI
                    ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Обработка…</>
                    : <><Sparkles size={13} /> Заполнить из текста</>}
                </button>
              </div>
            )}
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '8px 0 0', lineHeight: 1.4 }}>
              Нажмите 🎤 и расскажите о человеке своими словами — ИИ заполнит поля автоматически.
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
          <button onClick={closeProfile}
            style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'var(--font-family)' }}>
            Отмена
          </button>
          <button onClick={save}
            style={{ flex: 2, height: 38, borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-family)' }}>
            Сохранить
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>,
    document.body,
  );
};
