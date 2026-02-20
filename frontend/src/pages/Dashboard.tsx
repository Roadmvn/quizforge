import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { QuizSummary, SessionSummary } from '../lib/types';

export default function Dashboard() {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    Promise.all([
      api.get<QuizSummary[]>('/quizzes/'),
      api.get<SessionSummary[]>('/sessions'),
    ]).then(([q, s]) => {
      setQuizzes(q);
      setSessions(s);
    }).catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const deleteQuiz = async (id: string) => {
    if (!confirm('Supprimer ce quiz ?')) return;
    try {
      await api.delete(`/quizzes/${id}`);
      setQuizzes((q) => q.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec de la suppression');
    }
  };

  const launchSession = async (quizId: string) => {
    try {
      const s = await api.post<{ id: string }>('/sessions', { quiz_id: quizId });
      navigate(`/session/${s.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec du lancement');
    }
  };

  const deleteSession = async (id: string) => {
    if (!confirm('Supprimer cette session ?')) return;
    try {
      await api.delete(`/sessions/${id}`);
      setSessions((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec de la suppression');
    }
  };

  const forceFinishSession = async (id: string) => {
    try {
      await api.post(`/sessions/${id}/finish`);
      setSessions((prev) => prev.map((x) => x.id === id ? { ...x, status: 'finished' } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec de la terminaison');
    }
  };

  const sessionsForQuiz = (quizId: string) =>
    sessions.filter((s) => s.quiz_id === quizId);

  const toggleQuiz = (quizId: string) => {
    setExpandedQuiz((prev) => (prev === quizId ? null : quizId));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="spinner-premium w-10 h-10" />
        <p className="text-[#8888a0] text-sm animate-pulse">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Error banner - AdminPanel style */}
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

      {/* Premium header bar */}
      <div
        className="rounded-2xl mb-8 p-6 flex items-center justify-between"
        style={{
          background: 'rgba(15, 15, 35, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(124, 92, 252, 0.1)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">Mes Quiz</h1>
              {quizzes.length > 0 && (
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                  style={{ background: 'rgba(124,92,252,0.1)', color: '#7c5cfc', border: '1px solid rgba(124,92,252,0.15)' }}
                >
                  {quizzes.length}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-medium mt-0.5">Tableau de bord</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/quiz/new')}
          className="px-6 py-3 text-white rounded-xl text-sm font-semibold transition-all duration-300 btn-glow flex items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
            boxShadow: '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)',
          }}
          onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 40px rgba(124,92,252,0.4), 0 6px 20px rgba(124,92,252,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nouveau Quiz
        </button>
      </div>

      {quizzes.length === 0 ? (
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
            <div className="mb-8" style={{ animation: 'float 4s ease-in-out infinite' }}>
              <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.15)', boxShadow: '0 0 30px rgba(124,92,252,0.1)' }}>
                <svg className="w-10 h-10 text-[#7c5cfc]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Aucun quiz pour le moment</h3>
            <p className="text-sm text-[#8888a0] mb-8 leading-relaxed">Commencez par creer votre premier quiz interactif et engagez vos equipes</p>
            <button
              onClick={() => navigate('/quiz/new')}
              className="px-8 py-3.5 text-white font-semibold rounded-xl transition-all duration-300 btn-glow"
              style={{
                background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
                boxShadow: '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)',
              }}
              onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 40px rgba(124,92,252,0.4), 0 6px 20px rgba(124,92,252,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Creer mon premier quiz
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((q, index) => {
            const qSessions = sessionsForQuiz(q.id);
            const isExpanded = expandedQuiz === q.id;

            return (
              <div
                key={q.id}
                className={`rounded-2xl overflow-hidden glow-card transition-all duration-300 stagger-${Math.min(index, 6)}`}
                style={{
                  background: 'rgba(15, 15, 35, 0.6)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(124, 92, 252, 0.08)',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 50px rgba(0,0,0,0.3), 0 0 30px rgba(124,92,252,0.1), inset 0 1px 0 rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.08)';
                }}
              >
                {/* Gradient accent bar */}
                <div
                  style={{
                    height: '3px',
                    background: 'linear-gradient(90deg, #7c5cfc, #a855f7, #7c5cfc)',
                    opacity: 0.6,
                  }}
                />

                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-bold text-white leading-snug pr-3" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.title}</h3>
                    <span
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 text-white"
                      style={{
                        background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
                        boxShadow: '0 0 12px rgba(124,92,252,0.3)',
                      }}
                    >
                      {q.question_count} Q
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.12)' }}
                      >
                        <svg className="w-3 h-3 text-[#7c5cfc]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <span className="text-[#8888a0] font-medium">{formatDate(q.created_at)}</span>
                    </div>
                    {qSessions.length > 0 && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                        style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.12)' }}
                      >
                        <span className="w-1 h-1 rounded-full" style={{ background: '#34d399', boxShadow: '0 0 4px rgba(52,211,153,0.5)' }} />
                        {qSessions.length} session{qSessions.length > 1 && 's'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons row */}
                <div
                  className="px-5 py-3 flex items-center justify-between"
                  style={{ borderTop: '1px solid rgba(124,92,252,0.06)', background: 'rgba(124,92,252,0.02)' }}
                >
                  <div className="flex items-center gap-1.5">
                    {/* Edit button */}
                    <button
                      onClick={() => navigate(`/quiz/${q.id}/edit`)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4a4a64] transition-all duration-200"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      title="Modifier"
                      aria-label="Modifier"
                      onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.15)'; e.currentTarget.style.borderColor = 'rgba(124,92,252,0.15)'; e.currentTarget.style.color = '#7c5cfc'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#4a4a64'; }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    {/* Launch session button */}
                    <button
                      onClick={() => launchSession(q.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4a4a64] transition-all duration-200"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      title="Lancer une session"
                      aria-label="Lancer une session"
                      onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(52,211,153,0.15)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.15)'; e.currentTarget.style.color = '#34d399'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#4a4a64'; }}
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </button>
                    {/* Delete quiz button */}
                    <button
                      onClick={() => deleteQuiz(q.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4a4a64] transition-all duration-200"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      title="Supprimer"
                      aria-label="Supprimer"
                      onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.15)'; e.currentTarget.style.color = '#f87171'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#4a4a64'; }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>

                  {qSessions.length > 0 && (
                    <button
                      onClick={() => toggleQuiz(q.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                      style={{ background: 'rgba(124,92,252,0.06)', color: '#8888a0', border: '1px solid rgba(124,92,252,0.1)' }}
                      onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.12)'; e.currentTarget.style.color = '#e8e8f0'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.06)'; e.currentTarget.style.color = '#8888a0'; }}
                    >
                      {isExpanded ? 'Masquer' : 'Sessions'}
                      <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  )}
                </div>

                {/* Expanded sessions */}
                {isExpanded && qSessions.length > 0 && (
                  <div
                    style={{
                      borderTop: '1px solid rgba(124,92,252,0.06)',
                      background: 'rgba(0,0,0,0.15)',
                    }}
                  >
                    {qSessions.map((s) => {
                      const isSessionExpanded = expandedSession === s.id;
                      return (
                        <div
                          key={s.id}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          className="last:border-b-0"
                        >
                          <div
                            className="px-5 py-3.5 transition-all duration-200 space-y-3"
                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.03)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div className="flex items-center gap-3 flex-wrap">
                              {/* Code badge - monospace gradient */}
                              <span
                                className="font-mono text-sm font-bold px-3 py-1 rounded-lg"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(168,85,247,0.1))',
                                  color: '#a78bfa',
                                  border: '1px solid rgba(124,92,252,0.2)',
                                  boxShadow: '0 0 10px rgba(124,92,252,0.08)',
                                }}
                              >
                                {s.code}
                              </span>

                              {/* Participants button/badge */}
                              {s.participant_count > 0 && (
                                <button
                                  onClick={() => setExpandedSession(isSessionExpanded ? null : s.id)}
                                  className="flex items-center gap-1.5 text-sm transition-all duration-200 px-2 py-0.5 rounded-md"
                                  style={{ color: '#8888a0' }}
                                  onMouseOver={(e) => { e.currentTarget.style.color = '#e8e8f0'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.color = '#8888a0'; e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                  {s.participant_count} joueur{s.participant_count > 1 ? 's' : ''}
                                  <svg className={`w-3 h-3 transition-transform ${isSessionExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                              )}
                              {s.participant_count === 0 && (
                                <span className="text-[#4a4a64] text-sm">0 joueur</span>
                              )}

                              {/* Status badge with glowing dot */}
                              <span
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                                style={
                                  s.status === 'lobby'
                                    ? { background: 'rgba(251,191,36,0.06)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.15)' }
                                    : s.status === 'finished'
                                      ? { background: 'rgba(107,107,128,0.06)', color: '#8888a0', border: '1px solid rgba(107,107,128,0.1)' }
                                      : { background: 'rgba(52,211,153,0.06)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }
                                }
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={
                                    s.status === 'lobby'
                                      ? { background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.5)' }
                                      : s.status === 'finished'
                                        ? { background: '#6b6b80', boxShadow: '0 0 6px rgba(107,107,128,0.3)' }
                                        : { background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.5)' }
                                  }
                                />
                                {s.status === 'lobby' ? 'En attente' : s.status === 'finished' ? 'Terminee' : 'En cours'}
                              </span>
                            </div>

                            {/* Session action buttons */}
                            <div className="flex items-center gap-2">
                              {(s.status === 'lobby' || s.status === 'active' || s.status === 'revealing') && (
                                <button
                                  onClick={() => forceFinishSession(s.id)}
                                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 text-white"
                                  style={{
                                    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                                    boxShadow: '0 0 15px rgba(251,191,36,0.2), 0 2px 8px rgba(251,191,36,0.15)',
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 25px rgba(251,191,36,0.35), 0 4px 12px rgba(251,191,36,0.25)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 0 15px rgba(251,191,36,0.2), 0 2px 8px rgba(251,191,36,0.15)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  Terminer
                                </button>
                              )}
                              {s.status === 'finished' && (
                                <button
                                  onClick={() => navigate(`/session/${s.id}/analytics`)}
                                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 text-white"
                                  style={{
                                    background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
                                    boxShadow: '0 0 15px rgba(124,92,252,0.2), 0 2px 8px rgba(124,92,252,0.15)',
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 25px rgba(124,92,252,0.35), 0 4px 12px rgba(124,92,252,0.25)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 0 15px rgba(124,92,252,0.2), 0 2px 8px rgba(124,92,252,0.15)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  Analytiques
                                </button>
                              )}
                              <button
                                onClick={() => navigate(`/session/${s.id}`)}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 text-white"
                                style={
                                  s.status === 'lobby'
                                    ? {
                                        background: 'linear-gradient(135deg, #34d399, #10b981)',
                                        boxShadow: '0 0 15px rgba(52,211,153,0.2), 0 2px 8px rgba(52,211,153,0.15)',
                                      }
                                    : s.status === 'finished'
                                      ? {
                                          background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
                                          boxShadow: '0 0 15px rgba(124,92,252,0.2), 0 2px 8px rgba(124,92,252,0.15)',
                                        }
                                      : {
                                          background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
                                          boxShadow: '0 0 15px rgba(124,92,252,0.2), 0 2px 8px rgba(124,92,252,0.15)',
                                        }
                                }
                                onMouseOver={(e) => {
                                  const isLobby = s.status === 'lobby';
                                  const color = isLobby ? '52,211,153' : '124,92,252';
                                  e.currentTarget.style.boxShadow = `0 0 25px rgba(${color},0.35), 0 4px 12px rgba(${color},0.25)`;
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseOut={(e) => {
                                  const isLobby = s.status === 'lobby';
                                  const color = isLobby ? '52,211,153' : '124,92,252';
                                  e.currentTarget.style.boxShadow = `0 0 15px rgba(${color},0.2), 0 2px 8px rgba(${color},0.15)`;
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                {s.status === 'lobby' ? 'Rejoindre' : s.status === 'finished' ? 'Voir' : 'Gerer'}
                              </button>
                              {/* Delete session button - mini-card style */}
                              <button
                                onClick={() => deleteSession(s.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#4a4a64] transition-all duration-200 ml-auto"
                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                                title="Supprimer la session"
                                aria-label="Supprimer la session"
                                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.15)'; e.currentTarget.style.color = '#f87171'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#4a4a64'; }}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>

                          {/* Participant list */}
                          {isSessionExpanded && s.participants.length > 0 && (
                            <div className="px-5 pb-3">
                              <div
                                className="rounded-xl overflow-hidden"
                                style={{
                                  background: 'rgba(15,15,35,0.5)',
                                  border: '1px solid rgba(124,92,252,0.08)',
                                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                                }}
                              >
                                {s.participants.map((p, i) => (
                                  <div
                                    key={p.nickname}
                                    className="flex items-center justify-between px-4 py-2.5 text-sm transition-all duration-200"
                                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(124,92,252,0.04)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                  >
                                    <div className="flex items-center gap-3">
                                      {/* Gradient avatar with rank styling */}
                                      <div
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                                        style={
                                          i === 0
                                            ? { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#fff', boxShadow: '0 0 10px rgba(251,191,36,0.3)' }
                                            : i === 1
                                              ? { background: 'linear-gradient(135deg, #94a3b8, #64748b)', color: '#fff', boxShadow: '0 0 10px rgba(148,163,184,0.2)' }
                                              : i === 2
                                                ? { background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', boxShadow: '0 0 10px rgba(217,119,6,0.2)' }
                                                : { background: 'rgba(107,107,128,0.15)', color: '#6b6b80', border: '1px solid rgba(107,107,128,0.1)' }
                                        }
                                      >
                                        {i + 1}
                                      </div>
                                      <span className="text-white font-medium">{p.nickname}</span>
                                    </div>
                                    <span
                                      className="font-mono text-xs font-bold px-2.5 py-1 rounded-md"
                                      style={{ background: 'rgba(124,92,252,0.1)', color: '#a78bfa', border: '1px solid rgba(124,92,252,0.12)' }}
                                    >
                                      {p.score} pts
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
