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
  async signout() { return await supabase.auth.signOut(); },
  async getCurrentUser() { const { data: { user } } = await supabase.auth.getUser(); return user; },

  async getCustomers(userId) { const { data, error } = await supabase.from('customers').select('*').eq('user_id', userId).order('name'); return { data: data || [], error }; },
  async addCustomer(userId, customer) { const { data, error } = await supabase.from('customers').insert([{ ...customer, user_id: userId }]).select(); return { data: data?.[0], error }; },
  async updateCustomer(id, updates) { const { data, error } = await supabase.from('customers').update(updates).eq('id', id).select(); return { data: data?.[0], error }; },
  async deleteCustomer(id) { const { error } = await supabase.from('customers').delete().eq('id', id); return { error }; },

  async getJobs(userId) { const { data, error } = await supabase.from('jobs').select('*').eq('user_id', userId).order('job_no', { ascending: false }); return { data: data || [], error }; },
  async addJob(userId, job) { const { data, error } = await supabase.from('jobs').insert([{ ...job, user_id: userId }]).select(); return { data: data?.[0], error }; },
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

  subscribeToTable(table, userId, onInsert, onUpdate, onDelete) {
    const channel = supabase.channel(`${table}-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `user_id=eq.${userId}` }, p => onInsert(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `user_id=eq.${userId}` }, p => onUpdate(p.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table, filter: `user_id=eq.${userId}` }, p => onDelete(p.old))
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

export default db;
