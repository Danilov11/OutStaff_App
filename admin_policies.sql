-- Политики RLS для записи через admin-панель (anon key)
-- Запустить в: Supabase Dashboard → SQL Editor

-- employees
create policy "anon insert employees"
    on employees for insert to anon with check (true);
create policy "anon update employees"
    on employees for update to anon using (true) with check (true);

-- restaurants
create policy "anon insert restaurants"
    on restaurants for insert to anon with check (true);

-- billing_periods
create policy "anon insert billing_periods"
    on billing_periods for insert to anon with check (true);

-- payroll_records
create policy "anon insert payroll_records"
    on payroll_records for insert to anon with check (true);

-- employee_documents
create policy "anon insert employee_documents"
    on employee_documents for insert to anon with check (true);
create policy "anon update employee_documents"
    on employee_documents for update to anon using (true) with check (true);

-- salary_sheets
create policy "anon insert salary_sheets"
    on salary_sheets for insert to anon with check (true);
