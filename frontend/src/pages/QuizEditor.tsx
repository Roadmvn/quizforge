import { useEffect, useState } from 'react';
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
    answers: [emptyAnswer(0), emptyAnswer(1), emptyAnswer(2), emptyAnswer(3)],
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
      // Validate
      for (const q of questions) {
        if (!q.text.trim()) throw new Error('All questions must have text');
        const filledAnswers = q.answers.filter((a) => a.text.trim());
        if (filledAnswers.length < 2) throw new Error('Each question needs at least 2 answers');
        if (!filledAnswers.some((a) => a.is_correct))
          throw new Error('Each question needs a correct answer');
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
        // Update quiz metadata
        await api.patch(`/quizzes/${id}`, { title, description });
        // Delete old questions and re-create (simpler than diffing)
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
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const colors = ['bg-red-500/20 border-red-500/40', 'bg-blue-500/20 border-blue-500/40', 'bg-yellow-500/20 border-yellow-500/40', 'bg-green-500/20 border-green-500/40'];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">
          &larr; Back
        </button>
        <h1 className="text-lg font-semibold">{isNew ? 'New Quiz' : 'Edit Quiz'}</h1>
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Quiz Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-xl font-semibold text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-indigo-400 font-medium">Question {qi + 1}</span>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-400">
                  Timer:
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={q.time_limit}
                    onChange={(e) => updateQuestion(qi, { time_limit: Number(e.target.value) })}
                    className="w-16 ml-2 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  />
                  s
                </label>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(qi)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <textarea
              placeholder="Enter your question..."
              value={q.text}
              onChange={(e) => updateQuestion(qi, { text: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />

            <div className="grid grid-cols-2 gap-3">
              {q.answers.map((a, ai) => (
                <div
                  key={ai}
                  onClick={() => setCorrectAnswer(qi, ai)}
                  className={`border rounded-lg p-3 cursor-pointer transition ${
                    a.is_correct
                      ? 'bg-green-500/20 border-green-500 ring-2 ring-green-500/50'
                      : colors[ai] || 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <input
                    type="text"
                    placeholder={`Answer ${ai + 1}`}
                    value={a.text}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateAnswer(qi, ai, { text: e.target.value });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
                  />
                  {a.is_correct && (
                    <span className="text-green-400 text-xs mt-1 block">Correct answer</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={addQuestion}
          className="w-full py-3 border-2 border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-500 transition"
        >
          + Add Question
        </button>
      </main>
    </div>
  );
}
