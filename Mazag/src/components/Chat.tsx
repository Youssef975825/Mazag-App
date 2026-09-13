import React, { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp,
  doc, setDoc, writeBatch, documentId,
} from 'firebase/firestore';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { db, auth } from '../firebase';
import Sidebar from './Sidebar';       // استدعاء ملف الـ Sidebar
import SidebarItem from '../components/SidebarItems'; // استدعاء ملف الـ SidebarItem
import Login from './Login';           // شاشة الدخول الحقيقية (Firebase Auth)
import { getAvatarUrl } from '../components/Avatar';

const getChatRoomId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join('_');
};

// مستند الـ Firestore الواحد محدود بـ 1 ميجا، وbase64 بيكبّر الحجم ~33%،
// فبنحط حد أقل من كده بكتير عشان نسيب مساحة لباقي حقول المستند.
const MAX_FILE_SIZE = 700 * 1024; // 700 كيلوبايت قبل التحويل لـ base64
const MAX_RECORDING_SECONDS = 60; // حد أقصى لطول الرسالة الصوتية
const TYPING_TIMEOUT_MS = 2000;   // نعتبر اليوزر بطّل يكتب لو سكت أكتر من ثانيتين

const fileToBase64 = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // حالة إرفاق الملفات (base64، مفيش رفع حقيقي فمفيش نسبة تقدم فعلية)
  const [isAttaching, setIsAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // حالة التسجيل الصوتي
  const [isRecording, setIsRecording] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // مؤشر الكتابة
  const [friendIsTyping, setFriendIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // تتبع الرسائل اللي "شفناها" قبل كده عشان نعرف إيه اللي جديد فعلاً (لإشعارات المتصفح)
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const isFirstSnapshotRef = useRef(true);

  // متابعة حالة تسجيل الدخول الحقيقية من Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // طلب إذن إشعارات المتصفح أول ما اليوزر يسجل دخول
  useEffect(() => {
    if (!currentUser) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [currentUser]);

  // لو اليوزر اتغيّر (logout ثم login بحساب تاني في نفس الجلسة)، نصفّر
  // حالة الشات القديمة عشان مايحصلش تداخل بين بيانات الحسابين
  useEffect(() => {
    setActiveFriend(null);
    setMessages([]);
    setInputText('');
  }, [currentUser?.uid]);

  // 1) نجيب uids بتوع "أصدقائي الحقيقيين" بس: أي friendRequest حالتها accepted
  // وأنا طرف فيها (سواء كنت المرسل أو المستقبل)
  const [friendUids, setFriendUids] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setFriendUids([]);
      return;
    }

    const sentQ = query(
      collection(db, "friendRequests"),
      where("senderId", "==", currentUser.uid),
      where("status", "==", "accepted")
    );
    const receivedQ = query(
      collection(db, "friendRequests"),
      where("receiverId", "==", currentUser.uid),
      where("status", "==", "accepted")
    );

    let sentUids: string[] = [];
    let receivedUids: string[] = [];

    const recompute = () => {
      setFriendUids(Array.from(new Set([...sentUids, ...receivedUids])));
    };

    const unsubSent = onSnapshot(sentQ, (snap) => {
      sentUids = snap.docs.map((d) => d.data().receiverId);
      recompute();
    });
    const unsubReceived = onSnapshot(receivedQ, (snap) => {
      receivedUids = snap.docs.map((d) => d.data().senderId);
      recompute();
    });

    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [currentUser]);

  // 2) نجيب بيانات البروفايل (اسم/أفاتار/حالة) بتاعة الأصدقاء دول بس - مقسّمة
  // على دفعات 10 بسبب حد استعلام "in" في Firestore
  useEffect(() => {
    if (!currentUser || friendUids.length === 0) {
      setFriendsList([]);
      setActiveFriend(null);
      return;
    }

    const chunks: string[][] = [];
    for (let i = 0; i < friendUids.length; i += 10) {
      chunks.push(friendUids.slice(i, i + 10));
    }

    const chunkResults: Record<number, any[]> = {};

    const unsubscribes = chunks.map((chunk, index) =>
      onSnapshot(query(collection(db, "users"), where(documentId(), "in", chunk)), (snap) => {
        chunkResults[index] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            name: data.name,
            avatar: data.avatar || getAvatarUrl(data.name, data.gender),
            status: data.status || 'online',
          };
        });
        const merged = Object.values(chunkResults).flat();
        setFriendsList(merged);
        setActiveFriend((curr: any) =>
          curr && merged.some((f) => f.uid === curr.uid) ? curr : (merged[0] ?? null)
        );
      })
    );

    return () => unsubscribes.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, friendUids.join(',')]);

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

  // كل ما نبدّل صاحب، نصفّر تتبع الإشعارات عشان مانبعتش إشعار لرسائل قديمة
  useEffect(() => {
    seenMessageIdsRef.current = new Set();
    isFirstSnapshotRef.current = true;
  }, [activeFriend?.uid]);

  // إشعارات المتصفح للرسائل الجديدة اللي وصلت والتاب مش مركّز عليه
  useEffect(() => {
    if (!currentUser || !activeFriend) return;

    if (isFirstSnapshotRef.current) {
      // أول تحميل للمحادثة - نسجل الرسائل الموجودة من غير إشعارات
      messages.forEach((m) => seenMessageIdsRef.current.add(m.id));
      isFirstSnapshotRef.current = false;
      return;
    }

    messages.forEach((m) => {
      if (seenMessageIdsRef.current.has(m.id)) return;
      seenMessageIdsRef.current.add(m.id);

      if (m.sender === currentUser.uid) return; // رسالتي أنا، مفيش داعي لإشعار
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      if (!document.hidden) return; // التاب مفتوح وباين، مفيش داعي نزعجه بإشعار

      const bodyText =
        m.type === 'image' ? '📷 صورة' :
        m.type === 'file' ? `📎 ${m.fileName || 'ملف'}` :
        m.type === 'audio' ? '🎙️ رسالة صوتية' :
        (m.text || 'رسالة جديدة');

      try {
        const notif = new Notification(`رسالة جديدة من ${m.senderName || activeFriend.name}`, {
          body: bodyText,
          icon: activeFriend.avatar,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (error) {
        console.error('Notification error:', error);
      }
    });
  }, [messages, currentUser, activeFriend]);

  // علامتين القراءة: أول ما نفتح المحادثة، نعلّم كل الرسائل الواردة الغير مقروءة كمقروءة
  useEffect(() => {
    if (!currentUser || !activeFriend || messages.length === 0) return;
    const unreadIncoming = messages.filter((m) => m.sender !== currentUser.uid && m.read !== true);
    if (unreadIncoming.length === 0) return;

    const roomId = getChatRoomId(currentUser.uid, activeFriend.uid);
    const batch = writeBatch(db);
    unreadIncoming.forEach((m) => {
      batch.update(doc(db, "chats", roomId, "messages", m.id), { read: true });
    });
    batch.commit().catch((error) => console.error('Error marking messages as read:', error));
  }, [messages, currentUser, activeFriend]);

  // الاستماع لحالة "بيكتب دلوقتي" بتاعة الصديق المختار
  useEffect(() => {
    if (!currentUser || !activeFriend) {
      setFriendIsTyping(false);
      return;
    }
    const roomId = getChatRoomId(currentUser.uid, activeFriend.uid);
    const typingRef = doc(db, "chats", roomId, "typing", activeFriend.uid);
    const unsubscribe = onSnapshot(typingRef, (snap) => {
      setFriendIsTyping(!!snap.data()?.isTyping);
    });
    return () => unsubscribe();
  }, [activeFriend, currentUser]);

  // تنظيف تايمرات التسجيل الصوتي والكتابة لو الكومبوننت اتشال
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

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
  const myAvatar = currentUser.photoURL || getAvatarUrl(currentUsername, 'male');

  const handleSelectFriend = (friend: any) => {
    setActiveFriend(friend);
    setIsMobileSidebarOpen(false); // نقفل الـ drawer أوتوماتيك بعد الاختيار على الموبايل
  };

  // تحديث حالة "بيكتب دلوقتي" بتاعتي في Firestore
  const setTypingStatus = async (isTyping: boolean, friend = activeFriend) => {
    if (!friend || !currentUser) return;
    const roomId = getChatRoomId(currentUser.uid, friend.uid);
    try {
      await setDoc(doc(db, "chats", roomId, "typing", currentUser.uid), {
        isTyping,
        name: currentUsername,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Typing status error:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    setTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false);
    }, TYPING_TIMEOUT_MS);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (!activeFriend) {
      alert('اختار صديق الأول من القايمة عشان تقدر تبعتله رسالة 🌿');
      return;
    }
    const textToSend = inputText;
    setInputText('');

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTypingStatus(false);

    const roomId = getChatRoomId(currentUser.uid, activeFriend.uid);

    try {
      await addDoc(collection(db, "chats", roomId, "messages"), {
        sender: currentUser.uid,
        senderName: currentUsername,
        type: 'text',
        text: textToSend,
        read: false,
        createdAt: serverTimestamp(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } catch (error) {
      console.error("Error sending message: ", error);
      setInputText(textToSend);
    }
  };

  // إرسال ملف (صورة أو مستند) بتحويله لـ base64 وتخزينه مباشرة في المستند
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // عشان يسمح باختيار نفس الملف تاني لو حصل خطأ
    if (!file || !activeFriend || !currentUser) return;

    if (file.size > MAX_FILE_SIZE) {
      alert(`حجم الملف أكبر من ${Math.round(MAX_FILE_SIZE / 1024)} كيلوبايت. اختار ملف أصغر (بما إننا مش بنستخدم تخزين سحابي منفصل حاليًا).`);
      return;
    }

    setIsAttaching(true);
    try {
      const base64 = await fileToBase64(file);
      const roomId = getChatRoomId(currentUser.uid, activeFriend.uid);
      const isImage = file.type.startsWith('image/');
      await addDoc(collection(db, "chats", roomId, "messages"), {
        sender: currentUser.uid,
        senderName: currentUsername,
        type: isImage ? 'image' : 'file',
        fileData: base64,
        fileName: file.name,
        fileType: file.type,
        read: false,
        createdAt: serverTimestamp(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } catch (error) {
      console.error('Error attaching file:', error);
      alert('حصل خطأ أثناء إرفاق الملف، حاول تاني');
    } finally {
      setIsAttaching(false);
    }
  };

  // بدء التسجيل الصوتي - بجودة منخفضة عشان الحجم يفضل صغير كفاية للتخزين في Firestore
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : undefined;

      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 16000, // بيتريت منخفض يخلي حجم الملف صغير جدًا
      });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            // وصلنا للحد الأقصى - نوقف ونبعت أوتوماتيك
            stopAndSendRecording();
          }
          return next;
        });
      }, 1000);
    } catch (error) {
      console.error('Mic permission error:', error);
      alert('محتاجين إذن الميكروفون عشان تقدر تسجل رسالة صوتية');
    }
  };

  // إلغاء التسجيل من غير إرسال
  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.stream.getTracks().forEach((t) => t.stop());
      if (recorder.state !== 'inactive') recorder.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // إيقاف التسجيل وإرسال الرسالة الصوتية كـ base64
  const stopAndSendRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive' || !activeFriend || !currentUser) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    const durationSeconds = recordingSeconds;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve();
      };
      recorder.stop();
    });

    setIsRecording(false);
    setRecordingSeconds(0);
    mediaRecorderRef.current = null;

    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = [];

    if (blob.size === 0) return; // تسجيل فاضي (مثلاً وقف بسرعة جدًا)

    if (blob.size > MAX_FILE_SIZE) {
      alert('التسجيل الصوتي طويل أوي، جرب رسالة أقصر');
      return;
    }

    setIsSendingVoice(true);
    try {
      const base64 = await fileToBase64(blob);
      const roomId = getChatRoomId(currentUser.uid, activeFriend.uid);
      await addDoc(collection(db, "chats", roomId, "messages"), {
        sender: currentUser.uid,
        senderName: currentUsername,
        type: 'audio',
        fileData: base64,
        duration: durationSeconds,
        read: false,
        createdAt: serverTimestamp(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } catch (error) {
      console.error('Voice message error:', error);
      alert('حصل خطأ أثناء إرسال الرسالة الصوتية');
    } finally {
      setIsSendingVoice(false);
    }
  };

  const formatDuration = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleLogout = async () => {
    try {
      // نسجل إن اليوزر بقى offline قبل ما نعمل logout، ونصفّر حالة الكتابة
      await setDoc(doc(db, "users", currentUser.uid), { status: 'offline' }, { merge: true });
      if (activeFriend) await setTypingStatus(false, activeFriend);
    } catch (error) {
      console.error("Error updating status on logout:", error);
    }
    await signOut(auth);
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-[#0a0a0c] text-gray-100' : 'bg-[#f4f4f6] text-gray-900'}`}>
      
      {/* استخدام الـ Sidebar مع تمرير حالة الثيم + حالة الـ drawer على الموبايل */}
      <Sidebar 
        userName={currentUsername}
        isDarkMode={isDarkMode}
        avatarUrl={myAvatar}
        onLogout={handleLogout}
        mobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
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
        {friendsList.length === 0 && (
          <div className={`px-3 py-4 text-center text-[11px] leading-relaxed ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            لسه معندكش أصحاب هنا 🌿
            <br />
            ابعت طلب صداقة بالإيميل من تحت
          </div>
        )}
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
      <div className={`flex-1 flex flex-col justify-between min-w-0 ${isDarkMode ? 'bg-[#0a0a0c]' : 'bg-white'}`}>
        <div className={`p-3 sm:p-4 border-b flex items-center gap-3 ${isDarkMode ? 'border-white/10 bg-black/20 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-900'}`}>
          {/* زرار القائمة - يظهر على الموبايل بس */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-teal-400 border border-white/5 flex-shrink-0"
            title="القائمة"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>

          {activeFriend ? (
            <div className="flex items-center gap-3 min-w-0">
              <img src={activeFriend.avatar} alt={activeFriend.name} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-teal-500/30 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base truncate">{activeFriend.name}</h3>
                {friendIsTyping ? (
                  <span className="text-[11px] sm:text-xs text-teal-400 animate-pulse block">
                    {activeFriend.name} بيكتب دلوقتي...
                  </span>
                ) : (
                  <span className="text-[11px] sm:text-xs text-teal-500 hidden sm:block">عالمك الخاص.. بعيد عن زحمة السوشيال</span>
                )}
              </div>
            </div>
          ) : (
            <div className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>اختر صديقاً للبدء</div>
          )}
        </div>

        <div className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4">
          {messages.map((msg) => {
            const isMe = msg.sender === currentUser.uid;
            return (
              <div key={msg.id} className={`flex items-end space-x-2 space-x-reverse ${isMe ? 'justify-start' : 'justify-end'}`}>
                {isMe && <img src={myAvatar} alt="me" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full mb-1 border border-teal-500/30 flex-shrink-0" />}
                <div className={`max-w-[80%] sm:max-w-xs md:max-w-md p-3 sm:p-4 rounded-3xl text-sm shadow-md ${
                  isMe 
                    ? 'bg-teal-600 text-white rounded-br-none' 
                    : isDarkMode 
                      ? 'bg-white/10 text-gray-100 rounded-bl-none' 
                      : 'bg-gray-100 text-gray-800 border border-gray-200 rounded-bl-none'
                }`}>
                  {msg.type === 'image' && msg.fileData && (
                    <a href={msg.fileData} download={msg.fileName || 'image.jpg'} target="_blank" rel="noreferrer">
                      <img src={msg.fileData} alt={msg.fileName || 'صورة'} className="max-w-full max-h-64 rounded-2xl mb-1 object-cover" />
                    </a>
                  )}

                  {msg.type === 'file' && msg.fileData && (
                    <a
                      href={msg.fileData}
                      download={msg.fileName || 'file'}
                      className={`flex items-center gap-2 underline break-all ${isMe ? '' : 'text-teal-500'}`}
                    >
                      <span>📎</span>
                      <span className="truncate">{msg.fileName || 'ملف مرفق'}</span>
                    </a>
                  )}

                  {msg.type === 'audio' && msg.fileData && (
                    <div className="flex flex-col gap-1">
                      <audio controls src={msg.fileData} className="max-w-[220px] h-10" />
                      {typeof msg.duration === 'number' && (
                        <span className="text-[10px] opacity-70">{formatDuration(msg.duration)}</span>
                      )}
                    </div>
                  )}

                  {(!msg.type || msg.type === 'text') && (
                    <p className="break-words">{msg.text}</p>
                  )}

                  <span className="text-[10px] flex items-center gap-1 mt-1 opacity-70">
                    {msg.time || 'الآن'}
                    {isMe && (
                      <span className={msg.read ? 'text-sky-300 opacity-100' : ''}>
                        {msg.read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}

          {/* مؤشر بسيط وقت تجهيز الملف / الصوت (base64 مش عندها progress حقيقي) */}
          {(isAttaching || isSendingVoice) && (
            <div className="flex items-end space-x-2 space-x-reverse justify-start">
              <div className="max-w-[80%] sm:max-w-xs p-3 rounded-3xl text-sm shadow-md bg-teal-600/60 text-white rounded-br-none animate-pulse">
                {isAttaching ? '📤 جاري إرفاق الملف...' : '🎙️ جاري إرسال الرسالة الصوتية...'}
              </div>
            </div>
          )}
        </div>

        {/* شريط إدخال الرسائل، أو شريط التسجيل الصوتي بدل منه لما يكون شغال */}
        {isRecording ? (
          <div className={`p-3 sm:p-4 border-t flex items-center gap-3 ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-red-400 flex-shrink-0"
              title="إلغاء"
            >
              ✕
            </button>
            <div className="flex-1 flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}>
                بيسجل... {formatDuration(recordingSeconds)} / {formatDuration(MAX_RECORDING_SECONDS)}
              </span>
            </div>
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-indigo-600 text-white font-bold text-sm shadow-lg flex-shrink-0"
            >
              إرسال 🚀
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className={`p-3 sm:p-4 border-t flex items-center gap-2 sm:gap-3 ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!activeFriend || isAttaching || isSendingVoice}
              className="p-2.5 sm:p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-teal-400 border border-white/5 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="إرفاق ملف (حد أقصى 700 كيلوبايت)"
            >
              📎
            </button>

            <input 
              type="text"
              value={inputText}
              onChange={handleInputChange}
              disabled={!activeFriend}
              placeholder={activeFriend ? "اكتب رسالتك في روقان... 🌿" : "اختار صديق الأول من القايمة..."}
              className={`flex-1 min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl border text-sm outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-white focus:border-teal-400' 
                  : 'bg-white border-gray-300 text-gray-900 focus:border-teal-500 shadow-sm'
              }`}
            />

            {inputText.trim() ? (
              <button type="submit" className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-indigo-600 text-white font-bold text-sm shadow-lg hover:opacity-95 transition flex-shrink-0">
                إرسال 🚀
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={!activeFriend || isSendingVoice}
                className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-teal-500 to-indigo-600 text-white flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                title="تسجيل رسالة صوتية"
              >
                🎙️
              </button>
            )}
          </form>
        )}
      </div>

    </div>
  );
}