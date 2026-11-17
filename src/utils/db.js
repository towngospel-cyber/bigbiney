/* eslint-disable */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uqprhvcolkohgbnnfrgq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WI4VCEqJbyu_B94BhvXfcw_S9G8Yzyt';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Columns added for branches / detailed sales (see branches_setup.sql).
// If the database doesn't have them yet, the insert is retried without them so nothing is lost.
let ctxBranch = null;
let actor = { email: '', id: '' };
let lookup = () => '';
const EXTRA_COLS = {
  debts:     ['branch'],
  jobs:      ['branch'],
  inventory: ['branch'],
  invoices:  ['branch'],
  loans:     ['branch'],
  sales:    ['branch', 'customer', 'description', 'items', 'discount', 'total', 'balance', 'reference', 'received_by', 'notes', 'receipt_no', 'written_off', 'writeoff_date', 'writeoff_reason'],
  expenses: ['branch'],
  payroll:  ['basic', 'allowance', 'deductions', 'reference', 'branch'],
};
async function insertWithFallback(table, row) {
  if (ctxBranch && !row.branch && EXTRA_COLS[table]?.includes('branch')) row = { ...row, branch: ctxBranch };
  const first = await supabase.from(table).insert([row]).select();
  if (first.error && /column|schema cache/i.test(first.error.message || '')) {
    const base = { ...row };
    EXTRA_COLS[table].forEach(k => delete base[k]);
    const retry = await supabase.from(table).insert([base]).select();
    return { data: retry.data?.[0], error: retry.error, degraded: !retry.error };
  }
  return { data: first.data?.[0], error: first.error };
}

