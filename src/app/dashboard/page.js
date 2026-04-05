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

          // 3. Fetch Resumes limit
          const resumesSnap = await getDocs(query(collection(db, 'resumes'), where('userId', '==', user.uid)));
          
          const finalAverage = myCompleted > 0 ? ((mySum / myCompleted) * 10).toFixed(0) : 0;

          setStats({
            interviews: myInterviewsCount,
            resumes: resumesSnap.size,
            averageScore: finalAverage,
            rank: myRank,
            totalStudents: uniqueUsers.size,
            profile,
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
      
      {/* Dynamic Welcome Banner */}
      <div className="bg-[#0f0f18] border border-white/5 rounded-3xl p-8 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-indigo-500/20 via-purple-500/5 to-transparent rounded-full blur-[80px] pointer-events-none -mt-40 -mr-40" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2.5 bg-white/5 rounded-full border border-white/10">
                <User className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  Hi, {stats.profile?.displayName || 'Candidate'} 👋
                </h1>
                {stats.profile?.institute && (
                  <p className="text-emerald-400 flex items-center font-medium mt-1">
                    <Building2 className="w-4 h-4 mr-1.5" />
                    {stats.profile.institute}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-6 pb-1">
            <div className="text-center">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1 shadow-sm">Global Rank</p>
              <div className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 px-4 py-2 rounded-xl">
                <Medal className="w-5 h-5 text-amber-400" />
                <span className="text-2xl font-black text-amber-500">{stats.rank ? `#${stats.rank}` : '---'}</span>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Competitors</p>
              <div className="flex items-center justify-center space-x-1.5 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl">
                <Users className="w-5 h-5 text-blue-400" />
                <span className="text-xl font-bold text-white">{stats.totalStudents}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Motivational Callout */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-slate-300">
            <strong className="text-indigo-400 font-bold">{stats.totalStudents} students</strong> are currently registered on Mockly AI improving their skills. 
            {stats.rank ? ` You are in the top ${stats.rank} globally!` : ' Take an interview to secure your spot on the Global Leaderboard!'}
          </p>
        </div>
      </div>

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
      <div className="mt-12 w-full bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-indigo-900/40 rounded-3xl p-px overflow-hidden">
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
