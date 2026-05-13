import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const COLORS = {
  income: "#1D9E75",
  expense: "#D85A30",
  profit: "#378ADD",
  purple: "#7F77DD",
};

const CAT_COLORS = ["#7F77DD", "#1D9E75", "#D85A30", "#378ADD", "#BA7517"];

const accounts = [
  { id: 1, email: "admin@printshop.com", password: "admin123", name: "Admin User", role: "Admin" },
  { id: 2, email: "user@printshop.com", password: "user123", name: "Standard User", role: "User" },
];

const historicalSales = [
  { id: "s1", date: "2026-05-11", amount: 1350, description: "Banner print" },
  { id: "s2", date: "2026-05-09", amount: 2000, description: "Business cards" },
  { id: "s3", date: "2026-05-08", amount: 1950, description: "Flyers batch" },
  { id: "s4", date: "2026-05-07", amount: 2460, description: "Brochures" },
  { id: "s5", date: "2026-05-06", amount: 700, description: "Stickers" },
  { id: "s6", date: "2026-05-05", amount: 1450, description: "Posters" },
  { id: "s7", date: "2026-05-04", amount: 1930, description: "T-shirt prints" },
  { id: "s8", date: "2026-05-02", amount: 1000, description: "ID cards" },
  { id: "s9", date: "2026-05-01", amount: 2360, description: "Banners" },
  { id: "s10", date: "2026-04-30", amount: 2462, description: "Flex printing" },
];

const historicalExpenses = [
  { id: "e1", date: "2026-05-11", category: "Other", description: "T-shirt", amount: 600 },
  { id: "e2", date: "2026-05-09", category: "Other", description: "Supplies", amount: 950 },
  { id: "e3", date: "2026-05-08", category: "Paper", description: "Paper stock", amount: 1300 },
  { id: "e4", date: "2026-05-02", category: "Other", description: "T-shirt", amount: 850 },
  { id: "e5", date: "2026-05-02", category: "Other", description: "Flexy", amount: 650 },
];

const fmt = (n) =>
  "GH₵" + Number(Math.round(n)).toLocaleString();

const priorityColors = { high: "#E24B4A", medium: "#BA7517", low: "#1D9E75" };
const priorityBg = { high: "#FCEBEB", medium: "#FAEEDA", low: "#EAF3DE" };
const priorityText = { high: "#A32D2D", medium: "#854F0B", low: "#3B6D11" };

