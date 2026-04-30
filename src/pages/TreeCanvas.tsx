import { useCallback, useRef, useEffect, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, MiniMap,
  ReactFlowProvider, useReactFlow,
} from '@xyflow/react';
import type { Node, Edge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTreeStore } from '../store/useTreeStore';
import { PersonCard } from '../components/PersonCard';
import { FamilyBridge } from '../components/FamilyBridge';
import { SmartEdge } from '../components/SmartEdge';
import { Header } from '../components/Header';
import { FloatingActionBar } from '../components/FloatingActionBar';
import { ToastContainer, showToast } from '../components/InlineToast';
import { validateConnection } from '../utils/connectionValidation';
import { Plus, ImageIcon, ZoomIn, ZoomOut } from 'lucide-react';

/* ═══════════════════════════════════════════
   Node & Edge type registrations
   ═══════════════════════════════════════════ */
const nodeTypes = { person: PersonCard, family: FamilyBridge };
const edgeTypes = { smart: SmartEdge };

/* ═══════════════════════════════════════════
   Demo data — Smirnov family (4 generations)
   ═══════════════════════════════════════════ */
const DEMO_NODES: Node[] = [
  { id: '1', type: 'person', position: { x: 150, y: 0 }, data: { firstName: 'Александр', lastName: 'Смирнов', gender: 'M', birthDate: '1880', deathDate: '1954' }, draggable: true },
  { id: 'f1', type: 'family', position: { x: 355, y: 34 }, data: { fromId: '1', toId: '2' }, draggable: true },
  { id: '2', type: 'person', position: { x: 400, y: 0 }, data: { firstName: 'Мария', lastName: 'Смирнова', gender: 'F', birthDate: '1885', deathDate: '1962' }, draggable: true },
  { id: '3', type: 'person', position: { x: 0, y: 180 }, data: { firstName: 'Сергей', lastName: 'Смирнов', gender: 'M', birthDate: '1908', deathDate: '1973' }, draggable: true },
  { id: '4', type: 'person', position: { x: 200, y: 180 }, data: { firstName: 'Анна', lastName: 'Смирнова', gender: 'F', birthDate: '1910', deathDate: '1991' }, draggable: true },
  { id: 'f2', type: 'family', position: { x: 175, y: 214 }, data: { fromId: '3', toId: '4' }, draggable: true },
  { id: '5', type: 'person', position: { x: 400, y: 180 }, data: { firstName: 'Иван', lastName: 'Смирнов', gender: 'M', birthDate: '1920', deathDate: '1998' }, draggable: true },
  { id: '6', type: 'person', position: { x: 580, y: 180 }, data: { firstName: 'Елена', lastName: 'Смирнова', gender: 'F', birthDate: '1922', deathDate: '2005' }, draggable: true },
  { id: 'f3', type: 'family', position: { x: 565, y: 214 }, data: { fromId: '5', toId: '6' }, draggable: true },
  { id: '7', type: 'person', position: { x: 50, y: 360 }, data: { firstName: 'Дмитрий', lastName: 'Смирнов', gender: 'M', birthDate: '1945' }, draggable: true },
  { id: '8', type: 'person', position: { x: 250, y: 360 }, data: { firstName: 'Ольга', lastName: 'Смирнова', gender: 'F', birthDate: '1948' }, draggable: true },
  { id: '9', type: 'person', position: { x: 450, y: 360 }, data: { firstName: 'Татьяна', lastName: 'Смирнова', gender: 'F', birthDate: '1950' }, draggable: true },
  { id: '10', type: 'person', position: { x: 650, y: 360 }, data: { firstName: 'Виктор', lastName: 'Смирнов', gender: 'M', birthDate: '1952' }, draggable: true },
  { id: '11', type: 'person', position: { x: 100, y: 540 }, data: { firstName: 'Алексей', lastName: 'Смирнов', gender: 'M', birthDate: '1975' }, draggable: true },
  { id: '12', type: 'person', position: { x: 500, y: 540 }, data: { firstName: 'Екатерина', lastName: 'Смирнова', gender: 'F', birthDate: '1980' }, draggable: true },
];

