import React, { useState, useEffect, useCallback } from 'react';
import db, { supabase } from '../utils/db';

// ─── STATIC DATA (no longer stored in localStorage) ───────────────────────
const MACHINES   = ['Heidelberg SM52', 'Screen Press 1', 'Screen Press 2', 'Xerox Versant', 'Large Format Printer', 'Guillotine'];
const JOB_TYPES  = ['Offset', 'Digital', 'Screen Print', 'Large Format', 'Finishing', 'Other'];
const JOB_STATUSES = ['quoting', 'queued', 'in-progress', 'on-hold', 'completed', 'cancelled'];

// ─── HELPERS ──────────────────────────────────────────────────────────────
const fmt = (n) => `GH₵${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// ─── MINI COMPONENTS ──────────────────────────────────────────────────────
const Badge = ({ text, type = 'status' }) => {
  const c = type === 'status' ? (STATUS_COLORS[text] || {}) : (PRIORITY_COLORS[text] || {});
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

// ─── MAIN APP ─────────────────────────────────────────────────────────────
export default function PrintingPressSystem() {
  const [currentUser, setCurrentUser]   = useState(null);
  const [loginData,   setLoginData]     = useState({ email: '', password: '' });
  const [loginError,  setLoginError]    = useState('');
  const [activeTab,   setActiveTab]     = useState('dashboard');
  const [showNotif,   setShowNotif]     = useState(false);
  const [loading,     setLoading]       = useState(true);  // ← loading state for data fetch

  // ── All data lives here, fetched from Supabase ──
  const [customers,  setCustomers]  = useState([]);
  const [jobs,       setJobs]       = useState([]);
  const [inventory,  setInventory]  = useState([]);
  const [invoices,   setInvoices]   = useState([]);
  const [sales,      setSales]      = useState([]);
  const [expenses,   setExpenses]   = useState([]);
  const [notifs,     setNotifs]     = useState([]);

  // ── 1. On mount: check if user is already signed in ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes (e.g. session expiry)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setCurrentUser(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── 2. When user logs in, load all their data ──
  const loadAllData = useCallback(async (userId) => {
    setLoading(true);
    const [c, j, inv, inv2, s, e] = await Promise.all([
      db.getCustomers(userId),
      db.getJobs(userId),
      db.getInventory(userId),
      db.getInvoices(userId),
      db.getSales(userId),
      db.getExpenses(userId),
    ]);

    setCustomers(c.data);
    setJobs(j.data);
    setInventory(inv.data);
    setInvoices(inv2.data);
    setSales(s.data);
    setExpenses(e.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    loadAllData(currentUser.id);
  }, [currentUser, loadAllData]);

  // ── 3. Real-time subscriptions: keep all devices in sync ──
  useEffect(() => {
    if (!currentUser) return;

    const unsubs = [
      db.subscribeToTable('customers', currentUser.id,
        (row) => setCustomers(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setCustomers(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setCustomers(p => p.filter(x => x.id !== row.id))
      ),
      db.subscribeToTable('jobs', currentUser.id,
        (row) => setJobs(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setJobs(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setJobs(p => p.filter(x => x.id !== row.id))
      ),
      db.subscribeToTable('inventory', currentUser.id,
        (row) => setInventory(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setInventory(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setInventory(p => p.filter(x => x.id !== row.id))
      ),
      db.subscribeToTable('invoices', currentUser.id,
        (row) => setInvoices(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setInvoices(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setInvoices(p => p.filter(x => x.id !== row.id))
      ),
      db.subscribeToTable('sales', currentUser.id,
        (row) => setSales(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setSales(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setSales(p => p.filter(x => x.id !== row.id))
      ),
      db.subscribeToTable('expenses', currentUser.id,
        (row) => setExpenses(p => [...p.filter(x=>x.id!==row.id), row]),
        (row) => setExpenses(p => p.map(x => x.id===row.id ? row : x)),
        (row) => setExpenses(p => p.filter(x => x.id !== row.id))
      ),
    ];

    return () => unsubs.forEach(fn => fn());
  }, [currentUser]);

  const addNotif = (message, type = 'info') =>
    setNotifs(n => [{ id: Date.now(), type, message, read: false }, ...n.slice(0, 19)]);

  // ── LOGIN ──
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

  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%)', fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
        <div style={{ background: '#fff', padding: 40, borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🖨️</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>Print Shop Manager</h1>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Powered by Supabase — syncs across all devices</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Inp label="Email" type="email" placeholder="admin@printshop.com" value={loginData.email}
              onChange={e => setLoginData({ ...loginData, email: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <Inp label="Password" type="password" placeholder="••••••••" value={loginData.password}
              onChange={e => setLoginData({ ...loginData, password: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
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
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🖨️</div>
          <p>Loading your data…</p>
        </div>
      </div>
    );
  }

  const unread   = notifs.filter(n => !n.read).length;
  const lowStock = inventory.filter(i => i.quantity <= i.reorderPoint);

  const TABS = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'jobs',      label: '🗂️ Jobs' },
    { id: 'customers', label: '👥 Customers' },
    { id: 'quotes',    label: '💬 Quotes' },
    { id: 'schedule',  label: '📅 Schedule' },
    { id: 'inventory', label: '📦 Inventory' },
    { id: 'invoices',  label: '🧾 Invoices' },
    { id: 'finance',   label: '💰 Finance' },
    { id: 'reports',   label: '📈 Reports' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#111' }}>
      <header style={{ background: '#0f172a', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🖨️</span>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>PrintShop Manager</span>
          {lowStock.length > 0 && (
            <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>
              {lowStock.length} LOW STOCK
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotif(v => !v)}
              style={{ background: showNotif ? '#1e3a5f' : 'transparent', border: '1px solid #334155', color: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 16, position: 'relative' }}>
              🔔
              {unread > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unread}
                </span>
              )}
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
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '13px 14px', background: 'transparent', border: 'none', borderBottom: activeTab === t.id ? '3px solid #2563eb' : '3px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, color: activeTab === t.id ? '#2563eb' : '#6b7280', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </nav>

      <main style={{ padding: '28px 24px', maxWidth: 1400, margin: '0 auto' }}>
        {activeTab === 'dashboard' && <DashboardTab jobs={jobs} sales={sales} expenses={expenses} customers={customers} inventory={inventory} invoices={invoices} setActiveTab={setActiveTab} />}
        {activeTab === 'jobs'      && <JobsTab jobs={jobs} setJobs={setJobs} customers={customers} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'customers' && <CustomersTab customers={customers} setCustomers={setCustomers} jobs={jobs} invoices={invoices} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'quotes'    && <QuotesTab customers={customers} jobs={jobs} setJobs={setJobs} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'schedule'  && <ScheduleTab jobs={jobs} setJobs={setJobs} userId={currentUser.id} />}
        {activeTab === 'inventory' && <InventoryTab inventory={inventory} setInventory={setInventory} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'invoices'  && <InvoicesTab invoices={invoices} setInvoices={setInvoices} jobs={jobs} customers={customers} setSales={setSales} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'finance'   && <FinanceTab sales={sales} setSales={setSales} expenses={expenses} setExpenses={setExpenses} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'reports'   && <ReportsTab jobs={jobs} sales={sales} expenses={expenses} customers={customers} inventory={inventory} invoices={invoices} />}
      </main>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardTab({ jobs, sales, expenses, customers, inventory, invoices, setActiveTab }) {
  const month = getCurrentMonth();
  const monthlySales = sales.filter(s => s.date?.startsWith(month)).reduce((a, s) => a + s.amount, 0);
  const monthlyExp   = expenses.filter(e => e.date?.startsWith(month)).reduce((a, e) => a + e.amount, 0);
  const activeJobs   = jobs.filter(j => j.status === 'in-progress').length;
  const overdueJobs  = jobs.filter(j => !['completed','cancelled'].includes(j.status) && j.due_date < todayStr()).length;
  const lowStock     = inventory.filter(i => i.quantity <= i.reorder_point);
  const unpaidTotal  = invoices.filter(i => i.status !== 'paid').reduce((a, i) => a + (i.amount - i.paid), 0);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split('T')[0];
    return { day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()], amt: sales.filter(s => s.date === ds).reduce((a, s) => a + s.amount, 0) };
  });
  const maxBar = Math.max(...last7.map(d => d.amt), 1);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Monthly Income"   value={fmt(monthlySales)} accent="#16a34a" />
        <StatCard label="Monthly Expenses" value={fmt(monthlyExp)}   accent="#dc2626" />
        <StatCard label="Monthly Profit"   value={fmt(monthlySales - monthlyExp)} accent={monthlySales >= monthlyExp ? '#2563eb' : '#dc2626'} />
        <StatCard label="Active Jobs"      value={activeJobs} sub={overdueJobs > 0 ? `⚠️ ${overdueJobs} overdue` : 'On track'} accent="#f59e0b" />
        <StatCard label="Outstanding"      value={fmt(unpaidTotal)} sub={`${invoices.filter(i=>i.status!=='paid').length} invoice(s)`} accent="#7c3aed" />
        <StatCard label="Low Stock Items"  value={lowStock.length} sub={lowStock.length > 0 ? 'Needs reorder' : 'All good'} accent={lowStock.length > 0 ? '#dc2626' : '#16a34a'} />
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

// ─── JOBS ─────────────────────────────────────────────────────────────────────
const EMPTY_JOB = { customer: '', customer_id: '', description: '', type: 'Digital', status: 'queued', priority: 'normal', due_date: '', start_date: '', price: '', cost: '', machine: '', notes: '' };

function JobsTab({ jobs, setJobs, customers, addNotif, userId }) {
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState(EMPTY_JOB);
  const [editId,  setEditId]  = useState(null);
  const [saving,  setSaving]  = useState(false);

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
      if (!error) {
        setJobs(jobs.map(j => j.id === editId ? data : j));
        addNotif(`Job updated`, 'success');
      } else addNotif('Error updating job', 'warning');
    } else {
      const no = nextNo();
      const { data, error } = await db.addJob(userId, { ...payload, job_no: no, qr_code: no });
      if (!error) {
        setJobs([...jobs, data]);
        addNotif(`Job ${no} created`, 'success');
      } else addNotif('Error creating job', 'warning');
    }
    setSaving(false);
    closeModal();
  };

  const del = async (id) => {
    if (!window.confirm('Delete this job?')) return;
    const { error } = await db.deleteJob(id);
    if (!error) { setJobs(jobs.filter(j => j.id !== id)); addNotif('Job deleted'); }
  };

  const updateStatus = async (id, status) => {
    const { data, error } = await db.updateJob(id, { status });
    if (!error) setJobs(jobs.map(j => j.id === id ? data : j));
  };

  const printTicket = (j) => {
    const w = window.open('', '', 'width=600,height=500');
    w.document.write(`<html><body style="font-family:Arial;padding:30px;max-width:500px">
      <h2>🖨️ JOB TICKET — ${j.job_no}</h2>
      <p><b>Customer:</b> ${j.customer}</p>
      <p><b>Description:</b> ${j.description}</p>
      <p><b>Type:</b> ${j.type} &nbsp; <b>Machine:</b> ${j.machine||'TBD'}</p>
      <p><b>Priority:</b> ${(j.priority||'').toUpperCase()} &nbsp; <b>Status:</b> ${j.status}</p>
      <p><b>Start:</b> ${j.start_date||'TBD'} &nbsp; <b>Due:</b> ${j.due_date||'TBD'}</p>
      <p><b>Price:</b> GH₵${j.price} &nbsp; <b>Est. Cost:</b> GH₵${j.cost}</p>
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search…" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13 }} />
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
          <thead><tr>{['Job #','Customer','Description','Type','Machine','Due','Price','Priority','Status','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {filtered.map(j => (
              <tr key={j.id}>
                <TD style={{ fontWeight: 700, color: '#2563eb' }}>{j.job_no}</TD>
                <TD>{j.customer}</TD>
                <TD style={{ maxWidth: 180 }}>{j.description}</TD>
                <TD>{j.type}</TD>
                <TD style={{ color: '#6b7280' }}>{j.machine || '—'}</TD>
                <TD style={{ color: j.due_date < todayStr() && !['completed','cancelled'].includes(j.status) ? '#dc2626' : '#374151' }}>{j.due_date || '—'}</TD>
                <TD style={{ fontWeight: 600 }}>{fmt(j.price)}</TD>
                <TD><Badge text={j.priority} type="priority" /></TD>
                <TD>
                  <select value={j.status} onChange={e => updateStatus(j.id, e.target.value)}
                    style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '3px 6px', fontSize: 11, background: STATUS_COLORS[j.status]?.bg, color: STATUS_COLORS[j.status]?.color, cursor: 'pointer', fontWeight: 700 }}>
                    {JOB_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </TD>
                <TD>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn variant="ghost" small onClick={() => openEdit(j)}>Edit</Btn>
                    <Btn variant="ghost" small onClick={() => printTicket(j)}>🖨️</Btn>
                    <Btn variant="danger" small onClick={() => del(j.id)}>Del</Btn>
                  </div>
                </TD>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No jobs found</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editId ? `Edit Job` : 'New Job Ticket'} onClose={closeModal}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Sel label="Customer *" value={form.customer} onChange={e => { const c = customers.find(x => x.name === e.target.value); setForm({ ...form, customer: e.target.value, customer_id: c?.id||'' }); }}>
              <option value="">— Select Customer —</option>
              {customers.map(c => <option key={c.id}>{c.name}</option>)}
            </Sel>
            <Sel label="Job Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
            </Sel>
            <div style={{ gridColumn: '1/-1' }}>
              <Inp label="Description *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <Sel label="Machine" value={form.machine} onChange={e => setForm({ ...form, machine: e.target.value })}>
              <option value="">— Unassigned —</option>
              {MACHINES.map(m => <option key={m}>{m}</option>)}
            </Sel>
            <Sel label="Priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="normal">Normal</option>
              <option value="rush">Rush (+25%)</option>
              <option value="urgent">Urgent</option>
            </Sel>
            <Sel label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {JOB_STATUSES.map(s => <option key={s}>{s}</option>)}
            </Sel>
            <Inp label="Start Date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <Inp label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <Inp label="Price (GH₵)" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            <Inp label="Est. Cost (GH₵)" type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={closeModal}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Job'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
