'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Loader2, CheckCircle2, Volume2, PlayCircle, Trophy, ChevronDown } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const SILENCE_SECS   = 5; // total silence before auto-submit
const COUNTDOWN_SHOW = 3; // how many final seconds to show the countdown badge

// Returns 'hr' or 'technical' for a question object
const getSectionLabel = (q) => ((q?.questionType || '').toLowerCase() === 'hr' ? 'hr' : 'technical');

export default function InterviewRoom({ params }) {
  const { id }   = use(params);
  const router   = useRouter();

  // ── State ────────────────────────────────────────────────────────────────
  const [interview,           setInterview]           = useState(null);
  const [loading,             setLoading]             = useState(true);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [hasStarted,          setHasStarted]          = useState(false);
  const [isSpeaking,          setIsSpeaking]          = useState(false);
  const [isRecording,         setIsRecording]         = useState(false);
  const [isEvaluating,        setIsEvaluating]        = useState(false);
  const [isFinished,          setIsFinished]          = useState(false);
  const [silenceCountdown,    setSilenceCountdown]    = useState(null);
  const [transcript,          setTranscript]          = useState('');
  const [spokenWordIndex,     setSpokenWordIndex]     = useState(-1);

  // ── Refs (for use inside closures / timers) ───────────────────────────────
  const transcriptRef          = useRef('');
  const recognitionRef         = useRef(null);
  const mainTimerRef           = useRef(null);
  const countdownDelayRef      = useRef(null);
  const countdownIntervalRef   = useRef(null);
  const isEvaluatingRef        = useRef(false);
  const activeIdxRef           = useRef(0);
  const interviewRef           = useRef(null);   // ← always holds latest interview
  const submitRef              = useRef(null);   // ← always holds latest autoSubmitAnswer fn
  const questionScrollRef      = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { activeIdxRef.current    = activeQuestionIndex; }, [activeQuestionIndex]);
  useEffect(() => { isEvaluatingRef.current = isEvaluating;        }, [isEvaluating]);
  useEffect(() => { interviewRef.current    = interview;           }, [interview]);

  // ── Fetch Interview ───────────────────────────────────────────────────────
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
        else              setIsFinished(true);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  // ── Init Speech Recognition ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-IN';

    rec.onstart  = () => setIsRecording(true);
    rec.onend    = () => setIsRecording(false);
    rec.onerror  = (e) => {
      if (e.error !== 'no-speech') console.error('SR:', e.error);
      setIsRecording(false);
    };
    rec.onresult = (ev) => {
      let t = '';
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      setTranscript(t);
      transcriptRef.current = t;
      // Restart the silence countdown every time speech is detected
      resetSilenceTimer();
    };

    recognitionRef.current = rec;

    return () => {
      killTimers();
      try { rec.stop(); } catch (_) {}
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-speak on question change ─────────────────────────────────────────
  useEffect(() => {
    if (hasStarted && interview && !isFinished) {
      if (!interview.answers[activeQuestionIndex]) {
        if (questionScrollRef.current) questionScrollRef.current.scrollTop = 0;
        const t = setTimeout(() => speakQuestion(interview.questions[activeQuestionIndex].question), 700);
        return () => clearTimeout(t);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestionIndex, hasStarted, isFinished, interview]);

  // ── Timer helpers ─────────────────────────────────────────────────────────
  const killTimers = useCallback(() => {
    clearTimeout(mainTimerRef.current);
    clearTimeout(countdownDelayRef.current);
    clearInterval(countdownIntervalRef.current);
    mainTimerRef.current         = null;
    countdownDelayRef.current    = null;
    countdownIntervalRef.current = null;
    setSilenceCountdown(null);
  }, []);

  const resetSilenceTimer = useCallback(() => {
    killTimers();

    // Main auto-submit timer
    mainTimerRef.current = setTimeout(() => {
      if (transcriptRef.current.trim() && !isEvaluatingRef.current) {
        // Always call through the ref so we get the fresh closure
        submitRef.current?.();
      } else {
        resetSilenceTimer(); // Nothing said yet — keep waiting
      }
    }, SILENCE_SECS * 1000);

    // Countdown display starts (SILENCE_SECS - COUNTDOWN_SHOW) seconds in
    countdownDelayRef.current = setTimeout(() => {
      if (isEvaluatingRef.current) return;
      let rem = COUNTDOWN_SHOW;
      setSilenceCountdown(rem);
      countdownIntervalRef.current = setInterval(() => {
        rem -= 1;
        setSilenceCountdown(rem);
        if (rem <= 0) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 1000);
    }, (SILENCE_SECS - COUNTDOWN_SHOW) * 1000);
  }, [killTimers]);

  // ── TTS – pick the most natural Indian voice available ────────────────────
  const getBestVoice = () => {
    const voices = window.speechSynthesis.getVoices();

    // Name-based priority list (Windows/Chrome voices most likely to be present)
    const namePriority = [
      'microsoft ravi', 'google hindi',
      'microsoft heera', 'heera',
      'google us english', 'google uk english female',
      'google uk english male',
      'veena', 'sundar', 'lekha',
    ];
    for (const needle of namePriority) {
      const v = voices.find(v => v.name.toLowerCase().includes(needle));
      if (v) return v;
    }

    // Lang-based fallback
    const langPriority = [/en.?in/i, /hi.?in/i, /en.?gb/i, /en.?au/i, /en.?us/i];
    for (const p of langPriority) {
      const v = voices.find(v => p.test(v.lang));
      if (v) return v;
    }

    return voices[0] || null;
  };

  const speakQuestion = useCallback((text) => {
    if (!('speechSynthesis' in window)) { startListening(); return; }
    window.speechSynthesis.cancel();

    const go = () => {
      const utt   = new SpeechSynthesisUtterance(text);
      const voice = getBestVoice();
      if (voice) { utt.voice = voice; utt.lang = voice.lang; }
      else         { utt.lang = 'en-IN'; }
      utt.rate  = 0.88;   // A little slower = feels more conversational
      utt.pitch = 1.1;    // Slightly warmer / higher pitch
      utt.volume = 1;

      utt.onboundary = (e) => {
        if (e.name === 'word') setSpokenWordIndex(e.charIndex);
      };

      utt.onstart = () => { setIsSpeaking(true); setSpokenWordIndex(0); };
      utt.onend   = () => { setIsSpeaking(false); setSpokenWordIndex(-1); startListening(); };
      utt.onerror = () => { setIsSpeaking(false); setSpokenWordIndex(-1); startListening(); };
      window.speechSynthesis.speak(utt);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { go(); }
    else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        go();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start listening after AI finishes speaking ────────────────────────────
  const startListening = useCallback(() => {
    setTranscript('');
    transcriptRef.current = '';
    try { recognitionRef.current?.start(); } catch (_) {}
    setIsRecording(true);
    resetSilenceTimer();
  }, [resetSilenceTimer]);

  // ── Submit + evaluate answer ──────────────────────────────────────────────
  // Defined as a regular (non-memoised) inner function because it needs fresh
  // closure variables.  We store the latest copy in `submitRef` so timers can
  // always call the current version without stale-closure issues.
  const autoSubmitAnswer = useCallback(async () => {
    killTimers();
    const finalTranscript  = transcriptRef.current;
    const currentInterview = interviewRef.current;       // ← read from ref!
    const idx              = activeIdxRef.current;       // ← read from ref!

    if (!finalTranscript.trim() || !currentInterview || isEvaluatingRef.current) return;

    setIsEvaluating(true);
    setIsRecording(false);
    try { recognitionRef.current?.stop(); } catch (_) {}

    try {
      const currentQ = currentInterview.questions[idx];

      const res  = await fetch('/api/evaluate-answer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          question:      currentQ.question,
          idealConcepts: currentQ.idealAnswerConcepts,
          userAnswer:    finalTranscript,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Build updated answers array
      const updatedAnswers = [...currentInterview.answers];
      updatedAnswers[idx]  = { transcript: finalTranscript, evaluation: data.evaluation };

      await updateDoc(doc(db, 'interviews', id), { answers: updatedAnswers });

      // Update React state (and therefore the ref via the useEffect above)
      setInterview(prev => ({ ...prev, answers: updatedAnswers }));
      setTranscript('');
      transcriptRef.current = '';

      const totalQuestions = currentInterview.questions.length;

      if (idx < totalQuestions - 1) {
        // ── More questions remain – advance ──
        setActiveQuestionIndex(idx + 1);
      } else {
        // ── All questions answered – finish ──
        setIsFinished(true);
        setTimeout(() => router.push('/dashboard/leaderboard'), 6000);
      }
    } catch (err) {
      console.error('Evaluation error:', err);
      setIsEvaluating(false);
      startListening();   // Let user try again
    } finally {
      setIsEvaluating(false);
    }
  }, [id, killTimers, startListening, router]);

  // ── Skip Question ────────────────────────────────────────────────────────
  const skipQuestion = useCallback(async () => {
    killTimers();
    const currentInterview = interviewRef.current;
    const idx              = activeIdxRef.current;

    if (!currentInterview || isEvaluatingRef.current) return;

    setIsEvaluating(true);
    setIsRecording(false);
    try { recognitionRef.current?.stop(); } catch (_) {}

    try {
      const updatedAnswers = [...currentInterview.answers];
      updatedAnswers[idx]  = { 
        transcript: "User skipped the question.", 
        evaluation: { score: 0, feedback: "Question was skipped intentionally.", improvement: "Attempt the question next time to improve your score." } 
      };

      await updateDoc(doc(db, 'interviews', id), { answers: updatedAnswers });

      setInterview(prev => ({ ...prev, answers: updatedAnswers }));
      setTranscript('');
      transcriptRef.current = '';

      const totalQuestions = currentInterview.questions.length;

      if (idx < totalQuestions - 1) {
        setActiveQuestionIndex(idx + 1);
      } else {
        setIsFinished(true);
        setTimeout(() => router.push('/dashboard/leaderboard'), 6000);
      }
    } catch (err) {
      console.error('Skip error:', err);
      setIsEvaluating(false);
      startListening();
    } finally {
      setIsEvaluating(false);
    }
  }, [id, killTimers, startListening, router]);

  // Keep submitRef pointing to the LATEST version of autoSubmitAnswer
  useEffect(() => {
    submitRef.current = autoSubmitAnswer;
  }, [autoSubmitAnswer]);

  // ── Loading / null guards ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }
  if (!interview) return null;

  const currentQuestion = interview.questions[activeQuestionIndex];
  const totalQ          = interview.questions.length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="max-w-5xl mx-auto flex flex-col animate-in fade-in zoom-in-95 duration-500"
      style={{ height: 'calc(100vh - 9rem)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            AI Interview
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
            <span className="text-indigo-300">{interview.jobRole}</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">🎙 Microphone enabled · 🔊 Speakers on · Speak clearly</p>
        </div>
        {!isFinished && (
          <div className="flex items-center space-x-3">
            {/* Section label */}
            {hasStarted && (
              <span className={`hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                getSectionLabel(currentQuestion) === 'hr'
                  ? 'text-violet-300 bg-violet-500/10 border-violet-500/30'
                  : 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30'
              }`}>
                {getSectionLabel(currentQuestion) === 'hr' ? '💬 HR Round' : '⚙️ Technical Round'}
              </span>
            )}
            <span className="text-slate-500 text-sm font-mono">{activeQuestionIndex + 1}/{totalQ}</span>
            <div className="flex space-x-1.5">
              {interview.questions.map((q, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    idx < activeQuestionIndex
                      ? 'w-8 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : idx === activeQuestionIndex
                        ? `w-8 animate-pulse ${
                            getSectionLabel(q) === 'hr'
                              ? 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]'
                              : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                          }`
                        : getSectionLabel(q) === 'hr'
                          ? 'w-4 bg-violet-500/20'
                          : 'w-5 bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Finished */}
      {isFinished ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-12 text-center flex-1 flex flex-col items-center justify-center">
          <Trophy className="w-20 h-20 text-yellow-400 mb-6 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]" />
          <h2 className="text-4xl font-extrabold text-white mb-4">Interview Complete! 🎉</h2>
          <p className="text-slate-400 text-lg mb-8 max-w-md">
            All {totalQ} answers have been evaluated. Redirecting to the Global Leaderboard…
          </p>
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : (
        /* Main interview card */
        <div className="flex-1 bg-[#0a0a0a] border border-white/5 rounded-3xl shadow-2xl relative flex flex-col overflow-hidden min-h-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.06)_0%,transparent_70%)] pointer-events-none" />

          {!hasStarted ? (
            /* Start screen */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center z-10">
              <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mb-8 border border-indigo-500/20 shadow-[0_0_40px_rgba(99,102,241,0.15)]">
                <Mic className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Start Voice Interview</h2>
              <p className="text-slate-400 text-base max-w-lg mb-3 leading-relaxed">
                The AI will <strong className="text-white">speak each of the {totalQ} questions aloud</strong>. Answer naturally in your own words.
              </p>
              <p className="text-slate-500 text-xs sm:text-sm max-w-sm mb-10 leading-relaxed px-4">
                After <strong className="text-orange-300">{SILENCE_SECS} seconds of silence</strong>, your answer auto-submits and AI moves to the next question.
                You can also click <strong className="text-indigo-300">Submit Answer</strong> anytime to jump ahead.
              </p>
              <button
                onClick={() => setHasStarted(true)}
                className="bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 text-white px-10 py-5 rounded-2xl font-bold text-lg transition-all shadow-[0_0_40px_rgba(79,70,229,0.4)] flex items-center space-x-3"
              >
                <PlayCircle className="w-6 h-6" />
                <span>Begin Interview</span>
              </button>
            </div>
          ) : (
            /* Active interview */
            <div className="flex-1 flex flex-col z-10 min-h-0">

              {/* Status bar */}
              <div className="flex items-center flex-wrap gap-2 px-8 pt-5 pb-3 flex-shrink-0">
                {isSpeaking && (
                  <div className="flex items-center space-x-2 text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                    <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                    <span className="text-[11px] font-bold tracking-widest uppercase">AI Speaking</span>
                  </div>
                )}
                {isRecording && !isEvaluating && (
                  <div className="flex items-center space-x-2 text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-[11px] font-bold tracking-widest uppercase">Listening</span>
                  </div>
                )}
                {isEvaluating && (
                  <div className="flex items-center space-x-2 text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-[11px] font-bold tracking-widest uppercase">Evaluating…</span>
                  </div>
                )}

                {/* Silence countdown */}
                {silenceCountdown !== null && silenceCountdown > 0
                  && isRecording && transcript.trim() && (
                  <div className="ml-auto flex items-center space-x-2 bg-orange-500/10 text-orange-300 px-3 py-1.5 rounded-full border border-orange-400/30 animate-in fade-in slide-in-from-right-3 duration-300">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400/80">Auto-submit in</span>
                    <span className="text-xl font-black tabular-nums leading-none">{silenceCountdown}s</span>
                  </div>
                )}
              </div>

              {/* Question – scrollable */}
              <div className="flex-1 min-h-0 px-5 sm:px-8 md:px-14 pt-2 pb-4 flex flex-col">
                <div
                  ref={questionScrollRef}
                  className="flex-1 overflow-y-auto overscroll-contain scroll-smooth custom-scrollbar pr-1 md:pr-3"
                >
                  {/* Section transition banner */}
                  {activeQuestionIndex > 0 &&
                    getSectionLabel(currentQuestion) !== getSectionLabel(interview.questions[activeQuestionIndex - 1]) && (
                    <div className="mb-4 px-4 py-3 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center space-x-2 text-violet-300">
                      <span className="text-lg">💬</span>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-violet-400">HR Round Starting</p>
                        <p className="text-xs text-violet-300/70">Technical questions complete. Now answering HR & behavioral questions.</p>
                      </div>
                    </div>
                  )}

                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">
                    {getSectionLabel(currentQuestion) === 'hr' ? '💬 HR Round ·' : '⚙️ Technical ·'} Question {activeQuestionIndex + 1} of {totalQ}
                  </p>
                  <h3 className="text-xl sm:text-2xl md:text-4xl font-semibold leading-snug">
                    {isSpeaking && spokenWordIndex >= 0 ? (
                      <>
                        <span className="text-white">
                          {currentQuestion.question.substring(0, spokenWordIndex)}
                        </span>
                        <span className="text-white bg-indigo-500/40 px-1 rounded transition-colors duration-100 shadow-[0_0_15px_rgba(99,102,241,0.6)] mix-blend-lighten inline-block">
                          {currentQuestion.question.substring(spokenWordIndex).match(/^\S+/)?.[0] || ''}
                        </span>
                        <span className="text-white/40">
                          {currentQuestion.question.substring(spokenWordIndex).replace(/^\S+/, '')}
                        </span>
                      </>
                    ) : (
                      <span className="text-white">{currentQuestion.question}</span>
                    )}
                  </h3>
                  {currentQuestion.focusArea && (
                    <span className={`inline-flex mt-4 text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${
                      getSectionLabel(currentQuestion) === 'hr'
                        ? 'text-violet-300 bg-violet-500/10 border-violet-500/20'
                        : 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20'
                    }`}>
                      {currentQuestion.focusArea}
                    </span>
                  )}
                  {isSpeaking && (
                    <div className="flex items-center space-x-1 text-slate-600 text-xs mt-5">
                      <ChevronDown className="w-3 h-3 animate-bounce" />
                      <span>Scroll to read the full question</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Answer transcript – fixed height, scrollable */}
              <div
                className="relative flex-shrink-0 bg-white/[0.025] border-t border-white/[0.07] flex flex-col"
                style={{ minHeight: '140px', maxHeight: '190px' }}
              >
                {!transcript && !isSpeaking && !isEvaluating && (
                  <p className="text-slate-600 text-sm sm:text-base absolute inset-0 flex items-center justify-center select-none pointer-events-none text-center px-4">
                    🎤 Listening for your answer…
                  </p>
                )}

                <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-4 sm:pr-44 pb-3 sm:pb-4 custom-scrollbar">
                  <p className="text-slate-200 text-base sm:text-lg leading-relaxed">{transcript}</p>
                </div>

                {/* Manual action buttons */}
                {!isEvaluating && (
                  <div className="sm:absolute bottom-3 sm:bottom-4 right-3 sm:right-5 z-20 animate-in fade-in flex flex-wrap items-center justify-end px-3 sm:px-0 pb-3 sm:pb-0 gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0 bg-[#0a0a0a]/80 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none border-t border-white/5 sm:border-0 pt-3 sm:pt-0">
                    {!isRecording && (
                      <button
                        onClick={startListening}
                        className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 border border-indigo-500/30 text-xs sm:text-sm"
                      >
                        <Mic className="w-4 h-4" />
                        <span className="hidden sm:inline">Resume Mic</span>
                      </button>
                    )}
                    <button
                      onClick={skipQuestion}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-all flex flex-1 sm:flex-none items-center justify-center space-x-2 border border-red-500/30 text-xs sm:text-sm opacity-80 sm:opacity-60 hover:opacity-100"
                    >
                      <span>Skip (0 pts)</span>
                    </button>
                    {transcript.trim() && (
                      <button
                        onClick={autoSubmitAnswer}
                        className="bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 text-white flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold transition-all shadow-[0_4px_20px_rgba(79,70,229,0.5)] flex items-center justify-center space-x-2 border border-indigo-400/40 text-xs sm:text-sm"
                      >
                        <CheckCircle2 className="w-4 h-4 hidden sm:block" />
                        <span>Submit Answer</span>
                      </button>
                    )}
                  </div>
                )}

                {isRecording && transcript && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-40" />
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
