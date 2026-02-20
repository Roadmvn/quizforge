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
      const baseUrl = window.location.origin;
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

  /* ---------- LOADING STATE ---------- */
  if (!session) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div
          className="animate-in flex flex-col items-center gap-4 px-10 py-8 rounded-2xl"
          style={{
            background: 'rgba(15, 15, 35, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(124, 92, 252, 0.08)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="spinner-premium" />
          <span className="text-[#8888a0] text-sm font-medium tracking-wide">Chargement de la session...</span>
        </div>
      </div>
    );
  }

  const totalParticipants = session.participants.length;
  const isLastQuestion = questionIdx >= totalQuestions - 1;

  /* ====================================================================
     GLASS CARD STYLE CONSTANTS
     ==================================================================== */
  const glassCard: React.CSSProperties = {
    background: 'rgba(15, 15, 35, 0.6)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(124, 92, 252, 0.08)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
  };

  const glassCardStrong: React.CSSProperties = {
    background: 'rgba(15, 15, 35, 0.75)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(124, 92, 252, 0.12)',
    boxShadow: '0 12px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
  };

  const gradientBtnPurple: React.CSSProperties = {
    background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
    boxShadow: '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)',
  };

  const gradientBtnGreen: React.CSSProperties = {
    background: 'linear-gradient(135deg, #34d399, #10b981)',
    boxShadow: '0 0 25px rgba(52,211,153,0.25), 0 4px 15px rgba(52,211,153,0.2)',
  };

  const gradientBtnYellow: React.CSSProperties = {
    background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
    boxShadow: '0 0 25px rgba(251,191,36,0.25), 0 4px 15px rgba(251,191,36,0.2)',
  };

  const gradientBtnRed: React.CSSProperties = {
    background: 'linear-gradient(135deg, #f87171, #ef4444)',
    boxShadow: '0 0 25px rgba(248,113,113,0.25), 0 4px 15px rgba(248,113,113,0.2)',
  };

  const iconBadgePurple: React.CSSProperties = {
    background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
    boxShadow: '0 0 20px rgba(124,92,252,0.3)',
  };

  const iconBadgeGreen: React.CSSProperties = {
    background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
    boxShadow: '0 0 20px rgba(52,211,153,0.3)',
  };

  /* Hover helper: amplify glow + lift */
  const hoverLift = (e: React.MouseEvent<HTMLElement>, baseBoxShadow: string) => {
    const el = e.currentTarget;
    el.style.transform = 'translateY(-2px)';
    el.style.boxShadow = baseBoxShadow.replace(/0\.25/g, '0.5').replace(/0\.2/g, '0.4');
  };
  const hoverReset = (e: React.MouseEvent<HTMLElement>, baseBoxShadow: string) => {
    const el = e.currentTarget;
    el.style.transform = 'translateY(0)';
    el.style.boxShadow = baseBoxShadow;
  };

  /* Left-border colors for answer cards */
  const answerBorderColors = ['#ef4444', '#60a5fa', '#fbbf24', '#34d399'];
  const answerBgColors = [
    'rgba(239,68,68,0.05)',
    'rgba(96,165,250,0.05)',
    'rgba(251,191,36,0.05)',
    'rgba(52,211,153,0.05)',
  ];

  return (
    <div ref={containerRef} className={`animate-in ${isFullscreen ? 'bg-[#06060e] min-h-screen flex flex-col overflow-auto' : 'p-6'}`}>

      {/* ================================================================
          TOP BAR
          ================================================================ */}
      <div
        className={`flex items-center justify-between rounded-2xl ${isFullscreen ? 'mx-6 mt-4 mb-2 px-5 py-3 sticky top-4 z-10' : 'mb-6 px-5 py-3'}`}
        style={glassCard}
      >
        {/* Back button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2.5 text-sm font-medium text-[#8888a0] transition-all duration-300"
          style={{ cursor: 'pointer' }}
          onMouseOver={(e) => { e.currentTarget.style.color = '#e8e8f0'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = '#8888a0'; }}
        >
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={iconBadgePurple}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </span>
          Tableau de bord
        </button>

        <div className="flex items-center gap-3">
          {/* Connection indicator glass badge */}
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full"
            style={{
              background: 'rgba(15, 15, 35, 0.5)',
              backdropFilter: 'blur(12px)',
              border: connected ? '1px solid rgba(52,211,153,0.15)' : '1px solid rgba(248,113,113,0.15)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: connected ? '#34d399' : '#f87171',
                boxShadow: connected ? '0 0 8px rgba(52,211,153,0.6)' : '0 0 8px rgba(248,113,113,0.6)',
                animation: connected ? 'pulse 2s infinite' : 'none',
              }}
            />
            <span className="text-xs font-medium" style={{ color: connected ? '#34d399' : '#f87171' }}>
              {connected ? 'Connecte' : 'Deconnecte'}
            </span>
          </div>

          {/* Fullscreen button in mini-card */}
          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{
              background: 'rgba(15, 15, 35, 0.5)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(124,92,252,0.1)',
            }}
            title={isFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.3)'; e.currentTarget.style.color = '#e8e8f0'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.1)'; e.currentTarget.style.color = '#8888a0'; }}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4 text-[#8888a0]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v5m0-5h5m6 6l5 5m0 0v-5m0 5h-5m-6 0l-5 5m0 0v-5m0 5h5m6-6l5-5m0 0v5m0-5h-5" /></svg>
            ) : (
              <svg className="w-4 h-4 text-[#8888a0]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0 0l-5-5m-7 14l-5 5m0 0h4m-4 0v-4m16 4l-5-5m5 5v-4m0 4h-4" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* ================================================================
          ERROR BANNER
          ================================================================ */}
      {error && (
        <div
          className={`mb-6 rounded-2xl px-5 py-3.5 flex items-center justify-between ${isFullscreen ? 'mx-6' : ''}`}
          style={{
            background: 'rgba(248,113,113,0.06)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(248,113,113,0.15)',
            boxShadow: '0 8px 32px rgba(248,113,113,0.08), inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #f87171, #ef4444)', boxShadow: '0 0 14px rgba(248,113,113,0.3)' }}
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <span className="text-sm text-[#f87171] font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError('')}
            className="text-[#f87171] hover:text-[#fca5a5] ml-4 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className={isFullscreen ? 'w-full flex-1 flex flex-col px-8 pb-6' : 'max-w-4xl mx-auto'}>

        {/* ================================================================
            LOBBY
            ================================================================ */}
        {gameStatus === 'lobby' && (
          <div className={`text-center space-y-8 ${isFullscreen ? 'flex-1 flex flex-col items-center justify-center' : ''}`}>

            {/* Title with gradient icon badge */}
            <div className="flex items-center justify-center gap-3">
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={iconBadgePurple}
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </span>
              <h2 className={`${isFullscreen ? 'text-3xl md:text-4xl' : 'text-2xl'} font-bold text-white`}>
                Salle d'attente
              </h2>
            </div>

            {/* QR + Code combined premium card */}
            {qrData && (
              <div
                className={`inline-flex flex-col md:flex-row items-center gap-8 rounded-3xl ${isFullscreen ? 'p-10' : 'p-8'}`}
                style={{
                  background: 'rgba(15, 15, 35, 0.7)',
                  backdropFilter: 'blur(24px)',
                  border: '1px solid rgba(124, 92, 252, 0.15)',
                  boxShadow: '0 0 80px rgba(124,92,252,0.08), 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                {/* QR Code with animated gradient border */}
                <div className="relative">
                  {/* Outer glow ring */}
                  <div
                    className="absolute -inset-1 rounded-2xl opacity-60"
                    style={{
                      background: 'linear-gradient(135deg, #7c5cfc, #a855f7, #7c5cfc)',
                      filter: 'blur(8px)',
                    }}
                  />
                  {/* QR container */}
                  <div
                    className="relative rounded-2xl p-1"
                    style={{
                      background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
                    }}
                  >
                    <div
                      className="bg-white rounded-xl p-3 relative"
                      style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.06)' }}
                    >
                      <img
                        src={qrData.qr_base64}
                        alt="QR Code"
                        className={`${isFullscreen ? 'w-72 h-72' : 'w-56 h-56'}`}
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                  </div>
                  {/* Scan label */}
                  <div
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] text-white whitespace-nowrap"
                    style={{
                      background: 'linear-gradient(135deg, #7c5cfc, #a855f7)',
                      boxShadow: '0 4px 15px rgba(124,92,252,0.3)',
                    }}
                  >
                    Scanner pour rejoindre
                  </div>
                </div>

                {/* Code + URL section */}
                <div className="flex flex-col items-center gap-4">
                  <p className="text-[10px] text-[#6b6b80] uppercase tracking-[0.25em] font-bold">Code d'acces</p>

                  {/* Individual letter boxes */}
                  <div className="flex gap-2">
                    {session.code.split('').map((char, i) => (
                      <div
                        key={i}
                        className={`${isFullscreen ? 'w-16 h-20 text-4xl' : 'w-12 h-16 text-3xl'} rounded-xl flex items-center justify-center font-mono font-black text-white transition-all duration-300`}
                        style={{
                          background: 'rgba(124, 92, 252, 0.08)',
                          border: '1px solid rgba(124, 92, 252, 0.2)',
                          boxShadow: '0 0 20px rgba(124,92,252,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
                          animationDelay: `${i * 0.05}s`,
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(124, 92, 252, 0.15)';
                          e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.4)';
                          e.currentTarget.style.boxShadow = '0 0 30px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.08)';
                          e.currentTarget.style.transform = 'translateY(-3px)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'rgba(124, 92, 252, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.2)';
                          e.currentTarget.style.boxShadow = '0 0 20px rgba(124,92,252,0.06), inset 0 1px 0 rgba(255,255,255,0.05)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {char}
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="w-full h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,92,252,0.2), transparent)' }} />

                  {/* URL with copy button */}
                  <div
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-pointer group"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                    onClick={() => { navigator.clipboard.writeText(qrData.join_url); }}
                    title="Cliquer pour copier"
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.25)'; e.currentTarget.style.background = 'rgba(124,92,252,0.05)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  >
                    <svg className="w-3.5 h-3.5 text-[#7c5cfc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="text-xs text-[#6b6b80] font-mono group-hover:text-[#8888a0] transition-colors">{qrData.join_url}</span>
                    <svg className="w-3.5 h-3.5 text-[#4a4a64] group-hover:text-[#7c5cfc] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Stats + participants + start */}
            <div className="rounded-2xl p-6" style={glassCard}>

              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Joueurs inscrits */}
                <div
                  className="rounded-2xl p-5 text-center"
                  style={glassCardStrong}
                >
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={iconBadgePurple}
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </span>
                  </div>
                  <p className={`${isFullscreen ? 'text-4xl' : 'text-3xl'} font-black text-white`}>{totalParticipants}</p>
                  <p className="text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-medium mt-1.5">
                    Joueur{totalParticipants > 1 && 's'} inscrit{totalParticipants > 1 && 's'}
                  </p>
                </div>

                {/* En ligne */}
                <div
                  className="rounded-2xl p-5 text-center"
                  style={glassCardStrong}
                >
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={iconBadgeGreen}
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 15.828a5 5 0 010-7.072m5.656 0a5 5 0 010 7.072M12 12h.01" /></svg>
                    </span>
                  </div>
                  <p className={`${isFullscreen ? 'text-4xl' : 'text-3xl'} font-black text-[#34d399]`}>{onlineCount}</p>
                  <p className="text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-medium mt-1.5">En ligne</p>
                </div>
              </div>

              {/* Points info glass pill */}
              <div className="flex justify-center mb-5">
                <span
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-[#8888a0]"
                  style={{
                    background: 'rgba(15, 15, 35, 0.5)',
                    border: '1px solid rgba(124,92,252,0.08)',
                  }}
                >
                  <svg className="w-3.5 h-3.5 text-[#7c5cfc]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  500 a 1000 pts par bonne reponse (bonus rapidite)
                </span>
              </div>

              {/* Participant chips */}
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {session.participants.map((p) => (
                  <span
                    key={p.id}
                    className="px-3.5 py-1.5 rounded-full text-sm font-medium text-white transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(124,92,252,0.12), rgba(168,85,247,0.08))',
                      border: '1px solid rgba(124,92,252,0.18)',
                      boxShadow: '0 0 12px rgba(124,92,252,0.08)',
                    }}
                  >
                    {p.nickname}
                  </span>
                ))}
              </div>

              {/* Start game button */}
              <button
                onClick={startGame}
                disabled={totalParticipants === 0}
                className={`px-10 py-4 rounded-xl font-bold text-lg text-[#06060e] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${isFullscreen ? 'text-xl px-12 py-5' : ''}`}
                style={gradientBtnGreen}
                onMouseOver={(e) => { if (totalParticipants > 0) hoverLift(e, gradientBtnGreen.boxShadow as string); }}
                onMouseOut={(e) => { hoverReset(e, gradientBtnGreen.boxShadow as string); }}
              >
                Demarrer la partie
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
            ACTIVE / REVEALING
            ================================================================ */}
        {(gameStatus === 'active' || gameStatus === 'revealing') && currentQuestion && (
          <div className={`space-y-6 ${isFullscreen ? 'flex-1 flex flex-col' : ''}`}>

            {/* Header row: question badge + answered counter */}
            <div className="flex items-center justify-between">
              {/* Question badge with gradient purple glow */}
              <span
                className={`font-bold rounded-full text-white ${isFullscreen ? 'px-6 py-2.5 text-lg' : 'px-4 py-1.5 text-sm'}`}
                style={gradientBtnPurple}
              >
                Question {questionIdx + 1} / {totalQuestions}
              </span>

              {/* Answered counter glass badge */}
              <div
                className={`flex items-center gap-2 rounded-full ${isFullscreen ? 'px-5 py-2.5 text-lg' : 'px-4 py-2 text-sm'}`}
                style={{
                  background: 'rgba(15, 15, 35, 0.5)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(124,92,252,0.08)',
                }}
              >
                <svg className={`text-[#8888a0] ${isFullscreen ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-[#8888a0] font-medium">{answeredCount} / {totalParticipants} ont repondu</span>
              </div>
            </div>

            {/* Question card - glass-strong */}
            <div
              className={`rounded-2xl text-center ${isFullscreen ? 'flex-1 flex flex-col items-center justify-center p-10 w-full' : 'p-8'}`}
              style={glassCardStrong}
            >
              <h2 className={`${isFullscreen ? 'text-4xl md:text-5xl' : 'text-2xl'} font-bold text-white mb-8`}>
                {currentQuestion.text as string}
              </h2>

              {!!currentQuestion.image_url && (
                <img src={currentQuestion.image_url as string} alt="Question" className={`${isFullscreen ? 'max-h-[65vh]' : 'max-h-80'} w-full object-contain rounded-xl bg-[rgba(255,255,255,0.02)] mx-auto mb-6`} />
              )}

              {/* Answer cards with colored left border */}
              <div className={`grid grid-cols-2 ${isFullscreen ? 'gap-6 w-full' : 'gap-4'}`}>
                {(currentQuestion.answers as Array<{ id: string; text: string; is_correct?: boolean; order: number }>).map(
                  (a, i) => {
                    const isCorrectRevealed = revealed && a.is_correct;
                    return (
                      <div
                        key={a.id}
                        className={`${isFullscreen ? 'p-8 text-2xl' : 'p-5 text-lg'} rounded-xl font-semibold text-white transition-all duration-500 text-left`}
                        style={{
                          background: isCorrectRevealed
                            ? 'rgba(52,211,153,0.1)'
                            : answerBgColors[i] || 'rgba(255,255,255,0.02)',
                          borderLeft: `4px solid ${answerBorderColors[i] || '#6b6b80'}`,
                          border: isCorrectRevealed
                            ? '1px solid rgba(52,211,153,0.3)'
                            : `1px solid rgba(255,255,255,0.05)`,
                          borderLeftWidth: '4px',
                          borderLeftColor: answerBorderColors[i] || '#6b6b80',
                          boxShadow: isCorrectRevealed
                            ? '0 0 30px rgba(52,211,153,0.15), inset 0 1px 0 rgba(255,255,255,0.05)'
                            : '0 4px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.03)',
                          backdropFilter: 'blur(12px)',
                        }}
                      >
                        {a.text}
                        {revealed && a.is_correct && (
                          <span className="ml-3 inline-flex items-center">
                            <svg className={`${isFullscreen ? 'w-7 h-7' : 'w-5 h-5'} text-[#34d399]`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          </span>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Stats section after reveal */}
            {revealed && stats && (
              <div className={`rounded-2xl ${isFullscreen ? 'p-8 w-full' : 'p-6'}`} style={glassCard}>

                {/* Player results */}
                {playerResults.length > 0 && (
                  <div className={isFullscreen ? 'mb-8' : 'mb-6'}>
                    {/* Header with stats badges */}
                    <div className={`flex items-center justify-between ${isFullscreen ? 'mb-6' : 'mb-4'}`}>
                      <h3 className={`${isFullscreen ? 'text-xl' : 'text-base'} font-bold text-white`}>Qui a bon ?</h3>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex items-center gap-2 rounded-xl ${isFullscreen ? 'px-4 py-2.5' : 'px-3 py-1.5'}`}
                          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)' }}
                        >
                          <svg className={`${isFullscreen ? 'w-5 h-5' : 'w-4 h-4'} text-[#34d399]`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          <span className={`${isFullscreen ? 'text-lg' : 'text-sm'} font-bold text-[#34d399]`}>{stats.correct_count}</span>
                        </div>
                        <div
                          className={`flex items-center gap-2 rounded-xl ${isFullscreen ? 'px-4 py-2.5' : 'px-3 py-1.5'}`}
                          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}
                        >
                          <svg className={`${isFullscreen ? 'w-5 h-5' : 'w-4 h-4'} text-[#f87171]`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                          <span className={`${isFullscreen ? 'text-lg' : 'text-sm'} font-bold text-[#f87171]`}>{stats.total_responses - stats.correct_count}</span>
                        </div>
                      </div>
                    </div>

                    {/* Gradient divider */}
                    <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,92,252,0.2), transparent)' }} />

                    {/* Correct players */}
                    {playerResults.filter(pr => pr.is_correct).length > 0 && (
                      <div className={isFullscreen ? 'mb-4' : 'mb-3'}>
                        <div className={`grid grid-cols-2 sm:grid-cols-3 ${isFullscreen ? 'md:grid-cols-5 lg:grid-cols-6 gap-3' : 'md:grid-cols-4 gap-2'}`}>
                          {playerResults.filter(pr => pr.is_correct).map((pr) => (
                            <div
                              key={pr.participant_id}
                              className={`flex items-center gap-2.5 rounded-xl transition-all ${isFullscreen ? 'px-5 py-4 text-lg' : 'px-3 py-2.5 text-sm'}`}
                              style={{
                                background: 'rgba(52,211,153,0.06)',
                                border: '1px solid rgba(52,211,153,0.18)',
                                boxShadow: '0 2px 12px rgba(52,211,153,0.06)',
                              }}
                            >
                              <svg className={`${isFullscreen ? 'w-6 h-6' : 'w-5 h-5'} text-[#34d399] shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              <span className="font-semibold text-[#34d399] truncate">{pr.nickname}</span>
                              {pr.points_awarded > 0 && (
                                <span className={`ml-auto text-[#34d399] font-mono font-bold shrink-0 ${isFullscreen ? 'text-base' : 'text-xs'}`}>+{pr.points_awarded}</span>
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
                              className={`flex items-center gap-2.5 rounded-xl transition-all ${isFullscreen ? 'px-5 py-4 text-lg' : 'px-3 py-2.5 text-sm'}`}
                              style={{
                                background: 'rgba(248,113,113,0.06)',
                                border: '1px solid rgba(248,113,113,0.15)',
                              }}
                            >
                              <svg className={`${isFullscreen ? 'w-6 h-6' : 'w-5 h-5'} text-[#f87171] shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                              <span className="font-medium text-[#f87171] truncate">{pr.nickname}</span>
                            </div>
                          ))}
                          {playerResults.filter(pr => !pr.is_correct && !pr.answer_id).map((pr) => (
                            <div
                              key={pr.participant_id}
                              className={`flex items-center gap-2.5 rounded-xl transition-all ${isFullscreen ? 'px-5 py-4 text-lg' : 'px-3 py-2.5 text-sm'}`}
                              style={{
                                background: 'rgba(107,107,128,0.06)',
                                border: '1px solid rgba(107,107,128,0.1)',
                              }}
                            >
                              <svg className={`${isFullscreen ? 'w-6 h-6' : 'w-5 h-5'} text-[#6b6b80] shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span className="font-medium text-[#6b6b80] truncate">{pr.nickname}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Gradient divider before leaderboard */}
                <div className="h-px mb-5" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,92,252,0.2), transparent)' }} />

                {/* Leaderboard top 5 */}
                <div className={`space-y-2 ${isFullscreen ? 'space-y-3' : ''}`}>
                  {leaderboard.slice(0, 5).map((e, i) => {
                    const rankGradients: Record<number, React.CSSProperties> = {
                      0: { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 0 16px rgba(251,191,36,0.3)' },
                      1: { background: 'linear-gradient(135deg, #94a3b8, #64748b)', boxShadow: '0 0 16px rgba(148,163,184,0.25)' },
                      2: { background: 'linear-gradient(135deg, #d97706, #92400e)', boxShadow: '0 0 16px rgba(217,119,6,0.25)' },
                    };
                    return (
                      <div
                        key={e.participant_id}
                        className={`flex items-center justify-between rounded-xl transition-all duration-300 ${isFullscreen ? 'px-6 py-4' : 'px-4 py-3'}`}
                        style={{
                          background: i === 0
                            ? 'rgba(251,191,36,0.06)'
                            : i === 1
                              ? 'rgba(148,163,184,0.06)'
                              : i === 2
                                ? 'rgba(217,119,6,0.06)'
                                : 'rgba(255,255,255,0.02)',
                          border: i === 0
                            ? '1px solid rgba(251,191,36,0.15)'
                            : i === 1
                              ? '1px solid rgba(148,163,184,0.12)'
                              : i === 2
                                ? '1px solid rgba(217,119,6,0.12)'
                                : '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`${isFullscreen ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'} rounded-full flex items-center justify-center font-black text-white`}
                            style={
                              i < 3
                                ? rankGradients[i]
                                : { background: 'rgba(255,255,255,0.06)', color: '#6b6b80', boxShadow: 'none' }
                            }
                          >
                            {e.rank}
                          </span>
                          <span className={`font-semibold text-white ${isFullscreen ? 'text-lg' : ''}`}>{e.nickname}</span>
                        </div>
                        <span
                          className={`font-mono font-bold ${isFullscreen ? 'text-lg' : ''}`}
                          style={{ color: '#7c5cfc' }}
                        >
                          {e.score} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className={`flex gap-4 justify-center ${isFullscreen ? 'pt-6 pb-2' : ''}`}>
              {!revealed ? (
                <button
                  onClick={revealAnswer}
                  className={`${isFullscreen ? 'px-10 py-4 text-lg' : 'px-8 py-3.5'} rounded-xl font-bold text-[#06060e] transition-all duration-300`}
                  style={gradientBtnYellow}
                  onMouseOver={(e) => hoverLift(e, gradientBtnYellow.boxShadow as string)}
                  onMouseOut={(e) => hoverReset(e, gradientBtnYellow.boxShadow as string)}
                >
                  Reveler la reponse
                </button>
              ) : isLastQuestion ? (
                <button
                  onClick={endGame}
                  className={`${isFullscreen ? 'px-10 py-4 text-lg' : 'px-8 py-3.5'} rounded-xl font-bold text-white transition-all duration-300`}
                  style={gradientBtnRed}
                  onMouseOver={(e) => hoverLift(e, gradientBtnRed.boxShadow as string)}
                  onMouseOut={(e) => hoverReset(e, gradientBtnRed.boxShadow as string)}
                >
                  Terminer la partie
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  className={`${isFullscreen ? 'px-10 py-4 text-lg' : 'px-8 py-3.5'} rounded-xl font-bold text-white transition-all duration-300 flex items-center gap-2`}
                  style={gradientBtnPurple}
                  onMouseOver={(e) => hoverLift(e, gradientBtnPurple.boxShadow as string)}
                  onMouseOut={(e) => hoverReset(e, gradientBtnPurple.boxShadow as string)}
                >
                  Question suivante
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              )}
              {!connected && (
                <button
                  onClick={forceFinishRest}
                  className={`${isFullscreen ? 'px-8 py-4 text-lg' : 'px-6 py-3'} rounded-xl font-bold text-[#f87171] transition-all duration-300`}
                  style={{
                    background: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.2)',
                    boxShadow: '0 0 20px rgba(248,113,113,0.1)',
                  }}
                  title="Terminer via REST (WebSocket deconnecte)"
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.14)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  Forcer la fin
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================================================================
            FINISHED - Podium
            ================================================================ */}
        {gameStatus === 'finished' && (
          <div className={`space-y-8 text-center ${isFullscreen ? 'flex-1 flex flex-col items-center justify-center' : ''}`}>

            {/* Title with gradient text */}
            <div>
              <h2
                className={`${isFullscreen ? 'text-4xl md:text-5xl' : 'text-3xl'} font-black mb-3`}
                style={{
                  background: 'linear-gradient(135deg, #7c5cfc, #a855f7, #e879f9)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 20px rgba(124,92,252,0.3))',
                }}
              >
                Partie terminee !
              </h2>
              <p className={`text-[#8888a0] ${isFullscreen ? 'text-lg' : ''}`}>Voici le podium final</p>
            </div>

            {/* Visual podium */}
            {leaderboard.length >= 1 && (
              <div className={`flex items-end justify-center gap-3 ${isFullscreen ? 'gap-5 mt-8' : 'mt-6'}`}>

                {/* 2nd place */}
                {leaderboard.length >= 2 && (
                  <div className="flex flex-col items-center animate-[slideUp_0.8s_ease-out_0.3s_both]">
                    <div
                      className={`${isFullscreen ? 'text-5xl mb-3' : 'text-4xl mb-2'}`}
                      style={{ filter: 'drop-shadow(0 0 12px rgba(148,163,184,0.4))' }}
                    >
                      &#x1F948;
                    </div>
                    <p className={`font-bold text-white ${isFullscreen ? 'text-xl mb-2' : 'text-lg mb-1'}`}>{leaderboard[1].nickname}</p>
                    <p className={`font-mono font-bold ${isFullscreen ? 'text-lg mb-3' : 'mb-2'}`} style={{ color: '#7c5cfc' }}>{leaderboard[1].score} pts</p>
                    <div
                      className={`${isFullscreen ? 'w-36 h-36' : 'w-28 h-28'} rounded-t-xl flex items-center justify-center`}
                      style={{
                        background: 'linear-gradient(to top, #475569, #94a3b8)',
                        border: '1px solid rgba(148,163,184,0.25)',
                        boxShadow: '0 0 30px rgba(148,163,184,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                      }}
                    >
                      <span className={`${isFullscreen ? 'text-5xl' : 'text-4xl'} font-black text-white/80`}>2</span>
                    </div>
                  </div>
                )}

                {/* 1st place */}
                <div className="flex flex-col items-center animate-[slideUp_0.8s_ease-out_both]">
                  <div
                    className={`${isFullscreen ? 'text-6xl mb-3' : 'text-5xl mb-2'}`}
                    style={{ filter: 'drop-shadow(0 0 16px rgba(251,191,36,0.5))' }}
                  >
                    &#x1F947;
                  </div>
                  <p className={`font-black ${isFullscreen ? 'text-2xl mb-2' : 'text-xl mb-1'}`} style={{ color: '#fbbf24' }}>{leaderboard[0].nickname}</p>
                  <p className={`font-mono font-bold ${isFullscreen ? 'text-xl mb-3' : 'text-lg mb-2'}`} style={{ color: '#7c5cfc' }}>{leaderboard[0].score} pts</p>
                  <div
                    className={`${isFullscreen ? 'w-40 h-48' : 'w-32 h-40'} rounded-t-xl flex items-center justify-center`}
                    style={{
                      background: 'linear-gradient(to top, #92400e, #fbbf24)',
                      border: '1px solid rgba(251,191,36,0.3)',
                      boxShadow: '0 0 40px rgba(251,191,36,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
                    }}
                  >
                    <span className={`${isFullscreen ? 'text-6xl' : 'text-5xl'} font-black text-white/80`}>1</span>
                  </div>
                </div>

                {/* 3rd place */}
                {leaderboard.length >= 3 && (
                  <div className="flex flex-col items-center animate-[slideUp_0.8s_ease-out_0.6s_both]">
                    <div
                      className={`${isFullscreen ? 'text-5xl mb-3' : 'text-4xl mb-2'}`}
                      style={{ filter: 'drop-shadow(0 0 12px rgba(217,119,6,0.4))' }}
                    >
                      &#x1F949;
                    </div>
                    <p className={`font-bold text-white ${isFullscreen ? 'text-xl mb-2' : 'text-lg mb-1'}`}>{leaderboard[2].nickname}</p>
                    <p className={`font-mono font-bold ${isFullscreen ? 'text-lg mb-3' : 'mb-2'}`} style={{ color: '#7c5cfc' }}>{leaderboard[2].score} pts</p>
                    <div
                      className={`${isFullscreen ? 'w-36 h-28' : 'w-28 h-20'} rounded-t-xl flex items-center justify-center`}
                      style={{
                        background: 'linear-gradient(to top, #78350f, #d97706)',
                        border: '1px solid rgba(217,119,6,0.25)',
                        boxShadow: '0 0 30px rgba(217,119,6,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                      }}
                    >
                      <span className={`${isFullscreen ? 'text-5xl' : 'text-4xl'} font-black text-white/80`}>3</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Full ranking (4th and beyond) */}
            {leaderboard.length > 3 && (
              <div
                className={`rounded-2xl ${isFullscreen ? 'p-6 max-w-3xl w-full' : 'p-5 max-w-lg'} mx-auto`}
                style={glassCard}
              >
                <h3 className={`${isFullscreen ? 'text-lg mb-4' : 'text-sm mb-3'} font-bold text-[#8888a0]`}>Classement complet</h3>
                <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,92,252,0.2), transparent)' }} />
                <div className={`space-y-2 ${isFullscreen ? 'space-y-3' : ''}`}>
                  {leaderboard.slice(3).map((e) => (
                    <div
                      key={e.participant_id}
                      className={`flex items-center justify-between rounded-xl transition-all duration-300 ${isFullscreen ? 'px-6 py-3' : 'px-4 py-2.5'}`}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`${isFullscreen ? 'w-8 h-8 text-sm' : 'w-7 h-7 text-xs'} rounded-full flex items-center justify-center font-bold`}
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#6b6b80' }}
                        >
                          {e.rank}
                        </span>
                        <span className={`font-medium text-white ${isFullscreen ? 'text-base' : 'text-sm'}`}>{e.nickname}</span>
                      </div>
                      <span className={`font-mono font-bold ${isFullscreen ? 'text-base' : 'text-sm'}`} style={{ color: '#7c5cfc' }}>{e.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-4 justify-center flex-wrap">
              {/* Analytique - gradient purple */}
              <button
                onClick={() => navigate(`/session/${sid}/analytics`)}
                className="px-7 py-3.5 rounded-xl font-bold text-white transition-all duration-300 flex items-center gap-2"
                style={gradientBtnPurple}
                onMouseOver={(e) => hoverLift(e, gradientBtnPurple.boxShadow as string)}
                onMouseOut={(e) => hoverReset(e, gradientBtnPurple.boxShadow as string)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Analytique
              </button>

              {/* Exporter CSV - gradient green */}
              <button
                onClick={downloadCsv}
                className="px-7 py-3.5 rounded-xl font-bold text-[#06060e] transition-all duration-300 flex items-center gap-2"
                style={gradientBtnGreen}
                onMouseOver={(e) => hoverLift(e, gradientBtnGreen.boxShadow as string)}
                onMouseOut={(e) => hoverReset(e, gradientBtnGreen.boxShadow as string)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Exporter CSV
              </button>

              {/* Retour - glass with border */}
              <button
                onClick={() => navigate('/dashboard')}
                className="px-7 py-3.5 rounded-xl font-bold text-white transition-all duration-300 flex items-center gap-2"
                style={{
                  background: 'rgba(15, 15, 35, 0.5)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(124,92,252,0.15)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.15)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; }}
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
