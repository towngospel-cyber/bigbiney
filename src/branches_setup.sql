-- Run once in Supabase → SQL Editor. Safe to re-run.
alter table public.sales
  add column if not exists branch text, add column if not exists customer text,
  add column if not exists description text, add column if not exists items text,
  add column if not exists discount numeric default 0, add column if not exists total numeric,
  add column if not exists balance numeric default 0, add column if not exists reference text,
  add column if not exists received_by text, add column if not exists notes text,
  add column if not exists receipt_no text;
alter table public.expenses add column if not exists branch text;
alter table public.payroll
  add column if not exists basic numeric, add column if not exists allowance numeric default 0,
  add column if not exists deductions numeric default 0, add column if not exists reference text,
  add column if not exists branch text;
notify pgrst, 'reload schema';
