// admin.js — Панель администратора

// ── Supabase ──────────────────────────────────────────────────────────────────
let db = null;
function getDB() {
    if (!db) db = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
    return db;
}

// ── Состояние ─────────────────────────────────────────────────────────────────
let state = {
    currentStep: 1,
    restaurantId: null,
    restaurantName: '',
    year: new Date().getFullYear(),
    periodLabel: '',
    dataType: 'payroll',
    workbook: null,
    sheetData: [],   // массив строк (массивы значений)
    headers: [],     // строка заголовков
    mapping: {},     // { dbField: colIndex | null }
    restaurants: []
};

// ── Определения полей ─────────────────────────────────────────────────────────
const PAYROLL_FIELDS = [
    { key: 'employee_name', label: 'ФИО сотрудника',       required: true,  table: 'employees' },
    { key: 'inn',           label: 'ИНН',                   required: false, table: 'employees' },
    { key: 'phone',         label: 'Телефон',               required: false, table: 'employees' },
    { key: 'citizenship',   label: 'Гражданство',           required: false, table: 'employees' },
    { key: 'position',      label: 'Должность',             required: false, table: 'employees' },
    { key: 'city',          label: 'Город',                 required: false, table: 'employees' },
    { key: 'registry_amount', label: 'Сумма в реестре',    required: false, table: 'payroll_records' },
    { key: 'deduction',     label: 'Удержание',             required: false, table: 'payroll_records' },
    { key: 'after_deduction', label: 'После удержания',    required: false, table: 'payroll_records' },
    { key: 'platform_fee',  label: 'Комиссия платформы',   required: false, table: 'payroll_records' },
    { key: 'total_payout',  label: 'К выплате',            required: false, table: 'payroll_records' },
    { key: 'status',        label: 'Статус выплаты',        required: false, table: 'payroll_records' },
    { key: 'comment',       label: 'Комментарий',           required: false, table: 'payroll_records' },
    { key: 'period_label',  label: 'Период (из файла)',     required: false, table: 'billing_periods' },
];

const DOC_FIELDS = [
    { key: 'employee_name', label: 'ФИО сотрудника',       required: true,  table: 'employees' },
    { key: 'inn',           label: 'ИНН',                   required: false, table: 'employees' },
    { key: 'phone',         label: 'Телефон',               required: false, table: 'employees' },
    { key: 'citizenship',   label: 'Гражданство',           required: false, table: 'employees' },
    { key: 'position',      label: 'Должность',             required: false, table: 'employees' },
    { key: 'birth_date',    label: 'Дата рождения',         required: false, table: 'employees' },
    { key: 'passport_data', label: 'Паспортные данные',     required: false, table: 'employees' },
    { key: 'fired_at',      label: 'Дата увольнения',       required: false, table: 'employees' },
    { key: 'doc_status',    label: 'Статус документов',     required: false, table: 'employee_documents' },
    { key: 'patent_series', label: 'Серия патента',         required: false, table: 'employee_documents' },
    { key: 'patent_number', label: 'Номер патента',         required: false, table: 'employee_documents' },
    { key: 'form_series',   label: 'Серия бланка',          required: false, table: 'employee_documents' },
    { key: 'form_number',   label: 'Номер бланка',          required: false, table: 'employee_documents' },
    { key: 'passport_issued_at',    label: 'Дата выдачи паспорта',  required: false, table: 'employee_documents' },
    { key: 'registration_end_at',   label: 'Конец регистрации',     required: false, table: 'employee_documents' },
    { key: 'patent_issued_at',      label: 'Дата выдачи патента',   required: false, table: 'employee_documents' },
    { key: 'contract_date',         label: 'Дата договора',         required: false, table: 'employee_documents' },
    { key: 'doc_link',      label: 'Ссылка на документы',   required: false, table: 'employee_documents' },
    { key: 'contract_link', label: 'Ссылка на договор',     required: false, table: 'employee_documents' },
    { key: 'issues',        label: 'Проблемы',              required: false, table: 'employee_documents' },
];

