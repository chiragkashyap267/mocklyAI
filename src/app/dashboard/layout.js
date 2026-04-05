'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, FileText, Activity, Settings, LogOut, Bot, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  const closeMobileMenu = () => {
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'My Resumes', href: '/dashboard/resumes', icon: FileText },
    { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Activity },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-[#0a0a0a] text-white overflow-hidden relative selection:bg-indigo-500/30">
      {/* Background Glow Elements */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-900/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-900/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Mobile Top Navbar */}
      <div className="md:hidden fixed top-0 w-full h-20 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/10 z-50 flex items-center justify-between px-6">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-lg border border-indigo-500/30">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <span className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Mockly AI
          </span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300" 
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar - Glassmorphism style */}
      <aside className={`
        fixed md:relative z-[70] w-72 flex flex-col h-screen 
        bg-[#0a0a0a]/95 md:bg-white/[0.03] backdrop-blur-3xl border-r border-white/10
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Mobile Close Button & Logo */}
        <div className="flex items-center justify-between p-6 mb-2 md:mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Bot className="w-7 h-7 text-indigo-400" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
              Mockly AI
            </span>
          </div>
          <button 
            className="md:hidden p-2 text-slate-400 hover:text-white"
            onClick={closeMobileMenu}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2.5 mt-4">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={closeMobileMenu}
                className={`group flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 ${
                  isActive 
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent text-indigo-300 border border-indigo-500/20 shadow-[inset_0_1px_rgba(255,255,255,0.05)]' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <Icon className={`w-5 h-5 transition-colors duration-200 ${isActive ? 'text-indigo-400' : 'group-hover:text-indigo-300'}`} />
                  <span className="font-medium tracking-wide text-sm">{link.name}</span>
                  {link.name === 'Leaderboard' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest text-white bg-gradient-to-r from-red-500 to-orange-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                      HOT 🔥
                    </span>
                  )}
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_theme(colors.indigo.400)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-5 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="group flex items-center space-x-3.5 text-slate-400 hover:text-red-400 w-full px-4 py-3.5 rounded-xl transition-all duration-200"
          >
            <LogOut className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-1" />
            <span className="font-medium tracking-wide text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      {/* On mobile, add pt-24 so content isn't hidden under the top navbar */}
      <main className="flex-1 relative z-10 h-screen overflow-y-auto overflow-x-hidden pt-24 md:pt-0">
        <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 md:p-12 mb-20 space-y-6 md:space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
}
