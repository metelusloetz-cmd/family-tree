import { Routes, Route, Navigate } from 'react-router-dom';
import { TreeCanvas } from './pages/TreeCanvas';
import { AuthGate } from './components/AuthGate';

export const App = () => (
  <AuthGate>
    <Routes>
      <Route path="/tree" element={<TreeCanvas />} />
      <Route path="/view/:shareCode" element={<div>Viewer — coming soon</div>} />
      <Route path="*" element={<Navigate to="/tree" replace />} />
    </Routes>
  </AuthGate>
);
