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
    <div className="min-h-screen bg-[#06060e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background layers */}
      <div className="mesh-gradient" />
      <div className="fixed inset-0 grid-pattern pointer-events-none z-0" />
      <div className="noise" />

      <div className="glass animate-in rounded-xl w-full max-w-[420px] p-8 relative z-10">
        <h1 className="text-2xl font-semibold text-center mb-2">
          <span className="text-[#7c5cfc]">Quiz</span>
          <span className="text-white">Forge</span>
        </h1>
        <p className="text-[#6b6b80] text-center mb-8 text-sm">Rejoindre un quiz en direct</p>

        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            placeholder="Code de la partie"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
            aria-label="Code de la session"
            className="w-full px-4 py-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg text-white text-center text-2xl font-mono tracking-[0.2em] placeholder-[#3d3d52] focus:outline-none focus:border-[rgba(124,92,252,0.4)] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.1)] transition uppercase"
          />
          <input
            type="text"
            placeholder="Votre pseudo"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={50}
            required
            aria-label="Votre pseudo"
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg text-white placeholder-[#3d3d52] focus:outline-none focus:border-[rgba(124,92,252,0.4)] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.1)] transition"
          />
          {error && <p className="text-[#f87171] text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full py-4 bg-[#7c5cfc] hover:bg-[#6b4ee0] text-white font-semibold text-lg rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="w-full py-4 bg-[#34d399] hover:bg-[#2dd4bf] text-[#06060e] font-semibold text-lg rounded-lg transition"
            >
              Reprendre la partie ({savedSession.creds.nickname})
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
