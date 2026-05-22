"""
Импорт данных из «Сырье панель Чао.xlsx» и «Сырье панель ФБ.xlsx» в Supabase.
Запуск: python3 supabase/import_chao_fb.py
"""

import re, sys, json, urllib.request, urllib.error, openpyxl

SUPABASE_URL = "https://gjhcvsmaatwrzortwdms.supabase.co"
SUPABASE_KEY = "sb_publishable_S-FgwOI0NXtaVYIFTHE1HQ_FvSoj1_x"

HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}

FILES = {
    "ЧАО":       "/Users/admin/Downloads/Сырье панель Чао.xlsx",
    "ФРАНКЛИНС": "/Users/admin/Downloads/Сырье панель ФБ.xlsx",
}

# ── Кеши ──────────────────────────────────────────────────────────────────────
_periods   = {}   # (year, label) → id
_employees = {}   # inn → id  |  (name, phone_digits) → id
_rest_ids  = {}   # name → id

def req(method, path, body=None, extra_headers=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    hdrs = dict(HEADERS)
    if extra_headers:
        hdrs.update(extra_headers)
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else []
    except urllib.error.HTTPError as e:
        body_err = e.read().decode()
        raise RuntimeError(f"HTTP {e.code} {method} {path}: {body_err[:300]}")

def db_select(table, filters=""):
    return req("GET", f"{table}?{filters}&limit=1", extra_headers={"Prefer": "return=representation"})

def db_select_raw(table, qs):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{qs}"
    r = urllib.request.Request(url, headers=HEADERS, method="GET")
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())

def db_insert(table, payload):
    return req("POST", table, payload)

def db_insert_ignore(table, payload):
    """Insert, silently ignore duplicate/constraint errors."""
    try:
        db_insert(table, payload)
    except RuntimeError:
        pass

def clean(v):
    return str(v).strip() if v is not None else ""

def clean_year(v):
    return re.sub(r"\D", "", str(v))[:4]

def clean_phone(v):
    return re.sub(r"\D", "", str(v))[-10:] if v else ""

def clean_num(v):
    if v is None: return None
    try: return float(str(v).replace(",", ".").replace(" ", "").replace("\xa0", ""))
    except: return None

def parse_date(v):
    if not v: return None
    s = str(v).strip()
    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", s)
    if m: return f"{m[3]}-{m[2].zfill(2)}-{m[1].zfill(2)}"
    if re.match(r"^\d{4}-\d{2}-\d{2}", s): return s[:10]
    return None

# ── Получить или создать ресторан ─────────────────────────────────────────────
def get_restaurant(name):
    if name in _rest_ids:
        return _rest_ids[name]
    import urllib.parse
    rows = db_select_raw("restaurants", f"name=eq.{urllib.parse.quote(name)}&select=id")
    if rows:
        _rest_ids[name] = rows[0]["id"]
    else:
        r2 = db_insert("restaurants", {"name": name})
        _rest_ids[name] = r2[0]["id"]
        print(f"  ✓ Создан ресторан «{name}»")
    return _rest_ids[name]

# ── Получить или создать период ───────────────────────────────────────────────
def parse_period_dates(label, year):
    """'16.10-31.10', 2025 → (month, '2025-10-16', '2025-10-31')"""
    m = re.match(r"^(\d{1,2})\.(\d{2})-(\d{1,2})\.(\d{2})$", str(label).strip())
    if m:
        d1, mo1, d2, mo2 = m.group(1), m.group(2), m.group(3), m.group(4)
        start = f"{year}-{mo1}-{d1.zfill(2)}"
        end   = f"{year}-{mo2}-{d2.zfill(2)}"
        return int(mo1), start, end
    # fallback
    mo = re.search(r"\.(\d{2})", str(label))
    month = int(mo.group(1)) if mo else 1
    return month, f"{year}-{month:02d}-01", f"{year}-{month:02d}-15"

def get_period(year_str, label):
    year = int(clean_year(str(year_str))) if clean_year(str(year_str)) else 2025
    key = (year, label)
    if key in _periods:
        return _periods[key]
    import urllib.parse
    rows = db_select_raw("billing_periods", f"year=eq.{year}&label=eq.{urllib.parse.quote(label)}&select=id")
    if rows:
        _periods[key] = rows[0]["id"]
    else:
        month, start, end = parse_period_dates(label, year)
        r2 = db_insert("billing_periods", {
            "year": year, "label": label,
            "month": month, "period_start": start, "period_end": end
        })
        _periods[key] = r2[0]["id"]
    return _periods[key]