const EMPTY_CX = { name: '', email: '', phone: '', address: '' };

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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search…" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: 13 }} />
          <Btn onClick={() => { setForm(EMPTY_CX); setEditId(null); setModal(true); }}>+ Add Customer</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Name','Email','Phone','Jobs','Revenue','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {filtered.map(c => {
                const cJobs = jobs.filter(j => j.customer_id === c.id);
                const cRev  = invoices.filter(i => i.customer_id === c.id).reduce((a, i) => a + (i.paid||0), 0);
                return (
                  <tr key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selected?.id === c.id ? '#eff6ff' : 'transparent' }}>
                    <TD style={{ fontWeight: 600 }}>{c.name}</TD>
                    <TD style={{ color: '#6b7280' }}>{c.email}</TD>
                    <TD>{c.phone}</TD>
                    <TD>{cJobs.length}</TD>
                    <TD style={{ fontWeight: 600, color: '#16a34a' }}>{fmt(cRev)}</TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <Btn variant="ghost" small onClick={() => { setForm({ name: c.name, email: c.email, phone: c.phone, address: c.address }); setEditId(c.id); setModal(true); }}>Edit</Btn>
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
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 20 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 3px' }}>📧 {selected.email}</p>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 3px' }}>📞 {selected.phone}</p>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>📍 {selected.address}</p>
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

