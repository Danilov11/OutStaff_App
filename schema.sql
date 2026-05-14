-- ═══════════════════════════════════════════════════════════
-- Панель партнёра — схема Supabase v2
-- Источник данных: Сырье_панель_Чайхана-2.xlsx
-- Запустить в: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════

-- Удаляем старые таблицы
drop table if exists transactions      cascade;
drop table if exists account_payments  cascade;
drop table if exists rounds            cascade;
drop table if exists documents         cascade;
drop table if exists payments          cascade;

-- ── Выплаты сотрудникам ─────────────────────────────────────
create table payments (
  id                    bigserial primary key,
  year                  integer       not null,
  period                text          not null,
  employee              text          not null,
  phone                 text,
  inn                   text,
  amount_registry       numeric(14,2),        -- Сумма из реестра
  deduction             numeric(14,2),        -- Удержание
  total_with_deduction  numeric(14,2),        -- Итог с удержанием
  platform_fee          numeric(14,2),        -- Комиссия платформы
  amount                numeric(14,2) not null default 0, -- ИТОГ к выплате
  status                text          not null,
  comment               text,
  created_at            timestamptz   not null default now()
);

-- ── Документы сотрудников ────────────────────────────────────
create table documents (
  id                    bigserial primary key,
  status                text,                 -- Прямой статус (Оформлен / В обработке / На оформлении / Уволен…)
  project               text,
  city                  text,
  position              text,
  restaurant            text,
  comment               text,
  rcl_check_date        text,                 -- Дата проверки в РКЛ
  vacation              text,
  inn                   text,
  patent_series         text,
  patent_number         text,
  patent_blank_series   text,
  patent_blank_number   text,
  passport_issue_date   text,
  birth_date            text,
  passport_data         text,
  employee              text          not null,
  phone                 text,
  citizenship           text,
  documents_link        text,
  problems              text,
  registration_end_date text,
  patent_issue_date     text,
  contract_date         text,
  contract_link         text,
  dismissed_date        text,
  ip_contracts          text,
  created_at            timestamptz   not null default now()
);

-- ── Объезды (доставка договоров) ─────────────────────────────
create table rounds (
  id                     text primary key,
  created_at             timestamptz,
  restaurant             text,
  director               text,
  employee_name          text,
  employee_inn           text,
  paper_reason           text,
  planned_visit_date     text,
  status                 text,
  admin_deadline         text,
  admin_comment          text,
  contract_delivery_date text,
  updated_at             timestamptz
);

-- ── Счета (выплаты по периодам) ──────────────────────────────
create table account_payments (
  id            bigserial primary key,
  year          integer,
  period        text          not null,
  month         text,
  payroll_fund  numeric(14,2),               -- ФОТ
  revenue       numeric(14,2),               -- Выручка (к оплате)
  amount_paid   numeric(14,2) not null default 0,
  diff          numeric(14,2) generated always as (coalesce(revenue,0) - amount_paid) stored,
  status        text,
  comment       text,
  created_at    timestamptz   not null default now()
);

-- ── Транзакции ───────────────────────────────────────────────
create table transactions (
  id         bigserial primary key,
  date       text          not null,
  person     text,
  amount     numeric(14,2) not null default 0,
  created_at timestamptz   not null default now()
);

-- ═══════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════
alter table payments         enable row level security;
alter table documents        enable row level security;
alter table rounds           enable row level security;
alter table account_payments enable row level security;
alter table transactions     enable row level security;

create policy "anon read payments"         on payments         for select to anon using (true);
create policy "anon read documents"        on documents        for select to anon using (true);
create policy "anon read rounds"           on rounds           for select to anon using (true);
create policy "anon read account_payments" on account_payments for select to anon using (true);
create policy "anon read transactions"     on transactions     for select to anon using (true);
