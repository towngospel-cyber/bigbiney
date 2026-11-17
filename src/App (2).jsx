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

const tone = (n) => ({ bg: `var(--${n}-bg)`, color: `var(--${n}-ink)`, border: `var(--${n}-line)` });
const STATUS_COLORS = {
  quoting: tone('sky'), queued: tone('amber'), 'in-progress': tone('blue'),
  'on-hold': tone('orange'), completed: tone('green'), cancelled: tone('red'),
};
const PRIORITY_COLORS = {
  normal: tone('slate'), rush: tone('red'), urgent: { bg: '#7f1d1d', color: '#ffffff', border: '#7f1d1d' },
};
const DELIVERY_COLORS = {
  pending: tone('slate'), ready: tone('amber'), 'out-for-delivery': tone('blue'),
  delivered: tone('green'), collected: tone('green'),
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
const generatePaymentReminderMsg = (job) =>
  `Hi ${job.customer}! 💳 This is a friendly payment reminder for your print job *${job.job_no}*.\n\n📋 ${job.description}\n💰 Amount Due: ${fmt(job.price)}\n\nKindly make payment at your earliest convenience.\n\nThank you for choosing Bigbiney Printing Press! 🖨️`;

const generateThankYouMsg = (job) =>
  `Hi ${job.customer}! 🙏 Thank you for your business!\n\n📋 Job *${job.job_no}* — ${job.description} has been completed.\n\nWe truly appreciate your continued support and look forward to serving you again.\n\n— Bigbiney Printing Press 🖨️`;

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

const GLOBAL_CSS = `:root{--bg:#f4f6f9;--surface:#fff;--surface-2:#eef1f5;--line:#dde2ea;--line-soft:#edf0f4;--ink:#14181f;--ink-2:#3a4352;--muted:#646e7e;--faint:#8a93a2;--primary:#0a7fc2;--shadow:0 1px 2px rgba(20,24,31,.06),0 4px 14px rgba(20,24,31,.05);
--sky-bg:#f0f9ff;--sky-ink:#0369a1;--sky-line:#bae6fd;--amber-bg:#fefce8;--amber-ink:#854d0e;--amber-line:#fde68a;--blue-bg:#eff6ff;--blue-ink:#1d4ed8;--blue-line:#bfdbfe;
--orange-bg:#fff7ed;--orange-ink:#c2410c;--orange-line:#fed7aa;--green-bg:#f0fdf4;--green-ink:#15803d;--green-line:#bbf7d0;--red-bg:#fef2f2;--red-ink:#b91c1c;--red-line:#fecaca;--slate-bg:#f1f5f9;--slate-ink:#475569;--slate-line:#e2e8f0;}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1218;--surface:#171b24;--surface-2:#202634;--line:#2a3140;--line-soft:#222836;--ink:#e8ebf0;--ink-2:#c3c9d4;--muted:#98a1b3;--faint:#6f7889;--primary:#1a86cc;--shadow:none;--sky-bg:#0c2a3d;--sky-ink:#7dd3fc;--sky-line:#164e63;--amber-bg:#33290a;--amber-ink:#fcd34d;--amber-line:#5c4a12;--blue-bg:#14264d;--blue-ink:#93b4fb;--blue-line:#1e3a8a;--orange-bg:#3a1d0a;--orange-ink:#fdba74;--orange-line:#7c2d12;--green-bg:#0f2e1c;--green-ink:#6ee7a0;--green-line:#14532d;--red-bg:#3b1414;--red-ink:#fca5a5;--red-line:#7f1d1d;--slate-bg:#1e2633;--slate-ink:#a9b4c6;--slate-line:#334155;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f1218;--surface:#171b24;--surface-2:#202634;--line:#2a3140;--line-soft:#222836;--ink:#e8ebf0;--ink-2:#c3c9d4;--muted:#98a1b3;--faint:#6f7889;--primary:#1a86cc;--shadow:none;--sky-bg:#0c2a3d;--sky-ink:#7dd3fc;--sky-line:#164e63;--amber-bg:#33290a;--amber-ink:#fcd34d;--amber-line:#5c4a12;--blue-bg:#14264d;--blue-ink:#93b4fb;--blue-line:#1e3a8a;--orange-bg:#3a1d0a;--orange-ink:#fdba74;--orange-line:#7c2d12;--green-bg:#0f2e1c;--green-ink:#6ee7a0;--green-line:#14532d;--red-bg:#3b1414;--red-ink:#fca5a5;--red-line:#7f1d1d;--slate-bg:#1e2633;--slate-ink:#a9b4c6;--slate-line:#334155;color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
h1,h2,h3{color:var(--ink)}button,input,select,textarea{font:inherit}
input,select,textarea{background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 11px;width:100%;min-width:0;outline:none}
input:focus,select:focus,textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 22%,transparent)}
button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.fld{display:flex;flex-direction:column;gap:4px}.fld label{font-size:12px;font-weight:600;color:var(--ink-2)}
.muted{color:var(--muted)}.grow{flex:1}.center{text-align:center}.center-t{text-align:center;padding:16px}.err{margin:0;padding:8px 10px;border-radius:8px;background:var(--red-bg);border:1px solid var(--red-line);color:var(--red-ink);font-size:13px}
.btn{border:0;border-radius:8px;padding:9px 16px;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;color:#fff;transition:filter .12s}
.btn:hover:not(:disabled){filter:brightness(1.08)}.btn:disabled{opacity:.55;cursor:not-allowed}.btn.sm{padding:6px 11px;font-size:12px}
.btn-primary{background:var(--primary)}.btn-success{background:#16a34a}.btn-danger{background:#dc2626}.btn-warning{background:#d98a06}.btn-purple{background:#7c3aed}.btn-teal{background:#0891b2}.btn-wa{background:#1fa855}
.btn-ghost{background:var(--surface-2);color:var(--ink-2);border:1px solid var(--line)}
.badge{border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}
.stat{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--primary);border-radius:10px;padding:16px 18px;box-shadow:var(--shadow)}
.stat-v{font-size:22px;font-weight:800;margin-bottom:2px}.stat-l{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}.stat-s{font-size:11px;color:var(--faint);margin-top:3px}
.th{padding:10px 12px;font-size:11px;font-weight:700;color:var(--muted);text-align:left;border-bottom:1px solid var(--line);text-transform:uppercase;white-space:nowrap;background:var(--surface-2)}
.td{padding:10px 12px;font-size:13px;border-bottom:1px solid var(--line-soft)}
table{border-collapse:collapse}
.modal-back{position:fixed;inset:0;background:rgba(8,12,20,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}
.modal{background:var(--surface);border-radius:14px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 24px 60px rgba(0,0,0,.3)}
.modal-h{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface);z-index:1}
.modal-h h3{margin:0;font-size:16px}.x{background:none;border:0;font-size:26px;line-height:1;cursor:pointer;color:var(--muted)}.modal-b{padding:20px}
.login{min-height:100vh;display:grid;place-items:center;padding:16px}
.login-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:32px;width:100%;max-width:400px;display:flex;flex-direction:column;gap:12px;box-shadow:var(--shadow)}
.login-card h1{margin:0;font-size:21px;text-align:center}.login-card p{margin:0;text-align:center;font-size:13px}.login-logo{font-size:42px;text-align:center}
.app{display:flex;min-height:100vh}.content{flex:1;min-width:0}
.side{width:224px;flex:none;position:sticky;top:0;height:100vh;overflow-y:auto;background:var(--surface);border-right:1px solid var(--line);padding:14px 10px;display:flex;flex-direction:column;gap:2px}
.brand{display:flex;gap:10px;align-items:center;font-size:24px;font-weight:800;padding:4px 10px 16px;line-height:1.1}.brand span{font-size:15px}.brand small{font-weight:500;color:var(--muted);font-size:12px}
.nav{display:flex;align-items:center;gap:12px;background:none;border:0;border-radius:8px;padding:10px 12px;cursor:pointer;color:var(--ink-2);font-weight:600;text-align:left}
.nav:hover{background:var(--surface-2)}.nav.on{background:color-mix(in srgb,var(--primary) 13%,transparent);color:var(--primary)}
.ico{width:22px;text-align:center;flex:none}.pill{margin-left:auto;background:#dc2626;color:#fff;border-radius:999px;font-size:11px;padding:1px 7px}
.who{font-size:12px;color:var(--muted);padding:8px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.top{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 24px;min-height:58px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.page-title{margin:0;font-size:19px;display:flex;gap:8px;align-items:center}.top-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.iconbtn{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:8px;width:38px;height:36px;cursor:pointer;font-size:16px}
.dot{position:absolute;top:-5px;right:-5px;background:#dc2626;color:#fff;border-radius:999px;min-width:17px;height:17px;font-size:10px;font-weight:700;display:grid;place-items:center;padding:0 4px}
.chip{border:1px solid;border-radius:999px;padding:4px 11px;font-size:12px;font-weight:700;cursor:pointer}.chip.bad{background:var(--red-bg);color:var(--red-ink);border-color:var(--red-line)}.chip.warn{background:var(--amber-bg);color:var(--amber-ink);border-color:var(--amber-line)}
.rel{position:relative}.panel{position:absolute;right:0;top:115%;width:min(340px,88vw);max-height:380px;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.2);z-index:300}
.panel-h{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface)}
.note{display:flex;gap:8px;align-items:flex-start;padding:10px 14px;border-bottom:1px solid var(--line-soft);font-size:12px}.note.unread{background:var(--blue-bg)}
.link{background:none;border:0;color:var(--muted);cursor:pointer;font-size:12px}
.main{padding:24px;max-width:1400px;margin:0 auto}
.bottom,.sheet-back{display:none}
.menu-btn,.side-out,.side-x,.scrim{display:none}
@media (max-width:860px){
  .app{display:block}.content{width:100%;max-width:100vw}
  .side{position:fixed;left:0;top:0;bottom:0;height:auto;z-index:400;width:min(290px,84vw);transform:translateX(-104%);transition:transform .25s ease;padding-top:max(14px,env(safe-area-inset-top))}
  .side.open{transform:none;box-shadow:0 0 44px rgba(0,0,0,.4)}
  .scrim{display:block;position:fixed;inset:0;z-index:390;background:rgba(8,12,20,.5)}
  .menu-btn{display:inline-grid;place-items:center}.side-out{display:flex;justify-content:center;margin:8px 4px 4px}.side-x{display:grid;place-items:center}
  .top{padding:8px 12px;gap:8px}.top .chip{display:none}.page-title{font-size:17px;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.hide-sm{display:none}.main{padding:12px 12px 32px}
  .bottom{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:150;background:var(--surface);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom)}
  .bottom button{flex:1;position:relative;background:none;border:0;padding:8px 2px 7px;display:flex;flex-direction:column;align-items:center;gap:1px;font-size:11px;color:var(--muted);cursor:pointer}
  .bottom button.on{color:var(--primary);font-weight:700}.bottom .ico{font-size:19px}.sm-dot{position:absolute;top:6px;right:calc(50% - 20px);width:9px;height:9px;min-width:0;padding:0;border-radius:50%;background:#dc2626}
  .sheet-back{display:flex;position:fixed;inset:0;z-index:200;background:rgba(8,12,20,.5);align-items:flex-end}
  .sheet{width:100%;background:var(--surface);border-radius:18px 18px 0 0;padding:16px 14px calc(16px + env(safe-area-inset-bottom))}
  .sheet-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.sheet-f{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:14px;font-size:12px}
  .tile{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 6px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--ink);font-weight:600;font-size:12px;cursor:pointer}.tile.on{border-color:var(--primary);color:var(--primary)}.tile .ico{font-size:22px}.tile .pill{position:absolute;top:6px;right:6px;margin:0}
  /* make the existing screens fit narrow widths */
  [style*="grid-template-columns"]:not([style*="auto-fit"]){grid-template-columns:1fr!important}
  [style*="justify-content: space-between"]{flex-wrap:wrap;gap:8px}
  table{display:block;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
  input,select,textarea{font-size:16px}.btn,.iconbtn{min-height:38px}
  .modal-back{align-items:flex-end;padding:0}.modal{max-width:none!important;max-height:94vh;border-radius:18px 18px 0 0}
}
.muted{color:var(--muted)}.ellip{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.d-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:18px}
.d-hero h2{margin:0;font-size:25px;letter-spacing:-.02em}.d-hero p{margin:4px 0 0;color:var(--muted)}.d-hero p b{color:var(--ink)}
.d-actions{display:flex;gap:8px;flex-wrap:wrap}
.d-act{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:8px 14px;font-weight:600;cursor:pointer;box-shadow:var(--shadow);transition:.15s}
.d-act:hover{border-color:var(--primary);color:var(--primary);transform:translateY(-1px)}.d-act.p{background:var(--primary);border-color:var(--primary);color:#fff}.d-act.p:hover{color:#fff;filter:brightness(1.08)}
.d-alert{display:flex;gap:12px;align-items:flex-start;background:var(--amber-bg);border:1px solid var(--amber-line);color:var(--amber-ink);border-radius:14px;padding:12px 16px;margin-bottom:16px}
.d-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.d-chips span{background:var(--surface);color:var(--ink);border:1px solid var(--amber-line);border-radius:999px;padding:2px 10px;font-size:12px}
.d-wa{background:#25D366;border:0;color:#fff;border-radius:999px;padding:7px 14px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}
.d-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:var(--shadow);min-width:0}
.d-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}.d-head h3{margin:0;font-size:14px;font-weight:700}
.d-link{background:none;border:0;color:var(--primary);font-weight:600;font-size:12px;cursor:pointer;padding:0}.d-link:hover{text-decoration:underline}
.d-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:14px;margin-bottom:14px}
.d-kpi{padding:16px 18px;transition:.15s}.d-kpi:hover{transform:translateY(-2px)}
.d-kpi-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.d-ico{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-size:17px}
.d-kpi-v{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.1}.d-kpi-l{color:var(--muted);font-weight:600;font-size:12px;margin:3px 0 8px}
.d-delta{font-size:12px;font-weight:700}.d-delta span{font-weight:500;color:var(--muted)}.d-delta.good{color:var(--green-ink)}.d-delta.bad{color:var(--red-ink)}.d-delta.flat{color:var(--muted);font-weight:500}
.d-grid{display:grid;gap:14px;margin-bottom:14px}
.g-2-1{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}.g-3{grid-template-columns:repeat(3,minmax(0,1fr))}
@media (max-width:1100px){.g-2-1,.g-3{grid-template-columns:minmax(0,1fr)}}
.d-seg{display:inline-flex;background:var(--surface-2);border-radius:999px;padding:3px}
.d-seg button{border:0;background:none;color:var(--muted);font-weight:600;font-size:12px;padding:5px 12px;border-radius:999px;cursor:pointer}.d-seg button.on{background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}
.d-readout{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;margin-bottom:8px;align-items:center}.d-readout span{display:inline-flex;align-items:center;gap:6px}.d-readout i{width:10px;height:10px;border-radius:3px;display:inline-block}.d-readout b{font-size:14px}.d-readout .muted{margin-left:auto}
.d-xlabels{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px}
.d-tag{display:inline-block;background:var(--surface-2);color:var(--ink-2);border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;white-space:nowrap}.d-tag.hot{background:var(--red-bg);color:var(--red-ink)}
.d-facts{display:grid;gap:6px;font-size:13px;font-weight:600}
.d-stack{display:flex;height:12px;border-radius:999px;overflow:hidden;background:var(--surface-2);margin-bottom:14px}.d-stack i{display:block;height:100%}
.d-legend{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:12px}.d-legend div{display:flex;align-items:center;gap:7px}.d-legend i{width:9px;height:9px;border-radius:50%;flex:none}.d-legend span{text-transform:capitalize;color:var(--ink-2)}.d-legend b{margin-left:auto}
.d-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-soft);font-size:13px}.d-row:last-child{border-bottom:0}
.d-bar{display:grid;grid-template-columns:minmax(80px,1.1fr) 1.4fr auto;align-items:center;gap:10px;font-size:12px;margin-bottom:9px}
.d-bar>div{background:var(--surface-2);border-radius:999px;height:8px;overflow:hidden}.d-bar>div i{display:block;height:100%;border-radius:999px;background:var(--blue-ink);transition:width .5s ease}.d-bar b{min-width:20px;text-align:right}

.ln-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.ln-tiles div{background:var(--surface-2);border-radius:10px;padding:8px 6px;text-align:center}.ln-tiles b{display:block;font-size:18px}.ln-tiles span{font-size:10px;color:var(--muted);font-weight:600}
.ln-month{background:var(--blue-bg);border:1px solid var(--blue-line);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:12px}
.ln-mh{display:flex;justify-content:space-between;margin-bottom:6px;color:var(--blue-ink)}.ln-mh span{color:var(--muted)}
.ln-r{display:flex;justify-content:space-between;gap:8px;padding:2px 0}.ln-r span{color:var(--ink-2)}
.ln-bar{height:8px;background:var(--surface);border-radius:999px;overflow:hidden;margin:6px 0}.ln-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--primary),#16a34a);border-radius:999px}
.g-2{grid-template-columns:repeat(2,minmax(0,1fr))}@media (max-width:1100px){.g-2{grid-template-columns:minmax(0,1fr)}}
.d-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}.d-filters .fld{min-width:150px;flex:1}
.d-tot td{font-weight:800;background:var(--surface-2)}
@media print{.side,.top,.bottom,.d-noprint{display:none!important}.main{padding:0}}

.sm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:10px}
.sm-sec{font-weight:800;font-size:13px;margin:14px 0 8px;padding-top:12px;border-top:1px solid var(--line-soft)}
.sm-item{display:grid;grid-template-columns:minmax(0,3fr) 70px 100px 100px 30px;gap:8px;align-items:center;margin-bottom:8px}
.sm-item b{text-align:right;font-size:13px}.sm-head{font-size:11px;color:var(--muted);font-weight:700;margin-bottom:4px}
.sm-x{border:0;background:var(--surface-2);color:var(--muted);border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:16px}.sm-x:hover{background:var(--red-bg);color:var(--red-ink)}
.sm-sum{background:var(--surface-2);border-radius:12px;padding:10px 14px;margin-top:10px}
.rcpt{background:var(--surface-2);border-radius:12px;padding:14px;font-size:13px}.rcpt hr{border:0;border-top:1px dashed var(--line);margin:8px 0}
.rcpt-h{text-align:center;margin-bottom:10px;line-height:1.5}.rcpt-h b{font-size:16px}
@media (max-width:640px){.sm-grid{grid-template-columns:minmax(0,1fr)}.sm-item{grid-template-columns:minmax(0,1fr) 56px 84px 30px}.sm-item b,.sm-head span:nth-child(4){display:none}}

.pr-staff{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-bottom:14px}
.pr-av{width:42px;height:42px;border-radius:50%;background:color-mix(in srgb,var(--primary) 16%,transparent);color:var(--primary);display:grid;place-items:center;font-weight:800;flex:none}
@media (max-width:860px){
  .d-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.d-kpi{padding:12px}.d-kpi-v{font-size:18px}.d-kpi-top svg{width:58px}.d-ico{width:30px;height:30px;font-size:15px}
  .d-hero h2{font-size:21px}.d-card{padding:14px}.d-seg{max-width:100%;overflow-x:auto}.d-act{padding:7px 11px;font-size:13px}.d-readout{gap:10px}
  .pr-staff{grid-template-columns:minmax(0,1fr)}.d-filters .fld{min-width:100%}.d-hero{align-items:flex-start}.d-actions{width:100%}
}

.branch-sel{width:auto;max-width:190px;font-weight:700;border-radius:999px;padding:7px 12px;border:1px solid var(--primary);color:var(--primary);background:var(--surface)}
.br-ribbon{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--blue-bg);border:1px solid var(--blue-line);color:var(--blue-ink);border-radius:12px;padding:8px 14px;margin-bottom:14px;font-size:13px}
.br-ribbon button{margin-left:auto;border:0;background:none;color:var(--primary);font-weight:700;cursor:pointer}
@media (max-width:860px){.branch-sel{max-width:132px;padding:6px 8px;font-size:12px}}

.side-inst{margin:6px 4px 0;justify-content:center}
.db-row{border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:10px}
.db-main{display:flex;gap:12px;align-items:center;cursor:pointer}.db-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.db-items{background:var(--surface-2);border-radius:10px;padding:8px 12px;margin-top:10px;font-size:12px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

const Badge = ({ text, type = 'status' }) => {
  const c = type === 'status' ? (STATUS_COLORS[text] || {}) : type === 'priority' ? (PRIORITY_COLORS[text] || {}) : (DELIVERY_COLORS[text] || {});
  return <span className="badge" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border || c.bg}` }}>{text}</span>;
};
const Modal = ({ title, onClose, children, wide }) => (
  <div className="modal-back">
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: wide ? 800 : 600 }}>
      <div className="modal-h"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="Close">×</button></div>
      <div className="modal-b">{children}</div>
    </div>
  </div>
);
const StatCard = ({ label, value, sub, accent }) => (
  <div className="stat" style={{ borderLeftColor: accent || 'var(--primary)' }}>
    <div className="stat-v" style={{ color: accent || 'var(--primary)' }}>{value}</div>
    <div className="stat-l">{label}</div>
    {sub && <div className="stat-s">{sub}</div>}
  </div>
);
const Inp = ({ label, id, ...props }) => (
  <div className="fld">
    {label && <label htmlFor={id || props.name}>{label}</label>}
    <input id={id || props.name || label?.toLowerCase().replace(/\s+/g, '-')} {...props} />
  </div>
);
const Sel = ({ label, id, children, ...props }) => (
  <div className="fld">
    {label && <label htmlFor={id || label?.toLowerCase().replace(/\s+/g, '-')}>{label}</label>}
    <select id={id || label?.toLowerCase().replace(/\s+/g, '-')} {...props}>{children}</select>
  </div>
);
const Btn = ({ children, onClick, variant = 'primary', small, style, disabled }) => (
  <button className={`btn btn-${variant}${small ? ' sm' : ''}`} onClick={onClick} disabled={disabled} style={style}>{children}</button>
);
const TH = ({ children }) => <th className="th">{children}</th>;
const TD = ({ children, style }) => <td className="td" style={style}>{children}</td>;

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
  const [branches,          setBranches]          = useState([]);
  const [activeBranch,      setActiveBranch]      = useState(() => { try { return localStorage.getItem('bb_branch') || 'all'; } catch { return 'all'; } });
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } });
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [priceList, setPriceList] = useState([]);
  const [debts, setDebts] = useState([]);
  const [debtsErr, setDebtsErr] = useState(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [installEvt, setInstallEvt] = useState(null);
  useEffect(() => {
    const r = document.documentElement;
    if (theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

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

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false), bip = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('online', on); window.addEventListener('offline', off); window.addEventListener('beforeinstallprompt', bip);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('beforeinstallprompt', bip); };
  }, []);
  useEffect(() => { if (!currentUser) return; db.getSetting(currentUser.id, 'price_list').then(({ data }) => { if (data?.value) { try { setPriceList(JSON.parse(data.value)); } catch {} } }); }, [currentUser]);
  useEffect(() => { if (!currentUser) return; db.getDebts(currentUser.id).then(({ data, error }) => { setDebts(data || []); setDebtsErr(error ? error.message : null); }); }, [currentUser]);
  const savePriceList = async (list) => { setPriceList(list); await db.setSetting(currentUser.id, 'price_list', JSON.stringify(list)); };
  useEffect(() => {
    db.setActor(currentUser?.email || '', currentUser?.id || '');
    db.setLookup((table, id) => { const src = { customers, jobs, inventory, invoices, sales, expenses, payroll, loans, recurring_expenses: recurringExpenses, job_materials: jobMaterials, debts }[table]; const r = src?.find(x => x.id === id); return r ? [r.job_no, r.name, r.customer, r.staff_name, r.description].filter(Boolean).slice(0, 2).join(' · ') + (r.amount != null ? ` · GH₵${r.amount}` : r.price != null ? ` · GH₵${r.price}` : '') : ''; });
  });
  const installApp = async () => {
    if (installEvt) { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }
    else alert('To install: on iPhone tap Share → “Add to Home Screen”. On Android/Chrome open the ⋮ menu → “Install app”.');
  };
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);
  const firstB   = branches[0]?.name;
  const dbReady  = [sales, expenses, jobs, inventory, invoices, payroll, loans].every(a => a.length === 0 || Object.prototype.hasOwnProperty.call(a[0], 'branch'));
  const effBranch = dbReady && branches.some(b => b.name === activeBranch) ? activeBranch : 'all';
  const inB      = (x) => effBranch === 'all' || (x.branch || firstB) === effBranch;
  const scoped   = (setter) => (v) => (typeof v === 'function' ? setter(v) : setter(prev => (effBranch === 'all' ? v : [...prev.filter(x => !inB(x)), ...v])));
  const switchBranch = (name) => { setActiveBranch(name); try { localStorage.setItem('bb_branch', name); } catch {} };
  const goalKey  = effBranch === 'all' || effBranch === firstB ? 'monthly_goal' : `monthly_goal:${effBranch}`;
  useEffect(() => { db.setBranchContext(effBranch === 'all' ? null : effBranch); }, [effBranch]);
  useEffect(() => { if (!currentUser) return; db.getSetting(currentUser.id, goalKey).then(({ data }) => setMonthlyGoalState(data ? parseFloat(data.value) || 0 : 0)); }, [currentUser, goalKey]);
  const loadAllData = useCallback(async (userId) => {
    setLoading(true);
    const [c, j, inv, inv2, s, e, l, p, re, jm, goalRes, brRes] = await Promise.all([
      db.getCustomers(userId), db.getJobs(userId), db.getInventory(userId),
      db.getInvoices(userId), db.getSales(userId), db.getExpenses(userId),
      db.getLoans(userId), db.getPayroll(userId),
      db.getRecurringExpenses(userId), db.getJobMaterials(userId),
      db.getSetting(userId, 'monthly_goal'),
      db.getSetting(userId, 'branches'),
    ]);
    setCustomers(c.data); setJobs(j.data); setInventory(inv.data);
    setInvoices((inv2.data||[]).map(i => ({ ...i, items: i.items ? (typeof i.items === 'string' ? JSON.parse(i.items) : i.items) : null }))); setSales(s.data); setExpenses(e.data);
    setLoans(l.data); setPayroll(p.data);
    setRecurringExpenses(re.data); setJobMaterials(jm.data);
    if (goalRes && goalRes.data) setMonthlyGoalState(parseFloat(goalRes.data.value) || 0);
    if (brRes && brRes.data?.value) { try { setBranches(JSON.parse(brRes.data.value)); } catch {} }
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
  const saveBranches = async (list) => { setBranches(list); await db.setSetting(currentUser.id, 'branches', JSON.stringify(list)); };
  const saveGoal = async (val) => { setMonthlyGoalState(val); await db.setSetting(currentUser.id, goalKey, String(val)); };

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
      <div className="login">
        <style>{GLOBAL_CSS}</style>
        <div className="login-card">
          <div className="login-logo">🖨️</div>
          <h1>Bigbiney Printing Press</h1>
          <p className="muted">Management system · syncs across all devices</p>
          <Inp label="Email" type="email" autoComplete="username" placeholder="admin@bigbiney.com" value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          <Inp label="Password" type="password" autoComplete="current-password" placeholder="••••••••" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          {loginError && <p className="err" role="alert">{loginError}</p>}
          <Btn onClick={handleLogin}>Sign in →</Btn>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="login"><style>{GLOBAL_CSS}</style>
        <div className="center"><div className="login-logo">🖨️</div><p className="muted">Loading Bigbiney Printing Press…</p></div>
      </div>
    );
  }

  const unread      = notifs.filter(n => !n.read).length;
  const vDebts = debts.filter(inB);
  const vJobs = jobs.filter(inB), vSales = sales.filter(inB), vExp = expenses.filter(inB), vInv = inventory.filter(inB), vInvoices = invoices.filter(inB), vPayroll = payroll.filter(inB), vLoans = loans.filter(inB);
  const lowStock    = vInv.filter(i => i.quantity <= i.reorder_point);
  const overdueJobs = vJobs.filter(j => !['completed','cancelled'].includes(j.status) && j.due_date && j.due_date < todayStr());

  const TABS = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'jobs',      label: '🗂️ Jobs' },
    { id: 'customers', label: '👥 Customers' },
    { id: 'inventory', label: '📦 Inventory' },
    { id: 'invoices',  label: '🧾 Invoices' },
    { id: 'finance',   label: '💰 Finance' },
    { id: 'branches',  label: '🏬 Branches' },
    { id: 'receipts',  label: '🧾 Receipts' },
    { id: 'debtors',   label: '💳 Debtors' },
    { id: 'prices',    label: '🏷️ Price list' },
    { id: 'activity',  label: '📜 Activity' },
    { id: 'payroll',   label: '👷 Payroll' },
    { id: 'loans',     label: '🏦 Loans' },
    { id: 'reports',   label: '📈 Reports' },
    { id: 'whatsapp',  label: '📲 WhatsApp' },
  ];
  const MAIN_TABS = ['dashboard', 'jobs', 'customers', 'finance'];
  const parts = (t) => { const i = t.label.indexOf(' '); return [t.label.slice(0, i), t.label.slice(i + 1)]; };
  const go = (id) => { setActiveTab(id); setMoreOpen(false); setMenuOpen(false); setShowNotif(false); window.scrollTo({ top: 0 }); };
  const [curIcon, curName] = parts(TABS.find(t => t.id === activeTab));
  const themeNext = { auto: 'light', light: 'dark', dark: 'auto' }[theme];
  const themeIcon = { auto: '🌓', light: '☀️', dark: '🌙' }[theme];
  const badgeFor = (id) => (id === 'inventory' ? lowStock.length : id === 'jobs' ? overdueJobs.length : 0);

  return (
    <div className="app">
      <style>{GLOBAL_CSS}</style>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`side${menuOpen ? ' open' : ''}`}>
        <div className="brand">🖨️ <span>Bigbiney<br /><small>Printing Press</small></span><button className="iconbtn side-x" style={{ marginLeft: 'auto' }} onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button></div>
        {TABS.map(t => { const [ic, nm] = parts(t); return (
          <button key={t.id} className={`nav${activeTab === t.id ? ' on' : ''}`} onClick={() => go(t.id)} aria-current={activeTab === t.id ? 'page' : undefined}>
            <span className="ico">{ic}</span><span>{nm}</span>{badgeFor(t.id) > 0 && <b className="pill">{badgeFor(t.id)}</b>}
          </button>
        ); })}
        <div className="grow" />
        <span className="who">👤 {currentUser.email}</span>
        {!isStandalone && <button className="btn btn-ghost side-inst" onClick={installApp}>📲 Install app</button>}
        <button className="btn btn-ghost side-out" onClick={handleLogout}>Logout</button>
      </aside>

      <div className="content">
        <header className="top">
          <button className="iconbtn menu-btn" onClick={() => setMenuOpen(v => !v)} aria-label="Open menu" aria-expanded={menuOpen}>☰</button>
          <h1 className="page-title" style={{ marginRight: 'auto' }}><span>{curIcon}</span> {curName}</h1>
          {branches.length > 1 && <select className="branch-sel" value={effBranch} disabled={!dbReady} onChange={e => switchBranch(e.target.value)} aria-label="Switch branch"><option value="all">🏬 All branches</option>{branches.map(b => <option key={b.name} value={b.name}>🏬 {b.name}</option>)}</select>}
          <div className="top-actions">
            {lowStock.length > 0 && <button className="chip bad" onClick={() => go('inventory')}>{lowStock.length} low stock</button>}
            {overdueJobs.length > 0 && <button className="chip warn" onClick={() => go('jobs')}>{overdueJobs.length} overdue</button>}
            {overdueJobs.length > 0 && <button className="btn btn-wa sm hide-sm" onClick={() => openWhatsApp(ADMIN_WHATSAPP, generateAdminReminderMsg(overdueJobs))}>📲 Alert admin</button>}
            <button className="iconbtn" onClick={() => setTheme(themeNext)} title={`Theme: ${theme} (click for ${themeNext})`} aria-label="Change theme">{themeIcon}</button>
            <div className="rel">
              <button className="iconbtn" onClick={() => setShowNotif(v => !v)} aria-label="Notifications">🔔{unread > 0 && <span className="dot">{unread}</span>}</button>
              {showNotif && (
                <div className="panel">
                  <div className="panel-h"><b>Notifications</b><button className="link" onClick={() => setNotifs(n => n.map(x => ({ ...x, read: true })))}>Mark all read</button></div>
                  {notifs.slice(0, 8).map(n => (
                    <div key={n.id} className={`note${n.read ? '' : ' unread'}`}>
                      <span>{n.type === 'warning' ? '⚠️' : n.type === 'success' ? '✅' : 'ℹ️'}</span>
                      <span className="grow">{n.message}</span>
                      <button className="link" onClick={() => setNotifs(prev => prev.filter(x => x.id !== n.id))} aria-label="Dismiss">×</button>
                    </div>
                  ))}
                  {notifs.length === 0 && <p className="muted center-t">All clear!</p>}
                </div>
              )}
            </div>
            <button className="btn btn-ghost sm hide-sm" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <PriceCtx.Provider value={priceList}>
        <main className="main">
        {!online && <div className="d-alert" style={{ marginBottom: 12 }}><span>📡</span><div><b>You're offline.</b> You can look around, but new records can't be saved until the connection is back.</div></div>}
        {branches.length > 1 && !dbReady && <DbWarn />}
        {effBranch !== 'all' && activeTab !== 'branches' && <div className="br-ribbon">🏬 Working in <b>{effBranch}</b> — you only see this branch's records <button onClick={() => switchBranch('all')}>View all</button></div>}
        {activeTab === 'dashboard' && <DashboardTab jobs={vJobs} sales={vSales} expenses={vExp} customers={customers} inventory={vInv} invoices={vInvoices} setActiveTab={setActiveTab} overdueJobs={overdueJobs} monthlyGoal={monthlyGoal} setMonthlyGoal={saveGoal} />}
        {activeTab === 'jobs'      && <JobsTab allJobs={jobs} jobs={vJobs} setJobs={scoped(setJobs)} customers={customers} addNotif={addNotif} userId={currentUser.id} inventory={vInv} setInventory={scoped(setInventory)} jobMaterials={jobMaterials} setJobMaterials={setJobMaterials} />}
        {activeTab === 'customers' && <CustomersTab customers={customers} setCustomers={setCustomers} jobs={vJobs} invoices={vInvoices} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'inventory' && <InventoryTab inventory={vInv} setInventory={scoped(setInventory)} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'invoices'  && <InvoicesTab invoices={vInvoices} setInvoices={scoped(setInvoices)} jobs={vJobs} customers={customers} setSales={scoped(setSales)} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'finance'   && <FinanceTab activeBranch={effBranch} customers={customers} branches={branches} sales={vSales} setSales={scoped(setSales)} expenses={vExp} setExpenses={scoped(setExpenses)} addNotif={addNotif} userId={currentUser.id} recurringExpenses={recurringExpenses} setRecurringExpenses={setRecurringExpenses} />}
        {activeTab === 'branches'  && <BranchesTab openBranch={(n) => { switchBranch(n); go('dashboard'); }} branches={branches} saveBranches={saveBranches} sales={sales} setSales={setSales} expenses={expenses} customers={customers} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'payroll'   && <PayrollTab activeBranch={effBranch} branches={branches} payroll={vPayroll} setPayroll={scoped(setPayroll)} addNotif={addNotif} userId={currentUser.id} expenses={vExp} setExpenses={scoped(setExpenses)} />}
        {activeTab === 'loans'     && <LoansTab loans={vLoans} setLoans={scoped(setLoans)} addNotif={addNotif} userId={currentUser.id} sales={vSales} expenses={vExp} setExpenses={scoped(setExpenses)} />}
        {activeTab === 'debtors'   && <DebtorsTab activeBranch={effBranch} debts={vDebts} setDebts={scoped(setDebts)} debtsErr={debtsErr} setCustomers={setCustomers} sales={vSales} setSales={scoped(setSales)} invoices={vInvoices} customers={customers} branches={branches} userId={currentUser.id} addNotif={addNotif} setActiveTab={go} />}
        {activeTab === 'prices'    && <PricesTab priceList={priceList} savePriceList={savePriceList} addNotif={addNotif} />}
        {activeTab === 'activity'  && <ActivityTab userId={currentUser.id} branches={branches} activeBranch={effBranch} />}
        {activeTab === 'receipts'  && <ReceiptsTab activeBranch={effBranch} branches={branches} customers={customers} userId={currentUser.id} addNotif={addNotif} setSales={scoped(setSales)} />}
        {activeTab === 'reports'   && <ReportsTab jobs={vJobs} sales={vSales} expenses={vExp} customers={customers} inventory={vInv} invoices={vInvoices} loans={vLoans} payroll={vPayroll} branches={effBranch === 'all' ? branches : []} />}
        {activeTab === 'whatsapp'  && <WhatsAppTab jobs={vJobs} customers={customers} sales={vSales} expenses={vExp} invoices={vInvoices} addNotif={addNotif} />}
        </main>
        </PriceCtx.Provider>
      </div>

    </div>
  );
}

