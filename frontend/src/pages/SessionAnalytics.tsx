import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface AnswerDist {
  answer_id: string;
  text: string;
  is_correct: boolean;
  count: number;
  percentage: number;
}

interface QuestionStat {
  question_id: string;
  text: string;
  order: number;
  image_url?: string | null;
  total_responses: number;
  correct_percentage: number;
  avg_response_time: number;
  answer_distribution: AnswerDist[];
}

interface LeaderboardItem {
  rank: number;
  nickname: string;
  score: number;
  correct_answers: number;
  total_answers: number;
  avg_response_time: number;
}

interface Analytics {
  session: {
    id: string;
    code: string;
    status: string;
    created_at: string;
    quiz_title: string;
    total_participants: number;
    total_questions: number;
  };
  questions: QuestionStat[];
  leaderboard: LeaderboardItem[];
  global_stats: {
    avg_score: number;
    success_rate: number;
    easiest_question: { text: string; correct_percentage: number } | null;
    hardest_question: { text: string; correct_percentage: number } | null;
  };
}

export default function SessionAnalytics() {
  const { sid } = useParams<{ sid: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!sid) return;
    api.get<Analytics>(`/sessions/${sid}/analytics`)
      .then(setData)
      .catch(() => setError('Impossible de charger les analytiques'));
  }, [sid]);

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="text-indigo-400 hover:underline">
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { session, questions, leaderboard, global_stats } = data;
  const maxBarWidth = 100;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-slate-100 text-sm transition">
          &larr; Tableau de bord
        </button>
        <span className="text-sm text-slate-400">Session {session.code}</span>
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{session.quiz_title}</h1>
          <p className="text-slate-400">
            {session.total_participants} participant{session.total_participants > 1 && 's'} &middot;{' '}
            {session.total_questions} question{session.total_questions > 1 && 's'} &middot;{' '}
            {new Date(session.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Score moyen" value={`${global_stats.avg_score}`} sub="pts" />
          <StatCard label="Taux de reussite" value={`${global_stats.success_rate}%`} color={global_stats.success_rate >= 50 ? 'text-green-400' : 'text-red-400'} />
          <StatCard
            label="Plus facile"
            value={global_stats.easiest_question ? `${global_stats.easiest_question.correct_percentage}%` : '-'}
            sub={global_stats.easiest_question?.text}
            color="text-green-400"
          />
          <StatCard
            label="Plus difficile"
            value={global_stats.hardest_question ? `${global_stats.hardest_question.correct_percentage}%` : '-'}
            sub={global_stats.hardest_question?.text}
            color="text-red-400"
          />
        </div>

        {/* Leaderboard */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Classement</h2>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Joueur</th>
                  <th className="text-right px-4 py-3">Score</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Bonnes rep.</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Temps moy.</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p) => (
                  <tr key={p.rank} className="border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-lg">
                      {p.rank === 1 ? '\uD83E\uDD47' : p.rank === 2 ? '\uD83E\uDD48' : p.rank === 3 ? '\uD83E\uDD49' : p.rank}
                    </td>
                    <td className="px-4 py-3 font-medium">{p.nickname}</td>
                    <td className="px-4 py-3 text-right font-mono text-indigo-400">{p.score} pts</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-slate-400">
                      {p.correct_answers}/{p.total_answers}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-slate-400">
                      {p.avg_response_time}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Per-question breakdown */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Detail par question</h2>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={q.question_id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">
                    <span className="text-indigo-400 mr-2">Q{i + 1}.</span>
                    {q.text}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-slate-400 shrink-0 ml-4">
                    <span className={q.correct_percentage >= 50 ? 'text-green-400' : 'text-red-400'}>
                      {q.correct_percentage}% correct
                    </span>
                    <span>{q.avg_response_time}s moy.</span>
                  </div>
                </div>
                {q.image_url && (
                  <img
                    src={q.image_url}
                    alt="Question"
                    className="max-h-64 w-full object-contain rounded-xl bg-slate-900/50 mt-3 cursor-pointer"
                    onClick={() => setPreviewImage(q.image_url!)}
                  />
                )}
                <div className="space-y-2">
                  {q.answer_distribution.map((a) => (
                    <div key={a.answer_id} className="flex items-center gap-3">
                      <div className="w-1/3 text-sm truncate flex items-center gap-2">
                        {a.is_correct && <span className="text-green-400">{'\u2713'}</span>}
                        <span className={a.is_correct ? 'text-green-300' : 'text-slate-300'}>{a.text}</span>
                      </div>
                      <div className="flex-1 bg-slate-700 rounded-full h-5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${a.is_correct ? 'bg-green-500/60' : 'bg-red-500/40'}`}
                          style={{ width: `${Math.max(a.percentage, 0)}%`, maxWidth: `${maxBarWidth}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-400 w-16 text-right">
                        {a.count} ({a.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 cursor-pointer" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 bg-slate-800/80 hover:bg-slate-700 rounded-full flex items-center justify-center text-white transition" onClick={() => setPreviewImage(null)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img src={previewImage} alt="Apercu" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-indigo-400' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1 truncate">{sub}</p>}
    </div>
  );
}
