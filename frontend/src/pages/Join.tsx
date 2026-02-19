import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

interface JoinResponse {
  id: string;
  session_id: string;
  token: string;
}

interface StoredCredentials {
  pid: string;
  ptoken: string;
  nickname: string;
  code: string;
}

export default function Join() {
  const { code: urlCode } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(urlCode || searchParams.get('code') || '');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedSession, setSavedSession] = useState<{ sid: string; creds: StoredCredentials } | null>(null);

  useEffect(() => {
    if (code.length !== 6) { setSavedSession(null); return; }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('quizforge_participant_')) continue;
      try {
        const data: StoredCredentials = JSON.parse(localStorage.getItem(key)!);
        if (data.code === code.toUpperCase() && data.pid && data.ptoken) {
          const sid = key.replace('quizforge_participant_', '');
          setSavedSession({ sid, creds: data });
          return;
        }
      } catch { /* ignore */ }
    }
    setSavedSession(null);
  }, [code]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Single API call — backend returns session_id + participant token
      const res = await api.post<JoinResponse>('/sessions/join', {
        code: code.toUpperCase(),
        nickname,
      });
      const storageKey = `quizforge_participant_${res.session_id}`;
      localStorage.setItem(storageKey, JSON.stringify({
        pid: res.id, ptoken: res.token, nickname, code: code.toUpperCase(),
      }));
      navigate(`/play/${res.session_id}`, {
        state: { pid: res.id, ptoken: res.token, nickname, code: code.toUpperCase() },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de rejoindre');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl shadow-xl p-8 w-full max-w-md border border-slate-800">
        <h1 className="text-3xl font-bold text-center mb-2 text-white">
          <span className="text-indigo-400">Quiz</span>Forge
        </h1>
        <p className="text-slate-400 text-center mb-8">Rejoindre un quiz en direct</p>

        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            placeholder="Code de la partie"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
            aria-label="Code de la session"
            className="w-full px-4 py-4 bg-slate-800 border border-slate-700 rounded-lg text-white text-center text-2xl font-mono tracking-widest placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
          />
          <input
            type="text"
            placeholder="Votre pseudo"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={50}
            required
            aria-label="Votre pseudo"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Rejoindre'}
          </button>
          {savedSession && (
            <button
              type="button"
              onClick={() => navigate(`/play/${savedSession.sid}`, {
                state: {
                  pid: savedSession.creds.pid,
                  ptoken: savedSession.creds.ptoken,
                  nickname: savedSession.creds.nickname,
                  code: savedSession.creds.code,
                },
              })}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-lg transition"
            >
              Reprendre la partie ({savedSession.creds.nickname})
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
