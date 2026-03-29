import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, serverTimestamp, getDocs, orderBy, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { toast } from 'sonner';
import { Patient } from '@/types';

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddAppointmentModal({ isOpen, onClose }: AddAppointmentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    time: '09:00 AM',
    type: 'Follow-up',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isOpen) {
      const fetchPatients = async () => {
        try {
          const q = query(collection(db, 'patients'), orderBy('name'));
          const snapshot = await getDocs(q);
          const patientData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
          setPatients(patientData);
        } catch (error) {
          console.error('Error fetching patients for appointment:', error);
        }
      };
      fetchPatients();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!formData.patientId) {
      toast.error('Please select a patient');
      return;
    }

    // Check if patient details are complete
    const selectedPatient = patients.find(p => p.id === formData.patientId);
    if (selectedPatient) {
      const requiredFields = ['name', 'age', 'gender', 'status', 'diagnosis', 'email', 'phone'];
      const missingFields = requiredFields.filter(field => !selectedPatient[field as keyof Patient]);
      
      if (missingFields.length > 0) {
        toast.error(`Patient details are incomplete. Please update ${selectedPatient.name}'s record before booking. Missing: ${missingFields.join(', ')}`);
        return;
      }
    }

    setIsLoading(true);
    const toastId = toast.loading('Scheduling appointment...');

    try {
      const appointmentData = {
        ...formData,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'appointments'), appointmentData);
      
      toast.success('Appointment scheduled successfully', { id: toastId });
      onClose();
      setFormData({
        patientId: '',
        patientName: '',
        time: '09:00 AM',
        type: 'Follow-up',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      handleFirestoreError(error, OperationType.CREATE, 'appointments');
      toast.error('Failed to schedule appointment. Check permissions.', { id: toastId });
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
                  <Calendar size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-100">Schedule Appointment</h2>
                  <p className="text-zinc-400 font-medium text-sm">Set up a new clinical visit for a patient.</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-500 hover:text-zinc-100"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Select Patient</label>
                  <select
                    required
                    value={formData.patientId}
                    onChange={(e) => {
                      const patient = patients.find(p => p.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        patientId: e.target.value,
                        patientName: patient ? patient.name : ''
                      });
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="">Choose a patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Date</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Time</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., 09:00 AM"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Appointment Type</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="Follow-up">Follow-up</option>
                    <option value="Routine Checkup">Routine Checkup</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Consultation">Consultation</option>
                  </select>
                </div>
              </div>

              <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 flex gap-3">
                <AlertCircle size={20} className="text-emerald-500 shrink-0" />
                <p className="text-[11px] text-emerald-200 font-medium leading-relaxed">
                  Scheduling an appointment will notify the patient and update the clinical calendar. Ensure the time slot is available.
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
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Calendar size={20} />}
                  {isLoading ? "Scheduling..." : "Confirm Appointment"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
