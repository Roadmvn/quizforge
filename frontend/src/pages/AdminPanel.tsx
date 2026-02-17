import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { AdminStats, AdminUser } from '../lib/types';

export default function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
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
    Promise.all([
      api.get<AdminStats>('/admin/stats'),
      api.get<AdminUser[]>('/admin/users'),
    ])
      .then(([s, u]) => {
        setStats(s);
        setUsers(u);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec du changement de role');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Supprimer cet utilisateur ? Cette action est irreversible.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (stats) setStats({ ...stats, total_users: stats.total_users - 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec de la suppression');
    }
  };

  const createUser = async () => {
    setCreating(true);
    try {
      const created = await api.post<AdminUser>('/admin/users', newUser);
      setUsers((prev) => [created, ...prev]);
      if (stats) setStats({ ...stats, total_users: stats.total_users + 1 });
      setNewUser({ email: '', password: '', display_name: '', role: 'user' });
      setShowCreateForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec de la creation');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = stats
    ? [
        {
          label: 'Utilisateurs',
          value: stats.total_users,
          color: 'indigo',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          ),
        },
        {
          label: 'Quiz',
          value: stats.total_quizzes,
          color: 'emerald',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          ),
        },
        {
          label: 'Sessions',
          value: stats.total_sessions,
          color: 'amber',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          ),
        },
      ]
    : [];

  const colorMap: Record<string, { bg: string; text: string; ring: string; gradient: string }> = {
    indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', ring: 'ring-indigo-500/20', gradient: 'bg-gradient-to-br from-indigo-500/5 to-transparent' },
    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/20', gradient: 'bg-gradient-to-br from-emerald-500/5 to-transparent' },
    amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/20', gradient: 'bg-gradient-to-br from-amber-500/5 to-transparent' },
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Administration</h1>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-4 font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {stats && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((card) => {
            const colors = colorMap[card.color];
            return (
              <div
                key={card.label}
                className={`bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-7 hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/50 transition-all ${colors.gradient}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-full ${colors.bg} ${colors.text} ring-1 ${colors.ring} flex items-center justify-center flex-shrink-0`}>
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-4xl font-bold text-white">{card.value}</p>
                    <p className="text-sm text-slate-400 mt-1">{card.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

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
            {showCreateForm ? 'Annuler' : '+ Ajouter un utilisateur'}
          </button>
        </div>

        {showCreateForm && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-4">
            <h3 className="text-base font-semibold text-white mb-4">Nouvel utilisateur</h3>
            <form
              onSubmit={(e) => { e.preventDefault(); createUser(); }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition text-sm"
                  placeholder="utilisateur@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Mot de passe</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition text-sm"
                  placeholder="Min. 6 caracteres"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Nom d'affichage</label>
                <input
                  type="text"
                  required
                  value={newUser.display_name}
                  onChange={(e) => setNewUser((p) => ({ ...p, display_name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition text-sm"
                  placeholder="Jean Dupont"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition text-sm"
                >
                  <option value="user">Utilisateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-sm font-medium transition-all duration-300 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  {creating ? 'Creation...' : 'Creer l\'utilisateur'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/80">
                <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Nom</th>
                <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Email</th>
                <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">Role</th>
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
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-slate-600/20 text-slate-400'
                      }`}
                    >
                      {u.role === 'admin' ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      )}
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => toggleRole(u.id, u.role)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                        title={u.role === 'admin' ? 'Passer user' : 'Passer admin'}
                        aria-label={u.role === 'admin' ? 'Passer user' : 'Passer admin'}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Supprimer"
                        aria-label="Supprimer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
