import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, where, orderBy, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Clock, User, Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isSameDay, parseISO } from 'date-fns';
import { toast } from 'sonner';

export function AppointmentCalendar() {
  const [date, setDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    time: '10:00 AM',
    type: 'Consultation',
    status: 'Scheduled'
  });

  const [appointmentsValue] = useCollection(
    query(collection(db, 'appointments'), orderBy('date', 'asc'))
  );
  const appointments = appointmentsValue?.docs.map(doc => ({ id: doc.id, ...doc.data() })) || [];

  const selectedDateAppointments = appointments.filter((app: any) => 
    isSameDay(parseISO(app.date), date)
  );

  const handleAddAppointment = async () => {
    if (!newAppointment.patientName || !newAppointment.time) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await addDoc(collection(db, 'appointments'), {
        ...newAppointment,
        date: format(date, 'yyyy-MM-dd'),
        userId: auth.currentUser?.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('Appointment scheduled');
      setShowAddModal(false);
      setNewAppointment({ patientName: '', time: '10:00 AM', type: 'Consultation', status: 'Scheduled' });
    } catch (error) {
      toast.error('Failed to schedule appointment');
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'appointments', id));
      toast.success('Appointment deleted');
    } catch (error) {
      toast.error('Failed to delete appointment');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Appointment Calendar</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage your schedule and track patient visits.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus size={20} />
          Schedule Appointment
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2.5rem] shadow-xl">
            <Calendar 
              onChange={(val) => setDate(val as Date)} 
              value={date}
              className="custom-calendar w-full border-none bg-transparent text-zinc-100"
              nextLabel={<ChevronRight size={20} />}
              prevLabel={<ChevronLeft size={20} />}
              tileClassName={({ date: tileDate, view }) => {
                if (view === 'month') {
                  const hasApp = appointments.some((app: any) => isSameDay(parseISO(app.date), tileDate));
                  return hasApp ? 'has-appointment' : null;
                }
                return null;
              }}
            />
          </div>
          
          <div className="mt-8 bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[2rem]">
            <h3 className="text-emerald-500 font-bold flex items-center gap-2 mb-2">
              <CalendarIcon size={18} />
              Selected Date
            </h3>
            <p className="text-zinc-100 text-xl font-bold">{format(date, 'MMMM d, yyyy')}</p>
            <p className="text-zinc-400 text-sm mt-1">{selectedDateAppointments.length} appointments scheduled</p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <Clock className="text-emerald-500" size={24} />
            Today's Schedule
          </h2>

          <div className="space-y-4">
            {selectedDateAppointments.length > 0 ? (
              selectedDateAppointments.map((app: any) => (
                <motion.div 
                  key={app.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] flex items-center justify-between hover:border-emerald-500/50 transition-all group"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-100">
                      <span className="text-xs font-bold text-emerald-500 uppercase">{app.time.split(' ')[1]}</span>
                      <span className="text-lg font-bold">{app.time.split(' ')[0]}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-zinc-100 group-hover:text-emerald-500 transition-colors">{app.patientName}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-zinc-500 text-sm flex items-center gap-1">
                          <User size={14} /> {app.type}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                          app.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => {
                        setSelectedAppointment(app);
                        setShowDetailsModal(true);
                      }}
                      className="p-3 bg-zinc-800 text-zinc-400 hover:text-emerald-500 rounded-xl transition-all"
                    >
                      Details
                    </button>
                    <button 
                      onClick={() => handleDeleteAppointment(app.id)}
                      className="p-3 bg-zinc-800 text-zinc-400 hover:text-red-500 rounded-xl transition-all"
                      title="Delete Appointment"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-zinc-900/50 border border-zinc-800 border-dashed p-12 rounded-[2.5rem] text-center space-y-4">
                <div className="w-16 h-16 bg-zinc-800 rounded-3xl flex items-center justify-center text-zinc-600 mx-auto">
                  <CalendarIcon size={32} />
                </div>
                <p className="text-zinc-500">No appointments scheduled for this date.</p>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="text-emerald-500 font-bold hover:underline"
                >
                  Schedule one now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-zinc-100">Schedule Appointment</h2>
                <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-zinc-300">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Patient Name</label>
                  <input 
                    type="text"
                    value={newAppointment.patientName}
                    onChange={(e) => setNewAppointment({ ...newAppointment, patientName: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Enter patient name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Time</label>
                    <input 
                      type="text"
                      value={newAppointment.time}
                      onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="e.g. 10:30 AM"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Type</label>
                    <select 
                      value={newAppointment.type}
                      onChange={(e) => setNewAppointment({ ...newAppointment, type: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option>Consultation</option>
                      <option>Follow-up</option>
                      <option>Emergency</option>
                      <option>Surgery</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 bg-zinc-800 text-zinc-300 rounded-2xl font-bold hover:bg-zinc-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddAppointment}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Schedule
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showDetailsModal && selectedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailsModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-zinc-100">Appointment Details</h2>
                <button onClick={() => setShowDetailsModal(false)} className="text-zinc-500 hover:text-zinc-300">
                  <X size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                    <User size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100">{selectedAppointment.patientName}</h3>
                    <p className="text-zinc-400">{selectedAppointment.type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-800">
                    <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Time</p>
                    <p className="text-zinc-100 font-bold flex items-center gap-2">
                      <Clock size={14} className="text-emerald-500" />
                      {selectedAppointment.time}
                    </p>
                  </div>
                  <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-800">
                    <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Status</p>
                    <p className={`text-xs px-2 py-1 rounded-full font-bold inline-block ${
                      selectedAppointment.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'
                    }`}>
                      {selectedAppointment.status}
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-800">
                  <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Date</p>
                  <p className="text-zinc-100 font-bold flex items-center gap-2">
                    <CalendarIcon size={14} className="text-emerald-500" />
                    {format(parseISO(selectedAppointment.date), 'MMMM d, yyyy')}
                  </p>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => setShowDetailsModal(false)}
                    className="w-full py-4 bg-zinc-800 text-zinc-300 rounded-2xl font-bold hover:bg-zinc-700 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-calendar {
          background: transparent !important;
          border: none !important;
          width: 100% !important;
          font-family: inherit !important;
        }
        .react-calendar__navigation button {
          color: #f4f4f5 !important;
          font-size: 1.25rem !important;
          font-weight: bold !important;
        }
        .react-calendar__month-view__weekdays__weekday {
          color: #71717a !important;
          text-decoration: none !important;
          text-transform: uppercase !important;
          font-size: 0.75rem !important;
          font-weight: 800 !important;
          padding: 1rem 0 !important;
        }
        .react-calendar__tile {
          color: #d4d4d8 !important;
          padding: 1.25rem 0.5rem !important;
          border-radius: 1rem !important;
          font-weight: 600 !important;
          transition: all 0.2s !important;
        }
        .react-calendar__tile:hover {
          background-color: #27272a !important;
          color: #10b981 !important;
        }
        .react-calendar__tile--now {
          background: #10b98120 !important;
          color: #10b981 !important;
        }
        .react-calendar__tile--active {
          background: #10b981 !important;
          color: white !important;
        }
        .has-appointment::after {
          content: '';
          display: block;
          width: 4px;
          height: 4px;
          background: #10b981;
          border-radius: 50%;
          margin: 2px auto 0;
        }
      `}</style>
    </div>
  );
}