export default function PrintingPressSystem() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sales, setSales] = useState(historicalSales);
  const [expenses, setExpenses] = useState(historicalExpenses);
  const [todos, setTodos] = useState([
    { id: 1, text: "Refill ink cartridges", completed: false, priority: "high" },
    { id: 2, text: "Check press efficiency", completed: true, priority: "medium" },
    { id: 3, text: "Order paper stock", completed: false, priority: "high" },
    { id: 4, text: "Invoice TechStart Inc", completed: false, priority: "low" },
  ]);
  const [notifications, setNotifications] = useState([
    { id: 1, type: "success", message: "Payment received from TechStart Inc", read: false },
    { id: 2, type: "warning", message: "Low ink level detected", read: false },
  ]);
  const [showNotif, setShowNotif] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [todoInput, setTodoInput] = useState("");
  const [todoPriority, setTodoPriority] = useState("medium");
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [salesForm, setSalesForm] = useState({ date: "", amount: "", description: "" });
  const [expenseForm, setExpenseForm] = useState({ date: "", category: "Paper", description: "", amount: "" });
  const [salesSearch, setSalesSearch] = useState("");
  const [expSearch, setExpSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("2026-05");

  const handleLogin = () => {
    const user = accounts.find(
      (a) => a.email === loginData.email && a.password === loginData.password
    );
    if (user) {
      setCurrentUser(user);
      setLoginData({ email: "", password: "" });
      setLoginError("");
    } else {
      setLoginError("Invalid email or password.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginError("");
  };

  const currentMonth = "2026-05";

  const monthlySales = useMemo(
    () => sales.filter((s) => s.date.startsWith(currentMonth)),
    [sales, currentMonth]
  );
  const monthlyExpenses = useMemo(
    () => expenses.filter((e) => e.date.startsWith(currentMonth)),
    [expenses, currentMonth]
  );
  const totalIncome = monthlySales.reduce((s, x) => s + x.amount, 0);
  const totalExp = monthlyExpenses.reduce((s, x) => s + x.amount, 0);
  const totalProfit = totalIncome - totalExp;
  const allIncome = sales.reduce((s, x) => s + x.amount, 0);
  const allExp = expenses.reduce((s, x) => s + x.amount, 0);

  const barData = useMemo(() => {
    const days = {};
    sales.filter((s) => s.date.startsWith(currentMonth)).forEach((s) => {
      const d = s.date.slice(8);
      days[d] = (days[d] || 0) + s.amount;
    });
    expenses.filter((e) => e.date.startsWith(currentMonth)).forEach((e) => {
      const d = e.date.slice(8);
      if (!days[d]) days[d] = 0;
    });
    return Object.keys(days)
      .sort()
      .map((d) => ({
        day: parseInt(d),
        income: sales
          .filter((s) => s.date === `${currentMonth}-${d}`)
          .reduce((a, b) => a + b.amount, 0),
        expenses: expenses
          .filter((e) => e.date === `${currentMonth}-${d}`)
          .reduce((a, b) => a + b.amount, 0),
      }));
  }, [sales, expenses, currentMonth]);

  const profitLine = useMemo(() => {
    let running = 0;
    return barData.map((b) => {
      running += b.income - b.expenses;
      return { day: b.day, profit: running };
    });
  }, [barData]);

  const catData = useMemo(() => {
    const cats = {};
    expenses.filter((e) => e.date.startsWith(currentMonth)).forEach((e) => {
      cats[e.category] = (cats[e.category] || 0) + e.amount;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [expenses, currentMonth]);

  const filteredSales = useMemo(
    () =>
      sales
        .filter((s) => s.date.startsWith(filterMonth))
        .filter(
          (s) =>
            !salesSearch ||
            s.description?.toLowerCase().includes(salesSearch.toLowerCase()) ||
            String(s.amount).includes(salesSearch)
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [sales, salesSearch, filterMonth]
  );

  const filteredExp = useMemo(
    () =>
      expenses
        .filter((e) => e.date.startsWith(filterMonth))
        .filter(
          (e) =>
            !expSearch ||
            e.description?.toLowerCase().includes(expSearch.toLowerCase()) ||
            e.category?.toLowerCase().includes(expSearch.toLowerCase()) ||
            String(e.amount).includes(expSearch)
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [expenses, expSearch, filterMonth]
  );

  const addSale = () => {
    if (!salesForm.date || !salesForm.amount) return;
    const newSale = {
      id: `s${Date.now()}`,
      date: salesForm.date,
      amount: parseFloat(salesForm.amount),
      description: salesForm.description,
    };
    setSales([...sales, newSale]);
    setNotifications([
      { id: Date.now(), type: "success", message: `Sale of ${fmt(salesForm.amount)} recorded`, read: false },
      ...notifications,
    ]);
    setSalesForm({ date: "", amount: "", description: "" });
    setShowSalesForm(false);
  };

  const addExpense = () => {
    if (!expenseForm.date || !expenseForm.amount) return;
    const newExp = {
      id: `e${Date.now()}`,
      date: expenseForm.date,
      category: expenseForm.category,
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
    };
    setExpenses([...expenses, newExp]);
    setNotifications([
      { id: Date.now(), type: "info", message: `Expense of ${fmt(expenseForm.amount)} added`, read: false },
      ...notifications,
    ]);
    setExpenseForm({ date: "", category: "Paper", description: "", amount: "" });
    setShowExpenseForm(false);
  };

  const addTodo = () => {
    if (!todoInput.trim()) return;
    setTodos([
      ...todos,
      { id: Date.now(), text: todoInput.trim(), completed: false, priority: todoPriority },
    ]);
    setTodoInput("");
    setTodoPriority("medium");
    setShowTodoForm(false);
    setNotifications([
      { id: Date.now(), type: "success", message: "Task added!", read: false },
      ...notifications,
    ]);
  };

  const unread = notifications.filter((n) => !n.read).length;

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "ti-home" },
    { id: "sales", label: "Sales", icon: "ti-cash" },
    { id: "expenses", label: "Expenses", icon: "ti-receipt" },
    { id: "todos", label: "Tasks", icon: "ti-checkbox" },
  ];

  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "var(--color-background-tertiary)" }}>
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "2rem", width: "100%", maxWidth: 380 }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Financial management</p>
            <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 500 }}>Print shop manager</h1>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <input
              type="email"
              placeholder="Email"
              value={loginData.email}
              onChange={(e) => { setLoginData({ ...loginData, email: e.target.value }); setLoginError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginData.password}
              onChange={(e) => { setLoginData({ ...loginData, password: e.target.value }); setLoginError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            {loginError && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-danger)", background: "var(--color-background-danger)", padding: "8px 12px", borderRadius: "var(--border-radius-md)" }}>{loginError}</p>
            )}
            <button onClick={handleLogin} style={{ width: "100%", background: "#534AB7", color: "#EEEDFE", border: "none", borderRadius: "var(--border-radius-md)", padding: "10px", fontWeight: 500, cursor: "pointer", fontSize: 14 }}>
              Sign in
            </button>
          </div>

          <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "1rem" }}>
            <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: 8 }}>Demo accounts</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setLoginData({ email: "admin@printshop.com", password: "admin123" })} style={{ flex: 1, fontSize: 13 }}>Admin</button>
              <button onClick={() => setLoginData({ email: "user@printshop.com", password: "user123" })} style={{ flex: 1, fontSize: 13 }}>User</button>
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
            <button
              onClick={() => setShowNotif(!showNotif)}
              aria-label="Notifications"
              style={{ position: "relative", fontSize: 18, padding: "6px 10px" }}
            >
              <i className="ti ti-bell" aria-hidden="true" />
              {unread > 0 && (
                <span style={{ position: "absolute", top: 2, right: 2, background: "#E24B4A", color: "#fff", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500 }}>{unread}</span>
              )}
            </button>
            {showNotif && (
              <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 8, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", width: 280, zIndex: 200, overflow: "hidden" }}>
                <p style={{ margin: 0, padding: "10px 14px", fontSize: 13, fontWeight: 500, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>Notifications</p>
                {notifications.length === 0 && <p style={{ padding: "12px 14px", fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>No notifications</p>}
                {notifications.map((n) => (
                  <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <i className={`ti ${n.type === "success" ? "ti-circle-check" : "ti-alert-triangle"}`} style={{ color: n.type === "success" ? "#1D9E75" : "#BA7517", fontSize: 16 }} aria-hidden="true" />
                    <span style={{ flex: 1, fontSize: 13 }}>{n.message}</span>
                    <button onClick={() => setNotifications(notifications.filter((x) => x.id !== n.id))} aria-label="Dismiss" style={{ border: "none", fontSize: 16, padding: "2px 6px", color: "var(--color-text-tertiary)" }}>
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#3C3489" }}>
              {currentUser.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{currentUser.name}</span>
          </div>
          <button onClick={handleLogout} style={{ fontSize: 13, padding: "6px 12px" }}>Logout</button>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "16px" }}>
        {activeTab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Monthly income", value: fmt(totalIncome), color: "#1D9E75" },
                { label: "Monthly expenses", value: fmt(totalExp), color: "#D85A30" },
                { label: "Monthly profit", value: fmt(totalProfit), color: totalProfit >= 0 ? "#378ADD" : "#E24B4A" },
                { label: "Pending tasks", value: todos.filter((t) => !t.completed).length, color: "#7F77DD" },
              ].map((c) => (
                <div key={c.label} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "14px" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>{c.label}</p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 500, color: c.color }}>{c.value}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 500 }}>Income vs expenses — May</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Bar dataKey="income" fill={COLORS.income} radius={[3, 3, 0, 0]} name="Income" />
                    <Bar dataKey="expenses" fill={COLORS.expense} radius={[3, 3, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.income, display: "inline-block" }} />Income</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.expense, display: "inline-block" }} />Expenses</span>
                </div>
              </div>

              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 500 }}>Cumulative profit — May</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={profitLine} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Line type="monotone" dataKey="profit" stroke={COLORS.profit} strokeWidth={2} dot={false} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {catData.length > 0 && (
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px", marginBottom: 12 }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 500 }}>Expenses by category</p>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={catData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                        {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
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
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Pending tasks</p>
                  <button onClick={() => { setActiveTab("todos"); setShowTodoForm(true); }} style={{ fontSize: 12 }}>
                    <i className="ti ti-plus" aria-hidden="true" /> Add
                  </button>
                </div>
                {todos.filter((t) => !t.completed).map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <input type="checkbox" checked={false} onChange={() => { setTodos(todos.map((x) => x.id === t.id ? { ...x, completed: true } : x)); }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{t.text}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, background: priorityBg[t.priority], color: priorityText[t.priority] }}>{t.priority}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "16px" }}>
                <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 500 }}>All-time summary</p>
                {[
                  { label: "Total income", value: fmt(allIncome), color: "#1D9E75" },
                  { label: "Total expenses", value: fmt(allExp), color: "#D85A30" },
                  { label: "Net profit", value: fmt(allIncome - allExp), color: "#378ADD" },
                ].map((r) => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "0.5px solid var(--color-border-tertiary)", fontSize: 13 }}>
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
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                style={{ fontSize: 13 }}
              />
              <input
                type="text"
                placeholder="Search sales..."
                value={salesSearch}
                onChange={(e) => setSalesSearch(e.target.value)}
                style={{ flex: 1, minWidth: 140, fontSize: 13 }}
              />
              <button onClick={() => setShowSalesForm(!showSalesForm)} style={{ background: "#534AB7", color: "#EEEDFE", border: "none", borderRadius: "var(--border-radius-md)", padding: "8px 14px", fontWeight: 500, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>
                <i className="ti ti-plus" aria-hidden="true" /> Record sale
              </button>
            </div>

            {showSalesForm && (
              <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="date" value={salesForm.date} onChange={(e) => setSalesForm({ ...salesForm, date: e.target.value })} style={{ width: "100%", boxSizing: "border-box" }} />
                <input type="text" placeholder="Description (optional)" value={salesForm.description} onChange={(e) => setSalesForm({ ...salesForm, description: e.target.value })} style={{ width: "100%", boxSizing: "border-box" }} />
                <input type="number" placeholder="Amount (GH₵)" value={salesForm.amount} onChange={(e) => setSalesForm({ ...salesForm, amount: e.target.value })} style={{ width: "100%", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addSale} style={{ flex: 1, background: "#534AB7", color: "#EEEDFE", border: "none", borderRadius: "var(--border-radius-md)", padding: "9px", fontWeight: 500, cursor: "pointer" }}>Save</button>
                  <button onClick={() => setShowSalesForm(false)} style={{ padding: "9px 16px" }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: 12 }}>
              {filteredSales.length === 0 && (
                <p style={{ padding: 16, color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>No sales found.</p>
              )}
              {filteredSales.map((s, i) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < filteredSales.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{s.description || "Sale"}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>{new Date(s.date).toLocaleDateString()}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#1D9E75", whiteSpace: "nowrap" }}>{fmt(s.amount)}</span>
                  <button onClick={() => setSales(sales.filter((x) => x.id !== s.id))} aria-label="Delete" style={{ color: "#A32D2D", border: "none", background: "none", fontSize: 16, cursor: "pointer", padding: "4px 6px" }}>
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
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
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                style={{ fontSize: 13 }}
              />
              <input
                type="text"
                placeholder="Search expenses..."
                value={expSearch}
                onChange={(e) => setExpSearch(e.target.value)}
                style={{ flex: 1, minWidth: 140, fontSize: 13 }}
              />
              <button onClick={() => setShowExpenseForm(!showExpenseForm)} style={{ background: "#993C1D", color: "#FAECE7", border: "none", borderRadius: "var(--border-radius-md)", padding: "8px 14px", fontWeight: 500, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>
                <i className="ti ti-plus" aria-hidden="true" /> Add expense
              </button>
            </div>

            {showExpenseForm && (
              <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} style={{ width: "100%", boxSizing: "border-box" }} />
                <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} style={{ width: "100%", boxSizing: "border-box" }}>
                  {["Paper", "Ink & Toner", "Maintenance", "Salaries", "Other"].map((c) => <option key={c}>{c}</option>)}
                </select>
                <input type="text" placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} style={{ width: "100%", boxSizing: "border-box" }} />
                <input type="number" placeholder="Amount (GH₵)" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} style={{ width: "100%", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addExpense} style={{ flex: 1, background: "#993C1D", color: "#FAECE7", border: "none", borderRadius: "var(--border-radius-md)", padding: "9px", fontWeight: 500, cursor: "pointer" }}>Save</button>
                  <button onClick={() => setShowExpenseForm(false)} style={{ padding: "9px 16px" }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden", marginBottom: 12 }}>
              {filteredExp.length === 0 && (
                <p style={{ padding: 16, color: "var(--color-text-secondary)", fontSize: 13, margin: 0 }}>No expenses found.</p>
              )}
              {filteredExp.map((e, i) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < filteredExp.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#FAEEDA", color: "#854F0B", fontWeight: 500 }}>{e.category}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13 }}>{e.description}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>{new Date(e.date).toLocaleDateString()}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#D85A30", whiteSpace: "nowrap" }}>{fmt(e.amount)}</span>
                  <button onClick={() => setExpenses(expenses.filter((x) => x.id !== e.id))} aria-label="Delete" style={{ color: "#A32D2D", border: "none", background: "none", fontSize: 16, cursor: "pointer", padding: "4px 6px" }}>
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
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
              <button onClick={() => setShowTodoForm(!showTodoForm)} style={{ background: "#534AB7", color: "#EEEDFE", border: "none", borderRadius: "var(--border-radius-md)", padding: "8px 14px", fontWeight: 500, cursor: "pointer", fontSize: 13 }}>
                <i className="ti ti-plus" aria-hidden="true" /> Add task
              </button>
            </div>

            {showTodoForm && (
              <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", padding: 16, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Task description..."
                  value={todoInput}
                  onChange={(e) => setTodoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo()}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  autoFocus
                />
                <select value={todoPriority} onChange={(e) => setTodoPriority(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}>
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addTodo} style={{ flex: 1, background: "#534AB7", color: "#EEEDFE", border: "none", borderRadius: "var(--border-radius-md)", padding: "9px", fontWeight: 500, cursor: "pointer" }}>Add task</button>
                  <button onClick={() => setShowTodoForm(false)} style={{ padding: "9px 16px" }}>Cancel</button>
                </div>
              </div>
            )}

            {["Pending", "Completed"].map((section) => {
              const sectionTodos = todos.filter((t) => (section === "Pending" ? !t.completed : t.completed));
              return (
                <div key={section} style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>
                    {section} ({sectionTodos.length})
                  </p>
                  <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
                    {sectionTodos.length === 0 && (
                      <p style={{ padding: "12px 16px", fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>
                        {section === "Pending" ? "All done!" : "No completed tasks yet."}
                      </p>
                    )}
                    {sectionTodos.map((t, i) => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < sectionTodos.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", opacity: t.completed ? 0.6 : 1 }}>
                        <input type="checkbox" checked={t.completed} onChange={() => setTodos(todos.map((x) => x.id === t.id ? { ...x, completed: !x.completed } : x))} />
                        <span style={{ flex: 1, fontSize: 13, textDecoration: t.completed ? "line-through" : "none" }}>{t.text}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, background: priorityBg[t.priority], color: priorityText[t.priority], whiteSpace: "nowrap" }}>{t.priority}</span>
                        <button onClick={() => setTodos(todos.filter((x) => x.id !== t.id))} aria-label="Delete task" style={{ color: "#A32D2D", border: "none", background: "none", fontSize: 16, cursor: "pointer", padding: "4px 6px" }}>
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
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0 12px", border: "none", background: "none", cursor: "pointer", color: activeTab === t.id ? "#534AB7" : "var(--color-text-tertiary)", fontSize: 10, fontWeight: activeTab === t.id ? 500 : 400, borderTop: activeTab === t.id ? "2px solid #534AB7" : "2px solid transparent" }}
            aria-current={activeTab === t.id ? "page" : undefined}
          >
            <i className={`ti ${t.icon}`} style={{ fontSize: 20 }} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
