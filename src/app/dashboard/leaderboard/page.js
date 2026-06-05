'use client';

import { Suspense } from 'react';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import {
  Trophy, Medal, Star, Clock, Briefcase, Loader2,
  ChevronDown, ChevronUp, CheckCircle2, User, Building2,
  Code2, MessageSquare, BarChart3
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

// score color per experience level
const LEVEL_COLORS = {
  'Internship':         { bg: 'bg-green-500/10',  border: 'border-green-500/20',  text: 'text-green-400'  },
  'Junior / Entry-Level':{ bg: 'bg-blue-500/10',  border: 'border-blue-500/20',   text: 'text-blue-400'   },
  'Mid-Level':          { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400' },
  'Senior':             { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400' },
  'Lead / Manager':     { bg: 'bg-red-500/10',    border: 'border-red-500/20',    text: 'text-red-400'    },
};

const getLevelStyle = (level) => LEVEL_COLORS[level] || LEVEL_COLORS['Mid-Level'];

// break down scores by question type
const calcScores = (questions = [], answers = []) => {
  let techTotal = 0, techCount = 0;
  let hrTotal   = 0, hrCount   = 0;

  questions.forEach((q, i) => {
    const ans   = answers[i];
    const score = ans?.evaluation?.score;
    if (score == null) return;
    const type = (q.questionType || 'technical').toLowerCase();
    if (type === 'hr') {
      hrTotal  += score; hrCount++;
    } else {
      techTotal += score; techCount++;
    }
  });

  return {
    techScore: techCount  > 0 ? Number((techTotal / techCount).toFixed(1))  : null,
    hrScore:   hrCount    > 0 ? Number((hrTotal   / hrCount).toFixed(1))    : null,
    overall:   (techCount + hrCount) > 0
      ? Number(((techTotal + hrTotal) / (techCount + hrCount)).toFixed(1))
      : null,
    techCount,
    hrCount,
  };
};

function LeaderboardContent() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [expandedId,  setExpandedId]  = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [filterLevel, setFilterLevel] = useState('All');
  const searchParams  = useSearchParams();
  const expandRef     = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const snap = await getDocs(query(collection(db, 'interviews'), orderBy('createdAt', 'desc')));

        let valid = [];
        const uids = new Set();

        snap.forEach(docSnap => {
          const data = docSnap.data();
          if (!data.answers || !data.questions) return;

          // Only completed interviews (all questions answered)
          const answered = data.answers.filter(a => a?.evaluation?.score != null).length;
          if (answered < data.questions.length) return;

          const { techScore, hrScore, overall, techCount, hrCount } = calcScores(data.questions, data.answers);
          if (overall === null) return;

          valid.push({ id: docSnap.id, ...data, techScore, hrScore, overall, techCount, hrCount });
          if (data.userId) uids.add(data.userId);
        });

        // Resolve user profiles
        const userMap = {};
        await Promise.all(Array.from(uids).map(async uid => {
          try {
            const uDoc = await getDoc(doc(db, 'users', uid));
            if (uDoc.exists()) userMap[uid] = uDoc.data();
          } catch (_) {}
        }));

        valid = valid.map(inv => ({ ...inv, userProfile: userMap[inv.userId] || null }));
        valid.sort((a, b) => b.overall - a.overall);
        setLeaderboard(valid);
      } catch (err) {
        console.error('Leaderboard error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  // Auto-expand the entry passed via ?expand=id and scroll to it
  useEffect(() => {
    const id = searchParams.get('expand');
    if (!id || loading) return;
    setExpandedId(id);
    // Wait a tick for the DOM to render the expanded row, then scroll
    setTimeout(() => {
      if (expandRef.current) {
        expandRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 350);
  }, [searchParams, loading]);

  const levels = ['All', 'Internship', 'Junior / Entry-Level', 'Mid-Level', 'Senior', 'Lead / Manager'];
  const filtered = filterLevel === 'All'
    ? leaderboard
    : leaderboard.filter(e => e.experienceLevel === filterLevel);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header */}
      <div className="text-center relative py-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/8 rounded-full blur-[100px] pointer-events-none -z-10" />
        <Trophy className="w-16 h-16 text-indigo-400 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(99,102,241,0.25)]" />
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
          Global <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Hall of Fame</span>
        </h1>
        <p className="text-slate-400 text-base max-w-2xl mx-auto">
          Scores are broken down by <span className="text-cyan-400 font-semibold">Technical</span> and{' '}
          <span className="text-violet-400 font-semibold">HR</span> rounds, ranked by overall performance.
        </p>
      </div>

      {/* Level filter */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {levels.map(l => (
          <button
            key={l}
            onClick={() => setFilterLevel(l)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
              filterLevel === l
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 md:p-10 backdrop-blur-xl">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No completed interviews yet. Be the first to secure a spot!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((entry, idx) => {
              const isOwner    = currentUser?.uid === entry.userId;
              const isExpanded = expandedId === entry.id;
              const levelStyle = getLevelStyle(entry.experienceLevel);

              // Rank medal
              let rankStyle  = 'bg-[#0a0a0a] border-white/5';
              let medalIcon  = <span className="text-lg font-bold w-6 text-center text-slate-500">{idx + 1}</span>;
              if (idx === 0) {
                rankStyle = 'bg-gradient-to-r from-indigo-500/12 to-transparent border-indigo-500/25 shadow-[0_0_24px_rgba(99,102,241,0.06)]';
                medalIcon = <Medal className="w-8 h-8 text-indigo-400" />;
              } else if (idx === 1) {
                rankStyle = 'bg-gradient-to-r from-slate-300/8 to-transparent border-slate-300/20';
                medalIcon = <Medal className="w-7 h-7 text-slate-300" />;
              } else if (idx === 2) {
                rankStyle = 'bg-gradient-to-r from-violet-500/10 to-transparent border-violet-500/20';
                medalIcon = <Medal className="w-6 h-6 text-violet-400" />;
              }

              // Attach ref to the auto-expand target row
              const isAutoExpand = searchParams.get('expand') === entry.id;
              return (
                <div key={entry.id} className="flex flex-col space-y-2" ref={isAutoExpand ? expandRef : null}>
                  <div className={`relative flex flex-col sm:flex-row sm:items-center p-4 sm:p-5 rounded-2xl border transition-all duration-300 sm:hover:scale-[1.005] ${rankStyle}`}>

                    {/* Rank */}
                    <div className="hidden sm:flex items-center justify-center w-12 flex-shrink-0 mr-4">
                      {medalIcon}
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0 mb-4 sm:mb-0">
                      <div className="flex items-center justify-between sm:justify-start">
                        <div className="flex items-center space-x-2 mb-1.5">
                          <div className="sm:hidden flex items-center justify-center w-8 mr-1">
                            {medalIcon}
                          </div>
                        {entry.userProfile?.photoURL ? (
                          <img src={entry.userProfile.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-white/20 object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <h3 className="text-lg font-bold text-white truncate">
                          {entry.userProfile?.displayName || 'Anonymous'}
                        </h3>
                        {isOwner && (
                          <span className="text-[10px] uppercase font-black tracking-wider bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">
                            You
                          </span>
                        )}
                        </div>
                      </div>

                      {/* Tags row */}
                      <div className="flex flex-wrap gap-2 items-center">
                        {/* Job role */}
                        <span className="flex items-center text-slate-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10 text-xs">
                          <Briefcase className="w-3 h-3 mr-1 text-slate-500" />
                          {entry.jobRole}
                        </span>

                        {/* Difficulty level */}
                        <span className={`flex items-center px-2 py-0.5 rounded-md border text-xs font-bold ${levelStyle.bg} ${levelStyle.border} ${levelStyle.text}`}>
                          {entry.experienceLevel || 'Mid-Level'}
                        </span>

                        {/* Technical score pill */}
                        {entry.techScore !== null && (
                          <span className="flex items-center space-x-1 text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 text-xs font-bold">
                            <Code2 className="w-3 h-3" />
                            <span>Tech {entry.techScore}/10</span>
                          </span>
                        )}

                        {/* HR score pill */}
                        {entry.hrScore !== null && (
                          <span className="flex items-center space-x-1 text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20 text-xs font-bold">
                            <MessageSquare className="w-3 h-3" />
                            <span>HR {entry.hrScore}/10</span>
                          </span>
                        )}

                        {entry.userProfile?.institute && (
                          <span className="flex items-center text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-xs">
                            <Building2 className="w-3 h-3 mr-1" />
                            {entry.userProfile.institute}
                          </span>
                        )}

                        <span className="flex items-center text-slate-600 text-xs ml-auto">
                          <Clock className="w-3 h-3 mr-1" />
                          {entry.createdAt ? new Date(entry.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
                        </span>
                      </div>
                    </div>

                    {/* Overall score */}
                    <div className="flex items-center sm:ml-4 space-x-4 sm:flex-shrink-0 justify-between sm:justify-end border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0">
                      <div className="flex flex-col items-start sm:items-end sm:text-right">
                        <div className="flex items-center space-x-1">
                          <Star className="w-5 h-5 text-indigo-400 fill-indigo-400" />
                          <span className="text-3xl font-black tracking-tighter text-white">
                            {entry.overall?.toFixed(1)}
                          </span>
                          <span className="text-slate-500 font-bold self-end mb-0.5 text-sm">/10</span>
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Overall</p>
                      </div>

                      {isOwner && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="p-2.5 hover:bg-white/10 rounded-xl transition-colors border border-transparent hover:border-white/10"
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded view — only for the owner */}
                  {isExpanded && isOwner && (
                    <div className="bg-[#0f0f18] border border-white/8 rounded-2xl p-6 md:p-8 ml-0 md:ml-14 mt-1 shadow-inner">
                      {/* Score summary */}
                      <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-white/8">
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <BarChart3 className="w-4 h-4 text-indigo-400" />
                            <span className="text-2xl font-black text-white">{entry.overall?.toFixed(1)}</span>
                            <span className="text-slate-500 text-sm">/10</span>
                          </div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Overall</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <Code2 className="w-4 h-4 text-cyan-400" />
                            <span className="text-2xl font-black text-cyan-300">{entry.techScore ?? '—'}</span>
                            {entry.techScore !== null && <span className="text-slate-500 text-sm">/10</span>}
                          </div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Technical ({entry.techCount}Q)</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-1 mb-1">
                            <MessageSquare className="w-4 h-4 text-violet-400" />
                            <span className="text-2xl font-black text-violet-300">{entry.hrScore ?? '—'}</span>
                            {entry.hrScore !== null && <span className="text-slate-500 text-sm">/10</span>}
                          </div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">HR ({entry.hrCount}Q)</p>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Detailed Breakdown</h4>
                      <div className="space-y-6">
                        {entry.questions.map((q, qIdx) => {
                          const ans      = entry.answers[qIdx];
                          const isHR     = (q.questionType || '').toLowerCase() === 'hr';
                          const scoreVal = ans?.evaluation?.score;

                          return (
                            <div key={qIdx} className="space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                      isHR
                                        ? 'text-violet-400 bg-violet-500/10 border-violet-500/20'
                                        : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                                    }`}>
                                      {isHR ? '💬 HR' : '⚙️ Technical'}
                                    </span>
                                    {q.focusArea && (
                                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{q.focusArea}</span>
                                    )}
                                  </div>
                                  <p className="text-slate-200 font-medium leading-relaxed">
                                    <span className="text-indigo-400 font-bold mr-2">Q{qIdx + 1}:</span>
                                    {q.question}
                                  </p>
                                </div>
                                <span className={`flex-shrink-0 font-black text-lg px-3 py-1 rounded-lg border ${
                                  scoreVal >= 8
                                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                    : scoreVal >= 5
                                      ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20'
                                      : 'text-red-400 bg-red-500/10 border-red-500/20'
                                }`}>
                                  {scoreVal ?? '?'}/10
                                </span>
                              </div>

                              {ans && (
                                <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-3">
                                  <p className="text-slate-400 text-sm italic">
                                    &ldquo;{ans.transcript}&rdquo;
                                  </p>
                                  <div className="flex items-start space-x-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-emerald-200 text-sm">{ans.evaluation?.feedback}</p>
                                  </div>
                                  {ans.evaluation?.improvement && (
                                    <div className="bg-indigo-500/6 p-3 rounded-lg border border-indigo-500/12">
                                      <p className="text-slate-300 text-sm">
                                        <strong className="text-indigo-400 block mb-0.5">💡 To Improve:</strong>
                                        {ans.evaluation.improvement}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-center text-slate-700 text-xs pb-4">
        Made by <span className="text-slate-500 font-semibold">Chirag Kashyap</span> · Mockly AI
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
}
