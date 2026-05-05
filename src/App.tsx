import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { PatientList } from './components/PatientList';
import { AIAssistant } from './components/AIAssistant';
import { MedicalImaging } from './components/MedicalImaging';
import { PatientEducation } from './components/PatientEducation';
import { MedicalResearch } from './components/MedicalResearch';
import { ClinicLocator } from './components/ClinicLocator';
import { History } from './components/History';
import { LiveConsultation } from './components/LiveConsultation';
import { ReportAnalyzer } from './components/ReportAnalyzer';
import { PrescriptionManager } from './components/PrescriptionManager';
import { AppointmentCalendar } from './components/AppointmentCalendar';
import { BillingManager } from './components/BillingManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { Settings } from './components/Settings';
import { Key, AlertCircle, ExternalLink, Sparkles, Brain, Loader2 } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
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
  const { user, loading, signIn, signInEmail, signUpEmail, resetPassword, isSigningIn } = useAuth();
  const { darkMode } = useSettings();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting email auth:', { authMode, email });
    
    if (isSigningIn) {
      console.log('Auth already in progress, skipping');
      return;
    }
    
    try {
      if (authMode === 'login') {
        await signInEmail(email, password);
        toast.success('Welcome back!');
      } else if (authMode === 'signup') {
        await signUpEmail(email, password, name);
        toast.success('Account created successfully! Welcome, ' + name);
      } else {
        await resetPassword(email);
        toast.success('Password reset email sent!');
        setAuthMode('login');
      }
    } catch (error: any) {
      console.error('Detailed Auth error:', error);
      let msg = error.message || 'Authentication failed';
      
      if (error.code === 'auth/operation-not-allowed') {
        msg = "⚠️ Email/Password sign-in is DISABLED in Firebase. Please go to Firebase Console > Authentication > Sign-in method and enable 'Email/Password'.";
      } else if (error.code === 'auth/email-already-in-use') {
        msg = "This email is already registered. Switching you to Login...";
        setAuthMode('login');
      } else if (error.code === 'auth/weak-password') {
        msg = "Password is too weak. Please use at least 6 characters.";
      } else if (error.code === 'auth/invalid-email') {
        msg = "Please enter a valid email address.";
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = "Invalid email or password. Please check your credentials.";
      } else if (error.code === 'auth/too-many-requests') {
        msg = "Too many failed attempts. Please try again later.";
      } else if (error.code === 'auth/network-request-failed') {
        msg = "Network error. Please check your internet connection.";
      }
      
      toast.error(msg, { duration: 8000 });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn();
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      toast.error(error.message || 'Google sign in failed');
    }
  };

  useEffect(() => {
    if (user) {
      setEmail('');
      setPassword('');
      setName('');
    }
  }, [user]);

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
      case 'history': return <History />;
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
        <Toaster theme="dark" position="top-right" richColors closeButton />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl text-center space-y-6"
        >
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 bg-emerald-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30 rotate-6">
              <Brain size={40} />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-xl flex items-center justify-center text-zinc-900 shadow-lg animate-pulse">
              <Sparkles size={20} />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-zinc-100 tracking-tight">
              MedSight <span className="text-emerald-500">2.0</span>
            </h1>
            <p className="text-emerald-500 font-bold uppercase tracking-[0.3em] text-[10px]">
              Agentic AI Healthcare Platform
            </p>
          </div>

          <div className="flex p-1 bg-zinc-950 rounded-xl border border-zinc-800">
            <button 
              type="button"
              onClick={() => setAuthMode('login')}
              className={cn(
                "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                authMode === 'login' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Login
            </button>
            <button 
              type="button"
              onClick={() => setAuthMode('signup')}
              className={cn(
                "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                authMode === 'signup' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
            {authMode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. John Doe"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@medsight.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
            {authMode !== 'reset' && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Password</label>
                  {authMode === 'login' && (
                    <button 
                      type="button"
                      onClick={() => setAuthMode('reset')}
                      className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-wider"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>
            )}

            {authMode === 'reset' && (
              <button 
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest block mx-auto py-2"
              >
                Back to Login
              </button>
            )}

            <button 
              type="submit"
              disabled={isSigningIn}
              className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSigningIn ? <Loader2 className="animate-spin" size={20} /> : (
                authMode === 'login' ? 'Sign In' : 
                authMode === 'signup' ? 'Create Account' : 
                'Reset Password'
              )}
            </button>
          </form>

          {authMode !== 'reset' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-zinc-900 px-2 text-zinc-500 font-bold tracking-widest">Or continue with</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full py-4 bg-zinc-950 text-zinc-100 rounded-xl font-bold border border-zinc-800 hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                {isSigningIn ? 'Signing in...' : 'Google'}
              </button>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen flex transition-colors duration-300",
      darkMode ? "bg-zinc-950" : "bg-zinc-50"
    )}>
      <Toaster theme={darkMode ? "dark" : "light"} position="top-right" richColors closeButton />
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
