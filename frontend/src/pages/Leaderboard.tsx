import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface LeaderboardEntry {
  rank: number;
  username: string;
  best_score: number;
  sessions_count: number;
}

export default function Leaderboard() {
  const [themes, setThemes] = useState<string[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    api.get<string[]>('/leaderboard/themes')
      .then(setThemes)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = selectedTheme
      ? `/leaderboard/${encodeURIComponent(selectedTheme)}`
      : '/leaderboard/';
    api.get<LeaderboardEntry[]>(url)
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedTheme]);

  const rankStyle = (rank: number) => {
    if (rank === 1)
      return { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#fff', boxShadow: '0 0 10px rgba(251,191,36,0.3)' };
    if (rank === 2)
      return { background: 'linear-gradient(135deg, #94a3b8, #64748b)', color: '#fff', boxShadow: '0 0 10px rgba(148,163,184,0.2)' };
    if (rank === 3)
      return { background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', boxShadow: '0 0 10px rgba(217,119,6,0.2)' };
    return { background: 'rgba(107,107,128,0.15)', color: '#6b6b80', border: '1px solid rgba(107,107,128,0.1)' };
  };

  const rankEmoji = (rank: number) => {
    if (rank === 1) return '\u{1F947}';
    if (rank === 2) return '\u{1F948}';
    if (rank === 3) return '\u{1F949}';
    return `#${rank}`;
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="spinner-premium w-10 h-10" />
        <p className="text-[#8888a0] text-sm animate-pulse">Chargement du classement...</p>
      </div>
    );
  }

  return (
    <div className="animate-in">
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

      {/* Header bar */}
      <div
        className="rounded-2xl mb-8 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{
          background: 'rgba(15, 15, 35, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(124, 92, 252, 0.1)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
            style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              boxShadow: '0 0 25px rgba(251,191,36,0.35), 0 4px 15px rgba(251,191,36,0.25)',
            }}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Classement</h1>
            <p className="text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-medium mt-0.5">Leaderboard global</p>
          </div>
        </div>

        {/* Theme selector */}
        <div className="relative">
          <select
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
            className="appearance-none cursor-pointer pl-4 pr-10 py-2.5 rounded-xl text-sm font-medium text-white outline-none transition-all duration-200"
            style={{
              background: 'rgba(124,92,252,0.08)',
              border: '1px solid rgba(124,92,252,0.15)',
              boxShadow: '0 0 15px rgba(124,92,252,0.05)',
              minWidth: '180px',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.35)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(124,92,252,0.15)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.15)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(124,92,252,0.05)'; }}
          >
            <option value="" style={{ background: '#0f0f23', color: '#e8e8f0' }}>Toutes les thematiques</option>
            {themes.map((t) => (
              <option key={t} value={t} style={{ background: '#0f0f23', color: '#e8e8f0' }}>{t}</option>
            ))}
          </select>
          <svg className="w-4 h-4 text-[#7c5cfc] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Leaderboard table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="spinner-premium w-8 h-8" />
          <p className="text-[#8888a0] text-sm animate-pulse">Chargement...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div
            className="text-center max-w-md p-10 rounded-2xl glow-card"
            style={{
              background: 'rgba(15,15,35,0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(124,92,252,0.1)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(124,92,252,0.05)',
            }}
          >
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.15)', boxShadow: '0 0 30px rgba(251,191,36,0.1)' }}>
                <svg className="w-10 h-10 text-[#fbbf24]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Aucun classement disponible</h3>
            <p className="text-sm text-[#8888a0] leading-relaxed">
              {selectedTheme
                ? `Aucune session terminee pour la thematique "${selectedTheme}".`
                : 'Aucune session terminee pour le moment. Lancez des quiz pour voir le classement !'}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(15, 15, 35, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(124, 92, 252, 0.08)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Gradient accent bar */}
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #fbbf24, #7c5cfc, #a855f7)', opacity: 0.6 }} />

          {/* Table header */}
          <div
            className="grid grid-cols-[60px_1fr_120px_120px] sm:grid-cols-[80px_1fr_140px_140px] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#4a4a64]"
            style={{ borderBottom: '1px solid rgba(124,92,252,0.08)', background: 'rgba(124,92,252,0.02)' }}
          >
            <span>Rang</span>
            <span>Joueur</span>
            <span className="text-right">Meilleur score</span>
            <span className="text-right">Sessions</span>
          </div>

          {/* Table rows */}
          {entries.map((entry) => (
            <div
              key={entry.username}
              className={`grid grid-cols-[60px_1fr_120px_120px] sm:grid-cols-[80px_1fr_140px_140px] px-5 py-3.5 items-center transition-all duration-200 ${entry.rank <= 3 ? 'stagger-' + entry.rank : ''}`}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.04)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Rank */}
              <div className="flex items-center">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={rankStyle(entry.rank)}
                >
                  {entry.rank <= 3 ? rankEmoji(entry.rank) : entry.rank}
                </div>
              </div>

              {/* Username */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: entry.rank <= 3
                      ? 'linear-gradient(135deg, #7c5cfc, #a855f7)'
                      : 'rgba(124,92,252,0.1)',
                    color: entry.rank <= 3 ? '#fff' : '#7c5cfc',
                    border: entry.rank <= 3 ? 'none' : '1px solid rgba(124,92,252,0.12)',
                    boxShadow: entry.rank <= 3 ? '0 0 12px rgba(124,92,252,0.3)' : 'none',
                  }}
                >
                  {entry.username.charAt(0).toUpperCase()}
                </div>
                <span className={`font-medium truncate ${entry.rank <= 3 ? 'text-white' : 'text-[#e8e8f0]'}`}>
                  {entry.username}
                </span>
              </div>

              {/* Points */}
              <span
                className="text-right font-mono text-sm font-bold px-2.5 py-1 rounded-md w-fit ml-auto"
                style={{
                  background: entry.rank <= 3 ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.06)',
                  color: entry.rank <= 3 ? '#a78bfa' : '#8888a0',
                  border: `1px solid rgba(124,92,252,${entry.rank <= 3 ? '0.15' : '0.08'})`,
                }}
              >
                {entry.best_score.toLocaleString('fr-FR')} pts
              </span>

              {/* Sessions count */}
              <span className="text-right text-sm text-[#8888a0]">
                {entry.sessions_count} session{entry.sessions_count > 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
