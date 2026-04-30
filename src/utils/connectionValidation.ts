import type { Node, Edge } from '@xyflow/react';

/**
 * Connection validation for genealogical tree.
 * Enforces classical family model constraints.
 *
 * Rules:
 *  1. No self-connections
 *  2. No duplicate edges between same pair
 *  3. SPOUSE: max 1 spouse per person
 *  4. SPOUSE: no same-gender marriages
 *  5. SPOUSE: can't marry ancestor/descendant (incest)
 *  6. SPOUSE: can't marry sibling (up to 3rd cousins — simplified to direct siblings for now)
 *  7. PARENT: max 2 parents per child
 *  8. PARENT: no cycles (can't be your own ancestor)
 *  9. PARENT: parent can't be younger than child (if dates available)
 */

/* ─── Helper: get all family bridge nodes a person is connected to as spouse ─── */
function getSpouseBridges(personId: string, nodes: Node[], edges: Edge[]): Node[] {
  return nodes.filter(n =>
    n.type === 'family' &&
    (n.data.fromId === personId || n.data.toId === personId)
  );
}

/* ─── Helper: get spouse id if person has one ─── */
function getSpouseId(personId: string, nodes: Node[]): string | null {
  const bridge = nodes.find(n =>
    n.type === 'family' &&
    (n.data.fromId === personId || n.data.toId === personId)
  );
  if (!bridge) return null;
  return bridge.data.fromId === personId
    ? bridge.data.toId as string
    : bridge.data.fromId as string;
}

/* ─── Helper: get all parent IDs of a person ─── */
function getParentIds(personId: string, nodes: Node[], edges: Edge[]): string[] {
  const parents: string[] = [];

  // Direct parent → child edges (source.bottom → target.top)
  edges.forEach(e => {
    if (e.target === personId && e.targetHandle === 'top') {
      const sourceNode = nodes.find(n => n.id === e.source);
      if (sourceNode?.type === 'person') {
        parents.push(e.source);
      }
      // If source is a family bridge, both spouses are parents
      if (sourceNode?.type === 'family') {
        if (sourceNode.data.fromId) parents.push(sourceNode.data.fromId as string);
        if (sourceNode.data.toId) parents.push(sourceNode.data.toId as string);
      }
    }
  });

  return [...new Set(parents)];
}

/* ─── Helper: get all children IDs of a person ─── */
function getChildrenIds(personId: string, nodes: Node[], edges: Edge[]): string[] {
  const children: string[] = [];

  // Direct edges from person bottom to child top
  edges.forEach(e => {
    if (e.source === personId && e.sourceHandle === 'bottom') {
      const targetNode = nodes.find(n => n.id === e.target);
      if (targetNode?.type === 'person') children.push(e.target);
    }
  });

  // Children via family bridge
  const bridges = getSpouseBridges(personId, nodes, edges);
  bridges.forEach(bridge => {
    edges.forEach(e => {
      if (e.source === bridge.id && e.sourceHandle === 'bottom') {
        const targetNode = nodes.find(n => n.id === e.target);
        if (targetNode?.type === 'person') children.push(e.target);
      }
    });
  });

  return [...new Set(children)];
}

/* ─── Helper: get all ancestors (recursive) ─── */
function getAllAncestors(personId: string, nodes: Node[], edges: Edge[], visited = new Set<string>()): Set<string> {
  if (visited.has(personId)) return visited;
  visited.add(personId);

  const parents = getParentIds(personId, nodes, edges);
  parents.forEach(pid => {
    getAllAncestors(pid, nodes, edges, visited);
  });

  return visited;
}

/* ─── Helper: get all descendants (recursive) ─── */
function getAllDescendants(personId: string, nodes: Node[], edges: Edge[], visited = new Set<string>()): Set<string> {
  if (visited.has(personId)) return visited;
  visited.add(personId);

  const children = getChildrenIds(personId, nodes, edges);
  children.forEach(cid => {
    getAllDescendants(cid, nodes, edges, visited);
  });

  return visited;
}

/* ─── Helper: get siblings ─── */
function getSiblingIds(personId: string, nodes: Node[], edges: Edge[]): string[] {
  const parents = getParentIds(personId, nodes, edges);
  const siblings = new Set<string>();

  parents.forEach(pid => {
    const children = getChildrenIds(pid, nodes, edges);
    children.forEach(cid => {
      if (cid !== personId) siblings.add(cid);
    });
  });

  return [...siblings];
}

/* ─── Helper: extract year from date string ─── */
function extractYear(dateStr: unknown): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const m = dateStr.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

/* ═══════════════════════════════════════════
   Main validation: SPOUSE connection
   ═══════════════════════════════════════════ */
