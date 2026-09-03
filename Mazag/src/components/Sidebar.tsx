import React, { useState, createContext } from 'react';
import { getAvatarUrl } from '../components/Avatar';

// تعريف الـ Context هنا عشان الـ SidebarItem يستوردها
export const SidebarContext = createContext<{ expanded: boolean }>({ expanded: true });

interface SidebarProps {
    children: React.ReactNode;
    userName?: string;
    onLogout?: () => void;
    isDarkMode?: boolean;
    avatarUrl?: string;
    // تتحكم في ظهور الـ Sidebar كـ drawer على الموبايل فقط
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
    const resolvedAvatar = avatarUrl || getAvatarUrl(userName);

    return (
        <>
            {/* خلفية سودة شفافة تظهر بس على الموبايل لما الـ Sidebar يكون مفتوح */}
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

                        {/* زرار الطي/الفتح - على الديسكتوب بس */}
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

                        {/* زرار القفل - على الموبايل بس */}
                        <button
                            onClick={onMobileClose}
                            className='md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-teal-400 transition-all border border-white/5 cursor-pointer'
                            title="قفل القائمة"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                    </div> 

                    {/* Navigation Items Container */}
                    <SidebarContext.Provider value={{ expanded }}> 
                        <ul className='flex-1 px-3 py-4 w-full flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-180px)]'>
                            {children}
                        </ul>
                    </SidebarContext.Provider> 

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