import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface JoinResponse {
  id: string;
  session_id: string;
  token: string;
}

export default function Join() {
  const { code: urlCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [code, setCode] = useState(urlCode || '');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      sessionStorage.setItem('pid', res.id);
      sessionStorage.setItem('ptoken', res.token);
      sessionStorage.setItem('nickname', nickname);
      navigate(`/play/${res.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de rejoindre');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-800">
        <h1 className="text-3xl font-bold text-center mb-2 text-white">
          <span className="text-indigo-400">Quiz</span>Forge
        </h1>
        <p className="text-gray-400 text-center mb-8">Rejoindre un quiz en direct</p>

        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            placeholder="Code de la partie"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            required
            className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-2xl font-mono tracking-widest placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
          />
          <input
            type="text"
            placeholder="Votre pseudo"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={50}
            required
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Rejoindre'}
          </button>
        </form>
      </div>
    </div>
  );
}