/* ───────────── MODERN DASHBOARD ───────────── */
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const sumAmt = (arr, pred) => arr.filter(pred).reduce((a, x) => a + Number(x.amount || 0), 0);
const pctChange = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

const Spark = ({ data, color, w = 96, h = 30 }) => {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1 || 1)) * w},${h - 3 - (v / max) * (h - 6)}`).join(' ');
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={pts} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
};

const Ring = ({ pct, color, size = 112, big, small }) => {
  const r = size / 2 - 9, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: color, transition: 'stroke-dashoffset .6s ease' }} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', lineHeight: 1.1 }}>
        <div><div style={{ fontSize: 22, fontWeight: 800 }}>{big}</div><div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{small}</div></div>
      </div>
    </div>
  );
};

const Kpi = ({ label, value, icon, color, delta, invert, spark, sub }) => {
  const up = delta !== null && delta !== undefined && delta >= 0;
  const good = delta === null || delta === undefined ? null : (invert ? !up : up);
  return (
    <div className="d-card d-kpi">
      <div className="d-kpi-top">
        <span className="d-ico" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{icon}</span>
        {spark && <Spark data={spark} color={color} />}
      </div>
      <div className="d-kpi-v">{value}</div>
      <div className="d-kpi-l">{label}</div>
      {delta !== null && delta !== undefined
        ? <div className={`d-delta ${good ? 'good' : 'bad'}`}>{up ? '▲' : '▼'} {Math.abs(Math.round(delta))}% <span>vs last month</span></div>
        : <div className="d-delta flat">{sub || 'No comparison yet'}</div>}
    </div>
  );
};

const FlowChart = ({ series }) => {
  const [hov, setHov] = useState(null);
  const W = 600, H = 210, P = 10, n = series.length;
  const max = Math.max(...series.flatMap(s => [s.inc, s.exp]), 1);
  const x = (i) => P + (i / (n - 1 || 1)) * (W - 2 * P);
  const y = (v) => H - P - (v / max) * (H - 2 * P - 10);
  const line = (k) => series.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s[k])}`).join(' ');
  const area = `${line('inc')} L${x(n - 1)},${H - P} L${x(0)},${H - P} Z`;
  const totInc = series.reduce((a, s) => a + s.inc, 0), totExp = series.reduce((a, s) => a + s.exp, 0);
  const cur = hov !== null ? series[hov] : null;
  const step = Math.ceil(n / 7);
  return (
    <div>
      <div className="d-readout">
        <span><i style={{ background: 'var(--green-ink)' }} />Income <b>{fmt(cur ? cur.inc : totInc)}</b></span>
        <span><i style={{ background: 'var(--red-ink)' }} />Expenses <b>{fmt(cur ? cur.exp : totExp)}</b></span>
        <span className="muted">{cur ? cur.label : 'Period total'}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 210, display: 'block' }} onMouseLeave={() => setHov(null)} role="img" aria-label="Income versus expenses chart">
        <defs><linearGradient id="inc-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: 'var(--green-ink)', stopOpacity: 0.28 }} /><stop offset="100%" style={{ stopColor: 'var(--green-ink)', stopOpacity: 0 }} /></linearGradient></defs>
        {[0, 1, 2, 3].map(i => <line key={i} x1={P} x2={W - P} y1={P + 10 + i * ((H - 2 * P - 10) / 3)} y2={P + 10 + i * ((H - 2 * P - 10) / 3)} style={{ stroke: 'var(--line-soft)' }} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill="url(#inc-g)" />
        <path d={line('inc')} fill="none" style={{ stroke: 'var(--green-ink)' }} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={line('exp')} fill="none" style={{ stroke: 'var(--red-ink)' }} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hov !== null && <line x1={x(hov)} x2={x(hov)} y1={P} y2={H - P} style={{ stroke: 'var(--faint)' }} strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        {series.map((s, i) => <rect key={i} x={x(i) - (W / n) / 2} y="0" width={W / n} height={H} fill="transparent" onMouseEnter={() => setHov(i)} onTouchStart={() => setHov(i)} />)}
      </svg>
      <div className="d-xlabels">{series.map((s, i) => <span key={i} style={{ visibility: i % step === 0 ? 'visible' : 'hidden' }}>{s.label}</span>)}</div>
    </div>
  );
};

function DashboardTab({ jobs, sales, expenses, customers, inventory, invoices, setActiveTab, overdueJobs, monthlyGoal, setMonthlyGoal }) {
  const [editGoal, setEditGoal]   = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [range, setRange]         = useState('30d');

  const today = todayStr();
  const month = getCurrentMonth();
  const prevD = new Date(); prevD.setDate(1); prevD.setMonth(prevD.getMonth() - 1);
  const prevMonth = monthKey(prevD);

  const monthlySales = sumAmt(sales, s => s.date?.startsWith(month));
  const monthlyExp   = sumAmt(expenses, e => e.date?.startsWith(month));
  const prevSales    = sumAmt(sales, s => s.date?.startsWith(prevMonth));
  const prevExp      = sumAmt(expenses, e => e.date?.startsWith(prevMonth));
  const profit = monthlySales - monthlyExp, prevProfit = prevSales - prevExp;
  const todaySales = sumAmt(sales, s => s.date === today);
  const dueToday   = jobs.filter(j => j.due_date === today && !['completed', 'cancelled'].includes(j.status)).length;

  const unpaid      = invoices.filter(i => i.status !== 'paid');
  const unpaidTotal = unpaid.reduce((a, i) => a + (i.amount - i.paid), 0);
  const lowStock    = inventory.filter(i => i.quantity <= i.reorder_point);
  const goalPct     = monthlyGoal > 0 ? Math.min(100, Math.round((monthlySales / monthlyGoal) * 100)) : 0;
  const margin      = monthlySales > 0 ? ((monthlySales - monthlyExp) / monthlySales) * 100 : 0;

  let health = 100;
  if (margin < 10) health -= 30; else if (margin < 25) health -= 15;
  if (overdueJobs.length > 5) health -= 25; else if (overdueJobs.length > 0) health -= overdueJobs.length * 4;
  if (lowStock.length > 3) health -= 20; else if (lowStock.length > 0) health -= lowStock.length * 5;
  if (monthlySales === 0) health -= 20;
  health = Math.max(0, Math.min(100, health));
  const hColor = health >= 75 ? 'var(--green-ink)' : health >= 50 ? 'var(--amber-ink)' : 'var(--red-ink)';
  const hLabel = health >= 75 ? 'Healthy' : health >= 50 ? 'Needs attention' : 'Critical';

  // 6-month trend (KPI sparklines)
  const m6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
    const k = monthKey(d);
    return { label: d.toLocaleString('en', { month: 'short' }), inc: sumAmt(sales, s => s.date?.startsWith(k)), exp: sumAmt(expenses, e => e.date?.startsWith(k)) };
  });
  // Chart series by selected range
  const nDays = range === '7d' ? 7 : 30;
  const series = range === '6m' ? m6 : Array.from({ length: nDays }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (nDays - 1 - i));
    const ds = d.toISOString().split('T')[0];
    return { label: range === '7d' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`, inc: sumAmt(sales, s => s.date === ds), exp: sumAmt(expenses, e => e.date === ds) };
  });

  // Pipeline, deadlines, machines, customers
  const pipeline = JOB_STATUSES.map(s => ({ s, n: jobs.filter(j => j.status === s).length }));
  const totalJobs = jobs.length || 1;
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekStr = weekEnd.toISOString().split('T')[0];
  const dueSoon = jobs.filter(j => j.due_date && j.due_date >= today && j.due_date <= weekStr && !['completed', 'cancelled'].includes(j.status)).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6);
  const daysLeft = (ds) => Math.round((new Date(ds) - new Date(today)) / 86400000);
  const load = MACHINES.map(m => ({ m, n: jobs.filter(j => j.machine === m && ['queued', 'in-progress'].includes(j.status)).length }));
  const maxLoad = Math.max(...load.map(l => l.n), 1);
  const byCust = {};
  jobs.filter(j => j.status !== 'cancelled').forEach(j => { if (j.customer) byCust[j.customer] = (byCust[j.customer] || 0) + Number(j.price || 0); });
  const topCust = Object.entries(byCust).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = topCust[0]?.[1] || 1;

  return (
    <div>
      <div className="d-hero">
        <div>
          <h2>{greeting()} 👋</h2>
          <p>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Today: <b>{fmt(todaySales)}</b> revenue · <b>{dueToday}</b> job{dueToday === 1 ? '' : 's'} due</p>
        </div>
        <div className="d-actions">
          <button className="d-act" onClick={() => setActiveTab('jobs')}>🖨️ Jobs</button>
          <button className="d-act" onClick={() => setActiveTab('invoices')}>🧾 Invoices</button>
          <button className="d-act" onClick={() => setActiveTab('finance')}>💰 Finance</button>
          <button className="d-act" onClick={() => setActiveTab('inventory')}>📦 Stock</button>
          <button className="d-act p" onClick={() => openWhatsApp(ADMIN_WHATSAPP, generateDailySummaryMsg(sales, expenses, jobs, invoices))}>📲 Send daily summary</button>
        </div>
      </div>

      {overdueJobs.length > 0 && (
        <div className="d-alert">
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{overdueJobs.length} overdue job{overdueJobs.length > 1 ? 's' : ''} need attention</b>
            <div className="d-chips">{overdueJobs.slice(0, 6).map(j => <span key={j.id}><b>{j.job_no}</b> · {j.customer} · due {j.due_date}</span>)}{overdueJobs.length > 6 && <span>+{overdueJobs.length - 6} more</span>}</div>
          </div>
          <button className="d-wa" onClick={() => openWhatsApp(ADMIN_WHATSAPP, generateAdminReminderMsg(overdueJobs))}>📲 WhatsApp alert</button>
        </div>
      )}

      <div className="d-kpis">
        <Kpi label="Monthly income" value={fmt(monthlySales)} icon="💵" color="var(--green-ink)" delta={pctChange(monthlySales, prevSales)} spark={m6.map(m => m.inc)} />
        <Kpi label="Monthly expenses" value={fmt(monthlyExp)} icon="💸" color="var(--red-ink)" delta={pctChange(monthlyExp, prevExp)} invert spark={m6.map(m => m.exp)} />
        <Kpi label="Monthly profit" value={fmt(profit)} icon="📈" color="var(--primary)" delta={pctChange(profit, prevProfit)} spark={m6.map(m => Math.max(0, m.inc - m.exp))} />
        <Kpi label="Outstanding invoices" value={fmt(unpaidTotal)} icon="🧾" color="var(--amber-ink)" delta={null} sub={`${unpaid.length} unpaid invoice${unpaid.length === 1 ? '' : 's'}`} />
      </div>

      <div className="d-grid g-2-1">
        <div className="d-card">
          <div className="d-head">
            <h3>Income vs expenses</h3>
            <div className="d-seg" role="tablist">{[['7d', '7 days'], ['30d', '30 days'], ['6m', '6 months']].map(([k, l]) => <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}</div>
          </div>
          <FlowChart series={series} />
        </div>

        <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
          <div className="d-card">
            <div className="d-head"><h3>🎯 Monthly goal</h3><button className="d-link" onClick={() => { setGoalInput(String(monthlyGoal || '')); setEditGoal(v => !v); }}>{monthlyGoal > 0 ? 'Edit' : 'Set goal'}</button></div>
            {editGoal && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <Inp placeholder="Target (GH₵)" type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} />
                <Btn small onClick={() => { setMonthlyGoal(parseFloat(goalInput) || 0); setEditGoal(false); }}>Save</Btn>
              </div>
            )}
            {monthlyGoal > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Ring pct={goalPct} color={goalPct >= 100 ? 'var(--green-ink)' : 'var(--primary)'} big={`${goalPct}%`} small="of goal" />
                <div style={{ fontSize: 13, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{fmt(monthlySales)}</div>
                  <div className="muted">of {fmt(monthlyGoal)}</div>
                  <div style={{ marginTop: 6, fontWeight: 600, color: goalPct >= 100 ? 'var(--green-ink)' : 'var(--ink-2)' }}>{goalPct >= 100 ? '🎉 Goal achieved!' : `${fmt(monthlyGoal - monthlySales)} to go`}</div>
                </div>
              </div>
            ) : <p className="muted" style={{ margin: 0 }}>Set a monthly revenue target to track progress.</p>}
          </div>

          <div className="d-card">
            <div className="d-head"><h3>💊 Business health</h3><span className="d-tag" style={{ color: hColor }}>{hLabel}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Ring pct={health} color={hColor} big={health} small="/ 100" />
              <div className="d-facts">
                <span>{margin >= 25 ? '✅' : margin >= 10 ? '⚠️' : '❌'} Margin {Math.round(margin)}%</span>
                <span>{overdueJobs.length === 0 ? '✅' : '⚠️'} Overdue {overdueJobs.length}</span>
                <span>{lowStock.length === 0 ? '✅' : '⚠️'} Low stock {lowStock.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="d-grid g-3">
        <div className="d-card">
          <div className="d-head"><h3>Job pipeline</h3><span className="muted">{jobs.length} total</span></div>
          <div className="d-stack">{pipeline.filter(p => p.n > 0).map(p => <i key={p.s} title={`${p.s}: ${p.n}`} style={{ width: `${(p.n / totalJobs) * 100}%`, background: STATUS_COLORS[p.s]?.color }} />)}</div>
          <div className="d-legend">{pipeline.map(p => <div key={p.s}><i style={{ background: STATUS_COLORS[p.s]?.color }} /><span>{p.s}</span><b>{p.n}</b></div>)}</div>
        </div>

        <div className="d-card">
          <div className="d-head"><h3>⏰ Due this week</h3><button className="d-link" onClick={() => setActiveTab('jobs')}>All jobs →</button></div>
          {dueSoon.length === 0 ? <p className="muted" style={{ margin: 0 }}>Nothing due in the next 7 days.</p> : dueSoon.map(j => {
            const d = daysLeft(j.due_date);
            return (
              <div key={j.id} className="d-row">
                <div style={{ minWidth: 0 }}><b>{j.job_no}</b> <span className="muted">· {j.customer}</span><div className="muted ellip">{j.description}</div></div>
                <span className={`d-tag ${d <= 1 ? 'hot' : ''}`}>{d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`}</span>
              </div>
            );
          })}
        </div>

        <div className="d-card">
          <div className="d-head"><h3>🏭 Machine workload</h3><span className="muted">queued + running</span></div>
          {load.map(l => (
            <div key={l.m} className="d-bar">
              <span className="ellip">{l.m}</span>
              <div><i style={{ width: `${(l.n / maxLoad) * 100}%` }} /></div>
              <b>{l.n}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="d-grid g-2-1">
        <div className="d-card">
          <div className="d-head"><h3>Recent jobs</h3><button className="d-link" onClick={() => setActiveTab('jobs')}>View all →</button></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Job #', 'Customer', 'Description', 'Due', 'Price', 'Status'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>
                {[...jobs].sort((a, b) => (b.job_no || '').localeCompare(a.job_no || '')).slice(0, 6).map(j => (
                  <tr key={j.id}>
                    <TD style={{ fontWeight: 700, color: 'var(--primary)' }}>{j.job_no}</TD>
                    <TD>{j.customer}</TD><TD>{j.description}</TD>
                    <TD style={{ color: j.due_date < today && !['completed', 'cancelled'].includes(j.status) ? 'var(--red-ink)' : 'var(--ink-2)' }}>{j.due_date}</TD>
                    <TD style={{ fontWeight: 600 }}>{fmt(j.price)}</TD>
                    <TD><Badge text={j.status} /></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14, minWidth: 0, alignContent: 'start' }}>
          <div className="d-card">
            <div className="d-head"><h3>🏆 Top customers</h3><span className="muted">by job value</span></div>
            {topCust.length === 0 ? <p className="muted" style={{ margin: 0 }}>No jobs yet.</p> : topCust.map(([name, v], i) => (
              <div key={name} className="d-bar">
                <span className="ellip">{i + 1}. {name}</span>
                <div><i style={{ width: `${(v / topMax) * 100}%`, background: 'var(--primary)' }} /></div>
                <b>{fmt(v)}</b>
              </div>
            ))}
          </div>
          <div className="d-card" style={lowStock.length ? { borderColor: 'var(--red-line)' } : undefined}>
            <div className="d-head"><h3>📦 Stock alerts</h3><button className="d-link" onClick={() => setActiveTab('inventory')}>Inventory →</button></div>
            {lowStock.length === 0 ? <p className="muted" style={{ margin: 0 }}>✅ All items are above reorder level.</p> : lowStock.slice(0, 5).map(i => (
              <div key={i.id} className="d-row"><span className="ellip"><b>{i.name}</b></span><span className="d-tag hot">{i.quantity} {i.unit} left</span></div>
            ))}
            {lowStock.length > 5 && <div className="muted" style={{ marginTop: 6 }}>+{lowStock.length - 5} more</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

const EMPTY_JOB = { customer: '', customer_id: '', description: '', type: 'Digital', status: 'queued', priority: 'normal', due_date: '', start_date: '', price: '', cost: '', machine: '', notes: '', delivery_status: 'pending', assigned_to: '', payment_method: 'Cash', whatsapp: '' };

function JobsTab({ allJobs, jobs, setJobs, customers, addNotif, userId, inventory, setInventory, jobMaterials, setJobMaterials }) {
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
  const [smsSendingId, setSmsSendingId] = useState(null);

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
    const nums = (allJobs || jobs).map(j => parseInt((j.job_no||'PSM-000').split('-')[1] || 0));
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

  const sendSmsNotification = async (job) => {
    const phone = job.whatsapp;
    if (!phone) { alert('This job has no phone number on file.'); return; }
    setSmsSendingId(job.id);
    try {
      const message = `Hi ${job.customer}, your print job ${job.job_no} (${job.description}) is ready for pickup at Bigbiney Printing Press. Total: GHS ${Number(job.price).toFixed(2)}.`;
      const res = await fetch('/api/hubtel/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message }),
      });
      if (res.ok) {
        const { data, error } = await db.updateJob(job.id, { sms_notified_at: new Date().toISOString() });
        if (!error) setJobs(jobs.map(j => j.id === job.id ? data : j));
        addNotif(`SMS sent to ${job.customer}`, 'success');
      } else {
        addNotif(`SMS failed for ${job.customer}`, 'warning');
      }
    } catch (e) {
      addNotif(`SMS failed for ${job.customer}`, 'warning');
    } finally {
      setSmsSendingId(null);
    }
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search…" style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', fontSize: 13 }} />
          <Btn onClick={openNew}>+ New Job</Btn>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', ...JOB_STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: filter === s ? 'var(--primary)' : '#fff', color: filter === s ? '#fff' : 'var(--muted)', borderColor: filter === s ? 'var(--primary)' : 'var(--line)' }}>
            {s === 'all' ? `All (${jobs.length})` : `${s} (${jobs.filter(j=>j.status===s).length})`}
          </button>
        ))}
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Job #','Customer','Description','Type','Assigned','Due','Price','Profit','Payment','Delivery','Status','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {filtered.map(j => {
              const profit = (j.price||0) - (j.cost||0);
              const margin = j.price > 0 ? Math.round((profit / j.price) * 100) : 0;
              return (
                <tr key={j.id}>
                  <TD style={{ fontWeight: 700, color: 'var(--primary)' }}>{j.job_no}</TD>
                  <TD>{j.customer}</TD>
                  <TD style={{ maxWidth: 160 }}>{j.description}</TD>
                  <TD>{j.type}</TD>
                  <TD style={{ color: 'var(--muted)', fontSize: 12 }}>{j.assigned_to || '—'}</TD>
                  <TD style={{ color: j.due_date < todayStr() && !['completed','cancelled'].includes(j.status) ? '#dc2626' : 'var(--ink-2)' }}>{j.due_date || '—'}</TD>
                  <TD style={{ fontWeight: 600 }}>{fmt(j.price)}</TD>
                  <TD><span style={{ fontWeight: 700, color: profit >= 0 ? '#16a34a' : '#dc2626', fontSize: 12 }}>{fmt(profit)}<br/><span style={{ fontSize: 10 }}>{margin}%</span></span></TD>
                  <TD>
                    {j.payment_method === 'Payment Not Received'
                      ? <span style={{ background: 'var(--red-bg)', color: '#dc2626', border: '1px solid var(--red-line)', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>⏳ UNPAID</span>
                      : j.payment_method === 'Partial Payment'
                      ? <span style={{ background: 'var(--amber-bg)', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>💸 PARTIAL</span>
                      : <span style={{ background: 'var(--green-bg)', color: 'var(--green-ink)', border: '1px solid var(--green-line)', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>✓ {j.payment_method||'Cash'}</span>}
                  </TD>
                  <TD>
                    <select value={j.delivery_status || 'pending'} onChange={e => updateField(j.id, 'delivery_status', e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '3px 6px', fontSize: 11, background: DELIVERY_COLORS[j.delivery_status||'pending']?.bg, color: DELIVERY_COLORS[j.delivery_status||'pending']?.color, cursor: 'pointer', fontWeight: 700 }}>
                      {DELIVERY_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </TD>
                  <TD>
                    <select value={j.status} onChange={e => updateField(j.id, 'status', e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '3px 6px', fontSize: 11, background: STATUS_COLORS[j.status]?.bg, color: STATUS_COLORS[j.status]?.color, cursor: 'pointer', fontWeight: 700 }}>
                      {JOB_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      <Btn variant="ghost"   small onClick={() => openEdit(j)}>Edit</Btn>
                      <Btn variant="ghost"   small onClick={() => printTicket(j)}>🖨️</Btn>
                      <Btn variant="teal"    small onClick={() => setMsgModal(j)}>📲</Btn>
                      <Btn variant="primary" small onClick={() => sendSmsNotification(j)} disabled={smsSendingId === j.id || !j.whatsapp}>
                        {smsSendingId === j.id ? '…' : j.sms_notified_at ? '✓ SMS' : '📱 SMS'}
                      </Btn>
                      <Btn variant="ghost"   small onClick={() => setMatModal(j)}>📦</Btn>
                      <Btn variant="warning" small onClick={() => duplicate(j)}>Copy</Btn>
                      <Btn variant="danger"  small onClick={() => del(j.id)}>Del</Btn>
                    </div>
                  </TD>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={12} style={{ textAlign: 'center', padding: 32, color: 'var(--faint)' }}>No jobs found</td></tr>}
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
              <option value="Payment Not Received">⏳ Payment Not Received</option>
              <option value="Partial Payment">💸 Partial Payment</option>
              <option value="Cash">💵 Cash</option>
              <option value="Mobile Money">📱 Mobile Money</option>
              <option value="Bank Transfer">🏦 Bank Transfer</option>
              <option value="Credit">💳 Credit</option>
              <option value="Other">Other</option>
            </Sel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Customer WhatsApp</label>
              <select value={form.whatsapp||''} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: 'var(--ink)', background: 'var(--surface)' }}>
                <option value="">— Select or type below —</option>
                {customers.filter(c => c.whatsapp || c.phone).map(c => (
                  <option key={c.id} value={c.whatsapp || c.phone}>{c.name} — {c.whatsapp || c.phone}</option>
                ))}
              </select>
              <input placeholder="Or type: +233..." value={form.whatsapp||''} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--ink)', background: 'var(--surface)', marginTop: 4 }} />
            </div>
            <Inp label="Start Date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <Inp label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <Inp label="Price (GH₵)" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            <Inp label="Est. Cost (GH₵)" type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
            {form.price && form.cost && (
              <div style={{ gridColumn: '1/-1', background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 6, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                  Estimated Profit: {fmt((parseFloat(form.price)||0)-(parseFloat(form.cost)||0))} ({form.price > 0 ? Math.round((((parseFloat(form.price)||0)-(parseFloat(form.cost)||0))/(parseFloat(form.price)||1))*100) : 0}% margin)
                </span>
              </div>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={closeModal}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Job'}</Btn>
          </div>
        </Modal>
      )}

      {msgModal && <WhatsAppMsgModal job={msgModal} customers={customers} onClose={() => setMsgModal(null)} />}
      {matModal && <JobMaterialsModal job={matModal} inventory={inventory} setInventory={setInventory} jobMaterials={jobMaterials.filter(m => m.job_id === matModal.id)} setJobMaterials={setJobMaterials} userId={userId} addNotif={addNotif} onClose={() => setMatModal(null)} />}

      {autoNotifQ.length > 0 && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 9998, width: 340 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>📲 Send Status Update?</span>
            <button onClick={() => setAutoNotifQ([])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--faint)' }}>×</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>Job <strong>{autoNotifQ[0].job.job_no}</strong> → <strong>{autoNotifQ[0].job.status}</strong>. Notify {autoNotifQ[0].job.customer}?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { openWhatsApp(autoNotifQ[0].phone, autoNotifQ[0].msg); setAutoNotifQ(q => q.slice(1)); addNotif(`WhatsApp sent to ${autoNotifQ[0].job.customer}`, 'success'); }} style={{ flex: 1, background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '8px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Send WhatsApp</button>
            <button onClick={() => setAutoNotifQ(q => q.slice(1))} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>Skip</button>
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
        {jobMaterials.length === 0 ? <p style={{ color: 'var(--faint)', fontSize: 13 }}>No materials linked yet</p> : (
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
      {jobMaterials.length > 0 && <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 6, padding: '10px 14px' }}><span style={{ fontWeight: 700, color: '#16a34a' }}>Total Material Cost: {fmt(totalCost)}</span></div>}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}><Btn variant="ghost" onClick={onClose}>Close</Btn></div>
    </Modal>
  );
}

function WhatsAppMsgModal({ job, customers, onClose }) {
  const [phone, setPhone] = useState(job.whatsapp || '');
  const [msgType, setMsgType] = useState(job.status || 'completed');
  const [msg, setMsg]     = useState(generateStatusChangeMsg(job, job.status) || generateJobReadyMsg(job));

  useEffect(() => {
    if (!phone && job.customer_id) {
      const c = customers?.find(x => x.id === job.customer_id);
      if (c) setPhone(c.whatsapp || c.phone || '');
    }
  }, []);

  const handleMsgType = (type) => {
    setMsgType(type);
    if (type === 'ready') setMsg(generateJobReadyMsg(job));
    else if (type === 'payment_reminder') setMsg(generatePaymentReminderMsg(job));
    else if (type === 'thank_you') setMsg(generateThankYouMsg(job));
    else setMsg(generateStatusChangeMsg(job, type));
  };

  return (
    <Modal title="📲 WhatsApp Message" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Select from Contacts</label>
          <select value={phone} onChange={e => setPhone(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: 'var(--ink)', background: 'var(--surface)' }}>
            <option value="">— Pick a contact —</option>
            {(customers||[]).filter(c => c.whatsapp || c.phone).map(c => (
              <option key={c.id} value={c.whatsapp || c.phone}>{c.name} — {c.whatsapp || c.phone}</option>
            ))}
          </select>
          <input placeholder="Or type number: +233..." value={phone} onChange={e => setPhone(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', fontSize: 13, marginTop: 4 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Message Type</label>
          <select value={msgType} onChange={e => handleMsgType(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: 'var(--ink)', background: 'var(--surface)' }}>
            <option value="ready">✅ Job Ready for Pickup</option>
            {JOB_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)} notification</option>)}
            <option value="payment_reminder">💳 Payment Reminder</option>
            <option value="thank_you">🙏 Thank You</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>Message</label>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={8} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => navigator.clipboard.writeText(msg)} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>📋 Copy</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <button onClick={() => { if (phone) openWhatsApp(phone, msg); else alert('Select or enter a phone number first.'); }} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Open in WhatsApp</button>
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name, phone, email…" style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', fontSize: 13, minWidth: 180 }} />
          <Btn onClick={() => { setForm(EMPTY_CX); setEditId(null); setModal(true); }}>+ Add Customer</Btn>
          <label style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 6, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', opacity: importing ? 0.6 : 1 }}>
            {importing ? 'Importing…' : '📥 Import CSV'}
            <input type="file" accept=".csv" onChange={handleCSVImport} style={{ display: 'none' }} disabled={importing} />
          </label>
          <Btn variant="ghost" onClick={downloadTemplate}>📄 Template</Btn>
          {customers.length > 0 && <Btn variant="danger" onClick={delAll}>🗑️ Delete All</Btn>}
        </div>
      </div>
      <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 6, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--green-ink)' }}>
        📥 <strong>CSV Import:</strong> Your file needs a <strong>name</strong> column. Optional: email, phone, whatsapp, address. <button onClick={downloadTemplate} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>Download template →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Customers" value={customers.length} accent="var(--primary)" />
        <StatCard label="With WhatsApp"   value={customers.filter(c=>c.whatsapp||c.phone).length} accent="#25D366" />
        <StatCard label="Outstanding"     value={fmt(invoices.filter(i=>i.status!=='paid').reduce((a,i)=>a+(i.amount-i.paid),0))} accent="#dc2626" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Name','Email','Phone','WhatsApp','Jobs','Revenue','Outstanding','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {filtered.map(c => {
                const cJobs = jobs.filter(j => j.customer_id === c.id);
                const cRev  = invoices.filter(i => i.customer_id === c.id).reduce((a,i) => a+(i.paid||0), 0);
                const cOwed = invoices.filter(i => i.customer_id === c.id && i.status !== 'paid').reduce((a,i) => a+(i.amount-i.paid), 0);
                const wa    = c.whatsapp || c.phone || '';
                return (
                  <tr key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)} style={{ borderBottom: '1px solid var(--line-soft)', cursor: 'pointer', background: selected?.id === c.id ? '#eff6ff' : 'transparent' }}>
                    <TD style={{ fontWeight: 600 }}>{c.name}</TD>
                    <TD style={{ color: 'var(--muted)', fontSize: 12 }}>{c.email || '—'}</TD>
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
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--faint)' }}>No customers found</td></tr>}
            </tbody>
          </table>
        </div>

        {selected && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{selected.name}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 3px' }}>📧 {selected.email || 'No email'}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 3px' }}>📞 {selected.phone || 'No phone'}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px' }}>💬 WhatsApp: {selected.whatsapp || selected.phone || 'Not set'}</p>
            {(selected.whatsapp || selected.phone) && (
              <button onClick={() => openWhatsApp(selected.whatsapp || selected.phone, `Hi ${selected.name}! This is Bigbiney Printing Press.`)} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'block', width: '100%' }}>
                💬 Open WhatsApp
              </button>
            )}
            <button onClick={() => printStatement(selected)} style={{ background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'block', width: '100%' }}>
              🖨️ Print Statement
            </button>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px' }}>📍 {selected.address || 'No address'}</p>
            <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Job History</h4>
            {jobs.filter(j => j.customer_id === selected.id).map(j => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{j.job_no}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{(j.description||'').substring(0, 28)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt(j.price)}</span>
                  <Badge text={j.status} />
                </div>
              </div>
            ))}
            {jobs.filter(j => j.customer_id === selected.id).length === 0 && <p style={{ fontSize: 12, color: 'var(--faint)' }}>No jobs yet</p>}
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
        <StatCard label="Total Items" value={inventory.length} accent="var(--primary)" />
        <StatCard label="Stock Value" value={fmt(totalValue)} accent="#16a34a" />
        <StatCard label="Low Stock"   value={lowCount} accent={lowCount > 0 ? '#dc2626' : '#16a34a'} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {cats.map(c => <button key={c} onClick={() => setCat(c)} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: cat === c ? 'var(--primary)' : '#fff', color: cat === c ? '#fff' : 'var(--muted)', borderColor: cat === c ? 'var(--primary)' : 'var(--line)' }}>{c}</button>)}
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto' }}>
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
                  <TD style={{ color: 'var(--muted)' }}>{item.reorder_point}</TD>
                  <TD>{fmt(item.unit_cost||0)}</TD>
                  <TD style={{ fontWeight: 600 }}>{fmt(item.quantity*(item.unit_cost||0))}</TD>
                  <TD style={{ color: 'var(--muted)' }}>{item.supplier}</TD>
                  <TD>{low ? <span style={{ background: 'var(--red-bg)', color: '#dc2626', border: '1px solid var(--red-line)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>⚠️ LOW</span> : <span style={{ background: 'var(--green-bg)', color: 'var(--green-ink)', border: '1px solid var(--green-line)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>OK</span>}</TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <button onClick={() => adjust(item.id, -1)} style={{ background: 'var(--red-bg)', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontWeight: 800, color: '#dc2626' }}>−</button>
                      <button onClick={() => adjust(item.id,  1)} style={{ background: 'var(--green-bg)', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', fontWeight: 800, color: '#16a34a' }}>+</button>
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
      job_id:      form.job_id || null,
      customer:    form.customer,
      customer_id: form.customer_id || null,
      due_date:    form.due_date || null,
      invoice_no:  `INV-${String(invoices.length + 1).padStart(3,'0')}`,
      date:        todayStr(),
      amount:      total,
      paid:        0,
      status:      'unpaid',
      items:       form.items,
    };
    const { data, error } = await db.addInvoice(userId, payload);
    if (!error) {
      setInvoices([...invoices, { ...data, items: form.items }]);
      addNotif(`Invoice ${payload.invoice_no} created`, 'success');
      setModal(false);
      setForm({ job_id: '', customer: '', customer_id: '', due_date: '', items: [{ desc: '', qty: 1, rate: '', total: 0 }] });
    } else {
      // If items column doesn't exist, retry without items
      const { job_id, customer, customer_id, due_date, invoice_no, date, amount, paid, status } = payload;
      const { data: d2, error: e2 } = await db.addInvoice(userId, { job_id, customer, customer_id, due_date, invoice_no, date, amount, paid, status });
      if (!e2) {
        setInvoices([...invoices, { ...d2, items: form.items }]);
        addNotif(`Invoice ${payload.invoice_no} created (run: alter table invoices add column items jsonb)`, 'success');
        setModal(false);
        setForm({ job_id: '', customer: '', customer_id: '', due_date: '', items: [{ desc: '', qty: 1, rate: '', total: 0 }] });
      } else addNotif('Error creating invoice: ' + e2.message, 'warning');
    }
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
    let items;
    // Try stored items first
    if (inv.items && inv.items !== 'null') {
      try {
        const parsed = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
        items = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
      } catch { items = null; }
    }
    // Fall back to linked job description
    if (!items) {
      const linkedJob = jobs.find(j => j.id === inv.job_id);
      if (linkedJob) {
        items = [{ desc: `${linkedJob.job_no} — ${linkedJob.description}`, qty: 1, rate: inv.amount, total: inv.amount }];
      } else {
        // Use invoice number as description reference
        items = [{ desc: `Print services — ${inv.invoice_no}`, qty: 1, rate: inv.amount, total: inv.amount }];
      }
    }
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
        <StatCard label="Total Invoiced" value={fmt(invoices.reduce((a,i)=>a+i.amount,0))} accent="var(--primary)" />
        <StatCard label="Collected"      value={fmt(invoices.reduce((a,i)=>a+i.paid,0))}   accent="#16a34a" />
        <StatCard label="Outstanding"    value={fmt(outstanding)} accent="#dc2626" />
        <StatCard label="Overdue"        value={invoices.filter(i=>i.status!=='paid'&&i.due_date<todayStr()).length} accent="#f59e0b" />
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Invoice #','Customer','Date','Due','Amount','Paid','Balance','Status','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id}>
                <TD style={{ fontWeight: 700, color: 'var(--primary)' }}>{inv.invoice_no}</TD>
                <TD>{inv.customer}</TD><TD>{inv.date}</TD>
                <TD style={{ color: inv.due_date < todayStr() && inv.status !== 'paid' ? '#dc2626' : 'var(--ink-2)' }}>{inv.due_date}</TD>
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
            {invoices.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--faint)' }}>No invoices yet</td></tr>}
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
              {jobs.filter(j => !form.customer || j.customer === form.customer).map(j => <option key={j.id} value={j.id}>{j.job_no} — {j.description} ({j.status})</option>)}
            </Sel>
            <Inp label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <h4 style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700 }}>Line Items</h4>
            {form.items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, alignItems: 'end' }}>
                <Inp placeholder="Description" value={item.desc} onChange={e => updateItem(idx, 'desc', e.target.value)} />
                <Inp placeholder="Qty" type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} />
                <Inp placeholder="Rate" type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} />
                <button onClick={() => setForm({ ...form, items: form.items.filter((_,i) => i !== idx) })} style={{ background: 'var(--red-bg)', border: 'none', borderRadius: 4, padding: '8px 10px', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>×</button>
              </div>
            ))}
            <Btn variant="ghost" onClick={() => setForm({ ...form, items: [...form.items, { desc: '', qty: 1, rate: '', total: 0 }] })}>+ Add Line</Btn>
            <div style={{ textAlign: 'right', fontSize: 17, fontWeight: 800, color: 'var(--primary)' }}>Total: {fmt(calcTotal(form.items))}</div>
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

