import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface MazagLoginProps {
  // Optional: Chat.tsx listens to Firebase's onAuthStateChanged directly,
  // so this callback is not required, but kept for flexibility.
  onLoginSuccess?: (name: string) => void;
}

const MazagLogin: React.FC<MazagLoginProps> = ({ onLoginSuccess }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  // States للبيانات المدخلة
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (activeTab === 'signup') {
        // إنشاء حساب حقيقي في Firebase Auth
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const displayName = name.trim() || email.split('@')[0];
        await updateProfile(cred.user, { displayName });

        // حفظ بيانات المستخدم في Firestore، الـ doc id = uid عشان يفضل فريد وآمن
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: displayName,
          email,
          lastSeen: new Date(),
          status: 'online',
        });

        onLoginSuccess?.(displayName);
      } else {
        // تسجيل دخول حقيقي بالباسورد، مش بس كتابة اسم
        const cred = await signInWithEmailAndPassword(auth, email, password);

        await setDoc(
          doc(db, 'users', cred.user.uid),
          { lastSeen: new Date(), status: 'online' },
          { merge: true } // عشان ميمسحش بيانات المستخدم القديمة
        );

        onLoginSuccess?.(cred.user.displayName || email.split('@')[0]);
      }
    } catch (err: any) {
      // رسائل خطأ مفهومة بدل ما الفورم يفضل ساكت لو حصل error
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') setError('الإيميل ده مستخدم قبل كده');
      else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') setError('الإيميل أو كلمة المرور غلط');
      else if (code === 'auth/weak-password') setError('كلمة المرور لازم تكون 6 حروف على الأقل');
      else if (code === 'auth/user-not-found') setError('مفيش حساب بالإيميل ده');
      else setError('حصل خطأ، حاول تاني');
      console.error('Auth error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center relative overflow-hidden transition-colors duration-700 ${isDarkMode ? 'bg-[#0a0a0c] text-gray-100' : 'bg-[#f4f4f6] text-gray-900'}`}>
      
      {/* خلفية متحركة */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-pulse ${isDarkMode ? 'bg-teal-600' : 'bg-teal-400'}`}></div>
        <div className={`absolute top-1/2 -right-20 w-96 h-96 rounded-full mix-blend-multiply filter blur-[140px] opacity-30 ${isDarkMode ? 'bg-purple-600' : 'bg-pink-300'}`}></div>
        <div className={`absolute -bottom-32 left-1/3 w-96 h-96 rounded-full mix-blend-multiply filter blur-[130px] opacity-30 ${isDarkMode ? 'bg-indigo-700' : 'bg-blue-300'}`}></div>
      </div>

      {/* زرار تبديل الثيم */}
      <button 
        onClick={() => setIsDarkMode(!isDarkMode)}
        className={`absolute top-6 right-6 z-20 p-3 rounded-full backdrop-blur-md border transition-all duration-300 transform hover:scale-110 shadow-lg ${isDarkMode ? 'bg-white/10 border-white/20 text-yellow-400 hover:bg-white/20' : 'bg-black/5 border-black/10 text-purple-600 hover:bg-black/10'}`}
        title="تغيير النمط"
      >
        {isDarkMode ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        )}
      </button>

      {/* الكارت الرئيسي */}
      <div className={`relative z-10 w-full max-w-md p-8 sm:p-10 rounded-3xl backdrop-blur-2xl border shadow-2xl transition-all duration-500 ${isDarkMode ? 'bg-white/[0.03] border-white/10 shadow-teal-950/30' : 'bg-white/70 border-white/60 shadow-xl'}`}>
        
        <div className="flex flex-col items-center mb-8">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg transform hover:rotate-6 transition-transform duration-300 ${isDarkMode ? 'bg-gradient-to-tr from-teal-500 to-indigo-600 text-white shadow-teal-500/30' : 'bg-gradient-to-tr from-teal-400 to-indigo-500 text-white shadow-indigo-500/20'}`}>
            <span className="text-2xl font-black tracking-tighter">M~</span>
          </div>
          <h1 className="text-3xl font-bold tracking-wider">Mazag</h1>
          <p className={`text-xs mt-1 tracking-widest uppercase ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>عالمك الخاص..بعيد عن زحمة السوشيال</p>
        </div>

        <div className={`flex p-1 rounded-2xl mb-8 border ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-gray-200/60 border-gray-300/50'}`}>
          <button 
            type="button"
            onClick={() => { setActiveTab('login'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${activeTab === 'login' ? (isDarkMode ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/20' : 'bg-white text-teal-600 shadow-md') : 'text-gray-400 hover:text-gray-200'}`}
          >
            تسجيل الدخول
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('signup'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${activeTab === 'signup' ? (isDarkMode ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/20' : 'bg-white text-teal-600 shadow-md') : 'text-gray-400 hover:text-gray-200'}`}
          >
            حساب جديد
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          {/* الاسم مطلوب بس وقت إنشاء حساب جديد */}
          {activeTab === 'signup' && (
            <div>
              <label className="block text-xs font-medium mb-1.5 opacity-80">الاسم بالكامل</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="يوسف صبحي"
                required
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10 focus:border-teal-400 focus:bg-white/10 text-white' : 'bg-white/80 border-gray-200 focus:border-teal-500 focus:bg-white text-gray-900'}`}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-80">البريد الإلكتروني</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10 focus:border-teal-400 focus:bg-white/10 text-white' : 'bg-white/80 border-gray-200 focus:border-teal-500 focus:bg-white text-gray-900'}`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-80">كلمة المرور</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10 focus:border-teal-400 focus:bg-white/10 text-white' : 'bg-white/80 border-gray-200 focus:border-teal-500 focus:bg-white text-gray-900'}`}
            />
          </div>

          {/* خيارات حالة المزاج (Radio Buttons) - شكلية فقط حاليًا */}
          <div className="space-y-2 mt-4">
            <label className="block text-xs font-medium opacity-80">اختر حالة المزاج:</label>
            <div className="flex items-center space-x-6 text-xs text-gray-300">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="moodType" value="chill" className="accent-teal-500 cursor-pointer" defaultChecked />
                <span>روقان 🌿</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="moodType" value="deep" className="accent-teal-500 cursor-pointer" />
                <span>ديب مود 🌌</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="moodType" value="energy" className="accent-teal-500 cursor-pointer" />
                <span>عالي ⚡</span>
              </label>
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center space-x-2 text-xs cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-orange-400 cursor-pointer" />
              <span>تذكرني لاحقاً</span>
            </label>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className={`w-full mt-2 py-3.5 rounded-xl font-bold tracking-wide transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 shadow-xl cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${isDarkMode ? 'bg-gradient-to-r from-pink-500 to-orange-400 text-white hover:shadow-pink-500/30' : 'bg-gradient-to-r from-emerald-400 to-cyan-500 text-black hover:shadow-cyan-500/30'}`}
          >
            {isSubmitting ? 'جاري التحميل...' : activeTab === 'login' ? 'ابدأ المزاج 🚀' : 'انضم إلينا الآن ✨'}
          </button>
        </form>

      </div>

    </div>
  );
};

export default MazagLogin;