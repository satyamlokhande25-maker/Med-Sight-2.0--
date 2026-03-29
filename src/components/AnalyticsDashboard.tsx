import React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { Users, TrendingUp, DollarSign, Calendar, Activity, Heart, Thermometer, Droplets } from 'lucide-react';
import { motion } from 'motion/react';

export function AnalyticsDashboard() {
  const [patientsValue] = useCollection(collection(db, 'patients'));
  const patients = patientsValue?.docs.map(doc => doc.data()) || [];

  const [billsValue] = useCollection(collection(db, 'bills'));
  const bills = billsValue?.docs.map(doc => doc.data()) || [];

  const [appointmentsValue] = useCollection(collection(db, 'appointments'));
  const appointments = appointmentsValue?.docs.map(doc => doc.data()) || [];

  // Prepare data for charts
  const patientStatusData = [
    { name: 'Stable', value: patients.filter(p => p.status === 'Stable').length },
    { name: 'Recovering', value: patients.filter(p => p.status === 'Recovering').length },
    { name: 'Critical', value: patients.filter(p => p.status === 'Critical').length },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#ef4444'];

  const revenueData = [
    { name: 'Jan', revenue: 4000 },
    { name: 'Feb', revenue: 3000 },
    { name: 'Mar', revenue: 2000 },
    { name: 'Apr', revenue: 2780 },
    { name: 'May', revenue: 1890 },
    { name: 'Jun', revenue: 2390 },
    { name: 'Jul', revenue: 3490 },
  ];

  const patientGrowthData = [
    { name: 'Week 1', count: 12 },
    { name: 'Week 2', count: 19 },
    { name: 'Week 3', count: 15 },
    { name: 'Week 4', count: 22 },
  ];

  const totalRevenue = bills.reduce((sum, b) => sum + (b.status === 'paid' ? b.amount : 0), 0);
  const totalPatients = patients.length;
  const totalAppointments = appointments.length;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Clinic Analytics</h1>
          <p className="text-zinc-400 text-sm mt-1">Real-time insights into your clinic's performance and patient health.</p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-sm font-bold">
            Last 30 Days
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Patients', value: totalPatients, icon: Users, color: 'emerald', trend: '+12%' },
          { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'blue', trend: '+8%' },
          { label: 'Appointments', value: totalAppointments, icon: Calendar, color: 'amber', trend: '+5%' },
          { label: 'Recovery Rate', value: '84%', icon: Activity, color: 'rose', trend: '+2%' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] relative overflow-hidden group"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-${stat.color}-500/5 rounded-full -mr-8 -mt-8 transition-all group-hover:scale-110`} />
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-${stat.color}-500/10 rounded-2xl flex items-center justify-center text-${stat.color}-500`}>
                <stat.icon size={24} />
              </div>
              <span className="text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-lg">{stat.trend}</span>
            </div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-zinc-100 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] shadow-xl">
          <h3 className="text-xl font-bold text-zinc-100 mb-8 flex items-center gap-3">
            <TrendingUp className="text-emerald-500" size={20} />
            Revenue Growth
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] shadow-xl">
          <h3 className="text-xl font-bold text-zinc-100 mb-8 flex items-center gap-3">
            <Activity className="text-blue-500" size={20} />
            Patient Status Distribution
          </h3>
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={patientStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {patientStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-bold text-zinc-100">{totalPatients}</span>
              <span className="text-zinc-500 text-xs uppercase font-bold">Total</span>
            </div>
          </div>
          <div className="flex justify-center gap-8 mt-4">
            {patientStatusData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                <span className="text-zinc-400 text-sm font-medium">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] shadow-xl">
          <h3 className="text-xl font-bold text-zinc-100 mb-8">Weekly Patient Inflow</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={patientGrowthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#27272a' }}
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] shadow-xl">
          <h3 className="text-xl font-bold text-zinc-100 mb-6">Health Vitals Avg.</h3>
          <div className="space-y-6">
            {[
              { label: 'Heart Rate', value: '72 bpm', icon: Heart, color: 'rose' },
              { label: 'Blood Pressure', value: '120/80', icon: Activity, color: 'emerald' },
              { label: 'Temperature', value: '98.6 °F', icon: Thermometer, color: 'amber' },
              { label: 'Oxygen Level', value: '98%', icon: Droplets, color: 'blue' },
            ].map((vital, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-2xl border border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-${vital.color}-500/10 rounded-xl flex items-center justify-center text-${vital.color}-500`}>
                    <vital.icon size={20} />
                  </div>
                  <span className="text-zinc-300 font-medium">{vital.label}</span>
                </div>
                <span className="text-zinc-100 font-bold">{vital.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
