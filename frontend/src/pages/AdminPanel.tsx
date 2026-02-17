import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { AdminDashboard, AdminUser, AdminQuizItem, AdminSessionItem } from '../lib/types';

type Tab = 'overview' | 'users' | 'quizzes' | 'sessions';

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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Vue d\'ensemble' },
    { key: 'users', label: 'Utilisateurs' },
    { key: 'quizzes', label: 'Quiz' },
    { key: 'sessions', label: 'Sessions' },
  ];

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      lobby: 'bg-yellow-500/20 text-yellow-400',
      active: 'bg-green-500/20 text-green-400',
      revealing: 'bg-blue-500/20 text-blue-400',
      finished: 'bg-slate-600/20 text-slate-400',
    };
    const labels: Record<string, string> = {
      lobby: 'En attente',
      active: 'En cours',
      revealing: 'Revelation',
      finished: 'Terminee',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-slate-600/20 text-slate-400'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Administration</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 border border-slate-700/50">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && dashboard && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Utilisateurs', value: dashboard.total_users, color: 'indigo' },
                  { label: 'Quiz', value: dashboard.total_quizzes, color: 'emerald' },
                  { label: 'Sessions', value: dashboard.total_sessions, color: 'amber' },
                  { label: 'Sessions actives', value: dashboard.active_sessions, color: 'rose' },
                ].map((card) => (
                  <div key={card.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                    <p className="text-3xl font-bold text-white">{card.value}</p>
                    <p className="text-sm text-slate-400 mt-1">{card.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent users */}
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Derniers utilisateurs</h3>
                  <div className="space-y-3">
                    {dashboard.recent_users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-sm font-medium">
                            {u.display_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm text-white">{u.display_name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-500">{formatDate(u.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent sessions */}
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Dernieres sessions</h3>
                  <div className="space-y-3">
                    {dashboard.recent_sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-indigo-400 text-sm">{s.code}</span>
                          <span className="text-sm text-white">{s.quiz_title}</span>
                          {statusBadge(s.status)}
                        </div>
                        <span className="text-xs text-slate-500">{s.participant_count} joueurs</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white">Utilisateurs</h2>
                  <span className="bg-indigo-600/20 text-indigo-400 rounded-full px-2.5 py-0.5 text-sm font-medium">
                    {users.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowCreateForm((v) => !v)}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-sm font-medium transition-all duration-300 shadow-lg shadow-indigo-500/20"
                >
                  {showCreateForm ? 'Annuler' : '+ Ajouter'}
                </button>
              </div>

              {showCreateForm && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-4">
                  <h3 className="text-base font-semibold text-white mb-4">Nouvel utilisateur</h3>
                  <form onSubmit={(e) => { e.preventDefault(); createUser(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="new-email" className="block text-sm text-slate-400 mb-1.5">Email</label>
                      <input id="new-email" type="email" required value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition text-sm" placeholder="utilisateur@example.com" />
                    </div>
                    <div>
                      <label htmlFor="new-password" className="block text-sm text-slate-400 mb-1.5">Mot de passe</label>
                      <input id="new-password" type="password" required minLength={8} value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition text-sm" placeholder="Min. 8 caracteres" />
                    </div>
                    <div>
                      <label htmlFor="new-name" className="block text-sm text-slate-400 mb-1.5">Nom d'affichage</label>
                      <input id="new-name" type="text" required value={newUser.display_name} onChange={(e) => setNewUser((p) => ({ ...p, display_name: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition text-sm" placeholder="Jean Dupont" />
                    </div>
                    <div>
                      <label htmlFor="new-role" className="block text-sm text-slate-400 mb-1.5">Role</label>
                      <select id="new-role" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition text-sm">
                        <option value="user">Utilisateur</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <button type="submit" disabled={creating} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-sm font-medium transition-all duration-300 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                        {creating ? 'Creation...' : 'Creer l\'utilisateur'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-800/80">
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Nom</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Email</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Role</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Statut</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Inscription</th>
                      <th className="text-right px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} className={`border-b border-slate-800/50 last:border-b-0 hover:bg-slate-700/30 transition ${i % 2 === 1 ? 'bg-slate-800/20' : ''}`}>
                        <td className="px-5 py-4 font-medium text-white">{u.display_name}</td>
                        <td className="px-5 py-4 text-slate-400">{u.email}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-600/20 text-slate-400'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                            {u.is_active ? 'Actif' : 'Suspendu'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">{formatDate(u.created_at)}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => toggleRole(u.id, u.role)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all" title={u.role === 'admin' ? 'Passer user' : 'Passer admin'} aria-label={u.role === 'admin' ? 'Passer user' : 'Passer admin'}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                            </button>
                            <button onClick={() => toggleStatus(u.id, u.is_active)} className={`p-1.5 rounded-lg transition-all ${u.is_active ? 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10' : 'text-amber-400 hover:text-green-400 hover:bg-green-500/10'}`} title={u.is_active ? 'Suspendre' : 'Reactiver'} aria-label={u.is_active ? 'Suspendre' : 'Reactiver'}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            </button>
                            <button onClick={() => resetPassword(u.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all" title="Reinitialiser le mot de passe" aria-label="Reinitialiser le mot de passe">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
                            </button>
                            <button onClick={() => deleteUser(u.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Supprimer" aria-label="Supprimer">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* QUIZZES TAB */}
          {activeTab === 'quizzes' && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-white">Tous les quiz</h2>
                <span className="bg-emerald-600/20 text-emerald-400 rounded-full px-2.5 py-0.5 text-sm font-medium">{quizzes.length}</span>
              </div>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-800/80">
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Titre</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Proprietaire</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Questions</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Sessions</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Creation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzes.map((q, i) => (
                      <tr key={q.id} className={`border-b border-slate-800/50 last:border-b-0 hover:bg-slate-700/30 transition ${i % 2 === 1 ? 'bg-slate-800/20' : ''}`}>
                        <td className="px-5 py-4 font-medium text-white">{q.title}</td>
                        <td className="px-5 py-4 text-slate-400">{q.owner_name}</td>
                        <td className="px-5 py-4"><span className="bg-indigo-500/20 text-indigo-400 text-xs rounded-full px-2 py-0.5">{q.question_count}</span></td>
                        <td className="px-5 py-4"><span className="bg-amber-500/20 text-amber-400 text-xs rounded-full px-2 py-0.5">{q.session_count}</span></td>
                        <td className="px-5 py-4 text-slate-500">{formatDate(q.created_at)}</td>
                      </tr>
                    ))}
                    {quizzes.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">Aucun quiz</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* SESSIONS TAB */}
          {activeTab === 'sessions' && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-white">Toutes les sessions</h2>
                <span className="bg-amber-600/20 text-amber-400 rounded-full px-2.5 py-0.5 text-sm font-medium">{sessions.length}</span>
              </div>
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-800/80">
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Code</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Quiz</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Hote</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Joueurs</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Statut</th>
                      <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Creation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={s.id} className={`border-b border-slate-800/50 last:border-b-0 hover:bg-slate-700/30 transition ${i % 2 === 1 ? 'bg-slate-800/20' : ''}`}>
                        <td className="px-5 py-4 font-mono text-indigo-400">{s.code}</td>
                        <td className="px-5 py-4 text-white">{s.quiz_title}</td>
                        <td className="px-5 py-4 text-slate-400">{s.owner_name}</td>
                        <td className="px-5 py-4"><span className="bg-indigo-500/20 text-indigo-400 text-xs rounded-full px-2 py-0.5">{s.participant_count}</span></td>
                        <td className="px-5 py-4">{statusBadge(s.status)}</td>
                        <td className="px-5 py-4 text-slate-500">{formatDate(s.created_at)}</td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">Aucune session</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