const EXP_CATS = ['Paper', 'Ink & Toner', 'Maintenance', 'Salaries', 'Utilities', 'Other'];
const downloadCSV = (name, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
};
const BarList = ({ rows }) => rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>No data for this period.</p> : rows.map(r => (
  <div key={r.label} className="d-bar"><span className="ellip">{r.label}</span><div><i style={{ width: `${r.pct}%`, background: r.color || 'var(--primary)' }} /></div><b>{r.right}</b></div>
));

/* ───────────── SALES: popup + receipt ───────────── */
const SQL_SETUP = `-- Run once in Supabase → SQL Editor. Safe to re-run.
alter table public.sales
  add column if not exists branch text, add column if not exists customer text,
  add column if not exists description text, add column if not exists items text,
  add column if not exists discount numeric default 0, add column if not exists total numeric,
  add column if not exists balance numeric default 0, add column if not exists reference text,
  add column if not exists received_by text, add column if not exists notes text,
  add column if not exists receipt_no text;
alter table public.expenses add column if not exists branch text;
alter table public.jobs      add column if not exists branch text;
alter table public.inventory add column if not exists branch text;
alter table public.invoices  add column if not exists branch text;
alter table public.loans     add column if not exists branch text;
alter table public.payroll
  add column if not exists basic numeric, add column if not exists allowance numeric default 0,
  add column if not exists deductions numeric default 0, add column if not exists reference text,
  add column if not exists branch text;
create table if not exists public.activity_log (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  actor text, action text, entity text, details text, branch text,
  created_at timestamptz default now()
);
alter table public.activity_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'activity_log' and policyname = 'own activity') then
    create policy "own activity" on public.activity_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.debts (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  customer text not null, phone text,
  amount numeric not null default 0, paid numeric not null default 0,
  kind text default 'Sale on credit', reason text, notes text,
  date date default current_date, due_date date, branch text,
  payments text default '[]', created_at timestamptz default now()
);
alter table public.debts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'debts' and policyname = 'own debts') then
    create policy "own debts" on public.debts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

alter table public.sales
  add column if not exists written_off numeric default 0, add column if not exists writeoff_date date,
  add column if not exists writeoff_reason text;
alter table public.debts
  add column if not exists written_off numeric default 0, add column if not exists writeoff_date date,
  add column if not exists writeoff_reason text;

notify pgrst, 'reload schema';
`;
const branchColReady = (sales) => sales.length === 0 || Object.prototype.hasOwnProperty.call(sales[0], 'branch');
const DbWarn = () => (
  <div className="d-alert" style={{ marginBottom: 12 }}><span style={{ fontSize: 18 }}>⚠️</span>
    <div style={{ flex: 1, minWidth: 0 }}><b>Database update needed for branches</b><div style={{ fontSize: 12 }}>Run the setup SQL once in Supabase → SQL Editor. Until then every sale is saved under the main branch.</div></div>
    <button className="d-wa" style={{ background: 'var(--primary)' }} onClick={() => { try { navigator.clipboard.writeText(SQL_SETUP); } catch {} alert('SQL copied. Open Supabase → SQL Editor, paste it and press Run. Then refresh this page.'); }}>📋 Copy SQL</button>
  </div>
);