// Neutral edge style — no color noise, 15% transparent
const EDGE_STYLE = { stroke: 'rgba(148,163,184,0.85)', strokeWidth: 1 };

const DEMO_EDGES: Edge[] = [
  { id: 'e_f1_m', source: '1', sourceHandle: 'right', target: 'f1', targetHandle: 'left', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f1_f', source: '2', sourceHandle: 'left', target: 'f1', targetHandle: 'right', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f1_c3', source: 'f1', sourceHandle: 'bottom', target: '3', targetHandle: 'top', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f1_c5', source: 'f1', sourceHandle: 'bottom', target: '5', targetHandle: 'top', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f2_m', source: '3', sourceHandle: 'right', target: 'f2', targetHandle: 'left', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f2_f', source: '4', sourceHandle: 'left', target: 'f2', targetHandle: 'right', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f3_m', source: '5', sourceHandle: 'right', target: 'f3', targetHandle: 'left', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f3_f', source: '6', sourceHandle: 'left', target: 'f3', targetHandle: 'right', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f2_c7', source: 'f2', sourceHandle: 'bottom', target: '7', targetHandle: 'top', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f2_c8', source: 'f2', sourceHandle: 'bottom', target: '8', targetHandle: 'top', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f3_c9', source: 'f3', sourceHandle: 'bottom', target: '9', targetHandle: 'top', type: 'smart', style: EDGE_STYLE },
  { id: 'e_f3_c10', source: 'f3', sourceHandle: 'bottom', target: '10', targetHandle: 'top', type: 'smart', style: EDGE_STYLE },
  { id: 'e_7_11', source: '7', sourceHandle: 'bottom', target: '11', targetHandle: 'top', type: 'smart', style: EDGE_STYLE },
  { id: 'e_9_12', source: '9', sourceHandle: 'bottom', target: '12', targetHandle: 'top', type: 'smart', style: EDGE_STYLE },
];

/* ═══════════════════════════════════════════
   Zoom button style
   ═══════════════════════════════════════════ */
const zoomBtnStyle: React.CSSProperties = {
  width: 36, height: 36,
  borderRadius: 8, border: 'none',
  background: 'rgba(255,255,255,0.9)',
  color: '#64748b', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  backdropFilter: 'blur(8px)',
};

/* ═══════════════════════════════════════════
   TreeCanvasInner
   ═══════════════════════════════════════════ */
