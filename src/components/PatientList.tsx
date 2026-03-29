import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  ChevronRight, 
  Filter,
  UserPlus,
  MoreHorizontal,
  Download,
  Mail,
  Phone,
  Loader2,
  X,
  FileText,
  Activity,
  Sparkles,
  AlertCircle,
  Clock,
  CheckCircle2,
  Trash2,
  Send as SendIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Patient } from '@/types';
import { jsPDF } from 'jspdf';
import { domToPng } from 'modern-screenshot';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { getGroqResponse } from '@/services/groq';

import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, deleteDoc, doc, where, getDocs } from 'firebase/firestore';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '../contexts/AuthProvider';

import { AddPatientModal } from './AddPatientModal';

const mockPatients: Patient[] = [
  { id: '1', name: 'John Doe', age: 45, gender: 'Male', lastVisit: '2024-03-20', status: 'Stable', diagnosis: 'Hypertension', email: 'john.doe@example.com', phone: '+1 555-123-4567' },
  { id: '2', name: 'Jane Smith', age: 32, gender: 'Female', lastVisit: '2024-03-22', status: 'Recovering', diagnosis: 'Post-op recovery', email: 'jane.smith@example.com', phone: '+1 555-987-6543' },
  { id: '3', name: 'Robert Brown', age: 68, gender: 'Male', lastVisit: '2024-03-23', status: 'Critical', diagnosis: 'Pneumonia', email: 'robert.brown@example.com', phone: '+1 555-456-7890' },
  { id: '4', name: 'Emily White', age: 28, gender: 'Female', lastVisit: '2024-03-24', status: 'Stable', diagnosis: 'Routine checkup', email: 'emily.white@example.com', phone: '+1 555-321-0987' },
  { id: '5', name: 'Michael Wilson', age: 52, gender: 'Male', lastVisit: '2024-03-15', status: 'Stable', diagnosis: 'Diabetes Type 2', email: 'm.wilson@example.com', phone: '+1 555-111-2222' },
  { id: '6', name: 'Sarah Johnson', age: 41, gender: 'Female', lastVisit: '2024-03-18', status: 'Recovering', diagnosis: 'Asthma', email: 's.johnson@example.com', phone: '+1 555-333-4444' },
  { id: '7', name: 'David Miller', age: 75, gender: 'Male', lastVisit: '2024-03-10', status: 'Critical', diagnosis: 'Congestive Heart Failure', email: 'd.miller@example.com', phone: '+1 555-555-6666' },
  { id: '8', name: 'Lisa Anderson', age: 35, gender: 'Female', lastVisit: '2024-03-21', status: 'Stable', diagnosis: 'Thyroid Disorder', email: 'l.anderson@example.com', phone: '+1 555-777-8888' },
];

type SortKey = 'name' | 'age' | 'lastVisit' | 'status';

import { fetchWithRetry } from '../lib/fetchWithRetry';