const PriceCtx = React.createContext([]);
const PAY_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Credit', 'Partial Payment', 'Other'];
const QUICK_ITEMS = ['Printing', 'Photocopy', 'Banner', 'T-shirt', 'Business cards', 'Flyers', 'Lamination', 'Binding'];
const parseItems = (x) => { if (!x) return []; if (Array.isArray(x)) return x; try { return JSON.parse(x) || []; } catch { return []; } };
const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const printReceipt = (sale, branch) => {
  const items = parseItems(sale.items);
  const total = sale.total ?? sale.amount;
  const lines = (items.length ? items : [{ desc: sale.description || 'Sale', qty: 1, price: total }])
    .map(i => `<tr><td>${escHtml(i.desc)}<br><small>${i.qty} × ${fmt(i.price)}</small></td><td style="text-align:right">${fmt(i.qty * i.price)}</td></tr>`).join('');
  const w = window.open('', '_blank', 'width=380,height=640');
  if (!w) { alert('Please allow pop-ups to print the receipt.'); return; }
  w.document.write(`<html><head><title>${escHtml(sale.receipt_no || 'Receipt')}</title><style>body{font:13px system-ui,sans-serif;padding:16px;max-width:320px;margin:auto}h3,p{margin:2px 0;text-align:center}table{width:100%;border-collapse:collapse;margin:10px 0}td{padding:5px 0;border-bottom:1px dashed #bbb}.t td{border:0;font-weight:700}small{color:#666}</style></head><body>
<h3>Bigbiney Printing Press</h3><p>${escHtml(branch?.name || sale.branch || '')}</p>${branch?.address ? `<p>${escHtml(branch.address)}</p>` : ''}${branch?.phone ? `<p>Tel: ${escHtml(branch.phone)}</p>` : ''}
<p style="margin-top:8px"><b>${escHtml(sale.receipt_no || '')}</b> · ${escHtml(sale.date)}</p><p>Customer: ${escHtml(sale.customer || 'Walk-in')}</p>
<table>${lines}
${sale.discount > 0 ? `<tr class="t"><td>Discount</td><td style="text-align:right">-${fmt(sale.discount)}</td></tr>` : ''}
<tr class="t"><td>Total</td><td style="text-align:right">${fmt(total)}</td></tr>
<tr class="t"><td>Paid (${escHtml(sale.payment_method || '')})</td><td style="text-align:right">${fmt(sale.amount)}</td></tr>
${sale.balance > 0 ? `<tr class="t"><td>Balance due</td><td style="text-align:right">${fmt(sale.balance)}</td></tr>` : ''}</table>
${sale.reference ? `<p>Ref: ${escHtml(sale.reference)}</p>` : ''}<p style="margin-top:12px">Thank you for your business!</p></body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
};

function SaleReceipt({ sale, branch, customers = [], onClose, onNew }) {
  const items = parseItems(sale.items);
  const total = sale.total ?? sale.amount;
  const rows = items.length ? items : [{ desc: sale.description || 'Sale', qty: 1, price: total }];
  const cx = customers.find(c => c.name === sale.customer);
  const phone = cx?.whatsapp || cx?.phone;
  const msg = `🧾 *Bigbiney Printing Press*${branch?.name ? ` — ${branch.name}` : ''}\nReceipt ${sale.receipt_no || ''} · ${sale.date}\n\n${rows.map(i => `• ${i.desc}: ${i.qty} × ${fmt(i.price)} = ${fmt(i.qty * i.price)}`).join('\n')}\n\nTotal: ${fmt(total)}\nPaid: ${fmt(sale.amount)}${sale.balance > 0 ? `\nBalance due: ${fmt(sale.balance)}` : ''}\n\nThank you! 🙏`;
  return (
    <Modal title={`🧾 Receipt ${sale.receipt_no || ''}`} onClose={onClose}>
      <div className="rcpt">
        <div className="rcpt-h"><b>Bigbiney Printing Press</b><div>{branch?.name || sale.branch}{branch?.address ? ` · ${branch.address}` : ''}</div>{branch?.phone && <div>☎ {branch.phone}</div>}</div>
        <div className="ln-r"><span>Date</span><b>{sale.date}</b></div>
        <div className="ln-r"><span>Customer</span><b>{sale.customer || 'Walk-in'}</b></div>
        {sale.received_by && <div className="ln-r"><span>Served by</span><b>{sale.received_by}</b></div>}
        <hr />
        {rows.map((i, k) => <div key={k} className="ln-r"><span>{i.desc} <span className="muted">{i.qty} × {fmt(i.price)}</span></span><b>{fmt(i.qty * i.price)}</b></div>)}
        <hr />
        {sale.discount > 0 && <div className="ln-r"><span>Discount</span><b>−{fmt(sale.discount)}</b></div>}
        <div className="ln-r"><span>Total</span><b>{fmt(total)}</b></div>
        <div className="ln-r"><span>Paid ({sale.payment_method})</span><b style={{ color: 'var(--green-ink)' }}>{fmt(sale.amount)}</b></div>
        {sale.balance > 0 && <div className="ln-r"><span>Balance due</span><b style={{ color: 'var(--red-ink)' }}>{fmt(sale.balance)}</b></div>}
        {sale.reference && <div className="ln-r"><span>Reference</span><b>{sale.reference}</b></div>}
        {sale.notes && <div className="muted" style={{ marginTop: 6 }}>📝 {sale.notes}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <Btn onClick={() => printReceipt(sale, branch)}>🖨️ Print slip</Btn>
        <Btn variant="purple" onClick={() => printOfficialReceipt({ no: sale.receipt_no, date: sale.date, received_from: sale.customer || 'Walk-in', amount: sale.amount, words: amountInWords(sale.amount), being: sale.description, mode: ['Cash', 'Mobile Money', 'Bank Transfer'].includes(sale.payment_method) ? sale.payment_method : 'Cash', cheque_no: sale.reference, balance: sale.balance > 0 ? sale.balance : '', received_by: sale.received_by }, branch)}>🧾 Official receipt</Btn>
        <Btn variant="success" disabled={!phone} onClick={() => openWhatsApp(phone, msg)}>{phone ? '📲 Send via WhatsApp' : '📲 No customer phone'}</Btn>
        {onNew && <Btn variant="ghost" onClick={onNew}>+ New sale</Btn>}
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );
}

function SaleModal({ onClose, customers = [], branches = [], defaultBranch, userId, sales, setSales, addNotif }) {
  const brs = branches.length ? branches : [{ name: 'Main Branch' }];
  const priceList = React.useContext(PriceCtx);
  const blank = { date: todayStr(), branch: defaultBranch || brs[0].name, customer: '', payment_method: 'Cash', reference: '', received_by: '', notes: '', discount: '' };
  const [f, setF] = useState(blank);
  const [items, setItems] = useState([{ desc: '', qty: 1, price: '' }]);
  const [recv, setRecv] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const ready = branchColReady(sales);
  const blocked = !ready && f.branch !== brs[0].name;

  const subtotal = items.reduce((a, i) => a + (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0), 0);
  const discount = Math.min(subtotal, parseFloat(f.discount) || 0);
  const total    = subtotal - discount;
  const received = Math.min(total, touched ? (parseFloat(recv) || 0) : total);
  const balance  = Math.max(0, total - received);
  const setItem  = (i, k, v) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const addItem  = (desc = '', price = '') => setItems([...items.filter(x => x.desc || x.price), { desc, qty: 1, price: price === '' ? '' : String(price) }]);
  const reset = () => { setDone(null); setF({ ...blank, branch: f.branch, date: f.date }); setItems([{ desc: '', qty: 1, price: '' }]); setRecv(''); setTouched(false); };

  const save = async () => {
    const valid = items.filter(i => (parseFloat(i.price) || 0) > 0).map(i => ({ desc: i.desc.trim() || 'Sale', qty: parseFloat(i.qty) || 1, price: parseFloat(i.price) }));
    if (!valid.length || total <= 0) { addNotif('Add at least one item with a price', 'warning'); return; }
    setSaving(true); setErrMsg('');
    const n = sales.filter(s => s.date === f.date).length + 1;
    const payload = {
      date: f.date, amount: received, job_id: null,
      payment_method: received === 0 ? 'Credit' : f.payment_method,
      branch: f.branch, customer: f.customer.trim() || 'Walk-in',
      description: valid.map(i => `${i.desc} ×${i.qty}`).join(', '), items: JSON.stringify(valid),
      discount, total, balance, reference: f.reference, received_by: f.received_by, notes: f.notes,
      receipt_no: `RC-${f.date.replace(/-/g, '')}-${String(n).padStart(3, '0')}`,
    };
    const { data, error, degraded } = await db.addSale(userId, payload);
    setSaving(false);
    if (error) { const m = 'Could not save sale: ' + (error.message || error); setErrMsg(m); addNotif(m, 'warning'); return; }
    if (data) setSales(prev => (prev.some(s => s.id === data.id) ? prev : [...prev, data]));
    addNotif(`Sale of ${fmt(received)} recorded${balance > 0 ? ` (${fmt(balance)} still owed)` : ''}`, 'success');
    if (degraded) addNotif('Saved, but branch/receipt details need the database update (run branches_setup.sql in Supabase)', 'warning');
    setDone({ ...payload, ...(data || {}) });
  };

  if (done) return <SaleReceipt sale={done} branch={brs.find(b => b.name === done.branch)} customers={customers} onClose={onClose} onNew={reset} />;

  return (
    <Modal title="💰 Record Sale" onClose={onClose} wide>
      <datalist id="sm-cx">{customers.slice(0, 2000).map(c => <option key={c.id} value={c.name} />)}</datalist>
      <datalist id="sm-prices">{priceList.map(p => <option key={p.id || p.name} value={p.name}>{fmt(p.price)} per {p.unit}</option>)}</datalist>
      {!ready && <DbWarn />}
      {errMsg && <p className="err">{errMsg}</p>}
      {blocked && <p className="err">Saving to “{f.branch}” isn't possible until the database update is run — the sale would be recorded under {brs[0].name} instead.</p>}
      <div className="sm-grid">
        <Inp label="Date" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
        <Sel label="Branch" value={f.branch} onChange={e => setF({ ...f, branch: e.target.value })}>{brs.map(b => <option key={b.name}>{b.name}</option>)}</Sel>
        <Inp label="Customer (empty = walk-in)" list="sm-cx" value={f.customer} onChange={e => setF({ ...f, customer: e.target.value })} placeholder="Walk-in customer" />
        <Sel label="Served by" value={f.received_by} onChange={e => setF({ ...f, received_by: e.target.value })}><option value="">—</option>{STAFF_LIST.map(s => <option key={s}>{s}</option>)}</Sel>
      </div>

      <div className="sm-sec">Items / services</div>
      <div className="d-chips" style={{ marginBottom: 8 }}>{(priceList.length ? priceList.slice(0, 10) : QUICK_ITEMS.map(n => ({ name: n }))).map(q => <button key={q.name} type="button" className="d-act" style={{ padding: '4px 10px', fontSize: 12, boxShadow: 'none' }} onClick={() => addItem(q.name, q.price ?? '')}>+ {q.name}{q.price != null ? ` · ${fmt(q.price)}` : ''}</button>)}</div>
      <div className="sm-item sm-head"><span>Description</span><span>Qty</span><span>Unit price</span><span>Total</span><span /></div>
      {items.map((it, i) => (
        <div key={i} className="sm-item">
          <input list="sm-prices" placeholder="e.g. A3 colour print" value={it.desc} onChange={e => { const v = e.target.value, m = priceList.find(p => p.name.toLowerCase() === v.toLowerCase()); setItems(items.map((x, j) => (j === i ? { ...x, desc: v, price: m && !x.price ? String(m.price) : x.price } : x))); }} />
          <input type="number" min="0" placeholder="Qty" value={it.qty} onChange={e => setItem(i, 'qty', e.target.value)} />
          <input type="number" min="0" placeholder="0.00" value={it.price} onChange={e => setItem(i, 'price', e.target.value)} />
          <b>{fmt((parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0))}</b>
          <button className="sm-x" aria-label="Remove item" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [{ desc: '', qty: 1, price: '' }])}>×</button>
        </div>
      ))}
      <button className="d-link" onClick={() => addItem('')}>+ Add another item</button>

      <div className="sm-sec">Payment</div>
      <div className="sm-grid">
        <Inp label="Discount (GH₵)" type="number" value={f.discount} onChange={e => setF({ ...f, discount: e.target.value })} />
        <Sel label="Payment method" value={f.payment_method} onChange={e => setF({ ...f, payment_method: e.target.value })}>{PAY_METHODS.map(m => <option key={m}>{m}</option>)}</Sel>
        <Inp label="Reference / MoMo transaction ID" value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} />
        <div className="fld"><label>Amount received (GH₵)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" value={touched ? recv : (total ? String(total) : '')} onChange={e => { setTouched(true); setRecv(e.target.value); }} />
            <Btn small variant="ghost" onClick={() => { setTouched(false); setRecv(''); }}>Full</Btn>
            <Btn small variant="ghost" onClick={() => { setTouched(true); setRecv('0'); }}>None</Btn>
          </div>
        </div>
      </div>
      <Inp label="Notes" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Optional" />

      <div className="sm-sum">
        <div className="ln-r"><span>Subtotal</span><b>{fmt(subtotal)}</b></div>
        {discount > 0 && <div className="ln-r"><span>Discount</span><b>−{fmt(discount)}</b></div>}
        <div className="ln-r" style={{ fontSize: 16 }}><span>Total</span><b>{fmt(total)}</b></div>
        <div className="ln-r"><span>Received now</span><b style={{ color: 'var(--green-ink)' }}>{fmt(received)}</b></div>
        <div className="ln-r"><span>Balance owed by customer</span><b style={{ color: balance > 0 ? 'var(--red-ink)' : 'var(--muted)' }}>{fmt(balance)}</b></div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="success" disabled={saving || blocked} onClick={save}>{saving ? 'Saving…' : '✔ Save sale & get receipt'}</Btn>
      </div>
    </Modal>
  );
}

/* ───────────── OFFICIAL RECEIPTS ───────────── */
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENSW = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const below1000 = (n) => {
  let s = '';
  if (n >= 100) { s += ONES[Math.floor(n / 100)] + ' hundred'; n %= 100; if (n) s += ' and '; }
  if (n >= 20) s += TENSW[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''); else if (n > 0) s += ONES[n];
  return s;
};
const numToWords = (n) => {
  if (n === 0) return 'zero';
  const out = [];
  [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']].forEach(([v, nm]) => { if (n >= v) { out.push(below1000(Math.floor(n / v)) + ' ' + nm); n %= v; } });
  if (n > 0) out.push((out.length && n < 100 ? 'and ' : '') + below1000(n));
  return out.join(' ');
};
const amountInWords = (amt) => {
  const a = Math.round((Number(amt) || 0) * 100), c = Math.floor(a / 100), p = a % 100;
  if (a === 0) return 'Zero Ghana cedis only';
  let s = '';
  if (c > 0) s += `${numToWords(c)} Ghana ${c === 1 ? 'cedi' : 'cedis'}`;
  if (p > 0) s += `${c > 0 ? ' and ' : ''}${numToWords(p)} ${p === 1 ? 'pesewa' : 'pesewas'}`;
  return s.charAt(0).toUpperCase() + s.slice(1) + ' only';
};
const num2 = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const officialReceiptHTML = (r, branch, autoPrint = false) => {
  const b = branch || {};
  const mode = r.mode || 'Cash';
  const cb = (m) => `<span class="cb">${mode === m ? '✕' : ''}</span>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${escHtml(r.no || '')}</title><style>
@page{size:A5 landscape;margin:7mm}*{box-sizing:border-box}
html{font-size:min(calc(100vw / 52),15px)}body{margin:0;padding:.4em;font-family:Georgia,'Times New Roman',serif;color:#111;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.r{max-width:190mm;margin:0 auto;border:.16em solid #0a7fc2;border-radius:.9em;padding:1em 1.5em 1.1em}
.hd{display:flex;align-items:center;gap:.9em}.logo{width:3.2em;height:3.2em;border-radius:.8em;background:#0a7fc2;color:#fff;display:grid;place-items:center;font-size:1.5em;flex:none}
.org{flex:1;text-align:center;line-height:1.35}.nm{font:800 1.9em/1.1 Arial,sans-serif;color:#0a7fc2;letter-spacing:.02em}.nm span{color:#e8710a}.ct{font:.78em Arial,sans-serif;color:#333}
.no{font:.95em Arial,sans-serif;color:#c00;white-space:nowrap}.no b{font-size:1.25em}
.ttl{text-align:center;margin:.7em 0 .8em}.ttl span{display:inline-block;background:#111;color:#fff;border-radius:2em;padding:.25em 1.6em;font:700 1.15em Georgia,serif}
.row{display:flex;align-items:flex-end;gap:.5em;margin:.62em 0;font-size:1.02em}.row label{white-space:nowrap;font-weight:700}
.ln{flex:1;min-height:1.5em;border-bottom:.1em dotted #222;padding:0 .4em;font:600 1em Georgia,serif;overflow-wrap:anywhere}
.pay{align-items:center;flex-wrap:wrap;gap:.5em .8em}.pay>span.t{font-weight:700}
.cb{display:inline-block;width:1.25em;height:1.25em;border:.1em solid #111;text-align:center;line-height:1.1em;font:700 .9em Arial;vertical-align:middle;margin-left:.25em}
.bx{display:inline-block;min-width:7em;min-height:1.7em;border:.1em solid #111;border-radius:.3em;padding:.15em .5em;font:700 .95em Arial,sans-serif}
.ft{display:flex;justify-content:space-between;align-items:flex-end;margin-top:1.1em;gap:1.5em}
.amt{display:flex;align-items:center;gap:.5em;font:800 1.5em Arial}.amt .bx{min-width:9em;font-size:.8em;border-width:.12em;border-radius:.4em}
.sig{flex:1;max-width:18em;text-align:center}.sig .ln{flex:none;height:2.2em}.sig small{font:.78em Arial,sans-serif;color:#333}
</style></head><body><div class="r">
<div class="hd"><div class="logo">🖨️</div><div class="org"><div class="nm">BIGBINEY <span>PRINTING PRESS</span></div>
<div class="ct">${escHtml([b.name, b.address].filter(Boolean).join(' · '))}</div>${b.phone ? `<div class="ct">Tel: ${escHtml(b.phone)}</div>` : ''}</div>
<div class="no">No. <b>${escHtml(r.no || '')}</b></div></div>
<div class="ttl"><span>Official Receipt</span></div>
<div class="row"><label>Date</label><div class="ln">${escHtml(r.date)}</div></div>
<div class="row"><label>Received from</label><div class="ln">${escHtml(r.received_from)}</div></div>
<div class="row"><label>The sum of</label><div class="ln">${escHtml(r.words || amountInWords(r.amount))}</div></div>
<div class="row"><label>Being</label><div class="ln">${escHtml(r.being)}</div></div>
<div class="row pay"><span class="t">Cash</span>${cb('Cash')}<span class="t">Cheque</span>${cb('Cheque')}<span class="t">MoMo</span>${cb('Mobile Money')}<span class="t">Bank</span>${cb('Bank Transfer')}
<label>Cheque / Ref. No.</label><span class="bx">${escHtml(r.cheque_no)}</span><label>Balance</label><span class="bx">${r.balance === '' || r.balance == null ? '' : num2(r.balance)}</span></div>
<div class="ft"><div class="amt">GH₵ <span class="bx">${num2(r.amount)}</span></div>
<div class="sig"><div class="ln"></div><small>Signature${r.received_by ? ` — ${escHtml(r.received_by)}` : ''}</small></div></div>
</div>${autoPrint ? '<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>' : ''}</body></html>`;
};
const printOfficialReceipt = (r, branch) => {
  const w = window.open('', '_blank', 'width=900,height=650');
  if (!w) { alert('Please allow pop-ups to print the receipt.'); return; }
  w.document.write(officialReceiptHTML(r, branch, true)); w.document.close();
};

function ReceiptsTab({ branches = [], customers = [], userId, addNotif, setSales, activeBranch = 'all' }) {
  const list = branches.length ? branches : [{ name: 'Main Branch' }];
  const [rcpts, setRcpts] = useState([]);
  const blank = () => ({ date: todayStr(), branch: activeBranch !== 'all' ? activeBranch : list[0].name, received_from: '', amount: '', words: '', being: '', mode: 'Cash', cheque_no: '', balance: '', received_by: '', also_income: false });
  const [f, setF] = useState(blank());
  const [wordsEdited, setWordsEdited] = useState(false);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState(null);
  useEffect(() => { db.getSetting(userId, 'official_receipts').then(({ data }) => { if (data?.value) { try { setRcpts(JSON.parse(data.value)); } catch {} } }); }, [userId]);
  const persist = async (next) => { setRcpts(next); await db.setSetting(userId, 'official_receipts', JSON.stringify(next.slice(0, 1000))); };

  const maxNo = rcpts.reduce((a, r) => Math.max(a, parseInt(String(r.no || '').replace(/\D/g, ''), 10) || 0), 0);
  const nextNo = `OR-${String(maxNo + 1).padStart(4, '0')}`;
  const amt = parseFloat(f.amount) || 0;
  const draft = { ...f, no: nextNo, amount: amt, words: wordsEdited ? f.words : (amt ? amountInWords(amt) : ''), balance: f.balance === '' ? '' : parseFloat(f.balance) || 0 };
  const branchOf = (name) => list.find(b => b.name === name);
  const html = officialReceiptHTML(preview || draft, branchOf((preview || draft).branch));

  const issue = async (print) => {
    if (!amt || !f.received_from.trim()) { addNotif('Enter who paid and the amount', 'warning'); return; }
    const rec = { ...draft, id: Date.now(), created_at: new Date().toISOString() };
    delete rec.also_income;
    await persist([rec, ...rcpts]);
    if (f.also_income) {
      const { data } = await db.addSale(userId, { date: f.date, amount: amt, job_id: null, payment_method: f.mode === 'Cheque' ? 'Bank Transfer' : f.mode, branch: f.branch, customer: f.received_from, description: f.being, receipt_no: rec.no, reference: f.cheque_no, total: amt, balance: 0, received_by: f.received_by });
      if (data && setSales) setSales(p => (p.some(s => s.id === data.id) ? p : [...p, data]));
    }
    addNotif(`Receipt ${rec.no} issued${f.also_income ? ' and recorded as income' : ''}`, 'success');
    if (print) printOfficialReceipt(rec, branchOf(rec.branch));
    setF({ ...blank(), branch: f.branch, date: f.date }); setWordsEdited(false); setPreview(null);
  };
  const del = async (r) => { if (window.confirm(`Delete receipt ${r.no}?`)) { await persist(rcpts.filter(x => x.id !== r.id)); if (preview?.id === r.id) setPreview(null); } };
  const shown = rcpts.filter(r => (activeBranch === 'all' || (r.branch || list[0].name) === activeBranch) && (!q.trim() || `${r.no} ${r.received_from} ${r.being} ${r.date}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div>
      <div className="d-hero">
        <div><h2>🧾 Official Receipts</h2><p>Issue and print receipts like your paper receipt book · {rcpts.length} issued</p></div>
        <div className="d-actions"><button className="d-act" onClick={() => { setF(blank()); setWordsEdited(false); setPreview(null); }}>↺ New receipt</button></div>
      </div>
      <datalist id="rc-cx">{customers.slice(0, 2000).map(c => <option key={c.id} value={c.name} />)}</datalist>
      <div className="d-grid g-2">
        <div className="d-card">
          <div className="d-head"><h3>Receipt details</h3><span className="d-tag">{nextNo}</span></div>
          <div className="sm-grid">
            <Inp label="Date" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
            <Sel label="Branch" value={f.branch} onChange={e => setF({ ...f, branch: e.target.value })}>{list.map(b => <option key={b.name}>{b.name}</option>)}</Sel>
          </div>
          <Inp label="Received from *" list="rc-cx" value={f.received_from} onChange={e => setF({ ...f, received_from: e.target.value })} placeholder="Customer / payer name" />
          <div className="sm-grid" style={{ marginTop: 10 }}>
            <Inp label="Amount (GH₵) *" type="number" value={f.amount} onChange={e => { setF({ ...f, amount: e.target.value }); }} />
            <Inp label="Balance remaining (GH₵)" type="number" value={f.balance} onChange={e => setF({ ...f, balance: e.target.value })} />
          </div>
          <div className="fld" style={{ margin: '10px 0' }}><label>The sum of (auto-written, editable)</label>
            <textarea rows={2} value={draft.words} onChange={e => { setWordsEdited(true); setF({ ...f, words: e.target.value }); }} /></div>
          <Inp label="Being (payment for)" value={f.being} onChange={e => setF({ ...f, being: e.target.value })} placeholder="e.g. Printing of 500 flyers (deposit)" />
          <div className="sm-grid" style={{ marginTop: 10 }}>
            <Sel label="Payment mode" value={f.mode} onChange={e => setF({ ...f, mode: e.target.value })}>{['Cash', 'Cheque', 'Mobile Money', 'Bank Transfer'].map(m => <option key={m}>{m}</option>)}</Sel>
            <Inp label="Cheque no. / reference" value={f.cheque_no} onChange={e => setF({ ...f, cheque_no: e.target.value })} />
          </div>
          <Sel label="Received by (signature name)" value={f.received_by} onChange={e => setF({ ...f, received_by: e.target.value })}><option value="">—</option>{STAFF_LIST.map(s => <option key={s}>{s}</option>)}</Sel>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', fontSize: 13 }}><input type="checkbox" style={{ width: 'auto' }} checked={f.also_income} onChange={e => setF({ ...f, also_income: e.target.checked })} />Also record this payment as income in Finance</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn onClick={() => issue(true)}>🖨️ Issue & print</Btn>
            <Btn variant="ghost" onClick={() => issue(false)}>Save only</Btn>
          </div>
        </div>
        <div className="d-card">
          <div className="d-head"><h3>{preview ? `Preview — ${preview.no}` : 'Live preview'}</h3>{preview && <button className="d-link" onClick={() => setPreview(null)}>Back to draft</button>}</div>
          <iframe title="Receipt preview" srcDoc={html} style={{ width: '100%', aspectRatio: '210 / 150', border: '1px solid var(--line)', borderRadius: 12, background: '#fff' }} />
          {preview && <div style={{ marginTop: 10 }}><Btn onClick={() => printOfficialReceipt(preview, branchOf(preview.branch))}>🖨️ Print this receipt</Btn></div>}
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Prints on A5 landscape. In the print dialog choose "Save as PDF" to send it digitally.</p>
        </div>
      </div>

      <div className="d-card">
        <div className="d-head"><h3>Issued receipts</h3><div style={{ minWidth: 200 }}><Inp placeholder="Search no., name, details…" value={q} onChange={e => setQ(e.target.value)} /></div></div>
        {shown.length === 0 ? <p className="muted" style={{ margin: 0 }}>No receipts issued yet.</p> : (
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['No.', 'Date', 'Received from', 'Being', 'Mode', 'Amount', 'Balance', ''].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>{shown.slice(0, 100).map(r => (
              <tr key={r.id}>
                <TD style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.no}</TD><TD>{r.date}</TD><TD style={{ fontWeight: 600 }}>{r.received_from}</TD>
                <TD style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.being || '—'}</TD><TD>{r.mode}</TD>
                <TD style={{ fontWeight: 700, color: 'var(--green-ink)' }}>{fmt(r.amount)}</TD><TD>{r.balance === '' || r.balance == null ? '—' : fmt(r.balance)}</TD>
                <TD style={{ whiteSpace: 'nowrap' }}><button className="d-link" onClick={() => { setPreview(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>👁 View</button>{' '}<button className="d-link" onClick={() => printOfficialReceipt(r, branchOf(r.branch))}>🖨️ Print</button>{' '}<button className="d-link" style={{ color: 'var(--red-ink)' }} onClick={() => del(r)}>Delete</button></TD>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function FinanceTab({ sales, setSales, expenses, setExpenses, addNotif, userId, recurringExpenses, setRecurringExpenses, customers = [], branches = [], activeBranch = 'all' }) {
  const [viewSale, setViewSale] = useState(null);
  const [fBranch, setFBranch]   = useState('all');
  const firstBranch = branches[0]?.name;
  const defBranch = activeBranch !== 'all' ? activeBranch : (branches[0]?.name || '');
  useEffect(() => { setEf(x => ({ ...x, branch: defBranch })); }, [defBranch]);
  const [sf, setSf]         = useState({ date: todayStr(), amount: '', payment_method: 'Cash' });
  const [ef, setEf]         = useState({ date: todayStr(), category: 'Paper', description: '', amount: '', branch: defBranch });
  const [showSF, setShowSF] = useState(false);
  const [showEF, setShowEF] = useState(false);
  const [showRE, setShowRE] = useState(false);
  const [reForm, setReForm] = useState({ description: '', category: 'Salaries', amount: '', day_of_month: '1' });

  const [budgets, setBudgets]       = useState({});
  const [editBud, setEditBud]       = useState(false);
  const [fMonth, setFMonth]         = useState('all');
  const [q, setQ]                   = useState('');
  const [counted, setCounted]       = useState('');
  useEffect(() => {
    db.getSetting(userId, 'expense_budgets').then(({ data }) => { if (data?.value) { try { setBudgets(JSON.parse(data.value)); } catch {} } });
  }, [userId]);
  const saveBudgets = async (b) => { setBudgets(b); await db.setSetting(userId, 'expense_budgets', JSON.stringify(b)); };

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
    const { data, error } = await db.addExpense(userId, { date: ef.date, category: ef.category, description: ef.description, amount: parseFloat(ef.amount), branch: ef.branch || null });
    if (!error) { setExpenses([...expenses, data]); setEf({ date: todayStr(), category: 'Paper', description: '', amount: '', branch: ef.branch }); setShowEF(false); addNotif(`Expense of ${fmt(ef.amount)} recorded`, 'info'); }
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
  const dueRecurring = recurringExpenses.filter(re => re.active && re.day_of_month <= new Date().getDate() && !expenses.some(e => (e.date || '').startsWith(month) && e.description === re.description));

  const nowD = new Date(), dom = nowD.getDate(), dim = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0).getDate();
  const prevD = new Date(nowD.getFullYear(), nowD.getMonth() - 1, 1), prevKey = monthKey(prevD);
  const pSales = sumAmt(sales, s => s.date?.startsWith(prevKey)), pExp = sumAmt(expenses, e => e.date?.startsWith(prevKey));
  const m6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(nowD.getFullYear(), nowD.getMonth() - (5 - i), 1), k = monthKey(d); return { label: d.toLocaleString('en', { month: 'short' }), inc: sumAmt(sales, s => s.date?.startsWith(k)), exp: sumAmt(expenses, x => x.date?.startsWith(k)) }; });
  const projInc = (mSales / dom) * dim, projExp = (mExp / dom) * dim;
  const byDay = {}; sales.filter(s => s.date?.startsWith(month)).forEach(s => { byDay[s.date] = (byDay[s.date] || 0) + s.amount; });
  const bestDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  const margin = mSales > 0 ? ((mSales - mExp) / mSales) * 100 : 0;
  const catSpent = EXP_CATS.map(c => ({ c, spent: sumAmt(expenses, e => e.category === c && e.date?.startsWith(month)) }));
  const expectedCash = sales.filter(s => s.date === todayStr() && (s.payment_method || 'Cash') === 'Cash').reduce((a, s) => a + s.amount, 0);
  const monthOpts = [...new Set([...sales, ...expenses].map(x => (x.date || '').slice(0, 7)).filter(Boolean))].sort().reverse().slice(0, 24);
  const ql = q.trim().toLowerCase();
  const fSales = sales.filter(s => (fMonth === 'all' || s.date?.startsWith(fMonth)) && (fBranch === 'all' || (s.branch || firstBranch) === fBranch) && (!ql || `${s.date} ${s.payment_method || 'Cash'} ${s.amount} ${s.customer || ''} ${s.receipt_no || ''}`.toLowerCase().includes(ql)));
  const fExp   = expenses.filter(x => (fMonth === 'all' || x.date?.startsWith(fMonth)) && (fBranch === 'all' || (x.branch || firstBranch) === fBranch) && (!ql || `${x.date} ${x.category} ${x.description || ''} ${x.amount}`.toLowerCase().includes(ql)));
  const exportLedger = () => downloadCSV(`finance-${fMonth}.csv`, [['Type', 'Date', 'Branch', 'Receipt', 'Customer', 'Category/Method', 'Description', 'Total', 'Amount', 'Balance'], ...fSales.map(s => ['Income', s.date, s.branch || firstBranch || '', s.receipt_no || '', s.customer || '', s.payment_method || 'Cash', s.description || '', s.total ?? s.amount, s.amount, s.balance || 0]), ...fExp.map(x => ['Expense', x.date, x.branch || firstBranch || '', '', '', x.category, x.description, x.amount, x.amount, 0])]);

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

      <div className="d-kpis">
        <Kpi label="Monthly income" value={fmt(mSales)} icon="💵" color="var(--green-ink)" delta={pctChange(mSales, pSales)} spark={m6.map(m => m.inc)} />
        <Kpi label="Monthly expenses" value={fmt(mExp)} icon="💸" color="var(--red-ink)" delta={pctChange(mExp, pExp)} invert spark={m6.map(m => m.exp)} />
        <Kpi label="Monthly profit" value={fmt(mSales - mExp)} icon="📈" color="var(--primary)" delta={pctChange(mSales - mExp, pSales - pExp)} spark={m6.map(m => Math.max(0, m.inc - m.exp))} />
        <Kpi label="All-time revenue" value={fmt(sales.reduce((a, s) => a + s.amount, 0))} icon="🏦" color="var(--amber-ink)" delta={null} sub={`${sales.length} sales recorded`} />
      </div>

      <div className="d-grid g-2-1">
        <div className="d-card"><div className="d-head"><h3>Cash flow — last 6 months</h3></div><FlowChart series={m6} /></div>
        <div className="d-card">
          <div className="d-head"><h3>💡 This month's insights</h3></div>
          {[['Profit margin', `${Math.round(margin)}%`, margin >= 25 ? 'var(--green-ink)' : margin >= 10 ? 'var(--amber-ink)' : 'var(--red-ink)'],
            ['Avg daily income', fmt(mSales / dom)], ['Avg daily expense', fmt(mExp / dom)],
            ['Projected income', fmt(projInc)], ['Projected expenses', fmt(projExp)],
            ['Projected profit', fmt(projInc - projExp), projInc >= projExp ? 'var(--green-ink)' : 'var(--red-ink)'],
            ['Best sales day', bestDay ? `${bestDay[0].slice(5)} · ${fmt(bestDay[1])}` : '—']].map(([l, v, c]) => (
            <div key={l} className="d-row"><span className="muted">{l}</span><b style={{ color: c }}>{v}</b></div>
          ))}
        </div>
      </div>

      <div className="d-card" style={{ marginBottom: 14 }}>
        <div className="d-head"><h3>🎯 Monthly budgets — spent vs. limit</h3><button className="d-link" onClick={() => setEditBud(v => !v)}>{editBud ? 'Done' : 'Set budgets'}</button></div>
        <div className="d-grid g-3" style={{ marginBottom: 0 }}>
          {catSpent.map(({ c, spent }) => {
            const b = parseFloat(budgets[c]) || 0, pct = b > 0 ? Math.round((spent / b) * 100) : 0;
            return (
              <div key={c}>
                <div className="ln-r"><b>{c}</b><span>{fmt(spent)}{b > 0 ? ` / ${fmt(b)}` : ''}</span></div>
                {editBud ? <Inp type="number" placeholder="Budget (GH₵)" value={budgets[c] || ''} onChange={e => saveBudgets({ ...budgets, [c]: e.target.value })} />
                  : <><div className="ln-bar"><i style={{ width: `${Math.min(100, pct)}%`, background: pct > 100 ? 'var(--red-ink)' : pct > 80 ? 'var(--amber-ink)' : undefined }} /></div>
                    <div className="muted" style={{ fontSize: 11 }}>{b <= 0 ? 'No budget set' : pct > 100 ? `⚠️ Over by ${fmt(spent - b)}` : `${fmt(b - spent)} left (${pct}% used)`}</div></>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>🗃️ Today's Cash Drawer</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {['Cash','Mobile Money','Bank Transfer','Credit','Other'].map(method => {
            const total = sales.filter(s => s.date === todayStr() && (s.payment_method||'Cash') === method).reduce((a,s)=>a+s.amount,0);
            if (total === 0) return null;
            return <div key={method} style={{ background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{fmt(total)}</div><div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{method}</div></div>;
          })}
          <div style={{ background: 'var(--blue-bg)', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>{fmt(todaySales)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Today Total</div>
          </div>
          {todaySales === 0 && <span style={{ fontSize: 13, color: 'var(--faint)' }}>No sales recorded today yet</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Inp label="Cash counted in drawer" type="number" value={counted} onChange={e => setCounted(e.target.value)} placeholder="GH₵" />
            {counted !== '' && <div style={{ fontWeight: 800, fontSize: 13, paddingBottom: 10, color: parseFloat(counted) === expectedCash ? 'var(--green-ink)' : 'var(--red-ink)' }}>{parseFloat(counted) === expectedCash ? '✅ Balanced' : `${parseFloat(counted) > expectedCash ? 'Over' : 'Short'} by ${fmt(Math.abs(parseFloat(counted) - expectedCash))}`}</div>}
          </div>
        </div>
      </div>

      {pmBreakdown.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>Payment Method Breakdown (All Time)</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {pmBreakdown.map(p => <div key={p.method} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>{fmt(p.total)}</div><div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.method}</div></div>)}
          </div>
        </div>
      )}

      {dueRecurring.length > 0 && (
        <div style={{ background: 'var(--amber-bg)', border: '1px solid #ffc107', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#856404' }}>🔁 Recurring Expenses Due This Month</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {dueRecurring.map(re => (
              <div key={re.id} style={{ background: 'var(--surface)', border: '1px solid #ffc107', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div><div style={{ fontWeight: 700, fontSize: 13 }}>{re.description}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{re.category} — {fmt(re.amount)} — Day {re.day_of_month}</div></div>
                <Btn variant="warning" small onClick={() => recordRecurring(re)}>Record Now</Btn>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSF && <SaleModal onClose={() => setShowSF(false)} defaultBranch={defBranch} customers={customers} branches={branches} userId={userId} sales={sales} setSales={setSales} addNotif={addNotif} />}
      {viewSale && <SaleReceipt sale={viewSale} branch={branches.find(b => b.name === (viewSale.branch || firstBranch))} customers={customers} onClose={() => setViewSale(null)} />}

      {showEF && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>Record Expense</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Inp label="Date" type="date" value={ef.date} onChange={e => setEf({ ...ef, date: e.target.value })} />
            <Sel label="Category" value={ef.category} onChange={e => setEf({ ...ef, category: e.target.value })}>
              {['Paper','Ink & Toner','Maintenance','Salaries','Utilities','Other'].map(c => <option key={c}>{c}</option>)}
            </Sel>
            {branches.length > 0 && <Sel label="Branch" value={ef.branch} onChange={e => setEf({ ...ef, branch: e.target.value })}>{branches.map(b => <option key={b.name}>{b.name}</option>)}</Sel>}
            <Inp label="Description" value={ef.description} onChange={e => setEf({ ...ef, description: e.target.value })} />
            <Inp label="Amount (GH₵)" type="number" value={ef.amount} onChange={e => setEf({ ...ef, amount: e.target.value })} />
            <Btn variant="warning" onClick={addExp}>Record</Btn>
            <Btn variant="ghost" onClick={() => setShowEF(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {showRE && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid #c4b5fd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
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
                <div key={re.id} style={{ background: 'var(--surface)', border: '1px solid #c4b5fd', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{re.description}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{re.category} — {fmt(re.amount)} — day {re.day_of_month}</div></div>
                  <Btn variant="success" small onClick={() => recordRecurring(re)}>Record</Btn>
                  <Btn variant="danger"  small onClick={() => delRecurring(re.id)}>Del</Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="d-card" style={{ marginBottom: 14 }}>
        <div className="d-filters">
          <Sel label="Month" value={fMonth} onChange={e => setFMonth(e.target.value)}><option value="all">All time</option>{monthOpts.map(m => <option key={m} value={m}>{m}</option>)}</Sel>
          {branches.length > 1 && activeBranch === 'all' && <Sel label="Branch" value={fBranch} onChange={e => setFBranch(e.target.value)}><option value="all">All branches</option>{branches.map(b => <option key={b.name}>{b.name}</option>)}</Sel>}
          <Inp label="Search" value={q} onChange={e => setQ(e.target.value)} placeholder="Category, description, method, amount…" />
          <Btn variant="ghost" onClick={exportLedger}>⬇️ Export CSV</Btn>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
          <span>Income: <b style={{ color: 'var(--green-ink)' }}>{fmt(fSales.reduce((a, s) => a + s.amount, 0))}</b></span>
          <span>Expenses: <b style={{ color: 'var(--red-ink)' }}>{fmt(fExp.reduce((a, x) => a + x.amount, 0))}</b></span>
          <span>Net: <b>{fmt(fSales.reduce((a, s) => a + s.amount, 0) - fExp.reduce((a, x) => a + x.amount, 0))}</b></span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: 'var(--green-bg)', borderBottom: '1px solid var(--green-line)' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--green-ink)' }}>💚 Income ({fSales.length})</h3>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {[...fSales].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f9fafb', gap: 6 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.date}{s.receipt_no ? ` · ${s.receipt_no}` : ''}</div>
                  {(s.customer || s.branch) && <div className="ellip" style={{ fontSize: 11 }}>{s.customer || 'Walk-in'}{s.branch ? ` · ${s.branch}` : ''}</div>}
                </div>
                {s.balance > 0 && <span className="d-tag hot">Owes {fmt(s.balance)}</span>}
                {s.payment_method && <span style={{ fontSize: 10, background: 'var(--surface-2)', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>{s.payment_method}</span>}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{fmt(s.amount)}</span>
                <button onClick={() => setViewSale(s)} title="View receipt" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>🧾</button>
                <button onClick={() => delSale(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: 'var(--red-bg)', borderBottom: '1px solid var(--red-line)' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>❤️ Expenses ({fExp.length})</h3>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {[...fExp].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f9fafb', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{e.date}</span>
                <span style={{ fontSize: 11, background: 'var(--surface-2)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>{e.category}</span>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap' }}>{fmt(e.amount)}</span>
                <button onClick={() => delExp(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const initials = (n) => (n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

const printPayslip = (p, pr = {}, branch) => {
  const basic = p.basic ?? p.amount, allow = p.allowance || 0, ded = p.deductions || 0;
  const w = window.open('', '_blank', 'width=720,height=820');
  if (!w) { alert('Please allow pop-ups to print the payslip.'); return; }
  w.document.write(`<html><head><title>Payslip ${escHtml(p.staff_name)}</title><style>body{font:14px system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;color:#111}h2,h3,p{margin:2px 0;text-align:center}table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:7px 4px;border-bottom:1px solid #ddd}.r{text-align:right}.n td{font-weight:800;font-size:16px;border-top:2px solid #111;border-bottom:0}.sg{display:flex;justify-content:space-between;margin-top:56px}.sg div{width:44%;border-top:1px solid #111;text-align:center;padding-top:4px;font-size:12px}small{color:#555}</style></head><body>
<h2>Bigbiney Printing Press</h2><p>${escHtml([branch?.name, branch?.address].filter(Boolean).join(' · '))}</p><h3 style="margin-top:10px;letter-spacing:.1em">PAYSLIP</h3><p><small>${escHtml(p.period || '')}</small></p>
<table><tr><td>Employee</td><td class="r"><b>${escHtml(p.staff_name)}</b></td></tr><tr><td>Role</td><td class="r">${escHtml(pr.role || '—')}</td></tr><tr><td>Payment date</td><td class="r">${escHtml(p.date)}</td></tr><tr><td>Method</td><td class="r">${escHtml(p.payment_method)}${p.reference ? ' · ' + escHtml(p.reference) : ''}</td></tr></table>
<table><tr><td>Basic salary</td><td class="r">${fmt(basic)}</td></tr>${allow ? `<tr><td>Allowance / bonus</td><td class="r">${fmt(allow)}</td></tr>` : ''}${ded ? `<tr><td>Deductions</td><td class="r">−${fmt(ded)}</td></tr>` : ''}<tr class="n"><td>NET PAY</td><td class="r">${fmt(p.amount)}</td></tr></table>
<p><small>${escHtml(amountInWords(p.amount))}</small></p>${p.notes ? `<p><small>Note: ${escHtml(p.notes)}</small></p>` : ''}
<div class="sg"><div>Employee signature</div><div>Authorised by</div></div><script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`);
  w.document.close();
};

function PayrollTab({ payroll, setPayroll, addNotif, userId, expenses, setExpenses, branches = [], activeBranch = 'all' }) {
  const [pay, setPay]             = useState(null);
  const [staffModal, setStaffModal] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [done, setDone]           = useState(null);
  const [staffList, setStaffList] = useState(STAFF_LIST);
  const [profiles, setProfiles]   = useState({});
  const [fMonth, setFMonth]       = useState('all');
  const [fStaff, setFStaff]       = useState('all');
  const [q, setQ]                 = useState('');

  useEffect(() => {
    Promise.all([db.getSetting(userId, 'staff_list'), db.getSetting(userId, 'staff_profiles')]).then(([a, b]) => {
      if (a.data?.value) { try { setStaffList(JSON.parse(a.data.value)); } catch {} }
      if (b.data?.value) { try { setProfiles(JSON.parse(b.data.value)); } catch {} }
    });
  }, [userId]);
  const persist = async (list, prof) => { setStaffList(list); setProfiles(prof); await db.setSetting(userId, 'staff_list', JSON.stringify(list)); await db.setSetting(userId, 'staff_profiles', JSON.stringify(prof)); };

  const now = new Date(), cm = getCurrentMonth(), pm = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const sumP = (pred) => payroll.filter(pred).reduce((a, p) => a + (p.amount || 0), 0);
  const names = [...new Set([...staffList, ...payroll.map(p => p.staff_name).filter(Boolean)])].filter(n => !profiles[n]?.archived && (activeBranch === 'all' || (profiles[n]?.branch || branches[0]?.name) === activeBranch));
  const staffRows = names.map(name => {
    const pr = profiles[name] || {}, rows = payroll.filter(p => p.staff_name === name), salary = parseFloat(pr.salary) || 0;
    const mPaid = rows.filter(p => (p.date || '').startsWith(cm)).reduce((a, p) => a + (p.amount || 0), 0);
    return { name, pr, salary, mPaid, balance: Math.max(0, salary - mPaid), total: rows.reduce((a, p) => a + (p.amount || 0), 0), count: rows.length, last: [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] };
  });
  const budget = staffRows.reduce((a, s) => a + s.salary, 0), owing = staffRows.reduce((a, s) => a + s.balance, 0);
  const pending = staffRows.filter(s => s.salary > 0 && s.balance > 0).length;
  const m6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1), k = monthKey(d); return { label: d.toLocaleString('en', { month: 'short' }), v: sumP(p => (p.date || '').startsWith(k)) }; });
  const m6max = Math.max(...m6.map(m => m.v), 1);
  const yearTot = sumP(p => (p.date || '').startsWith(String(now.getFullYear())));

  const openPay = (name = '') => {
    const s = staffRows.find(x => x.name === name);
    setPay({ staff_name: name, month: MONTH_NAMES[now.getMonth()], year: String(now.getFullYear()), basic: s?.salary ? String(s.balance > 0 ? s.balance : s.salary) : '', allowance: '', deductions: '', date: todayStr(), payment_method: 'Cash', reference: '', notes: '' });
  };
  const net = pay ? (parseFloat(pay.basic) || 0) + (parseFloat(pay.allowance) || 0) - (parseFloat(pay.deductions) || 0) : 0;

  const save = async () => {
    if (!pay.staff_name || net <= 0) { addNotif('Choose a staff member and enter an amount', 'warning'); return; }
    setSaving(true);
    const basic = parseFloat(pay.basic) || 0, allowance = parseFloat(pay.allowance) || 0, deductions = parseFloat(pay.deductions) || 0, pr = profiles[pay.staff_name] || {};
    const breakdown = (allowance || deductions) ? `(Basic ${fmt(basic)}${allowance ? ` + Allowance ${fmt(allowance)}` : ''}${deductions ? ` − Deductions ${fmt(deductions)}` : ''})` : '';
    const payload = { staff_name: pay.staff_name, amount: net, period: `${pay.month} ${pay.year}`, date: pay.date, payment_method: pay.payment_method, notes: [pay.notes, breakdown].filter(Boolean).join(' '), basic, allowance, deductions, reference: pay.reference, branch: pr.branch || (activeBranch !== 'all' ? activeBranch : '') };
    const { data, error, degraded } = await db.addPayroll(userId, payload);
    if (error) { addNotif('Error saving payroll record', 'warning'); setSaving(false); return; }
    if (data) setPayroll(prev => [data, ...prev.filter(x => x.id !== data.id)]);
    const { data: expData } = await db.addExpense(userId, { date: pay.date, category: 'Salaries', description: `Salary — ${pay.staff_name} (${payload.period})`, amount: net, branch: pr.branch || null });
    if (expData && setExpenses) setExpenses(prev => [expData, ...prev.filter(x => x.id !== expData.id)]);
    addNotif(`${pay.staff_name} paid ${fmt(net)} — recorded as expense`, 'success');
    if (degraded) addNotif('Saved. Run the setup SQL to store allowance/deduction fields separately.', 'warning');
    setDone({ ...payload, ...(data || {}) }); setPay(null); setSaving(false);
  };
  const del = async (id) => {
    if (!window.confirm('Delete this payroll record? (The matching expense stays in Finance.)')) return;
    const { error } = await db.deletePayroll(id);
    if (!error) { setPayroll(prev => prev.filter(p => p.id !== id)); addNotif('Payroll record deleted', 'success'); } else addNotif('Error deleting record', 'warning');
  };
  const saveStaff = async () => {
    const n = staffModal.name.trim(); if (!n) return;
    if (!staffModal.isEdit && names.some(x => x.toLowerCase() === n.toLowerCase())) { addNotif('Staff member already exists', 'warning'); return; }
    const { isEdit, name, ...rest } = staffModal;
    await persist(staffList.includes(n) ? staffList : [...staffList, n], { ...profiles, [n]: { ...rest, archived: false } });
    addNotif(isEdit ? 'Staff updated' : `${n} added to staff`, 'success'); setStaffModal(null);
  };
  const archive = async (n) => { if (window.confirm(`Remove ${n} from the active staff list? Their payment history stays.`)) await persist(staffList, { ...profiles, [n]: { ...(profiles[n] || {}), archived: true } }); };

  const monthOpts = [...new Set(payroll.map(p => (p.date || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  const rows = [...payroll].filter(p => (fMonth === 'all' || (p.date || '').startsWith(fMonth)) && (fStaff === 'all' || p.staff_name === fStaff) && (!q.trim() || `${p.staff_name} ${p.period} ${p.notes} ${p.reference || ''}`.toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const rowsTot = rows.reduce((a, p) => a + (p.amount || 0), 0);
  const exportCSV = () => downloadCSV('payroll.csv', [['Date', 'Staff', 'Period', 'Basic', 'Allowance', 'Deductions', 'Net paid', 'Method', 'Reference', 'Notes'], ...rows.map(p => [p.date, p.staff_name, p.period, p.basic ?? p.amount, p.allowance || 0, p.deductions || 0, p.amount, p.payment_method, p.reference || '', p.notes || ''])]);
  const brOf = (n) => branches.find(b => b.name === (profiles[n]?.branch || branches[0]?.name));

  return (
    <div>
      <div className="d-hero">
        <div><h2>👷 Staff Payroll</h2><p>{names.length} staff · salary payments are recorded as expenses automatically</p></div>
        <div className="d-actions">
          <button className="d-act" onClick={() => setStaffModal({ name: '', role: '', salary: '', phone: '', branch: activeBranch !== 'all' ? activeBranch : (branches[0]?.name || ''), start_date: '' })}>+ Add staff</button>
          <button className="d-act p" onClick={() => openPay('')}>💸 Record payment</button>
        </div>
      </div>

      <div className="d-kpis">
        <Kpi label="Paid this month" value={fmt(sumP(p => (p.date || '').startsWith(cm)))} icon="💸" color="var(--primary)" delta={pctChange(sumP(p => (p.date || '').startsWith(cm)), sumP(p => (p.date || '').startsWith(pm)))} invert spark={m6.map(m => m.v)} />
        <Kpi label="Monthly payroll budget" value={fmt(budget)} icon="📋" color="var(--amber-ink)" delta={null} sub={budget ? `${fmt(owing)} still to pay` : 'Set salaries on staff cards'} />
        <Kpi label="Paid this year" value={fmt(yearTot)} icon="📅" color="var(--green-ink)" delta={null} sub={`All time ${fmt(sumP(() => true))}`} />
        <Kpi label="Staff members" value={String(names.length)} icon="👥" color="#7c3aed" delta={null} sub={pending ? `${pending} not fully paid this month` : 'All paid up ✅'} />
      </div>

      <div className="d-grid g-2-1">
        <div className="d-card">
          <div className="d-head"><h3>Payroll — last 6 months</h3><span className="muted">{fmt(m6.reduce((a, m) => a + m.v, 0))}</span></div>
          <BarList rows={m6.map(m => ({ label: m.label, pct: Math.round((m.v / m6max) * 100), right: fmt(m.v) }))} />
        </div>
        <div className="d-card">
          <div className="d-head"><h3>This month by staff</h3></div>
          <BarList rows={staffRows.filter(s => s.mPaid > 0).map(s => ({ label: s.name, pct: Math.round((s.mPaid / Math.max(...staffRows.map(x => x.mPaid), 1)) * 100), color: 'var(--green-ink)', right: fmt(s.mPaid) }))} />
        </div>
      </div>

      <div className="pr-staff">
        {staffRows.map(s => {
          const pct = s.salary > 0 ? Math.min(100, Math.round((s.mPaid / s.salary) * 100)) : 0;
          return (
            <div key={s.name} className="d-card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                <div className="pr-av">{initials(s.name)}</div>
                <div style={{ minWidth: 0, flex: 1 }}><b className="ellip" style={{ display: 'block' }}>{s.name}</b><span className="muted ellip" style={{ display: 'block', fontSize: 12 }}>{[s.pr.role, s.pr.branch].filter(Boolean).join(' · ') || 'No role set'}</span></div>
                <button className="d-link" onClick={() => setStaffModal({ ...s.pr, name: s.name, isEdit: true })}>Edit</button>
              </div>
              {s.salary > 0 ? (<>
                <div className="ln-r"><span>This month</span><b>{fmt(s.mPaid)} / {fmt(s.salary)}</b></div>
                <div className="ln-bar"><i style={{ width: `${pct}%` }} /></div>
                <div className="ln-r" style={{ fontSize: 12 }}><span className="muted">{s.balance > 0 ? 'Balance due' : ''}</span><b style={{ color: s.balance > 0 ? 'var(--red-ink)' : 'var(--green-ink)' }}>{s.balance > 0 ? fmt(s.balance) : '✅ Fully paid'}</b></div>
              </>) : <div className="muted" style={{ fontSize: 12 }}>No monthly salary set — click Edit.</div>}
              <div className="muted" style={{ fontSize: 11, margin: '8px 0' }}>All time {fmt(s.total)} · {s.count} payment{s.count === 1 ? '' : 's'} · Last paid {s.last?.date || 'never'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn small onClick={() => openPay(s.name)}>+ Pay now</Btn>
                {s.last && <Btn small variant="ghost" onClick={() => printPayslip(s.last, s.pr, brOf(s.name))}>🧾 Last payslip</Btn>}
                <Btn small variant="ghost" onClick={() => setFStaff(s.name)}>History</Btn>
                <Btn small variant="ghost" onClick={() => archive(s.name)}>×</Btn>
              </div>
            </div>
          );
        })}
        {staffRows.length === 0 && <div className="d-card muted">No staff yet — click “+ Add staff”.</div>}
      </div>

      <div className="d-card">
        <div className="d-head"><h3>Payment history</h3><button className="d-link" onClick={exportCSV}>⬇️ Export CSV</button></div>
        <div className="d-filters">
          <Sel label="Month" value={fMonth} onChange={e => setFMonth(e.target.value)}><option value="all">All time</option>{monthOpts.map(m => <option key={m}>{m}</option>)}</Sel>
          <Sel label="Staff" value={fStaff} onChange={e => setFStaff(e.target.value)}><option value="all">All staff</option>{[...new Set([...names, ...payroll.map(p => p.staff_name)])].filter(Boolean).map(n => <option key={n}>{n}</option>)}</Sel>
          <Inp label="Search" value={q} onChange={e => setQ(e.target.value)} placeholder="Period, notes, reference…" />
        </div>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Date', 'Staff', 'Period', 'Basic', 'Allow.', 'Deduct.', 'Net paid', 'Method', 'Notes', ''].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id}>
                <TD>{p.date}</TD><TD style={{ fontWeight: 600 }}>{p.staff_name}</TD><TD>{p.period || '—'}</TD>
                <TD>{p.basic != null ? fmt(p.basic) : '—'}</TD><TD style={{ color: 'var(--green-ink)' }}>{p.allowance ? fmt(p.allowance) : '—'}</TD><TD style={{ color: 'var(--red-ink)' }}>{p.deductions ? fmt(p.deductions) : '—'}</TD>
                <TD style={{ fontWeight: 800 }}>{fmt(p.amount)}</TD><TD><span className="d-tag">{p.payment_method}</span></TD>
                <TD style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 200 }}>{p.reference ? `Ref ${p.reference}. ` : ''}{p.notes}</TD>
                <TD style={{ whiteSpace: 'nowrap' }}><button className="d-link" onClick={() => printPayslip(p, profiles[p.staff_name], brOf(p.staff_name))}>🧾 Payslip</button>{' '}<button className="d-link" style={{ color: 'var(--red-ink)' }} onClick={() => del(p.id)}>Delete</button></TD>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--faint)' }}>No payments match.</td></tr>}
            {rows.length > 0 && <tr className="d-tot"><td className="td" colSpan={6}>Total ({rows.length})</td><td className="td">{fmt(rowsTot)}</td><td className="td" colSpan={3} /></tr>}
          </tbody>
        </table></div>
      </div>

      {pay && (
        <Modal title="💸 Record salary payment" onClose={() => setPay(null)} wide>
          <div className="sm-grid">
            <Sel label="Staff member *" value={pay.staff_name} onChange={e => { const s = staffRows.find(x => x.name === e.target.value); setPay({ ...pay, staff_name: e.target.value, basic: s?.salary ? String(s.balance > 0 ? s.balance : s.salary) : pay.basic }); }}><option value="">— Select —</option>{names.map(n => <option key={n}>{n}</option>)}</Sel>
            <Inp label="Payment date" type="date" value={pay.date} onChange={e => setPay({ ...pay, date: e.target.value })} />
            <Sel label="Pay period — month" value={pay.month} onChange={e => setPay({ ...pay, month: e.target.value })}>{MONTH_NAMES.map(m => <option key={m}>{m}</option>)}</Sel>
            <Sel label="Year" value={pay.year} onChange={e => setPay({ ...pay, year: e.target.value })}>{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y}>{y}</option>)}</Sel>
          </div>
          <div className="sm-sec">Pay breakdown</div>
          <div className="sm-grid">
            <Inp label="Basic / amount (GH₵) *" type="number" value={pay.basic} onChange={e => setPay({ ...pay, basic: e.target.value })} />
            <Inp label="Allowance / bonus (GH₵)" type="number" value={pay.allowance} onChange={e => setPay({ ...pay, allowance: e.target.value })} />
            <Inp label="Deductions / advance (GH₵)" type="number" value={pay.deductions} onChange={e => setPay({ ...pay, deductions: e.target.value })} />
            <Sel label="Payment method" value={pay.payment_method} onChange={e => setPay({ ...pay, payment_method: e.target.value })}>{['Cash', 'Mobile Money', 'Bank Transfer'].map(m => <option key={m}>{m}</option>)}</Sel>
            <Inp label="Reference / MoMo ID" value={pay.reference} onChange={e => setPay({ ...pay, reference: e.target.value })} />
            <Inp label="Notes" value={pay.notes} onChange={e => setPay({ ...pay, notes: e.target.value })} />
          </div>
          <div className="sm-sum">
            <div className="ln-r"><span>Basic</span><b>{fmt(parseFloat(pay.basic) || 0)}</b></div>
            {parseFloat(pay.allowance) > 0 && <div className="ln-r"><span>+ Allowance</span><b>{fmt(parseFloat(pay.allowance))}</b></div>}
            {parseFloat(pay.deductions) > 0 && <div className="ln-r"><span>− Deductions</span><b>−{fmt(parseFloat(pay.deductions))}</b></div>}
            <div className="ln-r" style={{ fontSize: 16 }}><span>Net pay</span><b style={{ color: 'var(--primary)' }}>{fmt(net)}</b></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}><Btn variant="ghost" onClick={() => setPay(null)}>Cancel</Btn><Btn disabled={saving} onClick={save}>{saving ? 'Saving…' : '✔ Record payment'}</Btn></div>
        </Modal>
      )}
      {done && (
        <Modal title="✅ Payment recorded" onClose={() => setDone(null)}>
          <p style={{ marginTop: 0 }}><b>{done.staff_name}</b> was paid <b>{fmt(done.amount)}</b> for {done.period}.</p>
          <div style={{ display: 'flex', gap: 8 }}><Btn onClick={() => printPayslip(done, profiles[done.staff_name], brOf(done.staff_name))}>🧾 Print payslip</Btn><Btn variant="ghost" onClick={() => setDone(null)}>Close</Btn></div>
        </Modal>
      )}
      {staffModal && (
        <Modal title={staffModal.isEdit ? `Edit ${staffModal.name}` : 'Add staff member'} onClose={() => setStaffModal(null)}>
          <div className="sm-grid">
            <Inp label="Full name *" value={staffModal.name} disabled={staffModal.isEdit} onChange={e => setStaffModal({ ...staffModal, name: e.target.value })} />
            <Inp label="Role / position" value={staffModal.role || ''} onChange={e => setStaffModal({ ...staffModal, role: e.target.value })} placeholder="e.g. Press operator" />
            <Inp label="Monthly salary (GH₵)" type="number" value={staffModal.salary || ''} onChange={e => setStaffModal({ ...staffModal, salary: e.target.value })} />
            <Inp label="Phone" value={staffModal.phone || ''} onChange={e => setStaffModal({ ...staffModal, phone: e.target.value })} />
            {branches.length > 0 && <Sel label="Branch" value={staffModal.branch || ''} onChange={e => setStaffModal({ ...staffModal, branch: e.target.value })}>{branches.map(b => <option key={b.name}>{b.name}</option>)}</Sel>}
            <Inp label="Start date" type="date" value={staffModal.start_date || ''} onChange={e => setStaffModal({ ...staffModal, start_date: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}><Btn variant="ghost" onClick={() => setStaffModal(null)}>Cancel</Btn><Btn onClick={saveStaff}>Save</Btn></div>
        </Modal>
      )}
    </div>
  );
}

function LoansTab({ loans, setLoans, addNotif, userId, sales, expenses, setExpenses }) {
  const [modal,         setModal]         = useState(false);
  const [form,          setForm]          = useState({ name: '', type: 'borrowed', amount: '', rate: '', date: todayStr(), due_date: '', paid: '0', notes: '', daily_repayment: '' });
  const [editId,        setEditId]        = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [payAnyModal,   setPayAnyModal]   = useState(null);
  const [payAnyAmt,     setPayAnyAmt]     = useState('');
  const [setDailyModal, setSetDailyModal] = useState(null);
  const [newDaily,      setNewDaily]      = useState('');
  const [pendingDebt,   setPendingDebt]   = useState({});
  const [lastAutoDate,  setLastAutoDate]  = useState({});
  const [histOpen,     setHistOpen]     = useState(null);

  useEffect(() => {
    db.getSetting(userId, 'loan_carryover').then(({ data }) => {
      if (data?.value) { try { setPendingDebt(JSON.parse(data.value)); } catch {} }
    });
    db.getSetting(userId, 'loan_auto_date').then(({ data }) => {
      if (data?.value) { try { setLastAutoDate(JSON.parse(data.value)); } catch {} }
    });
  }, [userId]);

  const savePendingDebt = async (upd) => { setPendingDebt(upd); await db.setSetting(userId, 'loan_carryover', JSON.stringify(upd)); };
  const saveAutoDate    = async (upd) => { setLastAutoDate(upd); await db.setSetting(userId, 'loan_auto_date',  JSON.stringify(upd)); };

  const totalBorrowed  = loans.filter(l => l.type === 'borrowed').reduce((a, l) => a + (l.amount - l.paid), 0);
  const totalLent      = loans.filter(l => l.type === 'lent').reduce((a, l) => a + (l.amount - l.paid), 0);
  const todaySales     = (sales||[]).filter(s => s.date === todayStr()).reduce((a, s) => a + s.amount, 0);
  const activeBorrowed = loans.filter(l => l.type === 'borrowed' && l.paid < l.amount);
  const autoRanToday   = (id) => lastAutoDate[id] === todayStr();
  const nowD = new Date();
  const daysIn = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const dim = daysIn(nowD), daysRemain = dim - nowD.getDate();
  const monthPaid = (l, key) => (expenses || []).filter(e => /^loan/i.test(e.description || '') && (e.description || '').includes(l.name) && (e.date || '').startsWith(key)).reduce((a, e) => a + Number(e.amount || 0), 0);
  const totMonthTarget = activeBorrowed.reduce((a, l) => a + (parseFloat(l.daily_repayment) || 0) * dim, 0);
  const totMonthPaid   = activeBorrowed.reduce((a, l) => a + monthPaid(l, getCurrentMonth()), 0);

  const save = async () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    const payload = {
      name: form.name, type: form.type, notes: form.notes||'',
      amount:          parseFloat(form.amount)          || 0,
      rate:            parseFloat(form.rate)            || 0,
      paid:            parseFloat(form.paid)            || 0,
      daily_repayment: parseFloat(form.daily_repayment) || 0,
      date:     form.date     || null,
      due_date: form.due_date || null,
    };
    if (editId) {
      const { data, error } = await db.updateLoan(editId, payload);
      if (!error) { setLoans(loans.map(l => l.id === editId ? { ...l, ...data } : l)); addNotif('Loan updated', 'success'); }
      else addNotif('Save error: ' + error.message, 'warning');
    } else {
      const { data, error } = await db.addLoan(userId, payload);
      if (!error) { setLoans([...loans, data]); addNotif('Loan recorded', 'success'); }
      else addNotif('Save error: ' + error.message, 'warning');
    }
    setSaving(false); setModal(false);
    setForm({ name: '', type: 'borrowed', amount: '', rate: '', date: todayStr(), due_date: '', paid: '0', notes: '', daily_repayment: '' });
    setEditId(null);
  };

  const saveDaily = async () => {
    const amt = parseFloat(newDaily);
    if (!amt || !setDailyModal) return;
    const { data, error } = await db.updateLoan(setDailyModal.id, { daily_repayment: amt });
    if (!error) {
      setLoans(loans.map(l => l.id === setDailyModal.id ? { ...l, daily_repayment: amt } : l));
      addNotif(`Daily repayment set to ${fmt(amt)}`, 'success');
    } else addNotif('Error: ' + error.message, 'warning');
    setSetDailyModal(null); setNewDaily('');
  };

  const del = async (id) => {
    if (!window.confirm('Delete this loan?')) return;
    const { error } = await db.deleteLoan(id);
    if (!error) { setLoans(loans.filter(l => l.id !== id)); const u = { ...pendingDebt }; delete u[id]; savePendingDebt(u); }
  };

  const doRepay = async (loan, amt, label) => {
    const balance = loan.amount - loan.paid;
    const toPay   = Math.min(amt, balance);
    const carry   = Math.max(0, amt - toPay);
    if (toPay <= 0) { addNotif('Loan already fully paid', 'warning'); return false; }
    const newPaid = loan.paid + toPay;
    const { data, error } = await db.updateLoan(loan.id, { paid: newPaid });
    if (!error) {
      setLoans(loans.map(l => l.id === loan.id ? { ...l, paid: newPaid } : l));
      const { data: expData } = await db.addExpense(userId, { date: todayStr(), category: 'Other', description: label || `Loan repayment — ${loan.name}`, amount: toPay });
      if (expData && setExpenses) setExpenses(prev => [expData, ...prev]);
      const upd = { ...pendingDebt, [loan.id]: carry };
      if (newPaid >= loan.amount) delete upd[loan.id];
      savePendingDebt(upd);
      addNotif(`${fmt(toPay)} paid${carry > 0 ? ` — ${fmt(carry)} carries to tomorrow` : ' ✓ Done for today'}`, 'success');
      return true;
    }
    addNotif('Error: ' + error.message, 'warning'); return false;
  };

  const handleGetDaily = async (loan) => {
    if (autoRanToday(loan.id)) { addNotif('Already deducted today for this loan', 'info'); return; }
    const daily    = parseFloat(loan.daily_repayment) || 0;
    const carryover= pendingDebt[loan.id] || 0;
    const target   = daily + carryover;
    if (target <= 0) { addNotif('Set a daily amount first using ⚙️', 'warning'); return; }
    const ok = await doRepay(loan, target, `Loan daily repayment — ${loan.name}${carryover > 0 ? ` (incl. ${fmt(carryover)} carryover)` : ''}`);
    if (ok) { const upd = { ...lastAutoDate, [loan.id]: todayStr() }; saveAutoDate(upd); }
  };

  const handlePayAny = async () => {
    const amt = parseFloat(payAnyAmt);
    if (!amt || !payAnyModal) return;
    await doRepay(payAnyModal, amt, `Loan payment — ${payAnyModal.name}`);
    setPayAnyModal(null); setPayAnyAmt('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>🏦 Loans & Credit</h2>
        <Btn onClick={() => { setForm({ name: '', type: 'borrowed', amount: '', rate: '', date: todayStr(), due_date: '', paid: '0', notes: '', daily_repayment: '' }); setEditId(null); setModal(true); }}>+ Add Loan</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Borrowed" value={fmt(totalBorrowed)} accent="#dc2626" />
        <StatCard label="Total Lent Out" value={fmt(totalLent)}     accent="#f59e0b" />
        <StatCard label="Active Loans"   value={loans.filter(l => l.paid < l.amount).length} accent="var(--primary)" />
        <StatCard label="Today's Sales"  value={fmt(todaySales)} accent="#16a34a" sub="Available for repayment" />
        <StatCard label="Paid This Month" value={fmt(totMonthPaid)} accent="#0891b2" sub={`of ${fmt(totMonthTarget)} target`} />
        <StatCard label="Left This Month" value={fmt(Math.max(0, totMonthTarget - totMonthPaid))} accent="#7c3aed" sub={`${daysRemain} day(s) remaining`} />
      </div>

      {activeBorrowed.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>💳 Loan Repayment Tracker</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
            {activeBorrowed.map(l => {
              const daily    = parseFloat(l.daily_repayment) || 0;
              const balance  = l.amount - l.paid;
              const pct      = Math.round((l.paid / l.amount) * 100);
              const carryover= pendingDebt[l.id] || 0;
              const dueToday = daily + carryover;
              const alreadyRan = autoRanToday(l.id);
              const daysLeft = daily > 0 ? Math.ceil(balance / daily) : null;
              const monthRate  = daily * 30;
              const monthsPaid = monthRate > 0 ? l.paid / monthRate : null;
              const monthsLeft = monthRate > 0 ? balance / monthRate : null;
              const mTarget = daily * dim, mPaid = monthPaid(l, getCurrentMonth()), mLeft = Math.max(0, mTarget - mPaid);
              const mPct = mTarget > 0 ? Math.min(100, Math.round((mPaid / mTarget) * 100)) : 0;
              const hist = Array.from({ length: 6 }, (_, i) => { const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1); const k = monthKey(d); return { label: d.toLocaleString('en', { month: 'short', year: '2-digit' }), paid: monthPaid(l, k), target: daily * daysIn(d) }; });
              return (
                <div key={l.id} style={{ background: 'var(--surface)', border: '2px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#0f172a', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{l.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>Balance: <strong style={{ color: '#f87171' }}>{fmt(balance)}</strong></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>Daily Target</div>
                      <div style={{ color: daily > 0 ? '#4ade80' : '#fbbf24', fontWeight: 900, fontSize: 20 }}>{daily > 0 ? fmt(daily) : 'Not set'}</div>
                      {daysLeft && <div style={{ color: '#94a3b8', fontSize: 10 }}>~{daysLeft} days left</div>}
                    </div>
                  </div>
                  <div style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                      <span>{fmt(l.paid)} paid of {fmt(l.amount)}</span>
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{pct}%</span>
                    </div>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 6, height: 12, marginBottom: 12, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: 12, borderRadius: 6, background: 'linear-gradient(90deg, var(--primary), #16a34a)', transition: 'width 0.4s' }} />
                    </div>
                    <div className="ln-tiles">
                      <div><b>{monthsPaid === null ? '—' : monthsPaid.toFixed(1)}</b><span>Months paid</span></div>
                      <div><b>{monthsLeft === null ? '—' : monthsLeft.toFixed(1)}</b><span>Months left</span></div>
                      <div><b>{monthRate > 0 ? (l.amount / monthRate).toFixed(1) : '—'}</b><span>Total term (mo)</span></div>
                    </div>
                    <div className="ln-month">
                      <div className="ln-mh"><b>📅 {nowD.toLocaleString('en', { month: 'long', year: 'numeric' })}</b><span>{daysRemain} day(s) left</span></div>
                      <div className="ln-r"><span>Paid this month</span><b style={{ color: 'var(--green-ink)' }}>{fmt(mPaid)}</b></div>
                      <div className="ln-r"><span>Month target ({dim} days × {fmt(daily)})</span><b>{fmt(mTarget)}</b></div>
                      <div className="ln-bar"><i style={{ width: `${mPct}%` }} /></div>
                      <div className="ln-r"><span>Balance left for month</span><b style={{ color: mLeft > 0 ? 'var(--red-ink)' : 'var(--green-ink)' }}>{mTarget <= 0 ? 'Set daily amount' : mLeft > 0 ? fmt(mLeft) : '✅ Target met'}</b></div>
                      {mLeft > 0 && daysRemain > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>≈ {fmt(mLeft / daysRemain)} per remaining day to hit target</div>}
                    </div>
                    <button className="d-link" style={{ marginBottom: 10 }} onClick={() => setHistOpen(histOpen === l.id ? null : l.id)}>{histOpen === l.id ? '▲ Hide' : '▼ Show'} monthly history</button>
                    {histOpen === l.id && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                        <thead><tr>{['Month', 'Paid', 'Target', 'Difference'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
                        <tbody>{hist.map(h => <tr key={h.label}><TD>{h.label}</TD><TD style={{ fontWeight: 700 }}>{fmt(h.paid)}</TD><TD>{fmt(h.target)}</TD><TD style={{ fontWeight: 700, color: h.paid >= h.target ? 'var(--green-ink)' : 'var(--red-ink)' }}>{h.target <= 0 ? '—' : h.paid >= h.target ? '+' + fmt(h.paid - h.target) : '−' + fmt(h.target - h.paid)}</TD></tr>)}</tbody>
                      </table>
                    )}
                    {carryover > 0 && (
                      <div style={{ background: 'var(--amber-bg)', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 10, color: '#92400e', fontWeight: 600 }}>
                        ⚠️ Carryover: <strong>{fmt(carryover)}</strong> — Due today: <strong>{fmt(dueToday)}</strong>
                      </div>
                    )}
                    {alreadyRan && (
                      <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 10, color: 'var(--green-ink)', fontWeight: 600 }}>
                        ✅ Daily deduction already done today
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button onClick={() => handleGetDaily(l)} disabled={alreadyRan || daily <= 0}
                        style={{ background: alreadyRan ? '#f1f5f9' : daily > 0 ? 'var(--primary)' : 'var(--line)', color: alreadyRan ? 'var(--faint)' : daily > 0 ? '#fff' : 'var(--muted)', border: 'none', borderRadius: 8, padding: '12px 8px', cursor: alreadyRan || daily <= 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>
                        {alreadyRan ? '✅ Paid Today' : `💰 Deduct ${daily > 0 ? fmt(dueToday) : 'Daily'}`}
                      </button>
                      <button onClick={() => { setPayAnyModal(l); setPayAnyAmt(''); }}
                        style={{ background: 'var(--green-bg)', color: '#16a34a', border: '2px solid #16a34a', borderRadius: 8, padding: '12px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        ✏️ Pay Any Amount
                      </button>
                      <button onClick={() => { setSetDailyModal(l); setNewDaily(String(daily || '')); }}
                        style={{ background: 'var(--blue-bg)', color: 'var(--primary)', border: '2px solid #bfdbfe', borderRadius: 8, padding: '10px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700, gridColumn: '1/-1' }}>
                        ⚙️ {daily > 0 ? `Change Daily Amount (${fmt(daily)}/day)` : 'Set Daily Repayment Amount'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Name','Type','Amount','Daily','Date','Due','Paid','Balance','Notes','Actions'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {loans.map(l => {
              const balance = l.amount - l.paid;
              const overdue = l.due_date && l.due_date < todayStr() && balance > 0;
              return (
                <tr key={l.id} style={{ background: overdue ? '#fff5f5' : 'transparent' }}>
                  <TD style={{ fontWeight: 600 }}>{l.name}</TD>
                  <TD><span style={{ background: l.type === 'borrowed' ? '#fee2e2' : '#dcfce7', color: l.type === 'borrowed' ? '#dc2626' : '#16a34a', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{l.type === 'borrowed' ? 'Borrowed' : 'Lent'}</span></TD>
                  <TD style={{ fontWeight: 600 }}>{fmt(l.amount)}</TD>
                  <TD style={{ color: parseFloat(l.daily_repayment) > 0 ? 'var(--primary)' : 'var(--faint)', fontWeight: 600 }}>{parseFloat(l.daily_repayment) > 0 ? fmt(parseFloat(l.daily_repayment)) : '—'}</TD>
                  <TD>{l.date}</TD>
                  <TD style={{ color: overdue ? '#dc2626' : 'var(--ink-2)', fontWeight: overdue ? 700 : 400 }}>{l.due_date || '—'}{overdue ? ' ⚠️' : ''}</TD>
                  <TD style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(l.paid)}</TD>
                  <TD style={{ fontWeight: 700, color: balance > 0 ? '#dc2626' : '#16a34a' }}>{balance > 0 ? fmt(balance) : '✓ Settled'}</TD>
                  <TD style={{ color: 'var(--muted)', fontSize: 12 }}>{l.notes}</TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {balance > 0 && <Btn variant="success" small onClick={() => { setPayAnyModal(l); setPayAnyAmt(''); }}>Pay</Btn>}
                      <Btn variant="ghost"  small onClick={() => { setForm({ name: l.name, type: l.type, notes: l.notes||'', amount: String(l.amount), rate: String(l.rate||0), paid: String(l.paid), daily_repayment: String(l.daily_repayment||''), date: l.date||todayStr(), due_date: l.due_date||'' }); setEditId(l.id); setModal(true); }}>Edit</Btn>
                      <Btn variant="danger" small onClick={() => del(l.id)}>Del</Btn>
                    </div>
                  </TD>
                </tr>
              );
            })}
            {loans.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--faint)' }}>No loans recorded</td></tr>}
          </tbody>
        </table>
      </div>

      {setDailyModal && (
        <Modal title={`⚙️ Set Daily Repayment — ${setDailyModal.name}`} onClose={() => { setSetDailyModal(null); setNewDaily(''); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--blue-bg)', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: '#1d4ed8' }}>Loan Balance: {fmt(setDailyModal.amount - setDailyModal.paid)}</div>
              <div style={{ color: 'var(--ink-2)', marginTop: 4 }}>This amount will be deducted daily when you click "Deduct Daily".</div>
            </div>
            <Inp label="Daily Repayment Amount (GH₵)" type="number" value={newDaily} onChange={e => setNewDaily(e.target.value)} placeholder="e.g. 550" />
            {newDaily && parseFloat(newDaily) > 0 && (
              <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 6, padding: 12, fontSize: 13, color: 'var(--green-ink)', fontWeight: 700 }}>
                At {fmt(parseFloat(newDaily))}/day → paid off in ~{Math.ceil((setDailyModal.amount - setDailyModal.paid) / parseFloat(newDaily))} days
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => { setSetDailyModal(null); setNewDaily(''); }}>Cancel</Btn>
              <Btn onClick={saveDaily} disabled={!newDaily || parseFloat(newDaily) <= 0}>Save Daily Amount</Btn>
            </div>
          </div>
        </Modal>
      )}

      {payAnyModal && (
        <Modal title={`💳 Pay — ${payAnyModal.name}`} onClose={() => { setPayAnyModal(null); setPayAnyAmt(''); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-ink)' }}>Remaining Balance: {fmt(payAnyModal.amount - payAnyModal.paid)}</div>
              {(pendingDebt[payAnyModal.id] || 0) > 0 && <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginTop: 4 }}>⚠️ Carryover amount: {fmt(pendingDebt[payAnyModal.id])}</div>}
            </div>
            <Inp label="Amount to Pay (GH₵)" type="number" value={payAnyAmt} onChange={e => setPayAnyAmt(e.target.value)} placeholder="Enter any amount" />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => { setPayAnyModal(null); setPayAnyAmt(''); }}>Cancel</Btn>
              <Btn variant="success" onClick={handlePayAny} disabled={!payAnyAmt || parseFloat(payAnyAmt) <= 0}>
                Pay {payAnyAmt && parseFloat(payAnyAmt) > 0 ? fmt(parseFloat(payAnyAmt)) : ''}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal && (
        <Modal title={editId ? 'Edit Loan' : 'Add Loan'} onClose={() => { setModal(false); setEditId(null); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Inp label="Name / Lender / Borrower *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <Sel label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="borrowed">Borrowed (we owe)</option>
              <option value="lent">Lent (they owe us)</option>
            </Sel>
            <Inp label="Total Amount (GH₵) *" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <Inp label="Daily Repayment (GH₵)" type="number" value={form.daily_repayment} onChange={e => setForm({ ...form, daily_repayment: e.target.value })} placeholder="e.g. 550" />
            <Inp label="Interest Rate (%)" type="number" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
            <Inp label="Already Paid (GH₵)" type="number" value={form.paid} onChange={e => setForm({ ...form, paid: e.target.value })} />
            <Inp label="Start Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <Inp label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            <div style={{ gridColumn: '1/-1' }}><Inp label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          {form.amount && form.daily_repayment && parseFloat(form.daily_repayment) > 0 && (
            <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 6, padding: '10px 14px', marginTop: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--green-ink)', fontWeight: 700 }}>
                At {fmt(parseFloat(form.daily_repayment))}/day → paid off in ~{Math.ceil((parseFloat(form.amount)||0)/(parseFloat(form.daily_repayment)||1))} days
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Loan'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
/* ───────────── BRANCHES PAGE ───────────── */
const EMPTY_BR = { name: '', address: '', phone: '', manager: '' };

/* ───────────── DEBTORS ───────────── */
const parsePays = (x) => { try { return JSON.parse(x || '[]') || []; } catch { return []; } };
const DEBT_KINDS = ['Sale on credit', 'Money lent'];
const remD = (d) => Math.max(0, d.amount - d.paid - (d.written_off || 0));

const buildStatement = (name, sales, debts, invoices) => {
  const open = [], pays = [], offs = [];
  sales.filter(s => (s.customer || 'Walk-in') === name).forEach(s => {
    if ((s.description || '').startsWith('Debt payment')) { pays.push({ date: s.date, text: s.receipt_no || 'Payment', method: s.payment_method, amount: s.amount }); return; }
    const wo = s.written_off || 0, bal = s.balance || 0, orig = Math.max((s.total ?? s.amount) - s.amount, bal + wo);
    if (bal > 0 || wo > 0) open.push({ date: s.date, text: `${s.receipt_no ? s.receipt_no + ' · ' : ''}${s.description || 'Sale on credit'}`, orig, paid: Math.max(0, orig - bal - wo), bal });
    if (wo > 0) offs.push({ date: s.writeoff_date || s.date, text: s.description || 'Sale', amount: wo, reason: s.writeoff_reason });
  });
  debts.filter(d => d.customer === name).forEach(d => {
    open.push({ date: d.date, text: `${d.kind}${d.reason ? ' · ' + d.reason : ''}`, orig: d.amount, paid: d.paid, bal: remD(d), due: d.due_date });
    parsePays(d.payments).forEach(p => pays.push({ date: p.date, text: d.reason || d.kind, method: p.method, amount: p.amount }));
    if ((d.written_off || 0) > 0) offs.push({ date: d.writeoff_date || d.date, text: d.reason || d.kind, amount: d.written_off, reason: d.writeoff_reason });
  });
  invoices.filter(i => (i.customer || '') === name && i.status !== 'paid').forEach(i => open.push({ date: i.date, text: `Invoice ${i.invoice_no || ''}`.trim(), orig: i.amount, paid: i.paid, bal: i.amount - i.paid }));
  const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');
  const items = open.filter(o => o.bal > 0).sort(byDate);
  return { name, items, pays: pays.sort(byDate), offs: offs.sort(byDate), due: items.reduce((a, o) => a + o.bal, 0), paidTotal: pays.reduce((a, p) => a + p.amount, 0), offTotal: offs.reduce((a, o) => a + o.amount, 0) };
};
const statementText = (st) => `📄 *Statement of account — ${st.name}*\nBigbiney Printing Press · ${todayStr()}\n\n*Outstanding*\n${st.items.map(i => `• ${i.date} ${i.text}: ${fmt(i.bal)}`).join('\n') || '• None'}\n\n*Total due: ${fmt(st.due)}*${st.paidTotal ? `\nPayments received: ${fmt(st.paidTotal)}` : ''}\n\nKindly settle at your earliest convenience. Thank you! 🙏`;
const printStatement = (st, branch, phone) => {
  const w = window.open('', '_blank', 'width=780,height=900');
  if (!w) { alert('Please allow pop-ups to print the statement.'); return; }
  const tbl = (head, rows) => `<table><thead><tr>${head.map((h, i) => `<th${i > 1 ? ' class="r"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  w.document.write(`<html><head><title>Statement ${escHtml(st.name)}</title><style>body{font:13px system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#111}h2,h3,p{margin:2px 0}.c{text-align:center}table{width:100%;border-collapse:collapse;margin:8px 0 18px}th{background:#f1f5f9;text-align:left;padding:6px;font-size:11px;text-transform:uppercase}td{padding:6px;border-bottom:1px solid #e5e7eb}.r{text-align:right}.tot{font-size:18px;font-weight:800;text-align:right;border-top:2px solid #111;padding-top:8px}small{color:#555}</style></head><body>
<div class="c"><h2 style="color:#0a7fc2">Bigbiney Printing Press</h2><p>${escHtml([branch?.name, branch?.address].filter(Boolean).join(' · '))}</p>${branch?.phone ? `<p>Tel: ${escHtml(branch.phone)}</p>` : ''}<h3 style="margin-top:12px;letter-spacing:.08em">STATEMENT OF ACCOUNT</h3></div>
<p><b>Customer:</b> ${escHtml(st.name)}${phone ? ` · ${escHtml(phone)}` : ''}</p><p><b>Date:</b> ${todayStr()}</p><br>
<h3>Outstanding</h3>${st.items.length ? tbl(['Date', 'Details', 'Original', 'Paid', 'Balance'], st.items.map(i => `<tr><td>${escHtml(i.date)}</td><td>${escHtml(i.text)}${i.due ? `<br><small>Promised: ${escHtml(i.due)}</small>` : ''}</td><td class="r">${fmt(i.orig)}</td><td class="r">${fmt(i.paid)}</td><td class="r"><b>${fmt(i.bal)}</b></td></tr>`).join('')) : '<p>Nothing outstanding.</p>'}
${st.pays.length ? `<h3>Payments received</h3>${tbl(['Date', 'For', 'Method', 'Amount'], st.pays.map(p => `<tr><td>${escHtml(p.date)}</td><td>${escHtml(p.text)}</td><td class="r">${escHtml(p.method || '')}</td><td class="r">${fmt(p.amount)}</td></tr>`).join(''))}` : ''}
${st.offs.length ? `<h3>Written off</h3>${tbl(['Date', 'Details', 'Reason', 'Amount'], st.offs.map(o => `<tr><td>${escHtml(o.date)}</td><td>${escHtml(o.text)}</td><td class="r">${escHtml(o.reason || '')}</td><td class="r">${fmt(o.amount)}</td></tr>`).join(''))}` : ''}
<div class="tot">TOTAL DUE: ${fmt(st.due)}</div><p class="c" style="margin-top:24px"><small>Please settle your balance at your earliest convenience. Thank you for your business!</small></p><script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`);
  w.document.close();
};

function DebtorsTab({ sales, setSales, invoices, customers, setCustomers, debts = [], setDebts, debtsErr, branches = [], activeBranch = 'all', userId, addNotif, setActiveTab }) {
  const [view, setView]       = useState('active');
  const [open, setOpen]       = useState(null);
  const [collect, setCollect] = useState(null);
  const [form, setForm]       = useState(null);
  const [wo, setWo]           = useState(null);
  const [stmt, setStmt]       = useState(null);
  const [done, setDone]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const [q, setQ]             = useState('');
  const today = todayStr(), month = getCurrentMonth();
  const ageOf = (d) => Math.max(0, Math.round((new Date(today) - new Date(d || today)) / 86400000));
  const defBranch = activeBranch !== 'all' ? activeBranch : (branches[0]?.name || '');
  const warn = (m) => addNotif(m, 'warning');

  const map = {};
  const slot = (k) => (map[k] = map[k] || { name: k, items: [], inv: [], manual: [], owed: 0, collectable: 0 });
  sales.filter(s => (s.balance || 0) > 0).forEach(s => { const r = slot(s.customer || 'Walk-in'); r.items.push(s); r.owed += s.balance; r.collectable += s.balance; });
  debts.filter(d => remD(d) > 0).forEach(d => { const r = slot(d.customer); r.manual.push(d); r.owed += remD(d); r.collectable += remD(d); });
  invoices.filter(i => i.status !== 'paid' && i.amount - i.paid > 0).forEach(i => { const r = slot(i.customer || 'Unknown'); r.inv.push(i); r.owed += i.amount - i.paid; });
  const rows = Object.values(map).map(r => {
    const dates = [...r.items.map(s => s.date), ...r.manual.map(d => d.date), ...r.inv.map(i => i.date)].filter(Boolean).sort();
    const cx = customers.find(c => c.name === r.name);
    return { ...r, age: ageOf(dates[0]), phone: cx?.whatsapp || cx?.phone || r.manual.find(d => d.phone)?.phone, late: r.manual.some(d => d.due_date && d.due_date < today) };
  }).filter(r => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => b.owed - a.owed);

  const woItems = [
    ...sales.filter(s => (s.written_off || 0) > 0).map(s => ({ t: 's', id: s.id, s, name: s.customer || 'Walk-in', amt: s.written_off, date: s.writeoff_date || s.date, reason: s.writeoff_reason, what: s.description })),
    ...debts.filter(d => (d.written_off || 0) > 0).map(d => ({ t: 'm', id: d.id, d, name: d.customer, amt: d.written_off, date: d.writeoff_date || d.date, reason: d.writeoff_reason, what: d.reason || d.kind })),
  ].filter(x => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const woTotal = woItems.reduce((a, x) => a + x.amt, 0);

  const total = rows.reduce((a, r) => a + r.owed, 0);
  const over30 = rows.filter(r => r.age > 30 || r.late).reduce((a, r) => a + r.owed, 0);
  const collected = sales.filter(s => (s.description || '').startsWith('Debt payment') && (s.date || '').startsWith(month)).reduce((a, s) => a + s.amount, 0)
    + debts.filter(d => d.kind === 'Money lent').reduce((a, d) => a + parsePays(d.payments).filter(p => (p.date || '').startsWith(month)).reduce((x, p) => x + p.amount, 0), 0);
  const buckets = [['0–30 days', 0, 30], ['31–60 days', 31, 60], ['61–90 days', 61, 90], ['90+ days', 91, 99999]].map(([l, lo, hi]) => ({ l, v: rows.filter(r => r.age >= lo && r.age <= hi).reduce((a, r) => a + r.owed, 0) }));
  const branchFor = (name) => { const r = map[name]; const b = (r?.items[0] || r?.manual[0])?.branch; return branches.find(x => x.name === b) || branches[0]; };

  const remind = (r) => {
    const lines = [...r.items.slice(0, 4).map(s => `• ${s.date} — ${s.description || 'Sale'}: ${fmt(s.balance)}`), ...r.manual.slice(0, 4).map(d => `• ${d.date} — ${d.reason || d.kind}: ${fmt(remD(d))}${d.due_date ? ` (due ${d.due_date})` : ''}`)].join('\n');
    openWhatsApp(r.phone, `Hi ${r.name}, this is a friendly reminder from *Bigbiney Printing Press* that you have an outstanding balance of *${fmt(r.owed)}*${r.age > 0 ? ` (oldest ${r.age} days)` : ''}.\n\n${lines}\n\nKindly settle at your earliest convenience. Thank you! 🙏`);
  };
  const newDebt = (name = '', phone = '') => setForm({ customer: name, phone, amount: '', kind: 'Sale on credit', reason: '', date: todayStr(), due_date: '', notes: '', branch: defBranch, saveCustomer: !name });
  const patchSales = (list) => setSales(prev => prev.map(x => list.find(u => u.id === x.id) || x));
  const patchDebts = (list) => setDebts(prev => prev.map(x => list.find(u => u.id === x.id) || x));

  const saveDebt = async () => {
    const name = form.customer.trim(), amt = parseFloat(form.amount);
    if (!name || !(amt > 0)) { warn('Enter the customer name and the amount owed'); return; }
    setSaving(true);
    const row = { customer: name, phone: form.phone.trim(), amount: amt, kind: form.kind, reason: form.reason, notes: form.notes, date: form.date, due_date: form.due_date || null, branch: form.branch || null };
    const res = form.id ? await db.updateDebt(form.id, row) : await db.addDebt(userId, { ...row, paid: 0, payments: '[]' });
    if (res.error || !res.data) { warn('Could not save: ' + (res.error?.message || 'run the setup SQL first (debts table)')); setSaving(false); return; }
    setDebts(prev => (form.id ? prev.map(x => (x.id === res.data.id ? res.data : x)) : [...prev, res.data]));
    if (form.saveCustomer && !form.id && !customers.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      const c = await db.addCustomer(userId, { name, phone: form.phone.trim(), whatsapp: form.phone.trim(), email: '', address: '' });
      if (c.data) setCustomers(prev => [...prev, c.data]);
    }
    addNotif(form.id ? 'Debt updated' : `${name} added as a debtor`, 'success'); setForm(null); setSaving(false);
  };

  /* ── delete / remove ── */
  const delManual = async (d) => {
    if (!window.confirm(`Delete this debt for ${d.customer} (${fmt(d.amount)})? This cannot be undone.`)) return;
    const { error } = await db.deleteDebt(d.id);
    if (error) warn('Could not delete'); else { setDebts(prev => prev.filter(x => x.id !== d.id)); addNotif('Debt deleted', 'success'); }
  };
  const clearSaleDebt = async (s) => {
    if (!window.confirm(`Remove this debt (${fmt(s.balance)} owed on ${s.receipt_no || s.date})?\n\nThe sale and the income already recorded stay in Finance — only the amount owed is cleared.`)) return;
    const r = await db.updateSale(s.id, { balance: 0 });
    if (r.error) warn('Could not remove: ' + r.error.message); else { patchSales([r.data]); addNotif('Debt removed', 'success'); }
  };
  const deleteAll = async (r) => {
    if (!window.confirm(`Delete ALL ${r.items.length + r.manual.length} debt record(s) for ${r.name} (${fmt(r.collectable)})?\n\nSales/income stay in Finance. Unpaid invoices (if any) are not touched. This cannot be undone.`)) return;
    const us = [];
    for (const s of r.items) { const x = await db.updateSale(s.id, { balance: 0 }); if (x.data) us.push(x.data); }
    for (const d of r.manual) await db.deleteDebt(d.id);
    patchSales(us); setDebts(prev => prev.filter(x => !r.manual.some(m => m.id === x.id))); addNotif(`Debts for ${r.name} deleted`, 'success');
  };

  /* ── write off / reinstate ── */
  const doWriteOff = async () => {
    setSaving(true); const us = [], ud = [];
    for (const it of wo.items) {
      if (it.t === 's') { const x = await db.updateSale(it.s.id, { balance: 0, written_off: (it.s.written_off || 0) + it.s.balance, writeoff_date: wo.date, writeoff_reason: wo.reason }); if (x.error) { warn('Could not write off: ' + x.error.message + ' — run the setup SQL first'); setSaving(false); return; } if (x.data) us.push(x.data); }
      else { const x = await db.updateDebt(it.d.id, { written_off: (it.d.written_off || 0) + remD(it.d), writeoff_date: wo.date, writeoff_reason: wo.reason }); if (x.error) { warn('Could not write off: ' + x.error.message + ' — run the setup SQL first'); setSaving(false); return; } if (x.data) ud.push(x.data); }
    }
    patchSales(us); patchDebts(ud); addNotif(`${fmt(wo.total)} written off for ${wo.name}`, 'success'); setWo(null); setSaving(false);
  };
  const reinstate = async (it) => {
    const x = it.t === 's' ? await db.updateSale(it.id, { balance: (it.s.balance || 0) + it.amt, written_off: 0, writeoff_date: null, writeoff_reason: null }) : await db.updateDebt(it.id, { written_off: 0, writeoff_date: null, writeoff_reason: null });
    if (x.error) warn('Could not reinstate'); else { it.t === 's' ? patchSales([x.data]) : patchDebts([x.data]); addNotif('Debt reinstated', 'success'); }
  };
  const forgetWo = async (it) => {
    if (!window.confirm(`Permanently delete this written-off record (${fmt(it.amt)} · ${it.name})?`)) return;
    if (it.t === 'm') { const { error } = await db.deleteDebt(it.id); if (!error) setDebts(prev => prev.filter(x => x.id !== it.id)); else warn('Could not delete'); }
    else { const x = await db.updateSale(it.id, { written_off: 0, writeoff_date: null, writeoff_reason: null }); if (x.error) warn('Could not delete'); else patchSales([x.data]); }
  };
  const startWriteOff = (name, items) => setWo({ name, items, total: items.reduce((a, it) => a + (it.t === 's' ? it.s.balance : remD(it.d)), 0), reason: '', date: todayStr() });

  /* ── collect ── */
  const openCollect = (r) => setCollect({ name: r.name, max: r.collectable, amount: String(r.collectable), method: 'Cash', reference: '', date: todayStr() });
  const save = async () => {
    const amt = Math.min(parseFloat(collect.amount) || 0, collect.max);
    if (amt <= 0) { warn('Enter an amount to collect'); return; }
    setSaving(true);
    const r = map[collect.name];
    const queue = [...r.items.map(s => ({ t: 's', s, bal: s.balance, date: s.date })), ...r.manual.map(d => ({ t: 'm', d, bal: remD(d), date: d.date }))].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    let left = amt, income = 0; const alloc = [];
    for (const it of queue) { if (left <= 0) break; const take = Math.min(left, it.bal); alloc.push({ ...it, take }); left -= take; if (it.t === 's' || it.d.kind !== 'Money lent') income += take; }
    const us = [], ud = [];
    for (const a of alloc) {
      if (a.t === 's') { const x = await db.updateSale(a.s.id, { balance: Math.max(0, a.s.balance - a.take) }); if (x.data) us.push(x.data); }
      else { const x = await db.updateDebt(a.d.id, { paid: a.d.paid + a.take, payments: JSON.stringify([...parsePays(a.d.payments), { date: collect.date, amount: a.take, method: collect.method, reference: collect.reference }]) }); if (x.data) ud.push(x.data); }
    }
    let newSale = null;
    if (income > 0) {
      const n = sales.filter(s => s.date === collect.date).length + 1;
      const res = await db.addSale(userId, { date: collect.date, amount: income, job_id: null, payment_method: collect.method, branch: (alloc[0].s || alloc[0].d).branch || defBranch || null, customer: collect.name, description: `Debt payment — ${alloc.map(a => (a.s ? (a.s.receipt_no || a.s.date) : (a.d.reason || a.d.date))).join(', ')}`, total: income, balance: 0, reference: collect.reference, receipt_no: `RC-${collect.date.replace(/-/g, '')}-${String(n).padStart(3, '0')}` });
      if (res.error) { warn('Could not record income: ' + (res.error.message || res.error)); setSaving(false); return; }
      newSale = res.data;
    }
    setSales(prev => { const next = prev.map(x => us.find(u => u.id === x.id) || x); return newSale && !next.some(x => x.id === newSale.id) ? [...next, newSale] : next; });
    patchDebts(ud);
    addNotif(`${fmt(amt)} collected from ${collect.name}`, 'success');
    if (newSale) setDone({ ...newSale, date: collect.date, amount: income, customer: collect.name, payment_method: collect.method, total: income, balance: 0, description: 'Debt payment' });
    setCollect(null); setSaving(false);
  };
  const exportCSV = () => downloadCSV('debtors.csv', [['Customer', 'Owed', 'Oldest (days)', 'Phone', 'Sale debts', 'Manual debts', 'Invoices'], ...rows.map(r => [r.name, r.owed, r.age, r.phone || '', r.items.length, r.manual.length, r.inv.length])]);
  const st = stmt ? buildStatement(stmt, sales, debts, invoices) : null;
  const stPhone = stmt ? (customers.find(c => c.name === stmt)?.whatsapp || customers.find(c => c.name === stmt)?.phone || debts.find(d => d.customer === stmt && d.phone)?.phone) : null;

  return (
    <div>
      <div className="d-hero"><div><h2>💳 Debtors</h2><p>Who owes you money, how old the debt is, and one-tap reminders</p></div>
        <div className="d-actions"><button className="d-act" onClick={exportCSV}>⬇️ Export CSV</button><button className="d-act p" onClick={() => newDebt()}>+ Add debtor</button></div></div>
      {debtsErr && <><DbWarn /><p className="err">Manual debtors need the new table: {debtsErr}</p></>}
      <div className="d-kpis">
        <Kpi label="Total owed to you" value={fmt(total)} icon="💳" color="var(--red-ink)" delta={null} sub={`${rows.length} customer${rows.length === 1 ? '' : 's'}`} />
        <Kpi label="Overdue" value={fmt(over30)} icon="⏳" color="var(--amber-ink)" delta={null} sub="Older than 30 days or past due date" />
        <Kpi label="Collected this month" value={fmt(collected)} icon="✅" color="var(--green-ink)" delta={null} sub="Debt payments received" />
        <Kpi label="Written off" value={fmt(woTotal)} icon="🚫" color="#7c3aed" delta={null} sub="Bad debts, kept on record" />
      </div>
      <div className="d-grid g-2-1">
        <div className="d-card">
          <div className="d-head">
            <div className="d-seg"><button className={view === 'active' ? 'on' : ''} onClick={() => setView('active')}>Owing ({rows.length})</button><button className={view === 'written' ? 'on' : ''} onClick={() => setView('written')}>Written off ({woItems.length})</button></div>
            <div style={{ minWidth: 170 }}><Inp placeholder="Search customer…" value={q} onChange={e => setQ(e.target.value)} /></div>
          </div>
          {view === 'active' ? (rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>🎉 Nobody owes you anything right now. Use “+ Add debtor” to record an old debt.</p> : rows.map(r => (
            <div key={r.name} className="db-row">
              <div className="db-main" onClick={() => setOpen(open === r.name ? null : r.name)}>
                <div className="pr-av">{initials(r.name)}</div>
                <div style={{ minWidth: 0, flex: 1 }}><b className="ellip" style={{ display: 'block' }}>{r.name}</b><span className="muted" style={{ fontSize: 12 }}>{r.items.length + r.manual.length + r.inv.length} item(s) · oldest {r.age} day{r.age === 1 ? '' : 's'}{r.phone ? ` · ${r.phone}` : ''}</span></div>
                <div style={{ textAlign: 'right' }}><b style={{ color: 'var(--red-ink)' }}>{fmt(r.owed)}</b><div><span className={`d-tag ${r.age > 30 || r.late ? 'hot' : ''}`}>{r.late ? 'Past due date' : r.age > 60 ? 'Very overdue' : r.age > 30 ? 'Overdue' : 'Current'}</span></div></div>
              </div>
              <div className="db-act">
                <Btn small variant="success" disabled={r.collectable <= 0} onClick={() => openCollect(r)}>💰 Collect</Btn>
                <Btn small variant="ghost" disabled={!r.phone} onClick={() => remind(r)}>{r.phone ? '📲 Remind' : 'No phone'}</Btn>
                <Btn small variant="ghost" onClick={() => setStmt(r.name)}>📄 Statement</Btn>
                <Btn small variant="ghost" onClick={() => newDebt(r.name, r.phone || '')}>➕ Debt</Btn>
                {r.collectable > 0 && <Btn small variant="ghost" onClick={() => startWriteOff(r.name, [...r.items.map(s => ({ t: 's', s })), ...r.manual.map(d => ({ t: 'm', d }))])}>🚫 Write off</Btn>}
                {r.collectable > 0 && <Btn small variant="danger" onClick={() => deleteAll(r)}>🗑 Delete</Btn>}
                {r.inv.length > 0 && <Btn small variant="ghost" onClick={() => setActiveTab('invoices')}>🧾 Invoices ({r.inv.length})</Btn>}
              </div>
              {open === r.name && (
                <div className="db-items">
                  {r.items.map(s => (
                    <div key={s.id} style={{ padding: '4px 0' }}>
                      <div className="ln-r"><span>{s.date} · {s.receipt_no || ''} <span className="muted">{s.description}</span></span><b>{fmt(s.balance)} <span className="muted" style={{ fontWeight: 400 }}>of {fmt(s.total ?? s.amount)}</span></b></div>
                      <div><button className="d-link" onClick={() => startWriteOff(r.name, [{ t: 's', s }])}>Write off</button>{' · '}<button className="d-link" style={{ color: 'var(--red-ink)' }} onClick={() => clearSaleDebt(s)}>Delete debt</button></div>
                    </div>
                  ))}
                  {r.manual.map(d => (
                    <div key={d.id} style={{ borderTop: '1px dashed var(--line)', padding: '6px 0' }}>
                      <div className="ln-r"><span>{d.date} · <span className="d-tag">{d.kind}</span> <span className="muted">{d.reason}</span>{d.due_date ? <span className={d.due_date < today ? 'err' : 'muted'} style={{ display: 'inline' }}> · due {d.due_date}</span> : null}</span><b>{fmt(remD(d))} <span className="muted" style={{ fontWeight: 400 }}>of {fmt(d.amount)}</span></b></div>
                      {d.notes && <div className="muted">📝 {d.notes}</div>}
                      {parsePays(d.payments).map((p, i) => <div key={i} className="muted">↳ paid {fmt(p.amount)} on {p.date} ({p.method})</div>)}
                      <div><button className="d-link" onClick={() => setForm({ ...d, amount: String(d.amount), phone: d.phone || '', due_date: d.due_date || '', saveCustomer: false })}>Edit</button>{' · '}<button className="d-link" onClick={() => startWriteOff(r.name, [{ t: 'm', d }])}>Write off</button>{' · '}<button className="d-link" style={{ color: 'var(--red-ink)' }} onClick={() => delManual(d)}>Delete</button></div>
                    </div>
                  ))}
                  {r.inv.map(i => <div key={i.id} className="ln-r"><span>Invoice {i.invoice_no || i.id} · {i.date} <span className="muted">(manage in Invoices)</span></span><b>{fmt(i.amount - i.paid)}</b></div>)}
                </div>
              )}
            </div>
          ))) : (woItems.length === 0 ? <p className="muted" style={{ margin: 0 }}>No written-off debts. Use “🚫 Write off” on a debt you no longer expect to recover — it leaves your totals but stays on record.</p> : woItems.map(it => (
            <div key={it.t + it.id} className="db-row">
              <div className="db-main" style={{ cursor: 'default' }}>
                <div className="pr-av">{initials(it.name)}</div>
                <div style={{ minWidth: 0, flex: 1 }}><b className="ellip" style={{ display: 'block' }}>{it.name}</b><span className="muted" style={{ fontSize: 12 }}>{it.what || 'Debt'} · written off {it.date}{it.reason ? ` · “${it.reason}”` : ''}</span></div>
                <b style={{ color: '#7c3aed' }}>{fmt(it.amt)}</b>
              </div>
              <div className="db-act"><Btn small variant="ghost" onClick={() => reinstate(it)}>↩ Reinstate</Btn><Btn small variant="ghost" onClick={() => setStmt(it.name)}>📄 Statement</Btn><Btn small variant="danger" onClick={() => forgetWo(it)}>🗑 Delete</Btn></div>
            </div>
          )))}
        </div>
        <div className="d-card"><div className="d-head"><h3>Debt age</h3><span className="muted">{fmt(total)}</span></div>
          <BarList rows={buckets.map((b, i) => ({ label: b.l, pct: total > 0 ? Math.round((b.v / total) * 100) : 0, color: i >= 2 ? 'var(--red-ink)' : i === 1 ? 'var(--amber-ink)' : 'var(--green-ink)', right: fmt(b.v) }))} />
        </div>
      </div>

      {wo && (
        <Modal title={`🚫 Write off — ${wo.name}`} onClose={() => setWo(null)}>
          <p style={{ marginTop: 0 }}>You are writing off <b style={{ color: '#7c3aed' }}>{fmt(wo.total)}</b> ({wo.items.length} item{wo.items.length === 1 ? '' : 's'}) as a bad debt. It will stop counting as money owed to you, but the record is kept and you can reinstate it any time.</p>
          <div className="sm-grid"><Inp label="Reason" value={wo.reason} onChange={e => setWo({ ...wo, reason: e.target.value })} placeholder="e.g. Customer cannot be reached" /><Inp label="Date" type="date" value={wo.date} onChange={e => setWo({ ...wo, date: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}><Btn variant="ghost" onClick={() => setWo(null)}>Cancel</Btn><Btn variant="danger" disabled={saving} onClick={doWriteOff}>{saving ? 'Saving…' : 'Write off'}</Btn></div>
        </Modal>
      )}
      {st && (
        <Modal title={`📄 Statement — ${st.name}`} onClose={() => setStmt(null)} wide>
          <div className="rcpt">
            <div className="rcpt-h"><b>Statement of account</b><div>Bigbiney Printing Press · {todayStr()}</div></div>
            <div className="muted" style={{ marginBottom: 4 }}>Outstanding</div>
            {st.items.length === 0 ? <p style={{ margin: '0 0 8px' }}>Nothing outstanding 🎉</p> : st.items.map((i, k) => <div key={k} className="ln-r"><span>{i.date} · {i.text}{i.due ? <span className="muted"> (promised {i.due})</span> : null} <span className="muted">paid {fmt(i.paid)} of {fmt(i.orig)}</span></span><b>{fmt(i.bal)}</b></div>)}
            <hr />
            <div className="ln-r" style={{ fontSize: 16 }}><span>Total due</span><b style={{ color: st.due > 0 ? 'var(--red-ink)' : 'var(--green-ink)' }}>{fmt(st.due)}</b></div>
            {st.pays.length > 0 && <><div className="muted" style={{ margin: '10px 0 4px' }}>Payments received · {fmt(st.paidTotal)}</div>{st.pays.slice(-8).map((p, k) => <div key={k} className="ln-r"><span>{p.date} · {p.text} <span className="muted">{p.method}</span></span><b style={{ color: 'var(--green-ink)' }}>{fmt(p.amount)}</b></div>)}</>}
            {st.offs.length > 0 && <><div className="muted" style={{ margin: '10px 0 4px' }}>Written off · {fmt(st.offTotal)}</div>{st.offs.map((o, k) => <div key={k} className="ln-r"><span>{o.date} · {o.text}{o.reason ? ` — ${o.reason}` : ''}</span><b>{fmt(o.amount)}</b></div>)}</>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <Btn onClick={() => printStatement(st, branchFor(st.name), stPhone)}>🖨️ Print / Save PDF</Btn>
            <Btn variant="success" disabled={!stPhone} onClick={() => openWhatsApp(stPhone, statementText(st))}>{stPhone ? '📲 Send via WhatsApp' : '📲 No phone number'}</Btn>
            <Btn variant="ghost" onClick={() => setStmt(null)}>Close</Btn>
          </div>
        </Modal>
      )}
      {form && (
        <Modal title={form.id ? `Edit debt — ${form.customer}` : '➕ Add debtor'} onClose={() => setForm(null)} wide>
          <datalist id="db-cx">{customers.slice(0, 2000).map(c => <option key={c.id} value={c.name} />)}</datalist>
          <div className="sm-grid">
            <Inp label="Customer / debtor name *" list="db-cx" value={form.customer} onChange={e => { const v = e.target.value, c = customers.find(x => x.name === v); setForm({ ...form, customer: v, phone: form.phone || c?.whatsapp || c?.phone || '', saveCustomer: !c && !form.id }); }} />
            <Inp label="Phone / WhatsApp" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 0244123456" />
            <Inp label="Amount owed (GH₵) *" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <Sel label="Type of debt" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{DEBT_KINDS.map(k => <option key={k}>{k}</option>)}</Sel>
            <Inp label="Date it started" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <Inp label="Promised pay date (optional)" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            {branches.length > 0 && <Sel label="Branch" value={form.branch || ''} onChange={e => setForm({ ...form, branch: e.target.value })}>{branches.map(b => <option key={b.name}>{b.name}</option>)}</Sel>}
            <Inp label="What is it for?" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. 500 flyers, Oct 2026" />
          </div>
          <div style={{ marginTop: 10 }}><Inp label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Address, who vouched for them, payment arrangement…" /></div>
          <p className="muted" style={{ fontSize: 12, margin: '8px 0' }}>{form.kind === 'Money lent' ? 'Money lent: when they pay back, it reduces the debt but is not counted as sales income.' : 'Sale on credit: when they pay, the payment is recorded as income in Finance.'}</p>
          {!form.id && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" style={{ width: 'auto' }} checked={!!form.saveCustomer} onChange={e => setForm({ ...form, saveCustomer: e.target.checked })} />Also save as a customer (if not already in Customers)</label>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}><Btn variant="ghost" onClick={() => setForm(null)}>Cancel</Btn><Btn disabled={saving} onClick={saveDebt}>{saving ? 'Saving…' : '✔ Save debtor'}</Btn></div>
        </Modal>
      )}
      {collect && (
        <Modal title={`💰 Collect from ${collect.name}`} onClose={() => setCollect(null)}>
          <p className="muted" style={{ marginTop: 0 }}>Owes {fmt(collect.max)}. Payment is applied to the oldest debts first.</p>
          <div className="sm-grid">
            <Inp label="Amount (GH₵)" type="number" value={collect.amount} onChange={e => setCollect({ ...collect, amount: e.target.value })} />
            <Inp label="Date" type="date" value={collect.date} onChange={e => setCollect({ ...collect, date: e.target.value })} />
            <Sel label="Method" value={collect.method} onChange={e => setCollect({ ...collect, method: e.target.value })}>{['Cash', 'Mobile Money', 'Bank Transfer'].map(m => <option key={m}>{m}</option>)}</Sel>
            <Inp label="Reference / MoMo ID" value={collect.reference} onChange={e => setCollect({ ...collect, reference: e.target.value })} />
          </div>
          <div className="sm-sum"><div className="ln-r"><span>Balance after payment</span><b>{fmt(Math.max(0, collect.max - (parseFloat(collect.amount) || 0)))}</b></div></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}><Btn variant="ghost" onClick={() => setCollect(null)}>Cancel</Btn><Btn variant="success" disabled={saving} onClick={save}>{saving ? 'Saving…' : '✔ Record payment'}</Btn></div>
        </Modal>
      )}
      {done && <SaleReceipt sale={done} branch={branches.find(b => b.name === done.branch)} customers={customers} onClose={() => setDone(null)} />}
    </div>
  );
}

/* ───────────── PRICE LIST ───────────── */
const PRICE_UNITS = ['each', 'page', 'copy', 'sq. ft', 'sq. m', 'set', 'hour'];
const PRICE_CATS  = ['Printing', 'Banners & Signs', 'Apparel', 'Stationery', 'Design', 'Other'];

function PricesTab({ priceList, savePriceList, addNotif }) {
  const [modal, setModal] = useState(null);
  const [adj, setAdj]     = useState(null);
  const [q, setQ]         = useState('');
  const [cat, setCat]     = useState('all');
  const cats = [...new Set([...PRICE_CATS, ...priceList.map(p => p.category).filter(Boolean)])];
  const shown = priceList.filter(p => (cat === 'all' || p.category === cat) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())));
  const saveItem = async () => {
    const name = modal.name.trim(), price = parseFloat(modal.price);
    if (!name || !(price >= 0)) { addNotif('Enter a name and a price', 'warning'); return; }
    if (!modal.id && priceList.some(p => p.name.toLowerCase() === name.toLowerCase())) { addNotif('That item already exists', 'warning'); return; }
    const item = { id: modal.id || `p${Date.now()}`, name, category: modal.category || 'Other', unit: modal.unit || 'each', price };
    await savePriceList(modal.id ? priceList.map(p => (p.id === item.id ? item : p)) : [...priceList, item]);
    addNotif('Price saved', 'success'); setModal(null);
  };
  const applyAdj = async () => {
    const pct = parseFloat(adj.pct); if (!pct) return;
    await savePriceList(priceList.map(p => (adj.cat === 'all' || p.category === adj.cat ? { ...p, price: Math.round(p.price * (1 + pct / 100) * 100) / 100 } : p)));
    addNotif(`Prices ${pct > 0 ? 'increased' : 'reduced'} by ${Math.abs(pct)}%`, 'success'); setAdj(null);
  };
  return (
    <div>
      <div className="d-hero"><div><h2>🏷️ Price List</h2><p>{priceList.length} items · used automatically in the Record Sale popup at every branch</p></div>
        <div className="d-actions"><button className="d-act" disabled={!priceList.length} onClick={() => setAdj({ pct: '', cat: 'all' })}>± Adjust prices</button><button className="d-act p" onClick={() => setModal({ name: '', category: 'Printing', unit: 'each', price: '' })}>+ Add item</button></div></div>
      <div className="d-card">
        <div className="d-filters">
          <Inp label="Search" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. banner" />
          <Sel label="Category" value={cat} onChange={e => setCat(e.target.value)}><option value="all">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</Sel>
        </div>
        {shown.length === 0 ? <p className="muted" style={{ margin: 0 }}>{priceList.length ? 'No items match.' : 'No prices yet. Click “+ Add item” — e.g. “A4 colour print”, 2.00, per page. When you record a sale, typing the name fills the price automatically.'}</p> : (
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Item', 'Category', 'Unit', 'Price', ''].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>{[...shown].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).map(p => (
              <tr key={p.id}><TD style={{ fontWeight: 600 }}>{p.name}</TD><TD><span className="d-tag">{p.category}</span></TD><TD>per {p.unit}</TD><TD style={{ fontWeight: 800, color: 'var(--primary)' }}>{fmt(p.price)}</TD>
                <TD style={{ whiteSpace: 'nowrap' }}><button className="d-link" onClick={() => setModal({ ...p })}>Edit</button>{' '}<button className="d-link" style={{ color: 'var(--red-ink)' }} onClick={() => window.confirm(`Delete “${p.name}”?`) && savePriceList(priceList.filter(x => x.id !== p.id))}>Delete</button></TD></tr>))}</tbody>
          </table></div>
        )}
      </div>
      {modal && (
        <Modal title={modal.id ? 'Edit price' : 'Add price'} onClose={() => setModal(null)}>
          <datalist id="pr-cats">{cats.map(c => <option key={c} value={c} />)}</datalist>
          <Inp label="Item / service name *" value={modal.name} onChange={e => setModal({ ...modal, name: e.target.value })} placeholder="e.g. A4 colour print" />
          <div className="sm-grid" style={{ marginTop: 10 }}>
            <Inp label="Price (GH₵) *" type="number" value={modal.price} onChange={e => setModal({ ...modal, price: e.target.value })} />
            <Sel label="Unit" value={modal.unit} onChange={e => setModal({ ...modal, unit: e.target.value })}>{PRICE_UNITS.map(u => <option key={u}>{u}</option>)}</Sel>
            <Inp label="Category" list="pr-cats" value={modal.category} onChange={e => setModal({ ...modal, category: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}><Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={saveItem}>Save</Btn></div>
        </Modal>
      )}
      {adj && (
        <Modal title="± Adjust prices" onClose={() => setAdj(null)}>
          <div className="sm-grid"><Inp label="Change by % (e.g. 10 or -5)" type="number" value={adj.pct} onChange={e => setAdj({ ...adj, pct: e.target.value })} />
            <Sel label="Apply to" value={adj.cat} onChange={e => setAdj({ ...adj, cat: e.target.value })}><option value="all">All items</option>{cats.map(c => <option key={c}>{c}</option>)}</Sel></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}><Btn variant="ghost" onClick={() => setAdj(null)}>Cancel</Btn><Btn onClick={applyAdj}>Apply</Btn></div>
        </Modal>
      )}
    </div>
  );
}

/* ───────────── ACTIVITY LOG ───────────── */
function ActivityTab({ userId, branches = [], activeBranch = 'all' }) {
  const [log, setLog]       = useState([]);
  const [err, setErr]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [fAct, setFAct]     = useState('all');
  const [fEnt, setFEnt]     = useState('all');
  const [q, setQ]           = useState('');
  const load = async () => { setLoading(true); const { data, error } = await db.getActivity(userId, 500); setErr(error ? error.message : null); setLog(data || []); setLoading(false); };
  useEffect(() => { load(); }, [userId]);
  const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const first = branches[0]?.name;
  const rows = log.filter(l => (fAct === 'all' || l.action === fAct) && (fEnt === 'all' || l.entity === fEnt) && (activeBranch === 'all' || (l.branch || first) === activeBranch) && (!q.trim() || `${l.details} ${l.actor} ${l.entity}`.toLowerCase().includes(q.trim().toLowerCase())));
  const ents = [...new Set(log.map(l => l.entity))];
  const color = { add: 'var(--green-ink)', update: 'var(--blue-ink)', delete: 'var(--red-ink)' };
  const verb = { add: 'Added', update: 'Changed', delete: 'Deleted' };
  return (
    <div>
      <div className="d-hero"><div><h2>📜 Activity Log</h2><p>Every record added, changed or deleted — with who and when</p></div><div className="d-actions"><button className="d-act" onClick={load}>↻ Refresh</button></div></div>
      {err && <><DbWarn /><p className="err">Could not read the log: {err}</p></>}
      <div className="d-card">
        <div className="d-filters">
          <Sel label="Action" value={fAct} onChange={e => setFAct(e.target.value)}><option value="all">All actions</option><option value="add">Added</option><option value="update">Changed</option><option value="delete">Deleted</option></Sel>
          <Sel label="Type" value={fEnt} onChange={e => setFEnt(e.target.value)}><option value="all">Everything</option>{ents.map(e => <option key={e}>{e}</option>)}</Sel>
          <Inp label="Search" value={q} onChange={e => setQ(e.target.value)} placeholder="Customer, amount, staff…" />
        </div>
        {loading ? <p className="muted">Loading…</p> : rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>{log.length ? 'Nothing matches.' : 'No activity recorded yet — it starts logging from now on.'}</p> : rows.map(l => (
          <div key={l.id} className="d-row" style={{ alignItems: 'flex-start' }}>
            <span className="d-tag" style={{ color: color[l.action], flex: 'none', minWidth: 62, textAlign: 'center' }}>{verb[l.action] || l.action}</span>
            <div style={{ flex: 1, minWidth: 0 }}><div><b>{l.entity}</b> <span style={{ overflowWrap: 'anywhere' }}>{l.details}</span></div><div className="muted" style={{ fontSize: 11 }}>{l.actor || 'unknown'}{l.branch ? ` · ${l.branch}` : ''}</div></div>
            <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }} title={new Date(l.created_at).toLocaleString()}>{ago(l.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BranchesTab({ openBranch, branches, saveBranches, sales, setSales, expenses, customers, addNotif, userId }) {
  const list = branches.length ? branches : [{ ...EMPTY_BR, name: 'Main Branch' }];
  const first = list[0].name;
  const [period, setPeriod] = useState('month');
  const [sel, setSel]       = useState(first);
  const [modal, setModal]   = useState(null);
  const [saleFor, setSaleFor] = useState(null);
  const [view, setView]     = useState(null);
  const month = getCurrentMonth(), today = todayStr();
  const bOf = (x) => x.branch || first;
  const inP = (d) => (period === 'all' ? true : period === 'today' ? d === today : (d || '').startsWith(month));
  const sum = (arr) => arr.reduce((a, x) => a + Number(x.amount || 0), 0);

  const stats = list.map(b => {
    const s = sales.filter(x => bOf(x) === b.name), e = expenses.filter(x => bOf(x) === b.name);
    const ps = s.filter(x => inP(x.date)), pe = e.filter(x => inP(x.date));
    return { b, rev: sum(ps), exp: sum(pe), profit: sum(ps) - sum(pe), today: sum(s.filter(x => x.date === today)), count: ps.length, avg: ps.length ? sum(ps) / ps.length : 0, owed: s.reduce((a, x) => a + (x.balance || 0), 0) };
  });
  const totalRev = stats.reduce((a, s) => a + s.rev, 0);
  const cur = list.find(b => b.name === sel) || list[0];
  const selSales = sales.filter(x => bOf(x) === cur.name), selExp = expenses.filter(x => bOf(x) === cur.name);
  const m6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1), k = monthKey(d); return { label: d.toLocaleString('en', { month: 'short' }), inc: sumAmt(selSales, s => s.date?.startsWith(k)), exp: sumAmt(selExp, x => x.date?.startsWith(k)) }; });
  const recent = [...selSales].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 15);
  const catRows = EXP_CATS.map(c => ({ label: c, v: sum(selExp.filter(x => x.category === c && inP(x.date))) })).filter(x => x.v > 0);
  const catTotal = catRows.reduce((a, x) => a + x.v, 0);

  const saveBranch = async () => {
    const name = modal.name.trim();
    if (!name) return;
    if (!modal.isEdit && list.some(b => b.name.toLowerCase() === name.toLowerCase())) { addNotif('A branch with that name already exists', 'warning'); return; }
    const rec = { name, address: modal.address, phone: modal.phone, manager: modal.manager };
    await saveBranches(modal.isEdit ? list.map(b => (b.name === name ? rec : b)) : [...list, rec]);
    addNotif(modal.isEdit ? 'Branch updated' : 'Branch added', 'success'); setModal(null);
  };
  const delBranch = async (b) => {
    if (list.length < 2) return;
    if (!window.confirm(`Remove "${b.name}"? Its sales and expenses are kept, but will be shown under ${list.find(x => x.name !== b.name).name} until reassigned.`)) return;
    await saveBranches(list.filter(x => x.name !== b.name));
    if (sel === b.name) setSel(first);
  };

  return (
    <div>
      <div className="d-hero">
        <div><h2>🏬 Branches</h2><p>{list.length} branch{list.length > 1 ? 'es' : ''} · compare performance and record sales per branch</p></div>
        <div className="d-actions">
          <div className="d-seg">{[['today', 'Today'], ['month', 'This month'], ['all', 'All time']].map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div>
          <button className="d-act p" onClick={() => setModal({ ...EMPTY_BR })}>+ Add branch</button>
        </div>
      </div>

      {!branchColReady(sales) && <DbWarn />}
      <div className="d-grid g-2">
        {stats.map(({ b, rev, exp, profit, today: t, count, avg, owed }) => (
          <div key={b.name} className="d-card" style={sel === b.name ? { borderColor: 'var(--primary)' } : undefined}>
            <div className="d-head">
              <div style={{ minWidth: 0 }}><h3 style={{ fontSize: 16 }}>🏬 {b.name} {b.name === first && <span className="d-tag">Main</span>}</h3>
                <div className="muted" style={{ fontSize: 12 }}>{[b.address, b.phone, b.manager && `Manager: ${b.manager}`].filter(Boolean).join(' · ') || 'No details yet — click Edit'}</div></div>
              <span className="d-tag">{totalRev > 0 ? Math.round((rev / totalRev) * 100) : 0}% of sales</span>
            </div>
            <div className="ln-tiles" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              <div><b style={{ color: 'var(--green-ink)' }}>{fmt(rev)}</b><span>Sales</span></div>
              <div><b style={{ color: 'var(--red-ink)' }}>{fmt(exp)}</b><span>Expenses</span></div>
              <div><b style={{ color: profit >= 0 ? 'var(--primary)' : 'var(--red-ink)' }}>{fmt(profit)}</b><span>Profit</span></div>
              <div><b>{fmt(t)}</b><span>Today</span></div>
              <div><b>{count}</b><span>Transactions</span></div>
              <div><b style={{ color: owed > 0 ? 'var(--red-ink)' : undefined }}>{fmt(owed)}</b><span>Owed to you</span></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn small onClick={() => openBranch && openBranch(b.name)}>➡️ Open workspace</Btn>
              <Btn variant="success" small onClick={() => setSaleFor(b.name)}>💰 Record sale</Btn>
              <Btn variant="ghost" small onClick={() => setSel(b.name)}>📊 View details</Btn>
              <Btn variant="ghost" small onClick={() => setModal({ ...EMPTY_BR, ...b, isEdit: true })}>Edit</Btn>
              {list.length > 1 && <Btn variant="danger" small onClick={() => delBranch(b)}>Remove</Btn>}
            </div>
          </div>
        ))}
      </div>

      {list.length > 1 && (
        <div className="d-card" style={{ marginBottom: 14 }}>
          <div className="d-head"><h3>Branch comparison — sales</h3><span className="muted">{fmt(totalRev)} total</span></div>
          <BarList rows={stats.map(s => ({ label: s.b.name, pct: totalRev > 0 ? Math.round((s.rev / totalRev) * 100) : 0, right: `${fmt(s.rev)} · ${totalRev > 0 ? Math.round((s.rev / totalRev) * 100) : 0}%` }))} />
        </div>
      )}

      <div className="d-card" style={{ marginBottom: 14 }}>
        <div className="d-head"><h3>📊 {cur.name} — details</h3>
          <select value={cur.name} onChange={e => setSel(e.target.value)} style={{ width: 'auto' }}>{list.map(b => <option key={b.name}>{b.name}</option>)}</select></div>
        <div className="d-grid g-2-1" style={{ marginBottom: 0 }}>
          <div><div className="muted" style={{ marginBottom: 6 }}>Income vs expenses — last 6 months</div><FlowChart series={m6} /></div>
          <div><div className="muted" style={{ marginBottom: 6 }}>Expenses by category</div><BarList rows={catRows.map(c => ({ label: c.label, pct: catTotal > 0 ? Math.round((c.v / catTotal) * 100) : 0, color: 'var(--red-ink)', right: fmt(c.v) }))} /></div>
        </div>
      </div>

      <div className="d-card">
        <div className="d-head"><h3>Recent sales — {cur.name}</h3><Btn small variant="success" onClick={() => setSaleFor(cur.name)}>+ Record sale</Btn></div>
        {recent.length === 0 ? <p className="muted" style={{ margin: 0 }}>No sales recorded for this branch yet.</p> : (
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Receipt', 'Date', 'Customer', 'Items', 'Method', 'Paid', 'Balance', ''].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>{recent.map(s => (
              <tr key={s.id}>
                <TD>{s.receipt_no || '—'}</TD><TD>{s.date}</TD><TD>{s.customer || 'Walk-in'}</TD>
                <TD style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description || '—'}</TD>
                <TD>{s.payment_method || 'Cash'}</TD><TD style={{ fontWeight: 700, color: 'var(--green-ink)' }}>{fmt(s.amount)}</TD>
                <TD style={{ color: s.balance > 0 ? 'var(--red-ink)' : 'var(--muted)', fontWeight: 600 }}>{s.balance > 0 ? fmt(s.balance) : '—'}</TD>
                <TD><button className="d-link" onClick={() => setView(s)}>🧾 Receipt</button></TD>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>

      {saleFor && <SaleModal onClose={() => setSaleFor(null)} customers={customers} branches={list} defaultBranch={saleFor} userId={userId} sales={sales} setSales={setSales} addNotif={addNotif} />}
      {view && <SaleReceipt sale={view} branch={list.find(b => b.name === bOf(view))} customers={customers} onClose={() => setView(null)} />}
      {modal && (
        <Modal title={modal.isEdit ? `Edit ${modal.name}` : 'Add branch'} onClose={() => setModal(null)}>
          <div className="sm-grid">
            <Inp label="Branch name" value={modal.name} disabled={modal.isEdit} onChange={e => setModal({ ...modal, name: e.target.value })} placeholder="e.g. Kumasi Branch" />
            <Inp label="Manager" value={modal.manager} onChange={e => setModal({ ...modal, manager: e.target.value })} />
            <Inp label="Phone" value={modal.phone} onChange={e => setModal({ ...modal, phone: e.target.value })} />
            <Inp label="Address / location" value={modal.address} onChange={e => setModal({ ...modal, address: e.target.value })} />
          </div>
          {modal.isEdit && <p className="muted" style={{ fontSize: 12 }}>The branch name can't be changed because existing sales are linked to it.</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}><Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn><Btn onClick={saveBranch}>Save branch</Btn></div>
        </Modal>
      )}
    </div>
  );
}

function ReportsTab({ jobs, sales: allSales, expenses: allExpenses, customers, inventory, invoices, loans = [], payroll = [], branches = [] }) {
  const [period, setPeriod] = useState('month');
  const [branch, setBranch] = useState('all');
  const firstB = branches[0]?.name;
  const sales = branch === 'all' ? allSales : allSales.filter(s => (s.branch || firstB) === branch);
  const expenses = branch === 'all' ? allExpenses : allExpenses.filter(x => (x.branch || firstB) === branch);
  const now = new Date();
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = ymd(now), Y = now.getFullYear();
  const dAgo = (n) => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  const mS = (o) => ymd(new Date(Y, now.getMonth() + o, 1)), mE = (o) => ymd(new Date(Y, now.getMonth() + o + 1, 0));
  const RANGES = {
    week:  { label: 'Last 7 days', r: [dAgo(6), today], prev: [dAgo(13), dAgo(7)] },
    month: { label: 'This month',  r: [mS(0), mE(0)],   prev: [mS(-1), mE(-1)] },
    last:  { label: 'Last month',  r: [mS(-1), mE(-1)], prev: [mS(-2), mE(-2)] },
    year:  { label: 'This year',   r: [`${Y}-01-01`, `${Y}-12-31`], prev: [`${Y - 1}-01-01`, `${Y - 1}-12-31`] },
    all:   { label: 'All time',    r: ['0000-01-01', '9999-12-31'], prev: null },
  };
  const cfg = RANGES[period];
  const inR = (d, r) => { const x = (d || '').slice(0, 10); return !!x && x >= r[0] && x <= r[1]; };
  const jobDate = (j) => j.start_date || j.due_date || j.created_at;
  const isLoan = (x) => /^loan/i.test(x.description || '');

  const pS = sales.filter(s => inR(s.date, cfg.r)), pE = expenses.filter(x => inR(x.date, cfg.r)), pJ = jobs.filter(j => inR(jobDate(j), cfg.r));
  const rev = pS.reduce((a, s) => a + s.amount, 0), exp = pE.reduce((a, x) => a + x.amount, 0), profit = rev - exp;
  const prevRev = cfg.prev ? sumAmt(sales, s => inR(s.date, cfg.prev)) : null, prevExp = cfg.prev ? sumAmt(expenses, x => inR(x.date, cfg.prev)) : null;
  const margin = rev > 0 ? (profit / rev) * 100 : 0;
  const loanPay = pE.filter(isLoan).reduce((a, x) => a + x.amount, 0);
  const payrollPaid = payroll.filter(p => inR(p.date, cfg.r)).reduce((a, p) => a + (p.amount || 0), 0);
  const completed = jobs.filter(j => j.status === 'completed').length;
  const unpaid = invoices.filter(i => i.status !== 'paid');
  const outstanding = unpaid.reduce((a, i) => a + (i.amount - i.paid), 0);
  const stockValue = inventory.reduce((a, i) => a + (i.quantity || 0) * (i.unit_cost || 0), 0);
  const avgJob = pJ.length > 0 ? pJ.reduce((a, j) => a + (j.price || 0), 0) / pJ.length : 0;

  const monthSeries = (n) => Array.from({ length: n }, (_, i) => {
    const d = new Date(Y, now.getMonth() - (n - 1 - i), 1), k = monthKey(d);
    const r = sumAmt(sales, s => s.date?.startsWith(k)), x = sumAmt(expenses, e => e.date?.startsWith(k));
    return { label: d.toLocaleString('en', { month: 'short', year: '2-digit' }), inc: r, exp: x, jobs: jobs.filter(j => (jobDate(j) || '').startsWith(k)).length };
  });
  const pl12 = monthSeries(12);
  let series;
  if (period === 'year' || period === 'all') series = period === 'year' ? Array.from({ length: 12 }, (_, i) => { const k = `${Y}-${String(i + 1).padStart(2, '0')}`; return { label: new Date(Y, i, 1).toLocaleString('en', { month: 'short' }), inc: sumAmt(sales, s => s.date?.startsWith(k)), exp: sumAmt(expenses, x => x.date?.startsWith(k)) }; }) : pl12;
  else {
    const start = new Date(cfg.r[0] + 'T00:00:00'), end = new Date(Math.min(new Date(cfg.r[1] + 'T00:00:00'), new Date(today + 'T00:00:00')));
    const n = Math.max(1, Math.round((end - start) / 86400000) + 1);
    series = Array.from({ length: n }, (_, i) => { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), ds = ymd(d); return { label: `${d.getDate()}/${d.getMonth() + 1}`, inc: sumAmt(sales, s => s.date === ds), exp: sumAmt(expenses, x => x.date === ds) }; });
  }

  const pct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);
  const methods = ['Cash', 'Mobile Money', 'Bank Transfer', 'Credit', 'Partial Payment', 'Other'].map(m => ({ label: m, v: pS.filter(s => (s.payment_method || 'Cash') === m).reduce((a, s) => a + s.amount, 0) })).filter(x => x.v > 0);
  const cats = EXP_CATS.map(c => { const l = pE.filter(x => x.category === c); return { label: c, v: l.reduce((a, x) => a + x.amount, 0), n: l.length }; }).filter(x => x.v > 0);
  const biggest = [...pE].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const brRows = branches.map(b => ({ label: b.name, rev: allSales.filter(s => (s.branch || firstB) === b.name && inR(s.date, cfg.r)).reduce((a, s) => a + s.amount, 0), exp: allExpenses.filter(x => (x.branch || firstB) === b.name && inR(x.date, cfg.r)).reduce((a, x) => a + x.amount, 0) }));
  const brTotal = brRows.reduce((a, r) => a + r.rev, 0);

  const group = (arr, keyFn) => { const m = {}; arr.forEach(j => { const k = keyFn(j) || 'Unassigned'; (m[k] = m[k] || { n: 0, rev: 0, cost: 0, done: 0 }); m[k].n++; m[k].rev += j.price || 0; m[k].cost += j.cost || 0; if (j.status === 'completed') m[k].done++; }); return Object.entries(m).sort((a, b) => b[1].rev - a[1].rev); };
  const byType = group(pJ, j => j.type), byStaff = group(pJ, j => j.assigned_to), byMachine = group(pJ, j => j.machine);

  const invPaid = {}, invOut = {};
  invoices.forEach(i => { const k = i.customer_id || i.customer; invPaid[k] = (invPaid[k] || 0) + (i.paid || 0); invOut[k] = (invOut[k] || 0) + Math.max(0, (i.amount || 0) - (i.paid || 0)); });
  const cx = {};
  pJ.filter(j => j.status !== 'cancelled').forEach(j => { const k = j.customer_id || j.customer; if (!k) return; cx[k] = cx[k] || { name: j.customer, jobs: 0, billed: 0, k }; cx[k].jobs++; cx[k].billed += j.price || 0; });
  const topCust = Object.values(cx).sort((a, b) => b.billed - a.billed).slice(0, 10);

  const aging = [['0–30 days', 0, 30], ['31–60 days', 31, 60], ['61–90 days', 61, 90], ['90+ days', 91, 99999]].map(([l, lo, hi]) => ({ l, v: unpaid.filter(i => { const a = Math.round((new Date(today) - new Date(i.date || today)) / 86400000); return a >= lo && a <= hi; }).reduce((s, i) => s + (i.amount - i.paid), 0) }));
  const borrowedBal = loans.filter(l => l.type === 'borrowed').reduce((a, l) => a + (l.amount - l.paid), 0);

  const exportPL = () => downloadCSV('monthly-profit-loss.csv', [['Month', 'Revenue', 'Expenses', 'Profit', 'Margin %', 'Jobs'], ...pl12.map(m => [m.label, m.inc, m.exp, m.inc - m.exp, pct(m.inc - m.exp, m.inc), m.jobs])]);
  const Tbl = ({ heads, children }) => <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{heads.map(h => <TH key={h}>{h}</TH>)}</tr></thead><tbody>{children}</tbody></table></div>;
  const GroupTbl = ({ rows, title }) => (
    <div className="d-card"><div className="d-head"><h3>{title}</h3></div>
      {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>No jobs in this period.</p> : (
        <Tbl heads={[title.split(' ').pop(), 'Jobs', 'Revenue', 'Cost', 'Profit', 'Done']}>
          {rows.map(([k, v]) => <tr key={k}><TD style={{ fontWeight: 600 }}>{k}</TD><TD>{v.n}</TD><TD>{fmt(v.rev)}</TD><TD>{fmt(v.cost)}</TD><TD style={{ fontWeight: 700, color: v.rev - v.cost >= 0 ? 'var(--green-ink)' : 'var(--red-ink)' }}>{fmt(v.rev - v.cost)}</TD><TD>{v.done}/{v.n}</TD></tr>)}
        </Tbl>
      )}
    </div>
  );
  const totP = pl12.reduce((a, m) => ({ inc: a.inc + m.inc, exp: a.exp + m.exp, jobs: a.jobs + m.jobs }), { inc: 0, exp: 0, jobs: 0 });

  return (
    <div>
      <div className="d-hero">
        <div><h2>📈 Reports & Analytics</h2><p>{cfg.label} · {period === 'all' ? 'every record' : `${cfg.r[0]} → ${cfg.r[1]}`}</p></div>
        <div className="d-actions d-noprint">
          {branches.length > 1 && <select value={branch} onChange={e => setBranch(e.target.value)} style={{ width: 'auto' }}><option value="all">All branches</option>{branches.map(b => <option key={b.name}>{b.name}</option>)}</select>}
          <div className="d-seg">{Object.entries(RANGES).map(([k, v]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{v.label}</button>)}</div>
          <button className="d-act" onClick={exportPL}>⬇️ Export P&L</button>
          <button className="d-act p" onClick={() => window.print()}>🖨️ Print</button>
        </div>
      </div>

      <div className="d-kpis">
        <Kpi label="Revenue" value={fmt(rev)} icon="💵" color="var(--green-ink)" delta={prevRev === null ? null : pctChange(rev, prevRev)} sub="All records" />
        <Kpi label="Expenses" value={fmt(exp)} icon="💸" color="var(--red-ink)" delta={prevExp === null ? null : pctChange(exp, prevExp)} invert sub="All records" />
        <Kpi label="Net profit" value={fmt(profit)} icon="📈" color="var(--primary)" delta={prevRev === null ? null : pctChange(profit, prevRev - prevExp)} sub="All records" />
        <Kpi label="Profit margin" value={`${Math.round(margin)}%`} icon="🎯" color="var(--amber-ink)" delta={null} sub={margin >= 25 ? 'Healthy' : margin >= 10 ? 'Watch costs' : 'Low margin'} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
        <StatCard label="Jobs in period" value={pJ.length} accent="#7c3aed" sub={`${pct(completed, jobs.length)}% all-time completion`} />
        <StatCard label="Avg job value" value={fmt(avgJob)} accent="#0891b2" />
        <StatCard label="Outstanding invoices" value={fmt(outstanding)} accent="#f59e0b" sub={`${unpaid.length} unpaid`} />
        <StatCard label="Loan repayments" value={fmt(loanPay)} accent="#dc2626" sub={`Loan balance ${fmt(borrowedBal)}`} />
        <StatCard label="Payroll paid" value={fmt(payrollPaid)} accent="#16a34a" />
        <StatCard label="Stock value" value={fmt(stockValue)} accent="var(--primary)" sub={`${inventory.filter(i => i.quantity <= i.reorder_point).length} low-stock`} />
      </div>

      <div className="d-grid g-2-1">
        <div className="d-card"><div className="d-head"><h3>Income vs expenses</h3></div><FlowChart series={series} /></div>
        <div className="d-card"><div className="d-head"><h3>Income by payment method</h3></div><BarList rows={methods.map(m => ({ label: m.label, pct: pct(m.v, rev), right: `${fmt(m.v)} · ${pct(m.v, rev)}%` }))} /></div>
      </div>

      {branch === 'all' && branches.length > 1 && (
        <div className="d-card" style={{ marginBottom: 14 }}>
          <div className="d-head"><h3>🏬 Performance by branch</h3></div>
          <Tbl heads={['Branch', 'Sales', 'Expenses', 'Profit', 'Share of sales']}>
            {brRows.map(r => <tr key={r.label}><TD style={{ fontWeight: 600 }}>{r.label}</TD><TD>{fmt(r.rev)}</TD><TD>{fmt(r.exp)}</TD><TD style={{ fontWeight: 700, color: r.rev >= r.exp ? 'var(--green-ink)' : 'var(--red-ink)' }}>{fmt(r.rev - r.exp)}</TD><TD>{pct(r.rev, brTotal)}%</TD></tr>)}
          </Tbl>
        </div>
      )}

      <div className="d-grid g-2">
        <div className="d-card"><div className="d-head"><h3>Expense breakdown</h3><span className="muted">{pE.length} entries</span></div>
          <BarList rows={cats.map(c => ({ label: `${c.label} (${c.n})`, pct: pct(c.v, exp), color: 'var(--red-ink)', right: `${fmt(c.v)} · ${pct(c.v, exp)}%` }))} />
        </div>
        <div className="d-card"><div className="d-head"><h3>Biggest expenses</h3></div>
          {biggest.length === 0 ? <p className="muted" style={{ margin: 0 }}>No expenses in this period.</p> : biggest.map(x => <div key={x.id} className="d-row"><div style={{ minWidth: 0 }}><b className="ellip" style={{ display: 'block' }}>{x.description || x.category}</b><span className="muted">{x.date} · {x.category}</span></div><b style={{ color: 'var(--red-ink)' }}>{fmt(x.amount)}</b></div>)}
        </div>
      </div>

      <div className="d-card" style={{ marginBottom: 14 }}>
        <div className="d-head"><h3>📒 Monthly profit & loss — last 12 months</h3></div>
        <Tbl heads={['Month', 'Revenue', 'Expenses', 'Profit', 'Margin', 'Jobs']}>
          {pl12.map(m => <tr key={m.label}><TD style={{ fontWeight: 600 }}>{m.label}</TD><TD>{fmt(m.inc)}</TD><TD>{fmt(m.exp)}</TD><TD style={{ fontWeight: 700, color: m.inc >= m.exp ? 'var(--green-ink)' : 'var(--red-ink)' }}>{fmt(m.inc - m.exp)}</TD><TD>{m.inc > 0 ? `${pct(m.inc - m.exp, m.inc)}%` : '—'}</TD><TD>{m.jobs}</TD></tr>)}
          <tr className="d-tot"><td className="td">Total</td><td className="td">{fmt(totP.inc)}</td><td className="td">{fmt(totP.exp)}</td><td className="td">{fmt(totP.inc - totP.exp)}</td><td className="td">{totP.inc > 0 ? `${pct(totP.inc - totP.exp, totP.inc)}%` : '—'}</td><td className="td">{totP.jobs}</td></tr>
        </Tbl>
      </div>

      <div className="d-grid g-2"><GroupTbl rows={byType} title="Profitability by Job Type" /><GroupTbl rows={byMachine} title="Output by Machine" /></div>
      <div className="d-grid g-2"><GroupTbl rows={byStaff} title="Performance by Staff" />
        <div className="d-card"><div className="d-head"><h3>🧾 Receivables aging</h3><span className="muted">{fmt(outstanding)} owed</span></div>
          <BarList rows={aging.map((a, i) => ({ label: a.l, pct: pct(a.v, outstanding), color: i >= 2 ? 'var(--red-ink)' : i === 1 ? 'var(--amber-ink)' : 'var(--green-ink)', right: fmt(a.v) }))} />
        </div>
      </div>

      <div className="d-card" style={{ marginBottom: 14 }}>
        <div className="d-head"><h3>🏆 Top customers in period</h3></div>
        {topCust.length === 0 ? <p className="muted" style={{ margin: 0 }}>No jobs in this period.</p> : (
          <Tbl heads={['#', 'Customer', 'Jobs', 'Billed', 'Paid (invoices)', 'Outstanding']}>
            {topCust.map((c, i) => <tr key={c.k}><TD>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</TD><TD style={{ fontWeight: 600 }}>{c.name}</TD><TD>{c.jobs}</TD><TD style={{ fontWeight: 700 }}>{fmt(c.billed)}</TD><TD style={{ color: 'var(--green-ink)', fontWeight: 600 }}>{fmt(invPaid[c.k] || 0)}</TD><TD style={{ color: (invOut[c.k] || 0) > 0 ? 'var(--red-ink)' : 'var(--muted)', fontWeight: 600 }}>{fmt(invOut[c.k] || 0)}</TD></tr>)}
          </Tbl>
        )}
      </div>

      <div className="d-card">
        <div className="d-head"><h3>Job status summary</h3><span className="muted">all jobs</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
          {JOB_STATUSES.map(s => { const sc = STATUS_COLORS[s] || {}; return <div key={s} style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: sc.color }}>{jobs.filter(j => j.status === s).length}</div><div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: sc.color, marginTop: 2 }}>{s}</div></div>; })}
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
          <div style={{ background: 'var(--primary)', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>{jobsWithPhone.length} jobs with WhatsApp</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {sections.map(s => <button key={s.id} onClick={() => setActiveSection(s.id)} style={{ padding: '7px 16px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: activeSection === s.id ? '#25D366' : '#fff', color: activeSection === s.id ? '#fff' : 'var(--muted)', borderColor: activeSection === s.id ? '#25D366' : 'var(--line)' }}>{s.label}</button>)}
      </div>

      {activeSection === 'broadcast' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>📣 Broadcast Message</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>Send to all customers or select specific ones. Use <code style={{ background: 'var(--surface-2)', padding: '1px 4px', borderRadius: 3 }}>{'{name}'}</code> to personalise.</p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>Message *</label>
              <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={6} placeholder="Type your message... Use {name} for customer name" style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>🎉 Festive & Quick Templates</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {FESTIVE_TEMPLATES.map(t => <button key={t.label} onClick={() => setBroadcastMsg(t.msg)} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', textAlign: 'left' }}>{t.label}</button>)}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Recipients ({selectedCusts.length > 0 ? selectedCusts.length : custsWithPhone.length} selected)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSelectedCusts(custsWithPhone.map(c=>c.id))} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700 }}>All</button>
                  <button onClick={() => setSelectedCusts([])} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontWeight: 700 }}>Clear</button>
                </div>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 6 }}>
                {custsWithPhone.map(c => (
                  <div key={c.id} onClick={() => toggleCust(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer', background: selectedCusts.includes(c.id) ? '#f0fdf4' : '#fff' }}>
                    <input type="checkbox" checked={selectedCusts.includes(c.id)} onChange={() => {}} style={{ accentColor: '#25D366' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.whatsapp || c.phone}</span>
                  </div>
                ))}
                {custsWithPhone.length === 0 && <p style={{ textAlign: 'center', padding: 16, color: 'var(--faint)', fontSize: 13 }}>No customers with phone numbers</p>}
              </div>
            </div>
            {sending && <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--green-ink)', fontWeight: 700 }}>📲 Sending… {sentCount} / {selectedCusts.length || custsWithPhone.length}</div>}
            <button onClick={sendBroadcast} disabled={sending || !broadcastMsg.trim()} style={{ width: '100%', background: sending ? 'var(--faint)' : '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '12px', cursor: sending ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700 }}>
              📲 Send to {selectedCusts.length > 0 ? selectedCusts.length : custsWithPhone.length} Customer{(selectedCusts.length || custsWithPhone.length) !== 1 ? 's' : ''}
            </button>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Message Preview</h3>
            <div style={{ background: '#dcf8c6', color: '#111', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 120 }}>
              {broadcastMsg
                ? broadcastMsg.replace(/{name}/gi, custsWithPhone[0]?.name || 'Customer Name')
                : <span style={{ color: 'var(--faint)' }}>Type a message to preview it here…</span>}
            </div>
            {broadcastMsg && <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>Preview shows first customer's name. Each recipient gets their own name.</p>}
            {broadcastMsg && <button onClick={() => navigator.clipboard.writeText(broadcastMsg)} style={{ marginTop: 8, width: '100%', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📋 Copy Message</button>}
          </div>
        </div>
      )}

      {activeSection === 'notifications' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Select Template & Jobs</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>Message Template</label>
              <select value={notifTemplate} onChange={e => { setNotifTemplate(e.target.value); setPreviewMsg(''); }} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13, width: '100%' }}>
                {JOB_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)} notification</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Select Jobs</label>
                <button onClick={() => setSelectedJobs(jobsWithPhone.map(j=>j.id))} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700 }}>Select All</button>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 6 }}>
                {jobsWithPhone.map(j => (
                  <div key={j.id} onClick={() => { toggleJob(j.id); handlePreview(j.id); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer', background: selectedJobs.includes(j.id) ? '#f0fdf4' : '#fff' }}>
                    <input type="checkbox" checked={selectedJobs.includes(j.id)} onChange={() => {}} style={{ accentColor: '#25D366' }} />
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{j.job_no} — {j.customer}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{j.whatsapp} · {j.status}</div></div>
                    <Badge text={j.status} />
                  </div>
                ))}
                {jobsWithPhone.length === 0 && <p style={{ textAlign: 'center', padding: 20, color: 'var(--faint)', fontSize: 13 }}>No jobs with WhatsApp numbers yet. Add WhatsApp number when creating a job.</p>}
              </div>
            </div>
            <button onClick={sendBulk} style={{ width: '100%', background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '11px', cursor: 'pointer', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
              📲 Send to {selectedJobs.length} Customer{selectedJobs.length !== 1 ? 's' : ''}
            </button>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Message Preview</h3>
            {previewMsg ? <div style={{ background: '#dcf8c6', color: '#111', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{previewMsg}</div> : <div style={{ background: 'var(--bg)', border: '2px dashed var(--line)', borderRadius: 8, padding: 30, textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>Click a job to preview the message</div>}
            {previewMsg && <button onClick={() => navigator.clipboard.writeText(previewMsg)} style={{ marginTop: 10, width: '100%', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📋 Copy</button>}
          </div>
        </div>
      )}

      {activeSection === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Send Business Summary</h3>
            <Inp label="Send to (WhatsApp number)" value={summaryPhone} onChange={e => setSummaryPhone(e.target.value)} placeholder="+233..." />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              <button onClick={() => openWhatsApp(summaryPhone, generateDailySummaryMsg(sales, expenses, jobs, invoices))} style={{ background: '#25D366', border: 'none', color: '#fff', borderRadius: 8, padding: '14px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>📊 Send Daily Summary</button>
              <button onClick={() => openWhatsApp(summaryPhone, generateWeeklySummaryMsg(sales, expenses, jobs))} style={{ background: '#1a9e50', border: 'none', color: '#fff', borderRadius: 8, padding: '14px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>📅 Send Weekly Summary</button>
            </div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Daily Summary Preview</h3>
            <div style={{ background: '#dcf8c6', color: '#111', borderRadius: 10, padding: 16, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto' }}>{generateDailySummaryMsg(sales, expenses, jobs, invoices)}</div>
          </div>
        </div>
      )}

      {activeSection === 'custom' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Send to Single Number</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Inp label="Phone Number" placeholder="+233..." value={customPhone} onChange={e => setCustomPhone(e.target.value)} />
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>Message</label>
                <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={8} placeholder="Type your message here..." style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '10px', fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => navigator.clipboard.writeText(customMsg)} style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '9px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>📋 Copy</button>
                <button onClick={() => { if (customPhone && customMsg) openWhatsApp(customPhone, customMsg); else alert('Enter a phone number and message.'); }} style={{ flex: 2, background: '#25D366', border: 'none', color: '#fff', borderRadius: 6, padding: '9px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>📲 Open in WhatsApp</button>
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Preview</h3>
            <div style={{ background: '#dcf8c6', color: '#111', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 100 }}>{customMsg || <span style={{ color: 'var(--faint)' }}>Your message will appear here…</span>}</div>
          </div>
        </div>
      )}

      {activeSection === 'missing' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700 }}>⚠️ Jobs Missing WhatsApp Numbers</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>{jobsWithoutPhone.length} active job(s) don't have a WhatsApp number. Edit the job and add the customer's WhatsApp to enable notifications.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Job #','Customer','Status','Due Date','Price'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {jobsWithoutPhone.map(j => (
                <tr key={j.id}>
                  <TD style={{ fontWeight: 700, color: 'var(--primary)' }}>{j.job_no}</TD>
                  <TD>{j.customer}</TD>
                  <TD><Badge text={j.status} /></TD>
                  <TD style={{ color: j.due_date < todayStr() ? '#dc2626' : 'var(--ink-2)' }}>{j.due_date || '—'}</TD>
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
