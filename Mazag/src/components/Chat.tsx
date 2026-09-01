import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { db, auth } from '../firebase';
import Sidebar from './Sidebar';       // استدعاء ملف الـ Sidebar
import SidebarItem from '../components/SidebarItems'; // استدعاء ملف الـ SidebarItem
import Login from './Login';           // شاشة الدخول الحقيقية (Firebase Auth)

const getChatRoomId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join('_');
};

export default function Chat() {
  // ⚠️ كل الـ hooks لازم تتنادى هنا فوق، من غير أي return شرطي قبلها،
  // عشان React يفضل يستدعي نفس عدد الـ hooks بنفس الترتيب في كل render.
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [activeFriend, setActiveFriend] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // متابعة حالة تسجيل الدخول الحقيقية من Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // جلب الأصدقاء (كل اليوزرز ما عدا أنا)
  useEffect(() => {
    if (!currentUser) return;
    const q = collection(db, "users");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: any[] = [];
      snapshot.forEach((document) => {
        if (document.id !== currentUser.uid) {
          const userData = document.data();
          users.push({
            uid: document.id,
            name: userData.name,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`,
            status: userData.status || 'online'
          });
        }
      });
      setFriendsList(users);
      setActiveFriend((curr: any) => curr ?? (users.length > 0 ? users[0] : null));
    });
    return () => unsubscribe();
  }, [currentUser]);

  // جلب الرسائل
  useEffect(() => {
    if (!currentUser || !activeFriend) return;
    const roomId = getChatRoomId(currentUser.uid, activeFriend.uid);
    const q = query(collection(db, "chats", roomId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages: any[] = [];
      snapshot.forEach((docSnap) => {
        loadedMessages.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMessages(loadedMessages);
    });
    return () => unsubscribe();
  }, [activeFriend, currentUser]);

  // لسه بيتشيك على حالة الدخول (أول تحميل للصفحة) - مانعرضش حاجة عشان منلخبطش الشاشة
  if (!authChecked) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0c] text-teal-400">
        جاري التحميل...
      </div>
    );
  }

  // مفيش يوزر مسجل دخول -> اعرض شاشة الدخول الحقيقية
  if (!currentUser) {
    return <Login />;
  }

  const currentUsername = currentUser.displayName || currentUser.email?.split('@')[0] || 'مستخدم';

  const handleSelectFriend = (friend: any) => {
    setActiveFriend(friend);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeFriend) return;
    const textToSend = inputText;
    setInputText('');
    const roomId = getChatRoomId(currentUser.uid, activeFriend.uid);
    try {
      await addDoc(collection(db, "chats", roomId, "messages"), {
        sender: currentUser.uid,
        senderName: currentUsername,
        text: textToSend,
        createdAt: serverTimestamp(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } catch (error) {
      console.error("Error sending message: ", error);
      setInputText(textToSend);
    }
  };

  const handleLogout = async () => {
    try {
      // نسجل إن اليوزر بقى offline قبل ما نعمل logout
      await setDoc(doc(db, "users", currentUser.uid), { status: 'offline' }, { merge: true });
    } catch (error) {
      console.error("Error updating status on logout:", error);
    }
    await signOut(auth);
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-[#0a0a0c] text-gray-100' : 'bg-[#f4f4f6] text-gray-900'}`}>
      
      {/* استخدام الـ Sidebar مع تمرير حالة الثيم */}
      <Sidebar 
        userName={currentUsername}
        isDarkMode={isDarkMode}
        onLogout={handleLogout}
      >
        <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>التبويبات</div>
        
        <SidebarItem 
          icon={<span className="text-lg">💬</span>} 
          text="المحادثات العامة" 
          active={true} 
        />
        
        <SidebarItem 
          icon={<span className="text-lg">{isDarkMode ? '☀️' : '🌙'}</span>} 
          text={isDarkMode ? 'الوضع الفاتح' : 'الوضع الداكن'} 
          onClick={() => setIsDarkMode(!isDarkMode)}
        />

        <div className={`my-2 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}></div>
        <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>الأصدقاء أونلاين</div>

        {/* عرض الأصدقاء */}
        {friendsList.map((friend) => (
          <div
            key={friend.uid}
            onClick={() => handleSelectFriend(friend)}
            className={`flex items-center space-x-3 space-x-reverse p-2.5 my-1 rounded-xl cursor-pointer transition-all ${
              activeFriend?.uid === friend.uid 
                ? 'bg-teal-500/20 border border-teal-500/30 text-teal-500 font-bold' 
                : isDarkMode ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <img src={friend.avatar} alt={friend.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            <div className="overflow-hidden">
              <h4 className="text-xs truncate">{friend.name}</h4>
              <span className="text-[10px] text-teal-500 block">{friend.status}</span>
            </div>
          </div>
        ))}
      </Sidebar>

      {/* شاشة الشات الرئيسية */}
      <div className={`flex-1 flex flex-col justify-between ${isDarkMode ? 'bg-[#0a0a0c]' : 'bg-white'}`}>
        {activeFriend ? (
          <div className={`p-4 border-b flex items-center space-x-3 space-x-reverse ${isDarkMode ? 'border-white/10 bg-black/20 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-900'}`}>
            <img src={activeFriend.avatar} alt={activeFriend.name} className="w-10 h-10 rounded-full object-cover border border-teal-500/30" />
            <div>
              <h3 className="font-bold">{activeFriend.name}</h3>
              <span className="text-xs text-teal-500">عالمك الخاص.. بعيد عن زحمة السوشيال</span>
            </div>
          </div>
        ) : (
          <div className={`p-4 border-b ${isDarkMode ? 'border-white/10 text-gray-400' : 'border-gray-200 text-gray-500'}`}>اختر صديقاً للبدء</div>
        )}

        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((msg) => {
            const isMe = msg.sender === currentUser.uid;
            return (
              <div key={msg.id} className={`flex items-end space-x-2 space-x-reverse ${isMe ? 'justify-start' : 'justify-end'}`}>
                {isMe && <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUsername}`} alt="me" className="w-8 h-8 rounded-full mb-1 border border-teal-500/30" />}
                <div className={`max-w-xs md:max-w-md p-4 rounded-3xl text-sm shadow-md ${
                  isMe 
                    ? 'bg-teal-600 text-white rounded-br-none' 
                    : isDarkMode 
                      ? 'bg-white/10 text-gray-100 rounded-bl-none' 
                      : 'bg-gray-100 text-gray-800 border border-gray-200 rounded-bl-none'
                }`}>
                  <p className="break-words">{msg.text}</p>
                  <span className="text-[10px] block mt-1 opacity-70">{msg.time || 'الآن'}</span>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSendMessage} className={`p-4 border-t flex items-center space-x-3 space-x-reverse ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="اكتب رسالتك في روقان... 🌿"
            className={`flex-1 px-4 py-3 rounded-2xl border text-sm outline-none transition-all ${
              isDarkMode 
                ? 'bg-white/5 border-white/10 text-white focus:border-teal-400' 
                : 'bg-white border-gray-300 text-gray-900 focus:border-teal-500 shadow-sm'
            }`}
          />
          <button type="submit" className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-indigo-600 text-white font-bold text-sm shadow-lg hover:opacity-95 transition">
            إرسال 🚀
          </button>
        </form>
      </div>

    </div>
  );
}