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
  const navigate = useNavigate();

  useEffect(() => {
    api.get<QuizSummary[]>('/quizzes/').then(setQuizzes).catch(() => {});
    api.get<SessionSummary[]>('/sessions').then(setSessions).catch(() => {});
  }, []);

  const deleteQuiz = async (id: string) => {
    if (!confirm('Delete this quiz?')) return;
    await api.delete(`/quizzes/${id}`);
    setQuizzes((q) => q.filter((x) => x.id !== id));
  };

  const launchSession = async (quizId: string) => {
    const s = await api.post<{ id: string }>('/sessions', { quiz_id: quizId });
    navigate(`/session/${s.id}`);
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
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Quizzes */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">My Quizzes</h2>
            <button
              onClick={() => navigate('/quiz/new')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition"
            >
              + New Quiz
            </button>
          </div>
          {quizzes.length === 0 ? (
            <p className="text-gray-500">No quizzes yet. Create your first one!</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quizzes.map((q) => (
                <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="font-semibold mb-1 truncate">{q.title}</h3>
                  <p className="text-gray-400 text-sm mb-3">
                    {q.question_count} question{q.question_count !== 1 && 's'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/quiz/${q.id}/edit`)}
                      className="flex-1 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => launchSession(q.id)}
                      className="flex-1 py-2 text-sm bg-green-600 hover:bg-green-700 rounded-lg transition"
                    >
                      Launch
                    </button>
                    <button
                      onClick={() => deleteQuiz(q.id)}
                      className="py-2 px-3 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition"
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sessions */}
        {sessions.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Recent Sessions</h2>
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/session/${s.id}`)}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-gray-700 transition"
                >
                  <div>
                    <span className="font-mono text-indigo-400 mr-3">{s.code}</span>
                    <span className="text-gray-300">{s.quiz_title}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">{s.participant_count} players</span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        s.status === 'lobby'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : s.status === 'finished'
                            ? 'bg-gray-700 text-gray-400'
                            : 'bg-green-500/20 text-green-400'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
