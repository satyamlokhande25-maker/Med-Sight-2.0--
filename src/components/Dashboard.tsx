import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Activity, 
  Calendar, 
  Calendar as CalendarIcon,
  DollarSign,
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  Brain,
  FileText,
  ChevronRight,
  Loader2,
  Sparkles,
  X,
  UserPlus,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Patient } from '@/types';
import { getGroqResponse } from '@/services/groq';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { Mail, Phone, Send as SendIcon, Bell, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { domToPng } from 'modern-screenshot';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, setDoc, doc, addDoc, serverTimestamp, updateDoc, deleteDoc, where, getDocs } from 'firebase/firestore';

import { AddPatientModal } from './AddPatientModal';
import { AddAppointmentModal } from './AddAppointmentModal';
import { FeatureVideo } from './FeatureVideo';

import { AuthProvider, useAuth } from '../contexts/AuthProvider';
import { useSettings } from '../contexts/SettingsContext';

import { fetchWithRetry } from '../lib/fetchWithRetry';
import { translations } from '@/lib/translations';

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => {
  const { darkMode } = useSettings();
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={cn(
        "p-6 rounded-3xl border shadow-sm flex flex-col gap-4 transition-all duration-300",
        darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("p-3 rounded-2xl", color)}>
          <Icon size={24} className="text-white" />
        </div>
        <div className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
          <TrendingUp size={16} />
          {trend}
        </div>
      </div>
      <div>
        <p className={cn("text-sm font-medium transition-colors", darkMode ? "text-zinc-500" : "text-zinc-400")}>{title}</p>
        <h3 className={cn("text-3xl font-bold tracking-tight mt-1 transition-colors", darkMode ? "text-zinc-100" : "text-zinc-900")}>{value}</h3>
      </div>
    </motion.div>
  );
};

