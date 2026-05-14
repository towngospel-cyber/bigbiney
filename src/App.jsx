import React, { useState, useEffect, useCallback } from 'react';
import db, { supabase } from './utils/db';

// â”€â”€â”€ STATIC DATA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MACHINES   = ['Heidelberg SM52', 'Screen Press 1', 'Screen Press 2', 'Xerox Versant', 'Large Format Printer', 'Guillotine'];
const JOB_TYPES  = ['Offset', 'Digital', 'Screen Print', 'Large Format', 'Finishing', 'Other'];
const JOB_STATUSES = ['quoting', 'queued', 'in-progress', 'on-hold', 'completed', 'cancelled'];
const DELIVERY_STATUSES = ['pending', 'ready', 'out-for-delivery', 'delivered', 'collected'];
const STAFF_LIST = ['Unassigned', 'Kwame', 'Ama', 'Kofi', 'Abena', 'Yaw', 'Akosua'];
const ADMIN_WHATSAPP = '+233246307773';

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const fmt = (n) => `GHâ‚µ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayStr = () => new Date().toISOString().split('T')[0];
const getCurrentMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; };

const STATUS_COLORS = {
  quoting:      { bg: '#f0f9ff', color: '#0369a1',  border: '#bae6fd' },
  queued:       { bg: '#fefce8', color: '#854d0e',  border: '#fde68a' },
  'in-progress':{ bg: '#eff6ff', color: '#1d4ed8',  border: '#bfdbfe' },
  'on-hold':    { bg: '#fff7ed', color: '#c2410c',  border: '#fed7aa' },
  completed:    { bg: '#f0fdf4', color: '#15803d',  border: '#bbf7d0' },
  cancelled:    { bg: '#fef2f2', color: '#b91c1c',  border: '#fecaca' },
};

const PRIORITY_COLORS = {
  normal: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  rush:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  urgent: { bg: '#7f1d1d', color: '#ffffff', border: '#7f1d1d' },
};

const DELIVERY_COLORS = {
  pending:          { bg: '#f1f5f9', color: '#475569' },
  ready:            { bg: '#fef3c7', color: '#92400e' },
  'out-for-delivery': { bg: '#dbeafe', color: '#1e40af' },
  delivered:        { bg: '#d1fae5', color: '#065f46' },
  collected:        { bg: '#f0fdf4', color: '#15803d' },
};

// â”€â”€â”€ MINI COMPONENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Badge = ({ text, type = 'status' }) => {
  const c = type === 'status' ? (STATUS_COLORS[text] || {}) : type === 'priority' ? (PRIORITY_COLORS[text] || {}) : (DELIVERY_COLORS[text] || {});
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border || c.bg}`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
};

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: wide ? 800 : 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111' }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>Ã—</button>
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
    <button onClick={onClick} disabled={disabled}
      style={{ ...v[variant], padding: small ? '5px 10px' : '9px 16px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: small ? 12 : 13, fontWeight: 600, opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap', ...s }}>
      {children}
    </button>
  );
};

const TH = ({ children }) => (
  <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #e5e7eb', textTransform: 'uppercase', whiteSpace: 'nowrap', background: '#f8fafc' }}>
    {children}
  </th>
);