// Авто-распознавание заголовков (ключевые слова → dbField)
const AUTO_DETECT = {
    employee_name:    ['фио', 'имя', 'сотрудник', 'работник', 'name', 'full_name'],
    inn:              ['инн', 'inn', 'идентификатор'],
    phone:            ['телефон', 'phone', 'тел'],
    citizenship:      ['гражданство', 'citizenship', 'нацио'],
    position:         ['должность', 'position', 'роль'],
    city:             ['город', 'city'],
    registry_amount:  ['реестр', 'registry', 'начислено', 'в реестре'],
    deduction:        ['удержание', 'вычет', 'deduction'],
    after_deduction:  ['после удержания', 'after_deduction', 'итого после'],
    platform_fee:     ['комиссия', 'платформа', 'platform_fee', 'fee'],
    total_payout:     ['к выплате', 'выплата', 'итого', 'total', 'payout', 'сумма'],
    status:           ['статус', 'status'],
    comment:          ['комментарий', 'comment', 'примечание'],
    period_label:     ['период', 'period'],
    birth_date:       ['дата рождения', 'birth', 'рожден'],
    passport_data:    ['паспорт', 'passport'],
    fired_at:         ['уволен', 'fired', 'увольнение'],
    doc_status:       ['статус документ', 'doc_status', 'оформлен'],
    patent_series:    ['серия патент', 'patent_series'],
    patent_number:    ['номер патент', 'patent_number'],
    form_series:      ['серия бланк', 'form_series'],
    form_number:      ['номер бланк', 'form_number'],
    passport_issued_at:   ['выдачи паспорт', 'passport_issued'],
    registration_end_at:  ['конец регистр', 'registration_end'],
    patent_issued_at:     ['выдачи патент', 'patent_issued'],
    contract_date:        ['дата договор', 'contract_date'],
    doc_link:             ['ссылка документ', 'doc_link'],
    contract_link:        ['ссылка договор', 'contract_link'],
    issues:               ['проблем', 'issue'],
};

// ── Auth ──────────────────────────────────────────────────────────────────────
function doLogin() {
    const pwd = document.getElementById('login-password').value;
    if (pwd === CONFIG.dashboardPassword || pwd === CONFIG.platformPassword) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-app').classList.remove('hidden');
        initAdmin();
    } else {
        document.getElementById('login-err').style.display = 'block';
    }
}

document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
});

function doLogout() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('admin-app').classList.add('hidden');
    document.getElementById('login-password').value = '';
    document.getElementById('login-err').style.display = 'none';
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function initAdmin() {
    await loadRestaurants();
    initDropzone();
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function showTab(name) {
    document.querySelectorAll('.adm-tab').forEach((t, i) => {
        t.classList.toggle('active', ['import', 'restaurants'][i] === name);
    });
    document.querySelectorAll('.adm-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
}

// ── Restaurants ───────────────────────────────────────────────────────────────
async function loadRestaurants() {
    const { data, error } = await getDB().from('restaurants').select('id, name').order('name');
    if (error) { console.error('Restaurants load error:', error); return; }

    state.restaurants = data || [];
    renderRestaurantSelect(data);
    renderRestaurantList(data);
}

function renderRestaurantSelect(list) {
    const sel = document.getElementById('sel-restaurant');
    sel.innerHTML = '<option value="">— Выбрать ресторан —</option>' +
        (list || []).map(r => `<option value="${r.id}">${r.name}</option>`).join('');
}

function renderRestaurantList(list) {
    const el = document.getElementById('rest-list');
    if (!list || !list.length) { el.innerHTML = '<div style="color:var(--tx2);font-size:13px">Нет ресторанов</div>'; return; }
    el.innerHTML = list.map(r => `
        <div class="rest-item">
            <div class="rest-icon"><i class="fas fa-utensils"></i></div>
            <div>
                <div class="rest-name">${r.name}</div>
                <div class="rest-id">ID: ${r.id}</div>
            </div>
        </div>
    `).join('');
}

async function addRestaurant() {
    const name = document.getElementById('inp-rest-name').value.trim().toUpperCase();
    const alertEl = document.getElementById('rest-alert');
    if (!name) return;

    const { data, error } = await getDB().from('restaurants').insert({ name }).select().single();
    if (error) {
        showAlert(alertEl, 'err', 'Ошибка: ' + error.message);
        return;
    }
    showAlert(alertEl, 'ok', `Ресторан "${name}" добавлен`);
    document.getElementById('inp-rest-name').value = '';
    await loadRestaurants();
}

// ── Steps ─────────────────────────────────────────────────────────────────────
function goStep(n) {
    if (n === 2) {
        const selRest = document.getElementById('sel-restaurant').value;
        const newRest = document.getElementById('inp-new-restaurant').value.trim();
        state.year = parseInt(document.getElementById('inp-year').value) || new Date().getFullYear();
        state.periodLabel = document.getElementById('inp-period-label').value.trim();
        state.dataType = document.getElementById('sel-data-type').value;

        if (!selRest && !newRest) { alert('Выберите или создайте ресторан'); return; }
        if (newRest) {
            state.restaurantName = newRest.toUpperCase();
            state.restaurantId = null;
        } else {
            state.restaurantId = selRest;
            state.restaurantName = state.restaurants.find(r => r.id == selRest)?.name || '';
        }
    }

    if (n === 3 && !state.workbook) { alert('Загрузите файл'); return; }
    if (n === 3) buildMapper();
    if (n === 4) buildImportSummary();

    for (let i = 1; i <= 4; i++) {
        const card = document.getElementById('step-' + i);
        if (card) card.classList.toggle('hidden', i !== n);
        const ind = document.getElementById('step-ind-' + i);
        if (ind) {
            ind.classList.remove('active', 'done');
            if (i < n) ind.classList.add('done');
            else if (i === n) ind.classList.add('active');
        }
        const line = document.getElementById('step-line-' + i);
        if (line) line.classList.toggle('done', i < n);
    }
    state.currentStep = n;
}

// ── File handling ─────────────────────────────────────────────────────────────
function initDropzone() {
    const dz = document.getElementById('dropzone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
        e.preventDefault();
        dz.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });
}

function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const data = new Uint8Array(e.target.result);
        state.workbook = XLSX.read(data, { type: 'array', cellDates: true });

        const dz = document.getElementById('dropzone');
        dz.classList.add('has-file');
        dz.innerHTML = `<i class="fas fa-check-circle"></i><div class="dz-title">${file.name}</div><div class="dz-sub">Нажмите чтобы сменить файл</div>`;

        // Populate sheet selector
        const sheetRow = document.getElementById('sheet-selector-row');
        const sel = document.getElementById('sel-sheet');
        sel.innerHTML = state.workbook.SheetNames.map((n, i) => `<option value="${i}">${n}</option>`).join('');
        sheetRow.classList.remove('hidden');

        document.getElementById('btn-step2-next').classList.remove('hidden');
        loadSheet();
    };
    reader.readAsArrayBuffer(file);
}