export function Dashboard({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { user, isAdmin } = useAuth();
  const { darkMode, language } = useSettings();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sentReminders, setSentReminders] = useState<string[]>([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'analysis' | 'history'>('analysis');
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = translations[language] || translations.English;

  useEffect(() => {
    if (selectedPatient && !analysis && !isAnalyzing) {
      analyzePatient(selectedPatient);
    } else if (!selectedPatient && analysis) {
      setAnalysis(null);
      setModalTab('analysis');
    }
  }, [selectedPatient, analysis, isAnalyzing]);

  useEffect(() => {
    if (selectedPatient && modalTab === 'history') {
      fetchPatientHistory(selectedPatient.id);
    }
  }, [selectedPatient, modalTab]);

  const fetchPatientHistory = async (patientId: string) => {
    setIsLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'clinical_records'),
        where('patientId', '==', patientId),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'Clinical Analysis' }));
      
      // Also fetch prescriptions
      const pq = query(
        collection(db, 'prescriptions'),
        where('patientId', '==', patientId),
        orderBy('date', 'desc')
      );
      const psnapshot = await getDocs(pq);
      const prescriptions = psnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'Prescription' }));

      // Also fetch bills
      const bq = query(
        collection(db, 'bills'),
        where('patientId', '==', patientId),
        orderBy('date', 'desc')
      );
      const bsnapshot = await getDocs(bq);
      const bills = bsnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'Bill' }));

      const combined = [...records, ...prescriptions, ...bills].sort((a: any, b: any) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      setPatientHistory(combined);
    } catch (err) {
      console.error('Error fetching history:', err);
      toast.error('Failed to load patient history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    const patientsQuery = query(collection(db, 'patients'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribePatients = onSnapshot(patientsQuery, (snapshot) => {
      const patientData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(patientData);
      setIsLoading(false);
    }, (err) => {
      console.error("Patients fetch error:", err);
      setError(`Failed to fetch patients: ${err.message}. Code: ${err.code}`);
      setIsLoading(false);
    });

    const appointmentsQuery = query(collection(db, 'appointments'), orderBy('time'), limit(5));
    const unsubscribeAppointments = onSnapshot(appointmentsQuery, (snapshot) => {
      const appointmentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(appointmentData);
    }, (err) => {
      console.error("Appointments fetch error:", err);
    });

    const tasksQuery = query(
      collection(db, 'tasks'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'), 
      limit(20)
    );
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(taskData);
    }, (err) => {
      console.error("Tasks fetch error:", err);
    });

    const billsQuery = query(collection(db, 'bills'), orderBy('date', 'desc'), limit(50));
    const unsubscribeBills = onSnapshot(billsQuery, (snapshot) => {
      const billData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBills(billData);
    }, (err) => {
      console.error("Bills fetch error:", err);
    });

    const prescriptionsQuery = query(collection(db, 'prescriptions'), orderBy('date', 'desc'), limit(50));
    const unsubscribePrescriptions = onSnapshot(prescriptionsQuery, (snapshot) => {
      const prescriptionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPrescriptions(prescriptionData);
    }, (err) => {
      console.error("Prescriptions fetch error:", err);
    });

    return () => {
      unsubscribePatients();
      unsubscribeAppointments();
      unsubscribeTasks();
      unsubscribeBills();
      unsubscribePrescriptions();
    };
  }, [user]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim() || !user) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        text: newTask,
        completed: false,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      setNewTask('');
      toast.success('Task added');
    } catch (err) {
      console.error('Error adding task:', err);
      toast.error('Failed to add task');
    }
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        completed: !completed
      });
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    toast.error('Delete this task?', {
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await deleteDoc(doc(db, 'tasks', taskId));
            toast.success('Task deleted');
          } catch (err) {
            console.error('Error deleting task:', err);
            toast.error('Failed to delete task');
          }
        }
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {}
      }
    });
  };

  const downloadReport = async () => {
    setIsGeneratingPDF(true);
    const toastId = toast.loading('Generating PDF report...');
    
    try {
      const dashboardElement = document.getElementById('dashboard-content');
      if (!dashboardElement) throw new Error('Dashboard content not found');

      // Temporarily hide elements that shouldn't be in the PDF
      const actionButtons = dashboardElement.querySelectorAll('button');
      actionButtons.forEach(btn => btn.style.visibility = 'hidden');

      const imgData = await domToPng(dashboardElement, {
        scale: 2,
        backgroundColor: '#09090b',
        quality: 1,
        features: {
          // modern-screenshot has better support for modern CSS
        }
      });

      // Restore buttons
      actionButtons.forEach(btn => btn.style.visibility = 'visible');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      // We need to get the image dimensions to calculate height
      const img = new Image();
      img.src = imgData;
      await new Promise((resolve) => img.onload = resolve);
      
      const pdfHeight = (img.height * pdfWidth) / img.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Medsight_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success('Report downloaded successfully', { id: toastId });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate report. Try again.', { id: toastId });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const sendReminder = async (patientOrName: Patient | string, date?: string, time?: string, silent = false) => {
    const patientName = typeof patientOrName === 'string' ? patientOrName : patientOrName.name;
    let toastId: string | number | undefined;
    if (!silent) {
      toastId = toast.loading(`Sending reminder to ${patientName}...`);
    }
    
    try {
      let email = typeof patientOrName === 'string' ? null : patientOrName.email;
      let patientId = typeof patientOrName === 'string' ? null : patientOrName.id;
      
      if (!email || !patientId) {
        const found = patients.find(p => p.name === patientName);
        email = found?.email || null;
        patientId = found?.id || null;
      }

      if (!email) {
        if (!silent) {
          toast.error(`No email address found for ${patientName}`, { id: toastId });
        }
        return;
      }

      let appointmentDate = date;
      let appointmentTime = time;

      // If date/time not provided, try to fetch the latest upcoming appointment
      if (!appointmentDate || !appointmentTime) {
        try {
          const q = query(
            collection(db, 'appointments'),
            where('patientName', '==', patientName),
            where('date', '>=', new Date().toISOString().split('T')[0]),
            orderBy('date', 'asc'),
            limit(1)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const app = snapshot.docs[0].data();
            appointmentDate = app.date;
            appointmentTime = app.time;
          }
        } catch (err) {
          console.error('Error fetching appointment for reminder:', err);
        }
      }

      const appointmentInfo = appointmentDate && appointmentTime 
        ? ` scheduled for ${appointmentDate} at ${appointmentTime}` 
        : '';

      const response = await fetchWithRetry('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `${t.reminderSubject}: ${appointmentDate ? appointmentDate : 'Upcoming'} Check-up - MedSight 2.0`,
          text: `Hello ${patientName},\n\nThis is a professional reminder from MedSight 2.0 regarding your upcoming medical check-up${appointmentInfo}.\n\n${t.appointmentDetails}:\n- ${t.date}: ${appointmentDate || 'To be confirmed'}\n- ${t.time}: ${appointmentTime || 'To be confirmed'}\n- ${t.location}: MedSight Clinical Center\n\n${t.instructions}: ${t.arriveEarly}\n\n${t.contact}: ${t.rescheduleNote}\n\nBest regards,\nMedSight 2.0 Clinical Team`,
          html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; color: #1f2937; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
              <div style="background-color: #10b981; padding: 30px 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">MedSight 2.0</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Agentic AI Healthcare Platform</p>
              </div>
              
              <div style="padding: 40px 30px;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #111827;">${t.reminderSubject}</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #4b5563; margin-bottom: 25px;">
                  Hello <strong>${patientName}</strong>,<br/><br/>
                  This is a friendly reminder regarding your upcoming medical check-up at <strong>MedSight 2.0 Clinical Center</strong>.
                </p>
                
                <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
                  <h3 style="margin: 0 0 15px 0; font-size: 14px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">${t.appointmentDetails}</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">${t.date}:</td>
                      <td style="padding: 8px 0; color: #111827; font-size: 15px; font-weight: 600;">${appointmentDate || 'To be confirmed'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${t.time}:</td>
                      <td style="padding: 8px 0; color: #111827; font-size: 15px; font-weight: 600;">${appointmentTime || 'To be confirmed'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${t.location}:</td>
                      <td style="padding: 8px 0; color: #111827; font-size: 15px; font-weight: 600;">MedSight Clinical Center</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px;">
                  <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                    <strong>${t.instructions}:</strong> ${t.arriveEarly}
                  </p>
                </div>
                
                <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
                  ${t.rescheduleNote}
                </p>
              </div>
              
              <div style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #4b5563;">Best regards,</p>
                <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: 700; color: #111827;">MedSight 2.0 Clinical Team</p>
                <div style="margin-top: 20px; font-size: 11px; color: #9ca3af;">
                  This is an automated message. Please do not reply directly to this email.
                </div>
              </div>
            </div>
          `
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response received:", text);
        throw new Error(`Server returned an unexpected response format (${response.status}). Please try again.`);
      }

      const data = await response.json();
      if (data.success) {
        if (data.simulated) {
          if (!silent) {
            toast.success(`Reminder simulated for ${patientName}`, { 
              id: toastId,
              description: "SMTP keys missing in .env, but the logic is ready."
            });
          }
        } else {
          if (!silent) {
            toast.success(`Reminder sent to ${patientName}`, { id: toastId });
          }
        }
        setSentReminders(prev => [...prev, patientName]);
      } else {
        throw new Error(data.error || 'Failed to send email');
      }
    } catch (err: any) {
      console.error('Error sending reminder:', err);
      if (!silent) {
        toast.error(`Failed to send reminder: ${err.message}`, { id: toastId });
      }
      throw err;
    }
  };

  const playBuzzerSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5); // A4

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio context not supported", e);
    }
  };

  const sendAllReminders = async () => {
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = appointments.filter(app => 
      app.date === today && !sentReminders.includes(app.patientName)
    );
    
    if (todayAppointments.length === 0) {
      toast.info('All reminders for today have already been sent.');
      return;
    }

    playBuzzerSound();
    const toastId = toast.loading(`Sending ${todayAppointments.length} reminders...`);
    
    let successCount = 0;
    let failCount = 0;

    for (const app of todayAppointments) {
      try {
        await sendReminder(app.patientName, app.date, app.time, true);
        successCount++;
      } catch (err) {
        failCount++;
      }
    }
    
    if (failCount === 0) {
      toast.success(`Successfully sent ${successCount} reminders`, { id: toastId });
    } else {
      toast.warning(`Sent ${successCount} reminders, ${failCount} failed`, { id: toastId });
    }
  };

  const totalRevenue = bills.reduce((acc, bill) => acc + (Number(bill.amount) || 0), 0);
  const pendingBills = bills.filter(bill => bill.status === 'pending').length;
  const upcomingAppointments = appointments.filter(app => new Date(app.date) >= new Date()).length;

  const saveAnalysis = async () => {
    if (!selectedPatient || !analysis) return;
    
    setIsSaving(true);
    try {
      const recordData = {
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        analysis: analysis,
        date: new Date().toISOString(),
        userId: auth.currentUser?.uid
      };
      
      await addDoc(collection(db, 'clinical_records'), recordData);
      toast.success('Analysis saved to patient records');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save analysis');
    } finally {
      setIsSaving(false);
    }
  };

  const analyzePatient = async (patient: Patient) => {
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const prompt = `Analyze the following patient data and provide a clinical summary, potential risks, and suggested next steps for a doctor:
      Name: ${patient.name}
      Age: ${patient.age}
      Gender: ${patient.gender}
      Diagnosis: ${patient.diagnosis}
      Status: ${patient.status}
      Last Visit: ${patient.lastVisit}
      
      Provide the analysis in a professional medical format with sections for Summary, Risks, and Recommendations.`;
      const response = await getGroqResponse([{ role: 'user', content: prompt }]);
      setAnalysis(response);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const seedSampleData = async () => {
    if (!isAdmin) return;
    const toastId = toast.loading('Seeding sample data...');
    try {
      const samplePatients = [
        { name: 'John Doe', age: 45, gender: 'Male', status: 'Stable', diagnosis: 'Hypertension', email: 'john@example.com', phone: '123-456-7890', lastVisit: new Date().toISOString(), createdAt: serverTimestamp() },
        { name: 'Jane Smith', age: 32, gender: 'Female', status: 'Recovering', diagnosis: 'Post-op recovery', email: 'jane@example.com', phone: '098-765-4321', lastVisit: new Date().toISOString(), createdAt: serverTimestamp() },
        { name: 'Robert Brown', age: 68, gender: 'Male', status: 'Critical', diagnosis: 'Cardiac arrest', email: 'robert@example.com', phone: '555-0199', lastVisit: new Date().toISOString(), createdAt: serverTimestamp() }
      ];

      for (const patient of samplePatients) {
        await addDoc(collection(db, 'patients'), patient);
      }

      const sampleAppointments = [
        { time: '09:00 AM', patientName: 'John Doe', type: 'Checkup', date: new Date().toISOString().split('T')[0], createdAt: serverTimestamp() },
        { time: '10:30 AM', patientName: 'Jane Smith', type: 'Follow-up', date: new Date().toISOString().split('T')[0], createdAt: serverTimestamp() }
      ];

      for (const appointment of sampleAppointments) {
        await addDoc(collection(db, 'appointments'), appointment);
      }

      toast.success('Sample data seeded successfully!', { id: toastId });
      setError(null);
      refreshData();
    } catch (err: any) {
      console.error('Error seeding data:', err);
      toast.error(`Failed to seed data: ${err.message}`, { id: toastId });
    }
  };

  const refreshData = () => {
    setIsLoading(true);
    // The onSnapshot listeners will automatically re-fetch if needed, 
    // but setting isLoading to true and back to false gives visual feedback.
    setTimeout(() => setIsLoading(false), 500);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-12rem)] flex flex-col items-center justify-center gap-4 text-center">
        <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl">
          <AlertCircle size={48} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-100">Connection Error</h3>
          <p className="text-zinc-400 mt-2">{error}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-zinc-100 text-zinc-900 rounded-xl font-bold hover:bg-zinc-200 transition-all"
          >
            Retry Connection
          </button>
          {isAdmin && (
            <button 
              onClick={seedSampleData}
              className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all"
            >
              Seed Sample Data
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" id="dashboard-content">
      <header className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-4xl font-bold tracking-tight transition-colors", darkMode ? "text-zinc-100" : "text-zinc-900")}>{t.dashboard}</h1>
          <p className={cn("mt-2 transition-colors", darkMode ? "text-zinc-400" : "text-zinc-500")}>{t.welcome}, {user?.displayName || 'Doctor'}. {t.happeningToday}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={refreshData}
            className={cn(
              "p-4 border rounded-2xl transition-all shadow-sm",
              darkMode ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            )}
            title={t.refresh}
          >
            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={downloadReport}
            disabled={isGeneratingPDF}
            className={cn(
              "px-5 py-2.5 border rounded-2xl font-bold text-sm transition-all flex items-center gap-2",
              darkMode ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            )}
          >
            {isGeneratingPDF ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {t.download}
          </button>
          {isAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 bg-emerald-500 text-white rounded-2xl font-bold text-sm hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <UserPlus size={18} />
              {t.addPatient}
            </button>
          )}
          <button 
            onClick={() => setIsAppointmentModalOpen(true)}
            className={cn(
              "px-5 py-2.5 border rounded-2xl font-medium text-sm transition-all",
              darkMode ? "bg-zinc-900 border-zinc-800 text-zinc-100 hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50"
            )}
          >
            {t.schedule}
          </button>
        </div>
      </header>

      <AddPatientModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />

      <AddAppointmentModal 
        isOpen={isAppointmentModalOpen} 
        onClose={() => setIsAppointmentModalOpen(false)} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t.totalPatients} value={patients.length > 0 ? patients.length.toLocaleString() : "0"} icon={Users} trend="+12%" color="bg-blue-500" />
        <StatCard title={t.activeCases} value={patients.filter(p => p.status === 'Critical').length.toString()} icon={Activity} trend="+5%" color="bg-emerald-500" />
        <StatCard title={t.appointments} value={upcomingAppointments.toString()} icon={CalendarIcon} trend={t.today} color="bg-amber-500" />
        <StatCard title={t.totalRevenue} value={`₹${totalRevenue.toLocaleString()}`} icon={DollarSign} trend={`${pendingBills} ${t.pending}`} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className={cn("rounded-3xl border shadow-sm overflow-hidden transition-colors", darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200")}>
            <div className={cn("p-6 border-b flex items-center justify-between", darkMode ? "border-zinc-800" : "border-zinc-200")}>
              <h2 className={cn("text-xl font-bold transition-colors", darkMode ? "text-zinc-100" : "text-zinc-900")}>{t.recentPatients}</h2>
              <button 
                onClick={() => setActiveTab('patients')}
                className="text-emerald-400 text-sm font-bold hover:underline"
              >
                {t.viewAll}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={darkMode ? "bg-zinc-950/50" : "bg-zinc-50"}>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.patient}</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.status}</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.diagnosis}</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t.lastVisit}</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y transition-colors", darkMode ? "divide-zinc-800" : "divide-zinc-200")}>
                  {patients.length > 0 ? patients.map((patient) => (
                    <tr 
                      key={patient.id} 
                      className={cn(
                        "transition-colors cursor-pointer group",
                        darkMode ? "hover:bg-zinc-800/50" : "hover:bg-zinc-50"
                      )}
                      onClick={() => {
                        setSelectedPatient(patient);
                        analyzePatient(patient);
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold overflow-hidden transition-colors", darkMode ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500")}>
                            {patient.profileImage ? (
                              <img src={patient.profileImage} alt={patient.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              patient.name.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className={cn("font-bold transition-colors", darkMode ? "text-zinc-100" : "text-zinc-900")}>{patient.name}</p>
                            <p className="text-xs text-zinc-500">{patient.age}{t.years.charAt(0)}, {patient.gender}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold",
                          patient.status === 'Stable' && "bg-emerald-500/10 text-emerald-400",
                          patient.status === 'Recovering' && "bg-blue-500/10 text-blue-400",
                          patient.status === 'Critical' && "bg-red-500/10 text-red-400"
                        )}>
                          {t[patient.status.toLowerCase()] || patient.status}
                        </span>
                      </td>
                      <td className={cn("px-6 py-4 text-sm transition-colors", darkMode ? "text-zinc-400" : "text-zinc-600")}>{patient.diagnosis}</td>
                      <td className="px-6 py-4 text-sm text-zinc-500">{patient.lastVisit}</td>
                      <td className="px-6 py-4">
                        <ChevronRight size={16} className="text-zinc-700 group-hover:text-emerald-400 transition-colors" />
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-600 text-sm">
                        {t.noPatients}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={cn("rounded-3xl border shadow-sm p-6 transition-colors", darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200")}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={cn("text-xl font-bold transition-colors", darkMode ? "text-zinc-100" : "text-zinc-900")}>{t.todoList}</h2>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                {tasks.filter(t => t.completed).length}/{tasks.length} COMPLETED
              </div>
            </div>
            
            <form onSubmit={addTask} className="flex gap-2 mb-6">
              <input 
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder={t.noTasks.split('.')[0] + "..."}
                className={cn(
                  "flex-1 border rounded-xl px-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500",
                  darkMode ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-zinc-50 border-zinc-200 text-zinc-900"
                )}
              />
              <button 
                type="submit"
                disabled={!newTask.trim()}
                className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-all"
              >
                <Plus size={20} />
              </button>
            </form>

            <div className="space-y-3">
              {tasks.length > 0 ? tasks.map((task) => (
                <div key={task.id} className={cn(
                  "group flex items-center gap-3 p-3 rounded-2xl border transition-all",
                  darkMode ? "bg-zinc-950 border-zinc-800 hover:border-zinc-700" : "bg-zinc-50 border-zinc-200 hover:border-zinc-300"
                )}>
                  <button 
                    onClick={() => toggleTask(task.id, task.completed)}
                    className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                      task.completed 
                        ? "bg-emerald-500 border-emerald-500 text-white" 
                        : "border-zinc-800 text-transparent hover:border-emerald-500"
                    )}
                  >
                    <Check size={14} />
                  </button>
                  <span className={cn(
                    "flex-1 text-sm transition-all",
                    task.completed ? "text-zinc-600 line-through" : "text-zinc-100"
                  )}>
                    {task.text}
                  </span>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="p-2 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )) : (
                <div className="text-center py-8 text-zinc-600 text-sm italic">
                  No tasks yet. Plan your day!
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-8">
          <FeatureVideo />
          
          <div className="bg-zinc-900 rounded-3xl border border-zinc-800 shadow-sm p-6 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-100">Today's Schedule</h2>
            <button 
              onClick={sendAllReminders}
              className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all group relative"
              title="Send all reminders for today"
            >
              <Bell size={18} className="group-hover:animate-ring" />
            </button>
          </div>
          <div className="space-y-6 flex-1 overflow-y-auto pr-2">
            {appointments.length > 0 ? appointments.map((item, i) => (
              <div key={i} className="flex gap-4 group">
                <div className="text-sm font-bold text-zinc-500 w-20 shrink-0">{item.time}</div>
                <div className="flex-1 pb-6 border-l-2 border-zinc-800 pl-6 relative">
                  <div className={cn("absolute -left-[9px] top-0 p-1 bg-zinc-900", 
                    item.type === 'Emergency' ? 'text-red-400' : 
                    item.type === 'Follow-up' ? 'text-blue-400' : 
                    'text-emerald-400'
                  )}>
                    {item.type === 'Emergency' ? <AlertCircle size={16} /> : 
                     item.type === 'Follow-up' ? <Clock size={16} /> : 
                     <CheckCircle2 size={16} />}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-zinc-100">{item.patientName}</p>
                      <p className="text-xs text-zinc-500">{item.type}</p>
                    </div>
                    <button 
                      onClick={() => sendReminder(item.patientName, item.date, item.time)}
                      disabled={sentReminders.includes(item.patientName)}
                      className={cn(
                        "p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100",
                        sentReminders.includes(item.patientName) 
                          ? "bg-emerald-500/10 text-emerald-400" 
                          : "bg-zinc-800 text-zinc-500 hover:bg-emerald-500 hover:text-white"
                      )}
                      title="Send Reminder"
                    >
                      {sentReminders.includes(item.patientName) ? <CheckCircle2 size={16} /> : <SendIcon size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Calendar size={32} className="text-zinc-800 mb-2" />
                <p className="text-zinc-600 text-sm font-medium">No appointments scheduled</p>
              </div>
            )}
          </div>
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <div className="bg-zinc-950 p-4 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                {sentReminders.length}
              </div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Reminders Sent Today</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AnimatePresence>
        {selectedPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl border border-zinc-800 overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500 text-white flex items-center justify-center text-2xl font-bold overflow-hidden">
                    {selectedPatient.profileImage ? (
                      <img src={selectedPatient.profileImage} alt={selectedPatient.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      selectedPatient.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100">{selectedPatient.name}</h2>
                    <p className="text-zinc-500 font-medium">Patient ID: #{selectedPatient.id}0024</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPatient(null)}
                  className="p-3 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-500 hover:text-zinc-100"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                      <FileText size={16} className="text-emerald-400" />
                      Patient Info
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Age</span>
                        <span className="font-bold text-zinc-100">{selectedPatient.age} years</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Gender</span>
                        <span className="font-bold text-zinc-100">{selectedPatient.gender}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Status</span>
                        <span className="font-bold text-emerald-400">{selectedPatient.status}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Last Visit</span>
                        <span className="font-bold text-zinc-100">{selectedPatient.lastVisit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                      <Phone size={16} className="text-emerald-400" />
                      Contact Info
                    </h3>
                    <div className="space-y-3">
                      {selectedPatient.email && (
                        <a href={`mailto:${selectedPatient.email}`} className="flex items-center gap-2 text-sm hover:text-emerald-400 transition-colors">
                          <Mail size={14} className="text-zinc-500" />
                          <span className="font-bold text-zinc-100 truncate">{selectedPatient.email}</span>
                        </a>
                      )}
                      {selectedPatient.phone && (
                        <a href={`tel:${selectedPatient.phone}`} className="flex items-center gap-2 text-sm hover:text-blue-400 transition-colors">
                          <Phone size={14} className="text-zinc-500" />
                          <span className="font-bold text-zinc-100">{selectedPatient.phone}</span>
                        </a>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedPatient(null);
                        setActiveTab('prescriptions');
                      }}
                      className="w-full py-3 bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      <FileText size={14} />
                      Create Prescription
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedPatient(null);
                        setActiveTab('billing');
                      }}
                      className="w-full py-3 bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      <CreditCard size={14} />
                      Generate Bill
                    </button>
                    <button 
                      onClick={() => sendReminder(selectedPatient.name)}
                      disabled={sentReminders.includes(selectedPatient.name)}
                      className={cn(
                        "w-full py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                        sentReminders.includes(selectedPatient.name)
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-emerald-500 hover:text-emerald-400"
                      )}
                    >
                      {sentReminders.includes(selectedPatient.name) ? (
                        <>
                          <CheckCircle2 size={14} />
                          Reminder Sent
                        </>
                      ) : (
                        <>
                          <SendIcon size={14} />
                          Send Appointment Reminder
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-100">
                      <Brain size={16} className="text-emerald-400" />
                      AI Insights
                    </h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Medsight AI analyzes clinical data to provide real-time decision support.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-8 min-h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-6 border-b border-zinc-800 pb-4">
                      <div className="flex gap-6">
                        <button 
                          onClick={() => setModalTab('analysis')}
                          className={cn(
                            "pb-4 text-sm font-bold uppercase tracking-widest transition-all relative",
                            modalTab === 'analysis' ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          Clinical Analysis
                          {modalTab === 'analysis' && (
                            <motion.div layoutId="modalTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
                          )}
                        </button>
                        <button 
                          onClick={() => setModalTab('history')}
                          className={cn(
                            "pb-4 text-sm font-bold uppercase tracking-widest transition-all relative",
                            modalTab === 'history' ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          Medical History
                          {modalTab === 'history' && (
                            <motion.div layoutId="modalTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
                          )}
                        </button>
                      </div>
                      {isAnalyzing && modalTab === 'analysis' && <Loader2 size={20} className="animate-spin text-emerald-400" />}
                    </div>
                    
                    <div className="flex-1">
                      <AnimatePresence mode="wait">
                        {modalTab === 'analysis' ? (
                          <motion.div 
                            key="analysis"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                          >
                            {isAnalyzing ? (
                              <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-zinc-500 font-medium animate-pulse">Analyzing clinical history...</p>
                              </div>
                            ) : analysis ? (
                              <div className="markdown-body">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-6">
                                  <Sparkles size={14} />
                                  AI GENERATED REPORT
                                </div>
                                <ReactMarkdown>{analysis}</ReactMarkdown>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                                <Brain size={48} className="text-zinc-800" />
                                <p className="text-zinc-600 text-sm">No analysis available.</p>
                              </div>
                            )}
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="history"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-4"
                          >
                            {isLoadingHistory ? (
                              <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <Loader2 size={32} className="animate-spin text-emerald-500" />
                                <p className="text-zinc-500">Loading history...</p>
                              </div>
                            ) : patientHistory.length > 0 ? (
                              <div className="space-y-4">
                                {patientHistory.map((item) => (
                                  <div key={item.id} className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all group">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className={cn(
                                          "p-1.5 rounded-lg",
                                          item.type === 'Clinical Analysis' ? "bg-emerald-500/10 text-emerald-400" :
                                          item.type === 'Prescription' ? "bg-blue-500/10 text-blue-400" :
                                          "bg-amber-500/10 text-amber-400"
                                        )}>
                                          {item.type === 'Clinical Analysis' ? <Brain size={14} /> :
                                           item.type === 'Prescription' ? <FileText size={14} /> :
                                           <CreditCard size={14} />}
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{item.type}</span>
                                      </div>
                                      <span className="text-[10px] font-bold text-zinc-500">{new Date(item.date).toLocaleDateString()}</span>
                                    </div>
                                    {item.type === 'Clinical Analysis' ? (
                                      <p className="text-sm text-zinc-300 line-clamp-2">{item.analysis}</p>
                                    ) : item.type === 'Prescription' ? (
                                      <div className="space-y-1">
                                        {item.medicines?.map((m: any, idx: number) => (
                                          <p key={idx} className="text-sm text-zinc-300">• {m.name} ({m.dosage})</p>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex justify-between items-center">
                                        <p className="text-sm text-zinc-300">Amount: ₹{item.amount}</p>
                                        <span className={cn(
                                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                                          item.status === 'paid' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                                        )}>{item.status}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                                <Clock size={48} className="text-zinc-800" />
                                <p className="text-zinc-600 text-sm">No historical records found.</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedPatient(null)}
                  className="px-6 py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                >
                  Close
                </button>
                <button 
                  onClick={saveAnalysis}
                  disabled={isSaving || !analysis}
                  className={cn(
                    "px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2",
                    (isSaving || !analysis) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {isSaving ? 'Saving...' : 'Save to Records'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
