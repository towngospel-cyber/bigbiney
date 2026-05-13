import { useState, useMemo, useEffect, useRef } from "react";

/* ─── Design tokens ─────────────────────────────────────────── */
const T = {
  teal:      "#1D9E75",
  tealLight: "#E1F5EE",
  tealDark:  "#085041",
  coral:     "#D85A30",
  coralLight:"#FAECE7",
  coralDark: "#993C1D",
  blue:      "#378ADD",
  blueLight: "#E6F1FB",
  purple:    "#534AB7",
  purpleLight:"#EEEDFE",
  purpleDark: "#3C3489",
  amber:     "#BA7517",
  amberLight:"#FAEEDA",
  red:       "#E24B4A",
  redLight:  "#FCEBEB",
  redDark:   "#A32D2D",
  green:     "#3B6D11",
  greenLight:"#EAF3DE",
};

const CAT_COLORS   = [T.purple, T.teal, T.coral, T.blue, T.amber];
const priorityMap  = {
  high:   { bg: T.redLight,   text: T.redDark,   label: "High" },
  medium: { bg: T.amberLight, text: T.amber,      label: "Med" },
  low:    { bg: T.greenLight, text: T.green,      label: "Low" },
};

const fmt     = (n) => "GH₵" + Number(Math.round(n)).toLocaleString();
const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/* ─── Seed data ─────────────────────────────────────────────── */
const accounts = [
  { id: 1, email: "admin@printshop.com", password: "admin123", name: "Admin User",    initials: "AU" },
  { id: 2, email: "user@printshop.com",  password: "user123",  name: "Standard User", initials: "SU" },
];

const historicalSales = [
  { id:"s1",  date:"2026-05-11", amount:1350, description:"Banner print" },
  { id:"s2",  date:"2026-05-09", amount:2000, description:"Business cards" },
  { id:"s3",  date:"2026-05-08", amount:1950, description:"Flyers batch" },
  { id:"s4",  date:"2026-05-07", amount:2460, description:"Brochures" },
  { id:"s5",  date:"2026-05-06", amount: 700, description:"Stickers" },
  { id:"s6",  date:"2026-05-05", amount:1450, description:"Posters" },
  { id:"s7",  date:"2026-05-04", amount:1930, description:"T-shirt prints" },
  { id:"s8",  date:"2026-05-02", amount:1000, description:"ID cards" },
  { id:"s9",  date:"2026-05-01", amount:2360, description:"Banners" },
  { id:"s10", date:"2026-04-30", amount:2462, description:"Flex printing" },
];

const historicalExpenses = [
  { id:"e1", date:"2026-05-11", category:"Other", description:"T-shirt",    amount: 600 },
  { id:"e2", date:"2026-05-09", category:"Other", description:"Supplies",   amount: 950 },
  { id:"e3", date:"2026-05-08", category:"Paper", description:"Paper stock",amount:1300 },
  { id:"e4", date:"2026-05-02", category:"Other", description:"T-shirt",    amount: 850 },
  { id:"e5", date:"2026-05-02", category:"Other", description:"Flexy",      amount: 650 },
];

/* ─── Canvas charts ──────────────────────────────────────────── */
function useCanvas(draw, deps) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      draw(ctx, canvas.offsetWidth, canvas.offsetHeight);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

function BarChartCanvas({ data }) {
  const isDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const ref = useCanvas((ctx, W, H) => {
    if (!data.length) return;
    const dark = isDark();
    const pad  = { t:12, r:8, b:26, l:46 };
    const iW   = W - pad.l - pad.r, iH = H - pad.t - pad.b;
    const maxV = Math.max(...data.flatMap(d => [d.income, d.expenses]), 1);
    const gridC = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
    const textC = dark ? "#666" : "#aaa";

    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i <= 4; i++) {
      const y = pad.t + iH - (i / 4) * iH;
      ctx.strokeStyle = gridC; ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + iW, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = textC; ctx.font = "10px system-ui"; ctx.textAlign = "right";
      ctx.fillText(fmt((i / 4) * maxV).replace("GH₵",""), pad.l - 5, y + 3.5);
    }

    const gW = iW / data.length;
    const bW = Math.min(14, Math.max(5, gW * 0.3));

    data.forEach((d, i) => {
      const cx = pad.l + i * gW + gW / 2;
      [[d.income, -bW * 0.7, T.teal, T.tealLight], [d.expenses, bW * 0.7, T.coral, T.coralLight]].forEach(([val, ox, color]) => {
        if (!val) return;
        const bh = (val / maxV) * iH;
        const bx = cx + ox - bW / 2, by = pad.t + iH - bh;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bW, bh, [3,3,0,0]);
        else ctx.rect(bx, by, bW, bh);
        ctx.fill();
      });
      ctx.fillStyle = textC; ctx.font = "9px system-ui"; ctx.textAlign = "center";
      ctx.fillText(d.day, cx, H - 6);
    });
  }, [data]);

  return <canvas ref={ref} style={{ width:"100%", height:"100%", display:"block" }} />;
}