// ─── QUOTES ───────────────────────────────────────────────────────────────────
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
      price: q.total, cost: 0, machine: '', notes: q.notes, qr_code: no
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
        <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 800 }}>⚡ Quick Quote Builder</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Sel label="Customer *" value={form.customer} onChange={e => { const c = customers.find(x => x.name === e.target.value); setForm({ ...form, customer: e.target.value, customer_id: c?.id||'' }); }}>
            <option value="">— Select Customer —</option>
            {customers.map(c => <option key={c.id}>{c.name}</option>)}
          </Sel>
          <Inp label="Description *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Sel label="Job Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
          </Sel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Inp label="Quantity *" type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} />
            <Inp label="Unit Price (GH₵) *" type="number" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.rushFee} onChange={e => setForm({ ...form, rushFee: e.target.checked })} /> Rush +25%
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.bulkDiscount} onChange={e => setForm({ ...form, bulkDiscount: e.target.checked })} /> Bulk −10% (qty≥100)
            </label>
          </div>
          <Inp label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginTop: 16 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>Price Breakdown</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Subtotal</span><span>{fmt(sub)}</span></div>
            {rush > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#f59e0b' }}><span>Rush Fee</span><span>+{fmt(rush)}</span></div>}
            {bulk > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a' }}><span>Bulk Discount</span><span>−{fmt(bulk)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
              <span>Total</span><span style={{ color: '#2563eb' }}>{fmt(total)}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}><Btn onClick={save}>💾 Save Quote</Btn></div>
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
            <p style={{ margin: '0 0 2px', fontSize: 12, color: '#6b7280' }}>{q.description} — qty {q.qty}</p>
            <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#2563eb' }}>{fmt(q.total)}</p>
            {q.status !== 'converted' && <Btn variant="success" small onClick={() => convert(q)}>→ Convert to Job</Btn>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────
function ScheduleTab({ jobs, setJobs, userId }) {
  const active = jobs.filter(j => !['cancelled','completed'].includes(j.status));
  const byMachine = {};
  MACHINES.forEach(m => { byMachine[m] = active.filter(j => j.machine === m); });
  byMachine['Unassigned'] = active.filter(j => !j.machine);

  const updateStatus = async (id, status) => {
    const { data, error } = await db.updateJob(id, { status });
    if (!error) setJobs(jobs.map(j => j.id === id ? data : j));
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800 }}>Production Schedule</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
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
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: '#6b7280' }}>{(j.description||'').substring(0,40)}</p>
                  <select value={j.status} onChange={e => updateStatus(j.id, e.target.value)}
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

      <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Machine Capacity</h3>
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
    </div>
  );
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
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
                      ? <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>⚠️ LOW</span>
                      : <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>OK</span>}
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <button onClick={() => adjust(item.id, -1)} style={{ background: '#fee2e2', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontWeight: 800, color: '#dc2626' }}>−</button>
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

