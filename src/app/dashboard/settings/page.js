'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Camera, Save, LogOut, Loader2, User, Building2 } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [displayName, setDisplayName] = useState('');
  const [institute, setInstitute] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Fetch user from db
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          setDisplayName(data.displayName || user.displayName || '');
          setInstitute(data.institute || '');
          setPhotoURL(data.photoURL || user.photoURL || '');
        } else {
          // If no doc exists but google auth has data, prepopulate
          setDisplayName(user.displayName || '');
          setPhotoURL(user.photoURL || '');
        }
      } else {
        router.push('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Compress image helper using Canvas to bypass Storage permission issues and keep Firestore fast
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400; // max width/height for avatar
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Output compressed Base64 string (0.8 quality jpeg)
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // 2MB Limit
    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large. Please select an image under 2MB.');
      return;
    }

    setUploadingImage(true);
    try {
      // Compress first to save storage space and bandwidth
      const base64Data = await compressImage(file);
      
      // Convert base64 back to blob for robust Firebase Storage upload
      const fetchResponse = await fetch(base64Data);
      const blob = await fetchResponse.blob();
      
      // Upload to Firebase Storage
      const storageRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}.jpg`);
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setPhotoURL(downloadURL);
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('Failed to upload image. Please check if Firebase Storage is enabled and rules allow write access.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        displayName: displayName.trim(),
        institute: institute.trim(),
        photoURL: photoURL,
        email: currentUser.email,
        updatedAt: new Date()
      }, { merge: true });
      
      alert('Profile updated successfully! It will now appear on the Leaderboard.');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    if(confirm('Are you sure you want to sign out?')) {
      try {
        await signOut(auth);
        router.push('/');
      } catch (error) {
        console.error("Sign out failed", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
          Account <span className="text-indigo-400">Settings</span>
        </h1>
        <p className="text-slate-400 text-lg">Manage your public profile for the Leaderboard.</p>
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 md:p-12 backdrop-blur-xl space-y-12">
        
        {/* Profile Picture Section */}
        <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-indigo-500/20 bg-slate-900 group-hover:border-indigo-500/50 transition-all relative flex items-center justify-center">
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-slate-600" />
              )}
              
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingImage ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : (
                  <Camera className="w-8 h-8 text-white" />
                )}
              </div>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              className="hidden" 
            />
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-white">Profile Avatar</h3>
            <p className="text-slate-400 mt-1 max-w-sm text-sm">Upload a professional headshot to stand out on the Hall of Fame. Max size 1MB.</p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-8 max-w-2xl border-t border-white/5 pt-10">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1 flex items-center space-x-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Full Name</span>
            </label>
            <input 
              type="text" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
              placeholder="e.g. Jane Doe"
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-5 py-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-white shadow-inner"
            />
            <p className="text-xs text-slate-500 ml-2 mt-1">This name will be publicly visible on the Leaderboard.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>Institute / University Name</span>
            </label>
            <input 
              type="text" 
              value={institute} 
              onChange={(e) => setInstitute(e.target.value)} 
              placeholder="e.g. Stanford University"
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-5 py-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-white shadow-inner"
            />
            <p className="text-xs text-slate-500 ml-2 mt-1">Showcase your college to potential recruiters viewing the board.</p>
          </div>
          
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
            <button 
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full sm:w-auto justify-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-8 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all flex items-center space-x-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
            
            <button 
              onClick={handleSignOut}
              className="w-full sm:w-auto justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-6 py-4 rounded-xl transition-colors flex items-center space-x-2"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