export function PatientList() {
  const { isAdmin } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentPatientSearches');
    return saved ? JSON.parse(saved) : [];
  });
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

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
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast.error("Failed to generate AI analysis. Please check your Groq API key.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (selectedPatient && !analysis && !isAnalyzing) {
      analyzePatient(selectedPatient);
    } else if (!selectedPatient && analysis) {
      setAnalysis(null);
    }
  }, [selectedPatient, analysis, isAnalyzing]);

  useEffect(() => {
    // Fetch all patients for client-side sorting and filtering to handle "different date formats"
    const patientsQuery = query(collection(db, 'patients'));
    const unsubscribe = onSnapshot(patientsQuery, (snapshot) => {
      const patientData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(patientData);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'patients'));

    return () => unsubscribe();
  }, []);

  const addToRecentSearches = (query: string) => {
    if (!query.trim()) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== query);
      const updated = [query, ...filtered].slice(0, 5);
      localStorage.setItem('recentPatientSearches', JSON.stringify(updated));
      return updated;
    });
  };

  const downloadReport = async () => {
    setIsGeneratingPDF(true);
    const toastId = toast.loading('Generating Patient Directory report...');
    
    try {
      const tableElement = document.getElementById('patient-table-container');
      if (!tableElement) throw new Error('Table content not found');

      // Hide action buttons for PDF
      const actionButtons = tableElement.querySelectorAll('button');
      actionButtons.forEach(btn => btn.style.visibility = 'hidden');

      const imgData = await domToPng(tableElement, {
        scale: 2,
        backgroundColor: '#09090b',
        quality: 1
      });

      // Restore buttons
      actionButtons.forEach(btn => btn.style.visibility = 'visible');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
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

      pdf.save(`Patient_Directory_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success('Directory report downloaded', { id: toastId });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate report. Try again.', { id: toastId });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const sendReminder = async (patient: Patient) => {
    const toastId = toast.loading(`Sending reminder to ${patient.name}...`);
    try {
      if (!patient.email) {
        toast.error('No email address found for this patient', { id: toastId });
        return;
      }

      // Fetch the latest upcoming appointment for this patient
      let appointmentInfo = '';
      try {
        const q = query(
          collection(db, 'appointments'),
          where('patientId', '==', patient.id),
          where('date', '>=', new Date().toISOString().split('T')[0]),
          orderBy('date', 'asc'),
          limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const app = snapshot.docs[0].data();
          appointmentInfo = ` scheduled for ${app.date} at ${app.time}`;
        }
      } catch (err) {
        console.error('Error fetching appointment for reminder:', err);
      }

      const response = await fetchWithRetry('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: patient.email,
          subject: `Medical Appointment Reminder - MedSight AI`,
          text: `Hello ${patient.name},\n\nThis is a friendly reminder from MedSight AI regarding your upcoming medical check-up${appointmentInfo}. Please ensure you are available at your scheduled time.\n\nBest regards,\nMedSight AI Team`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #10b981; margin: 0;">MedSight AI</h1>
                <p style="color: #666; margin: 5px 0;">Clinical Intelligence Platform</p>
              </div>
              <h2 style="color: #1f2937; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Medical Appointment Reminder</h2>
              <p>Hello <strong>${patient.name}</strong>,</p>
              <p>This is a friendly reminder from <strong>MedSight AI</strong> regarding your upcoming medical check-up${appointmentInfo}.</p>
              <p>Please ensure you are available at your scheduled time. If you need to reschedule or have any questions, please contact our clinic directly.</p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #4b5563; font-size: 14px;"><strong>Note:</strong> This is an automated reminder. Please do not reply directly to this email.</p>
              </div>
              <p>Best regards,<br/><strong>MedSight AI Team</strong></p>
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
          toast.success(`Reminder simulated for ${patient.name}`, { 
            id: toastId,
            description: "SMTP keys missing in .env, but the logic is ready."
          });
        } else {
          toast.success(`Reminder sent to ${patient.name}`, { id: toastId });
        }
      } else {
        throw new Error(data.error || 'Failed to send email');
      }
    } catch (err: any) {
      console.error('Error sending reminder:', err);
      toast.error(`Failed to send reminder: ${err.message}`, { id: toastId });
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleDeletePatient = async (patientId: string, patientName: string) => {
    toast(`Are you sure you want to delete patient ${patientName}?`, {
      action: {
        label: 'Delete',
        onClick: async () => {
          const toastId = toast.loading(`Deleting ${patientName}...`);
          try {
            await deleteDoc(doc(db, 'patients', patientId));
            toast.success('Patient deleted successfully', { id: toastId });
          } catch (error: any) {
            console.error('Error deleting patient:', error);
            toast.error(`Failed to delete patient: ${error.message}`, { id: toastId });
          }
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
    });
  };

  const filteredAndSortedPatients = useMemo(() => {
    const filtered = patients
      .filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
        return matchesSearch && matchesStatus;
      });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'lastVisit') {
        const dateA = new Date(a.lastVisit).getTime();
        const dateB = new Date(b.lastVisit).getTime();
        comparison = isNaN(dateA) || isNaN(dateB) 
          ? a.lastVisit.localeCompare(b.lastVisit) 
          : dateA - dateB;
      } else if (typeof a[sortKey] === 'string') {
        comparison = (a[sortKey] as string).localeCompare(b[sortKey] as string);
      } else {
        comparison = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [patients, searchQuery, filterStatus, sortKey, sortOrder]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">Patient Directory</h1>
          <p className="text-zinc-400 mt-2">Manage and view all registered patients in your clinical practice.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={downloadReport}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all"
          >
            {isGeneratingPDF ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Export PDF
          </button>
          {isAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-2xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
            >
              <UserPlus size={18} />
              Add Patient
            </button>
          )}
        </div>
      </header>

      <AddPatientModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />

      <div id="patient-table-container" className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-800 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input 
                type="text"
                placeholder="Search by name or diagnosis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => addToRecentSearches(searchQuery)}
                className="w-full pl-12 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-2">
                <Filter size={18} className="text-zinc-500" />
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-transparent text-sm font-bold text-zinc-400 focus:outline-none cursor-pointer"
                >
                  <option value="All" className="bg-zinc-950">All Status</option>
                  <option value="Stable" className="bg-zinc-950">Stable</option>
                  <option value="Recovering" className="bg-zinc-950">Recovering</option>
                  <option value="Critical" className="bg-zinc-950">Critical</option>
                </select>
              </div>
            </div>
          </div>

          {recentSearches.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider shrink-0">Recent:</span>
              {recentSearches.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSearchQuery(s)}
                  className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-full text-xs text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-all whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950/50">
                <th 
                  className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Patient
                    <ArrowUpDown size={14} className={sortKey === 'name' ? 'text-emerald-500' : 'text-zinc-700'} />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    <ArrowUpDown size={14} className={sortKey === 'status' ? 'text-emerald-500' : 'text-zinc-700'} />
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Diagnosis</th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                  onClick={() => handleSort('age')}
                >
                  <div className="flex items-center gap-2">
                    Age
                    <ArrowUpDown size={14} className={sortKey === 'age' ? 'text-emerald-500' : 'text-zinc-700'} />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                  onClick={() => handleSort('lastVisit')}
                >
                  <div className="flex items-center gap-2">
                    Last Visit
                    <ArrowUpDown size={14} className={sortKey === 'lastVisit' ? 'text-emerald-500' : 'text-zinc-700'} />
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 size={24} className="animate-spin text-emerald-500 mx-auto" />
                  </td>
                </tr>
              ) : filteredAndSortedPatients.map((patient) => (
                <motion.tr 
                  layout
                  key={patient.id} 
                  className="hover:bg-zinc-950/50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-400 transition-colors overflow-hidden">
                        {patient.profileImage ? (
                          <img src={patient.profileImage} alt={patient.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          patient.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-100">{patient.name}</p>
                        <p className="text-xs text-zinc-500">{patient.gender}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      patient.status === 'Stable' && "bg-emerald-500/10 text-emerald-400",
                      patient.status === 'Recovering' && "bg-blue-500/10 text-blue-400",
                      patient.status === 'Critical' && "bg-red-500/10 text-red-400"
                    )}>
                      {patient.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400 font-medium">{patient.diagnosis}</td>
                  <td className="px-6 py-4 text-sm text-zinc-100 font-bold">{patient.age}y</td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{patient.lastVisit}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {patient.email ? (
                        <a 
                          href={`mailto:${patient.email}`}
                          className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-emerald-400 transition-all" 
                          title={patient.email}
                        >
                          <Mail size={16} />
                        </a>
                      ) : (
                        <button className="p-2 text-zinc-800 cursor-not-allowed" title="No email provided">
                          <Mail size={16} />
                        </button>
                      )}
                      {patient.phone ? (
                        <a 
                          href={`tel:${patient.phone}`}
                          className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-blue-400 transition-all" 
                          title={patient.phone}
                        >
                          <Phone size={16} />
                        </a>
                      ) : (
                        <button className="p-2 text-zinc-800 cursor-not-allowed" title="No phone provided">
                          <Phone size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePatient(patient.id, patient.name);
                              }}
                              className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-400 transition-all"
                              title="Delete Patient"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedPatient(patient);
                              analyzePatient(patient);
                            }}
                            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-100 transition-all"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedPatient(patient);
                              analyzePatient(patient);
                            }}
                            className="p-2 hover:bg-emerald-500/10 rounded-lg text-zinc-700 group-hover:text-emerald-400 transition-all"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          
          {filteredAndSortedPatients.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center text-zinc-700 mx-auto mb-4">
                <Search size={32} />
              </div>
              <p className="text-zinc-100 font-bold">No patients found</p>
              <p className="text-zinc-500 text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
        
        <div className="p-6 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Showing {filteredAndSortedPatients.length} patients
          </p>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-600 cursor-not-allowed">Previous</button>
            <button className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-100 hover:bg-zinc-800 transition-all">Next</button>
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
                        <span className={cn(
                          "font-bold",
                          selectedPatient.status === 'Stable' ? "text-emerald-400" : 
                          selectedPatient.status === 'Critical' ? "text-red-400" : "text-blue-400"
                        )}>{selectedPatient.status}</span>
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
                      onClick={() => sendReminder(selectedPatient)}
                      className="w-full py-3 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl text-xs font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                    >
                      <SendIcon size={14} className="text-emerald-400" />
                      Send Email Reminder
                    </button>
                  </div>

                  <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                      <Activity size={16} className="text-emerald-400" />
                      Vital Signs
                    </h3>
                    <div className="space-y-4">
                      <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Blood Pressure</p>
                        <p className="text-lg font-bold text-zinc-100">120/80 <span className="text-xs text-zinc-500 font-medium">mmHg</span></p>
                      </div>
                      <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Heart Rate</p>
                        <p className="text-lg font-bold text-zinc-100">72 <span className="text-xs text-zinc-500 font-medium">bpm</span></p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-zinc-950 p-8 rounded-[2rem] border border-zinc-800 min-h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                        <Sparkles size={20} className="text-emerald-400" />
                        AI Clinical Consultant
                      </h3>
                      {isAnalyzing && <Loader2 size={20} className="animate-spin text-emerald-500" />}
                    </div>

                    <div className="flex-1 text-zinc-300 leading-relaxed">
                      {isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                            <Loader2 size={24} className="animate-spin text-emerald-500" />
                          </div>
                          <p className="text-sm font-medium text-zinc-500">Medsight AI is analyzing patient history...</p>
                        </div>
                      ) : analysis ? (
                        <div className="markdown-body prose prose-invert max-w-none">
                          <ReactMarkdown>{analysis}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                          <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-700">
                            <Sparkles size={24} />
                          </div>
                          <p className="text-sm font-medium text-zinc-500">Select a patient to generate AI clinical insights.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
