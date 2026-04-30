import type { Node, Edge } from '@xyflow/react';

/**
 * Smart tree auto-layout algorithm.
 *
 * Strategy:
 * 1. Find root nodes (no incoming 'top' edges)
 * 2. Build generation layers via BFS from roots
 * 3. Position spouse pairs side-by-side with family bridge between
 * 4. Center children under their parent(s)
 * 5. Reposition family bridges between spouses
 */

const CARD_W = 180;   // card width + gap
const CARD_H = 120;   // vertical spacing between generations
const SPOUSE_GAP = 40; // gap between spouse cards (bridge sits here)
const HORIZ_GAP = 30;  // horizontal gap between unrelated cards

interface LayoutContext {
  nodes: Node[];
  edges: Edge[];
  personNodes: Node[];
  familyNodes: Node[];
}

/* ─── Helpers ─── */

/** Get parent IDs (person nodes) of a child */
function getParentPersonIds(childId: string, ctx: LayoutContext): string[] {
  const parents: string[] = [];
  ctx.edges.forEach(e => {
    if (e.target !== childId || e.targetHandle !== 'top') return;
    const src = ctx.nodes.find(n => n.id === e.source);
    if (src?.type === 'person') parents.push(src.id);
    if (src?.type === 'family') {
      if (src.data.fromId) parents.push(src.data.fromId as string);
      if (src.data.toId) parents.push(src.data.toId as string);
    }
  });
  return [...new Set(parents)];
}

/** Get children IDs of a person (via direct edge or family bridge) */
function getChildrenIds(personId: string, ctx: LayoutContext): string[] {
  const children: string[] = [];

  // Direct bottom → top
  ctx.edges.forEach(e => {
    if (e.source === personId && e.sourceHandle === 'bottom') {
      const tgt = ctx.nodes.find(n => n.id === e.target && n.type === 'person');
      if (tgt) children.push(tgt.id);
    }
  });

  // Via family bridge
  ctx.familyNodes.forEach(fam => {
    if (fam.data.fromId !== personId && fam.data.toId !== personId) return;
    ctx.edges.forEach(e => {
      if (e.source === fam.id && e.sourceHandle === 'bottom') {
        const tgt = ctx.nodes.find(n => n.id === e.target && n.type === 'person');
        if (tgt) children.push(tgt.id);
      }
    });
  });

  return [...new Set(children)];
}

/** Get spouse ID via family bridge */
function getSpouseId(personId: string, ctx: LayoutContext): string | null {
  const bridge = ctx.familyNodes.find(n =>
    n.data.fromId === personId || n.data.toId === personId
  );
  if (!bridge) return null;
  return bridge.data.fromId === personId
    ? bridge.data.toId as string
    : bridge.data.fromId as string;
}

/** Get family bridge between two persons */
function getFamilyBridge(a: string, b: string, ctx: LayoutContext): Node | undefined {
  return ctx.familyNodes.find(n =>
    (n.data.fromId === a && n.data.toId === b) ||
    (n.data.fromId === b && n.data.toId === a)
  );
}

