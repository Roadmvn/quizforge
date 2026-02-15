import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { QuizSummary, SessionSummary, User } from '../lib/types';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: Props) {
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
    api.get<QuizSummary[]>('/quizzes/').then(setQuizzes).catch((e) => setError(e.message));
    api.get<SessionSummary[]>('/sessions').then(setSessions).catch((e) => setError(e.message));
  }, []);

  const deleteQuiz = async (id: string) => {
    if (!confirm('Supprimer ce quiz ?')) return;
    try {
      await api.delete(`/quizzes/${id}`);
      setQuizzes((q) => q.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la suppression');
    }
  };

  const launchSession = async (quizId: string) => {
    try {
      const s = await api.post<{ id: string }>('/sessions', { quiz_id: quizId });
      navigate(`/session/${s.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec du lancement');
    }
  };

  const sessionsForQuiz = (quizId: string) =>
    sessions.filter((s) => s.quiz_id === quizId);

  const toggleQuiz = (quizId: string) => {
    setExpandedQuiz((prev) => (prev === quizId ? null : quizId));
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          <span className="text-indigo-400">Quiz</span>Forge
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user.display_name}</span>
          <button onClick={onLogout} className="text-sm text-gray-400 hover:text-white">
            Déconnexion
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-6 py-3 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-4">X</button>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Mes Quiz</h2>
            <button
              onClick={() => navigate('/quiz/new')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition"
            >
              + Nouveau Quiz
            </button>
          </div>
          {quizzes.length === 0 ? (
            <p className="text-gray-500">Aucun quiz pour le moment. Créez le premier !</p>
          ) : (
            <div className="space-y-4">
              {quizzes.map((q) => {
                const qSessions = sessionsForQuiz(q.id);
                const isExpanded = expandedQuiz === q.id;

                return (
                  <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold truncate">{q.title}</h3>
                        {qSessions.length > 0 && (
                          <span className="text-xs text-gray-500 ml-2 shrink-0">
                            {qSessions.length} session{qSessions.length > 1 && 's'}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mb-3">
                        {q.question_count} question{q.question_count > 1 && 's'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/quiz/${q.id}/edit`)}
                          className="flex-1 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => launchSession(q.id)}
                          className="flex-1 py-2 text-sm bg-green-600 hover:bg-green-700 rounded-lg transition"
                        >
                          Lancer
                        </button>
                        <button
                          onClick={() => deleteQuiz(q.id)}
                          className="py-2 px-3 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition"
                        >
                          Suppr
                        </button>
                        {qSessions.length > 0 && (
                          <button
                            onClick={() => toggleQuiz(q.id)}
                            className="py-2 px-3 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                            title={isExpanded ? 'Masquer les sessions' : 'Voir les sessions'}
                          >
                            {isExpanded ? '\u25B2' : '\u25BC'} Sessions
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && qSessions.length > 0 && (
                      <div className="border-t border-gray-800 bg-gray-950/50">
                        {qSessions.map((s) => (
                          <div
                            key={s.id}
                            className="px-5 py-3 flex items-center justify-between hover:bg-gray-800/50 transition border-b border-gray-800/50 last:border-b-0"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-indigo-400 text-sm">{s.code}</span>
                              <span className="text-gray-400 text-sm">
                                {s.participant_count} joueur{s.participant_count > 1 && 's'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  s.status === 'lobby'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : s.status === 'finished'
                                      ? 'bg-gray-700 text-gray-400'
                                      : 'bg-green-500/20 text-green-400'
                                }`}
                              >
                                {s.status === 'lobby' ? 'En attente' : s.status === 'finished' ? 'Terminée' : 'En cours'}
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
                                className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                              >
                                {s.status === 'lobby' ? 'Rejoindre' : s.status === 'finished' ? 'Voir' : 'Gérer'}
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
        </section>
      </main>
    </div>
  );
}
