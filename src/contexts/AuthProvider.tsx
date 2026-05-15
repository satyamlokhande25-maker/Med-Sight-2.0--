import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, signInWithGoogle, logout, signInWithEmail, signUpWithEmail, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<void>;
  signUpEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isAdminState, setIsAdminState] = useState(false);

  const isSuperAdmin = user?.email === 'satyamlokhande01@gmail.com';
  const isAdmin = isAdminState || isSuperAdmin;

  useEffect(() => {
    let unsubscribeAdmin: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (unsubscribeAdmin) {
        unsubscribeAdmin();
        unsubscribeAdmin = null;
      }

      if (user) {
        // Listen to admins collection for this specific user in real-time
        try {
          unsubscribeAdmin = onSnapshot(doc(db, 'admins', user.uid), (doc) => {
            setIsAdminState(doc.exists());
          }, (error) => {
            console.error("Error listening to admin status:", error);
            setIsAdminState(false);
          });
        } catch (error) {
          console.error("Error setting up admin listener:", error);
          setIsAdminState(false);
        }
      } else {
        setIsAdminState(false);
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeAdmin) unsubscribeAdmin();
    };
  }, []);

  const signIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      // Handle specific Firebase popup errors gracefully
      if (error.code === 'auth/cancelled-popup-request' || 
          error.code === 'auth/popup-closed-by-user') {
        console.warn('Sign in popup was closed or cancelled');
        return;
      }
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  const signInEmail = async (email: string, pass: string) => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithEmail(email, pass);
    } catch (error) {
      console.error('Sign in email error:', error);
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  const signUpEmail = async (email: string, pass: string, name: string) => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signUpWithEmail(email, pass, name);
    } catch (error) {
      console.error('Sign up email error:', error);
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      const { resetPassword: fbResetPassword } = await import('../lib/firebase');
      await fbResetPassword(email);
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isSigningIn, signIn, signInEmail, signUpEmail, resetPassword: handleResetPassword, signOut, isAdmin, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
