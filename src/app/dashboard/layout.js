'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, FileText, Activity, Settings, LogOut, Bot, Menu, X,
  User, Building2, ChevronDown, Check, Loader2, Search,
} from 'lucide-react';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ── College list ────────────────────────────────────────────────────────────
const PRESET_COLLEGES = ['GB PANT ENGINEERING COLLEGE'];

// ── Profile Setup Modal ─────────────────────────────────────────────────────
function ProfileSetupModal({ user, onComplete }) {
  const [name,            setName]            = useState(user?.displayName || '');
  const [collegeQuery,    setCollegeQuery]    = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [otherCollege,    setOtherCollege]    = useState('');
  const [isDropdownOpen,  setIsDropdownOpen]  = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [nameError,       setNameError]       = useState('');
  const [collegeError,    setCollegeError]    = useState('');
  const dropdownRef = useRef(null);

  const finalCollege = selectedCollege === 'Others' ? otherCollege.trim() : selectedCollege;
  const canSave      = name.trim().length >= 2 && finalCollege.length >= 2;

  const filtered = PRESET_COLLEGES.filter(c =>
    c.toLowerCase().includes(collegeQuery.toLowerCase())
  );

  useEffect(() => {
    const h = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectCollege = (c) => {
    setSelectedCollege(c);
    setCollegeQuery(c === 'Others' ? '' : c);
    setIsDropdownOpen(false);
    setCollegeError('');
  };

  const handleSave = async () => {
    let valid = true;
    if (name.trim().length < 2)    { setNameError('Please enter your full name (min 2 chars).'); valid = false; }
    else setNameError('');
    if (!finalCollege || finalCollege.length < 2) { setCollegeError('Please select or enter your college name.'); valid = false; }
    else setCollegeError('');
    if (!valid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: name.trim(),
        institute:   finalCollege,
        email:       user.email,
        photoURL:    user.photoURL || '',
        updatedAt:   new Date(),
      }, { merge: true });
      onComplete();
    } catch (err) {
      console.error('Profile save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[60vw] h-[40vh] bg-indigo-900/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="relative w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-400">
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Bot className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Complete Your Profile</h2>
              <p className="text-slate-500 text-xs">Required to appear on the Leaderboard</p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5 mb-4">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 ml-1">
              <User className="w-3.5 h-3.5 text-indigo-400" />Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(''); }}
              placeholder="e.g. Rahul Sharma"
              className="w-full bg-white/[0.04] border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none transition-all"
            />
            {nameError && <p className="text-red-400 text-xs ml-1">{nameError}</p>}
          </div>

          {/* College dropdown */}
          <div className="space-y-1.5 mb-5" ref={dropdownRef}>
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 ml-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />College / Institute <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(v => !v)}
                className={`w-full flex items-center justify-between bg-white/[0.04] border rounded-xl px-4 py-3 text-sm outline-none transition-all text-left ${
                  isDropdownOpen ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' : 'border-white/10'
                } ${selectedCollege ? 'text-white' : 'text-slate-600'}`}
              >
                <span className="truncate">{selectedCollege || 'Select your college…'}</span>
                <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                    <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <input
                      type="text"
                      value={collegeQuery}
                      onChange={(e) => setCollegeQuery(e.target.value)}
                      placeholder="Search college…"
                      className="flex-1 bg-transparent text-white text-xs outline-none placeholder-slate-600"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto custom-scrollbar py-1">
                    {filtered.length === 0 && (
                      <p className="text-slate-600 text-xs px-4 py-3">No match — select "Others" below.</p>
                    )}
                    {filtered.map((c) => (
                      <button key={c} type="button" onClick={() => selectCollege(c)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors">
                        <span className={selectedCollege === c ? 'text-indigo-300 font-medium' : 'text-slate-300'}>{c}</span>
                        {selectedCollege === c && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>
                    ))}
                    <button type="button" onClick={() => selectCollege('Others')}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-white/5 border-t border-white/5 transition-colors">
                      <span className={selectedCollege === 'Others' ? 'text-indigo-300 font-medium' : 'text-slate-400'}>Others (type manually)</span>
                      {selectedCollege === 'Others' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedCollege === 'Others' && (
              <input
                type="text"
                value={otherCollege}
                onChange={(e) => { setOtherCollege(e.target.value); setCollegeError(''); }}
                placeholder="Type your college name…"
                className="w-full bg-white/[0.04] border border-white/10 focus:border-indigo-500/60 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none transition-all mt-2"
                autoFocus
              />
            )}
            {collegeError && <p className="text-red-400 text-xs ml-1">{collegeError}</p>}
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{saving ? 'Saving…' : 'Save & Continue'}</span>
          </button>
          <p className="text-slate-600 text-[10px] text-center mt-2.5">You can update these anytime in Settings</p>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Layout ────────────────────────────────────────────────────────
export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentUser,      setCurrentUser]      = useState(null);

  // True when user is inside an active interview room (not setup)
  const isInterviewRoom = /^\/dashboard\/interview\/[^/]+$/.test(pathname);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setCurrentUser(user);
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (!d.displayName?.trim() || !d.institute?.trim()) setShowProfileModal(true);
        } else {
          setShowProfileModal(true);
        }
      } catch { /* silent */ }
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try { await signOut(auth); router.push('/login'); } catch { /* silent */ }
  };

  const closeMobileMenu = () => { if (isMobileMenuOpen) setIsMobileMenuOpen(false); };

  const navLinks = [
    { name: 'Dashboard',   href: '/dashboard',             icon: Home },
    { name: 'My Resumes',  href: '/dashboard/resumes',     icon: FileText },
    { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Activity },
    { name: 'Settings',    href: '/dashboard/settings',    icon: Settings },
  ];

  return (
    <div className="flex bg-[#0a0a0a] text-white overflow-hidden relative selection:bg-indigo-500/30"
         style={{ height: '100dvh' }}>
      {/* Background glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-900/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-900/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Profile modal */}
      {showProfileModal && currentUser && (
        <ProfileSetupModal user={currentUser} onComplete={() => setShowProfileModal(false)} />
      )}

      {/* ── Mobile top navbar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-lg border border-indigo-500/30">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">Mockly AI</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 bg-white/5 rounded-xl border border-white/10 text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={closeMobileMenu} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed md:relative z-[70] w-72 flex flex-col
        bg-[#0a0a0a]/95 md:bg-white/[0.03] backdrop-blur-3xl border-r border-white/10
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} style={{ height: '100dvh' }}>
        <div className="flex items-center justify-between p-5 mb-2 md:mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Bot className="w-6 h-6 text-indigo-400" />
            </div>
            <span className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
              Mockly AI
            </span>
          </div>
          <button className="md:hidden p-2 text-slate-400 hover:text-white" onClick={closeMobileMenu}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navLinks.map((link) => {
            const Icon         = link.icon;
            const isActive     = pathname === link.href;
            const isLeaderboard = link.name === 'Leaderboard';
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={closeMobileMenu}
                className={`group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive && isLeaderboard
                    ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/5 text-orange-300 border border-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.1)]'
                    : isActive
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent text-indigo-300 border border-indigo-500/20'
                    : isLeaderboard
                    ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 border border-orange-500/10 hover:border-orange-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${
                    isLeaderboard
                      ? (isActive ? 'text-orange-400' : 'text-orange-400/80')
                      : isActive ? 'text-indigo-400' : 'group-hover:text-indigo-300'
                  }`} />
                  <span className="font-medium text-sm">{link.name}</span>
                  {isLeaderboard && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white bg-gradient-to-r from-orange-500 to-amber-400 shadow-[0_0_12px_rgba(249,115,22,0.6)] border border-orange-400/30">
                      HOT 🔥
                    </span>
                  )}
                </div>
                {isActive && (
                  <div className={`w-1.5 h-1.5 rounded-full ${isLeaderboard ? 'bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.8)]' : 'bg-indigo-400'}`} />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="group flex items-center gap-3 text-slate-400 hover:text-red-400 w-full px-4 py-3 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ──
          Interview room: overflow-hidden (card handles its own scroll)
          All other pages: overflow-y-auto (natural page scroll)
      ── */}
      <main
        className={`flex-1 relative z-10 overflow-x-hidden flex flex-col pt-14 md:pt-0 ${
          isInterviewRoom ? 'overflow-hidden' : 'overflow-y-auto'
        }`}
        style={{ height: '100dvh' }}
      >
        {isInterviewRoom ? (
          /* Interview room: full-height, no padding, children fill everything */
          <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-3 md:p-6">
            {children}
          </div>
        ) : (
          /* Other pages: normal scrollable layout with padding */
          <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 md:p-10 pb-24 space-y-6 md:space-y-8">
            {children}
          </div>
        )}
      </main>
    </div>
  );
}
