import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const QuizEditor = lazy(() => import('./pages/QuizEditor'));
const SessionControl = lazy(() => import('./pages/SessionControl'));
const SessionAnalytics = lazy(() => import('./pages/SessionAnalytics'));
const Join = lazy(() => import('./pages/Join'));
const Play = lazy(() => import('./pages/Play'));

function App() {
  const { user, loading, login, register, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <Routes>
          {/* Participant routes (no auth) */}
          <Route path="/join" element={<Join />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="/play/:sid" element={<Play />} />

          {/* Authenticated routes with sidebar layout */}
          {user ? (
            <>
              <Route path="/dashboard" element={<Layout user={user} onLogout={logout}><Dashboard /></Layout>} />
              <Route
                path="/admin"
                element={
                  user.role === 'admin'
                    ? <Layout user={user} onLogout={logout}><AdminPanel /></Layout>
                    : <Navigate to="/dashboard" replace />
                }
              />
              <Route path="/quiz/new" element={<Layout user={user} onLogout={logout}><QuizEditor /></Layout>} />
              <Route path="/quiz/:id/edit" element={<Layout user={user} onLogout={logout}><QuizEditor /></Layout>} />
              <Route path="/session/:sid" element={<Layout user={user} onLogout={logout}><SessionControl /></Layout>} />
              <Route path="/session/:sid/analytics" element={<Layout user={user} onLogout={logout}><SessionAnalytics /></Layout>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          ) : (
            <>
              <Route path="/login" element={<Login onLogin={login} onRegister={register} />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          )}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
