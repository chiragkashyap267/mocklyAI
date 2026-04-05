'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic, Loader2, CheckCircle2, Volume2, PlayCircle, Trophy,
  ChevronDown, AlertTriangle, X, ShieldAlert, EyeOff,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const SILENCE_SECS    = 5;
const COUNTDOWN_SHOW  = 3;
const MAX_CHEAT_WARNS = 3;

const getSectionLabel = (q) =>
  ((q?.questionType || '').toLowerCase() === 'hr' ? 'hr' : 'technical');

const containsHindi = (text) => /[\u0900-\u097F]/.test(text);

// ── Waveform bars ─────────────────────────────────────────────────────────
function WaveformBars() {
  return (
    <div className="flex items-end gap-[3px] h-5 flex-shrink-0">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="wave-bar bg-rose-400" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  );
}

// ── Transition overlay ────────────────────────────────────────────────────
function TransitionOverlay({ num, total }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0a0a0a]/97 backdrop-blur-sm rounded-2xl sm:rounded-3xl">
      <div className="flex items-end gap-2 mb-3">
        {[0,1,2].map(i => (
          <span key={i} className="bounce-dot w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
        ))}
      </div>
      <p className="text-slate-300 text-xs sm:text-sm font-medium">Preparing Q{num} of {total}…</p>
      <div className="mt-3 w-32 h-0.5 bg-white/5 rounded-full overflow-hidden relative shimmer-bar" />
    </div>
  );
}

