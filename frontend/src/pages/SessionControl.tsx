import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { api, authFetch } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Session, LeaderboardEntry, WsMessage } from '../lib/types';

export default function SessionControl() {
  const { sid } = useParams<{ sid: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem('token') || '';
  const containerRef = useRef<HTMLDivElement>(null);

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
  const [playerResults, setPlayerResults] = useState<Array<{participant_id: string; nickname: string; is_correct: boolean; answer_id: string | null; points_awarded: number}>>([]);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (gameStatus !== 'finished') return;
    const duration = 3000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [gameStatus]);

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
        setPlayerResults([]);
        setGameStatus('active');
        break;
      case 'answer_received':
        setAnsweredCount(msg.answered_count as number);
        break;
      case 'answer_revealed':
        setRevealed(true);
        setStats(msg.stats as { total_responses: number; correct_count: number });
        setLeaderboard(msg.leaderboard as LeaderboardEntry[]);
        setPlayerResults(msg.player_results as Array<{participant_id: string; nickname: string; is_correct: boolean; answer_id: string | null; points_awarded: number}> || []);
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

  const forceFinishRest = async () => {
    try {
      await api.post(`/sessions/${sid}/finish`);
      setGameStatus('finished');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Echec de la terminaison');
    }
  };

  const downloadCsv = async () => {
    try {
      const res = await authFetch(`/sessions/${sid}/export`);
      if (!res.ok) throw new Error('Echec du telechargement');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session_${session?.code || sid}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Impossible de telecharger le CSV');
    }
  };

  if (!session) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Chargement...
        </div>
      </div>
    );
  }

  const totalParticipants = session.participants.length;
  const isLastQuestion = questionIdx >= totalQuestions - 1;

  return (
    <div ref={containerRef} className={`${isFullscreen ? 'bg-slate-950 min-h-screen flex flex-col overflow-auto' : 'p-6'}`}>
      <div className={`flex items-center justify-between ${isFullscreen ? 'px-6 py-3 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10' : 'mb-6'}`}>
        <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-slate-100 text-sm transition flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Tableau de bord
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-sm text-slate-400">{connected ? 'Connecte' : 'Deconnecte'}</span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-slate-400 hover:text-slate-100 transition rounded-lg hover:bg-slate-700/50"
            title={isFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v5m0-5h5m6 6l5 5m0 0v-5m0 5h-5m-6 0l-5 5m0 0v-5m0 5h5m6-6l5-5m0 0v5m0-5h-5" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0 0l-5-5m-7 14l-5 5m0 0h4m-4 0v-4m16 4l-5-5m5 5v-4m0 4h-4" /></svg>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className={`mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center justify-between ${isFullscreen ? 'mx-6' : ''}`}>
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className={isFullscreen ? 'w-full flex-1 flex flex-col px-8 pb-6' : 'max-w-4xl mx-auto'}>
        {/* LOBBY */}
        {gameStatus === 'lobby' && (
          <div className={`text-center space-y-8 ${isFullscreen ? 'flex-1 flex flex-col items-center justify-center' : ''}`}>
            <h2 className={`${isFullscreen ? 'text-3xl md:text-4xl' : 'text-2xl'} font-bold text-white`}>Salle d'attente</h2>

            {qrData && (
              <div className="inline-block">
                <div className="bg-white p-5 rounded-2xl shadow-2xl shadow-indigo-500/10">
                  <img src={qrData.qr_base64} alt="QR Code" className="w-64 h-64" />
                </div>
              </div>
            )}

            <div>
              <p className="text-slate-400 text-sm mb-2">Code d'acces</p>
              <p className="text-5xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 tracking-widest">
                {session.code}
              </p>
              {qrData && <p className="text-slate-500 text-xs mt-2">{qrData.join_url}</p>}
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-3xl font-bold text-white">{totalParticipants}</p>
                  <p className="text-xs text-slate-500 mt-1">Joueur{totalParticipants > 1 && 's'} inscrit{totalParticipants > 1 && 's'}</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-3xl font-bold text-emerald-400">{onlineCount}</p>
                  <p className="text-xs text-slate-500 mt-1">En ligne</p>
                </div>
              </div>

              <p className="text-slate-500 text-xs mb-4">500 a 1000 pts par bonne reponse (bonus rapidite)</p>

              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {session.participants.map((p) => (
                  <span key={p.id} className="px-3 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-full text-sm text-slate-300">
                    {p.nickname}
                  </span>
                ))}
              </div>

              <button
                onClick={startGame}
                disabled={totalParticipants === 0}
                className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 rounded-xl font-semibold text-lg transition-all duration-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
              >
                Demarrer la partie
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE / REVEALING */}
        {(gameStatus === 'active' || gameStatus === 'revealing') && currentQuestion && (
          <div className={`space-y-6 ${isFullscreen ? 'flex-1 flex flex-col' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`bg-indigo-500/20 text-indigo-400 font-medium rounded-full ${isFullscreen ? 'px-5 py-2 text-lg' : 'px-3 py-1 text-sm'}`}>
                  Question {questionIdx + 1} / {totalQuestions}
                </span>
              </div>
              <div className={`flex items-center gap-2 text-slate-400 ${isFullscreen ? 'text-lg' : 'text-sm'}`}>
                <svg className={`${isFullscreen ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {answeredCount} / {totalParticipants} ont repondu
              </div>
            </div>

            <div className={`bg-slate-800/50 border border-slate-700/50 rounded-xl text-center ${isFullscreen ? 'flex-1 flex flex-col items-center justify-center p-10 w-full' : 'p-8'}`}>
              <h2 className={`${isFullscreen ? 'text-4xl md:text-5xl' : 'text-2xl'} font-bold text-white mb-8`}>{currentQuestion.text as string}</h2>
              {!!currentQuestion.image_url && (
                <img src={currentQuestion.image_url as string} alt="Question" className={`${isFullscreen ? 'max-h-[65vh]' : 'max-h-80'} w-full object-contain rounded-xl bg-slate-900/50 mx-auto mb-6`} />
              )}
              <div className={`grid grid-cols-2 ${isFullscreen ? 'gap-6 w-full' : 'gap-4'}`}>
                {(currentQuestion.answers as Array<{ id: string; text: string; is_correct?: boolean; order: number }>).map(
                  (a, i) => {
                    const ansColors = ['bg-red-500/20 border-red-500/30', 'bg-blue-500/20 border-blue-500/30', 'bg-yellow-500/20 border-yellow-500/30', 'bg-green-500/20 border-green-500/30'];
                    return (
                      <div
                        key={a.id}
                        className={`${isFullscreen ? 'p-8 text-2xl' : 'p-4 text-lg'} rounded-xl font-medium border transition-all duration-300 ${ansColors[i] || 'bg-slate-800 border-slate-700'} ${
                          revealed && a.is_correct ? 'ring-4 ring-green-400/50 border-green-400 shadow-lg shadow-green-500/20' : ''
                        }`}
                      >
                        {a.text}
                        {revealed && a.is_correct && (
                          <span className="ml-2 inline-flex items-center">
                            <svg className={`${isFullscreen ? 'w-6 h-6' : 'w-5 h-5'} text-green-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          </span>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {revealed && stats && (
              <div className={`bg-slate-800/50 border border-slate-700/50 rounded-xl ${isFullscreen ? 'p-8 w-full' : 'p-6'}`}>
                {/* Résultats par joueur - section principale */}
                {playerResults.length > 0 && (
                  <div className={isFullscreen ? 'mb-8' : 'mb-6'}>
                    <div className={`flex items-center justify-between ${isFullscreen ? 'mb-6' : 'mb-4'}`}>
                      <h3 className={`${isFullscreen ? 'text-xl' : 'text-base'} font-bold text-white`}>Qui a bon ?</h3>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg ${isFullscreen ? 'px-4 py-2' : 'px-3 py-1.5'}`}>
                          <svg className={`${isFullscreen ? 'w-5 h-5' : 'w-4 h-4'} text-emerald-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          <span className={`${isFullscreen ? 'text-lg' : 'text-sm'} font-bold text-emerald-400`}>{stats.correct_count}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg ${isFullscreen ? 'px-4 py-2' : 'px-3 py-1.5'}`}>
                          <svg className={`${isFullscreen ? 'w-5 h-5' : 'w-4 h-4'} text-red-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                          <span className={`${isFullscreen ? 'text-lg' : 'text-sm'} font-bold text-red-400`}>{stats.total_responses - stats.correct_count}</span>
                        </div>
                      </div>
                    </div>

                    {/* Correct players */}
                    {playerResults.filter(pr => pr.is_correct).length > 0 && (
                      <div className={isFullscreen ? 'mb-4' : 'mb-3'}>
                        <div className={`grid grid-cols-2 sm:grid-cols-3 ${isFullscreen ? 'md:grid-cols-5 lg:grid-cols-6 gap-3' : 'md:grid-cols-4 gap-2'}`}>
                          {playerResults.filter(pr => pr.is_correct).map((pr) => (
                            <div
                              key={pr.participant_id}
                              className={`flex items-center gap-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 transition-all ${isFullscreen ? 'px-5 py-4 text-lg' : 'px-3 py-2.5 text-sm'}`}
                            >
                              <svg className={`${isFullscreen ? 'w-6 h-6' : 'w-5 h-5'} text-emerald-400 shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              <span className="font-semibold text-emerald-200 truncate">{pr.nickname}</span>
                              {pr.points_awarded > 0 && (
                                <span className={`ml-auto text-emerald-400 font-mono font-bold shrink-0 ${isFullscreen ? 'text-base' : 'text-xs'}`}>+{pr.points_awarded}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Wrong players */}
                    {playerResults.filter(pr => !pr.is_correct).length > 0 && (
                      <div>
                        <div className={`grid grid-cols-2 sm:grid-cols-3 ${isFullscreen ? 'md:grid-cols-5 lg:grid-cols-6 gap-3' : 'md:grid-cols-4 gap-2'}`}>
                          {playerResults.filter(pr => !pr.is_correct && pr.answer_id).map((pr) => (
                            <div
                              key={pr.participant_id}
                              className={`flex items-center gap-2.5 rounded-xl bg-red-500/10 border border-red-500/25 transition-all ${isFullscreen ? 'px-5 py-4 text-lg' : 'px-3 py-2.5 text-sm'}`}
                            >
                              <svg className={`${isFullscreen ? 'w-6 h-6' : 'w-5 h-5'} text-red-400 shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                              <span className="font-medium text-red-300 truncate">{pr.nickname}</span>
                            </div>
                          ))}
                          {playerResults.filter(pr => !pr.is_correct && !pr.answer_id).map((pr) => (
                            <div
                              key={pr.participant_id}
                              className={`flex items-center gap-2.5 rounded-xl bg-slate-700/30 border border-slate-600/30 transition-all ${isFullscreen ? 'px-5 py-4 text-lg' : 'px-3 py-2.5 text-sm'}`}
                            >
                              <svg className={`${isFullscreen ? 'w-6 h-6' : 'w-5 h-5'} text-slate-500 shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span className="font-medium text-slate-500 truncate">{pr.nickname}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Leaderboard top 5 */}
                <div className={`space-y-2 ${isFullscreen ? 'space-y-3' : ''}`}>
                  {leaderboard.slice(0, 5).map((e, i) => (
                    <div key={e.participant_id} className={`flex items-center justify-between rounded-xl transition ${isFullscreen ? 'px-6 py-4' : 'px-4 py-3'} ${
                      i === 0 ? 'bg-yellow-500/10 border border-yellow-500/20' :
                      i === 1 ? 'bg-slate-400/5 border border-slate-500/20' :
                      i === 2 ? 'bg-amber-600/5 border border-amber-600/20' :
                      'bg-slate-700/30 border border-slate-700/50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`${isFullscreen ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs'} rounded-full flex items-center justify-center font-bold ${
                          i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          i === 1 ? 'bg-slate-400/20 text-slate-300' :
                          i === 2 ? 'bg-amber-600/20 text-amber-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {e.rank}
                        </span>
                        <span className={`font-medium text-slate-200 ${isFullscreen ? 'text-lg' : ''}`}>{e.nickname}</span>
                      </div>
                      <span className={`font-mono text-indigo-400 font-medium ${isFullscreen ? 'text-lg' : ''}`}>{e.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`flex gap-4 justify-center ${isFullscreen ? 'pt-6 pb-2' : ''}`}>
              {!revealed ? (
                <button
                  onClick={revealAnswer}
                  className={`${isFullscreen ? 'px-8 py-4 text-lg' : 'px-6 py-3'} bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-yellow-600/20`}
                >
                  Reveler la reponse
                </button>
              ) : isLastQuestion ? (
                <button
                  onClick={endGame}
                  className={`${isFullscreen ? 'px-8 py-4 text-lg' : 'px-6 py-3'} bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-red-600/20`}
                >
                  Terminer la partie
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  className={`${isFullscreen ? 'px-8 py-4 text-lg' : 'px-6 py-3'} bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-indigo-600/20 flex items-center gap-2`}
                >
                  Question suivante
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              )}
              {!connected && (
                <button
                  onClick={forceFinishRest}
                  className={`${isFullscreen ? 'px-8 py-4 text-lg' : 'px-6 py-3'} bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl font-semibold transition-all duration-300`}
                  title="Terminer via REST (WebSocket deconnecte)"
                >
                  Forcer la fin
                </button>
              )}
            </div>
          </div>
        )}

        {/* FINISHED - Podium */}
        {gameStatus === 'finished' && (
          <div className={`space-y-8 text-center ${isFullscreen ? 'flex-1 flex flex-col items-center justify-center' : ''}`}>
            <div>
              <h2 className={`${isFullscreen ? 'text-4xl md:text-5xl' : 'text-3xl'} font-bold text-white mb-2`}>Partie terminee !</h2>
              <p className={`text-slate-400 ${isFullscreen ? 'text-lg' : ''}`}>Voici le podium final</p>
            </div>

            {/* Podium visuel */}
            {leaderboard.length >= 1 && (
              <div className={`flex items-end justify-center gap-3 ${isFullscreen ? 'gap-4 mt-8' : 'mt-6'}`}>
                {/* 2eme place */}
                {leaderboard.length >= 2 && (
                  <div className="flex flex-col items-center animate-[slideUp_0.8s_ease-out_0.3s_both]">
                    <div className={`${isFullscreen ? 'text-5xl mb-3' : 'text-4xl mb-2'}`}>&#x1F948;</div>
                    <p className={`font-bold text-slate-200 ${isFullscreen ? 'text-xl mb-2' : 'text-lg mb-1'}`}>{leaderboard[1].nickname}</p>
                    <p className={`font-mono text-indigo-400 ${isFullscreen ? 'text-lg mb-3' : 'mb-2'}`}>{leaderboard[1].score} pts</p>
                    <div className={`${isFullscreen ? 'w-36 h-36' : 'w-28 h-28'} bg-gradient-to-t from-slate-600 to-slate-400 rounded-t-xl flex items-center justify-center shadow-lg shadow-slate-500/20`}>
                      <span className={`${isFullscreen ? 'text-5xl' : 'text-4xl'} font-black text-white/80`}>2</span>
                    </div>
                  </div>
                )}

                {/* 1ere place */}
                <div className="flex flex-col items-center animate-[slideUp_0.8s_ease-out_both]">
                  <div className={`${isFullscreen ? 'text-6xl mb-3' : 'text-5xl mb-2'}`}>&#x1F947;</div>
                  <p className={`font-bold text-yellow-300 ${isFullscreen ? 'text-2xl mb-2' : 'text-xl mb-1'}`}>{leaderboard[0].nickname}</p>
                  <p className={`font-mono text-yellow-400 ${isFullscreen ? 'text-xl mb-3' : 'text-lg mb-2'}`}>{leaderboard[0].score} pts</p>
                  <div className={`${isFullscreen ? 'w-40 h-48' : 'w-32 h-40'} bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-t-xl flex items-center justify-center shadow-lg shadow-yellow-500/30`}>
                    <span className={`${isFullscreen ? 'text-6xl' : 'text-5xl'} font-black text-white/80`}>1</span>
                  </div>
                </div>

                {/* 3eme place */}
                {leaderboard.length >= 3 && (
                  <div className="flex flex-col items-center animate-[slideUp_0.8s_ease-out_0.6s_both]">
                    <div className={`${isFullscreen ? 'text-5xl mb-3' : 'text-4xl mb-2'}`}>&#x1F949;</div>
                    <p className={`font-bold text-slate-200 ${isFullscreen ? 'text-xl mb-2' : 'text-lg mb-1'}`}>{leaderboard[2].nickname}</p>
                    <p className={`font-mono text-indigo-400 ${isFullscreen ? 'text-lg mb-3' : 'mb-2'}`}>{leaderboard[2].score} pts</p>
                    <div className={`${isFullscreen ? 'w-36 h-28' : 'w-28 h-20'} bg-gradient-to-t from-amber-700 to-amber-500 rounded-t-xl flex items-center justify-center shadow-lg shadow-amber-600/20`}>
                      <span className={`${isFullscreen ? 'text-5xl' : 'text-4xl'} font-black text-white/80`}>3</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Classement complet (4eme et au-dela) */}
            {leaderboard.length > 3 && (
              <div className={`bg-slate-800/50 border border-slate-700/50 rounded-xl ${isFullscreen ? 'p-6 max-w-3xl w-full' : 'p-4 max-w-lg'} mx-auto`}>
                <h3 className={`${isFullscreen ? 'text-lg mb-4' : 'text-sm mb-3'} font-semibold text-slate-400`}>Classement complet</h3>
                <div className={`space-y-2 ${isFullscreen ? 'space-y-3' : ''}`}>
                  {leaderboard.slice(3).map((e) => (
                    <div key={e.participant_id} className={`flex items-center justify-between rounded-xl bg-slate-700/30 border border-slate-700/50 ${isFullscreen ? 'px-6 py-3' : 'px-4 py-2'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`${isFullscreen ? 'w-8 h-8 text-sm' : 'w-7 h-7 text-xs'} rounded-full bg-slate-700 text-slate-400 flex items-center justify-center font-bold`}>
                          {e.rank}
                        </span>
                        <span className={`font-medium text-slate-200 ${isFullscreen ? 'text-base' : 'text-sm'}`}>{e.nickname}</span>
                      </div>
                      <span className={`font-mono text-indigo-400 ${isFullscreen ? 'text-base' : 'text-sm'}`}>{e.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={() => navigate(`/session/${sid}/analytics`)}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-indigo-600/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Analytique
              </button>
              <button
                onClick={downloadCsv}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Exporter CSV
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Retour au tableau de bord
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