const db = {
  setBranchContext(name) { ctxBranch = name; },
  setActor(email, id) { actor = { email, id }; },
  setLookup(fn) { lookup = fn; },
  async updateSale(id, updates) { const { data, error } = await supabase.from('sales').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
  async getDebts(userId) { const { data, error } = await supabase.from('debts').select('*').eq('user_id', userId).order('date', { ascending: false }); return { data: data || [], error }; },
  async addDebt(userId, debt) { return insertWithFallback('debts', { ...debt, user_id: userId }); },
  async updateDebt(id, updates) { const { data, error } = await supabase.from('debts').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
  async deleteDebt(id) { const { error } = await supabase.from('debts').delete().eq('id', id); return { error }; },
  async getActivity(userId, limit = 300) { const { data, error } = await supabase.from('activity_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit); return { data: data || [], error }; },
  async signup(email, password, name, role = 'user') {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return { error: authError.message };
    const { data, error } = await supabase.from('users').insert([{ id: authData.user.id, email, name, role, created_at: new Date().toISOString() }]);
    return { data, error: error?.message };
  },
  async signin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error: error?.message };
  },
async getSetting(userId, key) {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();
  return { data, error };
},
async setSetting(userId, key, value) {
  const { data, error } = await supabase
    .from('settings')
    .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' })
    .select();
  return { data: data?.[0], error };
},
  async signout() { return await supabase.auth.signOut(); },
  async getCurrentUser() { const { data: { user } } = await supabase.auth.getUser(); return user; },

async getCustomers(userId) {
  let all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .order('name')
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    all = [...all, ...data];
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
},
  async addCustomer(userId, customer) { const { data, error } = await supabase.from('customers').insert([{ ...customer, user_id: userId }]).select(); return { data: data?.[0], error }; },
  async updateCustomer(id, updates) { const { data, error } = await supabase.from('customers').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },

  async deleteCustomer(id) {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) console.error('DELETE CUSTOMER ERROR:', error.code, error.message);
  return { error };
},

  async getJobs(userId) { const { data, error } = await supabase.from('jobs').select('*').eq('user_id', userId).order('job_no', { ascending: false }); return { data: data || [], error }; },
async addJob(userId, job) {
  const payload = {
    user_id: userId, job_no: job.job_no || '', customer: job.customer || '', customer_id: job.customer_id || null,
    description: job.description || '', type: job.type || 'Digital', status: job.status || 'queued', priority: job.priority || 'normal',
    due_date: job.due_date || null, start_date: job.start_date || null, price: job.price || 0, cost: job.cost || 0,
    machine: job.machine || '', notes: job.notes || '', qr_code: job.qr_code || '', delivery_status: job.delivery_status || 'pending',
    assigned_to: job.assigned_to || '', payment_method: job.payment_method || 'Cash', whatsapp: job.whatsapp || '',
    branch: job.branch || null,
  };
  const r = await insertWithFallback('jobs', payload);
  if (r.error) console.error('ADD JOB ERROR:', r.error.message);
  return r;
},
  async updateJob(id, updates) {
  const allowed = ['customer','customer_id','description','type','status','priority',
    'due_date','start_date','price','cost','machine','notes','qr_code',
    'delivery_status','assigned_to','payment_method','whatsapp','job_no','branch'];
  const clean = {};
  allowed.forEach(k => { if (updates[k] !== undefined) clean[k] = updates[k]; });
  const { data, error } = await supabase
    .from('jobs')
    .update(clean)
    .eq('id', id)
    .select();
  if (error) console.error('UPDATE JOB ERROR:', error.message);
  return { data: data?.[0], error };
},
  async deleteJob(id) { const { error } = await supabase.from('jobs').delete().eq('id', id); return { error }; },

  async getInventory(userId) { const { data, error } = await supabase.from('inventory').select('*').eq('user_id', userId).order('name'); return { data: data || [], error }; },
  async addInventoryItem(userId, item) { return insertWithFallback('inventory', { ...item, user_id: userId }); },
  async updateInventoryItem(id, updates) { const { data, error } = await supabase.from('inventory').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
  async deleteInventoryItem(id) { const { error } = await supabase.from('inventory').delete().eq('id', id); return { error }; },

  async getInvoices(userId) { const { data, error } = await supabase.from('invoices').select('*').eq('user_id', userId).order('date', { ascending: false }); return { data: data || [], error }; },
  async addInvoice(userId, invoice) { return insertWithFallback('invoices', { ...invoice, user_id: userId }); },
  async updateInvoice(id, updates) { const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
  async deleteInvoice(id) { const { error } = await supabase.from('invoices').delete().eq('id', id); return { error }; },

  async getSales(userId) { const { data, error } = await supabase.from('sales').select('*').eq('user_id', userId).order('date', { ascending: false }); return { data: data || [], error }; },
  async addSale(userId, sale) { return insertWithFallback('sales', { ...sale, user_id: userId }); },
  async deleteSale(id) { const { error } = await supabase.from('sales').delete().eq('id', id); return { error }; },

  async getExpenses(userId) { const { data, error } = await supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }); return { data: data || [], error }; },
  async addExpense(userId, expense) { return insertWithFallback('expenses', { ...expense, user_id: userId }); },
  async deleteExpense(id) { const { error } = await supabase.from('expenses').delete().eq('id', id); return { error }; },

  // ─── PAYROLL ────────────────────────────────────────────────────────────────
async getPayroll(userId) { const { data, error } = await supabase.from('payroll').select('*').eq('user_id', userId).order('date', { ascending: false }); return { data: data || [], error }; },
async addPayroll(userId, item) { return insertWithFallback('payroll', { ...item, user_id: userId }); },
async deletePayroll(id) { const { error } = await supabase.from('payroll').delete().eq('id', id); return { error }; },

// ─── LOANS (Supabase) ────────────────────────────────────────────────────────
async getLoans(userId) { const { data, error } = await supabase.from('loans').select('*').eq('user_id', userId).order('created_at', { ascending: false }); return { data: data || [], error }; },
async addLoan(userId, loan) { return insertWithFallback('loans', { ...loan, user_id: userId }); },
async updateLoan(id, updates) {
  const { data, error } = await supabase
    .from('loans')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) console.error('UPDATE LOAN ERROR:', error.message);
  return { data: data?.[0], error };
},
  
async deleteLoan(id) { const { error } = await supabase.from('loans').delete().eq('id', id); return { error }; },

// ─── RECURRING EXPENSES ──────────────────────────────────────────────────────
async getRecurringExpenses(userId) { const { data, error } = await supabase.from('recurring_expenses').select('*').eq('user_id', userId); return { data: data || [], error }; },
async addRecurringExpense(userId, item) { const { data, error } = await supabase.from('recurring_expenses').insert([{ ...item, user_id: userId }]).select(); return { data: data?.[0], error }; },
async updateRecurringExpense(id, updates) { const { data, error } = await supabase.from('recurring_expenses').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
async deleteRecurringExpense(id) { const { error } = await supabase.from('recurring_expenses').delete().eq('id', id); return { error }; },

// ─── JOB MATERIALS ───────────────────────────────────────────────────────────
async getJobMaterials(userId) { const { data, error } = await supabase.from('job_materials').select('*').eq('user_id', userId); return { data: data || [], error }; },
async addJobMaterial(userId, item) { const { data, error } = await supabase.from('job_materials').insert([{ ...item, user_id: userId }]).select(); return { data: data?.[0], error }; },
async deleteJobMaterial(id) { const { error } = await supabase.from('job_materials').delete().eq('id', id); return { error }; },
  
  subscribeToTable(table, userId, onInsert, onUpdate, onDelete) {
    const channel = supabase.channel(`${table}-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `user_id=eq.${userId}` }, p => {
        if (p.new && p.new.id) onInsert(p.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `user_id=eq.${userId}` }, p => {
        if (p.new && p.new.id) onUpdate(p.new);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table, filter: `user_id=eq.${userId}` }, p => {
        if (p.old && p.old.id) onDelete(p.old);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};


// ─── Activity log: wraps every add/update/delete so all changes are recorded ───
const LOGGED = {
  Customer: ['customers', 'customer'], Job: ['jobs', 'job'], InventoryItem: ['inventory', 'stock item'], Invoice: ['invoices', 'invoice'],
  Sale: ['sales', 'sale'], Expense: ['expenses', 'expense'], Payroll: ['payroll', 'payroll'], Loan: ['loans', 'loan'],
  Debt: ['debts', 'debt'], RecurringExpense: ['recurring_expenses', 'recurring expense'], JobMaterial: ['job_materials', 'job material'],
};
async function logActivity(action, table, entity, args, res) {
  try {
    if (!actor.id) return;
    let details = '';
    if (action === 'add') {
      const r = args[1] || {};
      details = [r.job_no, r.name, r.customer, r.staff_name, r.description, r.amount != null ? `GH₵${r.amount}` : r.price != null ? `GH₵${r.price}` : ''].filter(Boolean).slice(0, 4).join(' · ');
    } else if (action === 'update') {
      const u = args[1] || {};
      details = `${lookup(table, args[0]) || '#' + String(args[0]).slice(0, 8)} → ` + Object.entries(u).filter(([, v]) => v === null || typeof v !== 'object').slice(0, 4).map(([k, v]) => `${k}=${String(v).slice(0, 24)}`).join(', ');
    } else details = lookup(table, args[0]) || `#${String(args[0]).slice(0, 8)}`;
    await supabase.from('activity_log').insert([{ user_id: actor.id, actor: actor.email, action, entity, details: details.slice(0, 300), branch: ctxBranch }]);
  } catch (e) { /* logging must never break the app */ }
}
Object.keys(db).forEach((k) => {
  const m = k.match(/^(add|update|delete)(.+)$/);
  if (!m || !LOGGED[m[2]]) return;
  const [table, entity] = LOGGED[m[2]], orig = db[k].bind(db);
  db[k] = async (...args) => {
    // for deletes, capture the description BEFORE the row disappears
    const pre = m[1] === 'delete' ? lookup(table, args[0]) : null;
    const res = await orig(...args);
    if (!res || !res.error) { if (pre) { const keep = lookup; lookup = () => pre; await logActivity(m[1], table, entity, args, res); lookup = keep; } else await logActivity(m[1], table, entity, args, res); }
    return res;
  };
});

export default db;
