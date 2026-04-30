import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { supabase } from '../supabase';

const supabaseStorage: StateStorage = {
  getItem: async (_name: string): Promise<string | null> => {
    const { data, error } = await supabase.from('tree_data').select('data').eq('id', 1).single();
    if (error || !data) return null;
    return typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    await supabase.from('tree_data').upsert({ id: 1, data: JSON.parse(value) });
  },
  removeItem: async (_name: string): Promise<void> => {
    await supabase.from('tree_data').delete().eq('id', 1);
  },
};
import type { Node, Edge, OnNodesChange, OnEdgesChange, Connection } from '@xyflow/react';

/* ═══════════════════════════════════════════
   Relation type used for connection mode
   ═══════════════════════════════════════════ */
export type RelationType = 'SPOUSE' | 'PARENT' | 'CHILD';

interface ConnectionMode {
  fromId: string;
  type: RelationType;
}

interface TreeState {
  /* Data */
  nodes: Node[];
  edges: Edge[];

  /* Selection & editing */
  selectedPersonId: string | null;
  editingPersonId: string | null; // opens bottom sheet

  /* Connection mode: user is picking a target card */
  connectionMode: ConnectionMode | null;

  /* Collapsed branches */
  collapsedNodes: Set<string>;

  /* Canvas background */
  backgroundImage: string | null;

  /* Actions */
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: (connection: Connection) => void;

  selectPerson: (id: string | null) => void;
  editPerson: (id: string | null) => void;
  startConnection: (mode: ConnectionMode) => void;
  cancelConnection: () => void;
  toggleCollapse: (id: string) => void;
  setBackgroundImage: (url: string | null) => void;
}

/* ─── Visibility helper for collapsed branches ─── */
const updateVisibility = (nodes: Node[], edges: Edge[], collapsed: Set<string>) => {
  const hiddenNodes = new Set<string>();

  const traverse = (nodeId: string) => {
    edges
      .filter(e => e.source === nodeId && e.target !== nodeId)
      .map(e => e.target)
      .forEach(childId => {
        if (!hiddenNodes.has(childId)) {
          hiddenNodes.add(childId);
          traverse(childId);
        }
      });
  };

  collapsed.forEach(id => traverse(id));

  return {
    nodes: nodes.map(n => ({ ...n, hidden: hiddenNodes.has(n.id) })),
    edges: edges.map(e => ({
      ...e,
      hidden: hiddenNodes.has(e.source) || hiddenNodes.has(e.target),
    })),
  };
};

export const useTreeStore = create<TreeState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedPersonId: null,
      editingPersonId: null,
      connectionMode: null,
      collapsedNodes: new Set(),
      backgroundImage: null,

      setNodes: (nodes) => {
        const { nodes: updated } = updateVisibility(nodes, get().edges, get().collapsedNodes);
        set({ nodes: updated });
      },

      setEdges: (edges) => {
        const { edges: updated } = updateVisibility(get().nodes, edges, get().collapsedNodes);
        set({ edges: updated });
      },

      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
      },

      onEdgesChange: (changes) => {
        // Block edge additions here — all new edges must go through validated handleConnect
        const filtered = changes.filter((c: any) => c.type !== 'add');
        if (filtered.length > 0) {
          set({ edges: applyEdgeChanges(filtered, get().edges) });
        }
      },

      // No-op: edge creation is handled by TreeCanvas.handleConnect with validation
      onConnect: () => {},

      selectPerson: (id) => set({ selectedPersonId: id }),
      editPerson: (id) => set({ editingPersonId: id }),

      startConnection: (mode) => set({ connectionMode: mode, selectedPersonId: null }),
      cancelConnection: () => set({ connectionMode: null }),

      toggleCollapse: (id) => {
        const { collapsedNodes, nodes, edges } = get();
        const next = new Set(collapsedNodes);
        next.has(id) ? next.delete(id) : next.add(id);
        const { nodes: un, edges: ue } = updateVisibility(nodes, edges, next);
        set({ collapsedNodes: next, nodes: un, edges: ue });
      },

      setBackgroundImage: (url) => set({ backgroundImage: url }),
    }),
    {
      name: 'familystory-tree',
      storage: createJSONStorage(() => supabaseStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        collapsedNodes: Array.from(state.collapsedNodes),
        backgroundImage: state.backgroundImage,
      }),
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        collapsedNodes: new Set(persisted?.collapsedNodes || []),
      }),
    },
  ),
);
