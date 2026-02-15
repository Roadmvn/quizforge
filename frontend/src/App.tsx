import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import QuizEditor from './pages/QuizEditor';
import SessionControl from './pages/SessionControl';
import SessionAnalytics from './pages/SessionAnalytics';
import Join from './pages/Join';
import Play from './pages/Play';

function App() {
  const { user, loading, login, register, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Participant routes (no auth) */}
        <Route path="/join" element={<Join />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/play/:sid" element={<Play />} />

        {/* Admin routes (auth required) */}
        {user ? (
          <>
            <Route path="/dashboard" element={<Dashboard user={user} onLogout={logout} />} />
            <Route path="/quiz/new" element={<QuizEditor />} />
            <Route path="/quiz/:id/edit" element={<QuizEditor />} />
            <Route path="/session/:sid" element={<SessionControl />} />
            <Route path="/session/:sid/analytics" element={<SessionAnalytics />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        ) : (
          <>
            <Route path="/login" element={<Login onLogin={login} onRegister={register} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