const TreeCanvasInner = () => {
  const initialized = useRef(false);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const {
    nodes, edges, setNodes, setEdges,
    onNodesChange, onEdgesChange,
    selectedPersonId, selectPerson,
    editingPersonId, editPerson,
    backgroundImage, setBackgroundImage,
  } = useTreeStore();

  const [selectedCardRect, setSelectedCardRect] = useState<{
    x: number; y: number; width: number; height: number;
  } | null>(null);

  // ─── Initialize demo data ───
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (useTreeStore.getState().nodes.length === 0) {
      setNodes(DEMO_NODES);
      setEdges(DEMO_EDGES);
    }
  }, [setNodes, setEdges]);

  // ─── Update card rect ───
  const updateCardRect = useCallback(() => {
    if (!selectedPersonId || editingPersonId) {
      setSelectedCardRect(null);
      return;
    }
    const el = document.querySelector(`[data-id="${selectedPersonId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSelectedCardRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }
  }, [selectedPersonId, editingPersonId]);

  useEffect(() => { updateCardRect(); }, [selectedPersonId, editingPersonId, updateCardRect]);

  // ─── Drag: reposition family bridges + fix edge handles ───
  const handleNodeDrag = useCallback((_e: any, draggedNode: Node) => {
    const { nodes: currentNodes, edges: currentEdges, setNodes: storeSetNodes, setEdges: storeSetEdges } = useTreeStore.getState();
    const CARD_W = 160;
    let nodesChanged = false;
    let edgesChanged = false;

    const updatedNodes = currentNodes.map(n => {
      if (n.type !== 'family') return n;
      const fromId = n.data.fromId as string;
      const toId = n.data.toId as string;
      if (fromId !== draggedNode.id && toId !== draggedNode.id) return n;

      const fromNode = fromId === draggedNode.id ? draggedNode : currentNodes.find(nn => nn.id === fromId);
      const toNode = toId === draggedNode.id ? draggedNode : currentNodes.find(nn => nn.id === toId);
      if (!fromNode || !toNode) return n;

      nodesChanged = true;
      return {
        ...n,
        position: {
          x: (fromNode.position.x + toNode.position.x + CARD_W) / 2,
          y: (fromNode.position.y + toNode.position.y) / 2 + 34, // center on card height
        },
      };
    });

    // Fix spouse edge handles when cards swap left/right positions
    const updatedEdges = currentEdges.map(edge => {
      // Find the family bridge this edge connects to
      const famNode = currentNodes.find(n =>
        n.type === 'family' && n.id === edge.target
      );
      if (!famNode) return edge;

      const fromId = famNode.data.fromId as string;
      const toId = famNode.data.toId as string;

      // Only fix edges between spouse ↔ bridge
      if (edge.source !== fromId && edge.source !== toId) return edge;

      const fromNode = fromId === draggedNode.id ? draggedNode : currentNodes.find(nn => nn.id === fromId);
      const toNode = toId === draggedNode.id ? draggedNode : currentNodes.find(nn => nn.id === toId);
      if (!fromNode || !toNode) return edge;

      const isFromLeft = fromNode.position.x <= toNode.position.x;

      // fromId spouse: goes to left side of bridge if from is left, right if from is right
      if (edge.source === fromId) {
        const correctSourceHandle = isFromLeft ? 'right' : 'left';
        const correctTargetHandle = isFromLeft ? 'left' : 'right';
        if (edge.sourceHandle !== correctSourceHandle || edge.targetHandle !== correctTargetHandle) {
          edgesChanged = true;
          return { ...edge, sourceHandle: correctSourceHandle, targetHandle: correctTargetHandle };
        }
      }
      // toId spouse
      if (edge.source === toId) {
        const correctSourceHandle = isFromLeft ? 'left' : 'right';
        const correctTargetHandle = isFromLeft ? 'right' : 'left';
        if (edge.sourceHandle !== correctSourceHandle || edge.targetHandle !== correctTargetHandle) {
          edgesChanged = true;
          return { ...edge, sourceHandle: correctSourceHandle, targetHandle: correctTargetHandle };
        }
      }

      return edge;
    });

    if (nodesChanged) storeSetNodes(updatedNodes);
    if (edgesChanged) storeSetEdges(updatedEdges);
    if (draggedNode.id === selectedPersonId) updateCardRect();
  }, [selectedPersonId, updateCardRect]);

  // ─── Native React Flow connection: drag handle → handle ───
  // Uses getState() to always read fresh data, avoiding stale closure bugs
  const handleConnect = useCallback((connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target) return;

    // Always read latest state directly from store
    const { nodes: currentNodes, edges: currentEdges, setNodes: storeSetNodes, setEdges: storeSetEdges } = useTreeStore.getState();

    const sourceNode = currentNodes.find(n => n.id === source);
    const targetNode = currentNodes.find(n => n.id === target);
    if (!sourceNode || !targetNode) return;

    // ═══ Validate connection before creating ═══
    const validation = validateConnection(source, target, sourceHandle, targetHandle, currentNodes, currentEdges);
    if (!validation.valid) {
      showToast(validation.error || 'Связь невозможна', 'error');
      return;
    }

    if (validation.type === 'spouse') {
      const famId = `fam_${Date.now()}`;
      const CARD_W = 160;

      // Center bridge at vertical midpoint of cards (card ~82px tall, bridge 14px)
      const CARD_CENTER_OFFSET = 34; // (82/2) - (14/2)
      const famNode: Node = {
        id: famId,
        type: 'family',
        position: {
          x: (sourceNode.position.x + targetNode.position.x + CARD_W) / 2,
          y: (sourceNode.position.y + targetNode.position.y) / 2 + CARD_CENTER_OFFSET,
        },
        data: { fromId: source, toId: target },
        draggable: true,
      };

      const isLeftToRight = sourceNode.position.x <= targetNode.position.x;

      const newEdges: Edge[] = [
        {
          id: `e_${famId}_s`, source,
          sourceHandle: isLeftToRight ? 'right' : 'left',
          target: famId, targetHandle: isLeftToRight ? 'left' : 'right',
          type: 'smart', style: EDGE_STYLE,
        },
        {
          id: `e_${famId}_t`, source: target,
          sourceHandle: isLeftToRight ? 'left' : 'right',
          target: famId, targetHandle: isLeftToRight ? 'right' : 'left',
          type: 'smart', style: EDGE_STYLE,
        },
      ];

      storeSetNodes([...currentNodes, famNode]);
      storeSetEdges([...currentEdges, ...newEdges]);
      showToast('Супруги связаны', 'success');

    } else if (validation.type === 'parent') {
      const newEdge: Edge = {
        id: `e_${source}_${target}_${Date.now()}`,
        source, sourceHandle: 'bottom',
        target, targetHandle: 'top',
        type: 'smart',
        style: EDGE_STYLE,
      };

      storeSetEdges([...currentEdges, newEdge]);
      showToast('Связь родитель—ребёнок создана', 'success');
    }
  }, []); // No deps — always reads fresh from store

  // ─── Clicks ───
  const handleNodeClick = useCallback((_: any, node: Node) => {
    if (node.type === 'family') return;
    // If clicking while editing another card, close editing
    if (editingPersonId && editingPersonId !== node.id) {
      editPerson(null);
    }
    selectPerson(node.id);
  }, [selectPerson, editingPersonId, editPerson]);

  const handleNodeDoubleClick = useCallback((_: any, node: Node) => {
    if (node.type === 'family') return;
    editPerson(node.id);
  }, [editPerson]);

  const handlePaneClick = useCallback(() => {
    selectPerson(null);
    editPerson(null);
  }, [selectPerson, editPerson]);

  // ─── Layout (fitView only for now) ───
  const handleLayout = useCallback(() => {
    fitView({ padding: 0.2, duration: 600 });
    showToast('Вписано в экран', 'info');
  }, [fitView]);

  const handleMoveEnd = useCallback(() => { updateCardRect(); }, [updateCardRect]);

  // ─── FAB actions ───
  const handleEditFromBar = useCallback(() => {
    if (selectedPersonId) editPerson(selectedPersonId);
  }, [selectedPersonId, editPerson]);

  const handleDeleteFromBar = useCallback(() => {
    if (!selectedPersonId) return;
    const id = selectedPersonId;
    const connFam = nodes.filter(n =>
      n.type === 'family' && (n.data.fromId === id || n.data.toId === id)
    );
    const famIds = new Set(connFam.map(n => n.id));
    setEdges(edges.filter(e =>
      e.source !== id && e.target !== id &&
      !famIds.has(e.source) && !famIds.has(e.target)
    ));
    setNodes(nodes.filter(n => n.id !== id && !famIds.has(n.id)));
    selectPerson(null);
    showToast('Удалено', 'info');
  }, [selectedPersonId, nodes, edges, setNodes, setEdges, selectPerson]);

  // ─── Create new person ───
  const handleAddPerson = useCallback(() => {
    const id = `p_${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'person',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { firstName: 'Новый', lastName: 'Человек', gender: 'M' },
      draggable: true,
    };
    setNodes([...nodes, newNode]);
    editPerson(id);
    showToast('Создан — заполните данные', 'info');
  }, [nodes, setNodes, editPerson]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-family)',
      background: 'var(--color-bg)',
    }}>
      <Header onLayout={handleLayout} />

      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDrag={handleNodeDrag}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={handlePaneClick}
          onConnect={handleConnect}
          onMoveEnd={handleMoveEnd}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={2.5}
          connectionLineStyle={{ stroke: 'var(--color-primary)', strokeWidth: 1.5, strokeDasharray: '6 3' }}
          defaultEdgeOptions={{
            type: 'smart',
            style: EDGE_STYLE,
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={0.6}
            color={backgroundImage ? 'transparent' : '#d1d5db'}
            style={{
              background: backgroundImage
                ? `url(${backgroundImage}) center/cover no-repeat`
                : 'var(--color-bg)',
            }}
          />
          <MiniMap
            position="bottom-right"
            nodeColor="#818cf8"
            maskColor="rgba(245,246,250,0.7)"
            zoomable
            pannable
            style={{
              width: 120, height: 80,
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-md)',
            }}
          />
        </ReactFlow>

        {/* FloatingActionBar — edit + delete */}
        {selectedPersonId && !editingPersonId && (
          <FloatingActionBar
            cardRect={selectedCardRect}
            onEdit={handleEditFromBar}
            onDelete={handleDeleteFromBar}
          />
        )}

        {/* FAB — Add person */}
        {!editingPersonId && (
          <button
            onClick={(e) => { e.stopPropagation(); handleAddPerson(); }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Добавить человека"
            style={{
              position: 'absolute',
              bottom: 24, right: 24,
              width: 48, height: 48,
              borderRadius: '50%', border: 'none',
              background: 'var(--color-primary)',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(79,70,229,0.4)',
              zIndex: 20,
            }}
          >
            <Plus size={24} />
          </button>
        )}

        {/* Zoom controls — bottom left */}
        {!editingPersonId && (
          <div style={{
            position: 'absolute', bottom: 24, left: 16,
            display: 'flex', flexDirection: 'column', gap: 4,
            zIndex: 20,
          }}>
            <button
              onClick={() => zoomIn({ duration: 200 })}
              style={zoomBtnStyle}
              title="Приблизить"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => zoomOut({ duration: 200 })}
              style={zoomBtnStyle}
              title="Отдалить"
            >
              <ZoomOut size={16} />
            </button>
          </div>
        )}

        {/* Background image button */}
        {!editingPersonId && (
          <>
            <input
              id="bg-image-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === 'string') {
                    // Downscale bg image to keep localStorage manageable
                    const img = new Image();
                    img.onload = () => {
                      const MAX = 1920;
                      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                      const canvas = document.createElement('canvas');
                      canvas.width = img.width * scale;
                      canvas.height = img.height * scale;
                      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                      setBackgroundImage(canvas.toDataURL('image/jpeg', 0.7));
                      showToast('Фон установлен', 'success');
                    };
                    img.src = reader.result;
                  }
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => {
                if (backgroundImage) {
                  setBackgroundImage(null);
                  showToast('Фон убран', 'info');
                } else {
                  document.getElementById('bg-image-input')?.click();
                }
              }}
              title={backgroundImage ? 'Убрать фон' : 'Фоновое изображение'}
              style={{
                position: 'absolute',
                bottom: 24, right: 80,
                width: 40, height: 40,
                borderRadius: '50%', border: 'none',
                background: backgroundImage ? '#ef4444' : 'rgba(255,255,255,0.9)',
                color: backgroundImage ? '#fff' : '#64748b',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                zIndex: 20,
                backdropFilter: 'blur(8px)',
              }}
            >
              <ImageIcon size={18} />
            </button>
          </>
        )}
      </div>

      <ToastContainer />
    </div>
  );
};

/* ═══════════════════════════════════════════
   TreeCanvas — with Provider
   ═══════════════════════════════════════════ */
export const TreeCanvas = () => (
  <ReactFlowProvider>
    <TreeCanvasInner />
  </ReactFlowProvider>
);