# ── Получить или создать сотрудника ───────────────────────────────────────────
def get_employee(name, phone=None, inn=None, extra=None):
    import urllib.parse
    inn_clean = re.sub(r"\D", "", str(inn))[:12] if inn else None
    phone_clean = clean_phone(phone)

    if inn_clean and len(inn_clean) >= 10:
        if inn_clean in _employees:
            return _employees[inn_clean]
        rows = db_select_raw("employees", f"inn=eq.{inn_clean}&select=id")
        if rows:
            _employees[inn_clean] = rows[0]["id"]
            return _employees[inn_clean]

    name_clean = clean(name)
    pkey = (name_clean, phone_clean)
    if pkey in _employees:
        return _employees[pkey]
    if phone_clean:
        rows = db_select_raw("employees", f"full_name=eq.{urllib.parse.quote(name_clean)}&select=id,phone")
        for row in rows:
            if clean_phone(row.get("phone", "")) == phone_clean:
                _employees[pkey] = row["id"]
                if inn_clean: _employees[inn_clean] = row["id"]
                return row["id"]

    payload = {"full_name": name_clean}
    if phone_clean: payload["phone"] = phone_clean
    if inn_clean and len(inn_clean) >= 10: payload["inn"] = inn_clean
    if extra:
        for k, v in extra.items():
            if v: payload[k] = v
    r2 = db_insert("employees", payload)
    eid = r2[0]["id"]
    _employees[pkey] = eid
    if inn_clean: _employees[inn_clean] = eid
    return eid

