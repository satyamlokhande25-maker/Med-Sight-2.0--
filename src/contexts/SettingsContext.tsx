import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface SettingsContextType {
  darkMode: boolean;
  language: string;
}

const SettingsContext = createContext<SettingsContextType>({
  darkMode: true,
  language: 'English',
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsContextType>({
    darkMode: true,
    language: 'English',
  });

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'user_preferences', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSettings({
          darkMode: data.darkMode ?? true,
          language: data.language ?? 'English',
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [settings.darkMode]);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}