function loadSheet() {
    if (!state.workbook) return;
    const idx = parseInt(document.getElementById('sel-sheet').value) || 0;
    const headerRow = parseInt(document.getElementById('inp-header-row').value) || 1;
    const sheetName = state.workbook.SheetNames[idx];
    const sheet = state.workbook.Sheets[sheetName];

    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!raw.length) return;

    const headerIdx = headerRow - 1;
    state.headers = (raw[headerIdx] || []).map(h => String(h).trim());
    state.sheetData = raw.slice(headerRow).filter(row => row.some(c => c !== '' && c !== null && c !== undefined));
}

// ── Column Mapper ─────────────────────────────────────────────────────────────
function buildMapper() {
    const fields = state.dataType === 'payroll' ? PAYROLL_FIELDS : DOC_FIELDS;
    autoDetectMapping(fields);
    renderMapper(fields);
    renderPreview();
}

function autoDetectMapping(fields) {
    state.mapping = {};
    fields.forEach(f => {
        const keywords = AUTO_DETECT[f.key] || [f.key];
        let found = null;
        state.headers.forEach((h, idx) => {
            if (found !== null) return;
            const hl = h.toLowerCase();
            if (keywords.some(kw => hl.includes(kw))) found = idx;
        });
        state.mapping[f.key] = found;
    });
}

