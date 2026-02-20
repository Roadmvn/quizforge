import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { User } from '../lib/types';

interface Props {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function Layout({ user, onLogout, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'text-white bg-[rgba(124,92,252,0.12)] nav-active-bar'
        : 'text-[#8888a0] hover:text-white hover:bg-[rgba(255,255,255,0.04)]'
    } ${collapsed ? 'justify-center' : ''}`;

  return (
    <div className="min-h-screen bg-[#06060e] text-[#e8e8f0] flex">
      {/* Animated background layers */}
      <div className="mesh-gradient" />
      <div className="mesh-gradient-extra" />
      <div className="grid-pattern fixed inset-0 z-0 pointer-events-none" />
      <div className="noise" />
      <div className="scan-overlay" />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full ${collapsed ? 'w-[68px]' : 'w-[260px]'} flex flex-col transition-all duration-300 ease-in-out md:translate-x-0 md:static md:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, rgba(15,15,35,0.95) 0%, rgba(6,6,14,0.98) 100%)',
          borderRight: '1px solid rgba(124, 92, 252, 0.08)',
          boxShadow: '4px 0 30px rgba(0,0,0,0.3)',
        }}
      >
        {/* Accent line at top */}
        <div className="sidebar-accent-line" />

        {/* Toggle button (desktop) */}
        <button
          onClick={toggleCollapsed}
          className="hidden md:flex absolute -right-3 top-20 w-6 h-6 rounded-full items-center justify-center text-[#8888a0] hover:text-white transition-all z-10"
          style={{
            background: 'rgba(15,15,35,0.9)',
            border: '1px solid rgba(124,92,252,0.15)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          }}
          aria-label={collapsed ? 'Deplier la barre laterale' : 'Replier la barre laterale'}
        >
          <svg
            className={`w-3 h-3 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Logo */}
        <div className={`${collapsed ? 'px-3' : 'px-5'} pt-7 pb-6`}>
          <NavLink
            to="/dashboard"
            className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
                boxShadow: '0 0 20px rgba(124,92,252,0.35), 0 4px 12px rgba(124,92,252,0.2)',
                animation: 'logoBreathe 4s ease-in-out infinite',
              }}
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            {!collapsed && (
              <div>
                <span className="text-xl font-bold tracking-tight">
                  <span className="text-[#7c5cfc]">Quiz</span>
                  <span className="text-white">Forge</span>
                </span>
                <p className="text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] mt-0.5">Cyber Security</p>
              </div>
            )}
          </NavLink>
        </div>

        {/* Separator */}
        <div className={`${collapsed ? 'mx-3' : 'mx-5'} h-px bg-gradient-to-r from-transparent via-[rgba(124,92,252,0.15)] to-transparent mb-4`} />

        {/* Navigation label */}
        <div className={`${collapsed ? 'px-3' : 'px-5'} mb-2`}>
          {!collapsed && (
            <span className="text-[9px] font-bold text-[#4a4a64] uppercase tracking-[0.2em]">Navigation</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          <NavLink to="/dashboard" end className={navLinkClass} onClick={() => setSidebarOpen(false)}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            {!collapsed && 'Tableau de bord'}
          </NavLink>

          {user.role === 'admin' && (
            <NavLink to="/admin" className={navLinkClass} onClick={() => setSidebarOpen(false)}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {!collapsed && 'Administration'}
            </NavLink>
          )}
        </nav>

        {/* User section */}
        <div className="px-3 py-5">
          <div className={`${collapsed ? 'mx-0' : 'mx-2'} h-px bg-gradient-to-r from-transparent via-[rgba(124,92,252,0.12)] to-transparent mb-4`} />
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-2'} mb-3`}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
                boxShadow: '0 0 15px rgba(124,92,252,0.3)',
              }}
            >
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user.display_name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] status-dot-online" />
                  <p className="text-[10px] text-[#8888a0] uppercase tracking-wider font-medium">{user.role}</p>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-[#8888a0] hover:text-[#f87171] rounded-lg transition-all duration-200 hover:bg-[rgba(248,113,113,0.06)] ${collapsed ? 'justify-center' : ''}`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!collapsed && 'Deconnexion'}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 relative z-10">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(6,6,14,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(124,92,252,0.08)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-[#8888a0] hover:text-white rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-all duration-200"
            aria-label="Ouvrir le menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)' }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold">
              <span className="text-[#7c5cfc]">Quiz</span>
              <span className="text-white">Forge</span>
            </span>
          </NavLink>
          <div className="w-9" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
