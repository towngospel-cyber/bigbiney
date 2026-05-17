/* eslint-disable */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uqprhvcolkohgbnnfrgq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WI4VCEqJbyu_B94BhvXfcw_S9G8Yzyt';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const db = {
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

  async getCustomers(userId) { const { data, error } = await supabase.from('customers').select('*').eq('user_id', userId).order('name'); return { data: data || [], error }; },
  async addCustomer(userId, customer) { const { data, error } = await supabase.from('customers').insert([{ ...customer, user_id: userId }]).select(); return { data: data?.[0], error }; },
  async updateCustomer(id, updates) { const { data, error } = await supabase.from('customers').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
async deleteCustomer(id) {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);
  if (error) console.error('DELETE ERROR:', JSON.stringify(error));
  else console.log('DELETE SUCCESS for id:', id);
  return { error };
},

  async getJobs(userId) { const { data, error } = await supabase.from('jobs').select('*').eq('user_id', userId).order('job_no', { ascending: false }); return { data: data || [], error }; },
  async addJob(userId, job) {
  const { data, error } = await supabase
    .from('jobs')
    .insert([{ ...job, user_id: userId }])
    .select();
  return { data: data?.[0], error };
},
  async updateJob(id, updates) { const { data, error } = await supabase.from('jobs').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
  async deleteJob(id) { const { error } = await supabase.from('jobs').delete().eq('id', id); return { error }; },

  async getInventory(userId) { const { data, error } = await supabase.from('inventory').select('*').eq('user_id', userId).order('name'); return { data: data || [], error }; },
  async addInventoryItem(userId, item) { const { data, error } = await supabase.from('inventory').insert([{ ...item, user_id: userId }]).select(); return { data: data?.[0], error }; },
  async updateInventoryItem(id, updates) { const { data, error } = await supabase.from('inventory').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
  async deleteInventoryItem(id) { const { error } = await supabase.from('inventory').delete().eq('id', id); return { error }; },

  async getInvoices(userId) { const { data, error } = await supabase.from('invoices').select('*').eq('user_id', userId).order('date', { ascending: false }); return { data: data || [], error }; },
  async addInvoice(userId, invoice) { const { data, error } = await supabase.from('invoices').insert([{ ...invoice, user_id: userId }]).select(); return { data: data?.[0], error }; },
  async updateInvoice(id, updates) { const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
  async deleteInvoice(id) { const { error } = await supabase.from('invoices').delete().eq('id', id); return { error }; },

  async getSales(userId) { const { data, error } = await supabase.from('sales').select('*').eq('user_id', userId).order('date', { ascending: false }); return { data: data || [], error }; },
  async addSale(userId, sale) { const { data, error } = await supabase.from('sales').insert([{ ...sale, user_id: userId }]).select(); return { data: data?.[0], error }; },
  async deleteSale(id) { const { error } = await supabase.from('sales').delete().eq('id', id); return { error }; },

  async getExpenses(userId) { const { data, error } = await supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }); return { data: data || [], error }; },
  async addExpense(userId, expense) { const { data, error } = await supabase.from('expenses').insert([{ ...expense, user_id: userId }]).select(); return { data: data?.[0], error }; },
  async deleteExpense(id) { const { error } = await supabase.from('expenses').delete().eq('id', id); return { error }; },

  // ─── PAYROLL ────────────────────────────────────────────────────────────────
async getPayroll(userId) { const { data, error } = await supabase.from('payroll').select('*').eq('user_id', userId).order('date', { ascending: false }); return { data: data || [], error }; },
async addPayroll(userId, item) { const { data, error } = await supabase.from('payroll').insert([{ ...item, user_id: userId }]).select(); return { data: data?.[0], error }; },
async deletePayroll(id) { const { error } = await supabase.from('payroll').delete().eq('id', id); return { error }; },

// ─── LOANS (Supabase) ────────────────────────────────────────────────────────
async getLoans(userId) { const { data, error } = await supabase.from('loans').select('*').eq('user_id', userId).order('created_at', { ascending: false }); return { data: data || [], error }; },
async addLoan(userId, loan) { const { data, error } = await supabase.from('loans').insert([{ ...loan, user_id: userId }]).select(); return { data: data?.[0], error }; },
async updateLoan(id, updates) { const { data, error } = await supabase.from('loans').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
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

export default db;
