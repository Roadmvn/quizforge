import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { QuizSummary, SessionSummary } from '../lib/types';

export default function Dashboard() {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [error, setError] = useState('');
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
    }).catch((e) => setError(e.message));
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

  return (
    <div className="p-6">
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">Mes Quiz</h2>
          {quizzes.length > 0 && (
            <span className="bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-full px-2.5 py-0.5">
              {quizzes.length}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/quiz/new')}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-sm font-medium transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
        >
          + Nouveau Quiz
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-6">
            <svg className="w-20 h-20 mx-auto text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-xl text-slate-400 mb-2">Aucun quiz pour le moment</p>
          <p className="text-sm text-slate-500 mb-8">Commencez par creer votre premier quiz interactif</p>
          <button
            onClick={() => navigate('/quiz/new')}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-base font-medium transition-all duration-300 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
          >
            Creer mon premier quiz
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((q) => {
            const qSessions = sessionsForQuiz(q.id);
            const isExpanded = expandedQuiz === q.id;

            return (
              <div
                key={q.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 group"
              >
                <div className="px-5 pt-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white truncate pr-2">{q.title}</h3>
                    <span className="bg-indigo-500/20 text-indigo-400 text-xs rounded-full px-2 py-0.5 shrink-0">
                      {q.question_count} Q
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>{formatDate(q.created_at)}</span>
                    {qSessions.length > 0 && (
                      <>
                        <span className="text-slate-700">|</span>
                        <span>{qSessions.length} session{qSessions.length > 1 && 's'}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-700/50 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/quiz/${q.id}/edit`)}
                      className="p-2 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-700/50 transition"
                      title="Modifier"
                      aria-label="Modifier"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={() => launchSession(q.id)}
                      className="p-2 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-slate-700/50 transition"
                      title="Lancer une session"
                      aria-label="Lancer une session"
                    >
                      <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </button>
                    <button
                      onClick={() => deleteQuiz(q.id)}
                      className="p-2 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700/50 transition"
                      title="Supprimer"
                      aria-label="Supprimer"
                    >
                      <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>

                  {qSessions.length > 0 && (
                    <button
                      onClick={() => toggleQuiz(q.id)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1"
                    >
                      {isExpanded ? 'Masquer' : 'Sessions'}
                      <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  )}
                </div>

                {isExpanded && qSessions.length > 0 && (
                  <div className="border-t border-slate-700/50 bg-slate-900/50">
                    {qSessions.map((s) => (
                      <div
                        key={s.id}
                        className="px-5 py-3 flex items-center justify-between hover:bg-slate-800/50 transition border-b border-slate-800/50 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-indigo-400 text-sm">{s.code}</span>
                          <span className="text-slate-400 text-sm">
                            {s.participant_count} joueur{s.participant_count > 1 && 's'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              s.status === 'lobby'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : s.status === 'finished'
                                  ? 'bg-slate-700 text-slate-400'
                                  : 'bg-green-500/20 text-green-400'
                            }`}
                          >
                            {s.status === 'lobby' ? 'En attente' : s.status === 'finished' ? 'Terminee' : 'En cours'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.status === 'finished' && (
                            <button
                              onClick={() => navigate(`/session/${s.id}/analytics`)}
                              className="px-3 py-1 text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg transition"
                            >
                              Analytique
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/session/${s.id}`)}
                            className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                          >
                            {s.status === 'lobby' ? 'Rejoindre' : s.status === 'finished' ? 'Voir' : 'Gerer'}
                          </button>
                        </div>
                      </div>
                    ))}
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
