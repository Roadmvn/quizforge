import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, authFetch } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'questions'>('overview');

  useEffect(() => {
    if (!sid) return;
    api.get<Analytics>(`/sessions/${sid}/analytics`)
      .then(setData)
      .catch(() => setError('Impossible de charger les analytiques'));
  }, [sid]);

  const downloadCsv = async () => {
    try {
      const res = await authFetch(`/sessions/${sid}/export`);
      if (!res.ok) throw new Error('Echec');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session_${data?.session.code || sid}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Impossible de telecharger le CSV');
    }
  };

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh] animate-in">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-[#f87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <p className="text-[#f87171] font-medium">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="text-[#6b6b80] hover:text-[#e8e8f0] text-sm transition">
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-[#6b6b80]">
          <div className="spinner-premium w-8 h-8" />
          <span>Chargement des analytiques...</span>
        </div>
      </div>
    );
  }

  const { session, questions, leaderboard, global_stats } = data;

  const barData = questions.map((q, i) => ({
    name: `Q${i + 1}`,
    correct: q.answer_distribution.filter(a => a.is_correct).reduce((sum, a) => sum + a.count, 0),
    incorrect: q.total_responses - q.answer_distribution.filter(a => a.is_correct).reduce((sum, a) => sum + a.count, 0),
  }));

  const tooltipStyle = {
    contentStyle: { backgroundColor: 'rgba(6,6,14,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' },
    labelStyle: { color: '#e8e8f0', fontWeight: 600 },
  };

  return (
    <div className="p-4 md:p-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/dashboard')} className="text-[#6b6b80] hover:text-[#e8e8f0] text-sm transition flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Tableau de bord
        </button>
        <button
          onClick={downloadCsv}
          className="glass hover:bg-[rgba(255,255,255,0.04)] px-4 py-2 rounded-lg text-sm text-[#e8e8f0] transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Exporter CSV
        </button>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Title card */}
        <div className="glass rounded-xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[rgba(124,92,252,0.1)] border border-[rgba(124,92,252,0.15)] rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#7c5cfc]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h1 className="text-xl font-semibold text-[#e8e8f0]">{session.quiz_title}</h1>
              </div>
              <div className="flex items-center gap-4 text-sm text-[#6b6b80]">
                <span className="font-mono bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded">{session.code}</span>
                <span>{session.total_participants} participant{session.total_participants > 1 ? 's' : ''}</span>
                <span>{session.total_questions} question{session.total_questions > 1 ? 's' : ''}</span>
                <span className="hidden sm:inline">
                  {new Date(session.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`text-center px-4 py-2 rounded-xl border ${global_stats.success_rate >= 50 ? 'bg-[rgba(52,211,153,0.08)] border-[rgba(52,211,153,0.15)]' : 'bg-[rgba(248,113,113,0.08)] border-[rgba(248,113,113,0.15)]'}`}>
                <p className={`text-2xl font-bold ${global_stats.success_rate >= 50 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{global_stats.success_rate}%</p>
                <p className="text-xs text-[#6b6b80]">reussite</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            label="Score moyen"
            value={`${global_stats.avg_score}`}
            sub="pts"
            color="text-[#7c5cfc]"
            stagger="stagger-1"
          />
          <KpiCard
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            label="Participants"
            value={`${session.total_participants}`}
            color="text-[#a78bfa]"
            stagger="stagger-2"
          />
          <KpiCard
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
            label="Plus facile"
            value={global_stats.easiest_question ? `${global_stats.easiest_question.correct_percentage}%` : '-'}
            sub={global_stats.easiest_question?.text}
            color="text-[#34d399]"
            stagger="stagger-3"
          />
          <KpiCard
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>}
            label="Plus difficile"
            value={global_stats.hardest_question ? `${global_stats.hardest_question.correct_percentage}%` : '-'}
            sub={global_stats.hardest_question?.text}
            color="text-[#f87171]"
            stagger="stagger-4"
          />
        </div>

        {/* Tab navigation — underline style */}
        <div className="flex border-b border-[rgba(255,255,255,0.06)]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'overview'
                ? 'text-[#e8e8f0]'
                : 'text-[#6b6b80] hover:text-[#e8e8f0]'
            }`}
          >
            Vue d'ensemble
            {activeTab === 'overview' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#7c5cfc] rounded-t" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-5 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'questions'
                ? 'text-[#e8e8f0]'
                : 'text-[#6b6b80] hover:text-[#e8e8f0]'
            }`}
          >
            Detail par question
            {activeTab === 'questions' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#7c5cfc] rounded-t" />
            )}
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
            {/* Chart + Leaderboard side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar chart */}
              <section className="glass rounded-xl p-5 md:p-6">
                <h2 className="text-base font-semibold text-[#e8e8f0] mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#7c5cfc]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Correctes vs Incorrectes
                </h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: '#6b6b80', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b6b80', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ color: '#6b6b80', fontSize: 12, paddingTop: '12px' }} />
                    <Bar dataKey="correct" name="Correctes" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="incorrect" name="Incorrectes" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>

              {/* Leaderboard */}
              <section className="glass rounded-xl p-5 md:p-6">
                <h2 className="text-base font-semibold text-[#e8e8f0] mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#fbbf24]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                  Classement
                </h2>

                {/* Podium top 3 */}
                {leaderboard.length >= 1 && (
                  <div className="flex items-end justify-center gap-2 mb-5 px-2">
                    {leaderboard.length >= 2 && (
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-2xl mb-1">&#x1F948;</span>
                        <p className="text-sm font-semibold text-[#e8e8f0] truncate max-w-full">{leaderboard[1].nickname}</p>
                        <p className="text-xs font-mono text-[#7c5cfc]">{leaderboard[1].score} pts</p>
                        <div className="w-full h-16 bg-gradient-to-t from-[rgba(107,107,128,0.3)] to-[rgba(107,107,128,0.15)] rounded-t-lg mt-2 flex items-center justify-center">
                          <span className="text-xl font-black text-white/60">2</span>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-3xl mb-1">&#x1F947;</span>
                      <p className="text-sm font-bold text-[#fbbf24] truncate max-w-full">{leaderboard[0].nickname}</p>
                      <p className="text-xs font-mono text-[#fbbf24]">{leaderboard[0].score} pts</p>
                      <div className="w-full h-24 bg-gradient-to-t from-[rgba(251,191,36,0.3)] to-[rgba(251,191,36,0.15)] rounded-t-lg mt-2 flex items-center justify-center">
                        <span className="text-2xl font-black text-white/60">1</span>
                      </div>
                    </div>
                    {leaderboard.length >= 3 && (
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-2xl mb-1">&#x1F949;</span>
                        <p className="text-sm font-semibold text-[#e8e8f0] truncate max-w-full">{leaderboard[2].nickname}</p>
                        <p className="text-xs font-mono text-[#7c5cfc]">{leaderboard[2].score} pts</p>
                        <div className="w-full h-12 bg-gradient-to-t from-[rgba(217,119,6,0.3)] to-[rgba(217,119,6,0.15)] rounded-t-lg mt-2 flex items-center justify-center">
                          <span className="text-xl font-black text-white/60">3</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Rest of leaderboard */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {leaderboard.slice(3).map((p) => (
                    <div key={p.rank} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[rgba(255,255,255,0.04)] text-[#6b6b80] flex items-center justify-center text-xs font-bold">{p.rank}</span>
                        <span className="text-sm font-medium text-[#e8e8f0]">{p.nickname}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#6b6b80] hidden sm:inline">{p.correct_answers}/{p.total_answers}</span>
                        <span className="text-sm font-mono text-[#7c5cfc]">{p.score} pts</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Full table for details */}
                {leaderboard.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[#6b6b80]">
                            <th className="text-left pb-2">#</th>
                            <th className="text-left pb-2">Joueur</th>
                            <th className="text-right pb-2">Score</th>
                            <th className="text-right pb-2">Bonnes rep.</th>
                            <th className="text-right pb-2">Temps moy.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.map((p) => (
                            <tr key={p.rank} className="border-t border-[rgba(255,255,255,0.04)] text-[#e8e8f0]">
                              <td className="py-1.5 font-medium">{p.rank}</td>
                              <td className="py-1.5">{p.nickname}</td>
                              <td className="py-1.5 text-right font-mono text-[#7c5cfc]">{p.score}</td>
                              <td className="py-1.5 text-right">{p.correct_answers}/{p.total_answers}</td>
                              <td className="py-1.5 text-right">{p.avg_response_time}s</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Per-question success rate bars */}
            <section className="glass rounded-xl p-5 md:p-6">
              <h2 className="text-base font-semibold text-[#e8e8f0] mb-5 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#a78bfa]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Taux de reussite par question
              </h2>
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.question_id} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-[#e8e8f0] truncate max-w-[60%]">
                        <span className="text-[#7c5cfc] font-semibold mr-1.5">Q{i + 1}</span>
                        {q.text}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-[#6b6b80] shrink-0">
                        <span>{q.avg_response_time}s</span>
                        <span className={`font-semibold ${q.correct_percentage >= 50 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                          {q.correct_percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="h-3 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          q.correct_percentage >= 70 ? 'bg-gradient-to-r from-[#34d399] to-[#5eead4]' :
                          q.correct_percentage >= 40 ? 'bg-gradient-to-r from-[#fbbf24] to-[#fcd34d]' :
                          'bg-gradient-to-r from-[#f87171] to-[#fca5a5]'
                        }`}
                        style={{ width: `${q.correct_percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-5">
            {questions.map((q, i) => (
              <div key={q.question_id} className="glass rounded-xl overflow-hidden">
                {/* Question header */}
                <div className="px-5 md:px-6 pt-5 md:pt-6 pb-4">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <h3 className="text-base font-semibold text-[#e8e8f0]">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[rgba(124,92,252,0.1)] text-[#7c5cfc] text-sm font-bold mr-2.5">{i + 1}</span>
                      {q.text}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 mt-3 ml-9">
                    <div className={`flex items-center gap-1.5 text-sm font-medium ${q.correct_percentage >= 50 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {q.correct_percentage >= 50
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        }
                      </svg>
                      {q.correct_percentage}% correct
                    </div>
                    <span className="text-sm text-[#6b6b80]">{q.total_responses} reponse{q.total_responses > 1 ? 's' : ''}</span>
                    <span className="text-sm text-[#6b6b80]">{q.avg_response_time}s en moy.</span>
                  </div>
                </div>

                {q.image_url && (
                  <div className="px-5 md:px-6 pb-4">
                    <img
                      src={q.image_url}
                      alt="Question"
                      className="max-h-48 object-contain rounded-xl bg-[rgba(255,255,255,0.02)] cursor-pointer hover:opacity-80 transition"
                      onClick={() => setPreviewImage(q.image_url!)}
                    />
                  </div>
                )}

                {/* Answer distribution with custom bars */}
                <div className="px-5 md:px-6 pb-5 md:pb-6 space-y-2">
                  {q.answer_distribution.map((a) => (
                    <div key={a.answer_id} className="group">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                          a.is_correct ? 'bg-[rgba(52,211,153,0.15)] border border-[rgba(52,211,153,0.3)]' : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]'
                        }`}>
                          {a.is_correct && (
                            <svg className="w-3 h-3 text-[#34d399]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm truncate ${a.is_correct ? 'text-[#34d399] font-medium' : 'text-[#e8e8f0]'}`}>{a.text}</span>
                            <span className="text-xs text-[#6b6b80] ml-2 shrink-0">{a.count} ({a.percentage}%)</span>
                          </div>
                          <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${a.is_correct ? 'bg-[#34d399]' : 'bg-[rgba(255,255,255,0.1)]'}`}
                              style={{ width: `${a.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image preview modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-8 cursor-pointer" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 glass hover:bg-[rgba(255,255,255,0.04)] rounded-full flex items-center justify-center text-white transition" onClick={() => setPreviewImage(null)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img src={previewImage} alt="Apercu" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color = 'text-[#7c5cfc]', stagger = '' }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  stagger?: string;
}) {
  return (
    <div className={`glass card-hover rounded-xl p-4 ${stagger}`}>
      <div className={`${color} mb-2`}>{icon}</div>
      <p className="text-[#6b6b80] text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[#3d3d52] text-xs mt-1 truncate">{sub}</p>}
    </div>
  );
}
