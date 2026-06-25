import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './stores/app';
import Layout from './components/Layout';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import SkillsPage from './pages/SkillsPage';
import WorkflowsPage from './pages/WorkflowsPage';

export default function App() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
