import React, { useEffect, useMemo, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

// Helper to safely read globals provided by the host page
function readGlobal(name, fallback) {
  try {
    if (typeof window !== 'undefined' && window && name in window) return window[name];
  } catch (_) {}
  try {
    if (typeof globalThis !== 'undefined' && globalThis && name in globalThis) return globalThis[name];
  } catch (_) {}
  return fallback;
}

function initFirebase() {
  const firebaseConfig = readGlobal('__firebase_config', undefined);
  if (!firebaseConfig) {
    throw new Error('Missing global __firebase_config for Firebase initialization.');
  }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { app, auth, db };
}

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

function useAuth() {
  const { auth } = useMemo(() => initFirebase(), []);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const initialAuthToken = readGlobal('__initial_auth_token', '');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    async function ensureSignIn() {
      if (!auth.currentUser) {
        try {
          if (initialAuthToken && typeof initialAuthToken === 'string' && initialAuthToken.trim().length > 0) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error('Authentication error:', error);
        }
      }
    }
    ensureSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, authReady };
}

function useFirestore() {
  const { db } = useMemo(() => initFirebase(), []);
  return db;
}

function useAppId() {
  const appId = readGlobal('__app_id', 'default_app');
  return appId || 'default_app';
}

function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function Header({ role, onResetRole }) {
  return (
    <header className="w-full border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-indigo-600 text-white">DL</div>
          <div className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">Dual-Role Learning</div>
        </div>
        <div className="flex items-center gap-3">
          {role && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
              Role: {role}
            </span>
          )}
          {onResetRole && (
            <button
              onClick={onResetRole}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-slate-800 active:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Switch Role
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function RoleSelection({ onSelectRole }) {
  const [isConductor, setIsConductor] = useState(false);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  function handleContinue() {
    setError('');
    if (isConductor) {
      if (secret.trim() === 'GEMINIXAM') {
        onSelectRole('conductor');
      } else {
        setError('Invalid secret phrase for Exam Conductor.');
      }
    } else {
      onSelectRole('student');
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:border-slate-800 dark:bg-slate-900/60">
      <h2 className="mb-2 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Welcome</h2>
      <p className="mb-6 text-center text-slate-600 dark:text-slate-300">Choose your role to continue.</p>

      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={isConductor}
            onChange={(e) => setIsConductor(e.target.checked)}
          />
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Enable Exam Conductor mode</span>
        </label>

        {isConductor && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Conductor Secret Phrase</label>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Enter secret (GEMINIXAM)"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <p className="text-xs text-slate-500">Only those with the secret can access conductor tools.</p>
          </div>
        )}

        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-900">{error}</div>}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={handleContinue}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500 active:bg-indigo-700"
          >
            Continue
          </button>
        </div>
        <div className="text-center text-xs text-slate-500">Tip: Leave unchecked to continue as Student.</div>
      </div>
    </div>
  );
}

function ConductorDashboard({ db, userId, appId }) {
  const [csvText, setCsvText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [previewCount, setPreviewCount] = useState(0);
  const collectionPath = `artifacts/${appId}/public/data/exams_questions`;

  function splitCsvLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields.map((f) => f.trim());
  }

  function parseCsv(text) {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headerOk: false, rows: [], errors: ['CSV content is empty.'] };

    const header = splitCsvLine(lines[0]);
    const expected = ['subject', 'difficulty', 'question', 'option1', 'option2', 'option3', 'option4', 'correctAnswerIndex'];
    const headerOk = header.length === expected.length && header.every((h, i) => h.toLowerCase() === expected[i].toLowerCase());

    const errors = [];
    const rows = [];

    for (let idx = 1; idx < lines.length; idx++) {
      const raw = lines[idx];
      const parts = splitCsvLine(raw);
      if (parts.length !== 8) {
        errors.push(`Line ${idx + 1}: expected 8 fields, got ${parts.length}.`);
        continue;
      }
      const [subject, difficulty, question, option1, option2, option3, option4, correctAnswerIndexRaw] = parts;
      if (!subject || !difficulty || !question) {
        errors.push(`Line ${idx + 1}: subject, difficulty, and question are required.`);
        continue;
      }
      const correctIdx = Number.parseInt(String(correctAnswerIndexRaw).trim(), 10);
      if (!Number.isInteger(correctIdx) || correctIdx < 0 || correctIdx > 3) {
        errors.push(`Line ${idx + 1}: correctAnswerIndex must be an integer between 0 and 3.`);
        continue;
      }
      rows.push({ subject, difficulty, question, options: [option1, option2, option3, option4], correctAnswerIndex: correctIdx });
    }

    return { headerOk, rows, errors };
  }

  function countPreview(text) {
    const { rows } = parseCsv(text);
    setPreviewCount(rows.length);
  }

  async function handleUpload() {
    setMessage(null);
    const { headerOk, rows, errors } = parseCsv(csvText);
    if (!headerOk) {
      setMessage({ type: 'error', text: 'CSV header is invalid. Expected: subject,difficulty,question,option1,option2,option3,option4,correctAnswerIndex' });
      return;
    }
    if (errors.length > 0) {
      setMessage({ type: 'error', text: `Fix CSV issues before upload. First error: ${errors[0]}` });
      return;
    }
    if (rows.length === 0) {
      setMessage({ type: 'error', text: 'No valid rows to upload.' });
      return;
    }

    setIsUploading(true);
    try {
      const CHUNK_SIZE = 400; // stay well below Firestore 500 write/commit limit
      let uploaded = 0;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        const slice = rows.slice(i, i + CHUNK_SIZE);
        for (const r of slice) {
          const ref = doc(collection(db, collectionPath));
          const document = {
            id: ref.id,
            subject: r.subject,
            difficulty: r.difficulty,
            question: r.question,
            options: r.options,
            correctAnswerIndex: r.correctAnswerIndex,
            createdAt: serverTimestamp(),
            conductorId: userId,
          };
          batch.set(ref, document);
        }
        await batch.commit();
        uploaded += slice.length;
      }
      setMessage({ type: 'success', text: `Uploaded ${uploaded} question${uploaded === 1 ? '' : 's'} successfully.` });
      setCsvText('');
      setPreviewCount(0);
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: 'Failed to upload questions. Check console for details.' });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Exam Conductor</h3>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Paste CSV with header: <span className="font-mono">subject,difficulty,question,option1,option2,option3,option4,correctAnswerIndex</span>
        </p>

        <textarea
          className="h-64 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          placeholder={
            'subject,difficulty,question,option1,option2,option3,option4,correctAnswerIndex\n' +
            'Physics,Easy,What is F=ma?,Force,Mass,Acceleration,Momentum,0\n' +
            'History,Medium,When did Columbus sail?,1492,1776,1066,1945,0'
          }
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            countPreview(e.target.value);
          }}
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-300">Preview: {previewCount} parsed row{previewCount === 1 ? '' : 's'}</div>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className={classNames(
              'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow',
              isUploading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
            )}
          >
            {isUploading ? 'Uploading…' : 'Upload Questions'}
          </button>
        </div>

        {message && (
          <div
            className={classNames(
              'mt-4 rounded-md p-3 text-sm ring-1 ring-inset',
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-900'
                : 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-900'
            )}
          >
            {message.text}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h4 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Notes</h4>
        <ul className="list-disc space-y-1 pl-6 text-sm text-slate-600 dark:text-slate-300">
          <li>Each row must have exactly 8 fields in the strict order.</li>
          <li><span className="font-mono">correctAnswerIndex</span> must be 0–3 corresponding to the four options.</li>
          <li>Uploaded documents are stored under <span className="font-mono">artifacts/{appId}/public/data/exams_questions</span>.</li>
        </ul>
      </div>
    </div>
  );
}

