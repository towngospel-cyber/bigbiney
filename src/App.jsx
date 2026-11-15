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
@media (max-width:860px){
  .side{display:none}.top{padding:8px 14px}.page-title{font-size:17px}.hide-sm{display:none}.main{padding:14px 12px 96px}
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
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } });
  const [moreOpen, setMoreOpen] = useState(false);
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
    setInvoices((inv2.data||[]).map(i => ({ ...i, items: i.items ? (typeof i.items === 'string' ? JSON.parse(i.items) : i.items) : null }))); setSales(s.data); setExpenses(e.data);
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
  const MAIN_TABS = ['dashboard', 'jobs', 'customers', 'finance'];
  const parts = (t) => { const i = t.label.indexOf(' '); return [t.label.slice(0, i), t.label.slice(i + 1)]; };
  const go = (id) => { setActiveTab(id); setMoreOpen(false); setShowNotif(false); window.scrollTo({ top: 0 }); };
  const [curIcon, curName] = parts(TABS.find(t => t.id === activeTab));
  const themeNext = { auto: 'light', light: 'dark', dark: 'auto' }[theme];
  const themeIcon = { auto: '🌓', light: '☀️', dark: '🌙' }[theme];
  const badgeFor = (id) => (id === 'inventory' ? lowStock.length : id === 'jobs' ? overdueJobs.length : 0);

  return (
    <div className="app">
      <style>{GLOBAL_CSS}</style>
      <aside className="side">
        <div className="brand">🖨️ <span>Bigbiney<br /><small>Printing Press</small></span></div>
        {TABS.map(t => { const [ic, nm] = parts(t); return (
          <button key={t.id} className={`nav${activeTab === t.id ? ' on' : ''}`} onClick={() => go(t.id)} aria-current={activeTab === t.id ? 'page' : undefined}>
            <span className="ico">{ic}</span><span>{nm}</span>{badgeFor(t.id) > 0 && <b className="pill">{badgeFor(t.id)}</b>}
          </button>
        ); })}
        <div className="grow" />
        <span className="who">👤 {currentUser.email}</span>
      </aside>

      <div className="content">
        <header className="top">
          <h1 className="page-title"><span>{curIcon}</span> {curName}</h1>
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

        <main className="main">
        {activeTab === 'dashboard' && <DashboardTab jobs={jobs} sales={sales} expenses={expenses} customers={customers} inventory={inventory} invoices={invoices} setActiveTab={setActiveTab} overdueJobs={overdueJobs} monthlyGoal={monthlyGoal} setMonthlyGoal={saveGoal} />}
        {activeTab === 'jobs'      && <JobsTab jobs={jobs} setJobs={setJobs} customers={customers} addNotif={addNotif} userId={currentUser.id} inventory={inventory} setInventory={setInventory} jobMaterials={jobMaterials} setJobMaterials={setJobMaterials} />}
        {activeTab === 'customers' && <CustomersTab customers={customers} setCustomers={setCustomers} jobs={jobs} invoices={invoices} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'inventory' && <InventoryTab inventory={inventory} setInventory={setInventory} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'invoices'  && <InvoicesTab invoices={invoices} setInvoices={setInvoices} jobs={jobs} customers={customers} setSales={setSales} addNotif={addNotif} userId={currentUser.id} />}
        {activeTab === 'finance'   && <FinanceTab sales={sales} setSales={setSales} expenses={expenses} setExpenses={setExpenses} addNotif={addNotif} userId={currentUser.id} recurringExpenses={recurringExpenses} setRecurringExpenses={setRecurringExpenses} />}
        {activeTab === 'payroll'   && <PayrollTab payroll={payroll} setPayroll={setPayroll} addNotif={addNotif} userId={currentUser.id} expenses={expenses} setExpenses={setExpenses} />}
        {activeTab === 'loans'     && <LoansTab loans={loans} setLoans={setLoans} addNotif={addNotif} userId={currentUser.id} sales={sales} expenses={expenses} setExpenses={setExpenses} />}
        {activeTab === 'reports'   && <ReportsTab jobs={jobs} sales={sales} expenses={expenses} customers={customers} inventory={inventory} invoices={invoices} />}
        {activeTab === 'whatsapp'  && <WhatsAppTab jobs={jobs} customers={customers} sales={sales} expenses={expenses} invoices={invoices} addNotif={addNotif} />}
        </main>
      </div>

      <nav className="bottom" aria-label="Main">
        {MAIN_TABS.map(id => { const t = TABS.find(x => x.id === id); const [ic, nm] = parts(t); return (
          <button key={id} className={activeTab === id ? 'on' : ''} onClick={() => go(id)}><span className="ico">{ic}</span><span>{nm}</span></button>
        ); })}
        <button className={!MAIN_TABS.includes(activeTab) ? 'on' : ''} onClick={() => setMoreOpen(true)}>
          <span className="ico">☰</span><span>More</span>{(lowStock.length + overdueJobs.length) > 0 && <i className="dot sm-dot" />}
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-back" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="More">
            <div className="sheet-grid">
              {TABS.filter(t => !MAIN_TABS.includes(t.id)).map(t => { const [ic, nm] = parts(t); return (
                <button key={t.id} className={`tile${activeTab === t.id ? ' on' : ''}`} onClick={() => go(t.id)}>
                  <span className="ico">{ic}</span>{nm}{badgeFor(t.id) > 0 && <b className="pill">{badgeFor(t.id)}</b>}
                </button>
              ); })}
            </div>
            <div className="sheet-f"><span className="muted">👤 {currentUser.email}</span><Btn variant="ghost" small onClick={handleLogout}>Logout</Btn></div>
          </div>
        </div>
      )}
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
        <StatCard label="Monthly Profit"   value={fmt(mSales - mExp)} accent={mSales >= mExp ? 'var(--primary)' : '#dc2626'} />
        <StatCard label="All-Time Revenue" value={fmt(sales.reduce((a,s)=>a+s.amount,0))} accent="#7c3aed" />
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

      {showSF && (
        <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--green-ink)' }}>Record Sale</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Inp label="Date" type="date" value={sf.date} onChange={e => setSf({ ...sf, date: e.target.value })} />
            <Inp label="Amount (GH₵)" type="number" value={sf.amount} onChange={e => setSf({ ...sf, amount: e.target.value })} />
            <Sel label="Payment Method" value={sf.payment_method} onChange={e => setSf({ ...sf, payment_method: e.target.value })}>
              {['Cash','Mobile Money','Bank Transfer','Credit','Partial Payment','Other'].map(m => <option key={m}>{m}</option>)}
            </Sel>
            <Btn variant="success" onClick={addSale}>Record</Btn>
            <Btn variant="ghost" onClick={() => setShowSF(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {showEF && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-line)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: 'var(--green-bg)', borderBottom: '1px solid var(--green-line)' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--green-ink)' }}>💚 Income ({sales.length})</h3>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {[...sales].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f9fafb', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{s.date}</span>
                {s.payment_method && <span style={{ fontSize: 10, background: 'var(--surface-2)', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>{s.payment_method}</span>}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{fmt(s.amount)}</span>
                <button onClick={() => delSale(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: 'var(--red-bg)', borderBottom: '1px solid var(--red-line)' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>❤️ Expenses ({expenses.length})</h3>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {[...expenses].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(e => (
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
        <div style={{ background: 'var(--sky-bg)', border: '1px solid #bae6fd', borderRadius: 8, padding: 14, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Inp label="New Staff Name" value={newStaff} onChange={e => setNewStaff(e.target.value)} placeholder="e.g. Kojo" />
          <Btn onClick={addStaffMember}>Add</Btn>
          <Btn variant="ghost" onClick={() => { setAddingStaff(false); setNewStaff(''); }}>Cancel</Btn>
        </div>
      )}
      <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-line)', borderRadius: 6, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--green-ink)' }}>
        💡 Salary payments are <strong>automatically recorded as expenses</strong> and deducted from monthly income.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Paid (All Time)" value={fmt(totalPaid)} accent="var(--primary)" />
        <StatCard label="Paid This Month"       value={fmt(monthPaid)} accent="#16a34a" />
        <StatCard label="Staff Members"         value={staffList.length} accent="#7c3aed" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
        {byStaff.map(s => (
          <div key={s.name} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 16, position: 'relative' }}>
            <button onClick={() => removeStaff(s.name)} title="Remove from staff list" style={{ position: 'absolute', top: 8, right: 8, background: 'var(--red-bg)', border: 'none', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', color: '#dc2626', fontWeight: 800, fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>👤 {s.name}</div>
            <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>All time: {fmt(s.total)}</div>
            <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>This month: {fmt(s.paidThisMonth)}</div>
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>Last paid: {s.lastPaid || 'Never'}</div>
            <Btn small variant="primary" style={{ marginTop: 8 }} onClick={() => { setForm(f => ({ ...f, staff_name: s.name })); setModal(true); }}>+ Pay Now</Btn>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Staff','Amount','Period','Date','Method','Notes','Action'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {[...payroll].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(p => (
              <tr key={p.id}>
                <TD style={{ fontWeight: 600 }}>👤 {p.staff_name}</TD>
                <TD style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(p.amount)}</TD>
                <TD style={{ color: 'var(--muted)' }}>{p.period || '—'}</TD>
                <TD>{p.date}</TD>
                <TD><span style={{ background: 'var(--surface-2)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{p.payment_method}</span></TD>
                <TD style={{ color: 'var(--muted)', fontSize: 12 }}>{p.notes}</TD>
                <TD><Btn variant="danger" small onClick={() => del(p.id)}>Del</Btn></TD>
              </tr>
            ))}
            {payroll.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--faint)' }}>No payroll records yet</td></tr>}
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
            <button key={val} onClick={() => setPeriod(val)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: period === val ? 'var(--primary)' : '#fff', color: period === val ? '#fff' : 'var(--muted)', borderColor: period === val ? 'var(--primary)' : 'var(--line)' }}>{lbl}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Revenue"         value={fmt(pSales)}     accent="#16a34a" />
        <StatCard label="Expenses"        value={fmt(pExpenses)}  accent="#dc2626" />
        <StatCard label="Net Profit"      value={fmt(pProfit)}    accent={pProfit >= 0 ? 'var(--primary)' : '#dc2626'} />
        <StatCard label="Jobs Created"    value={pJobs.length}    accent="#7c3aed" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} accent="#f59e0b" />
        <StatCard label="Avg Job Value"   value={fmt(avgJobValue)} accent="#0891b2" />
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Revenue vs Expenses — Last 6 Months</h3>
        <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>■ Revenue</span>
          <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>■ Expenses</span>
          <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>■ Profit</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140 }}>
          {trend.map((t, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 110 }}>
                <div style={{ flex: 1, background: '#16a34a', borderRadius: '2px 2px 0 0', height: `${Math.max(2,Math.round((t.rev/maxTrend)*110))}px` }} title={`Revenue: ${fmt(t.rev)}`} />
                <div style={{ flex: 1, background: '#dc2626', borderRadius: '2px 2px 0 0', height: `${Math.max(2,Math.round((t.exp/maxTrend)*110))}px` }} title={`Expenses: ${fmt(t.exp)}`} />
                <div style={{ flex: 1, background: t.profit >= 0 ? 'var(--primary)' : '#f59e0b', borderRadius: '2px 2px 0 0', height: `${Math.max(2,Math.round((Math.abs(t.profit)/maxTrend)*110))}px` }} title={`Profit: ${fmt(t.profit)}`} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{t.month}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Revenue by Job Type</h3>
          {byType.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 13 }}>No data yet</p>}
          {byType.map(({ type, count, revenue }) => {
            const total = byType.reduce((a,x)=>a+x.revenue,0);
            const pct   = total > 0 ? Math.round((revenue/total)*100) : 0;
            return (
              <div key={type} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>{type} <span style={{ color: 'var(--faint)' }}>({count})</span></span>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(revenue)} — {pct}%</span>
                </div>
                <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 8 }}><div style={{ width: `${pct}%`, background: 'var(--primary)', height: 8, borderRadius: 4 }} /></div>
              </div>
            );
          })}
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Expense Breakdown</h3>
          {expByCategory.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 13 }}>No expenses in this period</p>}
          {expByCategory.map(({ cat, total }) => {
            const grandTotal = expByCategory.reduce((a,x)=>a+x.total,0);
            const pct = grandTotal > 0 ? Math.round((total/grandTotal)*100) : 0;
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>{cat}</span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(total)} — {pct}%</span>
                </div>
                <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 8 }}><div style={{ width: `${pct}%`, background: '#dc2626', height: 8, borderRadius: 4 }} /></div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>🏆 Top Customers</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Rank','Customer','Jobs','Revenue'].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
          <tbody>
            {topCustomers.map((c, i) => (
              <tr key={c.name}>
                <TD style={{ fontWeight: 800, color: i===0?'#f59e0b':i===1?'var(--faint)':i===2?'#b45309':'var(--ink-2)' }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</TD>
                <TD style={{ fontWeight: 600 }}>{c.name}</TD>
                <TD>{c.jobs}</TD>
                <TD style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(c.revenue)}</TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 20 }}>
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
