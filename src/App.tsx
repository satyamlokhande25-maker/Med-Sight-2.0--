import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { PatientList } from './components/PatientList';
import { AIAssistant } from './components/AIAssistant';
import { MedicalImaging } from './components/MedicalImaging';
import { PatientEducation } from './components/PatientEducation';
import { MedicalResearch } from './components/MedicalResearch';
import { ClinicLocator } from './components/ClinicLocator';
import { LiveConsultation } from './components/LiveConsultation';
import { ReportAnalyzer } from './components/ReportAnalyzer';
import { PrescriptionManager } from './components/PrescriptionManager';
import { AppointmentCalendar } from './components/AppointmentCalendar';
import { BillingManager } from './components/BillingManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { Settings } from './components/Settings';
import { Key, AlertCircle, ExternalLink, Sparkles } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading, signIn } = useAuth();
  const { darkMode } = useSettings();
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard setActiveTab={setActiveTab} />;
      case 'patients': return <PatientList />;
      case 'prescriptions': return <PrescriptionManager />;
      case 'calendar': return <AppointmentCalendar />;
      case 'billing': return <BillingManager />;
      case 'analytics': return <AnalyticsDashboard />;
      case 'chat': return <AIAssistant />;
      case 'live': return <LiveConsultation />;
      case 'imaging': return <MedicalImaging />;
      case 'education': return <PatientEducation />;
      case 'research': return <MedicalResearch />;
      case 'locator': return <ClinicLocator />;
      case 'analyzer': return <ReportAnalyzer />;
      case 'settings': return <Settings />;
      default: return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-zinc-900 p-10 rounded-[2.5rem] border border-zinc-800 shadow-2xl text-center space-y-8"
        >
          <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 mx-auto">
            <Sparkles size={40} />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">MedSight 2.0</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Welcome to the next generation of clinical management. Please sign in to access your dashboard.
            </p>
          </div>
          <button 
            onClick={signIn}
            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen flex transition-colors duration-300",
      darkMode ? "bg-zinc-950" : "bg-zinc-50"
    )}>
      <Toaster theme={darkMode ? "dark" : "light"} position="top-right" richColors />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 ml-[80px] lg:ml-[260px] p-8 lg:p-12 transition-all duration-300">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
