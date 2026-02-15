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
      });
    }
  }, [id, isNew]);

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
        await api.patch(`/quizzes/${id}`, { title, description });
        const existing = await api.get<Quiz>(`/quizzes/${id}`);
        for (const q of existing.questions) {
          await api.delete(`/quizzes/${id}/questions/${q.id}`);
        }
        for (const q of payload.questions) {
          await api.post(`/quizzes/${id}/questions`, q);
        }
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Echec de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const colors = [
    'bg-red-500/15 border-red-500/30 hover:border-red-500/50',
    'bg-blue-500/15 border-blue-500/30 hover:border-blue-500/50',
    'bg-yellow-500/15 border-yellow-500/30 hover:border-yellow-500/50',
    'bg-green-500/15 border-green-500/30 hover:border-green-500/50',
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-slate-100 text-sm transition flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Retour
        </button>
        <h1 className="text-lg font-semibold text-white">{isNew ? 'Nouveau Quiz' : 'Modifier le Quiz'}</h1>
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-sm font-medium transition-all duration-300 disabled:opacity-50 shadow-lg shadow-indigo-500/20"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Enregistrement...
            </span>
          ) : 'Enregistrer'}
        </button>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-4">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Titre du quiz"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-2xl font-bold text-white placeholder-slate-600 border-b-2 border-slate-700 focus:border-indigo-500 pb-3 focus:outline-none transition"
          />
          <input
            type="text"
            placeholder="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
          />
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {qi + 1}
                </span>
                <span className="text-sm font-medium text-slate-300">Question</span>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={q.time_limit}
                    onChange={(e) => updateQuestion(qi, { time_limit: Number(e.target.value) })}
                    className="w-16 px-2 py-1 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                  />
                  s
                </label>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(qi)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                    title="Supprimer la question"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>

            <textarea
              placeholder="Entrez votre question..."
              value={q.text}
              onChange={(e) => updateQuestion(qi, { text: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition"
            />

            {q.image_url ? (
              <div className="relative group">
                <img src={q.image_url} alt="Question" className="max-h-80 w-full object-contain rounded-xl bg-slate-900/50 cursor-pointer" onClick={() => setPreviewImage(q.image_url!)} />
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    onClick={() => setPreviewImage(q.image_url!)}
                    className="w-7 h-7 bg-slate-900/80 hover:bg-indigo-500/80 rounded-full flex items-center justify-center text-white transition opacity-0 group-hover:opacity-100"
                    title="Apercu en grand"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                  </button>
                  <button
                    onClick={() => updateQuestion(qi, { image_url: null })}
                    className="w-7 h-7 bg-slate-900/80 hover:bg-red-500/80 rounded-full flex items-center justify-center text-white transition opacity-0 group-hover:opacity-100"
                    title="Supprimer l'image"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRefs.current.get(qi)?.click()}
                className="w-full border border-dashed border-slate-700/50 rounded-xl p-4 hover:border-indigo-500/50 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-sm text-slate-500">Ajouter une image</span>
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

            <div className="grid grid-cols-2 gap-3">
              {q.answers.map((a, ai) => (
                <div
                  key={ai}
                  onClick={() => setCorrectAnswer(qi, ai)}
                  className={`border rounded-xl p-3 cursor-pointer transition-all duration-200 relative group ${
                    a.is_correct
                      ? 'bg-green-500/20 border-green-500 ring-2 ring-green-500/50 shadow-lg shadow-green-500/10'
                      : colors[ai % colors.length] || 'bg-slate-700/50 border-slate-600'
                  }`}
                >
                  {q.answers.length > 2 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeAnswer(qi, ai); }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-slate-900/80 text-slate-500 hover:text-red-400 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                      title="Supprimer cette reponse"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      a.is_correct ? 'border-green-400 bg-green-400' : 'border-slate-500'
                    }`}>
                      {a.is_correct && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">Reponse {ai + 1}</span>
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
                    className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm"
                  />
                </div>
              ))}
            </div>

            {q.answers.length < 6 && (
              <button
                onClick={() => addAnswer(qi)}
                className="w-full py-2 border border-dashed border-slate-700/50 rounded-lg text-xs text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-all flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Ajouter une reponse
              </button>
            )}
          </div>
        ))}

        <button
          onClick={addQuestion}
          className="w-full py-4 border-2 border-dashed border-slate-700/50 rounded-xl text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-all duration-300 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Ajouter une question
        </button>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-slate-800/80 hover:bg-slate-700 rounded-full flex items-center justify-center text-white transition"
            onClick={() => setPreviewImage(null)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img
            src={previewImage}
            alt="Apercu"
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
