import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  FileText, 
  Brain, 
  CreditCard, 
  ChevronRight, 
  Download,
  ArrowUpDown,
  User,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../lib/translations';
import { db } from '../lib/firebase';
import { collection, query, getDocs, orderBy, where, limit } from 'firebase/firestore';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { domToPng } from 'modern-screenshot';
import ReactMarkdown from 'react-markdown';

export function History() {
  const { darkMode, language } = useSettings();
  const t = translations[language] || translations.English;
  
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'analysis' | 'prescription' | 'bill'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'patient'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      // Fetch Clinical Records
      const crQuery = query(collection(db, 'clinical_records'), orderBy('date', 'desc'), limit(50));
      const crSnapshot = await getDocs(crQuery);
      const crData = crSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        type: 'analysis',
        label: 'Clinical Analysis'
      }));

      // Fetch Prescriptions
      const prQuery = query(collection(db, 'prescriptions'), orderBy('date', 'desc'), limit(50));
      const prSnapshot = await getDocs(prQuery);
      const prData = prSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        type: 'prescription',
        label: 'Prescription'
      }));

      // Fetch Bills
      const blQuery = query(collection(db, 'bills'), orderBy('date', 'desc'), limit(50));
      const blSnapshot = await getDocs(blQuery);
      const blData = blSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        type: 'bill',
        label: 'Bill'
      }));

      const combined = [...crData, ...prData, ...blData].sort((a: any, b: any) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setRecords(combined);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load history records');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = 
      record.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.patientId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || record.type === filterType;
    
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    } else {
      const nameA = a.patientName || '';
      const nameB = b.patientName || '';
      return sortOrder === 'desc' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
    }
  });

  const toggleSort = (field: 'date' | 'patient') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const exportAll = async () => {
    if (filteredRecords.length === 0) {
      toast.error('No records to export');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('Generating PDF report...');

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Header
      pdf.setFillColor(16, 185, 129); // Emerald-500
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('MedSight 2.0', 15, 20);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Medical History Export', 15, 28);
      pdf.text(`Generated on: ${new Date().toLocaleString()}`, 15, 34);

      // Table Header
      let y = 50;
      pdf.setFillColor(244, 244, 245); // Zinc-100
      pdf.rect(10, y, pageWidth - 20, 10, 'F');
      
      pdf.setTextColor(39, 39, 42); // Zinc-800
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Patient Name', 15, y + 6);
      pdf.text('Type', 65, y + 6);
      pdf.text('Date', 100, y + 6);
      pdf.text('Details', 130, y + 6);

      y += 15;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);

      filteredRecords.forEach((record, index) => {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }

        pdf.text(record.patientName || 'N/A', 15, y);
        pdf.text(record.label || 'N/A', 65, y);
        pdf.text(new Date(record.date).toLocaleDateString(), 100, y);
        
        let details = '';
        if (record.type === 'analysis') details = record.analysis?.substring(0, 40) + '...';
        else if (record.type === 'prescription') details = record.medicines?.map((m: any) => m.name).join(', ').substring(0, 40);
        else details = `₹${record.amount} - ${record.status}`;
        
        pdf.text(details || 'N/A', 130, y);
        
        pdf.setDrawColor(228, 228, 231); // Zinc-200
        pdf.line(10, y + 2, pageWidth - 10, y + 2);
        y += 8;
      });

      pdf.save(`MedSight_History_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Report exported successfully', { id: toastId });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className={cn(
            "text-4xl font-black tracking-tight transition-colors duration-300",
            darkMode ? "text-white" : "text-zinc-900"
          )}>
            {t.nav_history}
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Review and manage all historical medical records.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchHistory}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-emerald-400 transition-all"
            title="Refresh"
          >
            <ArrowUpDown size={20} />
          </button>
          <button 
            onClick={exportAll}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Export All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="text"
                  placeholder="Search by patient name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                {(['all', 'analysis', 'prescription', 'bill'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                      filterType === type 
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                        : "bg-zinc-950 text-zinc-500 border border-zinc-800 hover:border-zinc-700"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950/50">
                    <th 
                      className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => toggleSort('patient')}
                    >
                      <div className="flex items-center gap-2">
                        Patient
                        {sortBy === 'patient' && <ArrowUpDown size={12} className="text-emerald-500" />}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Type</th>
                    <th 
                      className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => toggleSort('date')}
                    >
                      <div className="flex items-center gap-2">
                        Date
                        {sortBy === 'date' && <ArrowUpDown size={12} className="text-emerald-500" />}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Details</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="animate-spin text-emerald-500" size={32} />
                          <p className="text-zinc-500 font-medium">Fetching records...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <tr key={record.id} className="group hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
                              {record.patientName?.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-zinc-100">{record.patientName}</p>
                              <p className="text-[10px] text-zinc-500 font-medium">ID: #{record.patientId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                            record.type === 'analysis' ? "bg-emerald-500/10 text-emerald-400" :
                            record.type === 'prescription' ? "bg-blue-500/10 text-blue-400" :
                            "bg-amber-500/10 text-amber-400"
                          )}>
                            {record.type === 'analysis' ? <Brain size={12} /> :
                             record.type === 'prescription' ? <FileText size={12} /> :
                             <CreditCard size={12} />}
                            {record.label}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Calendar size={14} />
                            <span className="text-xs font-medium">{new Date(record.date).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="text-xs text-zinc-500 truncate">
                            {record.type === 'analysis' ? record.analysis :
                             record.type === 'prescription' ? record.medicines?.map((m: any) => m.name).join(', ') :
                             `Amount: ₹${record.amount} - ${record.status}`}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setSelectedRecord(record)}
                            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-100 transition-all"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Clock size={48} className="text-zinc-800" />
                          <p className="text-zinc-500 font-medium">No records found matching your criteria.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-6 space-y-6">
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
              <Filter size={16} className="text-emerald-400" />
              Quick Stats
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Total Records</p>
                <p className="text-2xl font-black text-zinc-100">{records.length}</p>
              </div>
              
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">This Month</p>
                <p className="text-2xl font-black text-emerald-400">
                  {records.filter(r => new Date(r.date).getMonth() === new Date().getMonth()).length}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-4">Recent Activity</h4>
              <div className="space-y-4">
                {records.slice(0, 3).map((record) => (
                  <div key={record.id} className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      record.type === 'analysis' ? "bg-emerald-500/10 text-emerald-400" :
                      record.type === 'prescription' ? "bg-blue-500/10 text-blue-400" :
                      "bg-amber-500/10 text-amber-400"
                    )}>
                      {record.type === 'analysis' ? <Brain size={14} /> :
                       record.type === 'prescription' ? <FileText size={14} /> :
                       <CreditCard size={14} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-200 line-clamp-1">{record.patientName}</p>
                      <p className="text-[10px] text-zinc-500">{new Date(record.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-emerald-500 p-6 rounded-[2rem] text-white space-y-4 shadow-xl shadow-emerald-500/20">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">AI Insight</h3>
              <p className="text-emerald-100 text-xs mt-1 leading-relaxed">
                You have saved {records.filter(r => r.type === 'analysis').length} clinical analyses this month. This data helps in tracking patient progress more effectively.
              </p>
            </div>
            <button className="w-full py-3 bg-white text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all">
              View AI Summary
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-zinc-900 w-full max-w-2xl max-h-[85vh] rounded-[2.5rem] shadow-2xl border border-zinc-800 overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    selectedRecord.type === 'analysis' ? "bg-emerald-500/10 text-emerald-400" :
                    selectedRecord.type === 'prescription' ? "bg-blue-500/10 text-blue-400" :
                    "bg-amber-500/10 text-amber-400"
                  )}>
                    {selectedRecord.type === 'analysis' ? <Brain size={24} /> :
                     selectedRecord.type === 'prescription' ? <FileText size={24} /> :
                     <CreditCard size={24} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100">{selectedRecord.label}</h2>
                    <p className="text-zinc-500 text-xs font-medium">{new Date(selectedRecord.date).toLocaleString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="p-3 hover:bg-zinc-800 rounded-2xl transition-all text-zinc-500 hover:text-zinc-100"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
                      {selectedRecord.patientName?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-100">{selectedRecord.patientName}</p>
                      <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">Patient ID: #{selectedRecord.patientId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Status</p>
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-bold uppercase">Verified</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14} className="text-emerald-400" />
                    Record Details
                  </h3>
                  
                  <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800">
                    {selectedRecord.type === 'analysis' ? (
                      <div className="markdown-body">
                        <ReactMarkdown>{selectedRecord.analysis}</ReactMarkdown>
                      </div>
                    ) : selectedRecord.type === 'prescription' ? (
                      <div className="space-y-4">
                        {selectedRecord.medicines?.map((m: any, idx: number) => (
                          <div key={idx} className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex justify-between items-center">
                            <div>
                              <p className="text-sm font-bold text-zinc-100">{m.name}</p>
                              <p className="text-xs text-zinc-500">{m.dosage} • {m.frequency}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-zinc-500 font-bold uppercase">{m.duration}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                          <span className="text-zinc-500 text-sm">Total Amount</span>
                          <span className="text-2xl font-black text-zinc-100">₹{selectedRecord.amount}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Payment Status</p>
                            <p className="text-sm font-bold text-emerald-400 uppercase">{selectedRecord.status}</p>
                          </div>
                          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Payment Method</p>
                            <p className="text-sm font-bold text-zinc-100">Credit Card</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="px-6 py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                >
                  Close
                </button>
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <Printer size={18} />
                  Print Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
