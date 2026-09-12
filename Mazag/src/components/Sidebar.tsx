import React, { useState, useEffect, createContext } from 'react';
import { getAvatarUrl } from '../components/Avatar';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";

export const SidebarContext = createContext<{ expanded: boolean }>({ expanded: true });

interface SidebarProps {
    children: React.ReactNode;
    userName?: string;
    onLogout?: () => void;
    isDarkMode?: boolean;
    avatarUrl?: string;
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export default function Sidebar({
    children,
    userName = 'مستخدم',
    onLogout,
    isDarkMode = true,
    avatarUrl,
    mobileOpen = false,
    onMobileClose,
}: SidebarProps) {
    const [expanded, setExpanded] = useState(true);
    const resolvedAvatar = avatarUrl || getAvatarUrl(userName, 'sidebar');

    const [friendEmailInput, setFriendEmailInput] = useState('');
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
    const auth = getAuth();

    // جلب طلبات الصداقة الواردة لحظياً
    useEffect(() => {
        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId) return;

        const q = query(
            collection(db, "friendRequests"),
            where("receiverId", "==", currentUserId),
            where("status", "==", "pending")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setIncomingRequests(requests);
        });

        return () => unsubscribe();
    }, [auth]);

    // إرسال طلب صداقة باستخدام البريد الإلكتروني
    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const currentUser = auth.currentUser;
        if (!currentUser || !friendEmailInput.trim()) return;

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", friendEmailInput.trim().toLowerCase()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                alert("لم يتم العثور على مستخدم بهذا البريد الإلكتروني!");
                return;
            }

            const recipientDoc = querySnapshot.docs[0];
            const recipientId = recipientDoc.id;

            if (recipientId === currentUser.uid) {
                alert("لا يمكنك إرسال طلب صداقة لنفسك!");
                return;
            }

            const requestId = `${currentUser.uid}_${recipientId}`;
            await setDoc(doc(db, "friendRequests", requestId), {
                senderId: currentUser.uid,
                senderName: currentUser.displayName || userName,
                receiverId: recipientId,
                status: "pending",
                createdAt: serverTimestamp()
            });

            setFriendEmailInput('');
            alert("تم إرسال طلب الصداقة بنجاح! 🚀");
        } catch (error) {
            console.error("Error sending friend request: ", error);
            alert("حدث خطأ أثناء إرسال الطلب.");
        }
    };

    // قبول طلب الصداقة
    const acceptFriendRequest = async (requestId: string) => {
        try {
            const requestRef = doc(db, "friendRequests", requestId);
            await updateDoc(requestRef, {
                status: "accepted"
            });
        } catch (error) {
            console.error("Error accepting request: ", error);
        }
    };

    return (
        <>
            {mobileOpen && (
                <div
                    onClick={onMobileClose}
                    className="fixed inset-0 bg-black/60 z-30 md:hidden"
                />
            )}

            <aside
                className={`
                    fixed inset-y-0 right-0 z-40 w-72
                    transition-transform duration-300 ease-in-out
                    ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}
                    md:translate-x-0 md:static md:z-20 md:w-fit
                    h-screen select-none
                `}
            >
                <nav className={`h-full flex flex-col border-r shadow-xl transition-all duration-300 ${isDarkMode ? 'bg-[#0a0a0c] text-gray-100 border-white/10' : 'bg-white text-gray-900 border-gray-200'}`}>
                    
                    {/* Logo & Toggle Button */}
                    <div className='p-4 pb-3 flex justify-between items-center gap-4 border-b border-white/5'>
                        <div className={`overflow-hidden transition-all duration-300 flex items-center gap-2 ${expanded ? "w-32 opacity-100" : "w-0 opacity-0"}`}>
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
                                M~
                            </div>
                            <span className="font-bold tracking-wider text-lg">Mazag</span>
                        </div>

                        <button 
                            onClick={() => setExpanded(curr => !curr)} 
                            className='hidden md:block p-2 rounded-xl bg-white/5 hover:bg-white/10 text-teal-400 transition-all border border-white/5 cursor-pointer'
                        >
                            {expanded ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            )}
                        </button>

                        <button
                            onClick={onMobileClose}
                            className='md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-teal-400 transition-all border border-white/5 cursor-pointer'
                            title="قفل القائمة"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                    </div> 

                    {/* Navigation Items Container (الأصدقاء المقبولين فقط) */}
                    <SidebarContext.Provider value={{ expanded }}> 
                        <ul className='flex-1 px-3 py-4 w-full flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-280px)]'>
                            {children}
                        </ul>
                    </SidebarContext.Provider> 

                    {/* قسم إدارة الأصدقاء وطلبات الصداقة */}
                    {expanded && (
                        <div className="px-3 py-2 border-t border-white/10 bg-black/10">
                            <form onSubmit={handleSendRequest} className="mb-2">
                                <label className="block text-[11px] mb-1 text-gray-400">إضافة صديق بالإيميل</label>
                                <div className="flex gap-1">
                                    <input 
                                        type="email" 
                                        placeholder="user@example.com"
                                        value={friendEmailInput}
                                        onChange={(e) => setFriendEmailInput(e.target.value)}
                                        className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-teal-500"
                                    />
                                    <button type="submit" className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-xs rounded text-white font-medium transition cursor-pointer">
                                        إرسال
                                    </button>
                                </div>
                            </form>

                            {/* طلبات الصداقة الواردة */}
                            {incomingRequests.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-[11px] text-teal-400 font-semibold mb-1">الطلبات الواردة ({incomingRequests.length})</p>
                                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                                        {incomingRequests.map((req) => (
                                            <div key={req.id} className="flex items-center justify-between bg-gray-900/90 p-1.5 rounded border border-white/5 text-xs">
                                                <span className="truncate max-w-[90px] text-gray-300" title={req.senderName}>{req.senderName}</span>
                                                <button 
                                                    onClick={() => acceptFriendRequest(req.id)}
                                                    className="px-2 py-0.5 bg-green-600 hover:bg-green-500 rounded text-white text-[11px] font-medium transition cursor-pointer"
                                                >
                                                    قبول
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* User Profile Footer */}
                    <div className='border-t border-white/10 p-3 flex items-center justify-between bg-black/20'>
                        <div className="flex items-center gap-3 overflow-hidden">
                            <img
                               src={resolvedAvatar}
                               alt="Avatar"
                               className='w-9 h-9 rounded-xl object-cover border border-teal-500/30 flex-shrink-0'
                            />
                            <div className={`flex flex-col overflow-hidden transition-all duration-300 ${expanded ? "w-32 opacity-100" : "w-0 opacity-0"}`}>
                                <h4 className={`font-semibold text-xs truncate ${isDarkMode ? 'text-gray-200' : 'text-black'}`}>{userName}</h4>
                                <span className={`text-[10px] truncate ${isDarkMode ? 'text-teal-400' : 'text-teal-900'}`}>Online 🌿</span>
                            </div>     
                        </div>

                        {onLogout && (
                            <button 
                                onClick={onLogout}
                                className="text-red-400 hover:bg-red-500/10 p-2 rounded-xl transition cursor-pointer"
                                title="تسجيل الخروج"
                            >
                                🚪
                            </button>
                        )}
                    </div>

                </nav>
            </aside>
        </>
    );
}