/* ─── Main layout function ─── */
export function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const personNodes = nodes.filter(n => n.type === 'person');
  const familyNodes = nodes.filter(n => n.type === 'family');

  if (personNodes.length === 0) return nodes;

  const ctx: LayoutContext = { nodes, edges, personNodes, familyNodes };

  // Step 1: Find root nodes (no parents)
  const roots = personNodes.filter(n =>
    getParentPersonIds(n.id, ctx).length === 0
  );

  // Step 2: Assign generations via BFS
  const generation = new Map<string, number>();
  const queue: { id: string; gen: number }[] = [];

  // Start roots at generation 0
  roots.forEach(r => {
    generation.set(r.id, 0);
    queue.push({ id: r.id, gen: 0 });
  });

  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    const children = getChildrenIds(id, ctx);
    children.forEach(childId => {
      const existing = generation.get(childId);
      const newGen = gen + 1;
      if (existing === undefined || newGen > existing) {
        generation.set(childId, newGen);
        queue.push({ id: childId, gen: newGen });
      }
    });
  }

  // Assign unconnected nodes to gen 0
  personNodes.forEach(n => {
    if (!generation.has(n.id)) generation.set(n.id, 0);
  });

  // Step 3: Group by generation
  const maxGen = Math.max(...generation.values());
  const layers: string[][] = [];
  for (let g = 0; g <= maxGen; g++) {
    layers.push(
      personNodes
        .filter(n => generation.get(n.id) === g)
        .map(n => n.id)
    );
  }

  // Step 4: Position nodes — handle spouse pairs as units
  const positioned = new Map<string, { x: number; y: number }>();
  const processed = new Set<string>();

  layers.forEach((layer, genIndex) => {
    const y = genIndex * CARD_H;
    let x = 0;

    // Group into: [spousePair | single]
    const units: { ids: string[]; width: number }[] = [];
    const layerProcessed = new Set<string>();

    layer.forEach(id => {
      if (layerProcessed.has(id)) return;
      layerProcessed.add(id);

      const spouseId = getSpouseId(id, ctx);
      if (spouseId && generation.get(spouseId) === genIndex && !layerProcessed.has(spouseId)) {
        layerProcessed.add(spouseId);
        units.push({ ids: [id, spouseId], width: CARD_W * 2 + SPOUSE_GAP });
      } else {
        units.push({ ids: [id], width: CARD_W });
      }
    });

    // Center children under parents
    units.forEach(unit => {
      // Try to center under children or parents
      let centerX: number | null = null;

      // If this unit has children already positioned, center above them
      const allChildren: string[] = [];
      unit.ids.forEach(id => {
        getChildrenIds(id, ctx).forEach(c => {
          if (positioned.has(c)) allChildren.push(c);
        });
      });

      if (allChildren.length > 0) {
        const childXs = allChildren.map(c => positioned.get(c)!.x);
        centerX = (Math.min(...childXs) + Math.max(...childXs) + CARD_W) / 2;
      }

      // If children not positioned, try centering under parents
      if (centerX === null) {
        const allParents: string[] = [];
        unit.ids.forEach(id => {
          getParentPersonIds(id, ctx).forEach(p => {
            if (positioned.has(p)) allParents.push(p);
          });
        });

        if (allParents.length > 0) {
          const parentXs = allParents.map(p => positioned.get(p)!.x);
          centerX = (Math.min(...parentXs) + Math.max(...parentXs) + CARD_W) / 2;
        }
      }

      // Fallback: sequential positioning
      if (centerX === null) {
        centerX = x + unit.width / 2;
      }

      const startX = centerX - unit.width / 2;

      if (unit.ids.length === 2) {
        positioned.set(unit.ids[0], { x: startX, y });
        positioned.set(unit.ids[1], { x: startX + CARD_W + SPOUSE_GAP, y });
      } else {
        positioned.set(unit.ids[0], { x: startX, y });
      }

      x = startX + unit.width + HORIZ_GAP;
    });
  });

  // Step 5: Resolve overlaps within each generation
  layers.forEach((layer) => {
    const sorted = layer
      .filter(id => positioned.has(id))
      .sort((a, b) => positioned.get(a)!.x - positioned.get(b)!.x);

    for (let i = 1; i < sorted.length; i++) {
      const prev = positioned.get(sorted[i - 1])!;
      const curr = positioned.get(sorted[i])!;
      const minX = prev.x + CARD_W + HORIZ_GAP;
      if (curr.x < minX) {
        curr.x = minX;
      }
    }
  });

  // Step 6: Center the entire tree at origin
  const allX = [...positioned.values()].map(p => p.x);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const offsetX = -(minX + maxX) / 2;

  positioned.forEach(pos => { pos.x += offsetX; });

  // Step 7: Apply positions
  return nodes.map(node => {
    if (node.type === 'person' && positioned.has(node.id)) {
      return { ...node, position: positioned.get(node.id)! };
    }

    // Reposition family bridges between their spouses
    if (node.type === 'family') {
      const fromPos = positioned.get(node.data.fromId as string);
      const toPos = positioned.get(node.data.toId as string);
      if (fromPos && toPos) {
        return {
          ...node,
          position: {
            x: (fromPos.x + toPos.x + CARD_W) / 2,
            y: (fromPos.y + toPos.y) / 2,
          },
        };
      }
    }

    return node;
  });
}