export function validateSpouseConnection(
  sourceId: string,
  targetId: string,
  nodes: Node[],
  edges: Edge[],
): { valid: boolean; error?: string } {
  // 1. Self-connection
  if (sourceId === targetId) {
    return { valid: false, error: 'Нельзя связать с самим собой' };
  }

  const sourceNode = nodes.find(n => n.id === sourceId);
  const targetNode = nodes.find(n => n.id === targetId);
  if (!sourceNode || !targetNode) {
    return { valid: false, error: 'Персона не найдена' };
  }

  // 2. Same gender
  if (sourceNode.data.gender === targetNode.data.gender) {
    return { valid: false, error: 'Однополые браки не поддерживаются' };
  }

  // 3. Source already has a spouse
  const sourceSpouse = getSpouseId(sourceId, nodes);
  if (sourceSpouse) {
    return { valid: false, error: `Уже есть супруг(а)` };
  }

  // 4. Target already has a spouse
  const targetSpouse = getSpouseId(targetId, nodes);
  if (targetSpouse) {
    return { valid: false, error: `Уже есть супруг(а)` };
  }

  // 5. Can't marry ancestor or descendant
  const ancestors = getAllAncestors(sourceId, nodes, edges);
  if (ancestors.has(targetId)) {
    return { valid: false, error: 'Нельзя вступить в брак с предком' };
  }
  const descendants = getAllDescendants(sourceId, nodes, edges);
  if (descendants.has(targetId)) {
    return { valid: false, error: 'Нельзя вступить в брак с потомком' };
  }

  // 6. Can't marry sibling
  const siblings = getSiblingIds(sourceId, nodes, edges);
  if (siblings.includes(targetId)) {
    return { valid: false, error: 'Нельзя вступить в брак с братом/сестрой' };
  }

  return { valid: true };
}

/* ═══════════════════════════════════════════
   Main validation: PARENT-CHILD connection
   source (parent) → target (child)
   ═══════════════════════════════════════════ */
export function validateParentChildConnection(
  parentId: string,
  childId: string,
  nodes: Node[],
  edges: Edge[],
): { valid: boolean; error?: string } {
  // 1. Self-connection
  if (parentId === childId) {
    return { valid: false, error: 'Нельзя быть родителем самому себе' };
  }

  const parentNode = nodes.find(n => n.id === parentId);
  const childNode = nodes.find(n => n.id === childId);
  if (!parentNode || !childNode) {
    return { valid: false, error: 'Персона не найдена' };
  }

  // 2. Child already has 2 parents
  const existingParents = getParentIds(childId, nodes, edges);
  if (existingParents.length >= 2) {
    return { valid: false, error: 'У ребёнка уже есть 2 родителя' };
  }

  // 3. Duplicate: this parent already connected to this child
  if (existingParents.includes(parentId)) {
    return { valid: false, error: 'Эта связь уже существует' };
  }

  // 4. No cycles: child can't be an ancestor of parent
  const parentAncestors = getAllAncestors(parentId, nodes, edges);
  if (parentAncestors.has(childId)) {
    return { valid: false, error: 'Циклическая связь: ребёнок является предком родителя' };
  }

  // 5. Parent can't be younger than child
  const parentBirth = extractYear(parentNode.data.birthDate);
  const childBirth = extractYear(childNode.data.birthDate);
  if (parentBirth && childBirth && parentBirth >= childBirth) {
    return { valid: false, error: `Родитель (${parentBirth}) не может быть моложе ребёнка (${childBirth})` };
  }

  // 6. Age difference check: parent should be at least 12 years older
  if (parentBirth && childBirth && (childBirth - parentBirth) < 12) {
    return { valid: false, error: `Разница в возрасте слишком мала (${childBirth - parentBirth} лет)` };
  }

  return { valid: true };
}

/* ═══════════════════════════════════════════
   Generic connection validation
   ═══════════════════════════════════════════ */
export function validateConnection(
  sourceId: string,
  targetId: string,
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined,
  nodes: Node[],
  edges: Edge[],
): { valid: boolean; error?: string; type: 'spouse' | 'parent' | 'generic' } {

  const isSpouse =
    (sourceHandle === 'left' || sourceHandle === 'right') &&
    (targetHandle === 'left-target' || targetHandle === 'right-target' ||
     targetHandle === 'left' || targetHandle === 'right');

  const isParentChild =
    sourceHandle === 'bottom' && targetHandle === 'top';

  if (isSpouse) {
    const result = validateSpouseConnection(sourceId, targetId, nodes, edges);
    return { ...result, type: 'spouse' };
  }

  if (isParentChild) {
    const result = validateParentChildConnection(sourceId, targetId, nodes, edges);
    return { ...result, type: 'parent' };
  }

  // Generic: just check for self and duplicates
  if (sourceId === targetId) {
    return { valid: false, error: 'Нельзя связать с самим собой', type: 'generic' };
  }

  const duplicate = edges.some(e =>
    (e.source === sourceId && e.target === targetId) ||
    (e.source === targetId && e.target === sourceId)
  );
  if (duplicate) {
    return { valid: false, error: 'Связь уже существует', type: 'generic' };
  }

  return { valid: true, type: 'generic' };
}