function StudentDashboard({ db, appId }) {
  const [allQuestions, setAllQuestions] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');

  const [isExamActive, setIsExamActive] = useState(false);
  const [currentExamQuestions, setCurrentExamQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const collectionPath = `artifacts/${appId}/public/data/exams_questions`;

  useEffect(() => {
    const ref = collection(db, collectionPath);
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllQuestions(docs);
    });
    return () => unsubscribe();
  }, [db, collectionPath]);

  const subjects = useMemo(() => Array.from(new Set(allQuestions.map((q) => q.subject).filter(Boolean))).sort(), [allQuestions]);
  const difficulties = useMemo(() => Array.from(new Set(allQuestions.map((q) => q.difficulty).filter(Boolean))).sort(), [allQuestions]);

  function shuffleInPlace(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function startExam() {
    const filtered = allQuestions.filter(
      (q) => q.subject === selectedSubject && q.difficulty === selectedDifficulty
    );
    if (filtered.length === 0) return;
    setCurrentExamQuestions(shuffleInPlace([...filtered]));
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setIsExamActive(true);
    setShowResults(false);
  }

  function answerAndNext(selectedIndex) {
    const current = currentExamQuestions[currentQuestionIndex];
    const nextAnswers = { ...userAnswers, [current.id]: selectedIndex };
    const nextIndex = currentQuestionIndex + 1;
    const isFinished = nextIndex >= currentExamQuestions.length;

    setUserAnswers(nextAnswers);
    if (isFinished) {
      setIsExamActive(false);
      setShowResults(true);
    } else {
      setCurrentQuestionIndex(nextIndex);
    }
  }

  function resetExam() {
    setIsExamActive(false);
    setShowResults(false);
    setCurrentExamQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
  }

  const totalQuestions = currentExamQuestions.length;
  const correctCount = useMemo(() => {
    if (!showResults) return 0;
    let correct = 0;
    for (const q of currentExamQuestions) {
      const chosen = userAnswers[q.id];
      if (typeof chosen === 'number' && chosen === q.correctAnswerIndex) correct += 1;
    }
    return correct;
  }, [showResults, currentExamQuestions, userAnswers]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Subject</label>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">Select subject…</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Difficulty</label>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
          >
            <option value="">Select difficulty…</option>
            {difficulties.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={startExam}
            disabled={!selectedSubject || !selectedDifficulty || allQuestions.length === 0}
            className={classNames(
              'h-[42px] w-full rounded-md px-4 text-sm font-semibold text-white shadow',
              !selectedSubject || !selectedDifficulty || allQuestions.length === 0
                ? 'bg-indigo-400'
                : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700'
            )}
          >
            Start Exam
          </button>
        </div>
      </div>

      {!isExamActive && !showResults && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Get Ready</h3>
          <p className="text-slate-600 dark:text-slate-300">
            Select a subject and difficulty, then start your exam.
          </p>
          {selectedSubject && selectedDifficulty && (
            <p className="mt-2 text-sm text-slate-500">
              Available questions will be pulled in real-time from the question bank.
            </p>
          )}
        </div>
      )}

      {isExamActive && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>Subject: <span className="font-medium">{selectedSubject}</span></span>
            <span>Difficulty: <span className="font-medium">{selectedDifficulty}</span></span>
            <span>
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </span>
          </div>

          {currentExamQuestions[currentQuestionIndex] ? (
            <div>
              <div className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {currentExamQuestions[currentQuestionIndex].question}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {currentExamQuestions[currentQuestionIndex].options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => answerAndNext(idx)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-900 shadow-sm hover:bg-slate-100 active:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-600 dark:text-slate-300">
              <Spinner label="Loading question…" />
            </div>
          )}
        </div>
      )}

      {!isExamActive && showResults && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-2xl font-bold text-slate-900 dark:text-slate-100">Results</h3>
          <p className="text-lg text-slate-700 dark:text-slate-300">
            You scored <span className="font-semibold text-indigo-600 dark:text-indigo-400">{correctCount}</span> out of{' '}
            <span className="font-semibold">{totalQuestions}</span>.
          </p>
          <div className="mt-5 flex items-center justify-center">
            <button
              onClick={resetExam}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 active:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Retake Exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { user, authReady } = useAuth();
  const db = useFirestore();
  const appId = useAppId();
  const [role, setRole] = useState(null); // 'student' | 'conductor'

  const authError = !authReady ? null : !user ? 'Unable to authenticate user.' : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      <Header role={role} onResetRole={role ? () => setRole(null) : null} />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {!authReady && (
          <div className="py-16 text-center">
            <Spinner label="Initializing…" />
          </div>
        )}

        {authReady && authError && (
          <div className="mx-auto mt-12 max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700 ring-1 ring-inset ring-red-200 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-900">
            <div className="mb-2 text-lg font-semibold">Authentication Error</div>
            <div className="text-sm">{authError}</div>
            <div className="mt-2 text-xs text-red-500">Ensure global __firebase_config and optional __initial_auth_token are provided.</div>
          </div>
        )}

        {authReady && user && !role && <RoleSelection onSelectRole={setRole} />}

        {authReady && user && role && (
          <section>
            {role === 'conductor' ? (
              <ConductorDashboard db={db} userId={user.uid} appId={appId} />)
              : role === 'student' ? (
                <StudentDashboard db={db} appId={appId} />
              ) : null}
          </section>
        )}
      </main>

      <footer className="mt-10 border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Built with React, Tailwind, and Firestore.
      </footer>
    </div>
  );
}
