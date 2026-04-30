import { Routes, Route, Navigate } from 'react-router-dom';
import { TreeCanvas } from './pages/TreeCanvas';

export const App = () => (
  <Routes>
    {/* Main tree editor — single tree, no auth for now */}
    <Route path="/tree" element={<TreeCanvas />} />
    {/* Read-only viewer for QR codes (Phase 8) */}
    <Route path="/view/:shareCode" element={<div>Viewer — coming soon</div>} />
    {/* Default redirect */}
    <Route path="*" element={<Navigate to="/tree" replace />} />
  </Routes>
);
