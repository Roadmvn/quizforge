import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Quiz, QuestionCreate, AnswerCreate } from '../lib/types';

function emptyAnswer(order: number): AnswerCreate {
  return { text: '', is_correct: false, order };
}

function emptyQuestion(order: number): QuestionCreate {
  return {
    text: '',
    order,
    time_limit: 30,
    image_url: null,
    answers: [emptyAnswer(0), emptyAnswer(1)],
  };
}

export default function QuizEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionCreate[]>([emptyQuestion(0)]);
  const [saving, setSaving] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(!isNew);
  const [error, setError] = useState('');
  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const uploadImage = async (qi: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token') || '';
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error('Echec de l\'upload');
    const data = await res.json();
    updateQuestion(qi, { image_url: data.url });
  };

  useEffect(() => {
    if (!isNew && id) {
      api.get<Quiz>(`/quizzes/${id}`).then((quiz) => {
        setTitle(quiz.title);
        setDescription(quiz.description);
        setQuestions(
          quiz.questions.map((q) => ({
            text: q.text,
            order: q.order,
            time_limit: q.time_limit,
            image_url: q.image_url ?? null,
            answers: q.answers.map((a) => ({
              text: a.text,
              is_correct: a.is_correct,
              order: a.order,
            })),
          }))
        );
      }).finally(() => setLoadingQuiz(false));
    }
  }, [id, isNew]);

  useEffect(() => {
    const hasContent = title.trim() || questions.some(q => q.text.trim());
    const handler = (e: BeforeUnloadEvent) => {
      if (hasContent) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [title, questions]);

  const updateQuestion = (idx: number, patch: Partial<QuestionCreate>) => {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateAnswer = (qIdx: number, aIdx: number, patch: Partial<AnswerCreate>) => {
    setQuestions((qs) =>
      qs.map((q, qi) =>
        qi === qIdx
          ? { ...q, answers: q.answers.map((a, ai) => (ai === aIdx ? { ...a, ...patch } : a)) }
          : q
      )
    );
  };

  const setCorrectAnswer = (qIdx: number, aIdx: number) => {
    setQuestions((qs) =>
      qs.map((q, qi) =>
        qi === qIdx
          ? { ...q, answers: q.answers.map((a, ai) => ({ ...a, is_correct: ai === aIdx })) }
          : q
      )
    );
  };

  const addAnswer = (qIdx: number) => {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIdx ? { ...q, answers: [...q.answers, emptyAnswer(q.answers.length)] } : q
      )
    );
  };

  const removeAnswer = (qIdx: number, aIdx: number) => {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIdx
          ? { ...q, answers: q.answers.filter((_, ai) => ai !== aIdx).map((a, ai) => ({ ...a, order: ai })) }
          : q
      )
    );
  };

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    setQuestions((qs) => {
      const newQs = [...qs];
      const target = direction === 'up' ? idx - 1 : idx + 1;
      [newQs[idx], newQs[target]] = [newQs[target], newQs[idx]];
      return newQs.map((q, i) => ({ ...q, order: i }));
    });
  };

  const addQuestion = () => {
    setQuestions((qs) => [...qs, emptyQuestion(qs.length)]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((qs) => qs.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i })));
  };

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      for (const q of questions) {
        if (!q.text.trim()) throw new Error('Toutes les questions doivent avoir un texte');
        const filledAnswers = q.answers.filter((a) => a.text.trim());
        if (filledAnswers.length < 2) throw new Error('Chaque question doit avoir au moins 2 reponses');
        if (!filledAnswers.some((a) => a.is_correct))
          throw new Error('Chaque question doit avoir une bonne reponse');
      }

      const payload = {
        title,
        description,
        questions: questions.map((q, qi) => ({
          ...q,
          order: qi,
          answers: q.answers
            .filter((a) => a.text.trim())
            .map((a, ai) => ({ ...a, order: ai })),
        })),
      };

      if (isNew) {
        await api.post('/quizzes/', payload);
      } else {
        await api.put(`/quizzes/${id}`, payload);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Echec de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const answerAccents = [
    { bg: 'rgba(239,68,68,0.05)', border: 'rgba(239,68,68,0.12)', hoverBorder: 'rgba(239,68,68,0.35)', glow: 'rgba(239,68,68,0.08)', dot: '#ef4444' },
    { bg: 'rgba(96,165,250,0.05)', border: 'rgba(96,165,250,0.12)', hoverBorder: 'rgba(96,165,250,0.35)', glow: 'rgba(96,165,250,0.08)', dot: '#60a5fa' },
    { bg: 'rgba(251,191,36,0.05)', border: 'rgba(251,191,36,0.12)', hoverBorder: 'rgba(251,191,36,0.35)', glow: 'rgba(251,191,36,0.08)', dot: '#fbbf24' },
    { bg: 'rgba(52,211,153,0.05)', border: 'rgba(52,211,153,0.12)', hoverBorder: 'rgba(52,211,153,0.35)', glow: 'rgba(52,211,153,0.08)', dot: '#34d399' },
    { bg: 'rgba(168,85,247,0.05)', border: 'rgba(168,85,247,0.12)', hoverBorder: 'rgba(168,85,247,0.35)', glow: 'rgba(168,85,247,0.08)', dot: '#a855f7' },
    { bg: 'rgba(244,114,182,0.05)', border: 'rgba(244,114,182,0.12)', hoverBorder: 'rgba(244,114,182,0.35)', glow: 'rgba(244,114,182,0.08)', dot: '#f472b6' },
  ];

  const inputClass = "w-full px-4 py-3.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl text-white placeholder-[#4a4a64] focus:outline-none focus:border-[rgba(124,92,252,0.5)] focus:bg-[rgba(255,255,255,0.06)] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.12),0_0_20px_rgba(124,92,252,0.08)] transition-all duration-300";

  if (loadingQuiz) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner-premium w-10 h-10" />
          <p className="text-[#8888a0] text-sm animate-pulse">Chargement du quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Premium header bar */}
      <div
        className="rounded-2xl mb-8 p-5 flex items-center justify-between"
        style={{
          background: 'rgba(15, 15, 35, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(124, 92, 252, 0.1)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-[#8888a0] hover:text-white transition-all duration-200 group"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
          <span className="text-sm font-medium hidden sm:inline">Retour</span>
        </button>

        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
              boxShadow: '0 0 20px rgba(124,92,252,0.3), 0 4px 12px rgba(124,92,252,0.2)',
            }}
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              {isNew ? 'Nouveau Quiz' : 'Modifier le Quiz'}
            </h1>
            <p className="text-[10px] text-[#4a4a64] uppercase tracking-[0.2em] font-medium">
              {questions.length} question{questions.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed btn-glow"
          style={{
            background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
            boxShadow: '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)',
          }}
          onMouseOver={(e) => { if (!saving) { e.currentTarget.style.boxShadow = '0 0 40px rgba(124,92,252,0.4), 0 6px 20px rgba(124,92,252,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}}
          onMouseOut={(e) => { e.currentTarget.style.boxShadow = '0 0 25px rgba(124,92,252,0.25), 0 4px 15px rgba(124,92,252,0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <div className="spinner-premium w-4 h-4" />
              Enregistrement...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Enregistrer
            </span>
          )}
        </button>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Error banner */}
        {error && (
          <div
            className="rounded-xl p-4 flex items-center justify-between animate-in"
            style={{
              background: 'rgba(248,113,113,0.06)',
              border: '1px solid rgba(248,113,113,0.2)',
              boxShadow: '0 0 30px rgba(248,113,113,0.06)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
                <svg className="w-4 h-4 text-[#f87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <span className="text-sm text-[#f87171]">{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Title & Description card */}
        <div
          className="rounded-2xl p-6 space-y-5 glow-card stagger-1"
          style={{
            background: 'rgba(15, 15, 35, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(124, 92, 252, 0.1)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(124,92,252,0.12)', border: '1px solid rgba(124,92,252,0.15)' }}
            >
              <svg className="w-4 h-4 text-[#7c5cfc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold text-white">Informations du quiz</span>
              <p className="text-[10px] text-[#4a4a64] uppercase tracking-[0.15em]">Titre et description</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#8888a0] mb-2 uppercase tracking-[0.15em]">Titre</label>
            <input
              type="text"
              placeholder="Titre du quiz"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass + ' text-lg font-semibold'}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8888a0] mb-2 uppercase tracking-[0.15em]">Description</label>
            <input
              type="text"
              placeholder="Description (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Questions */}
        {questions.map((q, qi) => {
          return (
            <div
              key={qi}
              className="rounded-2xl overflow-hidden glow-card"
              style={{
                background: 'rgba(15, 15, 35, 0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(124, 92, 252, 0.08)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
                animationDelay: `${0.05 + qi * 0.07}s`,
              }}
            >
              {/* Question header with gradient accent bar */}
              <div
                className="px-6 py-4 flex items-center justify-between"
                style={{
                  borderBottom: '1px solid rgba(124, 92, 252, 0.08)',
                  background: 'rgba(124, 92, 252, 0.03)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{
                      background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)',
                      boxShadow: '0 0 20px rgba(124,92,252,0.3), 0 4px 10px rgba(124,92,252,0.2)',
                    }}
                  >
                    {qi + 1}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white">Question {qi + 1}</span>
                    <p className="text-[10px] text-[#4a4a64] uppercase tracking-[0.15em]">
                      {q.answers.filter(a => a.text.trim()).length} reponse{q.answers.filter(a => a.text.trim()).length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Move buttons */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => moveQuestion(qi, 'up')}
                      disabled={qi === 0}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8888a0] hover:text-[#7c5cfc] transition-all disabled:opacity-20 disabled:hover:text-[#8888a0]"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      title="Monter"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveQuestion(qi, 'down')}
                      disabled={qi === questions.length - 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8888a0] hover:text-[#7c5cfc] transition-all disabled:opacity-20 disabled:hover:text-[#8888a0]"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      title="Descendre"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Timer */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <svg className="w-3.5 h-3.5 text-[#7c5cfc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <input
                      type="number"
                      min={5}
                      max={300}
                      value={q.time_limit}
                      onChange={(e) => updateQuestion(qi, { time_limit: Number(e.target.value) })}
                      className="w-12 bg-transparent text-[#e8e8f0] text-sm font-medium focus:outline-none text-center"
                    />
                    <span className="text-[10px] text-[#4a4a64] font-semibold uppercase">sec</span>
                  </div>

                  {/* Delete question */}
                  {questions.length > 1 && (
                    <button
                      onClick={() => removeQuestion(qi)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8888a0] hover:text-[#f87171] transition-all"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      title="Supprimer la question"
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'; e.currentTarget.style.background = 'rgba(248,113,113,0.06)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Question body */}
              <div className="p-6 space-y-5">
                <textarea
                  placeholder="Entrez votre question..."
                  value={q.text}
                  onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl text-white placeholder-[#4a4a64] focus:outline-none focus:border-[rgba(124,92,252,0.5)] focus:bg-[rgba(255,255,255,0.06)] focus:shadow-[0_0_0_3px_rgba(124,92,252,0.12),0_0_20px_rgba(124,92,252,0.08)] resize-none transition-all duration-300 text-[15px]"
                />

                {/* Image area */}
                {q.image_url ? (
                  <div className="relative group rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    <img
                      src={q.image_url}
                      alt="Question"
                      className="max-h-80 w-full object-contain bg-[rgba(0,0,0,0.2)] cursor-pointer"
                      onClick={() => setPreviewImage(q.image_url!)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                      <button
                        onClick={() => setPreviewImage(q.image_url!)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all"
                        style={{ background: 'rgba(124,92,252,0.8)', backdropFilter: 'blur(10px)', boxShadow: '0 4px 15px rgba(124,92,252,0.3)' }}
                        title="Apercu en grand"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => updateQuestion(qi, { image_url: null })}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all"
                        style={{ background: 'rgba(248,113,113,0.8)', backdropFilter: 'blur(10px)', boxShadow: '0 4px 15px rgba(248,113,113,0.3)' }}
                        title="Supprimer l'image"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current.get(qi)?.click()}
                    className="w-full rounded-xl p-5 transition-all duration-300 flex flex-col items-center justify-center gap-3 group"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '2px dashed rgba(124,92,252,0.12)',
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.35)'; e.currentTarget.style.background = 'rgba(124,92,252,0.04)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                      style={{ background: 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.15)' }}
                    >
                      <svg className="w-5 h-5 text-[#7c5cfc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm text-[#4a4a64] group-hover:text-[#8888a0] transition-colors">Ajouter une image</span>
                  </button>
                )}
                <input
                  ref={(el) => { if (el) fileInputRefs.current.set(qi, el); }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(qi, file).catch(() => setError('Echec de l\'upload de l\'image'));
                    e.target.value = '';
                  }}
                />

                {/* Answers label */}
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(124,92,252,0.12)] to-transparent" />
                  <span className="text-[10px] font-bold text-[#4a4a64] uppercase tracking-[0.2em]">Reponses</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(124,92,252,0.12)] to-transparent" />
                </div>

                {/* Answers grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {q.answers.map((a, ai) => {
                    const color = answerAccents[ai % answerAccents.length];
                    const isCorrect = a.is_correct;
                    return (
                      <div
                        key={ai}
                        onClick={() => setCorrectAnswer(qi, ai)}
                        className="rounded-xl p-4 cursor-pointer transition-all duration-300 relative group"
                        style={{
                          background: isCorrect ? 'rgba(52,211,153,0.06)' : color.bg,
                          border: `1px solid ${isCorrect ? 'rgba(52,211,153,0.3)' : color.border}`,
                          boxShadow: isCorrect ? '0 0 20px rgba(52,211,153,0.08), inset 0 1px 0 rgba(52,211,153,0.1)' : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                        }}
                        onMouseOver={(e) => {
                          if (!isCorrect) {
                            e.currentTarget.style.borderColor = color.hoverBorder;
                            e.currentTarget.style.boxShadow = `0 0 20px ${color.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`;
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isCorrect) {
                            e.currentTarget.style.borderColor = color.border;
                            e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.03)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }
                        }}
                      >
                        {q.answers.length > 2 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeAnswer(qi, ai); }}
                            className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center text-[#4a4a64] hover:text-[#f87171] opacity-0 group-hover:opacity-100 transition-all"
                            style={{ background: 'rgba(0,0,0,0.3)' }}
                            title="Supprimer cette reponse"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}

                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300"
                            style={{
                              background: isCorrect ? '#34d399' : 'transparent',
                              border: `2px solid ${isCorrect ? '#34d399' : 'rgba(255,255,255,0.15)'}`,
                              boxShadow: isCorrect ? '0 0 12px rgba(52,211,153,0.4)' : 'none',
                            }}
                          >
                            {isCorrect && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: isCorrect ? '#34d399' : color.dot, boxShadow: `0 0 6px ${isCorrect ? 'rgba(52,211,153,0.5)' : color.glow}` }}
                            />
                            <span className="text-[10px] text-[#8888a0] font-semibold uppercase tracking-wider">
                              {isCorrect ? 'Bonne reponse' : `Option ${ai + 1}`}
                            </span>
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder={`Reponse ${ai + 1}`}
                          value={a.text}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateAnswer(qi, ai, { text: e.target.value });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-transparent text-[#e8e8f0] placeholder-[#6b6b80] focus:outline-none text-sm font-medium cursor-text"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Add answer button */}
                {q.answers.length < 6 && (
                  <button
                    onClick={() => addAnswer(qi)}
                    className="w-full py-3 rounded-xl text-xs font-semibold text-[#4a4a64] hover:text-[#7c5cfc] transition-all duration-300 flex items-center justify-center gap-2 group"
                    style={{
                      border: '1px dashed rgba(124,92,252,0.12)',
                      background: 'rgba(255,255,255,0.01)',
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.3)'; e.currentTarget.style.background = 'rgba(124,92,252,0.03)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.01)'; }}
                  >
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Ajouter une reponse
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add question button */}
        <button
          onClick={addQuestion}
          className="w-full py-6 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-3 group glow-card"
          style={{
            background: 'rgba(15, 15, 35, 0.4)',
            border: '2px dashed rgba(124, 92, 252, 0.15)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'rgba(124,92,252,0.4)';
            e.currentTarget.style.background = 'rgba(124,92,252,0.06)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(124,92,252,0.1)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'rgba(124,92,252,0.15)';
            e.currentTarget.style.background = 'rgba(15,15,35,0.4)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
            style={{
              background: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(168,85,247,0.15))',
              border: '1px solid rgba(124,92,252,0.2)',
            }}
          >
            <svg className="w-6 h-6 text-[#7c5cfc] transition-transform duration-300 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div className="text-center">
            <span className="text-sm font-semibold text-[#8888a0] group-hover:text-white transition-colors">Ajouter une question</span>
            <p className="text-[10px] text-[#4a4a64] mt-0.5 uppercase tracking-[0.15em]">Question {questions.length + 1}</p>
          </div>
        </button>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>

      {/* Image preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8 cursor-pointer"
          style={{ background: 'rgba(6,6,14,0.9)', backdropFilter: 'blur(20px)' }}
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-6 right-6 w-12 h-12 rounded-xl flex items-center justify-center text-white transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
            }}
            onClick={() => setPreviewImage(null)}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.2)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={previewImage}
            alt="Apercu"
            className="max-w-full max-h-full object-contain rounded-2xl"
            style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 40px rgba(124,92,252,0.08)' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
