import React, { useState } from 'react';
import { X, UserPlus, Loader2, AlertCircle, Camera, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CameraCapture } from './CameraCapture';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddPatientModal({ isOpen, onClose }: AddPatientModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    status: 'Stable',
    diagnosis: '',
    email: '',
    phone: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    // Validation
    const ageNum = parseInt(formData.age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      toast.error('Please enter a valid age between 0 and 150');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    if (!phoneRegex.test(formData.phone)) {
      toast.error('Please enter a valid phone number (at least 10 digits)');
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Adding patient to records...');

    try {
      const patientData = {
        ...formData,
        age: ageNum,
        profileImage,
        lastVisit: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      };

      // Optimistic close
      onClose();
      setFormData({
        name: '',
        age: '',
        gender: 'Male',
        status: 'Stable',
        diagnosis: '',
        email: '',
        phone: ''
      });
      setProfileImage(null);

      await addDoc(collection(db, 'patients'), patientData);
      toast.success('Patient added successfully', { id: toastId });
    } catch (error) {
      console.error('Error adding patient:', error);
      handleFirestoreError(error, OperationType.CREATE, 'patients');
      toast.error('Failed to add patient. Check permissions.', { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-zinc-950/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-zinc-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-zinc-800"
          >
            <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center">
                  <UserPlus size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-100">Add New Patient</h2>
                  <p className="text-zinc-400 font-medium text-sm">Enter patient details to create a new record.</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-500 hover:text-zinc-100"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="flex flex-col items-center justify-center mb-8">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-zinc-950 border-2 border-dashed border-zinc-800 flex items-center justify-center overflow-hidden transition-all group-hover:border-emerald-500">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={32} className="text-zinc-700 group-hover:text-emerald-500 transition-colors" />
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 flex gap-2">
                    {profileImage ? (
                      <button 
                        type="button"
                        onClick={() => setProfileImage(null)}
                        className="p-3 bg-red-500 text-white rounded-2xl shadow-lg hover:bg-red-600 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg hover:bg-emerald-600 transition-all"
                      >
                        <Camera size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-4">Patient Profile Photo</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Full Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., John Doe"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Age</label>
                  <input
                    required
                    type="number"
                    min="0"
                    max="150"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="e.g., 45"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Gender</label>
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="Stable">Stable</option>
                    <option value="Recovering">Recovering</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Phone Number</label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g., +1 555-000-0000"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Email Address</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g., john.doe@example.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Diagnosis</label>
                  <textarea
                    required
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                    placeholder="Enter clinical diagnosis or reason for visit..."
                    rows={3}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 flex gap-3">
                <AlertCircle size={20} className="text-emerald-500 shrink-0" />
                <p className="text-[11px] text-emerald-200 font-medium leading-relaxed">
                  Ensure all patient information is accurate. This record will be accessible to all authorized clinical staff and used for AI-assisted analysis.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 bg-zinc-800 text-zinc-300 rounded-2xl font-bold hover:bg-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
                  {isLoading ? "Adding Patient..." : "Create Patient Record"}
                </button>
              </div>
            </form>
          </motion.div>

          {showCamera && (
            <CameraCapture 
              onCapture={(img) => setProfileImage(img)} 
              onClose={() => setShowCamera(false)} 
              title="Capture Patient Photo"
            />
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
