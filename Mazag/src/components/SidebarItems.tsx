import React, { useContext } from 'react';
import { SidebarContext } from './Sidebar';

type SidebarItemProps = {
    icon: React.ReactNode;
    text: string;
    active?: boolean;
    alert?: boolean;
    onClick?: () => void;
};

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, text, active, alert, onClick }) => {
  const { expanded } = useContext(SidebarContext);

  return (
    <li onClick={onClick}
     className={`
    group relative flex items-center py-2.5 px-3 my-1
    font-medium rounded-xl cursor-pointer
    transition-colors
    ${
        active
        ? "bg-gradient-to-r from-teal-500/20 to-indigo-500/20 text-teal-400 border border-teal-500/30"
        : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
    }
    `}>
        {icon}
        <span className={`overflow-hidden transition-all duration-300 ${expanded ? "w-52 ml-3 opacity-100" : "w-0 opacity-0"}`}>{text}</span>
        {alert && <div className={`absolute right-2 w-2 h-2 rounded bg-teal-400 ${expanded ? "" : "top-2"}`}/>}

        {!expanded && (
            <div className={`
                absolute left-full rounded-md px-2 py-1 ml-6
                bg-black/90 text-teal-400 text-xs
                invisible opacity-0 -translate-x-3 transition-all
                group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 z-50 whitespace-nowrap border border-white/10 shadow-xl
                `}>
                {text}
            </div>
        )}
    </li>
  );
};

export default SidebarItem;