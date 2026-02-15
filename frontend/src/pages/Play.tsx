import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
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
  const [searchParams] = useSearchParams();

  // Read from URL params first (reliable on mobile), fall back to sessionStorage
  const pid = searchParams.get('pid') || sessionStorage.getItem('pid') || '';
  const ptoken = searchParams.get('ptoken') || sessionStorage.getItem('ptoken') || '';
  const nickname = searchParams.get('nickname') || sessionStorage.getItem('nickname') || '';

  useEffect(() => {
    if (searchParams.has('ptoken')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const [phase, setPhase] = useState<Phase>('waiting');
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<{ is_correct: boolean; points_awarded: number; total_score: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
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
        setPhase('waiting');
        break;
      case 'new_question':
        setPhase('question');
        setSelectedAnswer(null);
        setResult(null);
        setQuestion(msg as unknown as QuestionData);
        startTimer(msg.time_limit as number);
        break;
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
        break;
      case 'error':
        break;
    }
  }, []);

  const { send, connected } = useWebSocket({
    sessionId: sid || '',
    role: 'participant',
    pid,
    ptoken,
    onMessage: handleMessage,
  });

  const submitAnswer = (answerId: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answerId);
    setPhase('answered');
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    send({ type: 'submit_answer', answer_id: answerId, response_time: Math.round(elapsed * 100) / 100 });
  };

  const myRank = leaderboard.find((e) => e.participant_id === pid);

  const answerColors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold">{nickname}</span>
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        {/* WAITING */}
        {phase === 'waiting' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-2xl font-bold">En attente de l'hôte...</h2>
            <p className="text-gray-400">La partie va bientôt commencer</p>
          </div>
        )}

        {/* QUESTION */}
        {phase === 'question' && question && (
          <div className="w-full max-w-lg space-y-6">
            <div className="text-center">
              <span className="text-gray-400 text-sm">
                Question {question.question_idx + 1} / {question.total_questions}
              </span>
              <h2 className="text-xl font-bold mt-2 mb-4">{question.text}</h2>
              {question.image_url && (
                <img src={question.image_url} alt="Question" className="max-h-80 w-full object-contain rounded-xl bg-slate-900/50 mx-auto mb-4" />
              )}
              <div className={`text-4xl font-bold font-mono ${timeLeft <= 5 ? 'text-red-400' : 'text-indigo-400'}`}>
                {timeLeft}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {question.answers.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => submitAnswer(a.id)}
                  className={`p-6 rounded-xl text-lg font-bold transition active:scale-95 ${answerColors[i] || 'bg-gray-700'} hover:opacity-90`}
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
            <div className="text-6xl">⏳</div>
            <h2 className="text-xl font-bold">Réponse envoyée !</h2>
            <p className="text-gray-400">En attente de la révélation...</p>
          </div>
        )}

        {/* REVEALED */}
        {phase === 'revealed' && question && (
          <div className="w-full max-w-lg space-y-6">
            {result && (
              <div className="text-center space-y-2">
                <div className="text-5xl">{result.is_correct ? '\u2705' : '\u274C'}</div>
                <h2 className={`text-2xl font-bold ${result.is_correct ? 'text-green-400' : 'text-red-400'}`}>
                  {result.is_correct ? 'Correct !' : 'Faux !'}
                </h2>
                <p className="text-indigo-400 text-xl">+{result.points_awarded} pts</p>
              </div>
            )}
            <h2 className="text-xl font-bold text-center">{question.text}</h2>
            {question.image_url && (
              <img src={question.image_url} alt="Question" className="max-h-80 w-full object-contain rounded-xl bg-slate-900/50 mx-auto" />
            )}
            <div className="grid grid-cols-2 gap-3">
              {question.answers.map((a) => (
                <div
                  key={a.id}
                  className={`p-4 rounded-xl text-center font-medium ${
                    a.is_correct
                      ? 'bg-green-500/30 ring-2 ring-green-400'
                      : a.id === selectedAnswer
                        ? 'bg-red-500/30 ring-2 ring-red-400'
                        : 'bg-gray-800 opacity-50'
                  }`}
                >
                  {a.text}
                  {a.is_correct && <span className="ml-1">{'\u2713'}</span>}
                </div>
              ))}
            </div>
            {myRank && (
              <div className="text-center bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400">Votre classement</p>
                <p className="text-3xl font-bold text-indigo-400">
                  {myRank.rank === 1 ? '\uD83E\uDD47' : myRank.rank === 2 ? '\uD83E\uDD48' : myRank.rank === 3 ? '\uD83E\uDD49' : `#${myRank.rank}`}
                </p>
                <p className="text-gray-400">{myRank.score} pts</p>
              </div>
            )}
          </div>
        )}

        {/* FINISHED */}
        {phase === 'finished' && (
          <div className="w-full max-w-md space-y-6 text-center">
            <h2 className="text-3xl font-bold">{'\uD83C\uDFC1'} Partie terminée !</h2>
            {myRank && (
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <p className="text-5xl mb-2">
                  {myRank.rank === 1 ? '\uD83C\uDFC6' : myRank.rank === 2 ? '\uD83E\uDD48' : myRank.rank === 3 ? '\uD83E\uDD49' : '\uD83C\uDFAE'}
                </p>
                <p className="text-gray-400">Vous terminez</p>
                <p className={`text-5xl font-bold ${myRank.rank === 1 ? 'text-yellow-400' : 'text-indigo-400'}`}>
                  #{myRank.rank}
                </p>
                <p className="text-xl mt-2">{myRank.score} pts</p>
              </div>
            )}
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((e) => (
                <div
                  key={e.participant_id}
                  className={`flex items-center justify-between rounded-lg px-4 py-2 ${
                    e.participant_id === pid ? 'bg-indigo-500/20 border border-indigo-500/40' : 'bg-gray-900'
                  }`}
                >
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
      </main>
    </div>
  );
}
