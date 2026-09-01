import React, { useState, createContext } from 'react';

// تعريف الـ Context هنا عشان الـ SidebarItem يستوردها
export const SidebarContext = createContext<{ expanded: boolean }>({ expanded: true });

interface SidebarProps {
    children: React.ReactNode;
    userName?: string;
    onLogout?: () => void;
    isDarkMode?: boolean;
}

export default function Sidebar({ children, userName = 'مستخدم', onLogout, isDarkMode = true }: SidebarProps) {
    const [expanded, setExpended] = useState(true);

    return (
        <aside className='h-screen w-fit select-none z-20'>
            <nav className={`h-full flex flex-col bg-[#0a0a0c] text-gray-100 border-r border-white/10 shadow-xl transition-all duration-300 ${isDarkMode ? 'bg-[#0a0a0c] text-gray-100 border-white/10' : 'bg-white text-gray-900 border-gray-200'}`}>
                
                {/* Logo & Toggle Button */}
                <div className='p-4 pb-3 flex justify-between items-center gap-4 border-b border-white/5'>
                    <div className={`overflow-hidden transition-all duration-300 flex items-center gap-2 ${expanded ? "w-32 opacity-100" : "w-0 opacity-0"}`}>
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
                            M~
                        </div>
                        <span className="font-bold tracking-wider text-lg">Mazag</span>
                    </div>

                    <button 
                        onClick={() => setExpended(curr => !curr)} 
                        className='p-2 rounded-xl bg-white/5 hover:bg-white/10 text-teal-400 transition-all border border-white/5 cursor-pointer'
                    >
                        {expanded ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        )}
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
                           src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`} 
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
                          className={`text-red-400 hover:bg-red-500/10 p-2 rounded-xl transition cursor-pointer ${expanded ? "block" : "hidden"}`}
                          title="تسجيل الخروج"
                        >
                          🚪
                        </button>
                    )}
                </div>

            </nav>
        </aside>
    );
}