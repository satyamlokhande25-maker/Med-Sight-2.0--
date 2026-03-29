import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Mic, 
  Image as ImageIcon, 
  Video, 
  Search, 
  MapPin, 
  Settings, 
  LogOut,
  Menu,
  X,
  Activity,
  FileSearch,
  FileText,
  Calendar,
  CreditCard,
  BarChart3
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../contexts/AuthProvider';
import { useSettings } from '../contexts/SettingsContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'analyzer', label: 'Report Analyzer', icon: FileSearch },
  { id: 'chat', label: 'AI Assistant', icon: MessageSquare },
  { id: 'live', label: 'Live Consult', icon: Mic },
  { id: 'imaging', label: 'Medical Imaging', icon: ImageIcon },
  { id: 'education', label: 'Patient Education', icon: Video },
  { id: 'research', label: 'Medical Research', icon: Search },
  { id: 'locator', label: 'Clinic Locator', icon: MapPin },
];

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { signOut } = useAuth();
  const { darkMode } = useSettings();

  return (
    <>
      <button 
        className={cn(
          "lg:hidden fixed top-4 left-4 z-50 p-2 border rounded-md shadow-md transition-colors duration-300",
          darkMode 
            ? "bg-zinc-900 text-zinc-100 border-zinc-800" 
            : "bg-white text-zinc-900 border-zinc-200"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <motion.aside 
        initial={false}
        animate={{ width: isOpen ? 260 : 80 }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ease-in-out border-r",
          darkMode 
            ? "bg-zinc-950 text-zinc-400 border-zinc-900" 
            : "bg-white text-zinc-500 border-zinc-200",
          !isOpen && "items-center"
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/20">
            <Activity size={24} />
          </div>
          <AnimatePresence>
            {isOpen && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={cn(
                  "text-xl font-bold tracking-tight whitespace-nowrap transition-colors duration-300",
                  darkMode ? "text-white" : "text-zinc-900"
                )}
              >
                MedSight 2.0
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group",
                activeTab === item.id 
                  ? "bg-emerald-500/10 text-emerald-500" 
                  : darkMode 
                    ? "hover:bg-zinc-900 hover:text-white text-zinc-400" 
                    : "hover:bg-zinc-100 hover:text-zinc-900 text-zinc-500"
              )}
            >
              <item.icon size={20} className={cn(
                activeTab === item.id 
                  ? "text-emerald-500" 
                  : darkMode 
                    ? "group-hover:text-white" 
                    : "group-hover:text-zinc-900"
              )} />
              {isOpen && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={cn(
          "p-4 border-t transition-colors duration-300",
          darkMode ? "border-zinc-900" : "border-zinc-200"
        )}>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group",
              activeTab === 'settings' 
                ? "bg-emerald-500/10 text-emerald-500" 
                : darkMode 
                  ? "hover:bg-zinc-900 hover:text-white text-zinc-400" 
                  : "hover:bg-zinc-100 hover:text-zinc-900 text-zinc-500"
            )}
          >
            <Settings size={20} className={cn(
              activeTab === 'settings' 
                ? "text-emerald-500" 
                : darkMode 
                  ? "group-hover:text-white" 
                  : "group-hover:text-zinc-900"
            )} />
            {isOpen && <span className="font-medium text-sm">Settings</span>}
          </button>
          <button 
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 mt-2"
          >
            <LogOut size={20} />
            {isOpen && <span className="font-medium text-sm">Logout</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
