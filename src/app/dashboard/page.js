'use client';

import { useState, useEffect } from 'react';
import { FileUp, TrendingUp, Trophy, User, Building2, Medal, Users } from 'lucide-react';
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
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. Fetch User Profile
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const profile = userDoc.exists() ? userDoc.data() : null;
          
          // 2. Fetch Aggregated Interview Stats & Rank
          const snap = await getDocs(query(collection(db, 'interviews'), orderBy('createdAt', 'desc')));
          let validInterviews = [];
          const uniqueUsers = new Set();
          
          let myInterviewsCount = 0;
          let mySum = 0;
          let myCompleted = 0;

          snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.userId) uniqueUsers.add(data.userId);
            if (data.userId === user.uid) myInterviewsCount++;

            if (!data.answers || !data.questions) return;
            
            // Allow interviews to rank ONLY if fully completed
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

          // Sort descending
          validInterviews.sort((a, b) => b.overall - a.overall);
          
          // Find user's best rank
          const myBestIndex = validInterviews.findIndex(v => v.userId === user.uid);
          const myRank = myBestIndex !== -1 ? myBestIndex + 1 : null;

          // 3. Fetch all users to count distinct colleges & append Top 5 names
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

          // Grab the top 5 valid candidates for the marquee strip
          const top5Valid = validInterviews.slice(0, 5);
          const topCandidatesData = top5Valid.map((v, i) => {
            const profile = userMap[v.userId];
            return {
               ...v,
               rank: i + 1,
               name: profile?.displayName || 'Anonymous',
               institute: profile?.institute || ''
            };
          });

          // 4. Fetch Resumes limit
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
            totalColleges: uniqueColleges.size || PRESET_COLLEGES.length || 0,
          });

        } catch (error) {
          console.error("Error fetching stats:", error);
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      
      {/* Marquee Animation Support */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* Dynamic Welcome Banner */}
      <div className="bg-[#0f0f18] border border-white/5 rounded-3xl p-8 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-indigo-500/20 via-purple-500/5 to-transparent rounded-full blur-[80px] pointer-events-none -mt-40 -mr-40" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4 md:max-w-[50%]">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2.5 bg-white/5 rounded-full border border-white/10 flex-shrink-0">
                <User className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-extrabold text-white tracking-tight break-words whitespace-normal leading-tight">
                  Hi, {stats.profile?.displayName || 'Candidate'} 👋
                </h1>
                {stats.profile?.institute && (
                  <p className="text-emerald-400 flex items-center font-medium mt-1 truncate">
                    <Building2 className="w-4 h-4 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{stats.profile.institute}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end space-y-4 pb-1">
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1 shadow-sm">Global Rank</p>
                <div className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 px-4 py-2 rounded-xl">
                  <Medal className="w-5 h-5 text-amber-400" />
                  <span className="text-2xl font-black text-amber-500">{stats.rank ? `#${stats.rank}` : '---'}</span>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Competitors</p>
                <div className="flex flex-col items-center justify-center bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-xl">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-xl font-bold text-white">{stats.totalStudents}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-3 pb-1 w-full md:w-auto mt-6 md:mt-0">
               <a href="#interview-start-section" className="w-full sm:w-auto">
                 <button className="w-full group relative flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl font-extrabold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(20,184,166,0.5)] transition-all hover:scale-105 active:scale-95 border border-emerald-400/50">
                   <TrendingUp className="w-5 h-5 group-hover:scale-110 transition-transform" />
                   START INTERVIEW NOW
                 </button>
               </a>
               
               <Link href="/dashboard/leaderboard" className="w-full sm:w-auto">
                 <button className="w-full group relative flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-indigo-500 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all animate-pulse hover:animate-none hover:scale-105 active:scale-95 border border-pink-400/30">
                   <Trophy className="w-4 h-4 group-hover:-rotate-12 transition-transform" />
                   CHECK YOUR RANK
                 </button>
               </Link>
             </div>
           </div>
        </div>

        {/* Motivational Callout */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-slate-300">
            <strong className="text-indigo-400 font-bold">{stats.totalStudents} students</strong> from <strong className="text-emerald-400 font-bold">{stats.totalColleges} colleges</strong> are currently registered on Mockly AI improving their skills. 
            {stats.rank ? ` You are in the top ${stats.rank} globally!` : ' Take an interview to secure your spot on the Global Leaderboard!'}
          </p>
        </div>
      </div>

      {/* 🚀 Vibrant Ticker Strip for Top Rankings */}
      {stats.topCandidates?.length > 0 && (
        <div className="w-full bg-gradient-to-r from-fuchsia-600 via-indigo-600 to-fuchsia-600 rounded-3xl p-[2px] shadow-[0_0_30px_rgba(124,58,237,0.3)] relative overflow-hidden group">
          <div className="bg-[#0a0a0f] rounded-[22px] w-full py-3.5 relative overflow-hidden flex items-center">
            
            {/* Live Indicator inside ticker */}
            <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center px-4 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f] to-transparent w-24">
               <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute" />
                  <div className="w-2 h-2 rounded-full bg-rose-500 relative" />
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">LIVE</span>
               </div>
            </div>

            <div className="flex w-max animate-marquee space-x-12 px-12 whitespace-nowrap overflow-hidden items-center group-hover:[animation-play-state:paused]">
               {/* Highly duplicated array to ensure smooth seamless infinite scrolling even if there is only 1 candidate in the DB */}
               {Array(10).fill(stats.topCandidates).flat().map((cand, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 shrink-0">
                    <Medal className={`w-5 h-5 ${cand.rank === 1 ? 'text-amber-400' : cand.rank === 2 ? 'text-slate-300' : cand.rank === 3 ? 'text-orange-400' : 'text-indigo-400'}`} />
                    <span className="text-slate-200 font-medium tracking-wide flex items-center gap-2 text-sm sm:text-base">
                      <strong className="text-white font-black">{cand.name}</strong> 
                      {cand.institute ? (
                         <> <span className="text-slate-400">from</span> <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">{cand.institute}</span></>
                      ) : ''}
                      <span className="text-slate-400">secured Rank</span> <span className="text-fuchsia-400 font-black">#{cand.rank}</span> 🔥
                    </span>
                  </div>
               ))}
            </div>
            
            <div className="absolute right-0 top-0 bottom-0 z-20 w-16 bg-gradient-to-l from-[#0a0a0f] to-transparent pointer-events-none" />
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
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

        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
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

        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/30 transition-colors">
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

      {/* Start New Interview CTA Area */}
      <div id="interview-start-section" className="mt-12 w-full bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-indigo-900/40 rounded-3xl p-px overflow-hidden scroll-mt-24">
        <div className="bg-[#0a0a0a]/90 backdrop-blur-xl rounded-[23px] w-full p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-600/30 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10 flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">Want to practice a new role?</h2>
            <p className="text-slate-400 mb-6 max-w-lg">Upload your resume and let our AI tailor specific interview questions for your experience and the job you want.</p>
            <div className="flex flex-col sm:flex-row md:justify-start items-center gap-4">
              <Link href="/dashboard/resumes">
                <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 flex items-center space-x-2 w-full sm:w-auto justify-center">
                  <FileUp className="w-5 h-5" />
                  <span>Upload Resume</span>
                </button>
              </Link>
              <Link href="/dashboard/interview/setup">
                <button className="bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-xl font-medium transition-all flex items-center space-x-2 w-full sm:w-auto justify-center border border-white/10">
                  <span>Practice Without Resume</span>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
