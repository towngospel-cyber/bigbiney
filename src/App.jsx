import { useState, useMemo, useEffect, useRef } from "react";

const CAT_COLORS = ["#7F77DD", "#1D9E75", "#D85A30", "#378ADD", "#BA7517"];
const priorityBg   = { high: "#FCEBEB", medium: "#FAEEDA", low: "#EAF3DE" };
const priorityText = { high: "#A32D2D", medium: "#854F0B", low: "#3B6D11" };
const fmt = (n) => "GH₵" + Number(Math.round(n)).toLocaleString();

const accounts = [
  { id: 1, email: "admin@printshop.com", password: "admin123", name: "Admin User" },
  { id: 2, email: "user@printshop.com",  password: "user123",  name: "Standard User" },
];

const historicalSales = [
  { id: "s1",  date: "2026-05-11", amount: 1350, description: "Banner print" },
  { id: "s2",  date: "2026-05-09", amount: 2000, description: "Business cards" },
  { id: "s3",  date: "2026-05-08", amount: 1950, description: "Flyers batch" },
  { id: "s4",  date: "2026-05-07", amount: 2460, description: "Brochures" },
  { id: "s5",  date: "2026-05-06", amount:  700, description: "Stickers" },
  { id: "s6",  date: "2026-05-05", amount: 1450, description: "Posters" },
  { id: "s7",  date: "2026-05-04", amount: 1930, description: "T-shirt prints" },
  { id: "s8",  date: "2026-05-02", amount: 1000, description: "ID cards" },
  { id: "s9",  date: "2026-05-01", amount: 2360, description: "Banners" },
  { id: "s10", date: "2026-04-30", amount: 2462, description: "Flex printing" },
];

const historicalExpenses = [
  { id: "e1", date: "2026-05-11", category: "Other", description: "T-shirt",     amount:  600 },
  { id: "e2", date: "2026-05-09", category: "Other", description: "Supplies",    amount:  950 },
  { id: "e3", date: "2026-05-08", category: "Paper", description: "Paper stock", amount: 1300 },
  { id: "e4", date: "2026-05-02", category: "Other", description: "T-shirt",     amount:  850 },
  { id: "e5", date: "2026-05-02", category: "Other", description: "Flexy",       amount:  650 },
];

function BarChartCanvas({ data }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const pad = { top: 16, right: 12, bottom: 28, left: 50 };
    const iW = W - pad.left - pad.right, iH = H - pad.top - pad.bottom;
    const maxV = Math.max(...data.map(d => Math.max(d.income, d.expenses)), 1);
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const textCol = isDark ? "#999" : "#888";
    const gridCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + iH - (i / 4) * iH;
      ctx.strokeStyle = gridCol; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + iW, y); ctx.stroke();
      ctx.fillStyle = textCol; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
      const label = fmt((i / 4) * maxV).replace("GH₵", "");
      ctx.fillText(label, pad.left - 4, y + 3);
    }
    const gW = iW / data.length;
    const bW = Math.max(4, gW * 0.28);
    data.forEach((d, i) => {
      const cx = pad.left + i * gW + gW / 2;
      [[d.income, -bW * 0.65, "#1D9E75"], [d.expenses, bW * 0.65, "#D85A30"]].forEach(([val, ox, color]) => {
        const bh = (val / maxV) * iH;
        const bx = cx + ox - bW / 2, by = pad.top + iH - bh;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bW, bh, [3, 3, 0, 0]);
        else ctx.rect(bx, by, bW, bh);
        ctx.fill();
      });
      ctx.fillStyle = textCol; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(d.day, cx, H - 6);
    });
  }, [data]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function LineChartCanvas({ data }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const pad = { top: 16, right: 12, bottom: 28, left: 50 };
    const iW = W - pad.left - pad.right, iH = H - pad.top - pad.bottom;
    const vals = data.map(d => d.profit);
    const minV = Math.min(...vals, 0), maxV = Math.max(...vals, 1);
    const range = maxV - minV || 1;
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const textCol = isDark ? "#999" : "#888";
    const gridCol = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + iH - (i / 4) * iH;
      ctx.strokeStyle = gridCol; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + iW, y); ctx.stroke();
      ctx.fillStyle = textCol; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
      ctx.fillText(fmt(minV + (i / 4) * range).replace("GH₵", ""), pad.left - 4, y + 3);
    }
    const toX = (i) => pad.left + (i / Math.max(data.length - 1, 1)) * iW;
    const toY = (v) => pad.top + iH - ((v - minV) / range) * iH;
    ctx.strokeStyle = "#378ADD"; ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(toX(i), toY(d.profit)) : ctx.lineTo(toX(i), toY(d.profit)));
    ctx.stroke();
    data.forEach((d, i) => {
      ctx.fillStyle = textCol; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(d.day, toX(i), H - 6);
    });
  }, [data]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function DonutChart({ data }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const S = canvas.offsetWidth;
    canvas.width = S * dpr; canvas.height = S * dpr;
    ctx.scale(dpr, dpr);
    const cx = S / 2, cy = S / 2, r = S * 0.4, ri = S * 0.24;
    const total = data.reduce((a, b) => a + b.value, 0);
    let angle = -Math.PI / 2;
    ctx.clearRect(0, 0, S, S);
    data.forEach((d, i) => {
      const slice = (d.value / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = CAT_COLORS[i % CAT_COLORS.length];
      ctx.fill();
      angle += slice;
    });
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "#1a1a1a" : "#ffffff";
    ctx.fill();
  }, [data]);
  return <canvas ref={ref} style={{ width: 120, height: 120, display: "block", flexShrink: 0 }} />;
}

