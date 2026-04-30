import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

/**
 * FamilyBridge — small marriage node between spouses.
 * Serves as the hub connecting two spouses and their children.
 *
 * Handles:
 *  - left/right: connect to spouses
 *  - bottom: connect to children
 */
export const FamilyBridge = memo(({ selected }: any) => (
  <div style={{
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: selected ? 'var(--color-primary)' : 'var(--color-border)',
    border: `2px solid ${selected ? 'var(--color-primary-light)' : '#fff'}`,
    boxShadow: 'var(--shadow-sm)',
    transition: 'background 0.2s, border-color 0.2s',
    position: 'relative',
  }}>
    <Handle type="target" position={Position.Left} id="left"
      style={{ width: 6, height: 6, background: 'transparent', border: 'none', left: -3, top: 1 }} />
    <Handle type="target" position={Position.Right} id="right"
      style={{ width: 6, height: 6, background: 'transparent', border: 'none', right: -3, top: 1 }} />
    <Handle type="source" position={Position.Bottom} id="bottom"
      style={{ width: 6, height: 6, background: 'transparent', border: 'none', bottom: -3 }} />
    {/* Target from top — in case someone drags child to family node */}
    <Handle type="target" position={Position.Top} id="top"
      style={{ width: 6, height: 6, background: 'transparent', border: 'none', top: -3 }} />
  </div>
));
