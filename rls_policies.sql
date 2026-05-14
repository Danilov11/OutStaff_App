-- Политики RLS: анонимный ключ может читать все таблицы
-- Запустить в: Supabase Dashboard → SQL Editor

create policy "anon read employees"          on employees          for select to anon using (true);
create policy "anon read billing_periods"    on billing_periods    for select to anon using (true);
create policy "anon read payroll_records"    on payroll_records    for select to anon using (true);
create policy "anon read employee_documents" on employee_documents for select to anon using (true);
create policy "anon read document_visits"    on document_visits    for select to anon using (true);
create policy "anon read restaurants"        on restaurants        for select to anon using (true);
create policy "anon read contractors"        on contractors        for select to anon using (true);
create policy "anon read invoices"           on invoices           for select to anon using (true);
create policy "anon read invoices_breakdown" on invoices_breakdown for select to anon using (true);
create policy "anon read invoice_payments"   on invoice_payments   for select to anon using (true);
create policy "anon read salary_sheets"      on salary_sheets      for select to anon using (true);