const TD = ({ children, style: s }) => (
  <td style={{ padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9', ...s }}>{children}</td>
);

// â”€â”€â”€ WHATSAPP HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const openWhatsApp = (phone, message) => {
  const clean = phone.replace(/\D/g, '');
  const num = clean.startsWith('0') ? '233' + clean.slice(1) : clean;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
};

const generateJobReadyMsg = (job) =>
  `Hi ${job.customer}, your print job *${job.job_no}* is ready for pickup!\n\nðŸ“‹ ${job.description}\nðŸ’° Total: ${fmt(job.price)}\n\nPlease come collect at your earliest convenience.\n\nThank you for choosing us! ðŸ–¨ï¸`;

const generateAdminReminderMsg = (overdueJobs) => {
  const lines = overdueJobs.map(j => `â€¢ ${j.job_no} â€” ${j.customer} (Due: ${j.due_date}) â€” ${j.status}`).join('\n');
  return `âš ï¸ *OVERDUE JOBS REMINDER*\n\nThe following jobs are past their due date:\n\n${lines}\n\nPlease follow up immediately.\n\n_Sent from PrintShop Manager_`;
};

// â”€â”€â”€ MAIN APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function PrintingPressSystem() {
  const [currentUser, setCurrentUser]   = useState(null);
  const [loginData,   setLoginData]     = useState({ email: '', password: '' });
  const [loginError,  setLoginError]    = useState('');
  const [activeTab,   setActiveTab]     = useState('dashboard');
  const [showNotif,   setShowNotif]     = useState(false);
  const [loading,     setLoading]       = useState(true);

  const [customers,  setCustomers]  = useState([]);
  const [jobs,       setJobs]       = useState([]);
  const [inventory,  setInventory]  = useState([]);
  const [invoices,   setInvoices]   = useState([]);
  const [sales,      setSales]      = useState([]);
  const [expenses,   setExpenses]   = useState([]);
  const [notifs,     setNotifs]     = useState([]);

  // Local-only state (not persisted to DB)
  const [monthlyGoal, setMonthlyGoal] = useState(() => parseFloat(localStorage.getItem('printshop_goal') || '0'));
  const [loans, setLoans] = useState(() => {
    try { return JSON.parse(localStorage.getItem('printshop_loans') || '[]'); } catch { return []; }
  });

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
    const [c, j, inv, inv2, s, e] = await Promise.all([
      db.getCustomers(userId), db.getJobs(userId), db.getInventory(userId),
      db.getInvoices(userId), db.getSales(userId), db.getExpenses(userId),
    ]);
    setCustomers(c.data); setJobs(j.data); setInventory(inv.data);
    setInvoices(inv2.data); setSales(s.data); setExpenses(e.data);
    setLoading(false);
  }, []);

  useEffect(() => { if (!currentUser) return; loadAllData(currentUser.id); }, [currentUser, loadAllData]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubs = [
      db.subscribeToTable('customers', currentUser.id,
        (row) => setCustomers(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setCustomers(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setCustomers(p => p.filter(x => x.id !== row.id))),
      db.subscribeToTable('jobs', currentUser.id,
        (row) => setJobs(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setJobs(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setJobs(p => p.filter(x => x.id !== row.id))),
      db.subscribeToTable('inventory', currentUser.id,
        (row) => setInventory(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setInventory(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setInventory(p => p.filter(x => x.id !== row.id))),
      db.subscribeToTable('invoices', currentUser.id,
        (row) => setInvoices(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setInvoices(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setInvoices(p => p.filter(x => x.id !== row.id))),
      db.subscribeToTable('sales', currentUser.id,
        (row) => setSales(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setSales(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setSales(p => p.filter(x => x.id !== row.id))),
      db.subscribeToTable('expenses', currentUser.id,
        (row) => setExpenses(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setExpenses(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setExpenses(p => p.filter(x => x.id !== row.id))),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [currentUser]);

  const addNotif = (message, type = 'info') =>
    setNotifs(n => [{ id: Date.now(), type, message, read: false }, ...n.slice(0, 19)]);

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
  };

  const saveLoans = (newLoans) => {
    setLoans(newLoans);
    localStorage.setItem('printshop_loans', JSON.stringify(newLoans));
  };

  const saveGoal = (val) => {
    setMonthlyGoal(val);
    localStorage.setItem('printshop_goal', String(val));
  };

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%)', fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
        <div style={{ background: '#fff', padding: 40, borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>ðŸ–¨ï¸</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>Print Shop Manager</h1>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Powered by Supabase â€” syncs across all devices</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Inp label="Email" type="email" placeholder="admin@printshop.com" value={loginData.email}
              onChange={e => setLoginData({ ...loginData, email: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <Inp label="Password" type="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" value={loginData.password}
              onChange={e => setLoginData({ ...loginData, password: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            {loginError && <p style={{ color: '#dc2626', fontSize: 12, margin: 0, padding: '6px 10px', background: '#fef2f2', borderRadius: 4, border: '1px solid #fecaca' }}>{loginError}</p>}
            <Btn onClick={handleLogin}>Sign In â†’</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#6b7280' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>ðŸ–¨ï¸</div>
          <p>Loading your dataâ€¦</p>
        </div>
      </div>
    );
  }

  const unread   = notifs.filter(n => !n.read).length;
  const lowStock = inventory.filter(i => i.quantity <= i.reorderPoint);
  const overdueJobs = jobs.filter(j => !['completed','cancelled'].includes(j.status) && j.due_date && j.due_date < todayStr());

  const TABS = [
    { id: 'dashboard', label: 'ðŸ“Š Dashboard' },
    { id: 'jobs',      label: 'ðŸ—‚ï¸ Jobs' },
    { id: 'customers', label: 'ðŸ‘¥ Customers' },
    { id: 'quotes',    label: 'ðŸ’¬ Quotes' },
    { id: 'schedule',  label: 'ðŸ“… Schedule' },
    { id: 'inventory', label: 'ðŸ“¦ Inventory' },
    { id: 'invoices',  label: 'ðŸ§¾ Invoices' },
    { id: 'finance',   label: 'ðŸ’° Finance' },
    { id: 'loans',     label: 'ðŸ¦ Loans' },
    { id: 'reports',   label: 'ðŸ“ˆ Reports' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#111' }}>
      <header style={{ background: '#0f172a', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>ðŸ–¨ï¸</span>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>PrintShop Manager</span>
          {lowStock.length > 0 && <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{lowStock.length} LOW STOCK</span>}
          {overdueJobs.length > 0 && <span style={{ background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{overdueJobs.length} OVERDUE</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {overdueJobs.length > 0 && (
            <button onClick={() => openWhatsApp(ADMIN_WHATSAPP, generateAdminReminderMsg(overdueJobs))}
              style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              ðŸ“² Alert Admin
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotif(v => !v)}
              style={{ background: showNotif ? '#1e3a5f' : 'transparent', border: '1px solid #334155', color: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 16, position: 'relative' }}>
              ðŸ””
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
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{n.type === 'warning' ? 'âš ï¸' : n.type === 'success' ? 'âœ…' : 'â„¹ï¸'}</span>
                    <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{n.message}</span>
                    <button onClick={() => setNotifs(prev => prev.filter(x => x.id !== n.id))} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>Ã—</button>
                  </div>
                ))}
                {notifs.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 20 }}>All clear!</p>}
              </div>
            )}
          </div>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>ðŸ‘¤ {currentUser.email}</span>
          <button onClick={handleLogout} style={{ background: '#1e3a5f', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>Logout</button>
        </div>
      </header>

      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', display: 'flex', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '13px 14px', background: 'transparent', border: 'none', borderBottom: activeTab === t.id ? '3px solid #2563eb' : '3px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? '#2563eb' : '#6b7280', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </nav>

      <main style={{ padding: '28px 24px', maxWidth: 1400, margin: '0 auto' }}>
        {activeTab === 'dashboard' && <DashboardTab jobs={jobs} sales={sales} expenses={expenses} customers={customers} inventory={inventory} invoices={invoices} setActiveTab={setActiveTab} overdueJobs={overdueJobs} monthlyGoal={monthlyGoal} setMonthlyGoal={saveGoal} />}
        {activeTab === 'jobs'      && <JobsTab jobs={jobs} setJobs={setJobs} customers={customers} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'customers' && <CustomersTab customers={customers} setCustomers={setCustomers} jobs={jobs} invoices={invoices} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'quotes'    && <QuotesTab customers={customers} jobs={jobs} setJobs={setJobs} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'schedule'  && <ScheduleTab jobs={jobs} setJobs={setJobs} userId={currentUser.id} />}
        {activeTab === 'inventory' && <InventoryTab inventory={inventory} setInventory={setInventory} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'invoices'  && <InvoicesTab invoices={invoices} setInvoices={setInvoices} jobs={jobs} customers={customers} setSales={setSales} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'finance'   && <FinanceTab sales={sales} setSales={setSales} expenses={expenses} setExpenses={setExpenses} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'loans'     && <LoansTab loans={loans} saveLoans={saveLoans} addNotif={addNotif} />}
        {activeTab === 'reports'   && <ReportsTab jobs={jobs} sales={sales} expenses={expenses} customers={customers} inventory={inventory} invoices={invoices} />}
      </main>
    </div>
  );
}

// â”€â”€â”€ DASHBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DashboardTab({ jobs, sales, expenses, customers, inventory, invoices, setActiveTab, overdueJobs, monthlyGoal, setMonthlyGoal }) {
  const [editGoal, setEditGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const month = getCurrentMonth();
  const monthlySales = sales.filter(s => s.date?.startsWith(month)).reduce((a, s) => a + s.amount, 0);
  const monthlyExp   = expenses.filter(e => e.date?.startsWith(month)).reduce((a, e) => a + e.amount, 0);
  const activeJobs   = jobs.filter(j => j.status === 'in-progress').length;
  const lowStock     = inventory.filter(i => i.quantity <= i.reorder_point);
  const unpaidTotal  = invoices.filter(i => i.status !== 'paid').reduce((a, i) => a + (i.amount - i.paid), 0);
  const goalPct      = monthlyGoal > 0 ? Math.min(100, Math.round((monthlySales / monthlyGoal) * 100)) : 0;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split('T')[0];
    return { day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()], amt: sales.filter(s => s.date === ds).reduce((a, s) => a + s.amount, 0) };
  });
  const maxBar = Math.max(...last7.map(d => d.amt), 1);

  return (
    <div>
      {/* Overdue Alert Banner */}
      {overdueJobs.length > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ fontSize: 20 }}>âš ï¸</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#856404', marginBottom: 6 }}>
              {overdueJobs.length} Overdue Job{overdueJobs.length > 1 ? 's' : ''} â€” Action Required
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {overdueJobs.map(j => (
                <span key={j.id} style={{ background: '#fff', border: '1px solid #ffc107', borderRadius: 4, padding: '3px 8px', fontSize: 12 }}>
                  <strong>{j.job_no}</strong> â€” {j.customer} (due {j.due_date})
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => openWhatsApp(ADMIN_WHATSAPP, generateAdminReminderMsg(overdueJobs))}
            style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
            ðŸ“² Send WhatsApp Alert
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Monthly Income"   value={fmt(monthlySales)} accent="#16a34a" />
        <StatCard label="Monthly Expenses" value={fmt(monthlyExp)}   accent="#dc2626" />
        <StatCard label="Monthly Profit"   value={fmt(monthlySales - monthlyExp)} accent={monthlySales >= monthlyExp ? '#2563eb' : '#dc2626'} />
        <StatCard label="Active Jobs"      value={activeJobs} sub={overdueJobs.length > 0 ? `âš ï¸ ${overdueJobs.length} overdue` : 'On track'} accent="#f59e0b" />
        <StatCard label="Outstanding"      value={fmt(unpaidTotal)} sub={`${invoices.filter(i=>i.status!=='paid').length} invoice(s)`} accent="#7c3aed" />
        <StatCard label="Low Stock Items"  value={lowStock.length} sub={lowStock.length > 0 ? 'Needs reorder' : 'All good'} accent={lowStock.length > 0 ? '#dc2626' : '#16a34a'} />
      </div>

      {/* Monthly Goal Tracker */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>ðŸŽ¯ Monthly Revenue Goal</h3>
          <button onClick={() => { setGoalInput(String(monthlyGoal)); setEditGoal(true); }}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
            {monthlyGoal > 0 ? 'Edit Goal' : 'Set Goal'}
          </button>
        </div>
        {editGoal && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <Inp placeholder="Monthly target (GHâ‚µ)" type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} />
            <Btn small onClick={() => { setMonthlyGoal(parseFloat(goalInput)||0); setEditGoal(false); }}>Save</Btn>
            <Btn small variant="ghost" onClick={() => setEditGoal(false)}>Cancel</Btn>
          </div>
        )}
        {monthlyGoal > 0 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: goalPct >= 100 ? '#16a34a' : '#374151' }}>{fmt(monthlySales)} earned</span>
              <span style={{ color: '#6b7280' }}>Goal: {fmt(monthlyGoal)} â€” <strong style={{ color: goalPct >= 100 ? '#16a34a' : '#2563eb' }}>{goalPct}%</strong></span>
            </div>
            <div style={{ background: '#f1f5f9', borderRadius: 6, height: 14, overflow: 'hidden' }}>
              <div style={{ width: `${goalPct}%`, height: 14, borderRadius: 6, background: goalPct >= 100 ? '#16a34a' : goalPct >= 75 ? '#2563eb' : goalPct >= 50 ? '#f59e0b' : '#dc2626', transition: 'width 0.4s ease' }} />
            </div>
            {goalPct >= 100 && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#16a34a', fontWeight: 700 }}>ðŸŽ‰ Goal achieved! Keep going!</p>}
          </>
        ) : (
          <p style={{ margin: 0, color: '#9ca3af', fontSize: 13 }}>Set a monthly revenue target to track your progress.</p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Revenue â€” Last 7 Days</h3>
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
          <Btn variant="ghost" small onClick={() => setActiveTab('jobs')}>View All â†’</Btn>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Job #','Customer','Description','Type','Due','Price','Status'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {[...jobs].sort((a,b) => (b.job_no||'').localeCompare(a.job_no||'')).slice(0,5).map(j => (
                <tr key={j.id}>
                  <TD style={{ fontWeight: 700, color: '#2563eb' }}>{j.job_no}</TD>
                  <TD>{j.customer}</TD>
                  <TD>{j.description}</TD>
                  <TD>{j.type}</TD>
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
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#dc2626' }}>âš ï¸ Low Stock Alerts</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lowStock.map(i => (
              <div key={i.id} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 12px', fontSize: 12 }}>
                <strong>{i.name}</strong> â€” {i.quantity} {i.unit} left (reorder at {i.reorder_point})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ JOBS TAB (enhanced) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EMPTY_JOB = { customer: '', customer_id: '', description: '', type: 'Digital', status: 'queued', priority: 'normal', due_date: '', start_date: '', price: '', cost: '', machine: '', notes: '', delivery_status: 'pending', assigned_to: '', payment_method: 'Cash', whatsapp: '' };

function JobsTab({ jobs, setJobs, customers, addNotif, userId }) {
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState(EMPTY_JOB);
  const [editId,  setEditId]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [msgModal, setMsgModal] = useState(null); // job for WhatsApp msg

  const filtered = jobs.filter(j => {
    const ms = filter === 'all' || j.status === filter;
    const mq = !search || [j.job_no, j.customer, j.description].some(v => (v||'').toLowerCase().includes(search.toLowerCase()));
    return ms && mq;
  }).sort((a, b) => (b.job_no||'').localeCompare(a.job_no||''));

  const nextNo = () => {
    const nums = jobs.map(j => parseInt((j.job_no||'PSM-000').split('-')[1] || 0));
    return `PSM-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
  };

  const openNew  = () => { setForm({ ...EMPTY_JOB, start_date: todayStr() }); setEditId(null); setModal(true); };
  const openEdit = (j) => { setForm({ ...j, price: String(j.price), cost: String(j.cost) }); setEditId(j.id); setModal(true); };
  const closeModal = () => { setModal(false); setForm(EMPTY_JOB); setEditId(null); };

  const save = async () => {
    if (!form.customer || !form.description) return;
    setSaving(true);
    const payload = { ...form, price: parseFloat(form.price)||0, cost: parseFloat(form.cost)||0 };
    if (editId) {
      const { data, error } = await db.updateJob(editId, payload);
      if (!error) { setJobs(jobs.map(j => j.id === editId ? data : j)); addNotif(`Job updated`, 'success'); }
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
    const { data, error } = await db.updateJob(id, { [field]: value });
    if (!error) setJobs(jobs.map(j => j.id === id ? data : j));
  };

  const duplicate = async (j) => {
    const no = nextNo();
    const { data, error } = await db.addJob(userId, {
      ...j, id: undefined, job_no: no, qr_code: no,
      status: 'queued', start_date: todayStr(), delivery_status: 'pending'
    });
    if (!error) { setJobs([...jobs, data]); addNotif(`Duplicated as ${no}`, 'success'); }
  };

  const printTicket = (j) => {
    const w = window.open('', '', 'width=600,height=500');
    w.document.write(`<html><body style="font-family:Arial;padding:30px;max-width:500px">
      <h2>ðŸ–¨ï¸ JOB TICKET â€” ${j.job_no}</h2>
      <p><b>Customer:</b> ${j.customer}</p>
      <p><b>Description:</b> ${j.description}</p>
      <p><b>Type:</b> ${j.type} &nbsp; <b>Machine:</b> ${j.machine||'TBD'}</p>
      <p><b>Assigned To:</b> ${j.assigned_to||'Unassigned'}</p>
      <p><b>Priority:</b> ${(j.priority||'').toUpperCase()} &nbsp; <b>Status:</b> ${j.status}</p>
      <p><b>Delivery Status:</b> ${j.delivery_status||'pending'}</p>
      <p><b>Start:</b> ${j.start_date||'TBD'} &nbsp; <b>Due:</b> ${j.due_date||'TBD'}</p>
      <p><b>Price:</b> GHâ‚µ${j.price} &nbsp; <b>Est. Cost:</b> GHâ‚µ${j.cost}</p>
      ${j.notes ? `<p><b>Notes:</b> ${j.notes}</p>` : ''}
      <div style="margin-top:20px;padding:10px;border:2px solid #000;display:inline-block;font-size:20px;font-weight:bold;letter-spacing:4px">${j.qr_code}</div>
      <p style="font-size:10px;color:#999">Printed ${new Date().toLocaleString()}</p>
    </body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Job Management</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ðŸ” Searchâ€¦" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13 }} />
          <Btn onClick={openNew}>+ New Job</Btn>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', ...JOB_STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: filter === s ? '#2563eb' : '#fff', color: filter === s ? '#fff' : '#6b7280', borderColor: filter === s ? '#2563eb' : '#e5e7eb' }}>
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
                  <TD style={{ color: '#6b7280', fontSize: 12 }}>{j.assigned_to || 'â€”'}</TD>
                  <TD style={{ color: j.due_date < todayStr() && !['completed','cancelled'].includes(j.status) ? '#dc2626' : '#374151' }}>{j.due_date || 'â€”'}</TD>
                  <TD style={{ fontWeight: 600 }}>{fmt(j.price)}</TD>
                  <TD>
                    <span style={{ fontWeight: 700, color: profit >= 0 ? '#16a34a' : '#dc2626', fontSize: 12 }}>
                      {fmt(profit)}<br/>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>{margin}% margin</span>
                    </span>
                  </TD>
                  <TD>
                    <select value={j.delivery_status || 'pending'} onChange={e => updateField(j.id, 'delivery_status', e.target.value)}
                      style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 6px', fontSize: 11, background: DELIVERY_COLORS[j.delivery_status||'pending']?.bg, color: DELIVERY_COLORS[j.delivery_status||'pending']?.color, cursor: 'pointer', fontWeight: 700 }}>
                      {DELIVERY_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </TD>
                  <TD>
                    <select value={j.status} onChange={e => updateField(j.id, 'status', e.target.value)}
                      style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 6px', fontSize: 11, background: STATUS_COLORS[j.status]?.bg, color: STATUS_COLORS[j.status]?.color, cursor: 'pointer', fontWeight: 700 }}>
                      {JOB_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      <Btn variant="ghost" small onClick={() => openEdit(j)}>Edit</Btn>
                      <Btn variant="ghost" small onClick={() => printTicket(j)}>ðŸ–¨ï¸</Btn>
                      <Btn variant="teal" small onClick={() => setMsgModal(j)}>ðŸ“²</Btn>
                      <Btn variant="warning" small onClick={() => duplicate(j)}>Copy</Btn>
                      <Btn variant="danger" small onClick={() => del(j.id)}>Del</Btn>
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
        <Modal title={editId ? `Edit Job` : 'New Job Ticket'} onClose={closeModal} wide>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label="Customer *" value={form.customer} onChange={e => { const c = customers.find(x => x.name === e.target.value); setForm({ ...form, customer: e.target.value, customer_id: c?.id||'' }); }}>
              <option value="">â€” Select Customer â€”</option>
              {customers.map(c => <option key={c.id}>{c.name}</option>)}
            </Sel>
            <Sel label="Job Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
            </Sel>
            <div style={{ gridColumn: '1/-1' }}>
              <Inp label="Description *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <Sel label="Machine" value={form.machine} onChange={e => setForm({ ...form, machine: e.target.value })}>
              <option value="">â€” Unassigned â€”</option>
              {MACHINES.map(m => <option key={m}>{m}</option>)}
            </Sel>
            <Sel label="Assigned To" value={form.assigned_to||''} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
              {STAFF_LIST.map(s => <option key={s}>{s}</option>)}
            </Sel>
            <Sel label="Priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="normal">Normal</option>
              <option value="rush">Rush (+25%)</option>
              <option value="urgent">Urgent</option>
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
            <Inp label="Customer WhatsApp" placeholder="+233..." value={form.whatsapp||''} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
            <Inp label="Start Date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <Inp label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <Inp label="Price (GHâ‚µ)" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            <Inp label="Est. Cost (GHâ‚µ)" type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
            {form.price && form.cost && (
              <div style={{ gridColumn: '1/-1', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                  Estimated Profit: {fmt((parseFloat(form.price)||0) - (parseFloat(form.cost)||0))}
                  &nbsp;({form.price > 0 ? Math.round((((parseFloat(form.price)||0) - (parseFloat(form.cost)||0)) / (parseFloat(form.price)||1)) * 100) : 0}% margin)
                </span>
              </div>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={closeModal}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Savingâ€¦' : editId ? 'Save Changes' : 'Create Job'}</Btn>
          </div>
        </Modal>
      )}

      {msgModal && (
        <WhatsAppMsgModal job={msgModal} onClose={() => setMsgModal(null)} />
      )}
    </div>
  );
}

// â”€â”€â”€ WHATSAPP MESSAGE MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function WhatsAppMsgModal({ job, onClose }) {
  const [phone, setPhone] = useState(job.whatsapp || '');
  const [msg, setMsg] = useState(generateJobReadyMsg(job));

  return (
    <Modal title="ðŸ“² WhatsApp Message" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Inp label="Customer WhatsApp Number" placeholder="+233..." value={phone} onChange={e => setPhone(e.target.value)} />
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Message</label>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={8}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => { navigator.clipboard.writeText(msg); }}
            style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            ðŸ“‹ Copy Text
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <button onClick={() => { if (phone) openWhatsApp(phone, msg); else alert('Enter a phone number first.'); }}
              style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Open in WhatsApp
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// â”€â”€â”€ CUSTOMERS (enhanced with outstanding balance + WhatsApp) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EMPTY_CX = { name: '', email: '', phone: '', address: '', whatsapp: '' };

function CustomersTab({ customers, setCustomers, jobs, invoices, addNotif, userId }) {
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState(EMPTY_CX);
  const [editId,   setEditId]   = useState(null);
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [saving,   setSaving]   = useState(false);

  const filtered = customers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.email||'').toLowerCase().includes(search.toLowerCase()));

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    if (editId) {
      const { data, error } = await db.updateCustomer(editId, form);
      if (!error) setCustomers(customers.map(c => c.id === editId ? data : c));
    } else {
      const { data, error } = await db.addCustomer(userId, form);
      if (!error) { setCustomers([...customers, data]); addNotif(`${form.name} added`, 'success'); }
    }
    setSaving(false); setModal(false); setForm(EMPTY_CX); setEditId(null);
  };

  const del = async (id) => {
    const { error } = await db.deleteCustomer(id);
    if (!error) setCustomers(customers.filter(x => x.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Customer CRM</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ðŸ” Searchâ€¦" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13 }} />
          <Btn onClick={() => { setForm(EMPTY_CX); setEditId(null); setModal(true); }}>+ Add Customer</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Name','Email','Phone','WhatsApp','Jobs','Revenue','Outstanding','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {filtered.map(c => {
                const cJobs = jobs.filter(j => j.customer_id === c.id);
                const cRev  = invoices.filter(i => i.customer_id === c.id).reduce((a, i) => a + (i.paid||0), 0);
                const cOutstanding = invoices.filter(i => i.customer_id === c.id && i.status !== 'paid').reduce((a, i) => a + (i.amount - i.paid), 0);
                return (
                  <tr key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selected?.id === c.id ? '#eff6ff' : 'transparent' }}>
                    <TD style={{ fontWeight: 600 }}>{c.name}</TD>
                    <TD style={{ color: '#6b7280' }}>{c.email}</TD>
                    <TD>{c.phone}</TD>
                    <TD>
                      {(c.whatsapp || c.phone) ? (
                        <button onClick={e => { e.stopPropagation(); openWhatsApp(c.whatsapp || c.phone, `Hi ${c.name}!`); }}
                          style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                          ðŸ’¬ Chat
                        </button>
                      ) : 'â€”'}
                    </TD>
                    <TD>{cJobs.length}</TD>
                    <TD style={{ fontWeight: 600, color: '#16a34a' }}>{fmt(cRev)}</TD>
                    <TD style={{ fontWeight: 700, color: cOutstanding > 0 ? '#dc2626' : '#16a34a' }}>
                      {cOutstanding > 0 ? fmt(cOutstanding) : 'âœ“ Paid'}
                    </TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <Btn variant="ghost" small onClick={() => { setForm({ name: c.name, email: c.email, phone: c.phone, address: c.address, whatsapp: c.whatsapp||'' }); setEditId(c.id); setModal(true); }}>Edit</Btn>
                        <Btn variant="danger" small onClick={() => del(c.id)}>Del</Btn>
                      </div>
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selected && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{selected.name}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20 }}>Ã—</button>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 3px' }}>ðŸ“§ {selected.email}</p>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 3px' }}>ðŸ“ž {selected.phone}</p>
            {selected.whatsapp && (
              <button onClick={() => openWhatsApp(selected.whatsapp, `Hi ${selected.name}!`)}
                style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block' }}>
                ðŸ’¬ Open WhatsApp
              </button>
            )}
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>ðŸ“ {selected.address}</p>
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
            <Btn onClick={save} disabled={saving}>{saving ? 'Savingâ€¦' : editId ? 'Save Changes' : 'Add Customer'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// â”€â”€â”€ QUOTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function QuotesTab({ customers, jobs, setJobs, addNotif, userId }) {
  const [form, setForm] = useState({ customer: '', customer_id: '', description: '', type: 'Digital', qty: '', unitPrice: '', rushFee: false, bulkDiscount: false, notes: '' });
  const [quotes, setQuotes] = useState([]);

  const qty  = parseFloat(form.qty) || 0;
  const unit = parseFloat(form.unitPrice) || 0;
  const sub  = qty * unit;
  const rush = form.rushFee ? sub * 0.25 : 0;
  const bulk = form.bulkDiscount && qty >= 100 ? sub * 0.10 : 0;
  const total = sub + rush - bulk;

  const save = () => {
    if (!form.customer || !form.description || !qty || !unit) return alert('Fill all required fields.');
    setQuotes([{ ...form, id: `q${Date.now()}`, sub, rush, bulk, total, date: todayStr(), status: 'draft' }, ...quotes]);
    addNotif(`Quote saved for ${form.customer}`, 'success');
  };

  const convert = async (q) => {
    const nums = jobs.map(j => parseInt((j.job_no||'PSM-000').split('-')[1] || 0));
    const no   = `PSM-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
    const { data, error } = await db.addJob(userId, {
      job_no: no, customer: q.customer, customer_id: q.customer_id, description: q.description, type: q.type,
      status: 'queued', priority: q.rushFee ? 'rush' : 'normal', due_date: '', start_date: todayStr(),
      price: q.total, cost: 0, machine: '', notes: q.notes, qr_code: no, delivery_status: 'pending', assigned_to: ''
    });
    if (!error) {
      setJobs([...jobs, data]);
      setQuotes(quotes.map(x => x.id === q.id ? { ...x, status: 'converted' } : x));
      addNotif(`Quote converted to job ${no}`, 'success');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 800 }}>âš¡ Quick Quote Builder</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Sel label="Customer *" value={form.customer} onChange={e => { const c = customers.find(x => x.name === e.target.value); setForm({ ...form, customer: e.target.value, customer_id: c?.id||'' }); }}>
            <option value="">â€” Select Customer â€”</option>
            {customers.map(c => <option key={c.id}>{c.name}</option>)}
          </Sel>
          <Inp label="Description *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Sel label="Job Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
          </Sel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Inp label="Quantity *" type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
            <Inp label="Unit Price (GHâ‚µ) *" type="number" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.rushFee} onChange={e => setForm({ ...form, rushFee: e.target.checked })} /> Rush +25%
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.bulkDiscount} onChange={e => setForm({ ...form, bulkDiscount: e.target.checked })} /> Bulk âˆ’10% (qtyâ‰¥100)
            </label>
          </div>
          <Inp label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginTop: 16 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>Price Breakdown</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Subtotal</span><span>{fmt(sub)}</span></div>
            {rush > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#f59e0b' }}><span>Rush Fee</span><span>+{fmt(rush)}</span></div>}
            {bulk > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a' }}><span>Bulk Discount</span><span>âˆ’{fmt(bulk)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
              <span>Total</span><span style={{ color: '#2563eb' }}>{fmt(total)}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}><Btn onClick={save}>ðŸ’¾ Save Quote</Btn></div>
      </div>

      <div>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Saved Quotes ({quotes.length})</h3>
        {quotes.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No quotes yet!</p>}
        {quotes.map(q => (
          <div key={q.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{q.customer}</span>
              <Badge text={q.status === 'converted' ? 'completed' : 'quoting'} />
            </div>
            <p style={{ margin: '0 0 2px', fontSize: 12, color: '#6b7280' }}>{q.description} â€” qty {q.qty}</p>
            <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#2563eb' }}>{fmt(q.total)}</p>
            {q.status !== 'converted' && <Btn variant="success" small onClick={() => convert(q)}>â†’ Convert to Job</Btn>}
          </div>
        ))}
      </div>
    </div>
  );
}

// â”€â”€â”€ SCHEDULE (with Calendar view) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ScheduleTab({ jobs, setJobs, userId }) {
  const [view, setView] = useState('kanban');
  const active = jobs.filter(j => !['cancelled','completed'].includes(j.status));
  const byMachine = {};
  MACHINES.forEach(m => { byMachine[m] = active.filter(j => j.machine === m); });
  byMachine['Unassigned'] = active.filter(j => !j.machine);

  const updateField = async (id, field, value) => {
    const { data, error } = await db.updateJob(id, { [field]: value });
    if (!error) setJobs(jobs.map(j => j.id === id ? data : j));
  };

  // Calendar helpers
  const now = new Date();
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const monthStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}`;

  const jobsThisMonth = jobs.filter(j => j.due_date?.startsWith(monthStr));
  const getJobsForDay = (d) => {
    const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return jobs.filter(j => j.due_date === ds);
  };

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Production Schedule</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {['kanban','calendar','machines'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize', background: view === v ? '#2563eb' : '#fff', color: view === v ? '#fff' : '#6b7280', borderColor: view === v ? '#2563eb' : '#e5e7eb' }}>
              {v === 'kanban' ? 'ðŸ“‹ Kanban' : v === 'calendar' ? 'ðŸ“… Calendar' : 'âš™ï¸ Machines'}
            </button>
          ))}
        </div>
      </div>

      {view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {['queued','in-progress','on-hold'].map(col => {
            const colJobs = jobs.filter(j => j.status === col);
            const sc = STATUS_COLORS[col];
            return (
              <div key={col} style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 8, padding: 16, minHeight: 200 }}>
                <h4 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: sc.color }}>{col} ({colJobs.length})</h4>
                {colJobs.map(j => (
                  <div key={j.id} style={{ background: '#fff', border: `1px solid ${sc.border}`, borderRadius: 6, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{j.job_no}</span>
                      <Badge text={j.priority} type="priority" />
                    </div>
                    <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600 }}>{j.customer}</p>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: '#6b7280' }}>{(j.description||'').substring(0,40)}</p>
                    {j.assigned_to && <p style={{ margin: '0 0 6px', fontSize: 11, color: '#7c3aed' }}>ðŸ‘¤ {j.assigned_to}</p>}
                    <select value={j.status} onChange={e => updateField(j.id, 'status', e.target.value)}
                      style={{ fontSize: 10, border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 4px', cursor: 'pointer' }}>
                      {JOB_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
                {colJobs.length === 0 && <p style={{ fontSize: 12, color: sc.color, opacity: 0.6, textAlign: 'center', marginTop: 20 }}>Empty</p>}
              </div>
            );
          })}
        </div>
      )}

      {view === 'calendar' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#0f172a', color: '#fff' }}>
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y=>y-1); } else setCalMonth(m=>m-1); }}
              style={{ background: 'none', border: '1px solid #334155', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>â†</button>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{MONTH_NAMES[calMonth]} {calYear}</h3>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y=>y+1); } else setCalMonth(m=>m+1); }}
              style={{ background: 'none', border: '1px solid #334155', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>â†’</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>{d}</div>
            ))}
            {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} style={{ minHeight: 80, borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const dayJobs = getJobsForDay(d);
              const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const isToday = ds === todayStr();
              return (
                <div key={d} style={{ minHeight: 80, padding: 6, borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', background: isToday ? '#eff6ff' : '#fff' }}>
                  <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? '#2563eb' : '#374151', marginBottom: 4 }}>{d}</div>
                  {dayJobs.slice(0,3).map(j => (
                    <div key={j.id} title={`${j.job_no} â€” ${j.customer}: ${j.description}`}
                      style={{ fontSize: 10, fontWeight: 700, background: STATUS_COLORS[j.status]?.bg, color: STATUS_COLORS[j.status]?.color, borderRadius: 3, padding: '1px 4px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {j.job_no} {j.customer}
                    </div>
                  ))}
                  {dayJobs.length > 3 && <div style={{ fontSize: 9, color: '#6b7280' }}>+{dayJobs.length-3} more</div>}
                </div>
              );
            })}
          </div>
          <div style={{ padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280' }}>
            {jobsThisMonth.length} job(s) due this month
          </div>
        </div>
      )}

      {view === 'machines' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
          {Object.entries(byMachine).map(([machine, mJobs]) => (
            <div key={machine} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{machine}</h4>
                <span style={{ fontSize: 11, fontWeight: 700, color: mJobs.length >= 3 ? '#dc2626' : mJobs.length >= 1 ? '#f59e0b' : '#16a34a' }}>
                  {mJobs.length === 0 ? 'IDLE' : `${mJobs.length} job(s)`}
                </span>
              </div>
              {mJobs.map(j => (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#f8fafc', borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>{j.job_no}</span>
                  <span style={{ flex: 1, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.description}</span>
                  <Badge text={j.status} />
                </div>
              ))}
              {mJobs.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>No active jobs</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ INVENTORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EMPTY_INV = { name: '', category: 'Paper', unit: 'Ream', quantity: '', reorder_point: '', unit_cost: '', supplier: '' };

function InventoryTab({ inventory, setInventory, addNotif, userId }) {
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState(EMPTY_INV);
  const [editId,  setEditId]  = useState(null);
  const [cat,     setCat]     = useState('All');
  const [saving,  setSaving]  = useState(false);

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
      if (q <= item.reorder_point) addNotif(`âš ï¸ Low stock: ${item.name} (${q} ${item.unit})`, 'warning');
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
        <StatCard label="Total Items"   value={inventory.length} accent="#2563eb" />
        <StatCard label="Stock Value"   value={fmt(totalValue)}  accent="#16a34a" />
        <StatCard label="Low Stock"     value={lowCount}         accent={lowCount > 0 ? '#dc2626' : '#16a34a'} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: cat === c ? '#2563eb' : '#fff', color: cat === c ? '#fff' : '#6b7280', borderColor: cat === c ? '#2563eb' : '#e5e7eb' }}>
            {c}
          </button>
        ))}
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
                  <TD style={{ fontWeight: 600 }}>{fmt(item.quantity * (item.unit_cost||0))}</TD>
                  <TD style={{ color: '#6b7280' }}>{item.supplier}</TD>
                  <TD>
                    {low
                      ? <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>âš ï¸ LOW</span>
                      : <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>OK</span>}
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <button onClick={() => adjust(item.id, -1)} style={{ background: '#fee2e2', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontWeight: 800, color: '#dc2626' }}>âˆ’</button>
                      <button onClick={() => adjust(item.id,  1)} style={{ background: '#dcfce7', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontWeight: 800, color: '#16a34a' }}>+</button>
                      <Btn variant="ghost" small onClick={() => { setForm({ ...item, quantity: String(item.quantity), reorder_point: String(item.reorder_point), unit_cost: String(item.unit_cost) }); setEditId(item.id); setModal(true); }}>Edit</Btn>
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
            <Inp label="Unit Cost (GHâ‚µ)" type="number" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} />
            <Inp label="Supplier" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => { setModal(false); setForm(EMPTY_INV); setEditId(null); }}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Savingâ€¦' : editId ? 'Save Changes' : 'Add Item'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// â”€â”€â”€ INVOICES (enhanced with print button) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function InvoicesTab({ invoices, setInvoices, jobs, customers, setSales, addNotif, userId }) {
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState({ job_id: '', customer: '', customer_id: '', due_date: '', items: [{ desc: '', qty: 1, rate: '', total: 0 }] });

  const calcTotal = (items) => items.reduce((a, i) => a + ((parseFloat(i.qty)||0) * (parseFloat(i.rate)||0)), 0);

  const updateItem = (idx, field, val) => {
    const items = form.items.map((it, i) => {
      if (i !== idx) return it;
      const u = { ...it, [field]: val };
      u.total = (parseFloat(u.qty)||0) * (parseFloat(u.rate)||0);
      return u;
    });
    setForm({ ...form, items });
  };

  const create = async () => {
    const total = calcTotal(form.items);
    if (!form.customer || total === 0) return alert('Select a customer and add line items.');
    const inv = { ...form, invoice_no: `INV-${String(invoices.length + 1).padStart(3,'0')}`, date: todayStr(), amount: total, paid: 0, status: 'unpaid' };
    const { data, error } = await db.addInvoice(userId, inv);
    if (!error) {
      setInvoices([...invoices, data]);
      addNotif(`Invoice ${inv.invoice_no} created`, 'success');
      setModal(false);
      setForm({ job_id: '', customer: '', customer_id: '', due_date: '', items: [{ desc: '', qty: 1, rate: '', total: 0 }] });
    }
  };

  const markPaid = async (id) => {
    const inv = invoices.find(i => i.id === id);
    const { data, error } = await db.updateInvoice(id, { paid: inv.amount, status: 'paid' });
    if (!error) {
      setInvoices(invoices.map(i => i.id === id ? data : i));
      const { data: saleData } = await db.addSale(userId, { date: todayStr(), amount: inv.amount, job_id: inv.job_id });
      if (saleData) setSales(s => [...s, saleData]);
      addNotif(`Invoice ${inv.invoice_no} paid â€” ${fmt(inv.amount)} recorded`, 'success');
    }
  };

  const recordPartial = async (id) => {
    const raw = prompt('Enter amount received (GHâ‚µ):');
    const amt = parseFloat(raw);
    if (!amt || isNaN(amt)) return;
    const inv = invoices.find(i => i.id === id);
    const newPaid = Math.min(inv.paid + amt, inv.amount);
    const { data, error } = await db.updateInvoice(id, { paid: newPaid, status: newPaid >= inv.amount ? 'paid' : 'partial' });
    if (!error) {
      setInvoices(invoices.map(i => i.id === id ? data : i));
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
    const w = window.open('', '', 'width=700,height=600');
    const linkedJob = jobs.find(j => j.id === inv.job_id);
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.invoice_no}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;max-width:600px;margin:auto;color:#111}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
    .logo{font-size:28px;font-weight:900}h2{color:#2563eb;margin:0 0 4px}.meta{text-align:right;font-size:13px;color:#555}
    table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#0f172a;color:#fff;padding:8px 12px;text-align:left;font-size:12px}
    td{padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px}.total-row{background:#f8fafc}
    .total-row td{font-weight:800;font-size:15px}.status-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase}
    .paid{background:#dcfce7;color:#15803d}.unpaid{background:#fee2e2;color:#dc2626}.partial{background:#fef3c7;color:#92400e}
    .footer{margin-top:32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
    @media print{body{padding:20px}}</style></head><body>
    <div class="header">
      <div><div class="logo">ðŸ–¨ï¸ PrintShop</div><p style="font-size:12px;color:#555;margin:4px 0">Professional Printing Services</p></div>
      <div class="meta">
        <h2>${inv.invoice_no}</h2>
        <p>Date: <strong>${inv.date}</strong></p>
        <p>Due: <strong>${inv.due_date||'On receipt'}</strong></p>
        <span class="status-badge ${inv.status}">${inv.status.toUpperCase()}</span>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <strong>Bill To:</strong>
      <p style="margin:4px 0;font-size:14px;font-weight:700">${inv.customer}</p>
      ${linkedJob ? `<p style="margin:0;font-size:12px;color:#555">Ref: Job ${linkedJob.job_no}</p>` : ''}
    </div>
    <table>
      <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
      <tbody>
        ${(inv.items||[{ desc: 'Printing Services', qty: 1, rate: inv.amount, total: inv.amount }]).map(it => `
          <tr><td>${it.desc||'Services'}</td><td>${it.qty}</td><td>${fmt(parseFloat(it.rate)||0)}</td><td>${fmt((parseFloat(it.qty)||0)*(parseFloat(it.rate)||0))}</td></tr>
        `).join('')}
        <tr class="total-row"><td colspan="3" style="text-align:right">Total</td><td>${fmt(inv.amount)}</td></tr>
        <tr><td colspan="3" style="text-align:right;color:#16a34a">Amount Paid</td><td style="color:#16a34a;font-weight:700">${fmt(inv.paid)}</td></tr>
        <tr><td colspan="3" style="text-align:right;color:#dc2626">Balance Due</td><td style="color:#dc2626;font-weight:700">${fmt(inv.amount-inv.paid)}</td></tr>
      </tbody>
    </table>
    <div class="footer"><p>Thank you for your business! Payment due by ${inv.due_date||'agreed date'}.</p>
    <p>For queries, contact us. Printed ${new Date().toLocaleString()}</p></div>
    <script>window.onload=()=>window.print()</script></body></html>`);
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
                <TD>{inv.customer}</TD>
                <TD>{inv.date}</TD>
                <TD style={{ color: inv.due_date < todayStr() && inv.status !== 'paid' ? '#dc2626' : '#374151' }}>{inv.due_date}</TD>
                <TD style={{ fontWeight: 600 }}>{fmt(inv.amount)}</TD>
                <TD style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(inv.paid)}</TD>
                <TD style={{ color: inv.amount - inv.paid > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{fmt(inv.amount - inv.paid)}</TD>
                <TD><Badge text={inv.status === 'paid' ? 'completed' : inv.status === 'partial' ? 'in-progress' : 'queued'} /></TD>
                <TD>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {inv.status !== 'paid' && <Btn variant="success" small onClick={() => markPaid(inv.id)}>Paid âœ“</Btn>}
                    {inv.status !== 'paid' && <Btn variant="ghost" small onClick={() => recordPartial(inv.id)}>Partial</Btn>}
                    <Btn variant="ghost" small onClick={() => printInvoice(inv)}>ðŸ–¨ï¸ Print</Btn>
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
              <option value="">â€” Select Customer â€”</option>
              {customers.map(c => <option key={c.id}>{c.name}</option>)}
            </Sel>
            <Sel label="Link to Job (optional)" value={form.job_id} onChange={e => {
              const j = jobs.find(x => x.id === e.target.value);
              if (j) setForm({ ...form, job_id: e.target.value, customer: j.customer, customer_id: j.customer_id, items: [{ desc: j.description, qty: 1, rate: String(j.price), total: j.price }] });
              else   setForm({ ...form, job_id: e.target.value });
            }}>
              <option value="">â€” None â€”</option>
              {jobs.filter(j => j.status === 'completed').map(j => <option key={j.id} value={j.id}>{j.job_no} â€” {j.description}</option>)}
            </Sel>
            <Inp label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <h4 style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700 }}>Line Items</h4>
            {form.items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
                <Inp placeholder="Description" value={item.desc} onChange={e => updateItem(idx, 'desc', e.target.value)} />
                <Inp placeholder="Qty" type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} />
                <Inp placeholder="Rate" type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} />
                <button onClick={() => setForm({ ...form, items: form.items.filter((_,i) => i !== idx) })}
                  style={{ background: '#fee2e2', border: 'none', borderRadius: 4, padding: '8px 10px', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>Ã—</button>
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

// â”€â”€â”€ FINANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FinanceTab({ sales, setSales, expenses, setExpenses, addNotif, userId }) {
  const [sf, setSf] = useState({ date: todayStr(), amount: '', payment_method: 'Cash' });
  const [ef, setEf] = useState({ date: todayStr(), category: 'Paper', description: '', amount: '' });
  const [showSF, setShowSF] = useState(false);
  const [showEF, setShowEF] = useState(false);

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

  const delSale = async (id) => { const { error } = await db.deleteSale(id); if (!error) setSales(sales.filter(x => x.id !== id)); };
  const delExp  = async (id) => { const { error } = await db.deleteExpense(id); if (!error) setExpenses(expenses.filter(x => x.id !== id)); };

  // Payment method breakdown
  const pmBreakdown = ['Cash','Mobile Money','Bank Transfer','Credit','Other'].map(m => ({
    method: m, total: sales.filter(s => (s.payment_method||'Cash') === m).reduce((a,s)=>a+s.amount,0)
  })).filter(x => x.total > 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Finance</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="success" onClick={() => { setShowSF(v=>!v); setShowEF(false); }}>+ Record Sale</Btn>
          <Btn variant="warning" onClick={() => { setShowEF(v=>!v); setShowSF(false); }}>+ Add Expense</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Monthly Income"   value={fmt(mSales)} accent="#16a34a" />
        <StatCard label="Monthly Expenses" value={fmt(mExp)}   accent="#dc2626" />
        <StatCard label="Monthly Profit"   value={fmt(mSales - mExp)} accent={mSales >= mExp ? '#2563eb' : '#dc2626'} />
        <StatCard label="All-Time Revenue" value={fmt(sales.reduce((a,s)=>a+s.amount,0))} accent="#7c3aed" />
      </div>

      {pmBreakdown.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>Payment Method Breakdown</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {pmBreakdown.map(p => (
              <div key={p.method} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{fmt(p.total)}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{p.method}</div>
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
            <Inp label="Amount (GHâ‚µ)" type="number" value={sf.amount} onChange={e => setSf({ ...sf, amount: e.target.value })} />
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
            <Inp label="Amount (GHâ‚µ)" type="number" value={ef.amount} onChange={e => setEf({ ...ef, amount: e.target.value })} />
            <Btn variant="warning" onClick={addExp}>Record</Btn>
            <Btn variant="ghost" onClick={() => setShowEF(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#15803d' }}>ðŸ’š Income ({sales.length})</h3>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {[...sales].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f9fafb', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{s.date}</span>
                {s.payment_method && <span style={{ fontSize: 10, background: '#f1f5f9', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>{s.payment_method}</span>}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{fmt(s.amount)}</span>
                <button onClick={() => delSale(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>Ã—</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>â¤ï¸ Expenses ({expenses.length})</h3>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {[...expenses].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f9fafb', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{e.date}</span>
                <span style={{ fontSize: 11, background: '#f1f5f9', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>{e.category}</span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap' }}>{fmt(e.amount)}</span>
                <button onClick={() => delExp(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>Ã—</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ LOANS TAB (local storage only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const EMPTY_LOAN = { name: '', type: 'borrowed', amount: '', rate: '', date: todayStr(), due_date: '', paid: '0', notes: '' };

function LoansTab({ loans, saveLoans, addNotif }) {
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState(EMPTY_LOAN);
  const [editId, setEditId] = useState(null);

  const totalBorrowed = loans.filter(l => l.type === 'borrowed').reduce((a, l) => a + (l.amount - l.paid), 0);
  const totalLent     = loans.filter(l => l.type === 'lent').reduce((a, l) => a + (l.amount - l.paid), 0);

  const save = () => {
    if (!form.name || !form.amount) return;
    const loan = { ...form, amount: parseFloat(form.amount)||0, rate: parseFloat(form.rate)||0, paid: parseFloat(form.paid)||0 };
    if (editId) {
      saveLoans(loans.map(l => l.id === editId ? { ...loan, id: editId } : l));
      addNotif('Loan updated', 'success');
    } else {
      saveLoans([...loans, { ...loan, id: `loan_${Date.now()}` }]);
      addNotif('Loan recorded', 'success');
    }
    setModal(false); setForm(EMPTY_LOAN); setEditId(null);
  };

  const del = (id) => {
    if (!window.confirm('Delete this loan?')) return;
    saveLoans(loans.filter(l => l.id !== id));
  };

  const recordPayment = (id) => {
    const raw = prompt('Enter payment amount (GHâ‚µ):');
    const amt = parseFloat(raw);
    if (!amt || isNaN(amt)) return;
    saveLoans(loans.map(l => {
      if (l.id !== id) return l;
      const newPaid = Math.min(l.paid + amt, l.amount);
      return { ...l, paid: newPaid };
    }));
    addNotif(`Payment of ${fmt(amt)} recorded`, 'success');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>ðŸ¦ Loans & Credit</h2>
        <Btn onClick={() => { setForm(EMPTY_LOAN); setEditId(null); setModal(true); }}>+ Add Loan</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Borrowed" value={fmt(totalBorrowed)} accent="#dc2626" />
        <StatCard label="Total Lent Out" value={fmt(totalLent)}     accent="#f59e0b" />
        <StatCard label="Active Loans"   value={loans.filter(l => l.paid < l.amount).length} accent="#2563eb" />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Name','Type','Amount','Rate %','Date','Due','Paid','Balance','Notes','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr>
          </thead>
          <tbody>
            {loans.map(l => {
              const balance = l.amount - l.paid;
              const overdue = l.due_date && l.due_date < todayStr() && balance > 0;
              return (
                <tr key={l.id} style={{ background: overdue ? '#fff5f5' : 'transparent' }}>
                  <TD style={{ fontWeight: 600 }}>{l.name}</TD>
                  <TD>
                    <span style={{ background: l.type === 'borrowed' ? '#fee2e2' : '#dcfce7', color: l.type === 'borrowed' ? '#dc2626' : '#16a34a', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                      {l.type === 'borrowed' ? 'Borrowed' : 'Lent'}
                    </span>
                  </TD>
                  <TD style={{ fontWeight: 600 }}>{fmt(l.amount)}</TD>
                  <TD>{l.rate ? `${l.rate}%` : 'â€”'}</TD>
                  <TD>{l.date}</TD>
                  <TD style={{ color: overdue ? '#dc2626' : '#374151', fontWeight: overdue ? 700 : 400 }}>
                    {l.due_date || 'â€”'}{overdue ? ' âš ï¸' : ''}
                  </TD>
                  <TD style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(l.paid)}</TD>
                  <TD style={{ fontWeight: 700, color: balance > 0 ? '#dc2626' : '#16a34a' }}>
                    {balance > 0 ? fmt(balance) : 'âœ“ Settled'}
                  </TD>
                  <TD style={{ color: '#6b7280', fontSize: 12 }}>{l.notes}</TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {balance > 0 && <Btn variant="success" small onClick={() => recordPayment(l.id)}>Pay</Btn>}
                      <Btn variant="ghost" small onClick={() => {
                        setForm({ ...l, amount: String(l.amount), rate: String(l.rate), paid: String(l.paid) });
                        setEditId(l.id); setModal(true);
                      }}>Edit</Btn>
                      <Btn variant="danger" small onClick={() => del(l.id)}>Del</Btn>
                    </div>
                  </TD>
                </tr>
              );
            })}
            {loans.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No loans recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editId ? 'Edit Loan' : 'Add Loan'} onClose={() => { setModal(false); setForm(EMPTY_LOAN); setEditId(null); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <Inp label="Name / Lender / Borrower *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <Sel label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="borrowed">Borrowed (we owe)</option>
              <option value="lent">Lent (they owe us)</option>
            </Sel>
            <Inp label="Amount (GHâ‚µ) *" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <Inp label="Interest Rate (%)" type="number" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
            <Inp label="Amount Already Paid" type="number" value={form.paid} onChange={e => setForm({ ...form, paid: e.target.value })} />
            <Inp label="Start Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <Inp label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <div style={{ gridColumn: '1/-1' }}>
              <Inp label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => { setModal(false); setForm(EMPTY_LOAN); setEditId(null); }}>Cancel</Btn>
            <Btn onClick={save}>{editId ? 'Save Changes' : 'Add Loan'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// â”€â”€â”€ REPORTS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  const pSales    = filterByPeriod(sales, 'date').reduce((a, s) => a + s.amount, 0);
  const pExpenses = filterByPeriod(expenses, 'date').reduce((a, e) => a + e.amount, 0);
  const pProfit   = pSales - pExpenses;
  const pJobs     = filterByPeriod(jobs, 'start_date');

  // Revenue by job type
  const byType = JOB_TYPES.map(t => ({
    type: t,
    count: jobs.filter(j => j.type === t).length,
    revenue: jobs.filter(j => j.type === t).reduce((a, j) => a + (j.price||0), 0),
  })).filter(x => x.count > 0);

  // Top customers by revenue
  const topCustomers = customers.map(c => ({
    name: c.name,
    jobs: jobs.filter(j => j.customer_id === c.id).length,
    revenue: invoices.filter(i => i.customer_id === c.id).reduce((a, i) => a + (i.paid||0), 0),
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Expense breakdown by category
  const expByCategory = ['Paper','Ink & Toner','Maintenance','Salaries','Utilities','Other'].map(cat => ({
    cat,
    total: filterByPeriod(expenses, 'date').filter(e => e.category === cat).reduce((a, e) => a + e.amount, 0),
  })).filter(x => x.total > 0);

  // Monthly trend (last 6 months)
  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const ms = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const rev = sales.filter(s => (s.date||'').startsWith(ms)).reduce((a, s) => a + s.amount, 0);
    const exp = expenses.filter(e => (e.date||'').startsWith(ms)).reduce((a, e) => a + e.amount, 0);
    return { month: ms.slice(5) + '/' + ms.slice(2,4), rev, exp, profit: rev - exp };
  });
  const maxTrend = Math.max(...trend.map(t => Math.max(t.rev, t.exp)), 1);

  const completedJobs   = jobs.filter(j => j.status === 'completed').length;
  const completionRate  = jobs.length > 0 ? Math.round((completedJobs / jobs.length) * 100) : 0;
  const avgJobValue     = jobs.length > 0 ? jobs.reduce((a, j) => a + (j.price||0), 0) / jobs.length : 0;
  const totalOutstanding = invoices.filter(i => i.status !== 'paid').reduce((a, i) => a + (i.amount - i.paid), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>ðŸ“ˆ Reports & Analytics</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['month','This Month'],['year','This Year'],['all','All Time']].map(([val, lbl]) => (
            <button key={val} onClick={() => setPeriod(val)}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: period === val ? '#2563eb' : '#fff', color: period === val ? '#fff' : '#6b7280', borderColor: period === val ? '#2563eb' : '#e5e7eb' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Revenue"         value={fmt(pSales)}     accent="#16a34a" />
        <StatCard label="Expenses"        value={fmt(pExpenses)}  accent="#dc2626" />
        <StatCard label="Net Profit"      value={fmt(pProfit)}    accent={pProfit >= 0 ? '#2563eb' : '#dc2626'} />
        <StatCard label="Jobs Created"    value={pJobs.length}    accent="#7c3aed" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} accent="#f59e0b" />
        <StatCard label="Avg Job Value"   value={fmt(avgJobValue)} accent="#0891b2" />
        <StatCard label="Outstanding"     value={fmt(totalOutstanding)} accent="#dc2626" />
      </div>

      {/* Revenue vs Expenses Trend */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Revenue vs Expenses â€” Last 6 Months</h3>
        <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>â–  Revenue</span>
          <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>â–  Expenses</span>
          <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 700 }}>â–  Profit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140 }}>
          {trend.map((t, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 110 }}>
                <div style={{ flex: 1, background: '#16a34a', borderRadius: '2px 2px 0 0', height: `${Math.max(2, Math.round((t.rev / maxTrend) * 110))}px` }} title={`Revenue: ${fmt(t.rev)}`} />
                <div style={{ flex: 1, background: '#dc2626', borderRadius: '2px 2px 0 0', height: `${Math.max(2, Math.round((t.exp / maxTrend) * 110))}px` }} title={`Expenses: ${fmt(t.exp)}`} />
                <div style={{ flex: 1, background: t.profit >= 0 ? '#2563eb' : '#f59e0b', borderRadius: '2px 2px 0 0', height: `${Math.max(2, Math.round((Math.abs(t.profit) / maxTrend) * 110))}px` }} title={`Profit: ${fmt(t.profit)}`} />
              </div>
              <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{t.month}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Revenue by Job Type */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Revenue by Job Type</h3>
          {byType.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No data yet</p>}
          {byType.map(({ type, count, revenue }) => {
            const total = byType.reduce((a, x) => a + x.revenue, 0);
            const pct   = total > 0 ? Math.round((revenue / total) * 100) : 0;
            return (
              <div key={type} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>{type} <span style={{ color: '#9ca3af' }}>({count} jobs)</span></span>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>{fmt(revenue)} â€” {pct}%</span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 4, height: 8 }}>
                  <div style={{ width: `${pct}%`, background: '#2563eb', height: 8, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Expense Breakdown */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Expense Breakdown</h3>
          {expByCategory.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No expenses in this period</p>}
          {expByCategory.map(({ cat, total }) => {
            const grandTotal = expByCategory.reduce((a, x) => a + x.total, 0);
            const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>{cat}</span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(total)} â€” {pct}%</span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 4, height: 8 }}>
                  <div style={{ width: `${pct}%`, background: '#dc2626', height: 8, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Customers */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>ðŸ† Top Customers by Revenue</h3>
        {topCustomers.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No customer data yet</p>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Rank','Customer','Total Jobs','Revenue Collected'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {topCustomers.map((c, i) => (
                <tr key={c.name}>
                  <TD style={{ fontWeight: 800, color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#374151' }}>
                    {i === 0 ? 'ðŸ¥‡' : i === 1 ? 'ðŸ¥ˆ' : i === 2 ? 'ðŸ¥‰' : `#${i+1}`}
                  </TD>
                  <TD style={{ fontWeight: 600 }}>{c.name}</TD>
                  <TD>{c.jobs}</TD>
                  <TD style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(c.revenue)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Status Summary */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Job Status Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
          {JOB_STATUSES.map(s => {
            const count = jobs.filter(j => j.status === s).length;
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
