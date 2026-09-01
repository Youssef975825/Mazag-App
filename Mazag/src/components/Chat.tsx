import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Sidebar from './Sidebar';       // استدعاء ملف الـ Sidebar
import SidebarItem from '../components/SidebarItems'; // استدعاء ملف الـ SidebarItem

const getChatRoomId = (user1: string, user2: string) => {
  return [user1, user2].sort().join('_');
};

export default function Chat() {
  const [currentUsername, setCurrentUsername] = useState<string>(() => {
    return localStorage.getItem('mazag_user') || '';
  });
  
  const [tempUsername, setTempUsername] = useState('');
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [activeFriend, setActiveFriend] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // دالة تسجيل الدخول لو الاسم مش موجود
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUsername.trim()) return;
    const username = tempUsername.trim();
    localStorage.setItem('mazag_user', username);
    setCurrentUsername(username);
    try {
      await setDoc(doc(db, "users", username), {
        name: username,
        lastSeen: new Date(),
        status: "online"
      }, { merge: true });
    } catch (error) {
      console.error("Error saving user:", error);
    }
  };

  if (!currentUsername) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0c] text-gray-100">
        <form onSubmit={handleLogin} className="p-8 rounded-3xl bg-black/40 border border-white/10 w-96 space-y-4 shadow-2xl">
          <h2 className="text-2xl font-bold text-center text-teal-400">مرحباً بك في Mazag 🌿</h2>
          <input 
            type="text"
            value={tempUsername}
            onChange={(e) => setTempUsername(e.target.value)}
            placeholder="اكتب اسمك هنا..."
            className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white focus:border-teal-400 outline-none text-sm"
          />
          <button type="submit" className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-indigo-600 font-bold text-sm text-white">
            دخول للعالم الخاص 🚀
          </button>
        </form>
      </div>
    );
  }

  // جلب الأصدقاء
  useEffect(() => {
    const q = collection(db, "users");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: any[] = [];
      snapshot.forEach((document) => {
        const userData = document.data();
        if (userData.name !== currentUsername) {
          users.push({
            id: document.id,
            name: userData.name,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`,
            status: userData.status || 'online'
          });
        }
      });
      setFriendsList(users);
      if (users.length > 0 && !activeFriend) {
        setActiveFriend(users[0]);
      }
    });
    return () => unsubscribe();
  }, [currentUsername]);

  const handleSelectFriend = (friend: any) => {
    setActiveFriend(friend);
    localStorage.setItem('mazag_active_friend', JSON.stringify(friend));
  };

  // جلب الرسائل
  useEffect(() => {
    if (!activeFriend) return;
    const roomId = getChatRoomId(currentUsername, activeFriend.name);
    const q = query(collection(db, "chats", roomId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages: any[] = [];
      snapshot.forEach((docSnap) => {
        loadedMessages.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMessages(loadedMessages);
    });
    return () => unsubscribe();
  }, [activeFriend, currentUsername]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeFriend) return;
    const textToSend = inputText;
    setInputText('');
    const roomId = getChatRoomId(currentUsername, activeFriend.name);
    try {
      await addDoc(collection(db, "chats", roomId, "messages"), {
        sender: currentUsername,
        text: textToSend,
        createdAt: serverTimestamp(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } catch (error) {
      console.error("Error sending message: ", error);
      setInputText(textToSend);
    }
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-[#0a0a0c] text-gray-100' : 'bg-[#f4f4f6] text-gray-900'}`}>
      
      {/* استخدام الـ Sidebar مع تمرير حالة الثيم */}
      <Sidebar 
        userName={currentUsername}
        isDarkMode={isDarkMode}
        onLogout={() => {
          localStorage.removeItem('mazag_user');
          localStorage.removeItem('mazag_active_friend');
          window.location.reload();
        }}
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
            key={friend.id}
            onClick={() => handleSelectFriend(friend)}
            className={`flex items-center space-x-3 space-x-reverse p-2.5 my-1 rounded-xl cursor-pointer transition-all ${
              activeFriend?.name === friend.name 
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
            const isMe = msg.sender === currentUsername;
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