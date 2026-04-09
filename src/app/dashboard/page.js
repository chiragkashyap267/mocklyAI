'use client';

import { useState, useEffect } from 'react';
import { FileUp, TrendingUp, Trophy, User, Building2, Medal, Users, PlayCircle, Star, ChevronRight, Zap, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const calcScores = (questions = [], answers = []) => {
  let total = 0, count = 0;
  questions.forEach((q, i) => {
    const score = answers[i]?.evaluation?.score;
    if (score != null) { total += score; count++; }
  });
  return count > 0 ? Number((total / count).toFixed(1)) : null;
};

export default function DashboardPage() {
  const [stats, setStats] = useState({
    interviews: 0,
    resumes: 0,
    averageScore: 0,
    rank: null,
    totalStudents: 0,
    profile: null,
    topCandidates: [],
    totalColleges: 0,
    latestInterviewId: null,
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const profile = userDoc.exists() ? userDoc.data() : null;

          const snap = await getDocs(query(collection(db, 'interviews'), orderBy('createdAt', 'desc')));
          let validInterviews = [];
          const uniqueUsers = new Set();

          let myInterviewsCount = 0;
          let mySum = 0;
          let myCompleted = 0;
          let myLatestInterviewId = null;

          snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.userId) uniqueUsers.add(data.userId);
            // Since query is ordered desc, first match = most recent
            if (data.userId === user.uid && myLatestInterviewId === null) {
              myLatestInterviewId = docSnap.id;
            }
            if (data.userId === user.uid) myInterviewsCount++;

            if (!data.answers || !data.questions) return;

            const answered = data.answers.filter(a => a?.evaluation?.score != null).length;
            if (answered < data.questions.length) return;

            const overall = calcScores(data.questions, data.answers);
            if (overall === null) return;

            if (data.userId === user.uid) {
              mySum += overall;
              myCompleted++;
            }

            validInterviews.push({ id: docSnap.id, userId: data.userId, overall });
          });

          validInterviews.sort((a, b) => b.overall - a.overall);

          const myBestIndex = validInterviews.findIndex(v => v.userId === user.uid);
          const myRank = myBestIndex !== -1 ? myBestIndex + 1 : null;

          const usersSnap = await getDocs(collection(db, 'users'));
          const uniqueColleges = new Set();
          const userMap = {};

          usersSnap.forEach(uDoc => {
            const data = uDoc.data();
            userMap[uDoc.id] = data;
            if (data.institute) {
              const nameLower = data.institute.trim().toLowerCase();
              if (nameLower) uniqueColleges.add(nameLower);
            }
          });

          const top5Valid = validInterviews.slice(0, 5);
          const topCandidatesData = top5Valid.map((v, i) => {
            const p = userMap[v.userId];
            return {
              ...v,
              rank: i + 1,
              name: p?.displayName || 'Anonymous',
              institute: p?.institute || '',
            };
          });

          const resumesSnap = await getDocs(query(collection(db, 'resumes'), where('userId', '==', user.uid)));

          const finalAverage = myCompleted > 0 ? ((mySum / myCompleted) * 10).toFixed(0) : 0;

          setStats({
            interviews: myInterviewsCount,
            resumes: resumesSnap.size,
            averageScore: finalAverage,
            rank: myRank,
            totalStudents: uniqueUsers.size,
            profile,
            topCandidates: topCandidatesData,
            totalColleges: uniqueColleges.size || 0,
            latestInterviewId: myLatestInterviewId,
          });

        } catch (error) {
          console.error('Error fetching stats:', error);
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">

      {/* ── Injected Styles ────────────────────────────────────── */}
      <style>{`
        /* Seamless marquee: container scrolls exactly half its own width */
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        /* Mobile: very slow speed */
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker-scroll 400s linear infinite;
          will-change: transform;
        }
        /* Desktop: extremely slow and readable */
        @media (min-width: 768px) {
          .ticker-track {
            animation-duration: 600s;
          }
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
        /* Orange pulse glow keyframe */
        @keyframes orange-pulse {
          0%, 100% { box-shadow: 0 0 18px 2px rgba(251,146,60,0.35), 0 0 40px 0 rgba(251,146,60,0.15); }
          50%       { box-shadow: 0 0 30px 6px rgba(251,146,60,0.55), 0 0 60px 4px rgba(251,146,60,0.25); }
        }
        .btn-orange-glow {
          animation: orange-pulse 2.4s ease-in-out infinite;
        }
        /* Evaluation CTA shimmer */
        @keyframes shimmer-slide {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .eval-shimmer {
          background: linear-gradient(
            90deg,
            rgba(251,146,60,0) 0%,
            rgba(251,146,60,0.4) 40%,
            rgba(251,146,60,0.4) 60%,
            rgba(251,146,60,0) 100%
          );
          background-size: 200% 100%;
          animation: shimmer-slide 2s linear infinite;
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-3deg); }
          50%       { transform: rotate(3deg); }
        }
        .wiggle-icon { animation: wiggle 1.2s ease-in-out infinite; }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* ── Welcome Banner ──────────────────────────────────────── */}
      <div className="bg-[#0f0f18] border border-white/5 rounded-2xl sm:rounded-3xl p-5 sm:p-8 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-indigo-500/20 via-purple-500/5 to-transparent rounded-full blur-[80px] pointer-events-none -mt-40 -mr-40" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          {/* Left: greeting */}
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/5 rounded-full border border-white/10 flex-shrink-0">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight break-words leading-tight">
                  Hi, {stats.profile?.displayName || 'Candidate'} 👋
                </h1>
                {stats.profile?.institute && (
                  <p className="text-emerald-400 flex items-center font-medium mt-1 text-sm">
                    <Building2 className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    <span className="break-words">{stats.profile.institute}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: rank + buttons */}
          <div className="flex flex-col gap-4">
            {/* Rank + Competitors */}
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Global Rank</p>
                <div className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 px-4 py-2 rounded-xl">
                  <Medal className="w-5 h-5 text-amber-400" />
                  <span className="text-xl sm:text-2xl font-black text-amber-500">
                    {stats.rank ? `#${stats.rank}` : '---'}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Competitors</p>
                <div className="flex items-center justify-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-xl font-bold text-white">{stats.totalStudents}</span>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Start Interview – Orange glow */}
              <a href="#interview-start-section" className="flex-1 sm:flex-none">
                <button
                  id="btn-start-interview"
                  className="btn-orange-glow w-full group relative flex items-center justify-center gap-2 px-5 sm:px-6 py-3 rounded-xl font-extrabold text-white transition-all hover:scale-105 active:scale-95 border border-orange-400/50 text-sm sm:text-base"
                  style={{
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  }}
                >
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                  START INTERVIEW NOW
                </button>
              </a>

              {/* Check Rank – Orange subtle glow */}
              <Link href="/dashboard/leaderboard" className="flex-1 sm:flex-none">
                <button
                  id="btn-check-rank"
                  className="w-full group relative flex items-center justify-center gap-2 px-5 sm:px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105 active:scale-95 border border-orange-500/30 text-sm sm:text-base"
                  style={{
                    background: 'linear-gradient(135deg, rgba(251,146,60,0.18) 0%, rgba(234,88,12,0.10) 100%)',
                    boxShadow: '0 0 18px 0 rgba(251,146,60,0.20)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 28px 4px rgba(251,146,60,0.40)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 18px 0 rgba(251,146,60,0.20)'}
                >
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 group-hover:-rotate-12 transition-transform" />
                  <span className="text-orange-100">CHECK YOUR RANK</span>
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Motivational callout */}
        <div className="mt-6 pt-5 border-t border-white/5">
          <p className="text-slate-300 text-sm sm:text-base">
            <strong className="text-indigo-400 font-bold">{stats.totalStudents} students</strong> from{' '}
            <strong className="text-emerald-400 font-bold">{stats.totalColleges} colleges</strong> are currently registered on Mockly AI.{' '}
            {stats.rank
              ? `You're ranked #${stats.rank} globally — keep going! 🚀`
              : 'Complete an interview to secure your spot on the Global Leaderboard!'}
          </p>
        </div>
      </div>

      {/* ── Live Ticker Strip ───────────────────────────────────── */}
      {stats.topCandidates?.length > 0 && (() => {
        // Duplicate enough times so the track is always wider than the viewport
        const items = Array(10).fill(null).flatMap(() => stats.topCandidates);
        // Duplicate the items array once more for seamless 50% scroll
        const doubled = [...items, ...items];
        return (
          <div
            id="leaderboard-ticker"
            className="w-full rounded-2xl sm:rounded-3xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, #0a0a0f 0%, #12091a 50%, #0a0a0f 100%)',
              border: '1.5px solid rgba(139,92,246,0.35)',
              boxShadow: '0 0 32px rgba(124,58,237,0.2)',
            }}
          >
            {/* Top gradient border line */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

            <div className="flex items-center" style={{ height: '52px' }}>
              {/* LIVE badge – fixed left, fades into bg */}
              <div
                className="flex-shrink-0 flex items-center z-20 pr-6"
                style={{
                  paddingLeft: '14px',
                  background: 'linear-gradient(90deg, #0a0a0f 60%, transparent 100%)',
                  height: '100%',
                }}
              >
                <div className="relative flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/25 px-2.5 py-1 rounded-full">
                  <span className="absolute w-2 h-2 rounded-full bg-rose-500 animate-ping opacity-75" />
                  <span className="relative w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">LIVE</span>
                </div>
              </div>

              {/* Scrolling track */}
              <div className="flex-1 overflow-hidden" style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                {/* ticker-track contains 2× the items; animation moves it by -50% = exactly 1× */}
                <div className="ticker-track">
                  {doubled.map((cand, idx) => (
                    <div
                      key={idx}
                      className="flex items-center flex-shrink-0 whitespace-nowrap"
                      style={{ padding: '0 32px', borderRight: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      {/* Rank medal */}
                      <Medal
                        className={`w-4 h-4 mr-2 flex-shrink-0 ${
                          cand.rank === 1 ? 'text-amber-400'
                          : cand.rank === 2 ? 'text-slate-300'
                          : cand.rank === 3 ? 'text-orange-400'
                          : 'text-indigo-400'
                        }`}
                      />
                      {/* Rank badge */}
                      <span
                        className="text-xs font-black mr-2.5 px-2 py-0.5 rounded-full"
                        style={{
                          background: cand.rank === 1
                            ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
                            : 'rgba(99,102,241,0.2)',
                          color: cand.rank === 1 ? '#fff' : '#a5b4fc',
                          border: cand.rank === 1
                            ? '1px solid rgba(245,158,11,0.5)'
                            : '1px solid rgba(99,102,241,0.3)',
                        }}
                      >
                        #{cand.rank}
                      </span>
                      {/* Name */}
                      <span className="text-white font-black text-sm mr-1.5">{cand.name}</span>
                      {/* College */}
                      {cand.institute && (
                        <>
                          <span className="text-slate-500 text-xs font-normal mr-1.5">from</span>
                          <span
                            className="text-xs font-bold px-2.5 py-0.5 rounded-full mr-1.5"
                            style={{
                              background: 'rgba(16,185,129,0.10)',
                              color: '#34d399',
                              border: '1px solid rgba(16,185,129,0.20)',
                              maxWidth: '240px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: 'inline-block',
                              verticalAlign: 'middle',
                            }}
                            title={cand.institute}
                          >
                            {cand.institute}
                          </span>
                        </>
                      )}
                      {/* Secured rank text */}
                      <span className="text-slate-500 text-xs mr-1">secured rank</span>
                      <span
                        className="text-xs font-black mr-1"
                        style={{
                          background: 'linear-gradient(90deg,#e879f9,#f43f5e)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        #{cand.rank}
                      </span>
                      <span className="ml-1 text-sm">🔥</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right fade overlay */}
              <div
                className="flex-shrink-0 w-12 sm:w-20 pointer-events-none"
                style={{
                  height: '100%',
                  background: 'linear-gradient(to left, #0a0a0f 0%, transparent 100%)',
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* ── Stats Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Total Interviews</p>
              <h3 className="text-3xl font-bold text-white">{stats.interviews}</h3>
            </div>
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Average Score</p>
              <h3 className="text-3xl font-bold text-white">{stats.averageScore}%</h3>
            </div>
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <Trophy className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Resumes Uploaded</p>
              <h3 className="text-3xl font-bold text-white">{stats.resumes} / 5</h3>
            </div>
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/20">
              <FileUp className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Interview Evaluations CTA ────────────────────────────── */}
      <div
        id="evaluations-section"
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-[1.5px]"
        style={{
          background: 'linear-gradient(135deg, rgba(251,146,60,0.6) 0%, rgba(168,85,247,0.5) 50%, rgba(251,146,60,0.6) 100%)',
        }}
      >
        <div
          className="relative rounded-[22px] sm:rounded-[23px] overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f0a00 0%, #150b1e 60%, #0f0a00 100%)' }}
        >
          {/* Background glows */}
          <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-48 h-48 bg-orange-500/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -right-16 top-1/2 -translate-y-1/2 w-48 h-48 bg-purple-600/20 rounded-full blur-[80px] pointer-events-none" />

          {/* Shimmer sweep */}
          <div className="absolute inset-0 pointer-events-none eval-shimmer opacity-30" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-5 p-6 sm:p-8">
            {/* Left content */}
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div
                className="flex-shrink-0 p-3 rounded-2xl border"
                style={{
                  background: 'rgba(251,146,60,0.12)',
                  borderColor: 'rgba(251,146,60,0.30)',
                }}
              >
                <ClipboardList className="w-7 h-7 sm:w-8 sm:h-8 wiggle-icon" style={{ color: '#fb923c' }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 text-xs font-black uppercase tracking-widest">New</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(251,146,60,0.15)', color: '#fdba74', border: '1px solid rgba(251,146,60,0.25)' }}>
                    AI Feedback Ready
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                  Your Interview Evaluations Are Here! 🎯
                </h2>
                <p className="text-slate-400 text-sm mt-1 max-w-sm">
                  See detailed AI feedback on every answer — your strengths, weak spots & how to rank higher.
                </p>
              </div>
            </div>

            {/* CTA Button */}
            <Link
              href={stats.latestInterviewId
                ? `/dashboard/leaderboard?expand=${stats.latestInterviewId}`
                : '/dashboard/leaderboard'}
              className="w-full sm:w-auto flex-shrink-0"
            >
              <button
                id="btn-view-evaluations"
                className="group relative w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 rounded-xl font-black text-white text-sm sm:text-base overflow-hidden transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #f97316 0%, #dc2626 50%, #9333ea 100%)',
                  boxShadow: '0 0 24px rgba(251,146,60,0.45), 0 0 60px rgba(251,146,60,0.15)',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 40px rgba(251,146,60,0.7), 0 0 80px rgba(251,146,60,0.25)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 24px rgba(251,146,60,0.45), 0 0 60px rgba(251,146,60,0.15)'}
              >
                {/* Animated shine */}
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                  }}
                />
                <PlayCircle className="w-5 h-5 relative z-10 group-hover:scale-110 transition-transform" />
                <span className="relative z-10 whitespace-nowrap">View My Evaluations</span>
                <ChevronRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Start New Interview CTA ──────────────────────────────── */}
      <div
        id="interview-start-section"
        className="w-full rounded-2xl sm:rounded-3xl p-px overflow-hidden scroll-mt-24"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.5) 0%, rgba(168,85,247,0.4) 100%)' }}
      >
        <div className="bg-[#0a0a0a]/90 backdrop-blur-xl rounded-[22px] sm:rounded-[23px] w-full p-6 sm:p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-600/30 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10 flex-1 w-full">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Want to practice a new role?</h2>
            <p className="text-slate-400 mb-6 max-w-lg text-sm sm:text-base">
              Upload your resume and let our AI tailor specific interview questions for your experience and the job you want.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/dashboard/resumes" className="w-full sm:w-auto">
                <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 text-sm sm:text-base">
                  <FileUp className="w-5 h-5" />
                  Upload Resume
                </button>
              </Link>
              <Link href="/dashboard/interview/setup" className="w-full sm:w-auto">
                <button className="w-full bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 border border-white/10 text-sm sm:text-base">
                  Practice Without Resume
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
