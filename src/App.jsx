import React, { useState, useEffect, useCallback } from 'react';
import db, { supabase } from './utils/db';

const MACHINES = ['Heidelberg SM52', 'Screen Press 1', 'Screen Press 2', 'Xerox Versant', 'Large Format Printer', 'Guillotine'];
const JOB_TYPES = ['Offset', 'Digital', 'Screen Print', 'Large Format', 'Finishing', 'Other'];
const JOB_STATUSES = ['quoting', 'queued', 'in-progress', 'on-hold', 'completed', 'cancelled'];
const DELIVERY_STATUSES = ['pending', 'ready', 'out-for-delivery', 'delivered', 'collected'];
const STAFF_LIST = ['Kwame', 'Ama', 'Kofi', 'Abena', 'Yaw', 'Akosua'];
const ADMIN_WHATSAPP = '+233246307773';

const fmt = (n) => `GH₵${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayStr = () => new Date().toISOString().split('T')[0];
const getCurrentMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; };

const STATUS_COLORS = {
  quoting:       { bg: '#f0f9ff', color: '#0369a1',  border: '#bae6fd' },
  queued:        { bg: '#fefce8', color: '#854d0e',  border: '#fde68a' },
  'in-progress': { bg: '#eff6ff', color: '#1d4ed8',  border: '#bfdbfe' },
  'on-hold':     { bg: '#fff7ed', color: '#c2410c',  border: '#fed7aa' },
  completed:     { bg: '#f0fdf4', color: '#15803d',  border: '#bbf7d0' },
  cancelled:     { bg: '#fef2f2', color: '#b91c1c',  border: '#fecaca' },
};
const PRIORITY_COLORS = {
  normal: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  rush:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  urgent: { bg: '#7f1d1d', color: '#ffffff', border: '#7f1d1d' },
};
const DELIVERY_COLORS = {
  pending:            { bg: '#f1f5f9', color: '#475569' },
  ready:              { bg: '#fef3c7', color: '#92400e' },
  'out-for-delivery': { bg: '#dbeafe', color: '#1e40af' },
  delivered:          { bg: '#d1fae5', color: '#065f46' },
  collected:          { bg: '#f0fdf4', color: '#15803d' },
};

const openWhatsApp = (phone, message) => {
  const clean = phone.replace(/\D/g, '');
  const num = clean.startsWith('0') ? '233' + clean.slice(1) : clean;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
};
const generateJobReadyMsg = (job) =>
  `Hi ${job.customer}, your print job *${job.job_no}* is ready for pickup!\n\n📋 ${job.description}\n💰 Total: ${fmt(job.price)}\n\nPlease come collect at your earliest convenience.\n\nThank you for choosing Bigbiney Printing Press! 🖨️`;
const generateAdminReminderMsg = (overdueJobs) => {
  const lines = overdueJobs.map(j => `• ${j.job_no} — ${j.customer} (Due: ${j.due_date}) — ${j.status}`).join('\n');
  return `⚠️ *OVERDUE JOBS REMINDER*\n\nThe following jobs are past their due date:\n\n${lines}\n\nPlease follow up immediately.\n\n_Bigbiney Printing Press_`;
};
const generateStatusChangeMsg = (job, newStatus) => {
  const msgs = {
    'queued':      `Hi ${job.customer}! 📝 Your print job *${job.job_no}* has been received and is in the queue.\n\n📋 ${job.description}\n💰 Amount: ${fmt(job.price)}\n📅 Due: ${job.due_date || 'TBD'}\n\nThank you for choosing Bigbiney Printing Press! 🖨️`,
    'in-progress': `Hi ${job.customer}! 🛠️ Your job *${job.job_no}* is now *IN PRODUCTION*.\n\n📋 ${job.description}\n📅 Due: ${job.due_date || 'TBD'}\n\nWe'll update you when it's ready!`,
    'on-hold':     `Hi ${job.customer}! ⏸️ Your job *${job.job_no}* has been placed *ON HOLD*.\n\nPlease contact us for more information.`,
    'completed':   `Hi ${job.customer}! ✅ Your print job *${job.job_no}* is *READY FOR PICKUP*!\n\n📋 ${job.description}\n💰 Total: ${fmt(job.price)}\n\nThank you for choosing Bigbiney Printing Press! 🖨️`,
    'cancelled':   `Hi ${job.customer}. Your job *${job.job_no}* has been *CANCELLED*.\n\nPlease contact us if you have any questions.`,
  };
  return msgs[newStatus] || `Hi ${job.customer}, your job *${job.job_no}* status updated to *${newStatus.toUpperCase()}*.`;
};
const generateDailySummaryMsg = (sales, expenses, jobs, invoices) => {
  const today = todayStr();
  const todaySales   = sales.filter(s => s.date === today).reduce((a, s) => a + s.amount, 0);
  const todayExp     = expenses.filter(e => e.date === today).reduce((a, e) => a + e.amount, 0);
  const activeNow    = jobs.filter(j => j.status === 'in-progress').length;
  const outstanding  = invoices.filter(i => i.status !== 'paid').reduce((a, i) => a + (i.amount - i.paid), 0);
  const overdueCount = jobs.filter(j => !['completed','cancelled'].includes(j.status) && j.due_date && j.due_date < today).length;
  return `🖨️ *BIGBINEY PRINTING PRESS*\n*DAILY SUMMARY* — ${today}\n\n💰 *FINANCIALS TODAY*\n• Revenue: ${fmt(todaySales)}\n• Expenses: ${fmt(todayExp)}\n• Net: ${fmt(todaySales - todayExp)}\n\n📈 *JOBS*\n• In production: ${activeNow}\n• Overdue: ${overdueCount}\n\n🧾 *OUTSTANDING*\n• Unpaid invoices: ${fmt(outstanding)}\n\n_Bigbiney Printing Press Manager_`;
};
const generateWeeklySummaryMsg = (sales, expenses, jobs) => {
  const now = new Date(); const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const weekStr    = weekAgo.toISOString().split('T')[0];
  const weekSales  = sales.filter(s => s.date >= weekStr).reduce((a, s) => a + s.amount, 0);
  const weekExp    = expenses.filter(e => e.date >= weekStr).reduce((a, e) => a + e.amount, 0);
  const monthSales = sales.filter(s => s.date?.startsWith(getCurrentMonth())).reduce((a, s) => a + s.amount, 0);
  return `🖨️ *BIGBINEY PRINTING PRESS*\n*WEEKLY SUMMARY* — ${todayStr()}\n\n💰 *THIS WEEK*\n• Revenue: ${fmt(weekSales)}\n• Expenses: ${fmt(weekExp)}\n• Profit: ${fmt(weekSales - weekExp)}\n\n📅 *MONTH TO DATE*\n• Revenue: ${fmt(monthSales)}\n\n_Bigbiney Printing Press Manager_`;
};

const Badge = ({ text, type = 'status' }) => {
  const c = type === 'status' ? (STATUS_COLORS[text] || {}) : type === 'priority' ? (PRIORITY_COLORS[text] || {}) : (DELIVERY_COLORS[text] || {});
  return <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border || c.bg}`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{text}</span>;
};
const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: wide ? 800 : 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111' }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);
const StatCard = ({ label, value, sub, accent }) => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '18px 20px', borderLeft: `4px solid ${accent || '#2563eb'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
    <div style={{ fontSize: 22, fontWeight: 800, color: accent || '#2563eb', marginBottom: 4 }}>{value}</div>
    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
  </div>
);
const Inp = ({ label, ...props }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</label>}
    <input style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#111', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }} {...props} />
  </div>
);
const Sel = ({ label, children, ...props }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</label>}
    <select style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#111', background: '#fff', outline: 'none' }} {...props}>{children}</select>
  </div>
);
const Btn = ({ children, onClick, variant = 'primary', small, style: s, disabled }) => {
  const v = {
    primary: { background: '#2563eb', color: '#fff', border: 'none' },
    success: { background: '#16a34a', color: '#fff', border: 'none' },
    danger:  { background: '#dc2626', color: '#fff', border: 'none' },
    ghost:   { background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0' },
    warning: { background: '#f59e0b', color: '#fff', border: 'none' },
    purple:  { background: '#7c3aed', color: '#fff', border: 'none' },
    teal:    { background: '#0891b2', color: '#fff', border: 'none' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...v[variant], padding: small ? '5px 10px' : '9px 16px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: small ? 12 : 13, fontWeight: 600, opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap', ...s }}>
      {children}
    </button>
  );
};
const TH = ({ children }) => <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', whiteSpace: 'nowrap', background: '#f8fafc' }}>{children}</th>;
const TD = ({ children, style: s }) => <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9', ...s }}>{children}</td>;

export default function PrintingPressSystem() {
  const [currentUser,       setCurrentUser]       = useState(null);
  const [loginData,         setLoginData]         = useState({ email: '', password: '' });
  const [loginError,        setLoginError]        = useState('');
  const [activeTab,         setActiveTab]         = useState('dashboard');
  const [showNotif,         setShowNotif]         = useState(false);
  const [loading,           setLoading]           = useState(true);
  const [customers,         setCustomers]         = useState([]);
  const [jobs,              setJobs]              = useState([]);
  const [inventory,         setInventory]         = useState([]);
  const [invoices,          setInvoices]          = useState([]);
  const [sales,             setSales]             = useState([]);
  const [expenses,          setExpenses]          = useState([]);
  const [loans,             setLoans]             = useState([]);
  const [payroll,           setPayroll]           = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [jobMaterials,      setJobMaterials]      = useState([]);
  const [notifs,            setNotifs]            = useState([]);
  const [monthlyGoal,       setMonthlyGoalState]  = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUser(session.user);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setCurrentUser(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadAllData = useCallback(async (userId) => {
    setLoading(true);
    const [c, j, inv, inv2, s, e, l, p, re, jm, goalRes] = await Promise.all([
      db.getCustomers(userId), db.getJobs(userId), db.getInventory(userId),
      db.getInvoices(userId), db.getSales(userId), db.getExpenses(userId),
      db.getLoans(userId), db.getPayroll(userId),
      db.getRecurringExpenses(userId), db.getJobMaterials(userId),
      db.getSetting(userId, 'monthly_goal'),
    ]);
    setCustomers(c.data); setJobs(j.data); setInventory(inv.data);
    setInvoices(inv2.data); setSales(s.data); setExpenses(e.data);
    setLoans(l.data); setPayroll(p.data);
    setRecurringExpenses(re.data); setJobMaterials(jm.data);
    if (goalRes && goalRes.data) setMonthlyGoalState(parseFloat(goalRes.data.value) || 0);
    setLoading(false);
  }, []);

  useEffect(() => { if (!currentUser) return; loadAllData(currentUser.id); }, [currentUser, loadAllData]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubs = [
      db.subscribeToTable('customers',          currentUser.id, (r) => setCustomers(p => [...p.filter(x=>x.id!==r.id), r]),          (r) => setCustomers(p => p.map(x=>x.id===r.id?r:x)),          (r) => setCustomers(p => p.filter(x=>x.id!==r.id))),
      db.subscribeToTable('jobs',               currentUser.id, (r) => setJobs(p => [...p.filter(x=>x.id!==r.id), r]),               (r) => setJobs(p => p.map(x=>x.id===r.id?r:x)),               (r) => setJobs(p => p.filter(x=>x.id!==r.id))),
      db.subscribeToTable('inventory',          currentUser.id, (r) => setInventory(p => [...p.filter(x=>x.id!==r.id), r]),           (r) => setInventory(p => p.map(x=>x.id===r.id?r:x)),           (r) => setInventory(p => p.filter(x=>x.id!==r.id))),
      db.subscribeToTable('invoices',           currentUser.id, (r) => setInvoices(p => [...p.filter(x=>x.id!==r.id), r]),            (r) => setInvoices(p => p.map(x=>x.id===r.id?r:x)),            (r) => setInvoices(p => p.filter(x=>x.id!==r.id))),
      db.subscribeToTable('sales',              currentUser.id, (r) => setSales(p => [...p.filter(x=>x.id!==r.id), r]),               (r) => setSales(p => p.map(x=>x.id===r.id?r:x)),               (r) => setSales(p => p.filter(x=>x.id!==r.id))),
      db.subscribeToTable('expenses',           currentUser.id, (r) => setExpenses(p => [...p.filter(x=>x.id!==r.id), r]),            (r) => setExpenses(p => p.map(x=>x.id===r.id?r:x)),            (r) => setExpenses(p => p.filter(x=>x.id!==r.id))),
      db.subscribeToTable('loans',              currentUser.id, (r) => setLoans(p => [...p.filter(x=>x.id!==r.id), r]),               (r) => setLoans(p => p.map(x=>x.id===r.id?r:x)),               (r) => setLoans(p => p.filter(x=>x.id!==r.id))),
      db.subscribeToTable('payroll',            currentUser.id, (r) => setPayroll(p => [...p.filter(x=>x.id!==r.id), r]),             (r) => setPayroll(p => p.map(x=>x.id===r.id?r:x)),             (r) => setPayroll(p => p.filter(x=>x.id!==r.id))),
      db.subscribeToTable('recurring_expenses', currentUser.id, (r) => setRecurringExpenses(p => [...p.filter(x=>x.id!==r.id), r]),   (r) => setRecurringExpenses(p => p.map(x=>x.id===r.id?r:x)),   (r) => setRecurringExpenses(p => p.filter(x=>x.id!==r.id))),
      db.subscribeToTable('job_materials',      currentUser.id, (r) => setJobMaterials(p => [...p.filter(x=>x.id!==r.id), r]),        (r) => setJobMaterials(p => p.map(x=>x.id===r.id?r:x)),        (r) => setJobMaterials(p => p.filter(x=>x.id!==r.id))),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [currentUser]);

  const addNotif = (message, type = 'info') => setNotifs(n => [{ id: Date.now(), type, message, read: false }, ...n.slice(0, 19)]);
  const saveGoal = async (val) => { setMonthlyGoalState(val); await db.setSetting(currentUser.id, 'monthly_goal', String(val)); };

  const handleLogin = async () => {
    setLoginError('');
    const { data, error } = await db.signin(loginData.email, loginData.password);
    if (error) { setLoginError(error); return; }
    setCurrentUser(data.user);
  };
  const handleLogout = async () => {
    await db.signout();
    setCurrentUser(null);
    setCustomers([]); setJobs([]); setInventory([]);
    setInvoices([]); setSales([]); setExpenses([]);
    setLoans([]); setPayroll([]); setRecurringExpenses([]); setJobMaterials([]);
  };

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%)', fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
        <div style={{ background: '#fff', padding: 40, borderRadius: 12, width: '100%', maxWidth: 420, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🖨️</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Bigbiney Printing Press</h1>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Management System — syncs across all devices</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Inp label="Email" type="email" placeholder="admin@bigbiney.com" value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <Inp label="Password" type="password" placeholder="••••••••" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            {loginError && <p style={{ color: '#dc2626', fontSize: 12, margin: 0, padding: '6px 10px', background: '#fef2f2', borderRadius: 4, border: '1px solid #fecaca' }}>{loginError}</p>}
            <Btn onClick={handleLogin}>Sign In →</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#6b7280' }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 40, marginBottom: 16 }}>🖨️</div><p>Loading Bigbiney Printing Press…</p></div>
      </div>
    );
  }

  const unread      = notifs.filter(n => !n.read).length;
  const lowStock    = inventory.filter(i => i.quantity <= i.reorder_point);
  const overdueJobs = jobs.filter(j => !['completed','cancelled'].includes(j.status) && j.due_date && j.due_date < todayStr());

  const TABS = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'jobs',      label: '🗂️ Jobs' },
    { id: 'customers', label: '👥 Customers' },
    { id: 'inventory', label: '📦 Inventory' },
    { id: 'invoices',  label: '🧾 Invoices' },
    { id: 'finance',   label: '💰 Finance' },
    { id: 'payroll',   label: '👷 Payroll' },
    { id: 'loans',     label: '🏦 Loans' },
    { id: 'reports',   label: '📈 Reports' },
    { id: 'whatsapp',  label: '📲 WhatsApp' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#111' }}>
      <header style={{ background: '#0f172a', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🖨️</span>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Bigbiney Printing Press</span>
          {lowStock.length > 0 && <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{lowStock.length} LOW STOCK</span>}
          {overdueJobs.length > 0 && <span style={{ background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{overdueJobs.length} OVERDUE</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {overdueJobs.length > 0 && (
            <button onClick={() => openWhatsApp(ADMIN_WHATSAPP, generateAdminReminderMsg(overdueJobs))} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>📲 Alert Admin</button>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotif(v => !v)} style={{ background: showNotif ? '#1e3a5f' : 'transparent', border: '1px solid #334155', color: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 16, position: 'relative' }}>
              🔔
              {unread > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>}
            </button>
            {showNotif && (
              <div style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, width: 320, maxHeight: 360, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 300 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
                  <button onClick={() => setNotifs(n => n.map(x => ({ ...x, read: true })))} style={{ background: 'none', border: 'none', fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>Mark all read</button>
                </div>
                {notifs.slice(0, 8).map(n => (
                  <div key={n.id} style={{ padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'flex-start', borderBottom: '1px solid #f9fafb', background: n.read ? '#fff' : '#f0f9ff' }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{n.type === 'warning' ? '⚠️' : n.type === 'success' ? '✅' : 'ℹ️'}</span>
                    <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{n.message}</span>
                    <button onClick={() => setNotifs(prev => prev.filter(x => x.id !== n.id))} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>
                ))}
                {notifs.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 20 }}>All clear!</p>}
              </div>
            )}
          </div>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>👤 {currentUser.email}</span>
          <button onClick={handleLogout} style={{ background: '#1e3a5f', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>Logout</button>
        </div>
      </header>

      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', display: 'flex', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '13px 14px', background: 'transparent', border: 'none', borderBottom: activeTab === t.id ? '3px solid #2563eb' : '3px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? '#2563eb' : '#6b7280', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </nav>

      <main style={{ padding: '28px 24px', maxWidth: 1400, margin: '0 auto' }}>
        {activeTab === 'dashboard' && <DashboardTab jobs={jobs} sales={sales} expenses={expenses} customers={customers} inventory={inventory} invoices={invoices} setActiveTab={setActiveTab} overdueJobs={overdueJobs} monthlyGoal={monthlyGoal} setMonthlyGoal={saveGoal} />}
        {activeTab === 'jobs'      && <JobsTab jobs={jobs} setJobs={setJobs} customers={customers} addNotif={addNotif} userId={currentUser.id} inventory={inventory} setInventory={setInventory} jobMaterials={jobMaterials} setJobMaterials={setJobMaterials} />}
        {activeTab === 'customers' && <CustomersTab customers={customers} setCustomers={setCustomers} jobs={jobs} invoices={invoices} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'inventory' && <InventoryTab inventory={inventory} setInventory={setInventory} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'invoices'  && <InvoicesTab invoices={invoices} setInvoices={setInvoices} jobs={jobs} customers={customers} setSales={setSales} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'finance'   && <FinanceTab sales={sales} setSales={setSales} expenses={expenses} setExpenses={setExpenses} addNotif={addNotif} userId={currentUser.id} recurringExpenses={recurringExpenses} setRecurringExpenses={setRecurringExpenses} />}
        {activeTab === 'payroll'   && <PayrollTab payroll={payroll} setPayroll={setPayroll} addNotif={addNotif} userId={currentUser.id} expenses={expenses} setExpenses={setExpenses} />}
        {activeTab === 'loans'     && <LoansTab loans={loans} setLoans={setLoans} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'reports'   && <ReportsTab jobs={jobs} sales={sales} expenses={expenses} customers={customers} inventory={inventory} invoices={invoices} />}
        {activeTab === 'whatsapp'  && <WhatsAppTab jobs={jobs} customers={customers} sales={sales} expenses={expenses} invoices={invoices} addNotif={addNotif} />}
      </main>
    </div>
  );
}

function DashboardTab({ jobs, sales, expenses, customers, inventory, invoices, setActiveTab, overdueJobs, monthlyGoal, setMonthlyGoal }) {
  const [editGoal, setEditGoal]   = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const month        = getCurrentMonth();
  const monthlySales = sales.filter(s => s.date?.startsWith(month)).reduce((a, s) => a + s.amount, 0);
  const monthlyExp   = expenses.filter(e => e.date?.startsWith(month)).reduce((a, e) => a + e.amount, 0);
  const activeJobs   = jobs.filter(j => j.status === 'in-progress').length;
  const lowStock     = inventory.filter(i => i.quantity <= i.reorder_point);
  const unpaidTotal  = invoices.filter(i => i.status !== 'paid').reduce((a, i) => a + (i.amount - i.paid), 0);
  const goalPct      = monthlyGoal > 0 ? Math.min(100, Math.round((monthlySales / monthlyGoal) * 100)) : 0;
  const margin       = monthlySales > 0 ? ((monthlySales - monthlyExp) / monthlySales) * 100 : 0;

  let healthScore = 100;
  if (margin < 10) healthScore -= 30; else if (margin < 25) healthScore -= 15;
  if (overdueJobs.length > 5) healthScore -= 25; else if (overdueJobs.length > 0) healthScore -= overdueJobs.length * 4;
  if (lowStock.length > 3) healthScore -= 20; else if (lowStock.length > 0) healthScore -= lowStock.length * 5;
  if (monthlySales === 0) healthScore -= 20;
  healthScore = Math.max(0, Math.min(100, healthScore));
  const healthColor = healthScore >= 75 ? '#16a34a' : healthScore >= 50 ? '#f59e0b' : '#dc2626';
  const healthLabel = healthScore >= 75 ? '🟢 Healthy' : healthScore >= 50 ? '🟡 Needs Attention' : '🔴 Critical';

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split('T')[0];
    return { day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()], amt: sales.filter(s => s.date === ds).reduce((a, s) => a + s.amount, 0) };
  });
  const maxBar = Math.max(...last7.map(d => d.amt), 1);

  return (
    <div>
      {overdueJobs.length > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#856404', marginBottom: 6 }}>{overdueJobs.length} Overdue Job{overdueJobs.length > 1 ? 's' : ''} — Action Required</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {overdueJobs.map(j => (
                <span key={j.id} style={{ background: '#fff', border: '1px solid #ffc107', borderRadius: 4, padding: '3px 8px', fontSize: 12 }}>
                  <strong>{j.job_no}</strong> — {j.customer} (due {j.due_date})
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => openWhatsApp(ADMIN_WHATSAPP, generateAdminReminderMsg(overdueJobs))} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>📲 WhatsApp Alert</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Monthly Income"   value={fmt(monthlySales)} accent="#16a34a" />
        <StatCard label="Monthly Expenses" value={fmt(monthlyExp)}   accent="#dc2626" />
        <StatCard label="Monthly Profit"   value={fmt(monthlySales - monthlyExp)} accent={monthlySales >= monthlyExp ? '#2563eb' : '#dc2626'} />
        <StatCard label="Active Jobs"      value={activeJobs} sub={overdueJobs.length > 0 ? `⚠️ ${overdueJobs.length} overdue` : 'On track'} accent="#f59e0b" />
        <StatCard label="Outstanding"      value={fmt(unpaidTotal)} sub={`${invoices.filter(i=>i.status!=='paid').length} invoice(s)`} accent="#7c3aed" />
        <StatCard label="Low Stock Items"  value={lowStock.length} sub={lowStock.length > 0 ? 'Needs reorder' : 'All good'} accent={lowStock.length > 0 ? '#dc2626' : '#16a34a'} />
      </div>

      <div style={{ background: '#fff', border: `2px solid ${healthColor}`, borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>💊 Business Health Score</h3>
          <span style={{ fontSize: 17, fontWeight: 900, color: healthColor }}>{healthScore}/100 — {healthLabel}</span>
        </div>
        <div style={{ background: '#f1f5f9', borderRadius: 6, height: 14, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: `${healthScore}%`, height: 14, borderRadius: 6, background: healthColor, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: margin >= 25 ? '#16a34a' : margin >= 10 ? '#f59e0b' : '#dc2626', fontWeight: 600 }}>{margin >= 25 ? '✅' : margin >= 10 ? '⚠️' : '❌'} Profit Margin: {Math.round(margin)}%</span>
          <span style={{ fontSize: 12, color: overdueJobs.length === 0 ? '#16a34a' : overdueJobs.length <= 2 ? '#f59e0b' : '#dc2626', fontWeight: 600 }}>{overdueJobs.length === 0 ? '✅' : '⚠️'} Overdue Jobs: {overdueJobs.length}</span>
          <span style={{ fontSize: 12, color: lowStock.length === 0 ? '#16a34a' : '#f59e0b', fontWeight: 600 }}>{lowStock.length === 0 ? '✅' : '⚠️'} Low Stock: {lowStock.length}</span>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🎯 Monthly Revenue Goal</h3>
          <button onClick={() => { setGoalInput(String(monthlyGoal)); setEditGoal(true); }} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>{monthlyGoal > 0 ? 'Edit Goal' : 'Set Goal'}</button>
        </div>
        {editGoal && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <Inp placeholder="Monthly target (GH₵)" type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} />
            <Btn small onClick={() => { setMonthlyGoal(parseFloat(goalInput)||0); setEditGoal(false); }}>Save</Btn>
            <Btn small variant="ghost" onClick={() => setEditGoal(false)}>Cancel</Btn>
          </div>
        )}
        {monthlyGoal > 0 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: goalPct >= 100 ? '#16a34a' : '#374151' }}>{fmt(monthlySales)} earned</span>
              <span style={{ color: '#6b7280' }}>Goal: {fmt(monthlyGoal)} — <strong style={{ color: goalPct >= 100 ? '#16a34a' : '#2563eb' }}>{goalPct}%</strong></span>
            </div>
            <div style={{ background: '#f1f5f9', borderRadius: 6, height: 14, overflow: 'hidden' }}>
              <div style={{ width: `${goalPct}%`, height: 14, borderRadius: 6, background: goalPct >= 100 ? '#16a34a' : goalPct >= 75 ? '#2563eb' : goalPct >= 50 ? '#f59e0b' : '#dc2626', transition: 'width 0.4s ease' }} />
            </div>
            {goalPct >= 100 && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#16a34a', fontWeight: 700 }}>🎉 Goal achieved! Keep going!</p>}
          </>
        ) : <p style={{ margin: 0, color: '#9ca3af', fontSize: 13 }}>Set a monthly revenue target to track your progress.</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Revenue — Last 7 Days</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
            {last7.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', background: d.amt > 0 ? '#2563eb' : '#e5e7eb', borderRadius: '3px 3px 0 0', height: `${Math.max(2, Math.round((d.amt / maxBar) * 100))}px` }} title={fmt(d.amt)} />
                <span style={{ fontSize: 10, color: '#6b7280' }}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Job Pipeline</h3>
          {JOB_STATUSES.map(s => {
            const count = jobs.filter(j => j.status === s).length;
            const pct   = jobs.length > 0 ? Math.round((count / jobs.length) * 100) : 0;
            const col   = STATUS_COLORS[s] || {};
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 80, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: col.color || '#555' }}>{s}</span>
                <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 8 }}>
                  <div style={{ width: `${pct}%`, background: col.color || '#2563eb', height: 8, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, color: '#6b7280', width: 20, textAlign: 'right' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Recent Jobs</h3>
          <Btn variant="ghost" small onClick={() => setActiveTab('jobs')}>View All →</Btn>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Job #','Customer','Description','Type','Due','Price','Status'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {[...jobs].sort((a,b) => (b.job_no||'').localeCompare(a.job_no||'')).slice(0,5).map(j => (
                <tr key={j.id}>
                  <TD style={{ fontWeight: 700, color: '#2563eb' }}>{j.job_no}</TD>
                  <TD>{j.customer}</TD><TD>{j.description}</TD><TD>{j.type}</TD>
                  <TD style={{ color: j.due_date < todayStr() && !['completed','cancelled'].includes(j.status) ? '#dc2626' : '#374151' }}>{j.due_date}</TD>
                  <TD style={{ fontWeight: 600 }}>{fmt(j.price)}</TD>
                  <TD><Badge text={j.status} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#dc2626' }}>⚠️ Low Stock Alerts</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lowStock.map(i => (
              <div key={i.id} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 12px', fontSize: 12 }}>
                <strong>{i.name}</strong> — {i.quantity} {i.unit} left (reorder at {i.reorder_point})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_JOB = { customer: '', customer_id: '', description: '', type: 'Digital', status: 'queued', priority: 'normal', due_date: '', start_date: '', price: '', cost: '', machine: '', notes: '', delivery_status: 'pending', assigned_to: '', payment_method: 'Cash', whatsapp: '' };

function JobsTab({ jobs, setJobs, customers, addNotif, userId, inventory, setInventory, jobMaterials, setJobMaterials }) {
  const [filter,     setFilter]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState(EMPTY_JOB);
  const [editId,     setEditId]     = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [msgModal,   setMsgModal]   = useState(null);
  const [matModal,   setMatModal]   = useState(null);
  const [autoNotifQ, setAutoNotifQ] = useState([]);
  const [staffList,  setStaffList]  = useState(STAFF_LIST);

  // Load staff list from Supabase so deleted staff don't show
  useEffect(() => {
    db.getSetting(userId, 'staff_list').then(({ data }) => {
      if (data && data.value) {
        try { setStaffList(JSON.parse(data.value)); } catch { setStaffList(STAFF_LIST); }
      }
    });
  }, [userId]);

  const filtered = jobs.filter(j => {
    const ms = filter === 'all' || j.status === filter;
    const mq = !search || [j.job_no, j.customer, j.description].some(v => (v||'').toLowerCase().includes(search.toLowerCase()));
    return ms && mq;
  }).sort((a, b) => (b.job_no||'').localeCompare(a.job_no||''));

  const nextNo = () => {
    const nums = jobs.map(j => parseInt((j.job_no||'PSM-000').split('-')[1] || 0));
    return `PSM-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
  };

  const openNew    = () => { setForm({ ...EMPTY_JOB, start_date: todayStr() }); setEditId(null); setModal(true); };
  const openEdit   = (j) => { setForm({ ...j, price: String(j.price), cost: String(j.cost) }); setEditId(j.id); setModal(true); };
  const closeModal = () => { setModal(false); setForm(EMPTY_JOB); setEditId(null); };

  const save = async () => {
    if (!form.customer || !form.description) return;
    setSaving(true);
    const payload = { ...form, price: parseFloat(form.price)||0, cost: parseFloat(form.cost)||0 };
    if (editId) {
      const { data, error } = await db.updateJob(editId, payload);
      if (!error) { setJobs(jobs.map(j => j.id === editId ? data : j)); addNotif('Job updated', 'success'); }
      else addNotif('Error updating job', 'warning');
    } else {
      const no = nextNo();
      const { data, error } = await db.addJob(userId, { ...payload, job_no: no, qr_code: no });
      if (!error) { setJobs([...jobs, data]); addNotif(`Job ${no} created`, 'success'); }
      else addNotif('Error creating job', 'warning');
    }
    setSaving(false); closeModal();
  };

  const del = async (id) => {
    if (!window.confirm('Delete this job?')) return;
    const { error } = await db.deleteJob(id);
    if (!error) { setJobs(jobs.filter(j => j.id !== id)); addNotif('Job deleted'); }
  };

  const updateField = async (id, field, value) => {
    const job = jobs.find(j => j.id === id);
    const { data, error } = await db.updateJob(id, { [field]: value });
    if (!error) {
      setJobs(jobs.map(j => j.id === id ? data : j));
      if (field === 'status' && job && (job.whatsapp || '').trim()) {
        setAutoNotifQ(q => [...q, { job: { ...job, status: value }, msg: generateStatusChangeMsg(job, value), phone: job.whatsapp }]);
      }
    }
  };

  const duplicate = async (j) => {
    const no = nextNo();
    const { data, error } = await db.addJob(userId, { ...j, id: undefined, job_no: no, qr_code: no, status: 'queued', start_date: todayStr(), delivery_status: 'pending' });
    if (!error) { setJobs([...jobs, data]); addNotif(`Duplicated as ${no}`, 'success'); }
  };

  const printTicket = (j) => {
    const w = window.open('', '', 'width=600,height=500');
    w.document.write(`<html><body style="font-family:Arial;padding:30px;max-width:500px"><h2>🖨️ JOB TICKET — ${j.job_no}</h2><p><b>Customer:</b> ${j.customer}</p><p><b>Description:</b> ${j.description}</p><p><b>Type:</b> ${j.type} &nbsp; <b>Machine:</b> ${j.machine||'TBD'}</p><p><b>Assigned To:</b> ${j.assigned_to||'Unassigned'}</p><p><b>Priority:</b> ${(j.priority||'').toUpperCase()} &nbsp; <b>Status:</b> ${j.status}</p><p><b>Delivery:</b> ${j.delivery_status||'pending'}</p><p><b>Start:</b> ${j.start_date||'TBD'} &nbsp; <b>Due:</b> ${j.due_date||'TBD'}</p><p><b>Price:</b> GH₵${j.price} &nbsp; <b>Est. Cost:</b> GH₵${j.cost}</p>${j.notes ? `<p><b>Notes:</b> ${j.notes}</p>` : ''}<div style="margin-top:20px;padding:10px;border:2px solid #000;display:inline-block;font-size:20px;font-weight:bold;letter-spacing:4px">${j.qr_code}</div><p style="font-size:10px;color:#999">Printed ${new Date().toLocaleString()} — Bigbiney Printing Press</p></body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Job Management</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search…" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13 }} />
          <Btn onClick={openNew}>+ New Job</Btn>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', ...JOB_STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: filter === s ? '#2563eb' : '#fff', color: filter === s ? '#fff' : '#6b7280', borderColor: filter === s ? '#2563eb' : '#e5e7eb' }}>
            {s === 'all' ? `All (${jobs.length})` : `${s} (${jobs.filter(j=>j.status===s).length})`}
          </button>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Job #','Customer','Description','Type','Assigned','Due','Price','Profit','Delivery','Status','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {filtered.map(j => {
              const profit = (j.price||0) - (j.cost||0);
              const margin = j.price > 0 ? Math.round((profit / j.price) * 100) : 0;
              return (
                <tr key={j.id}>
                  <TD style={{ fontWeight: 700, color: '#2563eb' }}>{j.job_no}</TD>
                  <TD>{j.customer}</TD>
                  <TD style={{ maxWidth: 160 }}>{j.description}</TD>
                  <TD>{j.type}</TD>
                  <TD style={{ color: '#6b7280', fontSize: 12 }}>{j.assigned_to || '—'}</TD>
                  <TD style={{ color: j.due_date < todayStr() && !['completed','cancelled'].includes(j.status) ? '#dc2626' : '#374151' }}>{j.due_date || '—'}</TD>
                  <TD style={{ fontWeight: 600 }}>{fmt(j.price)}</TD>
                  <TD><span style={{ fontWeight: 700, color: profit >= 0 ? '#16a34a' : '#dc2626', fontSize: 12 }}>{fmt(profit)}<br/><span style={{ fontSize: 10 }}>{margin}%</span></span></TD>
                  <TD>
                    <select value={j.delivery_status || 'pending'} onChange={e => updateField(j.id, 'delivery_status', e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 6px', fontSize: 11, background: DELIVERY_COLORS[j.delivery_status||'pending']?.bg, color: DELIVERY_COLORS[j.delivery_status||'pending']?.color, cursor: 'pointer', fontWeight: 700 }}>
                      {DELIVERY_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </TD>
                  <TD>
                    <select value={j.status} onChange={e => updateField(j.id, 'status', e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 6px', fontSize: 11, background: STATUS_COLORS[j.status]?.bg, color: STATUS_COLORS[j.status]?.color, cursor: 'pointer', fontWeight: 700 }}>
                      {JOB_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      <Btn variant="ghost"   small onClick={() => openEdit(j)}>Edit</Btn>
                      <Btn variant="ghost"   small onClick={() => printTicket(j)}>🖨️</Btn>
                      <Btn variant="teal"    small onClick={() => setMsgModal(j)}>📲</Btn>
                      <Btn variant="ghost"   small onClick={() => setMatModal(j)}>📦</Btn>
                      <Btn variant="warning" small onClick={() => duplicate(j)}>Copy</Btn>
                      <Btn variant="danger"  small onClick={() => del(j.id)}>Del</Btn>
                    </div>
                  </TD>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No jobs found</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Job' : 'New Job Ticket'} onClose={closeModal} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label="Customer *" value={form.customer} onChange={e => {
              const c = customers.find(x => x.name === e.target.value);
              setForm({ ...form, customer: e.target.value, customer_id: c?.id||'', whatsapp: c?.whatsapp || c?.phone || form.whatsapp || '' });
            }}>
              <option value="">— Select Customer —</option>
              {customers.map(c => <option key={c.id}>{c.name}</option>)}
            </Sel>
            <Sel label="Job Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
            </Sel>
            <div style={{ gridColumn: '1/-1' }}><Inp label="Description *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <Sel label="Machine" value={form.machine} onChange={e => setForm({ ...form, machine: e.target.value })}>
              <option value="">— Unassigned —</option>
              {MACHINES.map(m => <option key={m}>{m}</option>)}
            </Sel>
            <Sel label="Assigned To" value={form.assigned_to||''} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">— Unassigned —</option>
              {staffList.map(s => <option key={s}>{s}</option>)}
            </Sel>
            <Sel label="Priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="normal">Normal</option><option value="rush">Rush (+25%)</option><option value="urgent">Urgent</option>
            </Sel>
            <Sel label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {JOB_STATUSES.map(s => <option key={s}>{s}</option>)}
            </Sel>
            <Sel label="Delivery Status" value={form.delivery_status||'pending'} onChange={e => setForm({ ...form, delivery_status: e.target.value })}>
              {DELIVERY_STATUSES.map(s => <option key={s}>{s}</option>)}
            </Sel>
            <Sel label="Payment Method" value={form.payment_method||'Cash'} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
              {['Cash','Mobile Money','Bank Transfer','Credit','Other'].map(m => <option key={m}>{m}</option>)}
            </Sel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Customer WhatsApp</label>
              <select value={form.whatsapp||''} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#111', background: '#fff' }}>
                <option value="">— Select or type below —</option>
                {customers.filter(c => c.whatsapp || c.phone).map(c => (
                  <option key={c.id} value={c.whatsapp || c.phone}>{c.name} — {c.whatsapp || c.phone}</option>
                ))}
              </select>
              <input placeholder="Or type: +233..." value={form.whatsapp||''} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#111', background: '#fff', marginTop: 4 }} />
            </div>
            <Inp label="Start Date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <Inp label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <Inp label="Price (GH₵)" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            <Inp label="Est. Cost (GH₵)" type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
            {form.price && form.cost && (
              <div style={{ gridColumn: '1/-1', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                  Estimated Profit: {fmt((parseFloat(form.price)||0)-(parseFloat(form.cost)||0))} ({form.price > 0 ? Math.round((((parseFloat(form.price)||0)-(parseFloat(form.cost)||0))/(parseFloat(form.price)||1))*100) : 0}% margin)
                </span>
              </div>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={closeModal}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Job'}</Btn>
          </div>
        </Modal>
      )}

      {msgModal && <WhatsAppMsgModal job={msgModal} onClose={() => setMsgModal(null)} />}
      {matModal && <JobMaterialsModal job={matModal} inventory={inventory} setInventory={setInventory} jobMaterials={jobMaterials.filter(m => m.job_id === matModal.id)} setJobMaterials={setJobMaterials} userId={userId} addNotif={addNotif} onClose={() => setMatModal(null)} />}

      {autoNotifQ.length > 0 && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 9998, width: 340 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>📲 Send Status Update?</span>
            <button onClick={() => setAutoNotifQ([])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af' }}>×</button>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>Job <strong>{autoNotifQ[0].job.job_no}</strong> → <strong>{autoNotifQ[0].job.status}</strong>. Notify {autoNotifQ[0].job.customer}?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { openWhatsApp(autoNotifQ[0].phone, autoNotifQ[0].msg); setAutoNotifQ(q => q.slice(1)); addNotif(`WhatsApp sent to ${autoNotifQ[0].job.customer}`, 'success'); }} style={{ flex: 1, background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '8px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Send WhatsApp</button>
            <button onClick={() => setAutoNotifQ(q => q.slice(1))} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>Skip</button>
          </div>
        </div>
      )}
    </div>
  );
}

function JobMaterialsModal({ job, inventory, setInventory, jobMaterials, setJobMaterials, userId, addNotif, onClose }) {
  const [selItem, setSelItem] = useState('');
  const [qty, setQty]         = useState('1');
  const [saving, setSaving]   = useState(false);

  const addMaterial = async () => {
    const item = inventory.find(i => i.id === selItem);
    if (!item || !qty) return;
    const q = parseFloat(qty);
    if (q > item.quantity) { alert(`Only ${item.quantity} ${item.unit} available`); return; }
    setSaving(true);
    const { data, error } = await db.addJobMaterial(userId, { job_id: job.id, inventory_id: item.id, item_name: item.name, quantity: q, unit_cost: item.unit_cost });
    if (!error) {
      setJobMaterials(prev => [...prev, data]);
      const { data: updated } = await db.updateInventoryItem(item.id, { quantity: item.quantity - q });
      if (updated) setInventory(inv => inv.map(i => i.id === item.id ? updated : i));
      addNotif(`${item.name} x${q} linked to ${job.job_no}`, 'success');
    }
    setSaving(false); setSelItem(''); setQty('1');
  };

  const removeMaterial = async (mat) => {
    const { error } = await db.deleteJobMaterial(mat.id);
    if (!error) {
      setJobMaterials(prev => prev.filter(m => m.id !== mat.id));
      const item = inventory.find(i => i.id === mat.inventory_id);
      if (item) {
        const { data: updated } = await db.updateInventoryItem(item.id, { quantity: item.quantity + mat.quantity });
        if (updated) setInventory(inv => inv.map(i => i.id === item.id ? updated : i));
      }
    }
  };

  const totalCost = jobMaterials.reduce((a, m) => a + m.quantity * (m.unit_cost||0), 0);

  return (
    <Modal title={`📦 Materials — ${job.job_no}`} onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>Add Stock Item Used</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end' }}>
          <Sel label="Inventory Item" value={selItem} onChange={e => setSelItem(e.target.value)}>
            <option value="">— Select Item —</option>
            {inventory.filter(i => i.quantity > 0).map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.quantity} {i.unit})</option>)}
          </Sel>
          <Inp label="Qty" type="number" value={qty} onChange={e => setQty(e.target.value)} />
          <Btn onClick={addMaterial} disabled={saving || !selItem}>Add</Btn>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>Materials Used</h4>
        {jobMaterials.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>No materials linked yet</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Item','Qty','Unit Cost','Total',''].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {jobMaterials.map(m => (
                <tr key={m.id}>
                  <TD>{m.item_name}</TD><TD>{m.quantity}</TD><TD>{fmt(m.unit_cost||0)}</TD>
                  <TD style={{ fontWeight: 700 }}>{fmt(m.quantity*(m.unit_cost||0))}</TD>
                  <TD><Btn variant="danger" small onClick={() => removeMaterial(m)}>×</Btn></TD>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {jobMaterials.length > 0 && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px' }}><span style={{ fontWeight: 700, color: '#16a34a' }}>Total Material Cost: {fmt(totalCost)}</span></div>}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}><Btn variant="ghost" onClick={onClose}>Close</Btn></div>
    </Modal>
  );
}

function WhatsAppMsgModal({ job, onClose }) {
  const [phone, setPhone] = useState(job.whatsapp || '');
  const [msg, setMsg]     = useState(generateJobReadyMsg(job));
  return (
    <Modal title="📲 WhatsApp Message" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Inp label="Customer WhatsApp Number" placeholder="+233..." value={phone} onChange={e => setPhone(e.target.value)} />
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Message</label>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={8} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => navigator.clipboard.writeText(msg)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>📋 Copy</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <button onClick={() => { if (phone) openWhatsApp(phone, msg); else alert('Enter a phone number first.'); }} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Open in WhatsApp</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const EMPTY_CX = { name: '', email: '', phone: '', address: '', whatsapp: '' };

function CustomersTab({ customers, setCustomers, jobs, invoices, addNotif, userId }) {
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState(EMPTY_CX);
  const [editId,     setEditId]     = useState(null);
  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [importing,  setImporting]  = useState(false);

  const filtered = customers.filter(c =>
    !search ||
    (c.name||'').toLowerCase().includes(search.toLowerCase()) ||
    (c.email||'').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone||'').includes(search)
  );

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    if (editId) {
      const { data, error } = await db.updateCustomer(editId, form);
      if (!error) setCustomers(customers.map(c => c.id === editId ? data : c));
      else addNotif('Error updating customer', 'warning');
    } else {
      const { data, error } = await db.addCustomer(userId, form);
      if (!error) { setCustomers([...customers, data]); addNotif(`${form.name} added`, 'success'); }
      else addNotif('Error adding customer', 'warning');
    }
    setSaving(false); setModal(false); setForm(EMPTY_CX); setEditId(null);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    const { error } = await db.deleteCustomer(id);
    if (!error) {
      setCustomers(prev => prev.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
      addNotif('Customer deleted', 'success');
    } else {
      addNotif('Error deleting customer — check Supabase RLS', 'warning');
    }
  };

  const delAll = async () => {
    if (!window.confirm(`Delete ALL ${customers.length} customers? This cannot be undone.`)) return;
    if (!window.confirm('Are you absolutely sure? ALL customers will be permanently deleted.')) return;
    let count = 0;
    for (const c of customers) {
      const { error } = await db.deleteCustomer(c.id);
      if (!error) count++;
    }
    setCustomers([]);
    setSelected(null);
    addNotif(`${count} customers deleted`, 'success');
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { addNotif('CSV must have a header row + data rows', 'warning'); setImporting(false); return; }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
      const nameIdx    = headers.findIndex(h => h.includes('name'));
      const emailIdx   = headers.findIndex(h => h.includes('email'));
      const phoneIdx   = headers.findIndex(h => h.includes('phone'));
      const waIdx      = headers.findIndex(h => h.includes('whatsapp') || h.includes('wa'));
      const addressIdx = headers.findIndex(h => h.includes('address'));

      if (nameIdx === -1) { addNotif('CSV must have a "name" column', 'warning'); setImporting(false); return; }

      let imported = 0;
      const newCustomers = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const name = cols[nameIdx];
        if (!name) continue;
        const record = {
          name,
          email:    emailIdx   >= 0 ? cols[emailIdx]   || '' : '',
          phone:    phoneIdx   >= 0 ? cols[phoneIdx]   || '' : '',
          whatsapp: waIdx      >= 0 ? cols[waIdx]      || '' : '',
          address:  addressIdx >= 0 ? cols[addressIdx] || '' : '',
        };
        const { data, error } = await db.addCustomer(userId, record);
        if (!error && data) { newCustomers.push(data); imported++; }
      }
      setCustomers(prev => [...prev, ...newCustomers]);
      addNotif(`${imported} customers imported from CSV`, 'success');
      setImporting(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const csv = 'name,email,phone,whatsapp,address\nJohn Doe,john@example.com,0244123456,0244123456,Accra Ghana\nJane Smith,jane@example.com,0277654321,0277654321,Kumasi Ghana';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'customers_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const printStatement = (c) => {
    const cInvoices = invoices.filter(i => i.customer_id === c.id);
    const totalAmt  = cInvoices.reduce((a,i)=>a+i.amount,0);
    const totalPaid = cInvoices.reduce((a,i)=>a+i.paid,0);
    const w = window.open('','','width=700,height=600');
    w.document.write(`<!DOCTYPE html><html><head><title>Statement - ${c.name}</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:650px;margin:auto}table{width:100%;border-collapse:collapse;margin:20px 0}th{background:#0f172a;color:#fff;padding:8px 12px;text-align:left;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px}.tr td{font-weight:800;background:#f8fafc}.green{color:#16a34a}.red{color:#dc2626}@media print{body{padding:20px}}</style></head><body><h1>🖨️ Bigbiney Printing Press</h1><h2>Customer Statement</h2><p><strong>${c.name}</strong> | ${c.phone||''} | ${c.email||''}</p><p>Generated: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Invoice #</th><th>Date</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${cInvoices.map(i=>`<tr><td>${i.invoice_no}</td><td>${i.date}</td><td>${i.due_date||'—'}</td><td>GH₵${i.amount.toFixed(2)}</td><td class="green">GH₵${i.paid.toFixed(2)}</td><td class="${i.amount-i.paid>0?'red':'green'}">GH₵${(i.amount-i.paid).toFixed(2)}</td><td>${i.status}</td></tr>`).join('')}<tr class="tr"><td colspan="3"><strong>TOTALS</strong></td><td>GH₵${totalAmt.toFixed(2)}</td><td class="green">GH₵${totalPaid.toFixed(2)}</td><td class="${totalAmt-totalPaid>0?'red':'green'}">GH₵${(totalAmt-totalPaid).toFixed(2)}</td><td></td></tr></tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Customer CRM</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name, phone, email…" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13, minWidth: 180 }} />
          <Btn onClick={() => { setForm(EMPTY_CX); setEditId(null); setModal(true); }}>+ Add Customer</Btn>
          <label style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 6, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', opacity: importing ? 0.6 : 1 }}>
            {importing ? 'Importing…' : '📥 Import CSV'}
            <input type="file" accept=".csv" onChange={handleCSVImport} style={{ display: 'none' }} disabled={importing} />
          </label>
          <Btn variant="ghost" onClick={downloadTemplate}>📄 Template</Btn>
          {customers.length > 0 && <Btn variant="danger" onClick={delAll}>🗑️ Delete All</Btn>}
        </div>
      </div>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#15803d' }}>
        📥 <strong>CSV Import:</strong> Your file needs a <strong>name</strong> column. Optional: email, phone, whatsapp, address. <button onClick={downloadTemplate} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>Download template →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Customers" value={customers.length} accent="#2563eb" />
        <StatCard label="With WhatsApp"   value={customers.filter(c=>c.whatsapp||c.phone).length} accent="#25D366" />
        <StatCard label="Outstanding"     value={fmt(invoices.filter(i=>i.status!=='paid').reduce((a,i)=>a+(i.amount-i.paid),0))} accent="#dc2626" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Name','Email','Phone','WhatsApp','Jobs','Revenue','Outstanding','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {filtered.map(c => {
                const cJobs = jobs.filter(j => j.customer_id === c.id);
                const cRev  = invoices.filter(i => i.customer_id === c.id).reduce((a,i) => a+(i.paid||0), 0);
                const cOwed = invoices.filter(i => i.customer_id === c.id && i.status !== 'paid').reduce((a,i) => a+(i.amount-i.paid), 0);
                const wa    = c.whatsapp || c.phone || '';
                return (
                  <tr key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selected?.id === c.id ? '#eff6ff' : 'transparent' }}>
                    <TD style={{ fontWeight: 600 }}>{c.name}</TD>
                    <TD style={{ color: '#6b7280', fontSize: 12 }}>{c.email || '—'}</TD>
                    <TD style={{ fontSize: 12 }}>{c.phone || '—'}</TD>
                    <TD>
                      {wa ? (
                        <button onClick={e => { e.stopPropagation(); openWhatsApp(wa, `Hi ${c.name}! This is Bigbiney Printing Press.`); }} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>💬 Chat</button>
                      ) : <span style={{ color: '#fca5a5', fontSize: 11 }}>No number</span>}
                    </TD>
                    <TD>{cJobs.length}</TD>
                    <TD style={{ fontWeight: 600, color: '#16a34a' }}>{fmt(cRev)}</TD>
                    <TD style={{ fontWeight: 700, color: cOwed > 0 ? '#dc2626' : '#16a34a' }}>{cOwed > 0 ? fmt(cOwed) : '✓ Paid'}</TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <Btn variant="ghost"  small onClick={() => { setForm({ name: c.name, email: c.email||'', phone: c.phone||'', address: c.address||'', whatsapp: c.whatsapp||'' }); setEditId(c.id); setModal(true); }}>Edit</Btn>
                        <Btn variant="danger" small onClick={() => del(c.id)}>Del</Btn>
                      </div>
                    </TD>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No customers found</td></tr>}
            </tbody>
          </table>
        </div>

        {selected && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{selected.name}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 3px' }}>📧 {selected.email || 'No email'}</p>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 3px' }}>📞 {selected.phone || 'No phone'}</p>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>💬 WhatsApp: {selected.whatsapp || selected.phone || 'Not set'}</p>
            {(selected.whatsapp || selected.phone) && (
              <button onClick={() => openWhatsApp(selected.whatsapp || selected.phone, `Hi ${selected.name}! This is Bigbiney Printing Press.`)} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'block', width: '100%' }}>
                💬 Open WhatsApp
              </button>
            )}
            <button onClick={() => printStatement(selected)} style={{ background: '#2563eb', border: 'none', color: '#fff', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'block', width: '100%' }}>
              🖨️ Print Statement
            </button>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>📍 {selected.address || 'No address'}</p>
            <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 8 }}>Job History</h4>
            {jobs.filter(j => j.customer_id === selected.id).map(j => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f8fafc', borderRadius: 6, marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{j.job_no}</span>
                  <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{(j.description||'').substring(0, 28)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt(j.price)}</span>
                  <Badge text={j.status} />
                </div>
              </div>
            ))}
            {jobs.filter(j => j.customer_id === selected.id).length === 0 && <p style={{ fontSize: 12, color: '#9ca3af' }}>No jobs yet</p>}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Customer' : 'Add Customer'} onClose={() => { setModal(false); setForm(EMPTY_CX); setEditId(null); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Inp label="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <Inp label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Inp label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Inp label="WhatsApp Number" placeholder="+233..." value={form.whatsapp||''} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
            <div style={{ gridColumn: '1/-1' }}><Inp label="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => { setModal(false); setForm(EMPTY_CX); setEditId(null); }}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Customer'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

