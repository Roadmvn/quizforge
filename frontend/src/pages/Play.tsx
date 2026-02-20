import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useWebSocket, MAX_RECONNECT_ATTEMPTS } from '../hooks/useWebSocket';
import type { WsMessage, LeaderboardEntry } from '../lib/types';

type Phase = 'waiting' | 'question' | 'answered' | 'revealed' | 'finished';

interface QuestionData {
  question_id: string;
  text: string;
  time_limit: number;
  image_url?: string | null;
  answers: { id: string; text: string; order: number; is_correct?: boolean }[];
  question_idx: number;
  total_questions: number;
}

export default function Play() {
  const { sid } = useParams<{ sid: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { pid?: string; ptoken?: string; nickname?: string; code?: string } | null;

  const storageKey = `quizforge_participant_${sid}`;
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  })();

  const pid = state?.pid || stored.pid || '';
  const ptoken = state?.ptoken || stored.ptoken || '';
  const nickname = state?.nickname || stored.nickname || '';
  const sessionCode = state?.code || stored.code || '';

  useEffect(() => {
    if (pid && ptoken) {
      localStorage.setItem(storageKey, JSON.stringify({ pid, ptoken, nickname, code: sessionCode }));
    }
  }, [pid, ptoken, nickname, sessionCode, storageKey]);

  const [phase, setPhase] = useState<Phase>('waiting');
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<{ is_correct: boolean; points_awarded: number; total_score: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [sendError, setSendError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = (seconds: number) => {
    stopTimer();
    setTimeLeft(seconds);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, seconds - elapsed);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) stopTimer();
    }, 200);
  };

  useEffect(() => () => stopTimer(), []);

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'game_started':
        setPhase((prev) => prev === 'waiting' ? 'waiting' : prev);
        break;
      case 'new_question': {
        setPhase('question');
        setSelectedAnswer(null);
        setResult(null);
        setSendError(false);
        setQuestion(msg as unknown as QuestionData);
        const tl = msg.time_limit as number;
        const elapsed = msg.elapsed as number | undefined;
        const remaining = elapsed != null ? Math.max(0, tl - elapsed) : tl;
        startTimer(remaining);
        break;
      }
      case 'answer_submitted':
        setResult({
          is_correct: msg.is_correct as boolean,
          points_awarded: msg.points_awarded as number,
          total_score: msg.total_score as number,
        });
        break;
      case 'answer_revealed':
        setPhase('revealed');
        stopTimer();
        setQuestion(msg as unknown as QuestionData);
        setLeaderboard(msg.leaderboard as LeaderboardEntry[]);
        break;
      case 'game_ended':
        setPhase('finished');
        stopTimer();
        setLeaderboard(msg.leaderboard as LeaderboardEntry[]);
        localStorage.removeItem(storageKey);
        break;
      case 'error':
        break;
    }
  }, [storageKey]);

  const { send, connected, failed, reconnecting, attempt } = useWebSocket({
    sessionId: sid || '',
    role: 'participant',
    pid,
    ptoken,
    onMessage: handleMessage,
  });

  const submitAnswer = (answerId: string) => {
    if (selectedAnswer) return;
    setSendError(false);
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const ok = send({ type: 'submit_answer', answer_id: answerId, response_time: Math.round(elapsed * 100) / 100 });
    if (ok) {
      setSelectedAnswer(answerId);
      setPhase('answered');
      stopTimer();
    } else {
      setSendError(true);
    }
  };

  const myRank = leaderboard.find((e) => e.participant_id === pid);

  const answerColors = [
    'bg-[rgba(239,68,68,0.12)] hover:bg-[rgba(239,68,68,0.2)]',
    'bg-[rgba(96,165,250,0.12)] hover:bg-[rgba(96,165,250,0.2)]',
    'bg-[rgba(251,191,36,0.12)] hover:bg-[rgba(251,191,36,0.2)]',
    'bg-[rgba(52,211,153,0.12)] hover:bg-[rgba(52,211,153,0.2)]',
  ];

  if (!pid || !ptoken) {
    return (
      <div className="min-h-screen bg-[#06060e] text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-[#f87171] text-lg font-medium">Session invalide</p>
          <p className="text-[#6b6b80]">Veuillez rejoindre une session via un code.</p>
          <a href="/join" className="inline-block px-6 py-3 bg-[#7c5cfc] hover:bg-[#6b4ee0] rounded-lg font-semibold transition">
            Rejoindre un quiz
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06060e] text-white flex flex-col">
      {/* Header */}
      <header className="bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.06)] px-4 py-3 flex items-center justify-between">
        <span className="text-[#e8e8f0] font-medium">{nickname}</span>
        <span
          className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-[#34d399]' : 'bg-[#f87171]'}`}
          aria-label="Indicateur de connexion"
        />
      </header>

      {reconnecting && (
        <div className="bg-[rgba(251,191,36,0.1)] border-b border-[rgba(251,191,36,0.15)] text-[#fbbf24] text-center text-sm py-2 px-4">
          Reconnexion en cours (tentative {attempt}/{MAX_RECONNECT_ATTEMPTS})...
        </div>
      )}

      {sendError && (
        <div className="bg-[rgba(248,113,113,0.1)] border-b border-[rgba(248,113,113,0.15)] text-[#f87171] text-center text-sm py-2 px-4">
          Erreur d'envoi. Veuillez re-essayer.
        </div>
      )}

      <main className="flex-1 flex items-center justify-center p-4">
        {/* FAILED */}
        {failed && (
          <div className="text-center space-y-4">
            <p className="text-[#f87171] text-lg font-medium">Connexion perdue</p>
            <p className="text-[#6b6b80]">Impossible de se reconnecter au serveur.</p>
            <button
              onClick={() => navigate(sessionCode ? `/join/${sessionCode}` : '/join')}
              className="px-6 py-3 bg-[#7c5cfc] hover:bg-[#6b4ee0] rounded-lg font-semibold transition"
            >
              Reconnecter
            </button>
          </div>
        )}

        {/* WAITING */}
        {!failed && phase === 'waiting' && (
          <div className="text-center space-y-4">
            <div className="spinner-premium w-12 h-12 mx-auto" />
            <h2 className="text-xl font-semibold text-[#e8e8f0]">En attente de l'hote...</h2>
            <p className="text-[#6b6b80]">La partie va bientot commencer</p>
          </div>
        )}

        {/* QUESTION */}
        {phase === 'question' && question && (
          <div className="w-full max-w-lg space-y-6">
            <div className="text-center">
              <span className="text-[#6b6b80] text-sm">
                Question {question.question_idx + 1} / {question.total_questions}
              </span>
              <h2 className="text-xl font-semibold text-[#e8e8f0] mt-2 mb-4">{question.text}</h2>
              {question.image_url && (
                <img src={question.image_url} alt="Question" className="max-h-80 w-full object-contain rounded-xl bg-[rgba(255,255,255,0.02)] mx-auto mb-4" />
              )}
              <div className={`font-mono text-4xl font-bold ${timeLeft <= 5 ? 'text-[#f87171]' : 'text-[#7c5cfc]'}`}>
                {timeLeft}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {question.answers.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => submitAnswer(a.id)}
                  className={`p-6 rounded-xl text-lg font-semibold text-white transition active:scale-95 ${answerColors[i] || 'bg-[rgba(255,255,255,0.04)]'}`}
                >
                  {a.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ANSWERED (waiting for reveal) */}
        {phase === 'answered' && (
          <div className="text-center space-y-4">
            <div className="text-6xl">&#9203;</div>
            <h2 className="text-xl font-semibold text-[#e8e8f0]">Reponse envoyee !</h2>
            <p className="text-[#6b6b80]">En attente de la revelation...</p>
          </div>
        )}

        {/* REVEALED */}
        {phase === 'revealed' && question && (
          <div className="w-full max-w-lg space-y-6">
            {result && (
              <div className="text-center space-y-2">
                <div className="text-5xl">{result.is_correct ? '\u2705' : '\u274C'}</div>
                <h2 className={`text-2xl font-bold ${result.is_correct ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                  {result.is_correct ? 'Correct !' : 'Faux !'}
                </h2>
                <p className="text-[#7c5cfc] text-xl font-semibold">+{result.points_awarded} pts</p>
              </div>
            )}
            <h2 className="text-xl font-semibold text-[#e8e8f0] text-center">{question.text}</h2>
            {question.image_url && (
              <img src={question.image_url} alt="Question" className="max-h-80 w-full object-contain rounded-xl bg-[rgba(255,255,255,0.02)] mx-auto" />
            )}
            <div className="grid grid-cols-2 gap-3">
              {question.answers.map((a) => (
                <div
                  key={a.id}
                  className={`p-4 rounded-xl text-center font-medium ${
                    a.is_correct
                      ? 'bg-[rgba(52,211,153,0.15)] ring-1 ring-[rgba(52,211,153,0.3)]'
                      : a.id === selectedAnswer
                        ? 'bg-[rgba(248,113,113,0.15)] ring-1 ring-[rgba(248,113,113,0.3)]'
                        : 'bg-[rgba(255,255,255,0.02)] opacity-40'
                  }`}
                >
                  {a.text}
                  {a.is_correct && <span className="ml-1">{'\u2713'}</span>}
                </div>
              ))}
            </div>
            {myRank && (
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-[#6b6b80] text-sm">Votre classement</p>
                <p className="text-3xl font-bold text-[#7c5cfc] mt-1">
                  {myRank.rank === 1 ? '\uD83E\uDD47' : myRank.rank === 2 ? '\uD83E\uDD48' : myRank.rank === 3 ? '\uD83E\uDD49' : `#${myRank.rank}`}
                </p>
                <p className="text-[#6b6b80] text-sm mt-1">{myRank.score} pts</p>
              </div>
            )}
          </div>
        )}

        {/* FINISHED */}
        {phase === 'finished' && (
          <div className="w-full max-w-md space-y-6 text-center">
            <h2 className="text-3xl font-bold text-[#e8e8f0]">{'\uD83C\uDFC1'} Partie terminee !</h2>
            {myRank && (
              <div className="glass rounded-xl p-6">
                <p className="text-5xl mb-2">
                  {myRank.rank === 1 ? '\uD83C\uDFC6' : myRank.rank === 2 ? '\uD83E\uDD48' : myRank.rank === 3 ? '\uD83E\uDD49' : '\uD83C\uDFAE'}
                </p>
                <p className="text-[#6b6b80]">Vous terminez</p>
                <p className={`text-5xl font-bold mt-1 ${myRank.rank === 1 ? 'text-[#fbbf24]' : 'text-[#7c5cfc]'}`}>
                  #{myRank.rank}
                </p>
                <p className="text-xl mt-2 text-[#e8e8f0]">{myRank.score} pts</p>
              </div>
            )}
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((e) => (
                <div
                  key={e.participant_id}
                  className={`flex items-center justify-between rounded-lg px-4 py-2 ${
                    e.participant_id === pid
                      ? 'bg-[rgba(124,92,252,0.06)] border border-[rgba(124,92,252,0.15)]'
                      : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {e.rank === 1 ? '\uD83E\uDD47' : e.rank === 2 ? '\uD83E\uDD48' : e.rank === 3 ? '\uD83E\uDD49' : `${e.rank}.`}
                    </span>
                    <span className="text-[#e8e8f0]">{e.nickname}</span>
                  </div>
                  <span className="font-mono text-[#7c5cfc]">{e.score} pts</span>
                </div>
              ))}
            </div>
            <a
              href="/join"
              className="inline-block px-6 py-3 bg-[#7c5cfc] hover:bg-[#6b4ee0] rounded-lg text-sm font-semibold text-white transition mt-4"
            >
              Rejoindre un autre quiz
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
