'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Bot, Mail, Lock, ArrowLeft, Loader2, Sparkles, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

// Only allow Gmail accounts through Google sign-in
const ALLOWED_GOOGLE_DOMAIN = '@gmail.com';

export default function LoginPage() {
  const [mode, setMode] = useState('sign_in'); // sign_in | sign_up | forgot_password
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [highlightGoogle, setHighlightGoogle] = useState(false);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const router = useRouter();

  // Friendly Firebase error codes → readable messages
  const friendlyError = (code, fallback) => {
    const map = {
      'auth/user-not-found':                    'No account found with this email. Please sign up first.',
      'auth/wrong-password':                    'Incorrect password. Try again or use Forgot Password.',
      'auth/invalid-credential':                'Incorrect email or password. Please try again.',
      'auth/email-already-in-use':              'This email is already registered. Please sign in instead.',
      'auth/weak-password':                     'Password must be at least 6 characters long.',
      'auth/invalid-email':                     'Please enter a valid email address.',
      'auth/too-many-requests':                 'Too many failed attempts. Please wait a few minutes and try again.',
      'auth/account-exists-with-different-credential':
        'This email is linked to a different sign-in method. Try signing in with Google instead.',
      'auth/popup-closed-by-user':              'Sign-in popup was closed. Please try again.',
      'auth/network-request-failed':            'Network error. Please check your internet connection.',
    };
    return map[code] || fallback || 'Something went wrong. Please try again.';
  };

  // ── Google Sign-In (Gmail only) ────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true); setError(''); setMessage('');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user.email || '';

      // Enforce Gmail only
      if (!userEmail.toLowerCase().endsWith(ALLOWED_GOOGLE_DOMAIN)) {
        await auth.signOut();
        setError(`Only Gmail accounts (@gmail.com) are allowed. You signed in with: ${userEmail}`);
        setIsLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setError(friendlyError(err.code, err.message));
      setIsLoading(false);
    }
  };

  // ── Email/Password sign-in or sign-up ─────────────────────────────────────
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError('Please enter both email and password.');
    try {
      setIsLoading(true); setError(''); setMessage('');
      if (mode === 'sign_in') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push('/dashboard');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.includes('google.com')) {
            setError("This email is already registered using Google. Please click 'Sign in with Google' below.");
            setHighlightGoogle(true);
            setTimeout(() => setHighlightGoogle(false), 5000); // remove highlight after 5s
            setIsLoading(false);
            return;
          }
        } catch (_) {}
        setMode('sign_in');
      }
      setError(friendlyError(err.code, err.message));
      setIsLoading(false);
    }
  };

  // ── Forgot password (robust: check if email exists first) ─────────────────
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) return setError('Please enter your email address first.');
    try {
      setIsLoading(true); setError(''); setMessage('');

      // Check what providers are linked to this email
      const methods = await fetchSignInMethodsForEmail(auth, email);

      if (methods.length === 0) {
        // No account with this email
        setError('No account found with this email. Please sign up first.');
        setIsLoading(false);
        return;
      }

      // Removed artificial block: Allow Firebase to native send a reset link, which cleanly links a new password to an existing Google account!
      await sendPasswordResetEmail(auth, email);
      setMessage('✅ Password reset email sent! Check your inbox (and spam folder).');
      setMode('sign_in');
    } catch (err) {
      setError(friendlyError(err.code, err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'block w-full pl-12 pr-4 py-3.5 bg-[#0d0d14] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/40 transition-all text-sm';

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-indigo-700/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-purple-700/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-[0_0_30px_rgba(99,102,241,0.4)]">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Mockly AI</h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === 'sign_in'      && 'Welcome back! Sign in to continue.'}
            {mode === 'sign_up'      && 'Create your free account.'}
            {mode === 'forgot_password' && 'Reset your password via email.'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">

          {/* Success message */}
          {message && (
            <div className="mb-5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start space-x-3 text-emerald-400 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── FORGOT PASSWORD form ── */}
          {mode === 'forgot_password' ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                type="submit" disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(99,102,241,0.35)] flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                <span>{isLoading ? 'Sending...' : 'Send Reset Email'}</span>
              </button>
              <button
                type="button" onClick={() => { setMode('sign_in'); setError(''); setMessage(''); }}
                className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </button>
            </form>
          ) : (
            /* ── SIGN IN / SIGN UP form ── */
            <form onSubmit={handleEmailAuth} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                  {mode === 'sign_in' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot_password'); setError(''); setMessage(''); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'sign_up' ? 'Min. 6 characters' : '••••••••'}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'sign_up' && (
                  <p className="text-[11px] text-slate-600">Use a strong password with letters, numbers & symbols.</p>
                )}
              </div>

              <button
                type="submit" disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(99,102,241,0.35)] flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                <span>{isLoading ? 'Please wait...' : mode === 'sign_in' ? 'Sign In' : 'Create Account'}</span>
              </button>

              <p className="text-center text-sm text-slate-500">
                {mode === 'sign_in' ? (
                  <>Don&apos;t have an account?{' '}
                    <button type="button" onClick={() => { setMode('sign_up'); setError(''); }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                      Sign Up
                    </button>
                  </>
                ) : (
                  <>Already have an account?{' '}
                    <button type="button" onClick={() => { setMode('sign_in'); setError(''); }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                      Sign In
                    </button>
                  </>
                )}
              </p>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/8" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#0d0d1a] px-3 text-slate-500 font-medium uppercase tracking-wide">or continue with</span>
                </div>
              </div>

              {/* Google */}
              <button
                type="button" onClick={handleGoogleSignIn} disabled={isLoading}
                className={`w-full flex items-center justify-center space-x-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all shadow-sm disabled:opacity-60 ${
                  highlightGoogle ? 'ring-4 ring-indigo-500 ring-offset-2 ring-offset-[#0d0d1a] scale-105 shadow-[0_0_30px_rgba(99,102,241,0.6)]' : ''
                }`}
              >
                {/* Google G icon */}
                <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Sign in with Google</span>
              </button>
              <p className="text-center text-xs text-slate-600">Only Gmail accounts (@gmail.com) are accepted.</p>
            </form>
          )}
        </div>

        <p className="text-center text-slate-700 text-xs mt-6">
          Made by <span className="text-slate-500 font-semibold">Chirag Kashyap</span> · Mockly AI
        </p>
      </div>
    </div>
  );
}