# ── Импорт выплат ─────────────────────────────────────────────────────────────
def import_payroll(ws, restaurant_id, has_position=False):
    headers = [clean(c) for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    def col(names):
        for nm in (names if isinstance(names, list) else [names]):
            try: return headers.index(nm)
            except ValueError: pass
        return None

    c_year    = col(["Год"])
    c_period  = col(["Период"])
    c_name    = col(["ФИО"])
    c_phone   = col(["Телефон"])
    c_amount  = col(["Сумма ", "По реестру ", "Сумма", "По реестру"])
    c_status  = col(["Статус ", "Статус"])
    c_comment = col(["Комментарий"])
    c_pos     = col(["Должность"]) if has_position else None

    rows_ok, rows_skip, rows_err = 0, 0, 0
    batch = []

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        name = clean(row[c_name]) if c_name is not None else ""
        if not name:
            rows_skip += 1
            continue

        year_val   = row[c_year]   if c_year   is not None else 2025
        period_val = row[c_period] if c_period is not None else ""
        phone_val  = row[c_phone]  if c_phone  is not None else ""
        amount_val = row[c_amount] if c_amount is not None else None
        status_val = clean(row[c_status])  if c_status  is not None else ""
        comment_val= clean(row[c_comment]) if c_comment is not None else ""
        pos_val    = clean(row[c_pos])     if c_pos     is not None else ""

        try:
            emp_extra = {"position": pos_val} if pos_val else None
            emp_id = get_employee(name, phone_val, extra=emp_extra)
            period_id = get_period(year_val, clean(period_val))
            amount = clean_num(amount_val)

            batch.append({
                "employee_id":  emp_id,
                "period_id":    period_id,
                "total_payout": amount,
                "status":       status_val or None,
                "comment":      comment_val or None,
            })

            db_insert_ignore("salary_sheets",
                {"employee_id": emp_id, "restaurant_id": restaurant_id, "period_id": period_id})

            rows_ok += 1

            if len(batch) >= 200:
                db_insert("payroll_records", batch)
                batch = []
                sys.stdout.write(f"\r    {rows_ok} строк…")
                sys.stdout.flush()

        except Exception as e:
            rows_err += 1
            if rows_err <= 5:
                print(f"\n    ✗ строка {i}: {e}")

    if batch:
        db_insert("payroll_records", batch)

    print(f"\n    ✓ {rows_ok} выплат импортировано | пропущено: {rows_skip} | ошибок: {rows_err}")

# ── Импорт документов ─────────────────────────────────────────────────────────
def import_docs(ws, restaurant_id):
    headers = [clean(c) for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    def ci(names):
        for nm in (names if isinstance(names, list) else [names]):
            try: return headers.index(nm)
            except ValueError: pass
        return None

    c_name   = ci(["ФИО"])
    c_phone  = ci(["Номер телефона формат (70000000000)", "Телефон"])
    c_inn    = ci(["ИНН"])
    c_cit    = ci(["Граждансво", "Гражданство"])
    c_pos    = ci(["Должность"])
    c_city   = ci(["Город"])
    c_status = ci(["Статус"])
    c_ppser  = ci(["серия патента"])
    c_ppnum  = ci(["Номер патента"])
    c_bser   = ci(["Серия бланка патента"])
    c_bnum   = ci(["Номер бланка патента"])
    c_pp_iss = ci(["Дата выдачи паспорта"])
    c_reg    = ci(["Регистрация дата окончания"])
    c_pat    = ci(["патент дата выдачи"])
    c_cdate  = ci(["договор дата заключения"])
    c_clink  = ci(["ссылка на договор"])
    c_docl   = ci(["Ссылка на полный пакет документов"])
    c_issues = ci(["Проблемы (отсутствующие документы или документы с плохим качеством)"])
    c_birth  = ci(["Дата рождения"])
    c_pass   = ci(["Паспортные данные"])
    c_fired  = ci(["Уволен\n(дата)", "Уволен (дата)"])

    rows_ok, rows_skip, rows_err = 0, 0, 0

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        g = lambda c: row[c] if c is not None and c < len(row) else None

        name = clean(g(c_name))
        if not name:
            rows_skip += 1
            continue

        try:
            extra = {}
            if g(c_cit):  extra["citizenship"] = clean(g(c_cit))
            if g(c_pos):  extra["position"]    = clean(g(c_pos))
            if g(c_city): extra["city"]         = clean(g(c_city))
            if g(c_birth):extra["birth_date"]   = parse_date(g(c_birth))
            if g(c_pass): extra["passport_data"]= clean(g(c_pass))
            if g(c_fired):extra["fired_at"]     = parse_date(g(c_fired))

            emp_id = get_employee(name, g(c_phone), inn=g(c_inn), extra=extra if extra else None)

            import urllib.parse
            doc = {"employee_id": emp_id}
            if g(c_status): doc["doc_status"]          = clean(g(c_status))
            if g(c_ppser):  doc["patent_series"]       = clean(g(c_ppser))
            if g(c_ppnum):  doc["patent_number"]       = clean(g(c_ppnum))
            if g(c_bser):   doc["form_series"]         = clean(g(c_bser))
            if g(c_bnum):   doc["form_number"]         = clean(g(c_bnum))
            if g(c_pp_iss): doc["passport_issued_at"]  = parse_date(g(c_pp_iss))
            if g(c_reg):    doc["registration_end_at"] = parse_date(g(c_reg))
            if g(c_pat):    doc["patent_issued_at"]    = parse_date(g(c_pat))
            if g(c_cdate):  doc["contract_date"]       = parse_date(g(c_cdate))
            if g(c_clink):  doc["contract_link"]       = clean(g(c_clink))
            if g(c_docl):   doc["doc_link"]            = clean(g(c_docl))
            if g(c_issues): doc["issues"]              = clean(g(c_issues))

            ex = db_select_raw("employee_documents", f"employee_id=eq.{emp_id}&select=id")
            if ex:
                url = f"{SUPABASE_URL}/rest/v1/employee_documents?id=eq.{ex[0]['id']}"
                data = json.dumps(doc).encode()
                hdrs = dict(HEADERS)
                hdrs["Prefer"] = "return=representation"
                r = urllib.request.Request(url, data=data, headers=hdrs, method="PATCH")
                urllib.request.urlopen(r)
            else:
                db_insert("employee_documents", doc)

            db_insert_ignore("salary_sheets",
                {"employee_id": emp_id, "restaurant_id": restaurant_id})

            rows_ok += 1
            if rows_ok % 50 == 0:
                sys.stdout.write(f"\r    {rows_ok} документов…")
                sys.stdout.flush()

        except Exception as e:
            rows_err += 1
            if rows_err <= 5:
                print(f"\n    ✗ строка {i}: {e}")

    print(f"\n    ✓ {rows_ok} документов импортировано | пропущено: {rows_skip} | ошибок: {rows_err}")

# ── Main ──────────────────────────────────────────────────────────────────────
for rest_name, fpath in FILES.items():
    print(f"\n{'='*50}")
    print(f"Импорт: {rest_name} ({fpath})")
    print('='*50)

    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
    rest_id = get_restaurant(rest_name)
    print(f"  Ресторан ID: {rest_id}")

    if "Выплаты" in wb.sheetnames:
        print(f"\n  → Выплаты:")
        ws = wb["Выплаты"]
        has_pos = rest_name == "ЧАО"
        import_payroll(ws, rest_id, has_position=has_pos)

    if "Документы" in wb.sheetnames:
        ws_doc = wb["Документы"]
        first_row = next(ws_doc.iter_rows(min_row=1, max_row=1, values_only=True))
        if any(c for c in first_row if c and str(c) != "#REF!"):
            print(f"\n  → Документы:")
            import_docs(ws_doc, rest_id)

print("\n\n✅ Импорт завершён!")