const EMPTY_INV = { name: '', category: 'Paper', unit: 'Ream', quantity: '', reorder_point: '', unit_cost: '', supplier: '' };

function InventoryTab({ inventory, setInventory, addNotif, userId }) {
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState(EMPTY_INV);
  const [editId, setEditId] = useState(null);
  const [cat,    setCat]    = useState('All');
  const [saving, setSaving] = useState(false);

  const cats     = ['All', ...Array.from(new Set(inventory.map(i => i.category)))];
  const filtered = inventory.filter(i => cat === 'All' || i.category === cat);
  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    const item = { ...form, quantity: parseFloat(form.quantity)||0, reorder_point: parseFloat(form.reorder_point)||0, unit_cost: parseFloat(form.unit_cost)||0 };
    if (editId) {
      const { data, error } = await db.updateInventoryItem(editId, item);
      if (!error) setInventory(inventory.map(i => i.id === editId ? data : i));
    } else {
      const { data, error } = await db.addInventoryItem(userId, item);
      if (!error) { setInventory([...inventory, data]); addNotif(`${form.name} added`, 'success'); }
    }
    setSaving(false); setModal(false); setForm(EMPTY_INV); setEditId(null);
  };
  const adjust = async (id, delta) => {
    const item = inventory.find(i => i.id === id);
    const q = Math.max(0, item.quantity + delta);
    const { data, error } = await db.updateInventoryItem(id, { quantity: q });
    if (!error) {
      setInventory(inventory.map(i => i.id === id ? data : i));
      if (q <= item.reorder_point) addNotif(`⚠️ Low stock: ${item.name} (${q} ${item.unit})`, 'warning');
    }
  };
  const del = async (id) => {
    const { error } = await db.deleteInventoryItem(id);
    if (!error) setInventory(inventory.filter(i => i.id !== id));
  };
  const totalValue = inventory.reduce((a, i) => a + i.quantity * (i.unit_cost||0), 0);
  const lowCount   = inventory.filter(i => i.quantity <= i.reorder_point).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Inventory</h2>
        <Btn onClick={() => { setForm(EMPTY_INV); setEditId(null); setModal(true); }}>+ Add Item</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Items" value={inventory.length} accent="#2563eb" />
        <StatCard label="Stock Value" value={fmt(totalValue)} accent="#16a34a" />
        <StatCard label="Low Stock"   value={lowCount} accent={lowCount > 0 ? '#dc2626' : '#16a34a'} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {cats.map(c => <button key={c} onClick={() => setCat(c)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: cat === c ? '#2563eb' : '#fff', color: cat === c ? '#fff' : '#6b7280', borderColor: cat === c ? '#2563eb' : '#e5e7eb' }}>{c}</button>)}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Item','Category','Qty','Unit','Reorder At','Unit Cost','Value','Supplier','Status','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {filtered.map(item => {
              const low = item.quantity <= item.reorder_point;
              return (
                <tr key={item.id} style={{ background: low ? '#fff5f5' : 'transparent' }}>
                  <TD style={{ fontWeight: 600 }}>{item.name}</TD>
                  <TD>{item.category}</TD>
                  <TD style={{ fontWeight: 700, color: low ? '#dc2626' : '#111' }}>{item.quantity}</TD>
                  <TD>{item.unit}</TD>
                  <TD style={{ color: '#6b7280' }}>{item.reorder_point}</TD>
                  <TD>{fmt(item.unit_cost||0)}</TD>
                  <TD style={{ fontWeight: 600 }}>{fmt(item.quantity*(item.unit_cost||0))}</TD>
                  <TD style={{ color: '#6b7280' }}>{item.supplier}</TD>
                  <TD>{low ? <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>⚠️ LOW</span> : <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>OK</span>}</TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <button onClick={() => adjust(item.id, -1)} style={{ background: '#fee2e2', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontWeight: 800, color: '#dc2626' }}>−</button>
                      <button onClick={() => adjust(item.id,  1)} style={{ background: '#dcfce7', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontWeight: 800, color: '#16a34a' }}>+</button>
                      <Btn variant="ghost"  small onClick={() => { setForm({ ...item, quantity: String(item.quantity), reorder_point: String(item.reorder_point), unit_cost: String(item.unit_cost) }); setEditId(item.id); setModal(true); }}>Edit</Btn>
                      <Btn variant="danger" small onClick={() => del(item.id)}>Del</Btn>
                    </div>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={editId ? 'Edit Item' : 'Add Item'} onClose={() => { setModal(false); setForm(EMPTY_INV); setEditId(null); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Inp label="Item Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <Sel label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {['Paper','Ink','Garments','Finishing','Equipment','Other'].map(c => <option key={c}>{c}</option>)}
            </Sel>
            <Inp label="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            <Inp label="Quantity" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            <Inp label="Reorder Point" type="number" value={form.reorder_point} onChange={e => setForm({ ...form, reorder_point: e.target.value })} />
            <Inp label="Unit Cost (GH₵)" type="number" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} />
            <Inp label="Supplier" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => { setModal(false); setForm(EMPTY_INV); setEditId(null); }}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Item'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InvoicesTab({ invoices, setInvoices, jobs, customers, setSales, addNotif, userId }) {
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({ job_id: '', customer: '', customer_id: '', due_date: '', items: [{ desc: '', qty: 1, rate: '', total: 0 }] });

  const calcTotal  = (items) => items.reduce((a, i) => a + ((parseFloat(i.qty)||0)*(parseFloat(i.rate)||0)), 0);
  const updateItem = (idx, field, val) => {
    const items = form.items.map((it, i) => { if (i !== idx) return it; const u = { ...it, [field]: val }; u.total = (parseFloat(u.qty)||0)*(parseFloat(u.rate)||0); return u; });
    setForm({ ...form, items });
  };

  const create = async () => {
    const total = calcTotal(form.items);
    if (!form.customer || total === 0) return alert('Select a customer and add line items.');
    const payload = {
      job_id:     form.job_id || null,
      customer:   form.customer,
      customer_id: form.customer_id || null,
      due_date:   form.due_date || null,
      invoice_no: `INV-${String(invoices.length + 1).padStart(3,'0')}`,
      date:       todayStr(),
      amount:     total,
      paid:       0,
      status:     'unpaid',
    };
    const { data, error } = await db.addInvoice(userId, payload);
    if (!error) {
      setInvoices([...invoices, { ...data, items: form.items }]);
      addNotif(`Invoice ${payload.invoice_no} created`, 'success');
      setModal(false);
      setForm({ job_id: '', customer: '', customer_id: '', due_date: '', items: [{ desc: '', qty: 1, rate: '', total: 0 }] });
    } else addNotif('Error creating invoice — check if items column exists in DB', 'warning');
  };

  const markPaid = async (id) => {
    const inv = invoices.find(i => i.id === id);
    const { data, error } = await db.updateInvoice(id, { paid: inv.amount, status: 'paid' });
    if (!error) {
      setInvoices(invoices.map(i => i.id === id ? { ...data, items: inv.items } : i));
      const { data: saleData } = await db.addSale(userId, { date: todayStr(), amount: inv.amount, job_id: inv.job_id || null });
      if (saleData) setSales(s => [...s, saleData]);
      addNotif(`Invoice ${inv.invoice_no} paid — ${fmt(inv.amount)} recorded`, 'success');
    }
  };

  const recordPartial = async (id) => {
    const raw = prompt('Enter amount received (GH₵):');
    const amt = parseFloat(raw);
    if (!amt || isNaN(amt)) return;
    const inv = invoices.find(i => i.id === id);
    const newPaid = Math.min(inv.paid + amt, inv.amount);
    const { data, error } = await db.updateInvoice(id, { paid: newPaid, status: newPaid >= inv.amount ? 'paid' : 'partial' });
    if (!error) {
      setInvoices(invoices.map(i => i.id === id ? { ...data, items: inv.items } : i));
      const { data: saleData } = await db.addSale(userId, { date: todayStr(), amount: amt, job_id: null });
      if (saleData) setSales(s => [...s, saleData]);
      addNotif(`Partial payment of ${fmt(amt)} recorded`, 'info');
    }
  };

  const del = async (id) => {
    const { error } = await db.deleteInvoice(id);
    if (!error) setInvoices(invoices.filter(i => i.id !== id));
  };

  const printInvoice = (inv) => {
    const items = inv.items && typeof inv.items === 'object' ? (Array.isArray(inv.items) ? inv.items : JSON.parse(inv.items)) : [{ desc: 'Services', qty: 1, rate: inv.amount, total: inv.amount }];
    const w = window.open('', '', 'width=700,height=600');
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.invoice_no}</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:auto}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#0f172a;color:#fff;padding:8px 12px;text-align:left;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px}.tot td{font-weight:800}@media print{body{padding:20px}}</style></head><body><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px"><div><div style="font-size:22px;font-weight:900">🖨️ Bigbiney Printing Press</div></div><div style="text-align:right"><h2 style="color:#2563eb;margin:0 0 4px">${inv.invoice_no}</h2><p style="margin:0;font-size:13px">Date: <strong>${inv.date}</strong></p><p style="margin:0;font-size:13px">Due: <strong>${inv.due_date||'On receipt'}</strong></p><span style="background:${inv.status==='paid'?'#dcfce7':'#fee2e2'};color:${inv.status==='paid'?'#15803d':'#dc2626'};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">${inv.status.toUpperCase()}</span></div></div><p><strong>Bill To:</strong> ${inv.customer}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>${items.map(it=>`<tr><td>${it.desc||'Services'}</td><td>${it.qty}</td><td>GH₵${(parseFloat(it.rate)||0).toFixed(2)}</td><td>GH₵${((parseFloat(it.qty)||0)*(parseFloat(it.rate)||0)).toFixed(2)}</td></tr>`).join('')}<tr class="tot"><td colspan="3" style="text-align:right">Total</td><td>GH₵${inv.amount.toFixed(2)}</td></tr><tr><td colspan="3" style="text-align:right;color:#16a34a">Paid</td><td style="color:#16a34a">GH₵${inv.paid.toFixed(2)}</td></tr><tr><td colspan="3" style="text-align:right;color:#dc2626">Balance</td><td style="color:#dc2626">GH₵${(inv.amount-inv.paid).toFixed(2)}</td></tr></tbody></table><p style="color:#9ca3af;font-size:11px">Printed ${new Date().toLocaleString()} — Bigbiney Printing Press</p><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  const outstanding = invoices.filter(i => i.status !== 'paid').reduce((a, i) => a + (i.amount - i.paid), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Invoices & Payments</h2>
        <Btn onClick={() => setModal(true)}>+ Create Invoice</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Invoiced" value={fmt(invoices.reduce((a,i)=>a+i.amount,0))} accent="#2563eb" />
        <StatCard label="Collected"      value={fmt(invoices.reduce((a,i)=>a+i.paid,0))}   accent="#16a34a" />
        <StatCard label="Outstanding"    value={fmt(outstanding)} accent="#dc2626" />
        <StatCard label="Overdue"        value={invoices.filter(i=>i.status!=='paid'&&i.due_date<todayStr()).length} accent="#f59e0b" />
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Invoice #','Customer','Date','Due','Amount','Paid','Balance','Status','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id}>
                <TD style={{ fontWeight: 700, color: '#2563eb' }}>{inv.invoice_no}</TD>
                <TD>{inv.customer}</TD><TD>{inv.date}</TD>
                <TD style={{ color: inv.due_date < todayStr() && inv.status !== 'paid' ? '#dc2626' : '#374151' }}>{inv.due_date}</TD>
                <TD style={{ fontWeight: 600 }}>{fmt(inv.amount)}</TD>
                <TD style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(inv.paid)}</TD>
                <TD style={{ color: inv.amount-inv.paid > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{fmt(inv.amount-inv.paid)}</TD>
                <TD><Badge text={inv.status === 'paid' ? 'completed' : inv.status === 'partial' ? 'in-progress' : 'queued'} /></TD>
                <TD>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {inv.status !== 'paid' && <Btn variant="success" small onClick={() => markPaid(inv.id)}>Paid ✓</Btn>}
                    {inv.status !== 'paid' && <Btn variant="ghost"   small onClick={() => recordPartial(inv.id)}>Partial</Btn>}
                    <Btn variant="ghost"  small onClick={() => printInvoice(inv)}>🖨️ Print</Btn>
                    <Btn variant="danger" small onClick={() => del(inv.id)}>Del</Btn>
                  </div>
                </TD>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No invoices yet</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title="Create Invoice" onClose={() => setModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Sel label="Customer *" value={form.customer} onChange={e => { const c = customers.find(x => x.name === e.target.value); setForm({ ...form, customer: e.target.value, customer_id: c?.id||'' }); }}>
              <option value="">— Select Customer —</option>
              {customers.map(c => <option key={c.id}>{c.name}</option>)}
            </Sel>
            <Sel label="Link to Job (optional)" value={form.job_id} onChange={e => { const j = jobs.find(x => x.id === e.target.value); if (j) setForm({ ...form, job_id: e.target.value, customer: j.customer, customer_id: j.customer_id, items: [{ desc: j.description, qty: 1, rate: String(j.price), total: j.price }] }); else setForm({ ...form, job_id: e.target.value }); }}>
              <option value="">— None —</option>
              {jobs.filter(j => j.status === 'completed').map(j => <option key={j.id} value={j.id}>{j.job_no} — {j.description}</option>)}
            </Sel>
            <Inp label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <h4 style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700 }}>Line Items</h4>
            {form.items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
                <Inp placeholder="Description" value={item.desc} onChange={e => updateItem(idx, 'desc', e.target.value)} />
                <Inp placeholder="Qty" type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} />
                <Inp placeholder="Rate" type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} />
                <button onClick={() => setForm({ ...form, items: form.items.filter((_,i) => i !== idx) })} style={{ background: '#fee2e2', border: 'none', borderRadius: 4, padding: '8px 10px', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>×</button>
              </div>
            ))}
            <Btn variant="ghost" onClick={() => setForm({ ...form, items: [...form.items, { desc: '', qty: 1, rate: '', total: 0 }] })}>+ Add Line</Btn>
            <div style={{ textAlign: 'right', fontSize: 17, fontWeight: 800, color: '#2563eb' }}>Total: {fmt(calcTotal(form.items))}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={create}>Create Invoice</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FinanceTab({ sales, setSales, expenses, setExpenses, addNotif, userId, recurringExpenses, setRecurringExpenses }) {
  const [sf, setSf]         = useState({ date: todayStr(), amount: '', payment_method: 'Cash' });
  const [ef, setEf]         = useState({ date: todayStr(), category: 'Paper', description: '', amount: '' });
  const [showSF, setShowSF] = useState(false);
  const [showEF, setShowEF] = useState(false);
  const [showRE, setShowRE] = useState(false);
  const [reForm, setReForm] = useState({ description: '', category: 'Salaries', amount: '', day_of_month: '1' });

  const month  = getCurrentMonth();
  const mSales = sales.filter(s => s.date?.startsWith(month)).reduce((a, s) => a + s.amount, 0);
  const mExp   = expenses.filter(e => e.date?.startsWith(month)).reduce((a, e) => a + e.amount, 0);

  const addSale = async () => {
    if (!sf.date || !sf.amount) return;
    const { data, error } = await db.addSale(userId, { date: sf.date, amount: parseFloat(sf.amount), job_id: null, payment_method: sf.payment_method });
    if (!error) { setSales([...sales, data]); setSf({ date: todayStr(), amount: '', payment_method: 'Cash' }); setShowSF(false); addNotif(`Sale of ${fmt(sf.amount)} recorded`, 'success'); }
  };
  const addExp = async () => {
    if (!ef.date || !ef.amount) return;
    const { data, error } = await db.addExpense(userId, { date: ef.date, category: ef.category, description: ef.description, amount: parseFloat(ef.amount) });
    if (!error) { setExpenses([...expenses, data]); setEf({ date: todayStr(), category: 'Paper', description: '', amount: '' }); setShowEF(false); addNotif(`Expense of ${fmt(ef.amount)} recorded`, 'info'); }
  };
  const addRecurring = async () => {
    if (!reForm.description || !reForm.amount) return;
    const { data, error } = await db.addRecurringExpense(userId, { ...reForm, amount: parseFloat(reForm.amount)||0, day_of_month: parseInt(reForm.day_of_month)||1, active: true });
    if (!error) { setRecurringExpenses([...recurringExpenses, data]); setReForm({ description: '', category: 'Salaries', amount: '', day_of_month: '1' }); addNotif('Recurring expense added', 'success'); }
  };
  const recordRecurring = async (re) => {
    const { data, error } = await db.addExpense(userId, { date: todayStr(), category: re.category, description: re.description, amount: re.amount });
    if (!error) { setExpenses([...expenses, data]); addNotif(`${re.description} recorded as expense`, 'success'); }
  };
  const delRecurring = async (id) => {
    const { error } = await db.deleteRecurringExpense(id);
    if (!error) setRecurringExpenses(recurringExpenses.filter(r => r.id !== id));
  };
  const delSale = async (id) => { const { error } = await db.deleteSale(id); if (!error) setSales(sales.filter(x => x.id !== id)); };
  const delExp  = async (id) => { const { error } = await db.deleteExpense(id); if (!error) setExpenses(expenses.filter(x => x.id !== id)); };

  const pmBreakdown  = ['Cash','Mobile Money','Bank Transfer','Credit','Other'].map(m => ({ method: m, total: sales.filter(s => (s.payment_method||'Cash') === m).reduce((a,s)=>a+s.amount,0) })).filter(x => x.total > 0);
  const todaySales   = sales.filter(s => s.date === todayStr()).reduce((a,s)=>a+s.amount,0);
  const dueRecurring = recurringExpenses.filter(re => re.active && re.day_of_month <= new Date().getDate());

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Finance</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="success" onClick={() => { setShowSF(v=>!v); setShowEF(false); setShowRE(false); }}>+ Record Sale</Btn>
          <Btn variant="warning" onClick={() => { setShowEF(v=>!v); setShowSF(false); setShowRE(false); }}>+ Add Expense</Btn>
          <Btn variant="purple"  onClick={() => { setShowRE(v=>!v); setShowSF(false); setShowEF(false); }}>🔁 Recurring</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Monthly Income"   value={fmt(mSales)} accent="#16a34a" />
        <StatCard label="Monthly Expenses" value={fmt(mExp)}   accent="#dc2626" />
        <StatCard label="Monthly Profit"   value={fmt(mSales - mExp)} accent={mSales >= mExp ? '#2563eb' : '#dc2626'} />
        <StatCard label="All-Time Revenue" value={fmt(sales.reduce((a,s)=>a+s.amount,0))} accent="#7c3aed" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>🗃️ Today's Cash Drawer</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {['Cash','Mobile Money','Bank Transfer','Credit','Other'].map(method => {
            const total = sales.filter(s => s.date === todayStr() && (s.payment_method||'Cash') === method).reduce((a,s)=>a+s.amount,0);
            if (total === 0) return null;
            return <div key={method} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{fmt(total)}</div><div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{method}</div></div>;
          })}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{fmt(todaySales)}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Today Total</div>
          </div>
          {todaySales === 0 && <span style={{ fontSize: 13, color: '#9ca3af' }}>No sales recorded today yet</span>}
        </div>
      </div>

      {pmBreakdown.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>Payment Method Breakdown (All Time)</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {pmBreakdown.map(p => <div key={p.method} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{fmt(p.total)}</div><div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{p.method}</div></div>)}
          </div>
        </div>
      )}

      {dueRecurring.length > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#856404' }}>🔁 Recurring Expenses Due This Month</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {dueRecurring.map(re => (
              <div key={re.id} style={{ background: '#fff', border: '1px solid #ffc107', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div><div style={{ fontWeight: 700, fontSize: 13 }}>{re.description}</div><div style={{ fontSize: 11, color: '#6b7280' }}>{re.category} — {fmt(re.amount)} — Day {re.day_of_month}</div></div>
                <Btn variant="warning" small onClick={() => recordRecurring(re)}>Record Now</Btn>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSF && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#15803d' }}>Record Sale</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Inp label="Date" type="date" value={sf.date} onChange={e => setSf({ ...sf, date: e.target.value })} />
            <Inp label="Amount (GH₵)" type="number" value={sf.amount} onChange={e => setSf({ ...sf, amount: e.target.value })} />
            <Sel label="Payment Method" value={sf.payment_method} onChange={e => setSf({ ...sf, payment_method: e.target.value })}>
              {['Cash','Mobile Money','Bank Transfer','Credit','Other'].map(m => <option key={m}>{m}</option>)}
            </Sel>
            <Btn variant="success" onClick={addSale}>Record</Btn>
            <Btn variant="ghost" onClick={() => setShowSF(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {showEF && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>Record Expense</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Inp label="Date" type="date" value={ef.date} onChange={e => setEf({ ...ef, date: e.target.value })} />
            <Sel label="Category" value={ef.category} onChange={e => setEf({ ...ef, category: e.target.value })}>
              {['Paper','Ink & Toner','Maintenance','Salaries','Utilities','Other'].map(c => <option key={c}>{c}</option>)}
            </Sel>
            <Inp label="Description" value={ef.description} onChange={e => setEf({ ...ef, description: e.target.value })} />
            <Inp label="Amount (GH₵)" type="number" value={ef.amount} onChange={e => setEf({ ...ef, amount: e.target.value })} />
            <Btn variant="warning" onClick={addExp}>Record</Btn>
            <Btn variant="ghost" onClick={() => setShowEF(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {showRE && (
        <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>🔁 Manage Recurring Expenses</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
            <Inp label="Description" value={reForm.description} onChange={e => setReForm({ ...reForm, description: e.target.value })} placeholder="e.g. Rose Salary, ECG Bill" />
            <Sel label="Category" value={reForm.category} onChange={e => setReForm({ ...reForm, category: e.target.value })}>
              {['Salaries','Utilities','Maintenance','Paper','Ink & Toner','Other'].map(c => <option key={c}>{c}</option>)}
            </Sel>
            <Inp label="Amount (GH₵)" type="number" value={reForm.amount} onChange={e => setReForm({ ...reForm, amount: e.target.value })} />
            <Inp label="Day of Month" type="number" value={reForm.day_of_month} onChange={e => setReForm({ ...reForm, day_of_month: e.target.value })} />
            <Btn variant="purple" onClick={addRecurring}>Add</Btn>
          </div>
          {recurringExpenses.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {recurringExpenses.map(re => (
                <div key={re.id} style={{ background: '#fff', border: '1px solid #c4b5fd', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{re.description}</div><div style={{ fontSize: 11, color: '#6b7280' }}>{re.category} — {fmt(re.amount)} — day {re.day_of_month}</div></div>
                  <Btn variant="success" small onClick={() => recordRecurring(re)}>Record</Btn>
                  <Btn variant="danger"  small onClick={() => delRecurring(re.id)}>Del</Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#15803d' }}>💚 Income ({sales.length})</h3>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {[...sales].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f9fafb', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{s.date}</span>
                {s.payment_method && <span style={{ fontSize: 10, background: '#f1f5f9', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>{s.payment_method}</span>}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{fmt(s.amount)}</span>
                <button onClick={() => delSale(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>❤️ Expenses ({expenses.length})</h3>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {[...expenses].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f9fafb', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{e.date}</span>
                <span style={{ fontSize: 11, background: '#f1f5f9', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>{e.category}</span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap' }}>{fmt(e.amount)}</span>
                <button onClick={() => delExp(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PayrollTab({ payroll, setPayroll, addNotif, userId, expenses, setExpenses }) {
  const [modal,       setModal]       = useState(false);
  const [form,        setForm]        = useState({ staff_name: '', amount: '', period: '', date: todayStr(), payment_method: 'Cash', notes: '' });
  const [saving,      setSaving]      = useState(false);
  const [staffList,   setStaffList]   = useState(STAFF_LIST);
  const [addingStaff, setAddingStaff] = useState(false);
  const [newStaff,    setNewStaff]    = useState('');
  const [staffLoaded, setStaffLoaded] = useState(false);

  // Load staff list from Supabase on mount
  useEffect(() => {
    db.getSetting(userId, 'staff_list').then(({ data }) => {
      if (data && data.value) {
        try { setStaffList(JSON.parse(data.value)); } catch { setStaffList(STAFF_LIST); }
      }
      setStaffLoaded(true);
    });
  }, [userId]);

  // Save staff list to Supabase whenever it changes (after initial load)
  useEffect(() => {
    if (!staffLoaded) return;
    db.setSetting(userId, 'staff_list', JSON.stringify(staffList));
  }, [staffList, staffLoaded, userId]);

  const totalPaid = payroll.reduce((a, p) => a + (p.amount||0), 0);
  const thisMonth = getCurrentMonth();
  const monthPaid = payroll.filter(p => (p.date||'').startsWith(thisMonth)).reduce((a, p) => a + (p.amount||0), 0);
  const byStaff   = staffList.map(name => ({
    name,
    total:         payroll.filter(p => p.staff_name === name).reduce((a, p) => a + (p.amount||0), 0),
    lastPaid:      payroll.filter(p => p.staff_name === name).sort((a,b) => (b.date||'').localeCompare(a.date||''))[0]?.date || null,
    paidThisMonth: payroll.filter(p => p.staff_name === name && (p.date||'').startsWith(thisMonth)).reduce((a,p)=>a+(p.amount||0),0),
  }));

  const save = async () => {
    if (!form.staff_name || !form.amount) return;
    setSaving(true);
    const amt = parseFloat(form.amount)||0;
    const { data, error } = await db.addPayroll(userId, { ...form, amount: amt });
    if (!error) {
      setPayroll([data, ...payroll]);
      // Auto-record as Salaries expense so it deducts from monthly income
      const { data: expData } = await db.addExpense(userId, {
        date: form.date, category: 'Salaries',
        description: `Salary — ${form.staff_name}${form.period ? ' ('+form.period+')' : ''}`,
        amount: amt,
      });
      if (expData && setExpenses) setExpenses(prev => [expData, ...prev]);
      addNotif(`${form.staff_name} paid ${fmt(amt)} — recorded as expense`, 'success');
      setModal(false);
      setForm({ staff_name: '', amount: '', period: '', date: todayStr(), payment_method: 'Cash', notes: '' });
    } else addNotif('Error saving payroll record', 'warning');
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this payroll record?')) return;
    const { error } = await db.deletePayroll(id);
    if (!error) {
      setPayroll(prev => prev.filter(p => p.id !== id));
      addNotif('Payroll record deleted', 'success');
    } else addNotif('Error deleting record', 'warning');
  };

  const removeStaff = (name) => {
    if (!window.confirm(`Remove ${name} from staff list? Their payroll history stays.`)) return;
    setStaffList(prev => prev.filter(s => s !== name));
  };

  const addStaffMember = () => {
    const n = newStaff.trim();
    if (!n) return;
    if (staffList.includes(n)) { alert('Staff member already exists'); return; }
    setStaffList(prev => [...prev, n]);
    setNewStaff(''); setAddingStaff(false);
    addNotif(`${n} added to staff`, 'success');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>👷 Staff Payroll</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => setAddingStaff(v => !v)}>+ Add Staff</Btn>
          <Btn onClick={() => setModal(true)}>+ Record Payment</Btn>
        </div>
      </div>
      {addingStaff && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 14, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Inp label="New Staff Name" value={newStaff} onChange={e => setNewStaff(e.target.value)} placeholder="e.g. Kojo" />
          <Btn onClick={addStaffMember}>Add</Btn>
          <Btn variant="ghost" onClick={() => { setAddingStaff(false); setNewStaff(''); }}>Cancel</Btn>
        </div>
      )}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: '#15803d' }}>
        💡 Salary payments are <strong>automatically recorded as expenses</strong> and deducted from monthly income.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Paid (All Time)" value={fmt(totalPaid)} accent="#2563eb" />
        <StatCard label="Paid This Month"       value={fmt(monthPaid)} accent="#16a34a" />
        <StatCard label="Staff Members"         value={staffList.length} accent="#7c3aed" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
        {byStaff.map(s => (
          <div key={s.name} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, position: 'relative' }}>
            <button onClick={() => removeStaff(s.name)} title="Remove from staff list" style={{ position: 'absolute', top: 8, right: 8, background: '#fee2e2', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', color: '#dc2626', fontWeight: 800, fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>👤 {s.name}</div>
            <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>All time: {fmt(s.total)}</div>
            <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>This month: {fmt(s.paidThisMonth)}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Last paid: {s.lastPaid || 'Never'}</div>
            <Btn small variant="primary" style={{ marginTop: 8 }} onClick={() => { setForm(f => ({ ...f, staff_name: s.name })); setModal(true); }}>+ Pay Now</Btn>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Staff','Amount','Period','Date','Method','Notes','Action'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {[...payroll].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(p => (
              <tr key={p.id}>
                <TD style={{ fontWeight: 600 }}>👤 {p.staff_name}</TD>
                <TD style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(p.amount)}</TD>
                <TD style={{ color: '#6b7280' }}>{p.period || '—'}</TD>
                <TD>{p.date}</TD>
                <TD><span style={{ background: '#f1f5f9', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{p.payment_method}</span></TD>
                <TD style={{ color: '#6b7280', fontSize: 12 }}>{p.notes}</TD>
                <TD><Btn variant="danger" small onClick={() => del(p.id)}>Del</Btn></TD>
              </tr>
            ))}
            {payroll.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No payroll records yet</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title="Record Salary Payment" onClose={() => setModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label="Staff Member *" value={form.staff_name} onChange={e => setForm({ ...form, staff_name: e.target.value })}>
              <option value="">— Select Staff —</option>
              {staffList.map(s => <option key={s}>{s}</option>)}
            </Sel>
            <Inp label="Amount (GH₵) *" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <Inp label="Period (e.g. May 2026)" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} />
            <Inp label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <Sel label="Payment Method" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
              {['Cash','Mobile Money','Bank Transfer'].map(m => <option key={m}>{m}</option>)}
            </Sel>
            <Inp label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Record Payment'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LoansTab({ loans, setLoans, addNotif, userId }) {
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState({ name: '', type: 'borrowed', amount: '', rate: '', date: todayStr(), due_date: '', paid: '0', notes: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const totalBorrowed = loans.filter(l => l.type === 'borrowed').reduce((a, l) => a + (l.amount - l.paid), 0);
  const totalLent     = loans.filter(l => l.type === 'lent').reduce((a, l) => a + (l.amount - l.paid), 0);

  const save = async () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    const loan = { ...form, amount: parseFloat(form.amount)||0, rate: parseFloat(form.rate)||0, paid: parseFloat(form.paid)||0 };
    if (editId) {
      const { data, error } = await db.updateLoan(editId, loan);
      if (!error) { setLoans(loans.map(l => l.id === editId ? data : l)); addNotif('Loan updated', 'success'); }
    } else {
      const { data, error } = await db.addLoan(userId, loan);
      if (!error) { setLoans([...loans, data]); addNotif('Loan recorded', 'success'); }
    }
    setSaving(false); setModal(false); setForm({ name: '', type: 'borrowed', amount: '', rate: '', date: todayStr(), due_date: '', paid: '0', notes: '' }); setEditId(null);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this loan?')) return;
    const { error } = await db.deleteLoan(id);
    if (!error) setLoans(loans.filter(l => l.id !== id));
  };

  const recordPayment = async (id) => {
    const raw = prompt('Enter payment amount (GH₵):');
    const amt = parseFloat(raw);
    if (!amt || isNaN(amt)) return;
    const loan = loans.find(l => l.id === id);
    const newPaid = Math.min(loan.paid + amt, loan.amount);
    const { data, error } = await db.updateLoan(id, { paid: newPaid });
    if (!error) { setLoans(loans.map(l => l.id === id ? data : l)); addNotif(`Payment of ${fmt(amt)} recorded`, 'success'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🏦 Loans & Credit</h2>
        <Btn onClick={() => { setForm({ name: '', type: 'borrowed', amount: '', rate: '', date: todayStr(), due_date: '', paid: '0', notes: '' }); setEditId(null); setModal(true); }}>+ Add Loan</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Borrowed" value={fmt(totalBorrowed)} accent="#dc2626" />
        <StatCard label="Total Lent Out" value={fmt(totalLent)}     accent="#f59e0b" />
        <StatCard label="Active Loans"   value={loans.filter(l => l.paid < l.amount).length} accent="#2563eb" />
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Name','Type','Amount','Rate','Date','Due','Paid','Balance','Notes','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {loans.map(l => {
              const balance = l.amount - l.paid;
              const overdue = l.due_date && l.due_date < todayStr() && balance > 0;
              return (
                <tr key={l.id} style={{ background: overdue ? '#fff5f5' : 'transparent' }}>
                  <TD style={{ fontWeight: 600 }}>{l.name}</TD>
                  <TD><span style={{ background: l.type === 'borrowed' ? '#fee2e2' : '#dcfce7', color: l.type === 'borrowed' ? '#dc2626' : '#16a34a', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{l.type === 'borrowed' ? 'Borrowed' : 'Lent'}</span></TD>
                  <TD style={{ fontWeight: 600 }}>{fmt(l.amount)}</TD>
                  <TD>{l.rate ? `${l.rate}%` : '—'}</TD>
                  <TD>{l.date}</TD>
                  <TD style={{ color: overdue ? '#dc2626' : '#374151', fontWeight: overdue ? 700 : 400 }}>{l.due_date || '—'}{overdue ? ' ⚠️' : ''}</TD>
                  <TD style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(l.paid)}</TD>
                  <TD style={{ fontWeight: 700, color: balance > 0 ? '#dc2626' : '#16a34a' }}>{balance > 0 ? fmt(balance) : '✓ Settled'}</TD>
                  <TD style={{ color: '#6b7280', fontSize: 12 }}>{l.notes}</TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {balance > 0 && <Btn variant="success" small onClick={() => recordPayment(l.id)}>Pay</Btn>}
                      <Btn variant="ghost"  small onClick={() => { setForm({ ...l, amount: String(l.amount), rate: String(l.rate), paid: String(l.paid) }); setEditId(l.id); setModal(true); }}>Edit</Btn>
                      <Btn variant="danger" small onClick={() => del(l.id)}>Del</Btn>
                    </div>
                  </TD>
                </tr>
              );
            })}
            {loans.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No loans recorded</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={editId ? 'Edit Loan' : 'Add Loan'} onClose={() => { setModal(false); setEditId(null); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Inp label="Name / Lender / Borrower *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <Sel label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="borrowed">Borrowed (we owe)</option>
              <option value="lent">Lent (they owe us)</option>
            </Sel>
            <Inp label="Amount (GH₵) *" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <Inp label="Interest Rate (%)" type="number" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
            <Inp label="Already Paid (GH₵)" type="number" value={form.paid} onChange={e => setForm({ ...form, paid: e.target.value })} />
            <Inp label="Start Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <Inp label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <div style={{ gridColumn: '1/-1' }}><Inp label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Loan'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ReportsTab({ jobs, sales, expenses, customers, inventory, invoices }) {
  const [period, setPeriod] = useState('month');
  const now   = new Date();
  const month = getCurrentMonth();
  const year  = String(now.getFullYear());

  const filterByPeriod = (arr, dateKey) => {
    if (period === 'month') return arr.filter(x => (x[dateKey]||'').startsWith(month));
    if (period === 'year')  return arr.filter(x => (x[dateKey]||'').startsWith(year));
    return arr;
  };

  const pSales       = filterByPeriod(sales, 'date').reduce((a, s) => a + s.amount, 0);
  const pExpenses    = filterByPeriod(expenses, 'date').reduce((a, e) => a + e.amount, 0);
  const pProfit      = pSales - pExpenses;
  const pJobs        = filterByPeriod(jobs, 'start_date');
  const byType       = JOB_TYPES.map(t => ({ type: t, count: jobs.filter(j=>j.type===t).length, revenue: jobs.filter(j=>j.type===t).reduce((a,j)=>a+(j.price||0),0) })).filter(x=>x.count>0);
  const topCustomers = customers.map(c => ({ name: c.name, jobs: jobs.filter(j=>j.customer_id===c.id).length, revenue: invoices.filter(i=>i.customer_id===c.id).reduce((a,i)=>a+(i.paid||0),0) })).sort((a,b)=>b.revenue-a.revenue).slice(0,5);
  const expByCategory= ['Paper','Ink & Toner','Maintenance','Salaries','Utilities','Other'].map(cat => ({ cat, total: filterByPeriod(expenses,'date').filter(e=>e.category===cat).reduce((a,e)=>a+e.amount,0) })).filter(x=>x.total>0);

  const trend = Array.from({ length: 6 }, (_, i) => {
    const d  = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const ms = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const rev = sales.filter(s=>(s.date||'').startsWith(ms)).reduce((a,s)=>a+s.amount,0);
    const exp = expenses.filter(e=>(e.date||'').startsWith(ms)).reduce((a,e)=>a+e.amount,0);
    return { month: ms.slice(5)+'/'+ms.slice(2,4), rev, exp, profit: rev-exp };
  });
  const maxTrend       = Math.max(...trend.map(t=>Math.max(t.rev,t.exp)),1);
  const completedJobs  = jobs.filter(j=>j.status==='completed').length;
  const completionRate = jobs.length > 0 ? Math.round((completedJobs/jobs.length)*100) : 0;
  const avgJobValue    = jobs.length > 0 ? jobs.reduce((a,j)=>a+(j.price||0),0)/jobs.length : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📈 Reports & Analytics</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['month','This Month'],['year','This Year'],['all','All Time']].map(([val, lbl]) => (
            <button key={val} onClick={() => setPeriod(val)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: period === val ? '#2563eb' : '#fff', color: period === val ? '#fff' : '#6b7280', borderColor: period === val ? '#2563eb' : '#e5e7eb' }}>{lbl}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Revenue"         value={fmt(pSales)}     accent="#16a34a" />
        <StatCard label="Expenses"        value={fmt(pExpenses)}  accent="#dc2626" />
        <StatCard label="Net Profit"      value={fmt(pProfit)}    accent={pProfit >= 0 ? '#2563eb' : '#dc2626'} />
        <StatCard label="Jobs Created"    value={pJobs.length}    accent="#7c3aed" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} accent="#f59e0b" />
        <StatCard label="Avg Job Value"   value={fmt(avgJobValue)} accent="#0891b2" />
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Revenue vs Expenses — Last 6 Months</h3>
        <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>■ Revenue</span>
          <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>■ Expenses</span>
          <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 700 }}>■ Profit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140 }}>
          {trend.map((t, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 110 }}>
                <div style={{ flex: 1, background: '#16a34a', borderRadius: '2px 2px 0 0', height: `${Math.max(2,Math.round((t.rev/maxTrend)*110))}px` }} title={`Revenue: ${fmt(t.rev)}`} />
                <div style={{ flex: 1, background: '#dc2626', borderRadius: '2px 2px 0 0', height: `${Math.max(2,Math.round((t.exp/maxTrend)*110))}px` }} title={`Expenses: ${fmt(t.exp)}`} />
                <div style={{ flex: 1, background: t.profit >= 0 ? '#2563eb' : '#f59e0b', borderRadius: '2px 2px 0 0', height: `${Math.max(2,Math.round((Math.abs(t.profit)/maxTrend)*110))}px` }} title={`Profit: ${fmt(t.profit)}`} />
              </div>
              <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{t.month}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Revenue by Job Type</h3>
          {byType.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No data yet</p>}
          {byType.map(({ type, count, revenue }) => {
            const total = byType.reduce((a,x)=>a+x.revenue,0);
            const pct   = total > 0 ? Math.round((revenue/total)*100) : 0;
            return (
              <div key={type} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>{type} <span style={{ color: '#9ca3af' }}>({count})</span></span>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>{fmt(revenue)} — {pct}%</span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 4, height: 8 }}><div style={{ width: `${pct}%`, background: '#2563eb', height: 8, borderRadius: 4 }} /></div>
              </div>
            );
          })}
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Expense Breakdown</h3>
          {expByCategory.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No expenses in this period</p>}
          {expByCategory.map(({ cat, total }) => {
            const grandTotal = expByCategory.reduce((a,x)=>a+x.total,0);
            const pct = grandTotal > 0 ? Math.round((total/grandTotal)*100) : 0;
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>{cat}</span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(total)} — {pct}%</span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 4, height: 8 }}><div style={{ width: `${pct}%`, background: '#dc2626', height: 8, borderRadius: 4 }} /></div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>🏆 Top Customers</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Rank','Customer','Jobs','Revenue'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {topCustomers.map((c, i) => (
              <tr key={c.name}>
                <TD style={{ fontWeight: 800, color: i===0?'#f59e0b':i===1?'#9ca3af':i===2?'#b45309':'#374151' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</TD>
                <TD style={{ fontWeight: 600 }}>{c.name}</TD>
                <TD>{c.jobs}</TD>
                <TD style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(c.revenue)}</TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Job Status Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
          {JOB_STATUSES.map(s => {
            const count = jobs.filter(j=>j.status===s).length;
            const sc    = STATUS_COLORS[s] || {};
            return (
              <div key={s} style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: sc.color }}>{count}</div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: sc.color, marginTop: 2 }}>{s}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WhatsAppTab({ jobs, customers, sales, expenses, invoices, addNotif }) {
  const [activeSection,  setActiveSection]  = useState('broadcast');
  const [customMsg,      setCustomMsg]      = useState('');
  const [customPhone,    setCustomPhone]    = useState('');
  const [selectedJobs,   setSelectedJobs]   = useState([]);
  const [selectedCusts,  setSelectedCusts]  = useState([]);
  const [notifTemplate,  setNotifTemplate]  = useState('completed');
  const [previewMsg,     setPreviewMsg]     = useState('');
  const [summaryPhone,   setSummaryPhone]   = useState(ADMIN_WHATSAPP);
  const [broadcastMsg,   setBroadcastMsg]   = useState('');
  const [sending,        setSending]        = useState(false);
  const [sentCount,      setSentCount]      = useState(0);

  // Count customers with any phone number
  const custsWithPhone   = customers.filter(c => (c.whatsapp || c.phone || '').trim());
  const jobsWithPhone    = jobs.filter(j => (j.whatsapp || '').trim());
  const jobsWithoutPhone = jobs.filter(j => !(j.whatsapp || '').trim() && !['cancelled'].includes(j.status));

  const handlePreview = (jobId) => { const job = jobs.find(j => j.id === jobId); if (job) setPreviewMsg(generateStatusChangeMsg(job, notifTemplate)); };
  const sendBulk = () => {
    if (!selectedJobs.length) return alert('Select at least one job.');
    let sent = 0;
    selectedJobs.forEach(id => { const job = jobs.find(j => j.id === id); if (job && job.whatsapp) { setTimeout(() => openWhatsApp(job.whatsapp, generateStatusChangeMsg(job, notifTemplate)), sent * 800); sent++; } });
    addNotif(`Opened WhatsApp for ${sent} customer(s)`, 'success');
  };
  const toggleJob  = (id) => setSelectedJobs(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  const toggleCust = (id) => setSelectedCusts(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return alert('Please type a message first.');
    const targets = selectedCusts.length > 0
      ? custsWithPhone.filter(c => selectedCusts.includes(c.id))
      : custsWithPhone;
    if (targets.length === 0) return alert('No customers with phone numbers.');
    if (!window.confirm(`Send to ${targets.length} customer(s)? This will open WhatsApp ${targets.length} time(s).`)) return;
    setSending(true); setSentCount(0);
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      const phone = c.whatsapp || c.phone;
      const msg = broadcastMsg.replace(/{name}/gi, c.name);
      setTimeout(() => { openWhatsApp(phone, msg); setSentCount(i + 1); }, i * 900);
    }
    setTimeout(() => { setSending(false); addNotif(`Broadcast sent to ${targets.length} customer(s)`, 'success'); }, targets.length * 900 + 500);
  };

  const sections = [
    { id: 'broadcast',     label: '📣 Broadcast to Customers' },
    { id: 'notifications', label: '📢 Job Notifications' },
    { id: 'summary',       label: '📊 Daily / Weekly Summary' },
    { id: 'custom',        label: '✏️ Custom Message' },
    { id: 'missing',       label: '⚠️ Missing Numbers' },
  ];

  const FESTIVE_TEMPLATES = [
    { label: '🎄 Christmas', msg: '🎄 Merry Christmas from Bigbiney Printing Press!\n\nWishing you and your family a joyful and blessed Christmas. Thank you for your support this year!\n\n— Bigbiney Printing Press 🖨️' },
    { label: '🎆 New Year', msg: '🎆 Happy New Year from Bigbiney Printing Press!\n\nWishing you a prosperous and successful {year}. We look forward to serving you!\n\n— Bigbiney Printing Press 🖨️'.replace('{year}', new Date().getFullYear()) },
    { label: '🕌 Eid Mubarak', msg: '🕌 Eid Mubarak from Bigbiney Printing Press!\n\nWishing you and your family a blessed Eid. May this celebration bring you joy and peace.\n\n— Bigbiney Printing Press 🖨️' },
    { label: '🙏 Easter', msg: '🙏 Happy Easter from Bigbiney Printing Press!\n\nWishing you a blessed and joyful Easter celebration with your loved ones.\n\n— Bigbiney Printing Press 🖨️' },
    { label: '💰 Promo', msg: '🎉 Special Offer from Bigbiney Printing Press!\n\nGet 10% OFF your next print order this week only!\n\nCall or WhatsApp us to book. Don\'t miss out! 🖨️' },
    { label: '🙏 Thank You', msg: 'Dear {name},\n\nThank you for choosing Bigbiney Printing Press! Your support means everything to us.\n\nWe look forward to serving you again soon. 🖨️\n\n— Bigbiney Printing Press' },
    { label: '📞 Follow Up', msg: 'Hi {name}, this is Bigbiney Printing Press. We wanted to check in and see how everything is going. Feel free to reach out anytime for your printing needs! 🖨️' },
    { label: '💳 Payment Reminder', msg: 'Hi {name}, this is a friendly reminder from Bigbiney Printing Press that your invoice payment is due. Please make payment at your earliest convenience. Thank you!' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📲 WhatsApp Notifications</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ background: '#25D366', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>{custsWithPhone.length} customers with phone</div>
          <div style={{ background: '#2563eb', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>{jobsWithPhone.length} jobs with WhatsApp</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {sections.map(s => <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ padding: '7px 16px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: activeSection === s.id ? '#25D366' : '#fff', color: activeSection === s.id ? '#fff' : '#6b7280', borderColor: activeSection === s.id ? '#25D366' : '#e5e7eb' }}>{s.label}</button>)}
      </div>

      {activeSection === 'broadcast' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>📣 Broadcast Message</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6b7280' }}>Send to all customers or select specific ones. Use <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>{'{name}'}</code> to personalise.</p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Message *</label>
              <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={6} placeholder="Type your message... Use {name} for customer name" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>🎉 Festive & Quick Templates</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {FESTIVE_TEMPLATES.map(t => <button key={t.label} onClick={() => setBroadcastMsg(t.msg)} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#374151', textAlign: 'left' }}>{t.label}</button>)}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Recipients ({selectedCusts.length > 0 ? selectedCusts.length : custsWithPhone.length} selected)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSelectedCusts(custsWithPhone.map(c=>c.id))} style={{ fontSize: 11, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 700 }}>All</button>
                  <button onClick={() => setSelectedCusts([])} style={{ fontSize: 11, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontWeight: 700 }}>Clear</button>
                </div>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                {custsWithPhone.map(c => (
                  <div key={c.id} onClick={() => toggleCust(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedCusts.includes(c.id) ? '#f0fdf4' : '#fff' }}>
                    <input type="checkbox" checked={selectedCusts.includes(c.id)} onChange={() => {}} style={{ accentColor: '#25D366' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{c.whatsapp || c.phone}</span>
                  </div>
                ))}
                {custsWithPhone.length === 0 && <p style={{ textAlign: 'center', padding: 16, color: '#9ca3af', fontSize: 13 }}>No customers with phone numbers</p>}
              </div>
            </div>
            {sending && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#15803d', fontWeight: 700 }}>📲 Sending… {sentCount} / {selectedCusts.length || custsWithPhone.length}</div>}
            <button onClick={sendBroadcast} disabled={sending || !broadcastMsg.trim()} style={{ width: '100%', background: sending ? '#9ca3af' : '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '12px', cursor: sending ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700 }}>
              📲 Send to {selectedCusts.length > 0 ? selectedCusts.length : custsWithPhone.length} Customer{(selectedCusts.length || custsWithPhone.length) !== 1 ? 's' : ''}
            </button>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Message Preview</h3>
            <div style={{ background: '#dcf8c6', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 120 }}>
              {broadcastMsg
                ? broadcastMsg.replace(/{name}/gi, custsWithPhone[0]?.name || 'Customer Name')
                : <span style={{ color: '#9ca3af' }}>Type a message to preview it here…</span>}
            </div>
            {broadcastMsg && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Preview shows first customer's name. Each recipient gets their own name.</p>}
            {broadcastMsg && <button onClick={() => navigator.clipboard.writeText(broadcastMsg)} style={{ marginTop: 8, width: '100%', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📋 Copy Message</button>}
          </div>
        </div>
      )}

      {activeSection === 'notifications' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Select Template & Jobs</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Message Template</label>
              <select value={notifTemplate} onChange={e => { setNotifTemplate(e.target.value); setPreviewMsg(''); }} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, width: '100%' }}>
                {JOB_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)} notification</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Select Jobs</label>
                <button onClick={() => setSelectedJobs(jobsWithPhone.map(j=>j.id))} style={{ fontSize: 11, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 700 }}>Select All</button>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                {jobsWithPhone.map(j => (
                  <div key={j.id} onClick={() => { toggleJob(j.id); handlePreview(j.id); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selectedJobs.includes(j.id) ? '#f0fdf4' : '#fff' }}>
                    <input type="checkbox" checked={selectedJobs.includes(j.id)} onChange={() => {}} style={{ accentColor: '#25D366' }} />
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{j.job_no} — {j.customer}</div><div style={{ fontSize: 11, color: '#6b7280' }}>{j.whatsapp} · {j.status}</div></div>
                    <Badge text={j.status} />
                  </div>
                ))}
                {jobsWithPhone.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>No jobs with WhatsApp numbers yet. Add WhatsApp number when creating a job.</p>}
              </div>
            </div>
            <button onClick={sendBulk} style={{ width: '100%', background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '11px', cursor: 'pointer', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
              📲 Send to {selectedJobs.length} Customer{selectedJobs.length !== 1 ? 's' : ''}
            </button>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Message Preview</h3>
            {previewMsg ? <div style={{ background: '#dcf8c6', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{previewMsg}</div> : <div style={{ background: '#f8fafc', border: '2px dashed #e5e7eb', borderRadius: 8, padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Click a job to preview the message</div>}
            {previewMsg && <button onClick={() => navigator.clipboard.writeText(previewMsg)} style={{ marginTop: 10, width: '100%', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📋 Copy</button>}
          </div>
        </div>
      )}

      {activeSection === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Send Business Summary</h3>
            <Inp label="Send to (WhatsApp number)" value={summaryPhone} onChange={e => setSummaryPhone(e.target.value)} placeholder="+233..." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              <button onClick={() => openWhatsApp(summaryPhone, generateDailySummaryMsg(sales, expenses, jobs, invoices))} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 8, padding: '14px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>📊 Send Daily Summary</button>
              <button onClick={() => openWhatsApp(summaryPhone, generateWeeklySummaryMsg(sales, expenses, jobs))} style={{ background: '#1a9e50', border: 'none', color: '#fff', borderRadius: 8, padding: '14px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>📅 Send Weekly Summary</button>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Daily Summary Preview</h3>
            <div style={{ background: '#dcf8c6', borderRadius: 10, padding: 16, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto' }}>{generateDailySummaryMsg(sales, expenses, jobs, invoices)}</div>
          </div>
        </div>
      )}

      {activeSection === 'custom' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Send to Single Number</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Inp label="Phone Number" placeholder="+233..." value={customPhone} onChange={e => setCustomPhone(e.target.value)} />
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Message</label>
                <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={8} placeholder="Type your message here..." style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => navigator.clipboard.writeText(customMsg)} style={{ flex: 1, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '9px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>📋 Copy</button>
                <button onClick={() => { if (customPhone && customMsg) openWhatsApp(customPhone, customMsg); else alert('Enter a phone number and message.'); }} style={{ flex: 2, background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '9px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>📲 Open in WhatsApp</button>
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Preview</h3>
            <div style={{ background: '#dcf8c6', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 100 }}>{customMsg || <span style={{ color: '#9ca3af' }}>Your message will appear here…</span>}</div>
          </div>
        </div>
      )}

      {activeSection === 'missing' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>⚠️ Jobs Missing WhatsApp Numbers</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>{jobsWithoutPhone.length} active job(s) don't have a WhatsApp number. Edit the job and add the customer's WhatsApp to enable notifications.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Job #','Customer','Status','Due Date','Price'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {jobsWithoutPhone.map(j => (
                <tr key={j.id}>
                  <TD style={{ fontWeight: 700, color: '#2563eb' }}>{j.job_no}</TD>
                  <TD>{j.customer}</TD>
                  <TD><Badge text={j.status} /></TD>
                  <TD style={{ color: j.due_date < todayStr() ? '#dc2626' : '#374151' }}>{j.due_date || '—'}</TD>
                  <TD style={{ fontWeight: 600 }}>{fmt(j.price)}</TD>
                </tr>
              ))}
              {jobsWithoutPhone.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#16a34a', fontWeight: 700 }}>✅ All active jobs have WhatsApp numbers!</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