// ── Cheat banner ──────────────────────────────────────────────────────────
function CheatBanner({ count, isForced, onDismiss }) {
  if (isForced) return null; // forced-finish card is shown in main UI
  return (
    <div className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-[150] shake-warn">
      <div className="bg-red-950/98 border border-red-500/50 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-2xl backdrop-blur-xl">
        <EyeOff className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-red-200 text-sm font-bold leading-tight">Tab Switch Detected!</p>
          <p className="text-red-400/80 text-xs mt-0.5">
            Warning <strong className="text-red-300">{count}/{MAX_CHEAT_WARNS}</strong> —
            {count >= 2 ? ' next switch ends the interview.' : ' please stay on this tab.'}
          </p>
        </div>
        <button onClick={onDismiss} className="text-red-500/60 hover:text-red-300">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Hindi banner ──────────────────────────────────────────────────────────
function HindiBanner({ onDismiss }) {
  return (
    <div className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-[140]">
      <div className="bg-amber-950/98 border border-amber-500/40 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-300">
        <span className="text-lg flex-shrink-0">🇮🇳</span>
        <div className="flex-1 min-w-0">
          <p className="text-amber-200 text-sm font-bold leading-tight">Hindi Detected</p>
          <p className="text-amber-400/80 text-xs mt-0.5 leading-snug">
            Answer recorded! पर <strong className="text-amber-300">English में बोलें</strong> for best results.
          </p>
        </div>
        <button onClick={onDismiss} className="text-amber-500/60 hover:text-amber-300">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function InterviewRoom({ params }) {
  const { id }   = use(params);
  const router   = useRouter();

  // ── State ─────────────────────────────────────────────────────────────────
  const [interview,           setInterview]           = useState(null);
  const [loading,             setLoading]             = useState(true);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [hasStarted,          setHasStarted]          = useState(false);
  const [isSpeaking,          setIsSpeaking]          = useState(false);
  const [isRecording,         setIsRecording]         = useState(false);
  const [isEvaluating,        setIsEvaluating]        = useState(false);
  const [isFinished,          setIsFinished]          = useState(false);
  const [isForceFinished,     setIsForceFinished]     = useState(false);
  const [isTransitioning,     setIsTransitioning]     = useState(false);
  const [silenceCountdown,    setSilenceCountdown]    = useState(null);
  const [transcript,          setTranscript]          = useState('');
  const [spokenWordIndex,     setSpokenWordIndex]     = useState(-1);
  const [warningDismissed,    setWarningDismissed]    = useState(false);
  const [cheatWarnings,       setCheatWarnings]       = useState(0);
  const [showCheatBanner,     setShowCheatBanner]     = useState(false);
  const [showHindiBanner,     setShowHindiBanner]     = useState(false);
  const [hindiNotified,       setHindiNotified]       = useState(false);
  const [questionKey,         setQuestionKey]         = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const transcriptRef        = useRef('');
  const recognitionRef       = useRef(null);
  const mainTimerRef         = useRef(null);
  const countdownDelayRef    = useRef(null);
  const countdownIntervalRef = useRef(null);
  const isEvaluatingRef      = useRef(false);
  const activeIdxRef         = useRef(0);
  const interviewRef         = useRef(null);
  const submitRef            = useRef(null);
  const questionScrollRef    = useRef(null);
  const ttsKeepAliveRef      = useRef(null);
  const cheatWarningsRef     = useRef(0);
  const isFinishedRef        = useRef(false);
  const baseResultIndexRef   = useRef(-1);

  // Keep refs in sync
  useEffect(() => { activeIdxRef.current    = activeQuestionIndex; }, [activeQuestionIndex]);
  useEffect(() => { isEvaluatingRef.current = isEvaluating;        }, [isEvaluating]);
  useEffect(() => { interviewRef.current    = interview;           }, [interview]);
  useEffect(() => { isFinishedRef.current   = isFinished;          }, [isFinished]);

  // ── Fetch interview ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'interviews', id));
        if (!snap.exists()) { router.push('/dashboard'); return; }
        const data = snap.data();
        if (!data.answers) data.answers = new Array(data.questions.length).fill(null);
        setInterview({ id: snap.id, ...data });
        const first = data.answers.findIndex(a => a === null);
        if (first !== -1) setActiveQuestionIndex(first);
        else setIsFinished(true);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [id, router]);

  // ── Speech recognition init ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;
    rec.lang            = 'en-IN';

    rec.onstart  = () => { setIsRecording(true); baseResultIndexRef.current = -1; };
    rec.onend    = () => setIsRecording(false);
    rec.onerror  = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') console.error('SR:', e.error);
      setIsRecording(false);
    };
    rec.onresult = (ev) => {
      if (baseResultIndexRef.current === -1) baseResultIndexRef.current = ev.resultIndex;
      const base = baseResultIndexRef.current;
      let finalText = '', interimText = '';
      for (let i = base; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) finalText   += ev.results[i][0].transcript + ' ';
        else                        interimText  = ev.results[i][0].transcript;
      }
      const t = (finalText + interimText).trim();
      if (t && containsHindi(t) && !hindiNotified) {
        setHindiNotified(true);
        setShowHindiBanner(true);
        speakHindiNotice();
      }
      setTranscript(t);
      transcriptRef.current = t;
      if (t.trim()) resetSilenceTimer();
    };
    recognitionRef.current = rec;
    return () => {
      killTimers(); stopTtsKeepAlive();
      try { rec.stop(); } catch (_) {}
      window.speechSynthesis?.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cheat detection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasStarted || isFinished) return;
    const handler = () => { if (document.hidden && !isFinishedRef.current) handleCheat(); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, isFinished]);

  const handleCheat = useCallback(() => {
    if (isFinishedRef.current) return;
    cheatWarningsRef.current += 1;
    const count = cheatWarningsRef.current;
    setCheatWarnings(count);
    setShowCheatBanner(true);
    if (count >= MAX_CHEAT_WARNS) {
      window.speechSynthesis?.cancel();
      stopTtsKeepAlive(); killTimers();
      try { recognitionRef.current?.stop(); } catch (_) {}
      setIsForceFinished(true); setIsFinished(true);
      isFinishedRef.current = true;
      setTimeout(() => router.push('/dashboard/leaderboard'), 5000);
    } else {
      setTimeout(() => setShowCheatBanner(false), 4000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ── Auto-speak on question change ──────────────────────────────────────────
  useEffect(() => {
    if (hasStarted && interview && !isFinished) {
      if (!interview.answers[activeQuestionIndex]) {
        if (questionScrollRef.current) questionScrollRef.current.scrollTop = 0;
        setHindiNotified(false);
        setQuestionKey(k => k + 1);
        const t = setTimeout(() =>
          speakQuestion(interview.questions[activeQuestionIndex].question), 600);
        return () => clearTimeout(t);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestionIndex, hasStarted, isFinished, interview]);

  // ── Timers ─────────────────────────────────────────────────────────────────
  const killTimers = useCallback(() => {
    clearTimeout(mainTimerRef.current);
    clearTimeout(countdownDelayRef.current);
    clearInterval(countdownIntervalRef.current);
    mainTimerRef.current = countdownDelayRef.current = countdownIntervalRef.current = null;
    setSilenceCountdown(null);
  }, []);

  const resetSilenceTimer = useCallback(() => {
    killTimers();
    mainTimerRef.current = setTimeout(() => {
      if (transcriptRef.current.trim() && !isEvaluatingRef.current) submitRef.current?.();
      else resetSilenceTimer();
    }, SILENCE_SECS * 1000);
    countdownDelayRef.current = setTimeout(() => {
      if (isEvaluatingRef.current) return;
      let rem = COUNTDOWN_SHOW;
      setSilenceCountdown(rem);
      countdownIntervalRef.current = setInterval(() => {
        rem -= 1; setSilenceCountdown(rem);
        if (rem <= 0) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
      }, 1000);
    }, (SILENCE_SECS - COUNTDOWN_SHOW) * 1000);
  }, [killTimers]);

  // ── TTS keep-alive ─────────────────────────────────────────────────────────
  const startTtsKeepAlive = () => {
    stopTtsKeepAlive();
    ttsKeepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause(); window.speechSynthesis.resume();
      }
    }, 10000);
  };
  const stopTtsKeepAlive = () => {
    if (ttsKeepAliveRef.current) { clearInterval(ttsKeepAliveRef.current); ttsKeepAliveRef.current = null; }
  };

  // ── TTS voice selector ─────────────────────────────────────────────────────
  const getBestVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const t1 = ['google uk english female', 'google us english', 'microsoft aria online (natural)', 'microsoft jenny online (natural)', 'microsoft libby online (natural)', 'microsoft ryan online (natural)'];
    for (const n of t1) { const v = voices.find(v => v.name.toLowerCase().includes(n)); if (v) return v; }
    const t2 = ['microsoft zira', 'microsoft david', 'veena', 'ravi', 'google uk english male'];
    for (const n of t2) { const v = voices.find(v => v.name.toLowerCase().includes(n)); if (v) return v; }
    for (const p of [/en.?us/i, /en.?gb/i, /en.?in/i]) { const v = voices.find(v => p.test(v.lang)); if (v) return v; }
    return voices[0] || null;
  };

  const speakQuestion = useCallback((text, onDone) => {
    if (!('speechSynthesis' in window)) { startListening(); return; }
    window.speechSynthesis.cancel(); stopTtsKeepAlive();
    const go = () => {
      const utt = new SpeechSynthesisUtterance(text);
      const voice = getBestVoice();
      if (voice) { utt.voice = voice; utt.lang = voice.lang; } else { utt.lang = 'en-US'; }
      utt.rate = 0.88; utt.pitch = 1.05; utt.volume = 1;
      utt.onboundary = (e) => { if (e.name === 'word') setSpokenWordIndex(e.charIndex); };
      utt.onstart    = () => { setIsSpeaking(true); setSpokenWordIndex(0); startTtsKeepAlive(); };
      utt.onend      = () => { stopTtsKeepAlive(); setIsSpeaking(false); setSpokenWordIndex(-1); onDone ? onDone() : startListening(); };
      utt.onerror    = (e) => {
        stopTtsKeepAlive(); setIsSpeaking(false); setSpokenWordIndex(-1);
        if (e.error !== 'interrupted' && e.error !== 'canceled') console.warn('TTS:', e.error);
        onDone ? onDone() : startListening();
      };
      window.speechSynthesis.speak(utt);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) go();
    else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; go(); }; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakHindiNotice = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    const n = new SpeechSynthesisUtterance('Aapne Hindi mein jawab diya. Please English mein bolein.');
    const v = getBestVoice(); if (v) { n.voice = v; n.lang = v.lang; }
    n.rate = 0.9; window.speechSynthesis.speak(n);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start listening ────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    setTranscript(''); transcriptRef.current = ''; baseResultIndexRef.current = -1;
    try { recognitionRef.current?.stop(); } catch (_) {}
    setTimeout(() => { try { recognitionRef.current?.start(); } catch (_) {} }, 200);
    setIsRecording(true);
    resetSilenceTimer();
  }, [resetSilenceTimer]);

  // ── Finish interview ──────────────────────────────────────────────────────
  const finishInterview = useCallback(() => {
    window.speechSynthesis?.cancel(); stopTtsKeepAlive(); killTimers();
    try { recognitionRef.current?.stop(); } catch (_) {}
    setIsFinished(true); isFinishedRef.current = true;
    setIsRecording(false); setIsSpeaking(false);
  }, [killTimers]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const autoSubmitAnswer = useCallback(async () => {
    killTimers();
    const ft = transcriptRef.current, ci = interviewRef.current, idx = activeIdxRef.current;
    if (!ft.trim() || !ci || isEvaluatingRef.current) return;
    setIsEvaluating(true); setIsRecording(false);
    window.speechSynthesis?.cancel(); stopTtsKeepAlive();
    try { recognitionRef.current?.stop(); } catch (_) {}
    try {
      const q   = ci.questions[idx];
      const res = await fetch('/api/evaluate-answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.question, idealConcepts: q.idealAnswerConcepts, userAnswer: ft, isHindi: containsHindi(ft) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = [...ci.answers];
      updated[idx]  = { transcript: ft, evaluation: data.evaluation };
      await updateDoc(doc(db, 'interviews', id), { answers: updated });
      setInterview(prev => ({ ...prev, answers: updated }));
      setTranscript(''); transcriptRef.current = '';
      if (idx < ci.questions.length - 1) {
        setIsTransitioning(true);
        setTimeout(() => { setIsTransitioning(false); setActiveQuestionIndex(idx + 1); }, 900);
      } else {
        finishInterview();
        setTimeout(() => router.push('/dashboard/leaderboard'), 5000);
      }
    } catch (err) {
      console.error(err); setIsEvaluating(false); startListening();
    } finally { setIsEvaluating(false); }
  }, [id, killTimers, startListening, finishInterview, router]);

  // ── Skip ──────────────────────────────────────────────────────────────────
  const skipQuestion = useCallback(async () => {
    killTimers(); window.speechSynthesis?.cancel(); stopTtsKeepAlive();
    const ci = interviewRef.current, idx = activeIdxRef.current;
    if (!ci || isEvaluatingRef.current) return;
    setIsEvaluating(true); setIsRecording(false);
    try { recognitionRef.current?.stop(); } catch (_) {}
    try {
      const updated = [...ci.answers];
      updated[idx]  = { transcript: 'User skipped.', evaluation: { score: 0, feedback: 'Skipped.', improvement: 'Try next time.' } };
      await updateDoc(doc(db, 'interviews', id), { answers: updated });
      setInterview(prev => ({ ...prev, answers: updated }));
      setTranscript(''); transcriptRef.current = '';
      if (idx < ci.questions.length - 1) {
        setIsTransitioning(true);
        setTimeout(() => { setIsTransitioning(false); setActiveQuestionIndex(idx + 1); }, 900);
      } else {
        finishInterview();
        setTimeout(() => router.push('/dashboard/leaderboard'), 5000);
      }
    } catch (err) { console.error(err); setIsEvaluating(false); startListening(); }
    finally { setIsEvaluating(false); }
  }, [id, killTimers, startListening, finishInterview, router]);

  useEffect(() => { submitRef.current = autoSubmitAnswer; }, [autoSubmitAnswer]);

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
    </div>
  );
  if (!interview) return null;

  const q     = interview.questions[activeQuestionIndex];
  const totalQ = interview.questions.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {showCheatBanner && !isForceFinished && (
        <CheatBanner count={cheatWarnings} onDismiss={() => setShowCheatBanner(false)} />
      )}
      {showHindiBanner && (
        <HindiBanner onDismiss={() => setShowHindiBanner(false)} />
      )}

      {/*
        Container fills exactly the space given by dashboard layout (flex-1 min-h-0 flex flex-col).
        We use h-full to lock into that space with no overflow.
      */}
      <div className="flex-1 min-h-0 flex flex-col gap-2">

        {/* ── Header: single compact line on all screen sizes ── */}
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-0.5">
          {/* Left: role + subtitle */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hidden xs:inline">
                {getSectionLabel(q) === 'hr' ? '💬 HR' : '⚙️ Tech'}
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20 hidden xs:inline-block" />
              <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[160px] sm:max-w-xs">
                {interview.jobRole}
              </h1>
            </div>
            <p className="text-[10px] text-slate-600 mt-0.5 leading-tight hidden sm:block">
              🎙 Mic on · 🔊 Speak clearly · No background noise
            </p>
          </div>

          {/* Right: cheat count + progress */}
          {!isFinished && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {cheatWarnings > 0 && (
                <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  <span className="text-red-400 text-[10px] font-bold">{cheatWarnings}/{MAX_CHEAT_WARNS}</span>
                </div>
              )}
              <span className="text-slate-400 text-xs font-mono">{activeQuestionIndex + 1}/{totalQ}</span>
              {/* Progress dots — limit to 15 max displayed */}
              <div className="flex gap-0.5 items-center">
                {interview.questions.slice(0, 15).map((qq, i) => (
                  <div key={i} className={`rounded-full transition-all duration-400 ${
                    i < activeQuestionIndex
                      ? 'w-2 h-1.5 bg-emerald-500'
                      : i === activeQuestionIndex
                        ? 'w-3 h-1.5 animate-pulse ' + (getSectionLabel(qq) === 'hr' ? 'bg-violet-500' : 'bg-indigo-500')
                        : 'w-1.5 h-1.5 bg-white/10'
                  }`} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Main card — fills all remaining space ── */}
        {isFinished ? (
          <div className="flex-1 min-h-0 bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center text-center p-6 sm:p-10">
            {isForceFinished ? (
              <>
                <ShieldAlert className="w-12 h-12 text-red-400 mb-4" />
                <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2">Session Terminated</h2>
                <p className="text-slate-400 text-sm max-w-xs">Ended due to repeated tab switching. Partial results submitted.</p>
              </>
            ) : (
              <>
                <Trophy className="w-14 sm:w-16 h-14 sm:h-16 text-yellow-400 mb-4 drop-shadow-[0_0_24px_rgba(250,204,21,0.5)]" />
                <h2 className="text-xl sm:text-3xl font-extrabold text-white mb-2">Interview Complete! 🎉</h2>
                <p className="text-slate-400 text-sm max-w-sm">All {totalQ} answers evaluated. Redirecting to Leaderboard…</p>
              </>
            )}
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mt-5" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 bg-[#0a0a0a] border border-white/5 rounded-2xl sm:rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.05)_0%,transparent_70%)] pointer-events-none" />

            {/* Transition overlay */}
            {isTransitioning && <TransitionOverlay num={activeQuestionIndex + 2} total={totalQ} />}

            {!hasStarted ? (
              /* ══════════════════════════════════════════════════════
                 START SCREEN
                 Layout: flex column
                   - Top scrollable section (icon + title + desc)
                   - Bottom pinned button (ALWAYS VISIBLE)
                 ══════════════════════════════════════════════════════ */
              <div className="flex-1 min-h-0 flex flex-col z-10">

                {/* Scrollable content */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-8 pt-5 pb-2"
                     style={{ WebkitOverflowScrolling: 'touch' }}>

                  {/* Warning banner */}
                  {!warningDismissed && (
                    <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-300 text-xs font-semibold">Quiet Environment Required</p>
                        <p className="text-amber-400/70 text-[11px] mt-0.5 leading-relaxed">
                          Find a <strong className="text-amber-300">silent room</strong>. Background noise causes errors. Don't switch tabs — interview will be terminated.
                        </p>
                      </div>
                      <button onClick={() => setWarningDismissed(true)} className="text-amber-500/60 hover:text-amber-300 flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Icon */}
                  <div className="flex justify-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.15)] mb-4 sm:mb-5">
                      <Mic className="w-7 h-7 sm:w-9 sm:h-9 text-indigo-400" />
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-center text-lg sm:text-2xl font-bold text-white mb-2">
                    Start Voice Interview
                  </h2>

                  {/* Description */}
                  <p className="text-center text-slate-400 text-xs sm:text-sm leading-relaxed mb-2 max-w-sm mx-auto">
                    AI speaks each of <strong className="text-white">{totalQ} questions</strong> aloud. Answer in your own words — Hindi or English both work!
                  </p>
                  <p className="text-center text-slate-500 text-[11px] sm:text-xs leading-relaxed max-w-xs mx-auto">
                    <strong className="text-orange-300">{SILENCE_SECS}s silence</strong> = auto-submit. Or click <strong className="text-indigo-300">Submit</strong> to advance early.
                  </p>
                </div>

                {/* ── ALWAYS-VISIBLE PINNED BUTTON ── */}
                <div className="flex-shrink-0 px-4 sm:px-8 py-3 sm:py-4 bg-[#0a0a0a]/95 border-t border-white/[0.06]">
                  <button
                    id="begin-interview-btn"
                    onClick={() => setHasStarted(true)}
                    className="w-full flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm sm:text-base py-3.5 sm:py-4 rounded-xl sm:rounded-2xl transition-all shadow-[0_0_30px_rgba(79,70,229,0.4)]"
                  >
                    <PlayCircle className="w-5 h-5" />
                    <span>Begin Interview</span>
                  </button>
                </div>
              </div>

            ) : (
              /* ══════════════════════════════════════════════════════
                 ACTIVE INTERVIEW
                 Layout: flex column
                   - Status bar (shrink-0)
                   - Question (flex-1 scrollable)
                   - Transcript + buttons (shrink-0 fixed height)
                 ══════════════════════════════════════════════════════ */
              <div className="flex-1 min-h-0 flex flex-col z-10">

                {/* Status bar */}
                <div className="flex-shrink-0 flex items-center flex-wrap gap-1.5 px-3 sm:px-6 py-2 sm:py-3">
                  {isSpeaking && (
                    <div className="flex items-center gap-1.5 text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      <Volume2 className="w-3 h-3 animate-pulse" />
                      <span className="text-[10px] font-bold tracking-wider uppercase">AI Speaking</span>
                    </div>
                  )}
                  {isRecording && !isEvaluating && (
                    <div className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                      <WaveformBars />
                      <span className="text-[10px] font-bold tracking-wider uppercase">Listening</span>
                    </div>
                  )}
                  {isEvaluating && (
                    <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-[10px] font-bold tracking-wider uppercase">Evaluating…</span>
                    </div>
                  )}
                  {/* Silence countdown */}
                  {silenceCountdown != null && silenceCountdown > 0 && isRecording && transcript.trim() && (
                    <div className="ml-auto flex items-center gap-1.5 bg-orange-500/10 text-orange-300 px-2.5 py-1 rounded-full border border-orange-400/30">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Sub in</span>
                      <span className="text-base font-black tabular-nums">{silenceCountdown}s</span>
                    </div>
                  )}
                </div>

                {/* Question — scrollable */}
                <div className="flex-1 min-h-0 px-3 sm:px-6 pb-2 flex flex-col">
                  <div ref={questionScrollRef}
                       className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar"
                       style={{ WebkitOverflowScrolling: 'touch' }}>

                    {/* Section transition */}
                    {activeQuestionIndex > 0 &&
                      getSectionLabel(q) !== getSectionLabel(interview.questions[activeQuestionIndex - 1]) && (
                      <div className="mb-3 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center gap-2 text-violet-300">
                        <span>💬</span>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-violet-400">HR Round Starting</p>
                          <p className="text-[10px] text-violet-300/70">Technical done. Now HR & behavioral questions.</p>
                        </div>
                      </div>
                    )}

                    <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                      {getSectionLabel(q) === 'hr' ? '💬 HR ·' : '⚙️ Tech ·'} Q{activeQuestionIndex + 1}/{totalQ}
                    </p>

                    {/* Question with word highlight + slide-up animation */}
                    <div key={questionKey} className="slide-up-fade">
                      <h3 className="text-base sm:text-xl md:text-3xl font-semibold leading-snug">
                        {isSpeaking && spokenWordIndex >= 0 ? (
                          <>
                            <span className="text-white">{q.question.substring(0, spokenWordIndex)}</span>
                            <span className="text-white bg-indigo-500/40 px-0.5 rounded shadow-[0_0_10px_rgba(99,102,241,0.5)] inline-block">
                              {q.question.substring(spokenWordIndex).match(/^\S+/)?.[0] || ''}
                            </span>
                            <span className="text-white/40">{q.question.substring(spokenWordIndex).replace(/^\S+/, '')}</span>
                          </>
                        ) : (
                          <span className="text-white">{q.question}</span>
                        )}
                      </h3>
                      {q.focusArea && (
                        <span className={`inline-flex mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                          getSectionLabel(q) === 'hr'
                            ? 'text-violet-300 bg-violet-500/10 border-violet-500/20'
                            : 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20'
                        }`}>{q.focusArea}</span>
                      )}
                    </div>

                    {isSpeaking && (
                      <div className="flex items-center gap-1 text-slate-600 text-[10px] mt-3">
                        <ChevronDown className="w-3 h-3 animate-bounce" />
                        <span>Scroll for full question</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Transcript + action buttons ── */}
                <div className="flex-shrink-0 bg-white/[0.025] border-t border-white/[0.07] flex flex-col"
                     style={{ minHeight: '110px', maxHeight: '160px' }}>
                  {!transcript && !isSpeaking && !isEvaluating && (
                    <p className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs sm:text-sm pointer-events-none select-none text-center px-4" style={{ position: 'relative' }}>
                      🎤 Listening for your answer…
                    </p>
                  )}

                  {/* Transcript text */}
                  <div className="flex-1 overflow-y-auto px-3 sm:px-5 pt-2 pb-1 custom-scrollbar"
                       style={{ WebkitOverflowScrolling: 'touch' }}>
                    <p className="text-slate-200 text-sm leading-relaxed break-words">{transcript}</p>
                  </div>

                  {/* Action buttons — always at bottom, no clipping */}
                  {!isEvaluating && (
                    <div className="flex-shrink-0 flex items-center justify-end gap-2 px-3 pb-2.5 pt-1.5 bg-[#0a0a0a]/90 border-t border-white/[0.05]">
                      {!isRecording && (
                        <button
                          onClick={() => { navigator.vibrate?.(30); startListening(); }}
                          className="flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-2 rounded-xl font-bold border border-indigo-500/30 text-xs min-h-[36px] transition-all"
                        >
                          <Mic className="w-3.5 h-3.5" /><span>Mic</span>
                        </button>
                      )}
                      <button
                        onClick={() => { navigator.vibrate?.(20); skipQuestion(); }}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-xl font-bold border border-red-500/30 text-xs min-h-[36px] transition-all opacity-70 hover:opacity-100"
                      >
                        <span>Skip (0pts)</span>
                      </button>
                      {transcript.trim() && (
                        <button
                          onClick={() => { navigator.vibrate?.(40); autoSubmitAnswer(); }}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 sm:px-4 py-2 rounded-xl font-bold text-xs min-h-[36px] border border-indigo-400/40 shadow-[0_4px_14px_rgba(79,70,229,0.4)] transition-all hover:scale-105 active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /><span>Submit</span>
                        </button>
                      )}
                    </div>
                  )}

                  {isRecording && transcript && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-40 pointer-events-none" />
                  )}
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
