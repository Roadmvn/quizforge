import { useState } from 'react';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
}

export default function Login({ onLogin, onRegister }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedName = name.trim();
    try {
      if (isRegister) {
        await onRegister(trimmedEmail, trimmedPassword, trimmedName);
      } else {
        await onLogin(trimmedEmail, trimmedPassword);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl text-white placeholder-[#4a4a64] focus:outline-none focus:border-[rgba(124,92,252,0.5)] focus:bg-[rgba(255,255,255,0.06)] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.12),0_0_20px_rgba(124,92,252,0.08)] transition-all duration-300";

  return (
    <div className="min-h-screen bg-[#06060e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="mesh-gradient" />
      <div className="mesh-gradient-extra" />
      <div className="grid-pattern fixed inset-0 z-0" />
      <div className="noise" />

      {/* Decorative orbs */}
      <div className="fixed top-1/4 left-1/4 w-[300px] h-[300px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(124,92,252,0.08) 0%, transparent 60%)', filter: 'blur(40px)', animation: 'orbFloat1 15s ease-in-out infinite' }} />
      <div className="fixed bottom-1/4 right-1/4 w-[250px] h-[250px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 60%)', filter: 'blur(40px)', animation: 'orbFloat2 18s ease-in-out infinite' }} />

      <div className="relative z-10 w-full max-w-[440px] animate-in">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-block mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{
                background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
                boxShadow: '0 0 40px rgba(124,92,252,0.4), 0 8px 25px rgba(124,92,252,0.25)',
                animation: 'logoBreathe 4s ease-in-out infinite',
              }}
            >
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            <span className="text-[#7c5cfc]">Quiz</span>
            <span className="text-white">Forge</span>
          </h1>
          <p className="text-[#8888a0] text-sm tracking-wide">Plateforme de formation en cybersecurite</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 glow-card"
          style={{
            background: 'rgba(15, 15, 35, 0.7)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(124, 92, 252, 0.12)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.4), 0 0 40px rgba(124,92,252,0.06), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* Tab switcher */}
          <div className="flex mb-8 border-b border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => setIsRegister(false)}
              className={`relative flex-1 pb-3.5 text-sm font-semibold transition-all duration-300 ${
                !isRegister ? 'text-white' : 'text-[#4a4a64] hover:text-[#8888a0]'
              }`}
            >
              Connexion
              {!isRegister && (
                <span className="absolute bottom-0 left-[10%] right-[10%] h-[2px] rounded-t" style={{ background: 'linear-gradient(90deg, #7c5cfc, #a855f7)', boxShadow: '0 0 12px rgba(124,92,252,0.5)' }} />
              )}
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`relative flex-1 pb-3.5 text-sm font-semibold transition-all duration-300 ${
                isRegister ? 'text-white' : 'text-[#4a4a64] hover:text-[#8888a0]'
              }`}
            >
              Inscription
              {isRegister && (
                <span className="absolute bottom-0 left-[10%] right-[10%] h-[2px] rounded-t" style={{ background: 'linear-gradient(90deg, #7c5cfc, #a855f7)', boxShadow: '0 0 12px rgba(124,92,252,0.5)' }} />
              )}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div className="stagger-1">
                <label htmlFor="register-name" className="block text-xs font-semibold text-[#8888a0] mb-2 uppercase tracking-[0.15em]">Nom d'affichage</label>
                <input id="register-name" type="text" placeholder="Votre nom" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
              </div>
            )}
            <div className={isRegister ? 'stagger-2' : 'stagger-1'}>
              <label htmlFor="login-email" className="block text-xs font-semibold text-[#8888a0] mb-2 uppercase tracking-[0.15em]">Email</label>
              <input id="login-email" type="email" placeholder="nom@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
            </div>
            <div className={isRegister ? 'stagger-3' : 'stagger-2'}>
              <label htmlFor="login-password" className="block text-xs font-semibold text-[#8888a0] mb-2 uppercase tracking-[0.15em]">Mot de passe</label>
              <input id="login-password" type="password" placeholder="8 caracteres minimum" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className={inputClass} />
            </div>

            {error && (
              <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.2)] text-[#f87171] rounded-xl p-3.5 text-sm animate-in flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed btn-glow"
              style={{
                background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
                color: 'white',
                boxShadow: '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)',
              }}
              onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 0 40px rgba(124,92,252,0.4), 0 6px 20px rgba(124,92,252,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="spinner-premium w-4 h-4" />
                  Chargement...
                </span>
              ) : isRegister ? 'Creer un compte' : 'Se connecter'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[#4a4a64] text-xs mt-6 tracking-wide">Securise par chiffrement de bout en bout</p>
      </div>
    </div>
  );
}