function renderMapper(fields) {
    const wrap = document.getElementById('col-mapper-wrap');
    const sampleRow = state.sheetData[0] || [];

    const options = ['<option value="">— не импортировать —</option>',
        ...state.headers.map((h, i) => `<option value="${i}">${h}</option>`)
    ].join('');

    const rows = fields.map(f => {
        const sel = state.mapping[f.key];
        const sample = sel !== null && sel !== undefined ? String(sampleRow[sel] || '').slice(0, 40) : '';
        const tableLabel = { employees: '👤 Сотрудник', payroll_records: '💰 Выплата', billing_periods: '📅 Период', employee_documents: '📄 Документ' }[f.table] || f.table;
        return `
        <tr>
            <td><span class="col-name">${f.label}${f.required ? ' <span style="color:var(--er-fg)">*</span>' : ''}</span><br><small style="color:var(--tx3)">${tableLabel}</small></td>
            <td>
                <select onchange="onMappingChange('${f.key}', this.value)">
                    ${state.headers.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${h}</option>`).join('')}
                    <option value="" ${sel === null || sel === undefined ? 'selected' : ''}>— не импортировать —</option>
                </select>
            </td>
            <td class="col-sample" id="sample-${f.key}">${sample}</td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
        <table class="col-mapper">
            <thead><tr><th>Поле БД</th><th>Колонка в Excel</th><th>Пример значения</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function onMappingChange(key, val) {
    state.mapping[key] = val === '' ? null : parseInt(val);
    const sampleRow = state.sheetData[0] || [];
    const el = document.getElementById('sample-' + key);
    if (el) el.textContent = val !== '' ? String(sampleRow[parseInt(val)] || '').slice(0, 40) : '';
}

function renderPreview() {
    const preview = document.getElementById('preview-wrap');
    const fields = state.dataType === 'payroll' ? PAYROLL_FIELDS : DOC_FIELDS;
    const mapped = fields.filter(f => state.mapping[f.key] !== null && state.mapping[f.key] !== undefined);
    const rows = state.sheetData.slice(0, 5);

    const ths = mapped.map(f => `<th>${f.label}</th>`).join('');
    const trs = rows.map(row =>
        '<tr>' + mapped.map(f => `<td>${String(row[state.mapping[f.key]] ?? '').slice(0, 30)}</td>`).join('') + '</tr>'
    ).join('');

    preview.innerHTML = `<table class="preview-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Import Summary ────────────────────────────────────────────────────────────
function buildImportSummary() {
    const total = state.sheetData.length;
    const restName = state.restaurantName || state.restaurants.find(r => r.id == state.restaurantId)?.name || '—';
    const period = state.periodLabel ? `${state.periodLabel} ${state.year}` : `${state.year}`;
    document.getElementById('import-summary-text').textContent =
        `Готово к импорту: ${total} строк для "${restName}", период ${period}. Тип: ${state.dataType === 'payroll' ? 'Выплаты' : 'Документы'}.`;
}

// ── Import ────────────────────────────────────────────────────────────────────
async function startImport() {
    document.getElementById('btn-start-import').disabled = true;
    document.getElementById('btn-back-3').disabled = true;
    document.getElementById('import-progress').style.display = 'block';
    document.getElementById('import-result').classList.remove('show');

    const log = document.getElementById('prog-log');
    const bar = document.getElementById('prog-bar');
    const label = document.getElementById('prog-label');

    function addLog(msg, type = '') {
        const d = document.createElement('div');
        d.className = 'log-line' + (type ? ' log-' + type : '');
        d.textContent = msg;
        log.appendChild(d);
        log.scrollTop = log.scrollHeight;
    }
    function setProgress(pct, text) {
        bar.style.width = pct + '%';
        label.textContent = text;
    }

    try {
        // 1. Ресторан
        let restaurantId = state.restaurantId;
        if (!restaurantId) {
            setProgress(5, 'Создание ресторана…');
            const { data, error } = await getDB().from('restaurants').insert({ name: state.restaurantName }).select().single();
            if (error) throw new Error('Ресторан: ' + error.message);
            restaurantId = data.id;
            addLog(`✓ Ресторан "${state.restaurantName}" создан (ID ${restaurantId})`, 'ok');
            state.restaurantId = restaurantId;
            await loadRestaurants();
        }

        // 2. Период (только для выплат)
        let periodId = null;
        if (state.dataType === 'payroll') {
            setProgress(10, 'Поиск/создание периода…');
            const periodLabel = state.periodLabel || `${state.year}`;
            const { data: existPeriod } = await getDB().from('billing_periods')
                .select('id').eq('year', state.year).eq('label', periodLabel).maybeSingle();

            if (existPeriod) {
                periodId = existPeriod.id;
                addLog(`✓ Период найден: "${periodLabel} ${state.year}" (ID ${periodId})`, 'ok');
            } else {
                const { data: newPeriod, error: errP } = await getDB().from('billing_periods')
                    .insert({ year: state.year, label: periodLabel }).select().single();
                if (errP) throw new Error('Период: ' + errP.message);
                periodId = newPeriod.id;
                addLog(`✓ Период создан: "${periodLabel} ${state.year}" (ID ${periodId})`, 'ok');
            }
        }

        // 3. Строки данных
        const total = state.sheetData.length;
        let ok = 0, skipped = 0, errors = 0;

        for (let i = 0; i < state.sheetData.length; i++) {
            const row = state.sheetData[i];
            const pct = 15 + Math.round((i / total) * 80);
            setProgress(pct, `Обработка строк: ${i + 1} / ${total}`);

            const get = key => {
                const idx = state.mapping[key];
                if (idx === null || idx === undefined) return null;
                const val = row[idx];
                return val === '' || val === null || val === undefined ? null : val;
            };

            const name = get('employee_name');
            if (!name) { skipped++; continue; }

            const inn = get('inn') ? String(get('inn')).replace(/\D/g, '') : null;

            try {
                // Upsert employee
                const empData = { full_name: String(name).trim() };
                if (get('phone'))       empData.phone       = String(get('phone')).trim();
                if (get('citizenship')) empData.citizenship = String(get('citizenship')).trim();
                if (get('position'))    empData.position    = String(get('position')).trim();
                if (get('city'))        empData.city        = String(get('city')).trim();
                if (inn)                empData.inn         = inn;

                let employeeId;
                if (inn) {
                    const { data: emp, error: empErr } = await getDB().from('employees')
                        .upsert(empData, { onConflict: 'inn', ignoreDuplicates: false })
                        .select('id').single();
                    if (empErr) throw empErr;
                    employeeId = emp.id;
                } else {
                    // No INN — find by name or insert
                    const { data: existEmp } = await getDB().from('employees')
                        .select('id').eq('full_name', empData.full_name).maybeSingle();
                    if (existEmp) {
                        employeeId = existEmp.id;
                    } else {
                        const { data: newEmp, error: newEmpErr } = await getDB().from('employees')
                            .insert(empData).select('id').single();
                        if (newEmpErr) throw newEmpErr;
                        employeeId = newEmp.id;
                    }
                }

                if (state.dataType === 'payroll') {
                    // Insert payroll record
                    const pr = { employee_id: employeeId, billing_period_id: periodId };
                    const parseNum = v => v !== null ? parseFloat(String(v).replace(',', '.')) || null : null;
                    if (get('registry_amount') !== null) pr.registry_amount = parseNum(get('registry_amount'));
                    if (get('deduction')       !== null) pr.deduction       = parseNum(get('deduction'));
                    if (get('after_deduction') !== null) pr.after_deduction = parseNum(get('after_deduction'));
                    if (get('platform_fee')    !== null) pr.platform_fee    = parseNum(get('platform_fee'));
                    if (get('total_payout')    !== null) pr.total_payout    = parseNum(get('total_payout'));
                    if (get('status')          !== null) pr.status          = String(get('status')).trim();
                    if (get('comment')         !== null) pr.comment         = String(get('comment')).trim();

                    const { error: prErr } = await getDB().from('payroll_records').insert(pr);
                    if (prErr) throw prErr;

                    // Upsert salary_sheet (employee → restaurant)
                    await getDB().from('salary_sheets').upsert(
                        { employee_id: employeeId, restaurant_id: restaurantId, billing_period_id: periodId },
                        { onConflict: 'employee_id,billing_period_id', ignoreDuplicates: true }
                    );

                } else {
                    // Upsert employee_document
                    const doc = { employee_id: employeeId };
                    const parseDate = v => {
                        if (!v) return null;
                        if (v instanceof Date) return v.toISOString().split('T')[0];
                        const s = String(v).trim();
                        // DD.MM.YYYY
                        const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
                        if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
                        return s || null;
                    };
                    if (get('doc_status')           !== null) doc.doc_status           = String(get('doc_status')).trim();
                    if (get('patent_series')         !== null) doc.patent_series        = String(get('patent_series')).trim();
                    if (get('patent_number')         !== null) doc.patent_number        = String(get('patent_number')).trim();
                    if (get('form_series')           !== null) doc.form_series          = String(get('form_series')).trim();
                    if (get('form_number')           !== null) doc.form_number          = String(get('form_number')).trim();
                    if (get('passport_issued_at')    !== null) doc.passport_issued_at   = parseDate(get('passport_issued_at'));
                    if (get('registration_end_at')   !== null) doc.registration_end_at  = parseDate(get('registration_end_at'));
                    if (get('patent_issued_at')      !== null) doc.patent_issued_at     = parseDate(get('patent_issued_at'));
                    if (get('contract_date')         !== null) doc.contract_date        = parseDate(get('contract_date'));
                    if (get('doc_link')              !== null) doc.doc_link             = String(get('doc_link')).trim();
                    if (get('contract_link')         !== null) doc.contract_link        = String(get('contract_link')).trim();
                    if (get('issues')                !== null) doc.issues               = String(get('issues')).trim();

                    // Employee fields to update
                    const empUpdate = {};
                    if (get('birth_date'))   empUpdate.birth_date   = parseDate(get('birth_date'));
                    if (get('passport_data')) empUpdate.passport_data = String(get('passport_data')).trim();
                    if (get('fired_at'))     empUpdate.fired_at     = parseDate(get('fired_at'));
                    if (Object.keys(empUpdate).length) {
                        await getDB().from('employees').update(empUpdate).eq('id', employeeId);
                    }

                    const { data: existDoc } = await getDB().from('employee_documents')
                        .select('id').eq('employee_id', employeeId).maybeSingle();
                    if (existDoc) {
                        await getDB().from('employee_documents').update(doc).eq('id', existDoc.id);
                    } else {
                        await getDB().from('employee_documents').insert(doc);
                    }

                    // salary_sheet
                    await getDB().from('salary_sheets').upsert(
                        { employee_id: employeeId, restaurant_id: restaurantId },
                        { onConflict: 'employee_id,restaurant_id', ignoreDuplicates: true }
                    );
                }

                ok++;
                if (ok % 10 === 0) addLog(`${ok} записей обработано…`);
            } catch (rowErr) {
                errors++;
                addLog(`✗ Строка ${i + 2}: ${rowErr.message}`, 'err');
            }
        }

        setProgress(100, 'Готово');
        addLog(`─────────────────────────────────────`, '');
        addLog(`✓ Успешно: ${ok}  |  Пропущено: ${skipped}  |  Ошибок: ${errors}`, errors > 0 ? 'err' : 'ok');

        const resultEl = document.getElementById('import-result');
        showAlert(resultEl, errors === 0 ? 'ok' : 'err',
            `Импорт завершён: ${ok} записей успешно, ${skipped} пропущено, ${errors} ошибок`);

        document.getElementById('btn-start-import').classList.add('hidden');
        document.getElementById('btn-new-import').classList.remove('hidden');

    } catch (err) {
        setProgress(0, 'Ошибка');
        addLog('✗ Критическая ошибка: ' + err.message, 'err');
        const resultEl = document.getElementById('import-result');
        showAlert(resultEl, 'err', 'Ошибка импорта: ' + err.message);
        document.getElementById('btn-start-import').disabled = false;
        document.getElementById('btn-back-3').disabled = false;
    }
}

function resetImport() {
    state.workbook = null;
    state.sheetData = [];
    state.headers = [];
    state.mapping = {};
    state.restaurantId = null;
    state.restaurantName = '';

    // Reset UI
    const dz = document.getElementById('dropzone');
    dz.classList.remove('has-file');
    dz.innerHTML = `<i class="fas fa-file-excel"></i><div class="dz-title">Нажмите или перетащите файл</div><div class="dz-sub">Поддерживаются .xlsx, .xls, .csv</div>`;
    document.getElementById('sheet-selector-row').classList.add('hidden');
    document.getElementById('btn-step2-next').classList.add('hidden');
    document.getElementById('import-progress').style.display = 'none';
    document.getElementById('import-result').classList.remove('show');
    document.getElementById('btn-start-import').classList.remove('hidden');
    document.getElementById('btn-start-import').disabled = false;
    document.getElementById('btn-back-3').disabled = false;
    document.getElementById('btn-new-import').classList.add('hidden');
    document.getElementById('prog-log').innerHTML = '';
    document.getElementById('prog-bar').style.width = '0%';
    document.getElementById('inp-period-label').value = '';
    document.getElementById('sel-restaurant').value = '';
    document.getElementById('inp-new-restaurant').value = '';

    goStep(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showAlert(el, type, msg) {
    el.className = `alert alert-${type} show`;
    el.innerHTML = `<i class="fas fa-${type === 'ok' ? 'check-circle' : type === 'err' ? 'times-circle' : 'info-circle'}"></i> ${msg}`;
}
