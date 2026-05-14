// ─── SUPABASE INTEGRATION FOR PRINT SHOP MANAGER ───────────────────────────
// This module handles all database operations and syncing with Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Supabase client
// Get these values from your Supabase project settings
export const SUPABASE_URL = 'https://uqprhvcolkohgbnnfrgq.supabase.co/rest/v1/';
export const SUPABASE_ANON_KEY = 'sb_publishable_WI4VCEqJbyu_B94BhvXfcw_S9G8Yzyt';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ─── AUTHENTICATION ───────────────────────────────────────────────────────
const db = {
  // Sign up / Register
  async signup(email, password, name, role = 'user') {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (authError) return { error: authError.message };
    
    // Create user profile in public.users table
    const { data, error } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        name,
        role,
        created_at: new Date().toISOString(),
      }]);
    
    return { data, error: error?.message };
  },

  // Sign in
  async signin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error: error?.message };
  },

  // Sign out
  async signout() {
    return await supabase.auth.signOut();
  },

  // Get current user
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // ─── CUSTOMERS ────────────────────────────────────────────────────────
  async getCustomers(userId) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    return { data: data || [], error };
  },

  async addCustomer(userId, customer) {
    const { data, error } = await supabase
      .from('customers')
      .insert([{ ...customer, user_id: userId }])
      .select();
    return { data: data?.[0], error };
  },

  async updateCustomer(id, updates) {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select();
    return { data: data?.[0], error };
  },

  async deleteCustomer(id) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    return { error };
  },

  // ─── JOBS ────────────────────────────────────────────────────────────
  async getJobs(userId) {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', userId)
      .order('job_no', { ascending: false });
    return { data: data || [], error };
  },

  async addJob(userId, job) {
    const { data, error } = await supabase
      .from('jobs')
      .insert([{ ...job, user_id: userId }])
      .select();
    return { data: data?.[0], error };
  },

  async updateJob(id, updates) {
    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', id)
      .select();
    return { data: data?.[0], error };
  },

  async deleteJob(id) {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', id);
    return { error };
  },

  // ─── INVENTORY ────────────────────────────────────────────────────────
  async getInventory(userId) {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    return { data: data || [], error };
  },

  async addInventoryItem(userId, item) {
    const { data, error } = await supabase
      .from('inventory')
      .insert([{ ...item, user_id: userId }])
      .select();
    return { data: data?.[0], error };
  },

  async updateInventoryItem(id, updates) {
    const { data, error } = await supabase
      .from('inventory')
      .update(updates)
      .eq('id', id)
      .select();
    return { data: data?.[0], error };
  },

  async deleteInventoryItem(id) {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id);
    return { error };
  },

  // ─── INVOICES ────────────────────────────────────────────────────────
  async getInvoices(userId) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    return { data: data || [], error };
  },

  async addInvoice(userId, invoice) {
    const { data, error } = await supabase
      .from('invoices')
      .insert([{ ...invoice, user_id: userId }])
      .select();
    return { data: data?.[0], error };
  },

  async updateInvoice(id, updates) {
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select();
    return { data: data?.[0], error };
  },

  async deleteInvoice(id) {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);
    return { error };
  },

  // ─── SALES ────────────────────────────────────────────────────────────
  async getSales(userId) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    return { data: data || [], error };
  },

  async addSale(userId, sale) {
    const { data, error } = await supabase
      .from('sales')
      .insert([{ ...sale, user_id: userId }])
      .select();
    return { data: data?.[0], error };
  },

  async deleteSale(id) {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id);
    return { error };
  },

  // ─── EXPENSES ────────────────────────────────────────────────────────
  async getExpenses(userId) {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    return { data: data || [], error };
  },

  async addExpense(userId, expense) {
    const { data, error } = await supabase
      .from('expenses')
      .insert([{ ...expense, user_id: userId }])
      .select();
    return { data: data?.[0], error };
  },

  async deleteExpense(id) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    return { error };
  },

  // ─── REAL-TIME SUBSCRIPTIONS ──────────────────────────────────────────
  subscribeToCustomers(userId, callback) {
    return supabase
      .from('customers')
      .on('*', payload => callback(payload))
      .eq('user_id', userId)
      .subscribe();
  },

  subscribeToJobs(userId, callback) {
    return supabase
      .from('jobs')
      .on('*', payload => callback(payload))
      .eq('user_id', userId)
      .subscribe();
  },

  subscribeToInventory(userId, callback) {
    return supabase
      .from('inventory')
      .on('*', payload => callback(payload))
      .eq('user_id', userId)
      .subscribe();
  },

  subscribeToInvoices(userId, callback) {
    return supabase
      .from('invoices')
      .on('*', payload => callback(payload))
      .eq('user_id', userId)
      .subscribe();
  },

  subscribeToSales(userId, callback) {
    return supabase
      .from('sales')
      .on('*', payload => callback(payload))
      .eq('user_id', userId)
      .subscribe();
  },

  subscribeToExpenses(userId, callback) {
    return supabase
      .from('expenses')
      .on('*', payload => callback(payload))
      .eq('user_id', userId)
      .subscribe();
  },
};

export default db;