function LineChartCanvas({ data }) {
  const isDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const ref = useCanvas((ctx, W, H) => {
    if (!data.length) return;
    const dark = isDark();
    const pad  = { t:12, r:8, b:26, l:46 };
    const iW   = W - pad.l - pad.r, iH = H - pad.t - pad.b;
    const vals = data.map(d => d.profit);
    const minV = Math.min(...vals, 0), maxV = Math.max(...vals, 1);
    const rng  = maxV - minV || 1;
    const gridC = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
    const textC = dark ? "#666" : "#aaa";

    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i <= 4; i++) {
      const y = pad.t + iH - (i / 4) * iH;
      ctx.strokeStyle = gridC; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + iW, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = textC; ctx.font = "10px system-ui"; ctx.textAlign = "right";
      ctx.fillText(fmt(minV + (i/4)*rng).replace("GH₵",""), pad.l - 5, y + 3.5);
    }

    const toX = i => pad.l + (i / Math.max(data.length - 1, 1)) * iW;
    const toY = v => pad.t + iH - ((v - minV) / rng) * iH;

    /* fill area */
    ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(toX(i), toY(d.profit)) : ctx.lineTo(toX(i), toY(d.profit)));
    ctx.lineTo(toX(data.length-1), pad.t + iH);
    ctx.lineTo(toX(0), pad.t + iH);
    ctx.closePath();
    ctx.fillStyle = dark ? "rgba(55,138,221,.12)" : "rgba(55,138,221,.08)";
    ctx.fill();

    /* line */
    ctx.strokeStyle = T.blue; ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(toX(i), toY(d.profit)) : ctx.lineTo(toX(i), toY(d.profit)));
    ctx.stroke();

    /* dots */
    data.forEach((d, i) => {
      ctx.beginPath(); ctx.arc(toX(i), toY(d.profit), 3, 0, Math.PI*2);
      ctx.fillStyle = T.blue; ctx.fill();
      ctx.fillStyle = textC; ctx.font = "9px system-ui"; ctx.textAlign = "center";
      ctx.fillText(d.day, toX(i), H - 6);
    });
  }, [data]);

  return <canvas ref={ref} style={{ width:"100%", height:"100%", display:"block" }} />;
}

function DonutChart({ data }) {
  const isDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const ref = useCanvas((ctx, W, H) => {
    if (!data.length) return;
    const dark   = isDark();
    const cx = W/2, cy = H/2, r = Math.min(W,H)*0.4, ri = r*0.55;
    const total  = data.reduce((a,b) => a+b.value, 0);
    let angle    = -Math.PI/2;

    ctx.clearRect(0, 0, W, H);
    data.forEach((d, i) => {
      const slice = (d.value / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath(); ctx.fillStyle = CAT_COLORS[i % CAT_COLORS.length]; ctx.fill();
      angle += slice;
    });

    ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI*2);
    ctx.fillStyle = dark ? "#111" : "#fff"; ctx.fill();

    const pct = data.length === 1 ? "100%" : "";
    if (pct) {
      ctx.fillStyle = dark ? "#eee" : "#333";
      ctx.font = "bold 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(pct, cx, cy);
    }
  }, [data]);

  return <canvas ref={ref} style={{ width:120, height:120, display:"block", flexShrink:0 }} />;
}

/* ─── Shared micro-components ────────────────────────────────── */
function Badge({ children, bg, color }) {
  return (
    <span style={{ fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:99, background:bg, color, whiteSpace:"nowrap", letterSpacing:0.2 }}>
      {children}
    </span>
  );
}

