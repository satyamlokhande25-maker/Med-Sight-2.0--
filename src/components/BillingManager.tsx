import React, { useState } from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, query, where, orderBy, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { CreditCard, Plus, Download, Trash2, Search, DollarSign, Receipt, CheckCircle, Clock, IndianRupee } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { Patient, Bill } from '../types';

import { AuthProvider, useAuth } from '../contexts/AuthProvider';

export function BillingManager() {
  const { isSuperAdmin } = useAuth();
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newBill, setNewBill] = useState({
    patientId: '',
    patientName: '',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    status: 'pending' as 'pending' | 'paid',
    items: [{ description: '', price: 0 }]
  });

  const [currency, setCurrency] = useState('INR');

  const [patientsValue] = useCollection(collection(db, 'patients'));
  const patients = patientsValue?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)) || [];

  const [billsValue] = useCollection(
    query(collection(db, 'bills'), orderBy('date', 'desc'))
  );
  const bills = billsValue?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill)) || [];

  const handleAddItem = () => {
    setNewBill({
      ...newBill,
      items: [...newBill.items, { description: '', price: 0 }]
    });
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const updatedItems = [...newBill.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate total amount
    const total = updatedItems.reduce((sum, item) => sum + Number(item.price), 0);
    setNewBill({ ...newBill, items: updatedItems, amount: total });
  };

  const handleDeleteBill = async (billId: string, patientName: string) => {
    toast(`Are you sure you want to delete the bill for ${patientName}?`, {
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await deleteDoc(doc(db, 'bills', billId));
            toast.success('Bill deleted successfully');
          } catch (error) {
            console.error('Error deleting bill:', error);
            toast.error('Failed to delete bill');
          }
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
    });
  };

  const handleSave = async () => {
    if (!newBill.patientId || newBill.amount <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const selectedPatient = patients.find(p => p.id === newBill.patientId);
      await addDoc(collection(db, 'bills'), {
        ...newBill,
        patientName: selectedPatient?.name || 'Unknown',
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });
      toast.success('Bill generated successfully');
      setShowNewModal(false);
      setNewBill({
        patientId: '',
        patientName: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        status: 'pending',
        items: [{ description: '', price: 0 }]
      });
    } catch (error) {
      console.error('Error generating bill:', error);
      handleFirestoreError(error, OperationType.CREATE, 'bills');
      toast.error('Failed to generate bill. Check permissions.');
    }
  };

  const generateInvoicePDF = (bill: any) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Emerald 500
    doc.text('MIDSIGHT 2.0 - CLINIC', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('Medical Invoice', 105, 30, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(20, 35, 190, 35);
    
    // Patient Info
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Patient: ${bill.patientName}`, 20, 50);
    doc.text(`Invoice Date: ${bill.date}`, 150, 50);
    doc.text(`Status: ${bill.status.toUpperCase()}`, 150, 60);
    
    doc.line(20, 65, 190, 65);
    
    // Items Table Header
    doc.setFontSize(12);
    doc.text('Description', 25, 80);
    doc.text('Amount', 160, 80);
    doc.line(20, 85, 190, 85);
    
    let y = 95;
    bill.items.forEach((item: any) => {
      doc.text(item.description, 25, y);
      doc.text(`${currency === 'INR' ? 'Rs.' : '$'}${item.price.toFixed(2)}`, 160, y);
      y += 10;
    });
    
    doc.line(20, y, 190, y);
    y += 10;
    
    // Total
    doc.setFontSize(16);
    doc.text('Total Amount:', 120, y);
    doc.text(`${currency === 'INR' ? 'Rs.' : '$'}${bill.amount.toFixed(2)}`, 160, y);
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Thank you for choosing Midsight Clinic', 105, 280, { align: 'center' });
    
    doc.save(`Invoice_${bill.patientName}_${bill.date}.pdf`);
  };

  const filteredBills = bills.filter(b => 
    b.patientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = bills.reduce((sum, b) => sum + (b.status === 'paid' ? b.amount : 0), 0);
  const pendingRevenue = bills.reduce((sum, b) => sum + (b.status === 'pending' ? b.amount : 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Billing & Invoicing</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage payments, generate invoices, and track clinic revenue.</p>
        </div>
        <button 
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus size={20} />
          Generate Bill
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
            {currency === 'INR' ? <IndianRupee size={24} /> : <DollarSign size={24} />}
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Total Revenue</p>
            <p className="text-2xl font-bold text-zinc-100">{currency === 'INR' ? '₹' : '$'}{totalRevenue.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-bold text-zinc-100">{currency === 'INR' ? '₹' : '$'}{pendingRevenue.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Total Bills</p>
            <p className="text-2xl font-bold text-zinc-100">{bills.length}</p>
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Paid Bills</p>
            <p className="text-2xl font-bold text-zinc-100">{bills.filter(b => b.status === 'paid').length}</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input 
          type="text" 
          placeholder="Search by patient name..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-800/50">
              <th className="p-6 text-zinc-400 font-bold text-xs uppercase tracking-wider">Patient</th>
              <th className="p-6 text-zinc-400 font-bold text-xs uppercase tracking-wider">Date</th>
              <th className="p-6 text-zinc-400 font-bold text-xs uppercase tracking-wider">Amount</th>
              <th className="p-6 text-zinc-400 font-bold text-xs uppercase tracking-wider">Status</th>
              <th className="p-6 text-zinc-400 font-bold text-xs uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filteredBills.map((b: any) => (
              <tr key={b.id} className="hover:bg-zinc-800/30 transition-all group">
                <td className="p-6">
                  <span className="text-zinc-100 font-bold">{b.patientName}</span>
                </td>
                <td className="p-6 text-zinc-400 text-sm">{b.date}</td>
                <td className="p-6 text-zinc-100 font-bold">{currency === 'INR' ? '₹' : '$'}{b.amount.toLocaleString()}</td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    b.status === 'paid' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
                  }`}>
                    {b.status.toUpperCase()}
                  </span>
                </td>
                <td className="p-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => generateInvoicePDF(b)}
                      className="p-2 bg-zinc-800 text-zinc-400 hover:text-emerald-500 rounded-xl transition-all"
                      title="Download Invoice"
                    >
                      <Download size={18} />
                    </button>
                    {isSuperAdmin && (
                      <button 
                        onClick={() => handleDeleteBill(b.id, b.patientName)}
                        className="p-2 bg-zinc-800 text-zinc-400 hover:text-red-500 rounded-xl transition-all"
                        title="Delete Bill"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <h2 className="text-2xl font-bold text-zinc-100 mb-6">Generate New Bill</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Select Patient</label>
                    <select 
                      value={newBill.patientId}
                      onChange={(e) => setNewBill({ ...newBill, patientId: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value="">Select a patient...</option>
                      {patients.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Payment Status</label>
                    <select 
                      value={newBill.status}
                      onChange={(e) => setNewBill({ ...newBill, status: e.target.value as 'pending' | 'paid' })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-400">Billing Items</label>
                    <button 
                      onClick={handleAddItem}
                      className="text-emerald-500 text-sm font-bold flex items-center gap-1 hover:text-emerald-400"
                    >
                      <Plus size={16} /> Add Item
                    </button>
                  </div>
                  
                  {newBill.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input 
                        placeholder="Item Description (e.g. Consultation Fee)"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-zinc-100 text-sm"
                      />
                      <input 
                        type="number"
                        placeholder="Price"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))}
                        className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-zinc-100 text-sm"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <span className="text-zinc-100 font-bold">Total Amount:</span>
                  <span className="text-2xl font-bold text-emerald-500">{currency === 'INR' ? '₹' : '$'}{newBill.amount.toLocaleString()}</span>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowNewModal(false)}
                    className="flex-1 py-4 bg-zinc-800 text-zinc-300 rounded-2xl font-bold hover:bg-zinc-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Generate Bill
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
