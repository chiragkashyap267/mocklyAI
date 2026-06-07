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
    <div className="space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker-scroll 400s linear infinite;
          will-change: transform;
        }
        @media (min-width: 768px) {
          .ticker-track { animation-duration: 600s; }
        }
        .ticker-track:hover { animation-play-state: paused; }

        @keyframes indigo-pulse {
          0%, 100% { box-shadow: 0 0 18px 2px rgba(99,102,241,0.30), 0 0 40px 0 rgba(99,102,241,0.10); }
          50%       { box-shadow: 0 0 28px 5px rgba(99,102,241,0.45), 0 0 60px 4px rgba(99,102,241,0.18); }
        }
        .btn-indigo-glow { animation: indigo-pulse 2.6s ease-in-out infinite; }

        @keyframes shimmer-slide {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .eval-shimmer {
          background: linear-gradient(
            90deg,
            rgba(99,102,241,0) 0%,
            rgba(99,102,241,0.25) 40%,
            rgba(139,92,246,0.25) 60%,
            rgba(99,102,241,0) 100%
          );
          background-size: 200% 100%;
          animation: shimmer-slide 2.5s linear infinite;
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-3deg); }
          50%       { transform: rotate(3deg); }
        }
        .wiggle-icon { animation: wiggle 1.2s ease-in-out infinite; }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* welcome banner */}
      <div className="bg-[#0f0f18] border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-indigo-500/15 via-violet-500/5 to-transparent rounded-full blur-[80px] pointer-events-none -mt-40 -mr-40" />

          <div className="relative z-10 flex flex-col gap-4 sm:gap-5">
          {/* Left: greeting */}
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/5 rounded-full border border-white/10 flex-shrink-0">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight break-words leading-tight">
                  Hi, {stats.profile?.displayName || 'Candidate'} 👋
                </h1>
                {stats.profile?.institute && (
                  <p className="text-teal-400 flex items-center font-medium mt-1 text-sm">
                    <Building2 className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    <span className="break-words">{stats.profile.institute}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Rank + Competitors + CTA row */}
          <div className="flex flex-col gap-3">
            {/* Rank + Competitors */}
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="text-center flex-1 sm:flex-none">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Global Rank</p>
                <div className="flex items-center justify-center gap-1 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl">
                  <Medal className="w-4 h-4 text-indigo-400" />
                  <span className="text-lg sm:text-2xl font-black text-indigo-300">
                    {stats.rank ? `#${stats.rank}` : '---'}
                  </span>
                </div>
              </div>

              <div className="text-center flex-1 sm:flex-none">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Competitors</p>
                <div className="flex items-center justify-center gap-1 bg-slate-500/10 border border-slate-500/20 px-3 py-1.5 rounded-xl">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-lg font-bold text-white">{stats.totalStudents}</span>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
              {/* Start Interview – professional indigo */}
              <a href="#interview-start-section" className="flex-1">
                <button
                  id="btn-start-interview"
                  className="btn-indigo-glow w-full group relative flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-3 rounded-xl font-extrabold text-white transition-all hover:scale-105 active:scale-95 border border-indigo-500/40 text-xs sm:text-sm"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                  }}
                >
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
                  START INTERVIEW
                </button>
              </a>

              {/* Check Rank – soft violet outline */}
              <Link href="/dashboard/leaderboard" className="flex-1">
                <button
                  id="btn-check-rank"
                  className="w-full group relative flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-3 rounded-xl font-bold text-white transition-all hover:scale-105 active:scale-95 border border-violet-500/25 text-xs sm:text-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(109,40,217,0.15) 0%, rgba(99,102,241,0.08) 100%)',
                    boxShadow: '0 0 16px 0 rgba(99,102,241,0.12)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 24px 2px rgba(99,102,241,0.28)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 16px 0 rgba(99,102,241,0.12)'}
                >
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400 group-hover:-rotate-12 transition-transform" />
                  <span className="text-violet-200">CHECK RANK</span>
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Motivational callout */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-slate-300 text-xs sm:text-sm">
            <strong className="text-indigo-400 font-bold">{stats.totalStudents} students</strong> from{' '}
            <strong className="text-teal-400 font-bold">{stats.totalColleges} colleges</strong> are currently registered on Mockly AI.{' '}
            {stats.rank
              ? `You're ranked #${stats.rank} globally — keep going! 🚀`
              : 'Complete an interview to secure your spot on the Global Leaderboard!'}
          </p>
        </div>
      </div>

      {/* live leaderboard ticker */}
      {stats.topCandidates?.length > 0 && (() => {
        const items = Array(10).fill(null).flatMap(() => stats.topCandidates);
        const doubled = [...items, ...items];
        return (
          <div
            id="leaderboard-ticker"
            className="w-full rounded-2xl sm:rounded-3xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, #0a0a0f 0%, #0d0d1a 50%, #0a0a0f 100%)',
              border: '1.5px solid rgba(99,102,241,0.25)',
              boxShadow: '0 0 24px rgba(99,102,241,0.10)',
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

            <div className="flex items-center" style={{ height: '52px' }}>
              {/* LIVE badge */}
              <div
                className="flex-shrink-0 flex items-center z-20 pr-6"
                style={{
                  paddingLeft: '14px',
                  background: 'linear-gradient(90deg, #0a0a0f 60%, transparent 100%)',
                  height: '100%',
                }}
              >
                <div className="relative flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                  <span className="absolute w-2 h-2 rounded-full bg-indigo-400 animate-ping opacity-75" />
                  <span className="relative w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">LIVE</span>
                </div>
              </div>

              {/* Scrolling track */}
              <div className="flex-1 overflow-hidden" style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                <div className="ticker-track">
                  {doubled.map((cand, idx) => (
                    <div
                      key={idx}
                      className="flex items-center flex-shrink-0 whitespace-nowrap"
                      style={{ padding: '0 32px', borderRight: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <Medal
                        className={`w-4 h-4 mr-2 flex-shrink-0 ${
                          cand.rank === 1 ? 'text-indigo-300'
                          : cand.rank === 2 ? 'text-slate-300'
                          : cand.rank === 3 ? 'text-violet-400'
                          : 'text-slate-500'
                        }`}
                      />
                      <span
                        className="text-xs font-black mr-2.5 px-2 py-0.5 rounded-full"
                        style={{
                          background: cand.rank === 1
                            ? 'linear-gradient(90deg,#4f46e5,#7c3aed)'
                            : 'rgba(99,102,241,0.12)',
                          color: cand.rank === 1 ? '#e0e7ff' : '#a5b4fc',
                          border: cand.rank === 1
                            ? '1px solid rgba(99,102,241,0.5)'
                            : '1px solid rgba(99,102,241,0.2)',
                        }}
                      >
                        #{cand.rank}
                      </span>
                      <span className="text-white font-black text-sm mr-1.5">{cand.name}</span>
                      {cand.institute && (
                        <>
                          <span className="text-slate-500 text-xs font-normal mr-1.5">from</span>
                          <span
                            className="text-xs font-bold px-2.5 py-0.5 rounded-full mr-1.5"
                            style={{
                              background: 'rgba(20,184,166,0.08)',
                              color: '#5eead4',
                              border: '1px solid rgba(20,184,166,0.15)',
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
                      <span className="text-slate-500 text-xs mr-1">secured rank</span>
                      <span
                        className="text-xs font-black mr-1"
                        style={{
                          background: 'linear-gradient(90deg,#818cf8,#a78bfa)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        #{cand.rank}
                      </span>
                      <span className="ml-1 text-sm">✨</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right fade overlay */}
              <div
                className="flex-shrink-0 w-12 sm:w-20 pointer-events-none"
                style={{ height: '100%', background: 'linear-gradient(to left, #0a0a0f 0%, transparent 100%)' }}
              />
            </div>
          </div>
        );
      })()}

      {/* stats overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 backdrop-blur-xl relative overflow-hidden group hover:border-indigo-500/25 transition-colors col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/8 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Interviews</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-white">{stats.interviews}</h3>
            </div>
            <div className="p-2 sm:p-3 bg-indigo-500/10 text-indigo-400 rounded-xl sm:rounded-2xl border border-indigo-500/15">
              <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/8 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 backdrop-blur-xl relative overflow-hidden group hover:border-teal-500/25 transition-colors col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/8 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Avg Score</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-white">{stats.averageScore}%</h3>
            </div>
            <div className="p-2 sm:p-3 bg-teal-500/10 text-teal-400 rounded-xl sm:rounded-2xl border border-teal-500/15">
              <Trophy className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/8 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 backdrop-blur-xl relative overflow-hidden group hover:border-violet-500/25 transition-colors col-span-2 sm:col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/8 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">Resumes</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-white">{stats.resumes} / 5</h3>
            </div>
            <div className="p-2 sm:p-3 bg-violet-500/10 text-violet-400 rounded-xl sm:rounded-2xl border border-violet-500/15">
              <FileUp className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* evaluations CTA section */}
      <div
        id="evaluations-section"
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-[1.5px]"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.45) 0%, rgba(139,92,246,0.35) 50%, rgba(99,102,241,0.45) 100%)',
        }}
      >
        <div
          className="relative rounded-[22px] sm:rounded-[23px] overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #080814 0%, #0e0b1e 60%, #080814 100%)' }}
        >
          {/* Background glows */}
          <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-600/12 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -right-16 top-1/2 -translate-y-1/2 w-48 h-48 bg-violet-600/12 rounded-full blur-[80px] pointer-events-none" />

          {/* Shimmer sweep */}
          <div className="absolute inset-0 pointer-events-none eval-shimmer opacity-40" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 md:p-8">
            {/* Left content */}
            <div className="flex items-start gap-3">
              <div
                className="flex-shrink-0 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border"
                style={{
                  background: 'rgba(99,102,241,0.10)',
                  borderColor: 'rgba(99,102,241,0.22)',
                }}
              >
                <ClipboardList className="w-5 h-5 sm:w-7 sm:h-7 wiggle-icon" style={{ color: '#818cf8' }} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <Star className="w-3 h-3 text-indigo-400" />
                  <span className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">New</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.22)' }}>
                    AI Feedback Ready
                  </span>
                </div>
                <h2 className="text-sm sm:text-lg font-black text-white leading-tight">
                  Your Evaluations Are Here! 🎯
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-0.5 max-w-sm">
                  See AI feedback on every answer — strengths &amp; how to rank higher.
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
                className="group relative w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl font-black text-white text-xs sm:text-sm overflow-hidden transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  boxShadow: '0 0 20px rgba(99,102,241,0.30), 0 0 50px rgba(99,102,241,0.08)',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 32px rgba(99,102,241,0.50), 0 0 70px rgba(99,102,241,0.15)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(99,102,241,0.30), 0 0 50px rgba(99,102,241,0.08)'}
              >
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%)' }}
                />
                <PlayCircle className="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform" />
                <span className="relative z-10 whitespace-nowrap">View My Evaluations</span>
                <ChevronRight className="w-3.5 h-3.5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* start interview section */}
      <div
        id="interview-start-section"
        className="w-full rounded-2xl sm:rounded-3xl p-px overflow-hidden scroll-mt-24"
        style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.40) 0%, rgba(124,58,237,0.30) 100%)' }}
      >
        <div className="bg-[#0a0a0f]/92 backdrop-blur-xl rounded-[22px] sm:rounded-[23px] w-full p-4 sm:p-6 md:p-10 relative overflow-hidden">
          <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-700/20 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10 w-full">
            <h2 className="text-base sm:text-xl md:text-2xl font-bold text-white mb-1.5 sm:mb-2">Want to practice a new role?</h2>
            <p className="text-slate-400 mb-4 sm:mb-6 max-w-lg text-xs sm:text-sm md:text-base">
              Upload your resume and let our AI tailor specific interview questions for your experience.
            </p>
            <div className="flex flex-col xs:flex-row gap-3">
              <Link href="/dashboard/resumes" className="flex-1">
                <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 text-xs sm:text-sm md:text-base">
                  <FileUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  Upload Resume
                </button>
              </Link>
              <Link href="/dashboard/interview/setup" className="flex-1">
                <button className="w-full bg-white/6 hover:bg-white/10 text-white px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 border border-white/8 text-xs sm:text-sm md:text-base">
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