export default function PrintingPressSystem() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData,   setLoginData]   = useState({ email: "", password: "" });
  const [loginError,  setLoginError]  = useState("");
  const [activeTab,   setActiveTab]   = useState("dashboard");
  const [sales,       setSales]       = useState(historicalSales);
  const [expenses,    setExpenses]    = useState(historicalExpenses);
  const [todos,       setTodos]       = useState([
    { id: 1, text: "Refill ink cartridges", completed: false, priority: "high" },
    { id: 2, text: "Check press efficiency", completed: true,  priority: "medium" },
    { id: 3, text: "Order paper stock",      completed: false, priority: "high" },
    { id: 4, text: "Invoice TechStart Inc",  completed: false, priority: "low" },
  ]);
  const [notifications, setNotifications] = useState([
    { id: 1, type: "success", message: "Payment received from TechStart Inc", read: false },
    { id: 2, type: "warning", message: "Low ink level detected",               read: false },
  ]);
  const [showNotif,     setShowNotif]     = useState(false);
  const [showTodoForm,  setShowTodoForm]  = useState(false);
  const [todoInput,     setTodoInput]     = useState("");
  const [todoPriority,  setTodoPriority]  = useState("medium");
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [showExpForm,   setShowExpForm]   = useState(false);
  const [salesForm,  setSalesForm]  = useState({ date: "", amount: "", description: "" });
  const [expForm,    setExpForm]    = useState({ date: "", category: "Paper", description: "", amount: "" });
  const [salesSearch, setSalesSearch] = useState("");
  const [expSearch,   setExpSearch]   = useState("");
  const [filterMonth, setFilterMonth] = useState("2026-05");

  const currentMonth = "2026-05";
  const monthlySales    = useMemo(() => sales.filter(s => s.date.startsWith(currentMonth)), [sales]);
  const monthlyExpenses = useMemo(() => expenses.filter(e => e.date.startsWith(currentMonth)), [expenses]);
  const totalIncome = monthlySales.reduce((s, x) => s + x.amount, 0);
  const totalExp    = monthlyExpenses.reduce((s, x) => s + x.amount, 0);
  const totalProfit = totalIncome - totalExp;
  const allIncome   = sales.reduce((s, x) => s + x.amount, 0);
  const allExp      = expenses.reduce((s, x) => s + x.amount, 0);

  const barData = useMemo(() => {
    const days = {};
    [...sales, ...expenses].filter(x => x.date.startsWith(currentMonth)).forEach(x => { days[x.date.slice(8)] = true; });
    return Object.keys(days).sort().map(d => ({
      day: parseInt(d),
      income:   sales.filter(s => s.date === `${currentMonth}-${d}`).reduce((a, b) => a + b.amount, 0),
      expenses: expenses.filter(e => e.date === `${currentMonth}-${d}`).reduce((a, b) => a + b.amount, 0),
    }));
  }, [sales, expenses]);

  const profitLine = useMemo(() => {
    let running = 0;
    return barData.map(b => { running += b.income - b.expenses; return { day: b.day, profit: running }; });
  }, [barData]);

  const catData = useMemo(() => {
    const cats = {};
    monthlyExpenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [monthlyExpenses]);

  const filteredSales = useMemo(() =>
    sales.filter(s => s.date.startsWith(filterMonth))
      .filter(s => !salesSearch || s.description?.toLowerCase().includes(salesSearch.toLowerCase()) || String(s.amount).includes(salesSearch))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [sales, salesSearch, filterMonth]);

  const filteredExp = useMemo(() =>
    expenses.filter(e => e.date.startsWith(filterMonth))
      .filter(e => !expSearch || e.description?.toLowerCase().includes(expSearch.toLowerCase()) || e.category?.toLowerCase().includes(expSearch.toLowerCase()) || String(e.amount).includes(expSearch))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [expenses, expSearch, filterMonth]);

  const handleLogin = () => {
    const user = accounts.find(a => a.email === loginData.email && a.password === loginData.password);
    if (user) { setCurrentUser(user); setLoginData({ email: "", password: "" }); setLoginError(""); }
    else setLoginError("Invalid email or password.");
  };

  const addSale = () => {
    if (!salesForm.date || !salesForm.amount) return;
    setSales([...sales, { id: `s${Date.now()}`, date: salesForm.date, amount: parseFloat(salesForm.amount), description: salesForm.description }]);
    setNotifications([{ id: Date.now(), type: "success", message: `Sale of ${fmt(salesForm.amount)} recorded`, read: false }, ...notifications]);
    setSalesForm({ date: "", amount: "", description: "" }); setShowSalesForm(false);
  };

  const addExpense = () => {
    if (!expForm.date || !expForm.amount) return;
    setExpenses([...expenses, { id: `e${Date.now()}`, date: expForm.date, category: expForm.category, description: expForm.description, amount: parseFloat(expForm.amount) }]);
    setNotifications([{ id: Date.now(), type: "info", message: `Expense of ${fmt(expForm.amount)} added`, read: false }, ...notifications]);
    setExpForm({ date: "", category: "Paper", description: "", amount: "" }); setShowExpForm(false);
  };

  const addTodo = () => {
    if (!todoInput.trim()) return;
    setTodos([...todos, { id: Date.now(), text: todoInput.trim(), completed: false, priority: todoPriority }]);
    setTodoInput(""); setTodoPriority("medium"); setShowTodoForm(false);
    setNotifications([{ id: Date.now(), type: "success", message: "Task added!", read: false }, ...notifications]);
  };

  const unread = notifications.filter(n => !n.read).length;
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "ti-home" },
    { id: "sales",     label: "Sales",     icon: "ti-cash" },
    { id: "expenses",  label: "Expenses",  icon: "ti-receipt" },
    { id: "todos",     label: "Tasks",     icon: "ti-checkbox" },
  ];

  const S = {
    card:       { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" },
    purpleBtn:  { background: "#534AB7", color: "#EEEDFE", border: "none", borderRadius: "var(--border-radius-md)", padding: "8px 14px", fontWeight: 500, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" },
    redBtn:     { background: "#993C1D", color: "#FAECE7", border: "none", borderRadius: "var(--border-radius-md)", padding: "8px 14px", fontWeight: 500, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" },
    formBox:    { background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 },
    fullInput:  { width: "100%", boxSizing: "border-box" },
    row:        { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" },
    sectionLbl: { fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" },
  };

  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "var(--color-background-tertiary)" }}>
        <div style={{ ...S.card, width: "100%", maxWidth: 380, padding: "2rem" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>Financial management</p>
          <h1 style={{ margin: "4px 0 1.5rem", fontSize: 22, fontWeight: 500 }}>Print shop manager</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <input type="email" placeholder="Email" value={loginData.email}
              onChange={e => { setLoginData({ ...loginData, email: e.target.value }); setLoginError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()} style={S.fullInput} />
            <input type="password" placeholder="Password" value={loginData.password}
              onChange={e => { setLoginData({ ...loginData, password: e.target.value }); setLoginError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()} style={S.fullInput} />
            {loginError && <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-danger)", background: "var(--color-background-danger)", padding: "8px 12px", borderRadius: "var(--border-radius-md)" }}>{loginError}</p>}
            <button onClick={handleLogin} style={{ ...S.purpleBtn, width: "100%", padding: "10px" }}>Sign in</button>
          </div>
          <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "1rem" }}>
            <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 8 }}>Demo accounts</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setLoginData({ email: "admin@printshop.com", password: "admin123" })} style={{ flex: 1, fontSize: 13 }}>Admin</button>
              <button onClick={() => setLoginData({ email: "user@printshop.com",  password: "user123"  })} style={{ flex: 1, fontSize: 13 }}>User</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background-tertiary)", paddingBottom: 72 }}>
      <header style={{ background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>Print shop</p>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>Manager</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowNotif(!showNotif)} aria-label="Notifications" style={{ position: "relative", fontSize: 18, padding: "6px 10px" }}>
              <i className="ti ti-bell" aria-hidden="true" />
              {unread > 0 && <span style={{ position: "absolute", top: 2, right: 2, background: "#E24B4A", color: "#fff", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500 }}>{unread}</span>}
            </button>
            {showNotif && (
              <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 8, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", width: 280, zIndex: 200, overflow: "hidden" }}>
                <p style={{ margin: 0, padding: "10px 14px", fontSize: 13, fontWeight: 500, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>Notifications</p>
                {notifications.length === 0 && <p style={{ padding: "12px 14px", fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>No notifications</p>}
                {notifications.map(n => (
                  <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <i className={`ti ${n.type === "success" ? "ti-circle-check" : "ti-alert-triangle"}`} style={{ color: n.type === "success" ? "#1D9E75" : "#BA7517", fontSize: 16 }} aria-hidden="true" />
                    <span style={{ flex: 1, fontSize: 13 }}>{n.message}</span>
                    <button onClick={() => setNotifications(notifications.filter(x => x.id !== n.id))} aria-label="Dismiss" style={{ border: "none", fontSize: 16, padding: "2px 6px", color: "var(--color-text-tertiary)", background: "none", cursor: "pointer" }}>
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#3C3489", flexShrink: 0 }}>
            {currentUser.name.split(" ").map(n => n[0]).join("")}
          </div>
          <button onClick={() => { setCurrentUser(null); setLoginError(""); }} style={{ fontSize: 13, padding: "6px 12px" }}>Logout</button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>

        {activeTab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Monthly income",   value: fmt(totalIncome),  color: "#1D9E75" },
                { label: "Monthly expenses", value: fmt(totalExp),     color: "#D85A30" },
                { label: "Monthly profit",   value: fmt(totalProfit),  color: totalProfit >= 0 ? "#378ADD" : "#E24B4A" },
                { label: "Pending tasks",    value: todos.filter(t => !t.completed).length, color: "#7F77DD" },
              ].map(c => (
                <div key={c.label} style={{ ...S.card, padding: "14px" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>{c.label}</p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: c.color }}>{c.value}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 12 }}>
              <div style={S.card}>
                <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500 }}>Income vs expenses — May</p>
                <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#1D9E75", display: "inline-block" }} />Income</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#D85A30", display: "inline-block" }} />Expenses</span>
                </div>
                <div style={{ height: 170 }}><BarChartCanvas data={barData} /></div>
              </div>
              <div style={S.card}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 500 }}>Cumulative profit — May</p>
                <div style={{ height: 170 }}><LineChartCanvas data={profitLine} /></div>
              </div>
            </div>

            {catData.length > 0 && (
              <div style={{ ...S.card, marginBottom: 12 }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 500 }}>Expenses by category</p>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
                  <DonutChart data={catData} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    {catData.map((c, i) => (
                      <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                        <span style={{ color: "var(--color-text-secondary)", flex: 1 }}>{c.name}</span>
                        <span style={{ fontWeight: 500 }}>{fmt(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Pending tasks</p>
                  <button onClick={() => { setActiveTab("todos"); setShowTodoForm(true); }} style={{ fontSize: 12 }}><i className="ti ti-plus" aria-hidden="true" /> Add</button>
                </div>
                {todos.filter(t => !t.completed).map((t, i, arr) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                    <input type="checkbox" checked={false} onChange={() => setTodos(todos.map(x => x.id === t.id ? { ...x, completed: true } : x))} />
                    <span style={{ flex: 1, fontSize: 13 }}>{t.text}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, background: priorityBg[t.priority], color: priorityText[t.priority] }}>{t.priority}</span>
                  </div>
                ))}
                {todos.filter(t => !t.completed).length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-tertiary)" }}>All caught up!</p>}
              </div>

              <div style={S.card}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 500 }}>All-time summary</p>
                {[
                  { label: "Total income",   value: fmt(allIncome),          color: "#1D9E75" },
                  { label: "Total expenses", value: fmt(allExp),             color: "#D85A30" },
                  { label: "Net profit",     value: fmt(allIncome - allExp), color: "#378ADD" },
                ].map((r, i, arr) => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: i < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", fontSize: 13 }}>
                    <span style={{ color: "var(--color-text-secondary)" }}>{r.label}</span>
                    <span style={{ fontWeight: 500, color: r.color }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "sales" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ fontSize: 13 }} />
              <input type="text" placeholder="Search sales..." value={salesSearch} onChange={e => setSalesSearch(e.target.value)} style={{ flex: 1, minWidth: 140, fontSize: 13 }} />
              <button onClick={() => setShowSalesForm(!showSalesForm)} style={S.purpleBtn}><i className="ti ti-plus" aria-hidden="true" /> Record sale</button>
            </div>
            {showSalesForm && (
              <div style={S.formBox}>
                <input type="date" value={salesForm.date} onChange={e => setSalesForm({ ...salesForm, date: e.target.value })} style={S.fullInput} />
                <input type="text" placeholder="Description (optional)" value={salesForm.description} onChange={e => setSalesForm({ ...salesForm, description: e.target.value })} style={S.fullInput} />
                <input type="number" placeholder="Amount (GH₵)" value={salesForm.amount} onChange={e => setSalesForm({ ...salesForm, amount: e.target.value })} style={S.fullInput} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addSale} style={{ ...S.purpleBtn, flex: 1, padding: "9px" }}>Save</button>
                  <button onClick={() => setShowSalesForm(false)} style={{ padding: "9px 16px" }}>Cancel</button>
                </div>
              </div>
            )}
            <div style={{ ...S.card, padding: 0, overflow: "hidden", marginBottom: 10 }}>
              {filteredSales.length === 0 && <p style={{ padding: 16, color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>No sales found.</p>}
              {filteredSales.map((sale, i) => (
                <div key={sale.id} style={{ ...S.row, borderBottom: i < filteredSales.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{sale.description || "Sale"}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>{new Date(sale.date).toLocaleDateString()}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#1D9E75", whiteSpace: "nowrap" }}>{fmt(sale.amount)}</span>
                  <button onClick={() => setSales(sales.filter(x => x.id !== sale.id))} aria-label="Delete" style={{ color: "#A32D2D", border: "none", background: "none", fontSize: 16, cursor: "pointer", padding: "4px 6px" }}><i className="ti ti-trash" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 16px", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--color-text-secondary)" }}>{filteredSales.length} transactions</span>
              <span style={{ fontWeight: 500, color: "#1D9E75" }}>{fmt(filteredSales.reduce((a, b) => a + b.amount, 0))} total</span>
            </div>
          </div>
        )}

        {activeTab === "expenses" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ fontSize: 13 }} />
              <input type="text" placeholder="Search expenses..." value={expSearch} onChange={e => setExpSearch(e.target.value)} style={{ flex: 1, minWidth: 140, fontSize: 13 }} />
              <button onClick={() => setShowExpForm(!showExpForm)} style={S.redBtn}><i className="ti ti-plus" aria-hidden="true" /> Add expense</button>
            </div>
            {showExpForm && (
              <div style={S.formBox}>
                <input type="date" value={expForm.date} onChange={e => setExpForm({ ...expForm, date: e.target.value })} style={S.fullInput} />
                <select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })} style={S.fullInput}>
                  {["Paper", "Ink & Toner", "Maintenance", "Salaries", "Other"].map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="text" placeholder="Description" value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} style={S.fullInput} />
                <input type="number" placeholder="Amount (GH₵)" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} style={S.fullInput} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addExpense} style={{ ...S.redBtn, flex: 1, padding: "9px" }}>Save</button>
                  <button onClick={() => setShowExpForm(false)} style={{ padding: "9px 16px" }}>Cancel</button>
                </div>
              </div>
            )}
            <div style={{ ...S.card, padding: 0, overflow: "hidden", marginBottom: 10 }}>
              {filteredExp.length === 0 && <p style={{ padding: 16, color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>No expenses found.</p>}
              {filteredExp.map((exp, i) => (
                <div key={exp.id} style={{ ...S.row, borderBottom: i < filteredExp.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: 3 }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#FAEEDA", color: "#854F0B", fontWeight: 500 }}>{exp.category}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13 }}>{exp.description}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>{new Date(exp.date).toLocaleDateString()}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#D85A30", whiteSpace: "nowrap" }}>{fmt(exp.amount)}</span>
                  <button onClick={() => setExpenses(expenses.filter(x => x.id !== exp.id))} aria-label="Delete" style={{ color: "#A32D2D", border: "none", background: "none", fontSize: 16, cursor: "pointer", padding: "4px 6px" }}><i className="ti ti-trash" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 16px", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--color-text-secondary)" }}>{filteredExp.length} transactions</span>
              <span style={{ fontWeight: 500, color: "#D85A30" }}>{fmt(filteredExp.reduce((a, b) => a + b.amount, 0))} total</span>
            </div>
          </div>
        )}

        {activeTab === "todos" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <button onClick={() => setShowTodoForm(!showTodoForm)} style={S.purpleBtn}><i className="ti ti-plus" aria-hidden="true" /> Add task</button>
            </div>
            {showTodoForm && (
              <div style={S.formBox}>
                <input type="text" placeholder="Task description..." value={todoInput}
                  onChange={e => setTodoInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTodo()}
                  style={S.fullInput} autoFocus />
                <select value={todoPriority} onChange={e => setTodoPriority(e.target.value)} style={S.fullInput}>
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addTodo} style={{ ...S.purpleBtn, flex: 1, padding: "9px" }}>Add task</button>
                  <button onClick={() => setShowTodoForm(false)} style={{ padding: "9px 16px" }}>Cancel</button>
                </div>
              </div>
            )}
            {["Pending", "Completed"].map(section => {
              const sectionTodos = todos.filter(t => section === "Pending" ? !t.completed : t.completed);
              return (
                <div key={section} style={{ marginBottom: 16 }}>
                  <p style={S.sectionLbl}>{section} ({sectionTodos.length})</p>
                  <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                    {sectionTodos.length === 0 && (
                      <p style={{ padding: "12px 16px", fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>
                        {section === "Pending" ? "All done!" : "No completed tasks yet."}
                      </p>
                    )}
                    {sectionTodos.map((t, i) => (
                      <div key={t.id} style={{ ...S.row, borderBottom: i < sectionTodos.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", opacity: t.completed ? 0.6 : 1 }}>
                        <input type="checkbox" checked={t.completed} onChange={() => setTodos(todos.map(x => x.id === t.id ? { ...x, completed: !x.completed } : x))} />
                        <span style={{ flex: 1, fontSize: 13, textDecoration: t.completed ? "line-through" : "none" }}>{t.text}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, background: priorityBg[t.priority], color: priorityText[t.priority], whiteSpace: "nowrap" }}>{t.priority}</span>
                        <button onClick={() => setTodos(todos.filter(x => x.id !== t.id))} aria-label="Delete task" style={{ color: "#A32D2D", border: "none", background: "none", fontSize: 16, cursor: "pointer", padding: "4px 6px" }}>
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--color-background-primary)", borderTop: "0.5px solid var(--color-border-tertiary)", display: "flex", zIndex: 100 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0 12px", border: "none", background: "none", cursor: "pointer", color: activeTab === t.id ? "#534AB7" : "var(--color-text-tertiary)", fontSize: 10, fontWeight: activeTab === t.id ? 500 : 400, borderTop: activeTab === t.id ? "2px solid #534AB7" : "2px solid transparent" }}
            aria-current={activeTab === t.id ? "page" : undefined}>
            <i className={`ti ${t.icon}`} style={{ fontSize: 20 }} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
