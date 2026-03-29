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
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthProvider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const translations: Record<string, any> = {
  English: {
    settings: 'Settings',
    manage: 'Manage your account, notification preferences, and application settings.',
    notifications: 'Notifications',
    account: 'Account Info',
    security: 'Security',
    appearance: 'Appearance & Language',
    save: 'Save Changes',
    profile: 'Update Profile'
  },
  Hindi: {
    settings: 'सेटिंग्स',
    manage: 'अपने खाते, अधिसूचना प्राथमिकताओं और एप्लिकेशन सेटिंग्स का प्रबंधन करें।',
    notifications: 'अधिसूचनाएं',
    account: 'खाता जानकारी',
    security: 'सुरक्षा',
    appearance: 'दिखावट और भाषा',
    save: 'परिवर्तन सहेजें',
    profile: 'प्रोफ़ाइल अपडेट करें'
  },
  Spanish: {
    settings: 'Ajustes',
    manage: 'Administre su cuenta, preferencias de notificación y configuración de la aplicación.',
    notifications: 'Notificaciones',
    account: 'Información de la cuenta',
    security: 'Seguridad',
    appearance: 'Apariencia e Idioma',
    save: 'Guardar cambios',
    profile: 'Actualizar perfil'
  },
  French: {
    settings: 'Paramètres',
    manage: 'Gérez votre compte, vos préférences de notification et les paramètres de l\'application.',
    notifications: 'Notifications',
    account: 'Infos compte',
    security: 'Sécurité',
    appearance: 'Apparence et langue',
    save: 'Sauvegarder les modifications',
    profile: 'Mettre à jour le profil'
  },
  German: {
    settings: 'Einstellungen',
    manage: 'Verwalten Sie Ihr Konto, Ihre Benachrichtigungseinstellungen und Anwendungseinstellungen.',
    notifications: 'Benachrichtigungen',
    account: 'Kontoinformationen',
    security: 'Sicherheit',
    appearance: 'Erscheinungsbild & Sprache',
    save: 'Änderungen speichern',
    profile: 'Profil aktualisieren'
  }
};

import { fetchWithRetry } from '../lib/fetchWithRetry';

export function Settings() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    smsAlerts: true,
    appointmentReminders: true,
    criticalPatientAlerts: true,
    darkMode: true,
    language: 'English'
  });

  const t = translations[preferences.language] || translations.English;

  const [activeSection, setActiveSection] = useState<'notifications' | 'account' | 'security' | 'appearance'>('notifications');

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
      await setDoc(doc(db, 'user_preferences', user.uid), preferences);
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
          </nav>


          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                <Mail size={20} />
              </div>
              <h3 className="font-bold text-zinc-100">Quick Tips</h3>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Keep your profile updated to ensure AI insights are personalized to your clinical practice.
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
                    Notification Channels
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                          <Mail size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-100">Email Notifications</p>
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
                          <p className="font-bold text-zinc-100">Push Notifications</p>
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
                    Alert Preferences
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <div>
                        <p className="font-bold text-zinc-100">Appointment Reminders</p>
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
                        <p className="font-bold text-zinc-100">Critical Patient Alerts</p>
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
                  Account Information
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
                    Security & API
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
                        Test SMTP Connection
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
                      MedSight 2.0 uses high-performance AI models. Ensure your API keys are correctly configured for full functionality.
                    </p>
                    <button 
                      onClick={handleOpenKeyDialog}
                      className="w-full py-3 bg-zinc-800 text-zinc-100 rounded-2xl text-sm font-bold hover:bg-zinc-700 transition-all border border-zinc-700"
                    >
                      Configure API Keys
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
                  Appearance & Language
                </h2>

                <div className="space-y-6">
                  <div className="p-6 bg-zinc-950 rounded-3xl border border-zinc-800">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Theme Preference</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setPreferences(prev => ({ ...prev, darkMode: true }))}
                        className={cn(
                          "py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all border",
                          preferences.darkMode 
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                            : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                        )}
                      >
                        <Moon size={18} />
                        Dark Mode
                      </button>
                      <button 
                        onClick={() => setPreferences(prev => ({ ...prev, darkMode: false }))}
                        className={cn(
                          "py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all border",
                          !preferences.darkMode 
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                            : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                        )}
                      >
                        <Sun size={18} />
                        Light Mode
                      </button>
                    </div>
                  </div>

                  <div className="p-6 bg-zinc-950 rounded-3xl border border-zinc-800">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">System Language</p>
                    <select 
                      value={preferences.language}
                      onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-emerald-500 appearance-none"
                    >
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                      <option>Hindi</option>
                    </select>
                    <p className="text-[10px] text-zinc-500 mt-3">Changing language will update the UI labels and AI response style.</p>
                  </div>
                </div>

                <div className="pt-8 border-t border-zinc-800 flex justify-end">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    Save Changes
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
