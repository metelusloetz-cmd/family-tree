import { useCallback, useEffect, useState } from 'react';
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

// Neutral edge style — no color noise, 15% transparent
const EDGE_STYLE = { stroke: 'rgba(148,163,184,0.85)', strokeWidth: 1 };

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

  // No demo data initialization — start fresh

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
          deleteKeyCode={null}
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
