import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { AdminDashboard, AdminUser, AdminQuizItem, AdminSessionItem } from '../lib/types';

type Tab = 'overview' | 'users' | 'quizzes' | 'sessions';

const glassCard = {
  background: 'rgba(15, 15, 35, 0.6)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(124, 92, 252, 0.08)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
};

const inputStyle = "w-full px-4 py-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl text-white placeholder-[#4a4a64] focus:outline-none focus:border-[rgba(124,92,252,0.5)] focus:bg-[rgba(255,255,255,0.06)] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.12),0_0_20px_rgba(124,92,252,0.08)] transition-all duration-300 text-sm";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [quizzes, setQuizzes] = useState<AdminQuizItem[]>([]);
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', display_name: '', role: 'user' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'overview') {
      api.get<AdminDashboard>('/admin/dashboard')
        .then(setDashboard)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else if (activeTab === 'users') {
      api.get<AdminUser[]>('/admin/users')
        .then(setUsers)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else if (activeTab === 'quizzes') {
      api.get<AdminQuizItem[]>('/admin/quizzes')
        .then(setQuizzes)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else if (activeTab === 'sessions') {
      api.get<AdminSessionItem[]>('/admin/sessions')
        .then(setSessions)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [activeTab]);

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec du changement de role');
    }
  };

  const toggleStatus = async (userId: string, currentActive: boolean) => {
    try {
      const updated = await api.patch<AdminUser>(`/admin/users/${userId}/status`, { is_active: !currentActive });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: updated.is_active } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec du changement de statut');
    }
  };

  const resetPassword = async (userId: string) => {
    const newPassword = window.prompt('Nouveau mot de passe (min. 8 caracteres) :');
    if (!newPassword) return;
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres');
      return;
    }
    try {
      await api.patch(`/admin/users/${userId}/password`, { password: newPassword });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec de la reinitialisation');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Supprimer cet utilisateur ? Cette action est irreversible.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec de la suppression');
    }
  };

  const createUser = async () => {
    setCreating(true);
    try {
      const created = await api.post<AdminUser>('/admin/users', newUser);
      setUsers((prev) => [created, ...prev]);
      setNewUser({ email: '', password: '', display_name: '', role: 'user' });
      setShowCreateForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec de la creation');
    } finally {
      setCreating(false);
    }
  };

  const tabConfig: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'overview',
      label: 'Vue d\'ensemble',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
    },
    {
      key: 'users',
      label: 'Utilisateurs',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    },
    {
      key: 'quizzes',
      label: 'Quiz',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>,
    },
    {
      key: 'sessions',
      label: 'Sessions',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
    },
  ];

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; dot: string; glow: string }> = {
      lobby: { bg: 'rgba(251,191,36,0.06)', text: '#fbbf24', dot: '#fbbf24', glow: 'rgba(251,191,36,0.4)' },
      active: { bg: 'rgba(52,211,153,0.06)', text: '#34d399', dot: '#34d399', glow: 'rgba(52,211,153,0.4)' },
      revealing: { bg: 'rgba(96,165,250,0.06)', text: '#60a5fa', dot: '#60a5fa', glow: 'rgba(96,165,250,0.4)' },
      finished: { bg: 'rgba(107,107,128,0.06)', text: '#8888a0', dot: '#6b6b80', glow: 'rgba(107,107,128,0.3)' },
    };
    const labels: Record<string, string> = {
      lobby: 'En attente',
      active: 'En cours',
      revealing: 'Revelation',
      finished: 'Terminee',
    };
    const s = map[status] || map.finished;
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
        style={{ background: s.bg, color: s.text, border: `1px solid ${s.bg.replace('0.06', '0.15')}` }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot, boxShadow: `0 0 6px ${s.glow}` }} />
        {labels[status] || status}
      </span>
    );
  };

  const statCards = dashboard ? [
    { label: 'Utilisateurs', value: dashboard.total_users, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>, grad: 'linear-gradient(135deg, #7c5cfc, #a855f7)', glow: 'rgba(124,92,252,0.3)' },
    { label: 'Quiz', value: dashboard.total_quizzes, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>, grad: 'linear-gradient(135deg, #60a5fa, #818cf8)', glow: 'rgba(96,165,250,0.3)' },
    { label: 'Sessions', value: dashboard.total_sessions, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>, grad: 'linear-gradient(135deg, #fbbf24, #f59e0b)', glow: 'rgba(251,191,36,0.3)' },
    { label: 'Sessions actives', value: dashboard.active_sessions, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>, grad: 'linear-gradient(135deg, #34d399, #10b981)', glow: 'rgba(52,211,153,0.3)' },
  ] : [];

  return (
    <div className="animate-in">
      {/* Premium header */}
      <div
        className="rounded-2xl mb-8 p-6 flex items-center justify-between"
        style={{
          ...glassCard,
          borderColor: 'rgba(124, 92, 252, 0.1)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
              boxShadow: '0 0 25px rgba(124,92,252,0.35), 0 4px 15px rgba(124,92,252,0.25)',
            }}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Administration</h1>
            <p className="text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-medium mt-0.5">Panneau de controle</p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.5)', animation: 'glowPulse 2s ease-in-out infinite' }} />
          <span className="text-xs font-semibold text-[#34d399]">Systeme actif</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="rounded-xl p-4 mb-6 flex items-center justify-between animate-in"
          style={{
            background: 'rgba(248,113,113,0.06)',
            border: '1px solid rgba(248,113,113,0.2)',
            boxShadow: '0 0 30px rgba(248,113,113,0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
              <svg className="w-4 h-4 text-[#f87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <span className="text-sm text-[#f87171]">{error}</span>
          </div>
          <button onClick={() => setError('')} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tab navigation */}
      <div
        className="rounded-2xl mb-8 p-1.5 flex gap-1"
        style={{
          background: 'rgba(15, 15, 35, 0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {tabConfig.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="relative flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2"
            style={
              activeTab === tab.key
                ? {
                    background: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(168,85,247,0.1))',
                    color: '#fff',
                    border: '1px solid rgba(124,92,252,0.2)',
                    boxShadow: '0 0 20px rgba(124,92,252,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                  }
                : {
                    background: 'transparent',
                    color: '#6b6b80',
                    border: '1px solid transparent',
                  }
            }
            onMouseOver={(e) => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.color = '#e8e8f0';
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }
            }}
            onMouseOut={(e) => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.color = '#6b6b80';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <span style={{ opacity: activeTab === tab.key ? 1 : 0.5 }}>{tab.icon}</span>
            {tab.label}
            {activeTab === tab.key && (
              <div
                className="absolute -bottom-1.5 left-1/2 w-8 h-0.5 rounded-full -translate-x-1/2"
                style={{ background: 'linear-gradient(90deg, #7c5cfc, #a855f7)', boxShadow: '0 0 10px rgba(124,92,252,0.5)' }}
              />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="spinner-premium w-10 h-10" />
          <p className="text-[#8888a0] text-sm animate-pulse">Chargement des donnees...</p>
        </div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && dashboard && (
            <div className="space-y-8">
              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {statCards.map((card, i) => (
                  <div
                    key={card.label}
                    className="rounded-2xl p-5 glow-card transition-all duration-300"
                    style={{
                      ...glassCard,
                      animationDelay: `${i * 0.08}s`,
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = `0 12px 50px rgba(0,0,0,0.3), 0 0 30px ${card.glow}`;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)';
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
                        style={{ background: card.grad, boxShadow: `0 0 20px ${card.glow}, 0 4px 10px ${card.glow}` }}
                      >
                        {card.icon}
                      </div>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <svg className="w-3.5 h-3.5 text-[#4a4a64]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-4xl font-extrabold text-white tracking-tight">{card.value}</p>
                    <p className="text-xs text-[#8888a0] mt-1.5 font-medium uppercase tracking-[0.15em]">{card.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent users */}
                <div className="rounded-2xl overflow-hidden glow-card" style={glassCard}>
                  <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(124,92,252,0.08)', background: 'rgba(124,92,252,0.02)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(124,92,252,0.12)', border: '1px solid rgba(124,92,252,0.15)' }}
                      >
                        <svg className="w-4 h-4 text-[#7c5cfc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-white uppercase tracking-[0.1em]">Derniers utilisateurs</span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                      style={{ background: 'rgba(124,92,252,0.1)', color: '#7c5cfc', border: '1px solid rgba(124,92,252,0.15)' }}
                    >
                      {dashboard.recent_users.length}
                    </span>
                  </div>
                  <div className="p-4 space-y-1">
                    {dashboard.recent_users.length === 0 && (
                      <p className="text-sm text-[#4a4a64] text-center py-6">Aucun utilisateur</p>
                    )}
                    {dashboard.recent_users.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200"
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.04)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                            style={{
                              background: 'linear-gradient(135deg, rgba(124,92,252,0.2), rgba(168,85,247,0.15))',
                              border: '1px solid rgba(124,92,252,0.15)',
                              color: '#a78bfa',
                            }}
                          >
                            {u.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{u.display_name}</p>
                            <p className="text-xs text-[#6b6b80]">{u.email}</p>
                          </div>
                        </div>
                        <span className="text-[11px] text-[#4a4a64] font-medium">{formatDate(u.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent sessions */}
                <div className="rounded-2xl overflow-hidden glow-card" style={glassCard}>
                  <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(124,92,252,0.08)', background: 'rgba(124,92,252,0.02)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.15)' }}
                      >
                        <svg className="w-4 h-4 text-[#fbbf24]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-white uppercase tracking-[0.1em]">Dernieres sessions</span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                      style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.15)' }}
                    >
                      {dashboard.recent_sessions.length}
                    </span>
                  </div>
                  <div className="p-4 space-y-1">
                    {dashboard.recent_sessions.length === 0 && (
                      <p className="text-sm text-[#4a4a64] text-center py-6">Aucune session</p>
                    )}
                    {dashboard.recent_sessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200"
                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.04)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="font-mono text-sm font-bold px-2.5 py-1 rounded-lg"
                            style={{ background: 'rgba(124,92,252,0.1)', color: '#a78bfa', border: '1px solid rgba(124,92,252,0.15)' }}
                          >
                            {s.code}
                          </span>
                          <span className="text-sm font-medium text-white">{s.quiz_title}</span>
                          {statusBadge(s.status)}
                        </div>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                          style={{ background: 'rgba(255,255,255,0.03)', color: '#8888a0' }}
                        >
                          {s.participant_count} joueurs
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-white">Utilisateurs</h2>
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(124,92,252,0.1)', color: '#7c5cfc', border: '1px solid rgba(124,92,252,0.15)' }}
                  >
                    {users.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowCreateForm((v) => !v)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 btn-glow"
                  style={{
                    background: showCreateForm
                      ? 'rgba(248,113,113,0.15)'
                      : 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
                    boxShadow: showCreateForm
                      ? 'none'
                      : '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)',
                    border: showCreateForm ? '1px solid rgba(248,113,113,0.2)' : 'none',
                    color: showCreateForm ? '#f87171' : '#fff',
                  }}
                  onMouseOver={(e) => {
                    if (!showCreateForm) {
                      e.currentTarget.style.boxShadow = '0 0 40px rgba(124,92,252,0.4), 0 6px 20px rgba(124,92,252,0.3)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!showCreateForm) {
                      e.currentTarget.style.boxShadow = '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {showCreateForm ? 'Annuler' : '+ Ajouter'}
                </button>
              </div>

              {showCreateForm && (
                <div className="rounded-2xl overflow-hidden animate-in" style={glassCard}>
                  <div
                    className="px-6 py-4 flex items-center gap-3"
                    style={{ borderBottom: '1px solid rgba(124,92,252,0.08)', background: 'rgba(124,92,252,0.02)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.15)' }}
                    >
                      <svg className="w-4 h-4 text-[#34d399]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-white">Nouvel utilisateur</span>
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); createUser(); }} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-[#8888a0] mb-2 uppercase tracking-[0.15em]">Email</label>
                      <input type="email" required value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} className={inputStyle} placeholder="utilisateur@example.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#8888a0] mb-2 uppercase tracking-[0.15em]">Mot de passe</label>
                      <input type="password" required minLength={8} value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} className={inputStyle} placeholder="Min. 8 caracteres" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#8888a0] mb-2 uppercase tracking-[0.15em]">Nom d'affichage</label>
                      <input type="text" required value={newUser.display_name} onChange={(e) => setNewUser((p) => ({ ...p, display_name: e.target.value }))} className={inputStyle} placeholder="Jean Dupont" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#8888a0] mb-2 uppercase tracking-[0.15em]">Role</label>
                      <select value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))} className={inputStyle}>
                        <option value="user">Utilisateur</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={creating}
                        className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: 'linear-gradient(135deg, #34d399, #10b981)',
                          boxShadow: '0 0 20px rgba(52,211,153,0.25), 0 4px 12px rgba(52,211,153,0.2)',
                        }}
                        onMouseOver={(e) => { if (!creating) { e.currentTarget.style.boxShadow = '0 0 35px rgba(52,211,153,0.4), 0 6px 18px rgba(52,211,153,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}}
                        onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(52,211,153,0.25), 0 4px 12px rgba(52,211,153,0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        {creating ? (
                          <span className="flex items-center gap-2"><div className="spinner-premium w-4 h-4" />Creation...</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                            Creer l'utilisateur
                          </span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Users table */}
              <div className="rounded-2xl overflow-hidden glow-card" style={glassCard}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr style={{ background: 'rgba(124,92,252,0.03)', borderBottom: '1px solid rgba(124,92,252,0.08)' }}>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Nom</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Email</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Role</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Statut</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Inscription</th>
                        <th className="text-right px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          className="transition-all duration-200"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.03)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(124,92,252,0.2), rgba(168,85,247,0.15))',
                                  border: '1px solid rgba(124,92,252,0.15)',
                                  color: '#a78bfa',
                                }}
                              >
                                {u.display_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-white">{u.display_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[#8888a0]">{u.email}</td>
                          <td className="px-6 py-4">
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                              style={u.role === 'admin'
                                ? { background: 'rgba(124,92,252,0.08)', color: '#a78bfa', border: '1px solid rgba(124,92,252,0.15)' }
                                : { background: 'rgba(107,107,128,0.06)', color: '#8888a0', border: '1px solid rgba(107,107,128,0.1)' }
                              }
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: u.role === 'admin' ? '#7c5cfc' : '#6b6b80' }} />
                              {u.role === 'admin' ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                              style={u.is_active
                                ? { background: 'rgba(52,211,153,0.06)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }
                                : { background: 'rgba(248,113,113,0.06)', color: '#f87171', border: '1px solid rgba(248,113,113,0.15)' }
                              }
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  background: u.is_active ? '#34d399' : '#f87171',
                                  boxShadow: u.is_active ? '0 0 6px rgba(52,211,153,0.5)' : '0 0 6px rgba(248,113,113,0.5)',
                                }}
                              />
                              {u.is_active ? 'Actif' : 'Suspendu'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#4a4a64] font-medium">{formatDate(u.created_at)}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {[
                                { action: () => toggleRole(u.id, u.role), title: u.role === 'admin' ? 'Passer user' : 'Passer admin', hoverColor: 'rgba(124,92,252,0.15)', hoverText: '#7c5cfc', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /> },
                                { action: () => toggleStatus(u.id, u.is_active), title: u.is_active ? 'Suspendre' : 'Reactiver', hoverColor: 'rgba(251,191,36,0.15)', hoverText: '#fbbf24', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /> },
                                { action: () => resetPassword(u.id), title: 'Reinitialiser MDP', hoverColor: 'rgba(96,165,250,0.15)', hoverText: '#60a5fa', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /> },
                                { action: () => deleteUser(u.id), title: 'Supprimer', hoverColor: 'rgba(248,113,113,0.15)', hoverText: '#f87171', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /> },
                              ].map((btn, idx) => (
                                <button
                                  key={idx}
                                  onClick={btn.action}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4a4a64] transition-all duration-200"
                                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                                  title={btn.title}
                                  aria-label={btn.title}
                                  onMouseOver={(e) => { e.currentTarget.style.background = btn.hoverColor; e.currentTarget.style.borderColor = btn.hoverColor; e.currentTarget.style.color = btn.hoverText; }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#4a4a64'; }}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>{btn.icon}</svg>
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* QUIZZES TAB */}
          {activeTab === 'quizzes' && (
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Tous les quiz</h2>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: 'rgba(124,92,252,0.1)', color: '#7c5cfc', border: '1px solid rgba(124,92,252,0.15)' }}
                >
                  {quizzes.length}
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden glow-card" style={glassCard}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr style={{ background: 'rgba(124,92,252,0.03)', borderBottom: '1px solid rgba(124,92,252,0.08)' }}>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Titre</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Proprietaire</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Questions</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Sessions</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Creation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quizzes.map((q) => (
                        <tr
                          key={q.id}
                          className="transition-all duration-200"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.03)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.15)' }}
                              >
                                <svg className="w-4 h-4 text-[#60a5fa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                                </svg>
                              </div>
                              <span className="font-semibold text-white">{q.title}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[#8888a0]">{q.owner_name}</td>
                          <td className="px-6 py-4">
                            <span
                              className="text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(124,92,252,0.1)', color: '#a78bfa', border: '1px solid rgba(124,92,252,0.15)' }}
                            >
                              {q.question_count}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className="text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.15)' }}
                            >
                              {q.session_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#4a4a64] font-medium">{formatDate(q.created_at)}</td>
                        </tr>
                      ))}
                      {quizzes.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-[#4a4a64]">Aucun quiz</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* SESSIONS TAB */}
          {activeTab === 'sessions' && (
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">Toutes les sessions</h2>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: 'rgba(124,92,252,0.1)', color: '#7c5cfc', border: '1px solid rgba(124,92,252,0.15)' }}
                >
                  {sessions.length}
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden glow-card" style={glassCard}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr style={{ background: 'rgba(124,92,252,0.03)', borderBottom: '1px solid rgba(124,92,252,0.08)' }}>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Code</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Quiz</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Hote</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Joueurs</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Statut</th>
                        <th className="text-left px-6 py-4 text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-bold">Creation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr
                          key={s.id}
                          className="transition-all duration-200"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.03)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td className="px-6 py-4">
                            <span
                              className="font-mono text-sm font-bold px-2.5 py-1 rounded-lg"
                              style={{ background: 'rgba(124,92,252,0.1)', color: '#a78bfa', border: '1px solid rgba(124,92,252,0.15)' }}
                            >
                              {s.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-white">{s.quiz_title}</td>
                          <td className="px-6 py-4 text-[#8888a0]">{s.owner_name}</td>
                          <td className="px-6 py-4">
                            <span
                              className="text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(124,92,252,0.1)', color: '#a78bfa', border: '1px solid rgba(124,92,252,0.15)' }}
                            >
                              {s.participant_count}
                            </span>
                          </td>
                          <td className="px-6 py-4">{statusBadge(s.status)}</td>
                          <td className="px-6 py-4 text-[#4a4a64] font-medium">{formatDate(s.created_at)}</td>
                        </tr>
                      ))}
                      {sessions.length === 0 && (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-[#4a4a64]">Aucune session</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