// ─── INVOICES ─────────────────────────────────────────────────────────────────
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
                  <div style={{ display: 'flex', gap: 4 }}>
                    {inv.status !== 'paid' && <Btn variant="success" small onClick={() => markPaid(inv.id)}>Paid ✓</Btn>}
                    {inv.status !== 'paid' && <Btn variant="ghost" small onClick={() => recordPartial(inv.id)}>Partial</Btn>}
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
            <Sel label="Link to Job (optional)" value={form.job_id} onChange={e => {
              const j = jobs.find(x => x.id === e.target.value);
              if (j) setForm({ ...form, job_id: e.target.value, customer: j.customer, customer_id: j.customer_id, items: [{ desc: j.description, qty: 1, rate: String(j.price), total: j.price }] });
              else   setForm({ ...form, job_id: e.target.value });
            }}>
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
                <button onClick={() => setForm({ ...form, items: form.items.filter((_,i) => i !== idx) })}
                  style={{ background: '#fee2e2', border: 'none', borderRadius: 4, padding: '8px 10px', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>×</button>
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

// ─── FINANCE ──────────────────────────────────────────────────────────────────
function FinanceTab({ sales, setSales, expenses, setExpenses, addNotif, userId }) {
  const [sf, setSf] = useState({ date: todayStr(), amount: '' });
  const [ef, setEf] = useState({ date: todayStr(), category: 'Paper', description: '', amount: '' });
  const [showSF, setShowSF] = useState(false);
  const [showEF, setShowEF] = useState(false);

  const month  = getCurrentMonth();
  const mSales = sales.filter(s => s.date?.startsWith(month)).reduce((a, s) => a + s.amount, 0);
  const mExp   = expenses.filter(e => e.date?.startsWith(month)).reduce((a, e) => a + e.amount, 0);

  const addSale = async () => {
    if (!sf.date || !sf.amount) return;
    const { data, error } = await db.addSale(userId, { date: sf.date, amount: parseFloat(sf.amount), job_id: null });
    if (!error) { setSales([...sales, data]); setSf({ date: todayStr(), amount: '' }); setShowSF(false); addNotif(`Sale of ${fmt(sf.amount)} recorded`, 'success'); }
  };

  const addExp = async () => {
    if (!ef.date || !ef.amount) return;
    const { data, error } = await db.addExpense(userId, { date: ef.date, category: ef.category, description: ef.description, amount: parseFloat(ef.amount) });
    if (!error) { setExpenses([...expenses, data]); setEf({ date: todayStr(), category: 'Paper', description: '', amount: '' }); setShowEF(false); addNotif(`Expense of ${fmt(ef.amount)} recorded`, 'info'); }
  };

  const delSale = async (id) => { const { error } = await db.deleteSale(id); if (!error) setSales(sales.filter(x => x.id !== id)); };
  const delExp  = async (id) => { const { error } = await db.deleteExpense(id); if (!error) setExpenses(expenses.filter(x => x.id !== id)); };

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

      {showSF && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#15803d' }}>Record Sale</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Inp label="Date" type="date" value={sf.date} onChange={e => setSf({ ...sf, date: e.target.value })} />
            <Inp label="Amount (GH₵)" type="number" value={sf.amount} onChange={e => setSf({ ...sf, amount: e.target.value })} />
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#15803d' }}>💚 Income ({sales.length})</h3>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {[...sales].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f9fafb' }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{s.date}</span>
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

// ─── REPORTS ──────────────────────────────────────────────────────────────────
function ReportsTab({ jobs, sales, expenses, customers, inventory, invoices }) {
  const month    = getCurrentMonth();
  const mSales   = sales.filter(s => s.date?.startsWith(month)).reduce((a, s) => a + s.amount, 0);
  const mExp     = expenses.filter(e => e.date?.startsWith(month)).reduce((a, e) => a + e.amount, 0);
  const tRev     = sales.reduce((a, s) => a + s.amount, 0);
  const tExp     = expenses.reduce((a, e) => a + e.amount, 0);
  const doneJobs = jobs.filter(j => j.status === 'completed');
  const avgJob   = doneJobs.length ? doneJobs.reduce((a, j) => a + j.price, 0) / doneJobs.length : 0;
  const margin   = tRev > 0 ? Math.round(((tRev - tExp) / tRev) * 100) : 0;

  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return { label: d.toLocaleString('default', { month: 'short' }), income: sales.filter(s => s.date?.startsWith(m)).reduce((a,s)=>a+s.amount,0), expense: expenses.filter(e => e.date?.startsWith(m)).reduce((a,e)=>a+e.amount,0) };
  });
  const maxTrend = Math.max(...trend.flatMap(t => [t.income, t.expense]), 1);

  const expCats = ['Paper','Ink & Toner','Maintenance','Salaries','Utilities','Other'].map(cat => ({ cat, total: expenses.filter(e => e.category === cat).reduce((a,e)=>a+e.amount,0) })).filter(c => c.total > 0);
  const maxExp  = Math.max(...expCats.map(c => c.total), 1);
  const topCx   = customers.map(c => ({ ...c, rev: invoices.filter(i=>i.customer_id===c.id).reduce((a,i)=>a+i.amount,0), jobCount: jobs.filter(j=>j.customer_id===c.id).length })).sort((a,b)=>b.rev-a.rev).slice(0,5);
  const byType  = JOB_TYPES.map(t => ({ type: t, count: jobs.filter(j=>j.type===t).length, rev: jobs.filter(j=>j.type===t).reduce((a,j)=>a+j.price,0) })).filter(t=>t.count>0).sort((a,b)=>b.rev-a.rev);
  const COLORS  = ['#2563eb','#16a34a','#f59e0b','#dc2626','#7c3aed','#0891b2'];

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800 }}>Reports & Analytics</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Revenue"  value={fmt(tRev)}       accent="#16a34a" />
        <StatCard label="Total Expenses" value={fmt(tExp)}       accent="#dc2626" />
        <StatCard label="Net Profit"     value={fmt(tRev-tExp)}  accent={tRev>=tExp?'#2563eb':'#dc2626'} />
        <StatCard label="Profit Margin"  value={`${margin}%`}   accent="#7c3aed" />
        <StatCard label="Avg Job Value"  value={fmt(avgJob)}     accent="#f59e0b" />
        <StatCard label="Completed Jobs" value={doneJobs.length} accent="#0891b2" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Income vs Expenses — 6 Months</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
            {trend.map((t, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110 }}>
                  <div style={{ width: 12, background: '#16a34a', borderRadius: '2px 2px 0 0', height: `${Math.max(2, Math.round((t.income/maxTrend)*100))}px` }} />
                  <div style={{ width: 12, background: '#dc2626', borderRadius: '2px 2px 0 0', height: `${Math.max(2, Math.round((t.expense/maxTrend)*100))}px` }} />
                </div>
                <span style={{ fontSize: 10, color: '#6b7280' }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Expense Breakdown</h3>
          {expCats.map((c, i) => (
            <div key={c.cat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 80, fontSize: 12 }}>{c.cat}</span>
              <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 10 }}>
                <div style={{ width: `${Math.round((c.total/maxExp)*100)}%`, background: COLORS[i%COLORS.length], height: 10, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, width: 90, textAlign: 'right' }}>{fmt(c.total)}</span>
            </div>
          ))}
          {expCats.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No expenses yet</p>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>🏆 Top Customers</h3>
          {topCx.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ width: 24, height: 24, background: i===0?'#fef3c7':'#f1f5f9', color: i===0?'#b45309':'#2563eb', borderRadius: '50%', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i+1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{c.jobCount} job(s)</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{fmt(c.rev)}</span>
            </div>
          ))}
          {topCx.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No data yet</p>}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Revenue by Job Type</h3>
          {byType.map((t, i) => (
            <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 12, height: 12, background: COLORS[i%COLORS.length], borderRadius: 2, display: 'inline-block' }} />
              <span style={{ flex: 1, fontSize: 13 }}>{t.type} <span style={{ color: '#9ca3af', fontSize: 11 }}>({t.count})</span></span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(t.rev)}</span>
            </div>
          ))}
          {byType.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No job data yet</p>}
        </div>
      </div>
    </div>
  );
}
