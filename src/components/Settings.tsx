import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Shield, 
  User, 
  Key, 
  Save,
  CheckCircle2,
  AlertCircle,
  Globe,
  Moon,
  Sun,
  Loader2,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { fetchWithRetry } from '../lib/fetchWithRetry';

import { translations } from '@/lib/translations';
import { useSettings } from '../contexts/SettingsContext';

import { StaffManagement } from './StaffManagement';

export function Settings() {
  const { user, isSuperAdmin } = useAuth();
  const { darkMode, language, updateSettings } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    smsAlerts: true,
    appointmentReminders: true,
    criticalPatientAlerts: true,
  });

  const t = translations[language] || translations.English;

  const [activeSection, setActiveSection] = useState<'notifications' | 'account' | 'security' | 'appearance' | 'staff'>('notifications');

  useEffect(() => {
    if (!user) return;
    
    const fetchPrefs = async () => {
      try {
        const docRef = doc(db, 'user_preferences', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPreferences(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        console.error("Error fetching preferences:", err);
        handleFirestoreError(err, OperationType.GET, `user_preferences/${user.uid}`);
      }
    };
    
    fetchPrefs();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const toastId = toast.loading('Saving preferences...');
    
    try {
      // Save local preferences
      await setDoc(doc(db, 'user_preferences', user.uid), preferences, { merge: true });
      
      // Also ensure context is updated (though it should be already if we call updateSettings on change)
      // But here we might want to save everything at once if the user expects a "Save" button for all.
      // However, theme and language are usually immediate.
      
      toast.success('Preferences saved successfully', { id: toastId });
    } catch (err) {
      console.error("Error saving preferences:", err);
      handleFirestoreError(err, OperationType.WRITE, `user_preferences/${user.uid}`);
      toast.error('Failed to save preferences', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (key: keyof typeof preferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key]
    }));
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
    }
  };

  const [isTesting, setIsTesting] = useState(false);
  const handleTestConnection = async () => {
    setIsTesting(true);
    const toastId = toast.loading('Testing SMTP connection...');
    try {
      const response = await fetchWithRetry('/api/test-connection', { method: 'POST' });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response received:", text);
        throw new Error(`Server returned an unexpected response format (${response.status}). Please try again.`);
      }

      const data = await response.json();
      if (data.success) {
        toast.success(data.message, { id: toastId });
      } else {
        toast.error(data.error || 'Connection failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Failed to test connection', { id: toastId });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">{t.settings}</h1>
        <p className="text-zinc-400 mt-2">{t.manage}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <nav className="space-y-1">
            <button 
              onClick={() => setActiveSection('notifications')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border",
                activeSection === 'notifications' 
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                  : "text-zinc-500 hover:bg-zinc-900 border-transparent"
              )}
            >
              <Bell size={18} />
              {t.notifications}
            </button>
            <button 
              onClick={() => setActiveSection('account')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border",
                activeSection === 'account' 
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                  : "text-zinc-500 hover:bg-zinc-900 border-transparent"
              )}
            >
              <User size={18} />
              {t.account}
            </button>
            <button 
              onClick={() => setActiveSection('security')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border",
                activeSection === 'security' 
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                  : "text-zinc-500 hover:bg-zinc-900 border-transparent"
              )}
            >
              <Shield size={18} />
              {t.security}
            </button>
            <button 
              onClick={() => setActiveSection('appearance')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border",
                activeSection === 'appearance' 
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                  : "text-zinc-500 hover:bg-zinc-900 border-transparent"
              )}
            >
              <Globe size={18} />
              {t.appearance}
            </button>
            {isSuperAdmin && (
              <button 
                onClick={() => setActiveSection('staff')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border",
                  activeSection === 'staff' 
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                    : "text-zinc-500 hover:bg-zinc-900 border-transparent"
                )}
              >
                <Users size={18} />
                Staff Management
              </button>
            )}
          </nav>



          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                <Mail size={20} />
              </div>
              <h3 className="font-bold text-zinc-100">{t.quickTips}</h3>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              {t.profileNote}
            </p>
          </div>
        </div>

        <div className="md:col-span-2">
          <AnimatePresence mode="wait">
            {activeSection === 'notifications' && (
              <motion.section 
                key="notifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 space-y-8"
              >
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                    <Bell size={24} className="text-emerald-500" />
                    {t.notifications}
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                          <Mail size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-100">{t.emailNotifications}</p>
                          <p className="text-xs text-zinc-500">Receive summaries and reports via email.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => togglePreference('emailNotifications')}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          preferences.emailNotifications ? "bg-emerald-500" : "bg-zinc-800"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          preferences.emailNotifications ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500">
                          <Smartphone size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-100">{t.pushNotifications}</p>
                          <p className="text-xs text-zinc-500">Real-time alerts on your browser or mobile.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => togglePreference('pushNotifications')}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          preferences.pushNotifications ? "bg-emerald-500" : "bg-zinc-800"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          preferences.pushNotifications ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                    <AlertCircle size={24} className="text-amber-500" />
                    {t.alertPreferences}
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <div>
                        <p className="font-bold text-zinc-100">{t.appointmentReminders}</p>
                        <p className="text-xs text-zinc-500">Notify me 30 minutes before every appointment.</p>
                      </div>
                      <button 
                        onClick={() => togglePreference('appointmentReminders')}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          preferences.appointmentReminders ? "bg-emerald-500" : "bg-zinc-800"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          preferences.appointmentReminders ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <div>
                        <p className="font-bold text-zinc-100">{t.criticalPatientAlerts}</p>
                        <p className="text-xs text-zinc-500">Immediate notification for status changes to 'Critical'.</p>
                      </div>
                      <button 
                        onClick={() => togglePreference('criticalPatientAlerts')}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          preferences.criticalPatientAlerts ? "bg-emerald-500" : "bg-zinc-800"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                          preferences.criticalPatientAlerts ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-zinc-800 flex justify-end">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    {t.save}
                  </button>
                </div>
              </motion.section>
            )}

            {activeSection === 'account' && (
              <motion.section 
                key="account"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 space-y-8"
              >
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                  <User size={24} className="text-blue-500" />
                  {t.account}
                </h2>

                <div className="flex items-center gap-6 p-6 bg-zinc-950 rounded-3xl border border-zinc-800">
                  <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold text-zinc-600 overflow-hidden">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      user?.displayName?.charAt(0) || 'D'
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100">{user?.displayName || 'Doctor'}</h3>
                    <p className="text-zinc-500">{user?.email}</p>
                    <p className="text-xs text-emerald-500 font-bold mt-1 uppercase tracking-widest">Verified Practitioner</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Full Name</label>
                    <input 
                      type="text" 
                      defaultValue={user?.displayName || ''} 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Email Address</label>
                    <input 
                      type="email" 
                      defaultValue={user?.email || ''} 
                      readOnly
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-8 border-t border-zinc-800 flex justify-end">
                  <button 
                    onClick={async () => {
                      if (!user) return;
                      const name = (document.querySelector('input[type="text"]') as HTMLInputElement)?.value;
                      if (!name) return;
                      
                      const toastId = toast.loading('Updating profile...');
                      try {
                        const { updateProfile } = await import('firebase/auth');
                        await updateProfile(user, { displayName: name });
                        toast.success('Profile updated successfully', { id: toastId });
                      } catch (err) {
                        console.error("Error updating profile:", err);
                        toast.error('Failed to update profile', { id: toastId });
                      }
                    }}
                    className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {t.profile}
                  </button>
                </div>
              </motion.section>
            )}

            {activeSection === 'security' && (
              <motion.section 
                key="security"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 space-y-8"
              >
                <div className="space-y-6">
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                    <Shield size={24} className="text-red-500" />
                    {t.securitySettings}
                  </h2>

                  <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                        <Mail size={20} />
                      </div>
                      <h3 className="font-bold text-zinc-100">SMTP Configuration</h3>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Configure your Gmail App Password to enable automated patient reminders and report delivery.
                    </p>
                    <div className="space-y-3 pt-2">
                      <ol className="text-xs text-zinc-400 space-y-2 list-decimal ml-4">
                        <li>Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">Google Security</a></li>
                        <li>Enable 2-Step Verification</li>
                        <li>Search for "App Passwords"</li>
                        <li>Create one for "MedSight"</li>
                      </ol>
                      <button 
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="w-full py-3 bg-emerald-500/10 text-emerald-500 rounded-2xl text-sm font-bold hover:bg-emerald-500/20 transition-all border border-emerald-500/20 flex items-center justify-center gap-2"
                      >
                        {isTesting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                        {t.testConnection}
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                        <Key size={20} />
                      </div>
                      <h3 className="font-bold text-zinc-100">AI Model Access</h3>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {t.apiNote}
                    </p>
                    <button 
                      onClick={handleOpenKeyDialog}
                      className="w-full py-3 bg-zinc-800 text-zinc-100 rounded-2xl text-sm font-bold hover:bg-zinc-700 transition-all border border-zinc-700"
                    >
                      {t.configureKeys}
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {activeSection === 'appearance' && (
              <motion.section 
                key="appearance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 space-y-8"
              >
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                  <Globe size={24} className="text-blue-500" />
                  {t.appearance}
                </h2>

                <div className="space-y-6">
                  <div className="p-6 bg-zinc-950 rounded-3xl border border-zinc-800">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">{t.themePreference}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => updateSettings({ darkMode: true })}
                        className={cn(
                          "py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all border",
                          darkMode 
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                            : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                        )}
                      >
                        <Moon size={18} />
                        {t.darkMode}
                      </button>
                      <button 
                        onClick={() => updateSettings({ darkMode: false })}
                        className={cn(
                          "py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all border",
                          !darkMode 
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                            : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                        )}
                      >
                        <Sun size={18} />
                        {t.lightMode}
                      </button>
                    </div>
                  </div>

                  <div className="p-6 bg-zinc-950 rounded-3xl border border-zinc-800">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">AI Consultant Voice</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {['Kore', 'Charon', 'Puck', 'Fenrir', 'Zephyr'].map((v) => (
                        <button 
                          key={v}
                          onClick={() => updateSettings({ voiceName: v })}
                          className={cn(
                            "py-3 rounded-xl text-xs font-bold transition-all border",
                            (useSettings().voiceName === v)
                              ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                              : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-3">Choose the voice for your Live AI Consultant.</p>
                  </div>

                  <div className="p-6 bg-zinc-950 rounded-3xl border border-zinc-800">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">{t.systemLanguage}</p>
                    <select 
                      value={language}
                      onChange={(e) => updateSettings({ language: e.target.value as any })}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-emerald-500 appearance-none"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="German">German</option>
                      <option value="Hindi">Hindi</option>
                    </select>
                    <p className="text-[10px] text-zinc-500 mt-3">{t.languageNote}</p>
                  </div>
                </div>

                <div className="pt-8 border-t border-zinc-800 flex justify-end">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    {t.save}
                  </button>
                </div>
              </motion.section>
            )}

            {activeSection === 'staff' && (
              <motion.section 
                key="staff"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 space-y-8"
              >
                <StaffManagement />
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
