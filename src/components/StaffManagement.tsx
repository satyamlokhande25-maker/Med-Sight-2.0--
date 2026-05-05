import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  UserPlus, 
  Search, 
  Trash2, 
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

interface AdminRecord {
  userId: string;
  email: string;
  role: 'admin' | 'super_admin';
}

export function StaffManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    // Listen to users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(uList);
    }, (err) => {
      console.error("Error fetching users:", err);
    });

    // Listen to admins
    const unsubAdmins = onSnapshot(collection(db, 'admins'), (snapshot) => {
      const aList = snapshot.docs.map(doc => doc.data() as AdminRecord);
      setAdmins(aList);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching admins:", err);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubAdmins();
    };
  }, []);

  const handleToggleAdmin = async (user: UserProfile) => {
    const isAdmin = admins.some(a => a.userId === user.uid);
    setIsProcessing(user.uid);
    
    try {
      if (isAdmin) {
        // Only allow removing if not super_admin
        const adminRecord = admins.find(a => a.userId === user.uid);
        if (adminRecord?.role === 'super_admin') {
          toast.error("Super Admin cannot be removed.");
          return;
        }
        await deleteDoc(doc(db, 'admins', user.uid));
        toast.success(`${user.displayName} removed from Admins`);
      } else {
        await setDoc(doc(db, 'admins', user.uid), {
          userId: user.uid,
          email: user.email,
          role: 'admin',
          createdAt: new Date().toISOString()
        });
        toast.success(`${user.displayName} promoted to Admin`);
      }
    } catch (err) {
       handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
       toast.error("Failed to update permissions. Ensure you have Super Admin rights.");
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Loading Directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <Users className="text-emerald-500" />
              User Directory
            </h3>
            <p className="text-xs text-zinc-500 mt-1">Manage staff roles and administrative privileges.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 w-64 transition-all"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
              <p className="text-zinc-500 font-medium">No users found matching your search.</p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isAdmin = admins.some(a => a.userId === u.uid);
              const adminRecord = admins.find(a => a.userId === u.uid);
              const isSuper = adminRecord?.role === 'super_admin';
              
              return (
                <motion.div 
                  key={u.uid}
                  layout
                  className="flex items-center justify-between p-4 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-zinc-600">{u.displayName.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-zinc-100">{u.displayName}</p>
                        {isAdmin && (
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest flex items-center gap-1",
                            isSuper ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                          )}>
                            {isSuper ? <ShieldAlert size={8} /> : <ShieldCheck size={8} />}
                            {isSuper ? 'Super Admin' : 'Admin'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAdmin(u)}
                      disabled={isProcessing === u.uid || isSuper}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50",
                        isAdmin 
                          ? "bg-zinc-800 text-zinc-400 hover:bg-red-500/10 hover:text-red-500 border border-zinc-700 hover:border-red-500/20" 
                          : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20"
                      )}
                    >
                      {isProcessing === u.uid ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : isAdmin ? (
                        <>
                          <Trash2 size={14} />
                          Revoke Access
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} />
                          Grant Admin
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 flex gap-4">
        <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 h-fit">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h4 className="font-bold text-amber-500">Security Notice</h4>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            Granting administrative privileges gives users full control over patients, billing, and system settings. 
            Only promote trusted medical staff as admins.
          </p>
        </div>
      </div>
    </div>
  );
}
