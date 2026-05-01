import { TreesIcon, Search, Sparkles, Download, Upload } from 'lucide-react';
import { useRef } from 'react';
import { useTreeStore } from '../store/useTreeStore';
import { showToast } from './InlineToast';

/**
 * Compact header for mobile-first layout (48px height).
 * Shows: logo, search, export/import, auto-align button.
 */
export const Header = ({ onLayout }: { onLayout: () => void }) => {
  const { nodes, edges, setNodes, setEdges } = useTreeStore();
  const importRef = useRef<HTMLInputElement>(null);

  // ─── Export: download full tree (nodes + edges + base64 photos) as JSON ───
  const handleExport = () => {
    const payload = { nodes, edges, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-tree-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Дерево сохранено в файл', 'success');
  };

  // ─── Import: load tree from JSON file ───
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
          throw new Error('Invalid format');
        }
        setNodes(data.nodes);
        setEdges(data.edges);
        showToast(`Загружено ${data.nodes.length} человек`, 'success');
      } catch {
        showToast('Ошибка: неверный файл', 'error');
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = '';
  };

  const iconBtnStyle: React.CSSProperties = {
    width: 32, height: 32,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
    transition: 'background 0.15s',
  };

  return (
    <header style={{
      height: 48,
      width: '100%',
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 8,
      fontFamily: 'var(--font-family)',
      zIndex: 30,
      paddingTop: 'var(--safe-top)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          <TreesIcon size={14} />
        </div>
        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>
          FamilyStory
        </span>
      </div>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 220, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={14} style={{ position: 'absolute', left: 8, color: 'var(--color-text-muted)' }} />
        <input
          style={{
            width: '100%', height: 32,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0 10px 0 28px',
            fontSize: 12, color: 'var(--color-text-secondary)',
            background: 'var(--color-bg)', outline: 'none',
            fontFamily: 'var(--font-family)',
          }}
          placeholder="Поиск…"
          readOnly
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Export button */}
      <button onClick={handleExport} title="Скачать дерево (.json)" style={iconBtnStyle}>
        <Download size={15} />
      </button>

      {/* Import button */}
      <button onClick={() => importRef.current?.click()} title="Загрузить дерево (.json)" style={iconBtnStyle}>
        <Upload size={15} />
      </button>
      <input
        ref={importRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImport}
      />

      {/* Auto-align button */}
      <button onClick={onLayout} title="Умное выравнивание" style={iconBtnStyle}>
        <Sparkles size={16} />
      </button>
    </header>
  );
};
