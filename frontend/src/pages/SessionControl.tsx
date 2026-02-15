import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, authFetch } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Session, LeaderboardEntry, WsMessage } from '../lib/types';

export default function SessionControl() {
  const { sid } = useParams<{ sid: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem('token') || '';

  const [session, setSession] = useState<Session | null>(null);
  const [qrData, setQrData] = useState<{ qr_base64: string; join_url: string; code: string } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameStatus, setGameStatus] = useState<string>('lobby');
  const [questionIdx, setQuestionIdx] = useState(-1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Record<string, unknown> | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState<{ total_responses: number; correct_count: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(t);
  }, [error]);

  // Polling: refresh session every 5s while in lobby
  useEffect(() => {
    if (gameStatus !== 'lobby' || !sid) return;
    const interval = setInterval(() => {
      api.get<Session>(`/sessions/${sid}`).then(setSession).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [gameStatus, sid]);

  useEffect(() => {
    if (!sid) return;
    api.get<Session>(`/sessions/${sid}`).then((s) => {
      setSession(s);
      setGameStatus(s.status);
      setQuestionIdx(s.current_question_idx);
    }).catch((e) => setError(e.message));

    const fetchQr = async () => {
      let baseUrl = window.location.origin;
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        try {
          const info = await api.get<{ lan_ip: string }>('/network-info');
          baseUrl = `${window.location.protocol}//${info.lan_ip}:${window.location.port}`;
        } catch { /* fallback to origin */ }
      }
      const qr = await api.get<{ qr_base64: string; join_url: string; code: string }>(
        `/sessions/${sid}/qrcode?base_url=${encodeURIComponent(baseUrl)}`
      );
      setQrData(qr);
    };
    fetchQr().catch((e) => setError(e.message));
  }, [sid]);

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'participant_joined':
        if (sid) api.get<Session>(`/sessions/${sid}`).then(setSession).catch(() => {});
        break;
      case 'participant_connected':
        setOnlineCount(msg.online_count as number);
        if (sid) api.get<Session>(`/sessions/${sid}`).then(setSession).catch(() => {});
        break;
      case 'participant_disconnected':
        setOnlineCount(msg.online_count as number);
        break;
      case 'game_started':
        setGameStatus('active');
        setTotalQuestions(msg.total_questions as number);
        break;
      case 'new_question':
        setQuestionIdx(msg.question_idx as number);
        setTotalQuestions(msg.total_questions as number);
        setCurrentQuestion(msg as Record<string, unknown>);
        setAnsweredCount(0);
        setRevealed(false);
        setStats(null);
        setGameStatus('active');
        break;
      case 'answer_received':
        setAnsweredCount(msg.answered_count as number);
        break;
      case 'answer_revealed':
        setRevealed(true);
        setStats(msg.stats as { total_responses: number; correct_count: number });
        setLeaderboard(msg.leaderboard as LeaderboardEntry[]);
        setGameStatus('revealing');
        break;
      case 'game_ended':
        setGameStatus('finished');
        setLeaderboard(msg.leaderboard as LeaderboardEntry[]);
        break;
    }
  }, [sid]);

  const { send, connected } = useWebSocket({
    sessionId: sid || '',
    role: 'admin',
    token,
    onMessage: handleMessage,
  });

  const startGame = () => send({ type: 'start_game' });
  const nextQuestion = () => send({ type: 'next_question' });
  const revealAnswer = () => send({ type: 'reveal_answer' });
  const endGame = () => send({ type: 'end_game' });

  const downloadCsv = async () => {
    try {
      const res = await authFetch(`/sessions/${sid}/export`);
      if (!res.ok) throw new Error('Échec du téléchargement');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session_${session?.code || sid}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Impossible de télécharger le CSV');
    }
  };

  if (!session) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Chargement...</div>;

  const totalParticipants = session.participants.length;
  const isLastQuestion = questionIdx >= totalQuestions - 1;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">
          &larr; Tableau de bord
        </button>
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-sm text-gray-400">{connected ? 'Connecté' : 'Déconnecté'}</span>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-6 py-3 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-4">X</button>
        </div>
      )}

      <main className="max-w-4xl mx-auto p-6">
        {/* LOBBY */}
        {gameStatus === 'lobby' && (
          <div className="text-center space-y-8">
            <h2 className="text-2xl font-bold">Salle d'attente</h2>
            {qrData && (
              <div className="inline-block bg-white p-4 rounded-2xl">
                <img src={qrData.qr_base64} alt="QR Code" className="w-64 h-64" />
              </div>
            )}
            <div>
              <p className="text-gray-400 mb-2">Code d'accès :</p>
              <p className="text-5xl font-mono font-bold text-indigo-400 tracking-widest">
                {session.code}
              </p>
              {qrData && <p className="text-gray-500 text-sm mt-2">{qrData.join_url}</p>}
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="text-gray-400 mb-2">
                {totalParticipants} joueur{totalParticipants > 1 && 's'} inscrit{totalParticipants > 1 && 's'}
                ({onlineCount} en ligne)
              </p>
              <p className="text-gray-500 text-xs mb-4">500 à 1000 pts par bonne réponse (bonus rapidité)</p>
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {session.participants.map((p) => (
                  <span key={p.id} className="px-3 py-1 bg-gray-800 rounded-full text-sm">
                    {p.nickname}
                  </span>
                ))}
              </div>
              <button
                onClick={startGame}
                disabled={totalParticipants === 0}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold text-lg transition disabled:opacity-50"
              >
                Démarrer la partie
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE / REVEALING */}
        {(gameStatus === 'active' || gameStatus === 'revealing') && currentQuestion && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">
                Question {questionIdx + 1} / {totalQuestions}
              </span>
              <span className="text-gray-400">
                {answeredCount} / {totalParticipants} ont répondu
              </span>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <h2 className="text-2xl font-bold mb-6">{currentQuestion.text as string}</h2>
              <div className="grid grid-cols-2 gap-4">
                {(currentQuestion.answers as Array<{ id: string; text: string; is_correct?: boolean; order: number }>).map(
                  (a, i) => {
                    const ansColors = ['bg-red-500/30', 'bg-blue-500/30', 'bg-yellow-500/30', 'bg-green-500/30'];
                    return (
                      <div
                        key={a.id}
                        className={`p-4 rounded-xl text-lg font-medium ${ansColors[i] || 'bg-gray-800'} ${
                          revealed && a.is_correct ? 'ring-4 ring-green-400' : ''
                        }`}
                      >
                        {a.text}
                        {revealed && a.is_correct && <span className="ml-2">{'\u2713'}</span>}
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {revealed && stats && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-center text-gray-400 mb-4">
                  {stats.correct_count} / {stats.total_responses} correct{stats.correct_count > 1 && 's'}
                </p>
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((e) => (
                    <div key={e.participant_id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {e.rank === 1 ? '\uD83E\uDD47' : e.rank === 2 ? '\uD83E\uDD48' : e.rank === 3 ? '\uD83E\uDD49' : `${e.rank}.`}
                        </span>
                        <span>{e.nickname}</span>
                      </div>
                      <span className="font-mono text-indigo-400">{e.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              {!revealed ? (
                <button
                  onClick={revealAnswer}
                  className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-xl font-semibold transition"
                >
                  Révéler la réponse
                </button>
              ) : isLastQuestion ? (
                <button
                  onClick={endGame}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-semibold transition"
                >
                  Terminer la partie
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition"
                >
                  Question suivante &rarr;
                </button>
              )}
            </div>
          </div>
        )}

        {/* FINISHED */}
        {gameStatus === 'finished' && (
          <div className="space-y-6 text-center">
            <h2 className="text-3xl font-bold">{'\uD83C\uDFC1'} Partie terminée !</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">Classement final</h3>
              <div className="space-y-2 max-w-md mx-auto">
                {leaderboard.map((e) => (
                  <div key={e.participant_id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {e.rank === 1 ? '\uD83E\uDD47' : e.rank === 2 ? '\uD83E\uDD48' : e.rank === 3 ? '\uD83E\uDD49' : `${e.rank}.`}
                      </span>
                      <span className="font-medium">{e.nickname}</span>
                    </div>
                    <span className="font-mono text-indigo-400 text-lg">{e.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate(`/session/${sid}/analytics`)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition"
              >
                Analytique
              </button>
              <button
                onClick={downloadCsv}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold transition"
              >
                Exporter CSV
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition"
              >
                Retour au tableau de bord
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