function IconBox({ icon, color, bg }) {
  return (
    <div style={{ width:36, height:36, borderRadius:10, background:bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <i className={`ti ${icon}`} style={{ fontSize:18, color }} aria-hidden="true" />
    </div>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
      <h2 style={{ margin:0, fontSize:15, fontWeight:500 }}>{title}</h2>
      {action}
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ padding:"28px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, color:"var(--color-text-tertiary)" }}>
      <i className={`ti ${icon}`} style={{ fontSize:28 }} aria-hidden="true" />
      <span style={{ fontSize:13 }}>{text}</span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function PrintingPressSystem() {
  const [currentUser,   setCurrentUser]   = useState(null);
  const [loginData,     setLoginData]     = useState({ email:"", password:"" });
  const [loginError,    setLoginError]    = useState("");
  const [showPass,      setShowPass]      = useState(false);
  const [activeTab,     setActiveTab]     = useState("dashboard");
  const [sales,         setSales]         = useState(historicalSales);
  const [expenses,      setExpenses]      = useState(historicalExpenses);
  const [todos,         setTodos]         = useState([
    { id:1, text:"Refill ink cartridges", completed:false, priority:"high" },
    { id:2, text:"Check press efficiency",completed:true,  priority:"medium" },
    { id:3, text:"Order paper stock",     completed:false, priority:"high" },
    { id:4, text:"Invoice TechStart Inc", completed:false, priority:"low" },
  ]);
  const [notifications, setNotifications] = useState([
    { id:1, type:"success", message:"Payment received from TechStart Inc" },
    { id:2, type:"warning", message:"Low ink level detected" },
  ]);
  const [showNotif,     setShowNotif]     = useState(false);
  const [showTodoForm,  setShowTodoForm]  = useState(false);
  const [todoInput,     setTodoInput]     = useState("");
  const [todoPriority,  setTodoPriority]  = useState("medium");
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [showExpForm,   setShowExpForm]   = useState(false);
  const [salesForm,     setSalesForm]     = useState({ date:"", amount:"", description:"" });
  const [expForm,       setExpForm]       = useState({ date:"", category:"Paper", description:"", amount:"" });
  const [salesSearch,   setSalesSearch]   = useState("");
  const [expSearch,     setExpSearch]     = useState("");
  const [filterMonth,   setFilterMonth]   = useState("2026-05");

  const CM = "2026-05";
  const monthlySales    = useMemo(() => sales.filter(s => s.date.startsWith(CM)),    [sales]);
  const monthlyExpenses = useMemo(() => expenses.filter(e => e.date.startsWith(CM)), [expenses]);
  const totalIncome  = monthlySales.reduce((s,x) => s+x.amount, 0);
  const totalExp     = monthlyExpenses.reduce((s,x) => s+x.amount, 0);
  const totalProfit  = totalIncome - totalExp;
  const allIncome    = sales.reduce((s,x) => s+x.amount, 0);
  const allExp       = expenses.reduce((s,x) => s+x.amount, 0);

  const barData = useMemo(() => {
    const days = {};
    [...sales,...expenses].filter(x => x.date.startsWith(CM)).forEach(x => { days[x.date.slice(8)] = true; });
    return Object.keys(days).sort().map(d => ({
      day: parseInt(d),
      income:   sales.filter(s => s.date===`${CM}-${d}`).reduce((a,b)=>a+b.amount,0),
      expenses: expenses.filter(e => e.date===`${CM}-${d}`).reduce((a,b)=>a+b.amount,0),
    }));
  }, [sales, expenses]);

  const profitLine = useMemo(() => {
    let r = 0;
    return barData.map(b => { r += b.income - b.expenses; return { day:b.day, profit:r }; });
  }, [barData]);

  const catData = useMemo(() => {
    const cats = {};
    monthlyExpenses.forEach(e => { cats[e.category] = (cats[e.category]||0) + e.amount; });
    return Object.entries(cats).map(([name,value]) => ({ name, value }));
  }, [monthlyExpenses]);

  const filteredSales = useMemo(() =>
    sales.filter(s => s.date.startsWith(filterMonth))
      .filter(s => !salesSearch || s.description?.toLowerCase().includes(salesSearch.toLowerCase()) || String(s.amount).includes(salesSearch))
      .sort((a,b) => new Date(b.date)-new Date(a.date)),
    [sales, salesSearch, filterMonth]);

  const filteredExp = useMemo(() =>
    expenses.filter(e => e.date.startsWith(filterMonth))
      .filter(e => !expSearch ||
        e.description?.toLowerCase().includes(expSearch.toLowerCase()) ||
        e.category?.toLowerCase().includes(expSearch.toLowerCase()) ||
        String(e.amount).includes(expSearch))
      .sort((a,b) => new Date(b.date)-new Date(a.date)),
    [expenses, expSearch, filterMonth]);

  const handleLogin = () => {
    const user = accounts.find(a => a.email===loginData.email && a.password===loginData.password);
    if (user) { setCurrentUser(user); setLoginData({email:"",password:""}); setLoginError(""); }
    else setLoginError("Invalid email or password.");
  };

  const notify = (type, message) => setNotifications(n => [{ id:Date.now(), type, message }, ...n]);

  const addSale = () => {
    if (!salesForm.date || !salesForm.amount) return;
    setSales(s => [...s, { id:`s${Date.now()}`, date:salesForm.date, amount:parseFloat(salesForm.amount), description:salesForm.description }]);
    notify("success", `Sale of ${fmt(salesForm.amount)} recorded`);
    setSalesForm({ date:"", amount:"", description:"" }); setShowSalesForm(false);
  };

  const addExpense = () => {
    if (!expForm.date || !expForm.amount) return;
    setExpenses(e => [...e, { id:`e${Date.now()}`, date:expForm.date, category:expForm.category, description:expForm.description, amount:parseFloat(expForm.amount) }]);
    notify("info", `Expense of ${fmt(expForm.amount)} added`);
    setExpForm({ date:"", category:"Paper", description:"", amount:"" }); setShowExpForm(false);
  };

  const addTodo = () => {
    if (!todoInput.trim()) return;
    setTodos(t => [...t, { id:Date.now(), text:todoInput.trim(), completed:false, priority:todoPriority }]);
    notify("success", "Task added!");
    setTodoInput(""); setTodoPriority("medium"); setShowTodoForm(false);
  };

  const unread = notifications.length;

  const tabs = [
    { id:"dashboard", label:"Dashboard", icon:"ti-home" },
    { id:"sales",     label:"Sales",     icon:"ti-cash" },
    { id:"expenses",  label:"Expenses",  icon:"ti-receipt" },
    { id:"todos",     label:"Tasks",     icon:"ti-checkbox" },
  ];

  /* Shared style snippets */
  const card   = { background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", overflow:"hidden" };
  const fi     = { width:"100%", boxSizing:"border-box", fontSize:14 };
  const row    = { display:"flex", alignItems:"center", gap:12, padding:"13px 16px" };

  const PrimaryBtn = ({ children, onClick, style={} }) => (
    <button onClick={onClick} style={{ background:T.purple, color:T.purpleLight, border:"none", borderRadius:8, padding:"9px 16px", fontWeight:500, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6, ...style }}>
      {children}
    </button>
  );

  const FormBox = ({ children }) => (
    <div style={{ background:"var(--color-background-secondary)", border:`1px solid ${T.purple}33`, borderRadius:12, padding:18, marginBottom:16, display:"flex", flexDirection:"column", gap:12 }}>
      {children}
    </div>
  );

  /* ── LOGIN ── */
  if (!currentUser) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"stretch", background:"var(--color-background-tertiary)" }}>
        {/* Left brand panel — collapses on mobile */}
        <div style={{ flex:1, background:T.purple, display:"flex", flexDirection:"column", justifyContent:"center", padding:"3rem", minWidth:0 }}>
          <div style={{ maxWidth:320 }}>
            <div style={{ width:52, height:52, background:"rgba(255,255,255,.15)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:24 }}>
              <i className="ti ti-printer" style={{ fontSize:28, color:"#fff" }} aria-hidden="true" />
            </div>
            <h1 style={{ color:"#fff", fontSize:28, fontWeight:500, margin:"0 0 10px", lineHeight:1.2 }}>Print shop<br/>manager</h1>
            <p style={{ color:"rgba(255,255,255,.6)", fontSize:14, margin:0, lineHeight:1.6 }}>Track sales, expenses and tasks for your print business — all in one place.</p>
            <div style={{ marginTop:36, display:"flex", flexDirection:"column", gap:12 }}>
              {[
                { icon:"ti-chart-bar", text:"Real-time financial overview" },
                { icon:"ti-file-invoice", text:"Sales & expense tracking" },
                { icon:"ti-checkbox",    text:"Task management with priorities" },
              ].map(f => (
                <div key={f.text} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <i className={`ti ${f.icon}`} style={{ fontSize:16, color:"rgba(255,255,255,.7)" }} aria-hidden="true" />
                  <span style={{ color:"rgba(255,255,255,.7)", fontSize:13 }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right login panel */}
        <div style={{ width:"100%", maxWidth:420, display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem", background:"var(--color-background-primary)" }}>
          <div style={{ width:"100%" }}>
            <p style={{ margin:"0 0 4px", fontSize:13, color:"var(--color-text-secondary)" }}>Welcome back</p>
            <h2 style={{ margin:"0 0 28px", fontSize:22, fontWeight:500 }}>Sign in to your account</h2>

            <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:20 }}>
              <div>
                <label style={{ display:"block", fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:6, textTransform:"uppercase", letterSpacing:0.4 }}>Email</label>
                <input type="email" placeholder="admin@printshop.com" value={loginData.email}
                  onChange={e => { setLoginData({...loginData, email:e.target.value}); setLoginError(""); }}
                  onKeyDown={e => e.key==="Enter" && handleLogin()}
                  style={{ ...fi }} />
              </div>
              <div>
                <label style={{ display:"block", fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:6, textTransform:"uppercase", letterSpacing:0.4 }}>Password</label>
                <div style={{ position:"relative" }}>
                  <input type={showPass?"text":"password"} placeholder="••••••••" value={loginData.password}
                    onChange={e => { setLoginData({...loginData, password:e.target.value}); setLoginError(""); }}
                    onKeyDown={e => e.key==="Enter" && handleLogin()}
                    style={{ ...fi, paddingRight:38 }} />
                  <button onClick={() => setShowPass(!showPass)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--color-text-secondary)", padding:0, fontSize:16 }} aria-label={showPass?"Hide password":"Show password"}>
                    <i className={`ti ${showPass?"ti-eye-off":"ti-eye"}`} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {loginError && (
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:T.redLight, borderRadius:8, border:`0.5px solid ${T.red}40` }}>
                  <i className="ti ti-alert-circle" style={{ color:T.red, fontSize:16, flexShrink:0 }} aria-hidden="true" />
                  <span style={{ fontSize:13, color:T.redDark }}>{loginError}</span>
                </div>
              )}

              <button onClick={handleLogin} style={{ background:T.purple, color:T.purpleLight, border:"none", borderRadius:10, padding:"12px", fontWeight:500, cursor:"pointer", fontSize:14, width:"100%", marginTop:4 }}>
                Sign in
              </button>
            </div>

            <div style={{ borderTop:"0.5px solid var(--color-border-tertiary)", paddingTop:20 }}>
              <p style={{ fontSize:12, color:"var(--color-text-tertiary)", margin:"0 0 10px", textTransform:"uppercase", letterSpacing:0.4 }}>Demo accounts</p>
              <div style={{ display:"flex", gap:8 }}>
                {[["Admin","admin@printshop.com","admin123"],["User","user@printshop.com","user123"]].map(([label,email,password]) => (
                  <button key={label} onClick={() => { setLoginData({email,password}); setLoginError(""); }}
                    style={{ flex:1, fontSize:13, padding:"8px", borderRadius:8 }}>
                    <i className="ti ti-user" style={{ marginRight:6 }} aria-hidden="true" />{label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── APP SHELL ── */
  return (
    <div style={{ minHeight:"100vh", background:"var(--color-background-tertiary)", paddingBottom:72 }}>

      {/* Header */}
      <header style={{ background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", padding:"0 16px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:T.purple, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <i className="ti ti-printer" style={{ fontSize:16, color:"#fff" }} aria-hidden="true" />
          </div>
          <div>
            <p style={{ margin:0, fontSize:13, fontWeight:500, lineHeight:1 }}>Print shop</p>
            <p style={{ margin:0, fontSize:11, color:"var(--color-text-tertiary)", lineHeight:1.4 }}>Manager</p>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* Notification bell */}
          <div style={{ position:"relative" }}>
            <button onClick={() => setShowNotif(!showNotif)} aria-label="Notifications"
              style={{ width:36, height:36, borderRadius:8, background:"var(--color-background-secondary)", border:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", position:"relative" }}>
              <i className="ti ti-bell" style={{ fontSize:18 }} aria-hidden="true" />
              {unread > 0 && (
                <span style={{ position:"absolute", top:-3, right:-3, background:T.red, color:"#fff", borderRadius:99, minWidth:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:500, padding:"0 4px" }}>{unread}</span>
              )}
            </button>

            {showNotif && (
              <div style={{ position:"absolute", right:0, top:"calc(100% + 8px)", background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:12, width:300, zIndex:300, overflow:"hidden" }}>
                <div style={{ padding:"12px 16px", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>Notifications</span>
                  {notifications.length > 0 && (
                    <button onClick={() => setNotifications([])} style={{ fontSize:11, color:T.purple, background:"none", border:"none", cursor:"pointer", fontWeight:500 }}>Clear all</button>
                  )}
                </div>
                {notifications.length === 0 && (
                  <div style={{ padding:"20px 16px", textAlign:"center", color:"var(--color-text-tertiary)", fontSize:13 }}>
                    <i className="ti ti-bell-off" style={{ fontSize:22, display:"block", marginBottom:6 }} aria-hidden="true" />No notifications
                  </div>
                )}
                {notifications.slice(0,5).map(n => (
                  <div key={n.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"11px 16px", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:n.type==="success"?T.tealLight:T.amberLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                      <i className={`ti ${n.type==="success"?"ti-circle-check":"ti-alert-triangle"}`} style={{ fontSize:14, color:n.type==="success"?T.teal:T.amber }} aria-hidden="true" />
                    </div>
                    <span style={{ flex:1, fontSize:13, lineHeight:1.4 }}>{n.message}</span>
                    <button onClick={() => setNotifications(prev => prev.filter(x=>x.id!==n.id))} aria-label="Dismiss"
                      style={{ background:"none", border:"none", cursor:"pointer", color:"var(--color-text-tertiary)", padding:"2px", fontSize:14, flexShrink:0 }}>
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Avatar */}
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"0 6px" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:T.purpleLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:500, color:T.purpleDark }}>
              {currentUser.initials}
            </div>
            <span style={{ fontSize:13, color:"var(--color-text-secondary)" }}>{currentUser.name.split(" ")[0]}</span>
          </div>

          <button onClick={() => setCurrentUser(null)} style={{ fontSize:13, padding:"6px 12px", borderRadius:8 }}>
            <i className="ti ti-logout" style={{ marginRight:4 }} aria-hidden="true" />Logout
          </button>
        </div>
      </header>

      {/* Page content */}
      <main style={{ maxWidth:920, margin:"0 auto", padding:"20px 16px" }}>

        {/* ── DASHBOARD ── */}
        {activeTab === "dashboard" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Stat cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:10 }}>
              {[
                { label:"Monthly income",   value:fmt(totalIncome),  color:T.teal,   bg:T.tealLight,   icon:"ti-trending-up",    border:T.teal },
                { label:"Monthly expenses", value:fmt(totalExp),     color:T.coral,  bg:T.coralLight,  icon:"ti-trending-down",  border:T.coral },
                { label:"Net profit",       value:fmt(totalProfit),  color:totalProfit>=0?T.blue:T.red, bg:totalProfit>=0?T.blueLight:T.redLight, icon:"ti-cash", border:totalProfit>=0?T.blue:T.red },
                { label:"Pending tasks",    value:todos.filter(t=>!t.completed).length, color:T.purple, bg:T.purpleLight, icon:"ti-checkbox", border:T.purple },
              ].map(c => (
                <div key={c.label} style={{ ...card, borderLeft:`3px solid ${c.border}`, padding:"14px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <p style={{ margin:"0 0 8px", fontSize:11, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:0.5, fontWeight:500 }}>{c.label}</p>
                      <p style={{ margin:0, fontSize:22, fontWeight:500, color:c.color }}>{c.value}</p>
                    </div>
                    <div style={{ width:34, height:34, borderRadius:8, background:c.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <i className={`ti ${c.icon}`} style={{ fontSize:17, color:c.color }} aria-hidden="true" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:12 }}>
              <div style={{ ...card, padding:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:500 }}>Income vs expenses</p>
                  <div style={{ display:"flex", gap:10, fontSize:11, color:"var(--color-text-secondary)" }}>
                    <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:T.teal, display:"inline-block" }}/>Income</span>
                    <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8, height:8, borderRadius:2, background:T.coral, display:"inline-block" }}/>Expenses</span>
                  </div>
                </div>
                <div style={{ height:160 }}><BarChartCanvas data={barData} /></div>
              </div>

              <div style={{ ...card, padding:16 }}>
                <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:500 }}>Cumulative profit</p>
                <div style={{ height:160 }}><LineChartCanvas data={profitLine} /></div>
              </div>
            </div>

            {/* Expense breakdown */}
            {catData.length > 0 && (
              <div style={{ ...card, padding:16 }}>
                <p style={{ margin:"0 0 14px", fontSize:13, fontWeight:500 }}>Expenses by category — May</p>
                <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:20 }}>
                  <DonutChart data={catData} />
                  <div style={{ flex:1, minWidth:140, display:"flex", flexDirection:"column", gap:10 }}>
                    {catData.map((c, i) => {
                      const total = catData.reduce((a,b)=>a+b.value,0);
                      const pct   = Math.round((c.value/total)*100);
                      return (
                        <div key={c.name}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4, fontSize:12 }}>
                            <span style={{ display:"flex", alignItems:"center", gap:6, color:"var(--color-text-secondary)" }}>
                              <span style={{ width:8, height:8, borderRadius:2, background:CAT_COLORS[i%CAT_COLORS.length], display:"inline-block" }}/>
                              {c.name}
                            </span>
                            <span style={{ fontWeight:500 }}>{fmt(c.value)} <span style={{ color:"var(--color-text-tertiary)", fontWeight:400 }}>·{pct}%</span></span>
                          </div>
                          <div style={{ height:4, borderRadius:99, background:"var(--color-background-secondary)", overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${pct}%`, background:CAT_COLORS[i%CAT_COLORS.length], borderRadius:99 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom 2-col */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:12 }}>

              {/* Pending tasks widget */}
              <div style={card}>
                <div style={{ padding:"14px 16px", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>Pending tasks</span>
                  <button onClick={() => { setActiveTab("todos"); setShowTodoForm(true); }}
                    style={{ fontSize:12, display:"flex", alignItems:"center", gap:4, color:T.purple, background:"none", border:"none", cursor:"pointer", fontWeight:500 }}>
                    <i className="ti ti-plus" aria-hidden="true" />Add
                  </button>
                </div>
                {todos.filter(t=>!t.completed).length === 0
                  ? <EmptyState icon="ti-circle-check" text="All caught up!" />
                  : todos.filter(t=>!t.completed).map((t,i,arr) => (
                    <div key={t.id} style={{ ...row, borderBottom:i<arr.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}>
                      <input type="checkbox" checked={false} onChange={() => setTodos(todos.map(x=>x.id===t.id?{...x,completed:true}:x))} style={{ accentColor:T.purple, width:16, height:16, flexShrink:0 }} />
                      <span style={{ flex:1, fontSize:13 }}>{t.text}</span>
                      <Badge bg={priorityMap[t.priority].bg} color={priorityMap[t.priority].text}>{priorityMap[t.priority].label}</Badge>
                    </div>
                  ))
                }
              </div>

              {/* All-time summary */}
              <div style={{ ...card, padding:16 }}>
                <p style={{ margin:"0 0 14px", fontSize:13, fontWeight:500 }}>All-time summary</p>
                {[
                  { label:"Total income",   icon:"ti-arrow-up-circle",   value:fmt(allIncome),          color:T.teal },
                  { label:"Total expenses", icon:"ti-arrow-down-circle",  value:fmt(allExp),             color:T.coral },
                  { label:"Net profit",     icon:"ti-coin",               value:fmt(allIncome-allExp),   color:T.blue },
                ].map((r,i,arr) => (
                  <div key={r.label} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:i<arr.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:"var(--color-background-secondary)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <i className={`ti ${r.icon}`} style={{ fontSize:16, color:r.color }} aria-hidden="true" />
                    </div>
                    <span style={{ flex:1, fontSize:13, color:"var(--color-text-secondary)" }}>{r.label}</span>
                    <span style={{ fontSize:14, fontWeight:500, color:r.color }}>{r.value}</span>
                  </div>
                ))}

                {/* Progress bar: profit margin */}
                <div style={{ marginTop:16, padding:"12px", background:"var(--color-background-secondary)", borderRadius:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                    <span style={{ color:"var(--color-text-secondary)" }}>Profit margin</span>
                    <span style={{ fontWeight:500 }}>{allIncome>0?Math.round(((allIncome-allExp)/allIncome)*100):0}%</span>
                  </div>
                  <div style={{ height:6, borderRadius:99, background:"var(--color-border-tertiary)" }}>
                    <div style={{ height:"100%", borderRadius:99, background:T.blue, width:`${allIncome>0?Math.min(100,Math.max(0,Math.round(((allIncome-allExp)/allIncome)*100))):0}%`, transition:"width .4s" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SALES ── */}
        {activeTab === "sales" && (
          <div>
            <SectionHeader title="Sales"
              action={<PrimaryBtn onClick={() => setShowSalesForm(!showSalesForm)}><i className="ti ti-plus" aria-hidden="true" />Record sale</PrimaryBtn>}
            />

            {showSalesForm && (
              <FormBox>
                <p style={{ margin:"0 0 2px", fontSize:13, fontWeight:500 }}>New sale</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <label style={{ fontSize:12, color:"var(--color-text-secondary)", display:"block", marginBottom:4 }}>Date</label>
                    <input type="date" value={salesForm.date} onChange={e=>setSalesForm({...salesForm,date:e.target.value})} style={fi} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:"var(--color-text-secondary)", display:"block", marginBottom:4 }}>Amount (GH₵)</label>
                    <input type="number" placeholder="0" value={salesForm.amount} onChange={e=>setSalesForm({...salesForm,amount:e.target.value})} style={fi} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:12, color:"var(--color-text-secondary)", display:"block", marginBottom:4 }}>Description</label>
                  <input type="text" placeholder="e.g. Business cards — Acme Ltd" value={salesForm.description} onChange={e=>setSalesForm({...salesForm,description:e.target.value})} style={fi} />
                </div>
                <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                  <button onClick={()=>setShowSalesForm(false)} style={{ padding:"8px 16px", borderRadius:8 }}>Cancel</button>
                  <PrimaryBtn onClick={addSale}>Save sale</PrimaryBtn>
                </div>
              </FormBox>
            )}

            {/* Filters */}
            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              <div style={{ position:"relative", flex:1, minWidth:160 }}>
                <i className="ti ti-search" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:15, color:"var(--color-text-tertiary)" }} aria-hidden="true" />
                <input type="text" placeholder="Search sales…" value={salesSearch} onChange={e=>setSalesSearch(e.target.value)} style={{ ...fi, paddingLeft:34 }} />
              </div>
              <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{ fontSize:13 }} />
            </div>

            <div style={card}>
              {filteredSales.length===0 ? <EmptyState icon="ti-cash" text="No sales found for this period." /> :
                filteredSales.map((s,i) => (
                  <div key={s.id} style={{ ...row, borderBottom:i<filteredSales.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}>
                    <IconBox icon="ti-file-invoice" color={T.teal} bg={T.tealLight} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ margin:0, fontSize:13, fontWeight:500 }}>{s.description||"Sale"}</p>
                      <p style={{ margin:0, fontSize:12, color:"var(--color-text-secondary)" }}>{fmtDate(s.date)}</p>
                    </div>
                    <span style={{ fontSize:14, fontWeight:500, color:T.teal, whiteSpace:"nowrap" }}>{fmt(s.amount)}</span>
                    <button onClick={()=>setSales(sales.filter(x=>x.id!==s.id))} aria-label="Delete sale"
                      style={{ width:30, height:30, borderRadius:8, background:"none", border:"0.5px solid var(--color-border-tertiary)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--color-text-tertiary)" }}>
                      <i className="ti ti-trash" style={{ fontSize:15 }} aria-hidden="true" />
                    </button>
                  </div>
                ))
              }
            </div>

            {filteredSales.length>0 && (
              <div style={{ marginTop:10, display:"flex", justifyContent:"space-between", fontSize:13, padding:"10px 4px" }}>
                <span style={{ color:"var(--color-text-secondary)" }}>{filteredSales.length} transaction{filteredSales.length!==1?"s":""}</span>
                <span style={{ fontWeight:500, color:T.teal }}>{fmt(filteredSales.reduce((a,b)=>a+b.amount,0))} total</span>
              </div>
            )}
          </div>
        )}

        {/* ── EXPENSES ── */}
        {activeTab === "expenses" && (
          <div>
            <SectionHeader title="Expenses"
              action={<PrimaryBtn onClick={()=>setShowExpForm(!showExpForm)} style={{ background:T.coral }}><i className="ti ti-plus" aria-hidden="true" />Add expense</PrimaryBtn>}
            />

            {showExpForm && (
              <FormBox>
                <p style={{ margin:"0 0 2px", fontSize:13, fontWeight:500 }}>New expense</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <label style={{ fontSize:12, color:"var(--color-text-secondary)", display:"block", marginBottom:4 }}>Date</label>
                    <input type="date" value={expForm.date} onChange={e=>setExpForm({...expForm,date:e.target.value})} style={fi} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:"var(--color-text-secondary)", display:"block", marginBottom:4 }}>Category</label>
                    <select value={expForm.category} onChange={e=>setExpForm({...expForm,category:e.target.value})} style={fi}>
                      {["Paper","Ink & Toner","Maintenance","Salaries","Other"].map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:12, color:"var(--color-text-secondary)", display:"block", marginBottom:4 }}>Description</label>
                  <input type="text" placeholder="e.g. A4 paper restock" value={expForm.description} onChange={e=>setExpForm({...expForm,description:e.target.value})} style={fi} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:"var(--color-text-secondary)", display:"block", marginBottom:4 }}>Amount (GH₵)</label>
                  <input type="number" placeholder="0" value={expForm.amount} onChange={e=>setExpForm({...expForm,amount:e.target.value})} style={fi} />
                </div>
                <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                  <button onClick={()=>setShowExpForm(false)} style={{ padding:"8px 16px", borderRadius:8 }}>Cancel</button>
                  <PrimaryBtn onClick={addExpense} style={{ background:T.coral }}>Save expense</PrimaryBtn>
                </div>
              </FormBox>
            )}

            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              <div style={{ position:"relative", flex:1, minWidth:160 }}>
                <i className="ti ti-search" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:15, color:"var(--color-text-tertiary)" }} aria-hidden="true" />
                <input type="text" placeholder="Search expenses…" value={expSearch} onChange={e=>setExpSearch(e.target.value)} style={{ ...fi, paddingLeft:34 }} />
              </div>
              <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{ fontSize:13 }} />
            </div>

            <div style={card}>
              {filteredExp.length===0 ? <EmptyState icon="ti-receipt" text="No expenses found for this period." /> :
                filteredExp.map((e,i) => (
                  <div key={e.id} style={{ ...row, borderBottom:i<filteredExp.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}>
                    <IconBox icon="ti-receipt" color={T.coral} bg={T.coralLight} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                        <Badge bg={T.amberLight} color={T.amber}>{e.category}</Badge>
                      </div>
                      <p style={{ margin:0, fontSize:13, fontWeight:500 }}>{e.description}</p>
                      <p style={{ margin:0, fontSize:12, color:"var(--color-text-secondary)" }}>{fmtDate(e.date)}</p>
                    </div>
                    <span style={{ fontSize:14, fontWeight:500, color:T.coral, whiteSpace:"nowrap" }}>{fmt(e.amount)}</span>
                    <button onClick={()=>setExpenses(expenses.filter(x=>x.id!==e.id))} aria-label="Delete expense"
                      style={{ width:30, height:30, borderRadius:8, background:"none", border:"0.5px solid var(--color-border-tertiary)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--color-text-tertiary)" }}>
                      <i className="ti ti-trash" style={{ fontSize:15 }} aria-hidden="true" />
                    </button>
                  </div>
                ))
              }
            </div>

            {filteredExp.length>0 && (
              <div style={{ marginTop:10, display:"flex", justifyContent:"space-between", fontSize:13, padding:"10px 4px" }}>
                <span style={{ color:"var(--color-text-secondary)" }}>{filteredExp.length} transaction{filteredExp.length!==1?"s":""}</span>
                <span style={{ fontWeight:500, color:T.coral }}>{fmt(filteredExp.reduce((a,b)=>a+b.amount,0))} total</span>
              </div>
            )}
          </div>
        )}

        {/* ── TASKS ── */}
        {activeTab === "todos" && (
          <div>
            <SectionHeader title="Tasks"
              action={<PrimaryBtn onClick={()=>setShowTodoForm(!showTodoForm)}><i className="ti ti-plus" aria-hidden="true" />Add task</PrimaryBtn>}
            />

            {showTodoForm && (
              <FormBox>
                <p style={{ margin:"0 0 2px", fontSize:13, fontWeight:500 }}>New task</p>
                <div>
                  <label style={{ fontSize:12, color:"var(--color-text-secondary)", display:"block", marginBottom:4 }}>Description</label>
                  <input type="text" placeholder="What needs to be done?" value={todoInput}
                    onChange={e=>setTodoInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&addTodo()}
                    style={fi} autoFocus />
                </div>
                <div>
                  <label style={{ fontSize:12, color:"var(--color-text-secondary)", display:"block", marginBottom:8 }}>Priority</label>
                  <div style={{ display:"flex", gap:8 }}>
                    {["high","medium","low"].map(p => (
                      <button key={p} onClick={()=>setTodoPriority(p)}
                        style={{ flex:1, padding:"7px 4px", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", border:`1.5px solid ${todoPriority===p?priorityMap[p].text:"var(--color-border-tertiary)"}`, background:todoPriority===p?priorityMap[p].bg:"transparent", color:todoPriority===p?priorityMap[p].text:"var(--color-text-secondary)", transition:"all .15s" }}>
                        {priorityMap[p].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                  <button onClick={()=>setShowTodoForm(false)} style={{ padding:"8px 16px", borderRadius:8 }}>Cancel</button>
                  <PrimaryBtn onClick={addTodo}>Add task</PrimaryBtn>
                </div>
              </FormBox>
            )}

            {["Pending","Completed"].map(section => {
              const st = todos.filter(t => section==="Pending"?!t.completed:t.completed);
              return (
                <div key={section} style={{ marginBottom:16 }}>
                  <p style={{ fontSize:11, fontWeight:500, color:"var(--color-text-tertiary)", textTransform:"uppercase", letterSpacing:0.6, margin:"0 0 8px 2px" }}>
                    {section} · {st.length}
                  </p>
                  <div style={card}>
                    {st.length===0
                      ? <EmptyState icon={section==="Pending"?"ti-circle-check":"ti-clipboard-list"} text={section==="Pending"?"All caught up!":"No completed tasks yet."} />
                      : st.map((t,i) => (
                        <div key={t.id} style={{ ...row, borderBottom:i<st.length-1?"0.5px solid var(--color-border-tertiary)":"none", opacity:t.completed?.65:1, transition:"opacity .2s" }}>
                          <input type="checkbox" checked={t.completed}
                            onChange={()=>setTodos(todos.map(x=>x.id===t.id?{...x,completed:!x.completed}:x))}
                            style={{ accentColor:T.purple, width:16, height:16, flexShrink:0, cursor:"pointer" }} />
                          <span style={{ flex:1, fontSize:13, textDecoration:t.completed?"line-through":"none", color:t.completed?"var(--color-text-tertiary)":"var(--color-text-primary)" }}>{t.text}</span>
                          <Badge bg={priorityMap[t.priority].bg} color={priorityMap[t.priority].text}>{priorityMap[t.priority].label}</Badge>
                          <button onClick={()=>setTodos(todos.filter(x=>x.id!==t.id))} aria-label="Delete task"
                            style={{ width:30, height:30, borderRadius:8, background:"none", border:"0.5px solid var(--color-border-tertiary)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--color-text-tertiary)" }}>
                            <i className="ti ti-trash" style={{ fontSize:15 }} aria-hidden="true" />
                          </button>
                        </div>
                      ))
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav style={{ position:"fixed", bottom:0, left:0, right:0, background:"var(--color-background-primary)", borderTop:"0.5px solid var(--color-border-tertiary)", display:"flex", zIndex:200 }}>
        {tabs.map(t => {
          const active = activeTab===t.id;
          return (
            <button key={t.id} onClick={()=>setActiveTab(t.id)} aria-current={active?"page":undefined}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"10px 0 13px", border:"none", background:"none", cursor:"pointer", borderTop:`2px solid ${active?T.purple:"transparent"}`, transition:"border-color .15s" }}>
              <i className={`ti ${t.icon}`} style={{ fontSize:20, color:active?T.purple:"var(--color-text-tertiary)", transition:"color .15s" }} aria-hidden="true" />
              <span style={{ fontSize:10, fontWeight:active?500:400, color:active?T.purple:"var(--color-text-tertiary)", transition:"color .15s" }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
