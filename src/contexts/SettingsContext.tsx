import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

interface SettingsContextType {
  darkMode: boolean;
  language: string;
  voiceName: string;
  updateSettings: (newSettings: Partial<Omit<SettingsContextType, 'updateSettings'>>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  darkMode: true,
  language: 'English',
  voiceName: 'Kore',
  updateSettings: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Omit<SettingsContextType, 'updateSettings'>>({
    darkMode: true,
    language: 'English',
    voiceName: 'Kore',
  });

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'user_preferences', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSettings({
          darkMode: data.darkMode ?? true,
          language: data.language ?? 'English',
          voiceName: data.voiceName ?? 'Kore',
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  const updateSettings = async (newSettings: Partial<Omit<SettingsContextType, 'updateSettings'>>) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'user_preferences', user.uid), {
        ...settings,
        ...newSettings
      }, { merge: true });
    } catch (err) {
      console.error("Error updating settings:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [settings.darkMode]);

  return (
    <SettingsContext.Provider value={{ ...settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
