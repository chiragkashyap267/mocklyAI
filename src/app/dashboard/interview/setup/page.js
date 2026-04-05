'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase, Loader2, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

function SetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialResumeId = searchParams.get('resumeId');
  
  const [user, setUser] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(initialResumeId || '');

  const [jobRole, setJobRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Mid-Level');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchResumes(currentUser.uid);
      }
    });
    return () => unsub();
  }, []);

  const fetchResumes = async (uid) => {
    try {
      const q = query(collection(db, 'resumes'), where('userId', '==', uid));
      const snap = await getDocs(q);
      const resData = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setResumes(resData);
    } catch (err) {
      console.error('Error fetching resumes:', err);
    }
  };

  const handleGenerateQuestions = async (e) => {
    e.preventDefault();
    if (!jobRole) return;

    try {
      setIsGenerating(true);
      setError('');

      let resumeText = '';
      if (selectedResumeId) {
        const selected = resumes.find(r => r.id === selectedResumeId);
        if (selected) {
           resumeText = selected.extractedText;
        } else {
           const docRef = doc(db, 'resumes', selectedResumeId);
           const docSnap = await getDoc(docRef);
           if (docSnap.exists()) resumeText = docSnap.data().extractedText;
        }
      }

      // Call our Gemini backend
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          jobRole,
          experienceLevel
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate questions');
      }

      // Save the Interview Session to Firebase
      const interviewSession = {
        userId: user.uid,
        resumeId: selectedResumeId || null,
        jobRole,
        experienceLevel,
        questions: data.questions,
        createdAt: serverTimestamp(),
        status: 'pending' // pending, ongoing, completed
      };

      const sessionDocRef = await addDoc(collection(db, "interviews"), interviewSession);

      // Redirect to the actual voice interview page!
      router.push(`/dashboard/interview/${sessionDocRef.id}`);

    } catch (err) {
      console.error(err);
      setError(err.message);
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-10">
      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 md:p-12 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Configure Interview</h1>
              <p className="text-slate-400 mt-1">Tell Mockly AI the role you are aiming for.</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-3 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleGenerateQuestions} className="space-y-6">
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Select Resume (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-slate-500" />
                  </div>
                  <select
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all appearance-none"
                  >
                    <option value="">No Resume (General Practice)</option>
                    {resumes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.fileName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Target Job Role / Title</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Briefcase className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g. Senior Frontend Developer, Product Manager..."
                    className="block w-full pl-12 pr-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all appearance-none"
                >
                  <option value="Internship">Internship</option>
                  <option value="Junior / Entry-Level">Junior / Entry-Level</option>
                  <option value="Mid-Level">Mid-Level</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead / Manager">Lead / Manager</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isGenerating || !jobRole}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(147,51,234,0.3)] flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed mt-8"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Mockly AI is generating your questions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Generate Interview Questions</span>
                  </>
                )}
              </button>

            </form>
        </div>
      </div>
    </div>
  );
}

export default function InterviewSetupPage() {
  return (
    <Suspense fallback={<div className="text-white p-10">Loading setup block...</div>}>
      <SetupForm />
    </Suspense>
  );
}
