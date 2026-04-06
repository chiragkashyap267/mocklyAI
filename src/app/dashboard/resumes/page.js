'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, File, Trash2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';

export default function ResumesPage() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, uploading, parsing, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const [resumes, setResumes] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoadingResumes, setIsLoadingResumes] = useState(true);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchResumes(currentUser.uid);
      } else {
        setIsLoadingResumes(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchResumes = async (userId) => {
    try {
      const q = query(
        collection(db, "resumes"), 
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const fetchedResumes = [];
      querySnapshot.forEach((doc) => {
        fetchedResumes.push({ id: doc.id, ...doc.data() });
      });
      // Sort manually since compound index might fail without setup
      fetchedResumes.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setResumes(fetchedResumes);
    } catch (error) {
      console.error("Error fetching resumes: ", error);
    } finally {
      setIsLoadingResumes(false);
    }
  };

  const onDrop = useCallback(acceptedFiles => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('idle');
      setErrorMessage('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const handleDeleteResume = async (resumeId) => {
    try {
      await deleteDoc(doc(db, "resumes", resumeId));
      setResumes(prev => prev.filter(r => r.id !== resumeId));
    } catch (error) {
      console.error("Failed to delete resume:", error);
    }
  };

  const uploadAndParse = async () => {
    if (!file || !user) return;

    try {
      setIsUploading(true);
      setStatus('parsing');

      // 1. Send PDF to our API Route to parse text
      const formData = new FormData();
      formData.append('file', file);

      const parseRes = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData
      });

      let data = {};
      try {
        const textResponse = await parseRes.text();
        if (textResponse.startsWith('<!DOCTYPE') || textResponse.startsWith('<html')) {
          throw new Error('Vercel server timeout or server error. The PDF might be too large or complex for the free tier.');
        }
        data = JSON.parse(textResponse);
      } catch (err) {
        throw new Error(err.message || 'Server returned an invalid response. Please try a simpler or smaller PDF.');
      }

      if (!parseRes.ok) {
        throw new Error(data.error || 'Failed to parse PDF');
      }

      const extractedText = data.text;

      // 2. Save the extracted text to Firebase Firestore
      setStatus('saving');
      
      const newResume = {
        userId: user.uid,
        fileName: file.name,
        fileSize: file.size,
        extractedText: extractedText,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "resumes"), newResume);

      setStatus('success');
      setFile(null); // reset file
      fetchResumes(user.uid); // refresh list
      
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMessage(error.message);
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        if(status !== 'error') setStatus('idle');
      }, 3000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
          Resume <span className="text-indigo-400">Manager</span>
        </h1>
        <p className="text-slate-400 text-lg">Upload your latest resume to get tailored interview questions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Section - Takes 2/3 width on large screens */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
            
            <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              <span>Upload New Resume</span>
            </h2>

            {resumes.length >= 5 ? (
              <div className="border-2 border-dashed border-red-500/20 bg-red-500/5 rounded-2xl p-6 md:p-12 text-center">
                <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-red-300 mb-2">
                  Resume Limit Reached
                </h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  You have reached the maximum limit of 5 resumes. Please delete an older resume from the list below to upload a new one.
                </p>
              </div>
            ) : !file ? (
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-2xl p-6 md:p-12 text-center cursor-pointer transition-all duration-300 ease-in-out ${
                  isDragActive 
                    ? 'border-indigo-500 bg-indigo-500/10' 
                    : 'border-white/20 hover:border-indigo-400/50 hover:bg-white/5'
                }`}
              >
                <input {...getInputProps()} />
                <div className="mx-auto w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <FileText className={`w-8 h-8 ${isDragActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {isDragActive ? "Drop your PDF here" : "Drag & drop your PDF here"}
                </h3>
                <p className="text-sm text-slate-400">or click to browse from your computer</p>
                <p className="text-xs text-slate-500 mt-4">Supported formats: .PDF up to 5MB</p>
              </div>
            ) : (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-6 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400">
                      <File className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium truncate max-w-[200px] sm:max-w-xs">{file.name}</h4>
                      <p className="text-sm text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  {!isUploading && status !== 'success' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-slate-400 hover:text-white transition-colors text-sm underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Status Indicator */}
                {status === 'error' && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-2 text-red-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{errorMessage}</span>
                  </div>
                )}

                {status === 'success' && (
                  <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center space-x-2 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm">Resume parsed and saved successfully!</span>
                  </div>
                )}

                {/* Upload Action */}
                {status !== 'success' && (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={uploadAndParse}
                      disabled={isUploading}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>
                        {status === 'parsing' ? 'Reading PDF...' : 
                         status === 'saving' ? 'Saving to Database...' : 
                         'Parse & Save Resume'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Previous Resumes Section */}
        <div className="lg:col-span-1">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 backdrop-blur-xl h-full min-h-[400px]">
            <h2 className="text-lg font-bold text-white mb-6">Your Resumes</h2>
            
            {isLoadingResumes ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-slate-400 text-sm">Loading resumes...</p>
              </div>
            ) : resumes.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm">No resumes uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {resumes.map((resume, idx) => (
                  <div key={resume.id} className="group p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-indigo-500/30 rounded-2xl transition-all">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500/20">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{resume.fileName}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          {resume.createdAt 
                            ? new Date(resume.createdAt.toMillis()).toLocaleDateString() 
                            : 'Just now'}
                        </p>
                      </div>
                      {idx === 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Latest
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-end items-center space-x-3">
                      <button 
                        onClick={() => handleDeleteResume(resume.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all duration-200"
                        title="Delete this resume"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <Link href={`/dashboard/interview/setup?resumeId=${resume.id}`}>
                        <button className="bg-white/10 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200">
                          Practice with this Resume
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
