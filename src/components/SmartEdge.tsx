import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useTreeStore } from '../store/useTreeStore';

/**
 * SmartEdge — thin, elegant edge with hover-reveal delete button.
 * Properly handles family node cleanup when spouse edges are deleted.
 */
export const SmartEdge = ({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  source, target,
  style, markerEnd,
}: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const { edges, setEdges, nodes, setNodes } = useTreeStore();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if this edge connects to a family (marriage) node
    const sourceNode = nodes.find(n => n.id === source);
    const targetNode = nodes.find(n => n.id === target);
    const familyNode = sourceNode?.type === 'family' ? sourceNode
                     : targetNode?.type === 'family' ? targetNode
                     : null;

    if (familyNode) {
      const famId = familyNode.id;
      // Remove ALL edges connected to this family node + the family node itself
      setEdges(edges.filter(e =>
        e.source !== famId && e.target !== famId
      ));
      setNodes(nodes.filter(n => n.id !== famId));
    } else {
      // Simple edge — just remove it
      setEdges(edges.filter(e => e.id !== id));
    }
  };

  const baseWidth = style?.strokeWidth || 1;

  return (
    <>
      {/* Invisible wider path for easier touch/hover targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: isHovered ? baseWidth + 0.5 : baseWidth,
          transition: 'stroke-width 0.15s ease',
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={() => setIsHovered(true)}
        >
          <button
            onClick={handleDelete}
            style={{
              width: 22,
              height: 22,
              background: 'var(--color-error)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)',
            }}
            title="Удалить связь"
          >
            <X size={12} strokeWidth={3} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
