// admin.js — Панель администратора (встроена в основное приложение)

// ─── Состояние ────────────────────────────────────────────────────────────────
const _adm = {
    step:        1,
    headers:     [],
    rows:        [],      // все строки данных
    mapping:     {},      // dbField → colIndex | null
    restaurant:  '',
    year:        new Date().getFullYear(),
    dataType:    'payroll',
    metrics:     ['totalFund', 'employeeCount', 'avgPayment', 'paidPercent'],
    chartType:   'bar',
};

// ─── Описание полей БД ────────────────────────────────────────────────────────
const PAYROLL_FIELDS = [
    { key: 'employee_name',  label: 'ФИО сотрудника',      required: true,  table: 'employees' },
    { key: 'inn',            label: 'ИНН',                  required: false, table: 'employees' },
    { key: 'phone',          label: 'Телефон',              required: false, table: 'employees' },
    { key: 'citizenship',    label: 'Гражданство',          required: false, table: 'employees' },
    { key: 'position',       label: 'Должность',            required: false, table: 'employees' },
    { key: 'city',           label: 'Город',                required: false, table: 'employees' },
    { key: 'period_label',   label: 'Период',               required: true,  table: 'billing_periods' },
    { key: 'total_payout',   label: 'К выплате',            required: true,  table: 'payroll_records' },
    { key: 'registry_amount',label: 'Сумма в реестре',      required: false, table: 'payroll_records' },
    { key: 'deduction',      label: 'Удержание',            required: false, table: 'payroll_records' },
    { key: 'after_deduction',label: 'После удержания',      required: false, table: 'payroll_records' },
    { key: 'platform_fee',   label: 'Комиссия платформы',   required: false, table: 'payroll_records' },
    { key: 'status',         label: 'Статус выплаты',       required: false, table: 'payroll_records' },
    { key: 'comment',        label: 'Комментарий',          required: false, table: 'payroll_records' },
];

const DOC_FIELDS = [
    { key: 'employee_name',       label: 'ФИО сотрудника',    required: true,  table: 'employees' },
    { key: 'inn',                 label: 'ИНН',                required: false, table: 'employees' },
    { key: 'phone',               label: 'Телефон',            required: false, table: 'employees' },
    { key: 'citizenship',         label: 'Гражданство',        required: false, table: 'employees' },
    { key: 'position',            label: 'Должность',          required: false, table: 'employees' },
    { key: 'birth_date',          label: 'Дата рождения',      required: false, table: 'employees' },
    { key: 'passport_data',       label: 'Паспортные данные',  required: false, table: 'employees' },
    { key: 'fired_at',            label: 'Дата увольнения',    required: false, table: 'employees' },
    { key: 'doc_status',          label: 'Статус документов',  required: false, table: 'employee_documents' },
    { key: 'patent_series',       label: 'Серия патента',      required: false, table: 'employee_documents' },
    { key: 'patent_number',       label: 'Номер патента',      required: false, table: 'employee_documents' },
    { key: 'registration_end_at', label: 'Конец регистрации',  required: false, table: 'employee_documents' },
    { key: 'patent_issued_at',    label: 'Дата выдачи патента',required: false, table: 'employee_documents' },
    { key: 'contract_date',       label: 'Дата договора',      required: false, table: 'employee_documents' },
    { key: 'doc_link',            label: 'Ссылка на документы',required: false, table: 'employee_documents' },
    { key: 'contract_link',       label: 'Ссылка на договор',  required: false, table: 'employee_documents' },
    { key: 'issues',              label: 'Проблемы',           required: false, table: 'employee_documents' },
];

const AUTO_DETECT = {
    // Multi-word / specific phrases first to prevent partial false-matches
    employee_name:        ['ф.и.о', 'полное имя', 'фамилия имя', 'фио', 'сотрудник', 'работник', 'full_name', 'fullname', 'name'],
    inn:                  ['инн', 'и.н.н', 'inn'],
    phone:                ['телефон', 'мобильный', 'моб.', 'phone', 'тел.'],
    citizenship:          ['гражданство', 'citizenship', 'гражд'],
    position:             ['должность', 'специальн', 'профессия', 'position'],
    city:                 ['город', 'city', 'регион', 'место работы'],
    period_label:         ['за период', 'расчетный период', 'расч. период', 'период', 'period'],
    total_payout:         ['к выплате', 'итого к выплате', 'на руки', 'к оплате', 'факт выплаты', 'выплата', 'total_payout', 'payout'],
    registry_amount:      ['сумма в реестре', 'начислено', 'начисл', 'реестр', 'оклад', 'тариф', 'registry', 'gross'],
    deduction:            ['удержание', 'вычет', 'удерж', 'ндфл', 'deduction'],
    after_deduction:      ['после удержания', 'чистая сумма', 'нетто', 'after_deduction', 'net'],
    platform_fee:         ['комиссия платформы', 'агентское', 'platform_fee', 'fee', 'комиссия'],
    status:               ['статус выплаты', 'статус оплаты', 'оплачен', 'выплачен', 'status', 'paid', 'статус'],
    comment:              ['комментарий', 'примечание', 'заметки', 'comment', 'remarks', 'note'],
    doc_status:           ['статус документ', 'статус оформ', 'оформлен', 'доки'],
    patent_series:        ['серия патент', 'серия пат'],
    patent_number:        ['номер патент', '№ патент', 'patent_number'],
    registration_end_at:  ['конец регистр', 'регистрация до', 'прописка до', 'registration_end', 'рег. до'],
    patent_issued_at:     ['дата выдачи патент', 'выдачи патент', 'patent_issued'],
    contract_date:        ['дата договор', 'дата контракт', 'дата подписания', 'contract_date'],
    doc_link:             ['ссылка на доки', 'ссылка документ', 'doc_link'],
    contract_link:        ['ссылка договор', 'скан договора', 'contract_link'],
    issues:               ['проблем', 'замечание', 'нарушение', 'issue'],
    birth_date:           ['дата рождения', 'день рождения', 'д.р.', 'birth'],
    passport_data:        ['паспортные данные', 'данные паспорта', 'паспорт', 'passport'],
    fired_at:             ['дата увольнения', 'уволен', 'fired'],
};

const ADM_METRICS = [
    { id: 'totalFund',     label: 'Фонд зарплаты',        icon: 'fa-ruble-sign' },
    { id: 'employeeCount', label: 'Сотрудников',           icon: 'fa-users' },
    { id: 'avgPayment',    label: 'Средняя выплата',       icon: 'fa-chart-line' },
    { id: 'paidPercent',   label: '% оплаченных',          icon: 'fa-check-circle' },
    { id: 'periodCount',   label: 'Кол-во периодов',       icon: 'fa-calendar-alt' },
    { id: 'maxPayment',    label: 'Максимальная выплата',  icon: 'fa-arrow-up' },
];

// ─── Entry point ──────────────────────────────────────────────────────────────
function initAdminScreen() {
    const screen = document.getElementById('admin-screen');
    if (!screen) return;

    screen.innerHTML = `
        <header>
            <h1><i class="fas fa-database"></i> Администрирование</h1>
            <p class="subtitle">Импорт данных и управление ресторанами</p>
        </header>
        <div class="adm-tabs">
            <button class="adm-tab active" data-tab="import"><i class="fas fa-file-upload"></i> Импорт данных</button>
            <button class="adm-tab" data-tab="restaurants"><i class="fas fa-store"></i> Рестораны</button>
            <button class="adm-tab" data-tab="users"><i class="fas fa-users-cog"></i> Пользователи</button>
        </div>
        <div id="adm-import-panel"></div>
        <div id="adm-restaurants-panel" class="hidden"></div>
        <div id="adm-users-panel" class="hidden"></div>
    `;

    screen.querySelectorAll('.adm-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            screen.querySelectorAll('.adm-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('adm-import-panel').classList.toggle('hidden', btn.dataset.tab !== 'import');
            document.getElementById('adm-restaurants-panel').classList.toggle('hidden', btn.dataset.tab !== 'restaurants');
            document.getElementById('adm-users-panel').classList.toggle('hidden', btn.dataset.tab !== 'users');
            if (btn.dataset.tab === 'restaurants') _admLoadRestaurants();
            if (btn.dataset.tab === 'users') _admLoadUsers();
        });
    });

    Object.assign(_adm, { step:1, headers:[], rows:[], mapping:{}, restaurant:'', year:new Date().getFullYear(), dataType:'payroll' });
    _admGoStep(1);
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function _admGoStep(n) {
    _adm.step = n;
    const panel = document.getElementById('adm-import-panel');
    if (!panel) return;

    const stepLabels = ['Загрузка файла', 'Настройка', 'Предпросмотр', 'Импорт'];
    const stepper = stepLabels.map((l, i) => {
        const s = i + 1;
        const cls = s < n ? 'done' : s === n ? 'active' : '';
        return `<div class="adm-step ${cls}"><span class="adm-step-num">${s < n ? '✓' : s}</span><span class="adm-step-lbl">${l}</span></div>${s < 4 ? '<div class="adm-step-line' + (s < n ? ' done' : '') + '"></div>' : ''}`;
    }).join('');

    panel.innerHTML = `<div class="adm-stepper">${stepper}</div><div id="adm-step-body">${_admStepHTML(n)}</div>`;
    _admBindStep(n);
}

function _admStepHTML(n) {
    const fields = _adm.dataType === 'payroll' ? PAYROLL_FIELDS : DOC_FIELDS;
    switch (n) {
        case 1: return _admStep1HTML();
        case 2: return _admStep2HTML(fields);
        case 3: return _admStep3HTML(fields);
        case 4: return _admStep4HTML();
        default: return '';
    }
}

// ─── Step 1: Upload ───────────────────────────────────────────────────────────
function _admStep1HTML() {
    return `
        <div class="adm-card">
            <h3>Загрузите таблицу с данными</h3>
            <p class="adm-hint">Поддерживаются Excel (.xlsx, .xls) и CSV. Первая строка — заголовки колонок.</p>
            <div class="adm-upload-zone" id="adm-dz">
                <i class="fas fa-file-excel"></i>
                <p>Перетащите файл сюда или нажмите для выбора</p>
                <span>.xlsx · .xls · .csv</span>
                <input type="file" id="adm-file-inp" accept=".xlsx,.xls,.csv" hidden>
            </div>
            <div id="adm-file-info" class="adm-file-info hidden"></div>
            <div class="adm-field" style="margin-top:16px;max-width:200px;">
                <label>Тип данных</label>
                <select id="adm-data-type">
                    <option value="payroll" ${_adm.dataType==='payroll'?'selected':''}>Выплаты</option>
                    <option value="documents" ${_adm.dataType==='documents'?'selected':''}>Документы</option>
                </select>
            </div>
        </div>
    `;
}

function _admBindStep(n) {
    if (n === 1) {
        const dz = document.getElementById('adm-dz');
        const inp = document.getElementById('adm-file-inp');
        dz.addEventListener('click', () => inp.click());
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
        dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) _admHandleFile(f); });
        inp.addEventListener('change', () => { if (inp.files[0]) _admHandleFile(inp.files[0]); });
        document.getElementById('adm-data-type')?.addEventListener('change', e => { _adm.dataType = e.target.value; });
    }
    if (n === 2) {
        document.getElementById('adm-back-1')?.addEventListener('click', () => _admGoStep(1));
        document.getElementById('adm-next-3')?.addEventListener('click', () => {
            _adm.restaurant = document.getElementById('adm-restaurant')?.value.trim() || '';
            _adm.year = parseInt(document.getElementById('adm-year')?.value) || new Date().getFullYear();
            _admReadMapping();
            if (!_adm.restaurant) { alert('Введите название ресторана'); return; }
            const fields = _adm.dataType === 'payroll' ? PAYROLL_FIELDS : DOC_FIELDS;
            const missing = fields.filter(f => f.required && (_adm.mapping[f.key] === null || _adm.mapping[f.key] === undefined));
            if (missing.length) { alert('Укажите колонки для: ' + missing.map(f => f.label).join(', ')); return; }
            _admGoStep(3);
        });
        _admFillRestaurantList();
    }
    if (n === 3) {
        document.getElementById('adm-back-2')?.addEventListener('click', () => _admGoStep(2));
        document.getElementById('adm-next-4')?.addEventListener('click', () => {
            _adm.metrics = [...document.querySelectorAll('.adm-metric-cb:checked')].map(cb => cb.value);
            _adm.chartType = document.querySelector('input[name="adm-chart"]:checked')?.value || 'bar';
            _admGoStep(4);
        });
        document.querySelectorAll('.adm-metric-card').forEach(card => {
            card.addEventListener('click', () => card.classList.toggle('checked', card.querySelector('input').checked));
        });
    }
    if (n === 4) {
        document.getElementById('adm-back-3')?.addEventListener('click', () => _admGoStep(3));
        document.getElementById('adm-do-import')?.addEventListener('click', _admDoImport);
        document.getElementById('adm-restart')?.addEventListener('click', () => initAdminScreen());
    }
}

// ─── File parsing ─────────────────────────────────────────────────────────────
async function _admHandleFile(file) {
    const info = document.getElementById('adm-file-info');
    info.classList.remove('hidden');
    info.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Парсинг ${file.name}…`;

    try {
        if (typeof XLSX === 'undefined') throw new Error('Библиотека SheetJS не загружена');
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { type: 'array', cellDates: true });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (raw.length < 2) throw new Error('Файл пуст или содержит только заголовки');

        _adm.headers = raw[0].map(String);
        _adm.rows    = raw.slice(1).filter(r => r.some(c => c !== ''));
        _adm.mapping = _admAutoDetect(_adm.headers);

        const autoMapped = Object.keys(_adm.mapping).length;
        info.innerHTML = `<i class="fas fa-check-circle" style="color:var(--ok-fg)"></i>
            <strong>${file.name}</strong> — ${_adm.rows.length.toLocaleString('ru-RU')} строк, ${_adm.headers.length} колонок
            <span style="color:var(--tx2);font-size:12px;margin-left:8px;">(авто-распознано: ${autoMapped} / ${_adm.headers.length} колонок)</span>`;

        document.getElementById('adm-dz').classList.add('has-file');
        setTimeout(() => _admGoStep(2), 500);
    } catch (e) {
        info.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:var(--er-fg)"></i> ${e.message}`;
    }
}

function _admAutoDetect(headers) {
    const map = {};
    // Score each (header, field) pair by keyword length (longer = more specific), take best match per field
    const scores = {}; // field -> { idx, score }
    headers.forEach((h, i) => {
        const hl = h.toLowerCase().trim();
        for (const [field, kws] of Object.entries(AUTO_DETECT)) {
            for (const kw of kws) {
                if (hl.includes(kw)) {
                    const score = kw.length;
                    if (!scores[field] || score > scores[field].score) {
                        scores[field] = { idx: i, score };
                    }
                    break; // first matching keyword in priority order is enough
                }
            }
        }
    });
    for (const [field, { idx }] of Object.entries(scores)) map[field] = idx;
    return map;
}

// ─── Step 2: Config + mapping ─────────────────────────────────────────────────
function _admStep2HTML(fields) {
    const sample = _adm.rows[0] || [];
    const opts = ['<option value="">— не использовать —</option>',
        ..._adm.headers.map((h, i) => `<option value="${i}">${h}</option>`)].join('');

    const mapRows = fields.map(f => {
        const sel = _adm.mapping[f.key];
        const selOpts = opts.replace(`value="${sel}"`, `value="${sel}" selected`);
        const sval = sel != null ? String(sample[sel] ?? '').slice(0, 35) : '';
        return `<tr class="${f.required ? 'adm-required-row' : ''}">
            <td>
                <span class="adm-field-label">${f.label}${f.required ? ' <span class="adm-req">*</span>' : ''}</span>
                <span class="adm-field-table">${{ employees:'👤', payroll_records:'💰', billing_periods:'📅', employee_documents:'📄' }[f.table]||''}</span>
            </td>
            <td><select class="adm-map-sel" data-key="${f.key}">${selOpts}</select></td>
            <td class="adm-map-sample" id="adm-sample-${f.key}">${sval}</td>
        </tr>`;
    }).join('');

    return `
        <div class="adm-card">
            <div class="adm-config-grid">
                <div class="adm-field">
                    <label><i class="fas fa-store"></i> Название ресторана</label>
                    <input type="text" id="adm-restaurant" value="${_adm.restaurant}"
                        placeholder="ЧАСОВАЯ / ЧАО / …" list="adm-rest-dl" autocomplete="off">
                    <datalist id="adm-rest-dl"></datalist>
                </div>
                <div class="adm-field">
                    <label><i class="fas fa-calendar"></i> Год</label>
                    <input type="number" id="adm-year" value="${_adm.year}" min="2020" max="2030">
                </div>
            </div>

            <h3 style="margin:20px 0 8px;">Маппинг колонок</h3>
            <p class="adm-hint">Выберите, какая колонка файла соответствует каждому полю. Пример значения показывается из первой строки.</p>
            <div class="table-wrapper" style="max-height:340px;overflow-y:auto;">
                <table class="data-table adm-map-table">
                    <thead><tr><th>Поле системы</th><th>Колонка в файле</th><th>Пример</th></tr></thead>
                    <tbody>${mapRows}</tbody>
                </table>
            </div>
            <div class="adm-actions">
                <button class="btn btn-secondary" id="adm-back-1"><i class="fas fa-arrow-left"></i> Назад</button>
                <button class="btn btn-primary" id="adm-next-3">Предпросмотр <i class="fas fa-arrow-right"></i></button>
            </div>
        </div>
    `;
}

function _admReadMapping() {
    document.querySelectorAll('.adm-map-sel').forEach(sel => {
        _adm.mapping[sel.dataset.key] = sel.value === '' ? null : parseInt(sel.value);
    });
}

async function _admFillRestaurantList() {
    const dl = document.getElementById('adm-rest-dl');
    if (!dl) return;
    const db = getSupabaseClient();
    if (!db) return;
    const { data } = await db.from('restaurants').select('name').order('name');
    (data || []).forEach(r => { const o = document.createElement('option'); o.value = r.name; dl.appendChild(o); });

    // Update sample values when mapping changes
    document.querySelectorAll('.adm-map-sel').forEach(sel => {
        sel.addEventListener('change', () => {
            const s = document.getElementById('adm-sample-' + sel.dataset.key);
            const sample = _adm.rows[0] || [];
            if (s) s.textContent = sel.value !== '' ? String(sample[parseInt(sel.value)] ?? '').slice(0, 35) : '';
        });
    });
}

// ─── Step 3: Preview + Metrics ────────────────────────────────────────────────
function _admStep3HTML(fields) {
    const get = (row, key) => _adm.mapping[key] != null ? String(row[_adm.mapping[key]] ?? '').trim() : '';
    const mapped = fields.filter(f => _adm.mapping[f.key] != null);
    const preview = _adm.rows.slice(0, 12);

    const uniqueEmps = new Set(_adm.rows.map(r => get(r,'inn') || get(r,'employee_name')).filter(Boolean));
    const uniquePers = new Set(_adm.rows.map(r => get(r,'period_label')).filter(Boolean));

    return `
        <div class="adm-card">
            <div class="adm-preview-stats">
                <div class="adm-pstat"><strong>${_adm.rows.length.toLocaleString('ru-RU')}</strong><span>строк</span></div>
                <div class="adm-pstat"><strong>${uniqueEmps.size}</strong><span>сотрудников</span></div>
                <div class="adm-pstat"><strong>${uniquePers.size || '—'}</strong><span>периодов</span></div>
                <div class="adm-pstat"><strong>${_adm.restaurant}</strong><span>ресторан</span></div>
            </div>

            <div class="table-wrapper" style="max-height:280px;overflow-y:auto;margin-bottom:20px;">
                <table class="data-table">
                    <thead><tr>${mapped.map(f => `<th>${f.label}</th>`).join('')}</tr></thead>
                    <tbody>${preview.map(row => `<tr>${mapped.map(f => `<td>${get(row,f.key)}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
            </div>

            <h3>Метрики дашборда</h3>
            <p class="adm-hint">Выберите, какие показатели будут отображаться на странице ресторана «${_adm.restaurant}»</p>
            <div class="adm-metrics-grid">
                ${ADM_METRICS.map(m => `
                <label class="adm-metric-card ${_adm.metrics.includes(m.id)?'checked':''}">
                    <input type="checkbox" class="adm-metric-cb" value="${m.id}" ${_adm.metrics.includes(m.id)?'checked':''}>
                    <i class="fas ${m.icon}"></i><span>${m.label}</span>
                </label>`).join('')}
            </div>

            <h3 style="margin-top:18px;">Тип графика</h3>
            <div class="adm-chart-types">
                ${[['bar','Столбчатый','fa-chart-bar'],['line','Линейный','fa-chart-line']].map(([v,l,ic]) => `
                <label class="adm-chart-card ${_adm.chartType===v?'checked':''}">
                    <input type="radio" name="adm-chart" value="${v}" ${_adm.chartType===v?'checked':''}>
                    <i class="fas ${ic}"></i> ${l}
                </label>`).join('')}
            </div>

            <div class="adm-actions">
                <button class="btn btn-secondary" id="adm-back-2"><i class="fas fa-arrow-left"></i> Назад</button>
                <button class="btn btn-primary" id="adm-next-4">Начать импорт <i class="fas fa-arrow-right"></i></button>
            </div>
        </div>
    `;
}

// ─── Step 4: Import ───────────────────────────────────────────────────────────
function _admStep4HTML() {
    return `
        <div class="adm-card">
            <h3>Импорт данных</h3>
            <div class="adm-import-summary">
                <span><i class="fas fa-store"></i> ${_adm.restaurant}</span>
                <span><i class="fas fa-calendar"></i> ${_adm.year} г.</span>
                <span><i class="fas fa-table"></i> ${_adm.rows.length.toLocaleString('ru-RU')} строк</span>
                <span><i class="fas fa-${_adm.dataType==='payroll'?'ruble-sign':'file-alt'}"></i> ${_adm.dataType==='payroll'?'Выплаты':'Документы'}</span>
            </div>
            <div class="adm-progress-wrap hidden" id="adm-prog-wrap">
                <div class="adm-prog-bg"><div class="adm-prog-bar" id="adm-prog-bar" style="width:0%"></div></div>
                <div class="adm-prog-status" id="adm-prog-status">Подготовка…</div>
                <div class="adm-prog-log" id="adm-prog-log"></div>
            </div>
            <div id="adm-import-result" class="hidden"></div>
            <div class="adm-actions">
                <button class="btn btn-secondary" id="adm-back-3"><i class="fas fa-arrow-left"></i> Назад</button>
                <button class="btn btn-primary" id="adm-do-import"><i class="fas fa-upload"></i> Импортировать</button>
                <button class="btn btn-secondary hidden" id="adm-restart"><i class="fas fa-redo"></i> Новый импорт</button>
            </div>
        </div>
    `;
}

// ─── Import logic ─────────────────────────────────────────────────────────────
async function _admDoImport() {
    document.getElementById('adm-do-import').disabled = true;
    document.getElementById('adm-back-3').disabled  = true;
    document.getElementById('adm-prog-wrap')?.classList.remove('hidden');

    const setP = (pct, msg) => {
        const b = document.getElementById('adm-prog-bar');
        const s = document.getElementById('adm-prog-status');
        if (b) b.style.width = pct + '%';
        if (s) s.textContent = msg;
    };
    const addLog = (msg, type='') => {
        const log = document.getElementById('adm-prog-log');
        if (!log) return;
        const d = document.createElement('div');
        d.className = 'adm-log-line' + (type ? ' adm-log-'+type : '');
        d.textContent = msg;
        log.appendChild(d);
        log.scrollTop = log.scrollHeight;
    };

    try {
        const stats = await (_adm.dataType === 'payroll'
            ? _admImportPayroll(setP, addLog)
            : _admImportDocs(setP, addLog));

        // Save dashboard config
        localStorage.setItem('restaurant_config_' + _adm.restaurant,
            JSON.stringify({ metrics: _adm.metrics, chartType: _adm.chartType, ts: Date.now() }));

        setP(100, 'Импорт завершён!');
        const res = document.getElementById('adm-import-result');
        if (res) {
            res.classList.remove('hidden');
            res.innerHTML = `<div class="adm-result-ok">
                <i class="fas fa-check-circle"></i>
                <div><strong>Готово!</strong>
                <p>${stats}</p></div></div>`;
        }
        document.getElementById('adm-restart')?.classList.remove('hidden');
        document.getElementById('adm-do-import')?.classList.add('hidden');
        setTimeout(() => loadData(), 1200);
    } catch (e) {
        console.error('[admin import]', e);
        setP(0, '');
        const res = document.getElementById('adm-import-result');
        if (res) { res.classList.remove('hidden'); res.innerHTML = `<div class="adm-result-err"><i class="fas fa-exclamation-triangle"></i> ${e.message}</div>`; }
        document.getElementById('adm-do-import').disabled = false;
        document.getElementById('adm-back-3').disabled  = false;
    }
}

async function _admImportPayroll(setP, addLog) {
    const db = getSupabaseClient();
    if (!db) throw new Error('Нет подключения к базе данных');
    const get = (row, key) => _adm.mapping[key] != null ? String(row[_adm.mapping[key]] ?? '').trim() : '';
    const parseNum = v => v ? parseFloat(String(v).replace(/[\s,]/g,'').replace(',','.')) || null : null;

    setP(5, 'Создание/поиск ресторана…');
    const { data: rr } = await db.from('restaurants').select('id').eq('name', _adm.restaurant).limit(1);
    let restaurantId;
    if (rr?.length) { restaurantId = rr[0].id; }
    else {
        const { data: nr, error: re } = await db.from('restaurants').insert({ name: _adm.restaurant }).select('id').single();
        if (re) throw new Error('Ресторан: ' + re.message);
        restaurantId = nr.id;
        addLog(`✓ Ресторан "${_adm.restaurant}" создан`, 'ok');
    }

    setP(10, 'Загрузка сотрудников…');
    const { data: existEmps } = await db.from('employees').select('id, full_name, inn');
    const empByInn  = {};
    const empByName = {};
    (existEmps || []).forEach(e => { if (e.inn) empByInn[e.inn] = e.id; if (e.full_name) empByName[e.full_name] = e.id; });

    setP(15, 'Загрузка периодов…');
    const { data: existPers } = await db.from('billing_periods').select('id, year, label');
    const perMap = {};
    (existPers || []).forEach(p => { perMap[`${p.year}:${p.label}`] = p.id; });

    const total = _adm.rows.length;
    let ok = 0, skipped = 0, errors = 0;

    for (let i = 0; i < _adm.rows.length; i++) {
        const row = _adm.rows[i];
        if (i % 50 === 0) setP(20 + Math.round(i / total * 75), `Строка ${i+1} / ${total}…`);

        const name = get(row, 'employee_name');
        if (!name) { skipped++; continue; }
        const inn = get(row, 'inn').replace(/\D/g,'') || null;

        try {
            // Employee
            let empId = (inn && empByInn[inn]) || empByName[name];
            if (!empId) {
                const empData = { full_name: name };
                if (inn) empData.inn = inn;
                if (get(row,'phone'))       empData.phone       = get(row,'phone');
                if (get(row,'citizenship')) empData.citizenship = get(row,'citizenship');
                if (get(row,'position'))    empData.position    = get(row,'position');
                if (get(row,'city'))        empData.city        = get(row,'city');

                const { data: ne, error: ee } = await db.from('employees').insert(empData).select('id').single();
                if (ee) throw ee;
                empId = ne.id;
                if (inn) empByInn[inn] = empId; else empByName[name] = empId;
            }

            // Period
            const periodLabel = get(row, 'period_label');
            const pk = `${_adm.year}:${periodLabel}`;
            if (periodLabel && !perMap[pk]) {
                const pd = _admParsePeriod(periodLabel, _adm.year);
                const { data: np, error: pe } = await db.from('billing_periods').insert({ year: _adm.year, label: periodLabel, ...pd }).select('id').single();
                if (pe) throw pe;
                perMap[pk] = np.id;
            }
            const periodId = periodLabel ? perMap[pk] : null;
            if (!periodId) { skipped++; continue; }

            // Payroll record
            const pr = { employee_id: empId, period_id: periodId };
            const tp = parseNum(get(row,'total_payout'));
            const ra = parseNum(get(row,'registry_amount'));
            if (tp != null) pr.total_payout    = tp;
            if (ra != null) pr.registry_amount = ra;
            const ded = parseNum(get(row,'deduction')); if (ded != null) pr.deduction = ded;
            const ad  = parseNum(get(row,'after_deduction')); if (ad != null) pr.after_deduction = ad;
            const pf  = parseNum(get(row,'platform_fee')); if (pf != null) pr.platform_fee = pf;
            const st = get(row,'status');    if (st)  pr.status  = st;
            const cm = get(row,'comment');   if (cm)  pr.comment = cm;

            const { error: prErr } = await db.from('payroll_records').insert(pr);
            if (prErr) throw prErr;

            // Salary sheet
            await db.from('salary_sheets').insert({ employee_id: empId, restaurant_id: restaurantId, period_id: periodId, amount: tp || 0 });

            ok++;
        } catch (rowErr) {
            errors++;
            if (errors <= 5) addLog(`✗ Строка ${i+2}: ${rowErr.message}`, 'err');
        }
    }

    addLog(`Итого: ${ok} успешно · ${skipped} пропущено · ${errors} ошибок`, errors ? 'err' : 'ok');
    return `${ok} записей выплат импортировано. Новый ресторан: ${_adm.restaurant}`;
}

async function _admImportDocs(setP, addLog) {
    const db = getSupabaseClient();
    if (!db) throw new Error('Нет подключения к базе данных');
    const get = (row, key) => _adm.mapping[key] != null ? String(row[_adm.mapping[key]] ?? '').trim() : '';
    const parseDate = v => {
        if (!v) return null;
        if (v instanceof Date) return v.toISOString().split('T')[0];
        const s = String(v).trim();
        const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
        return s || null;
    };

    setP(5, 'Создание/поиск ресторана…');
    const { data: rr } = await db.from('restaurants').select('id').eq('name', _adm.restaurant).limit(1);
    let restaurantId;
    if (rr?.length) { restaurantId = rr[0].id; }
    else {
        const { data: nr, error: re } = await db.from('restaurants').insert({ name: _adm.restaurant }).select('id').single();
        if (re) throw new Error('Ресторан: ' + re.message);
        restaurantId = nr.id;
    }

    setP(10, 'Загрузка сотрудников…');
    const { data: existEmps } = await db.from('employees').select('id, full_name, inn');
    const empByInn  = {};
    const empByName = {};
    (existEmps || []).forEach(e => { if (e.inn) empByInn[e.inn] = e.id; if (e.full_name) empByName[e.full_name] = e.id; });

    const total = _adm.rows.length;
    let ok = 0, skipped = 0, errors = 0;

    for (let i = 0; i < _adm.rows.length; i++) {
        const row = _adm.rows[i];
        if (i % 30 === 0) setP(15 + Math.round(i / total * 80), `Строка ${i+1} / ${total}…`);

        const name = get(row, 'employee_name');
        if (!name) { skipped++; continue; }
        const inn = get(row, 'inn').replace(/\D/g,'') || null;

        try {
            let empId = (inn && empByInn[inn]) || empByName[name];
            if (!empId) {
                const empData = { full_name: name };
                if (inn) empData.inn = inn;
                if (get(row,'phone'))       empData.phone       = get(row,'phone');
                if (get(row,'citizenship')) empData.citizenship = get(row,'citizenship');
                if (get(row,'position'))    empData.position    = get(row,'position');
                if (get(row,'city'))        empData.city        = get(row,'city');
                const { data: ne, error: ee } = await db.from('employees').insert(empData).select('id').single();
                if (ee) throw ee;
                empId = ne.id;
                if (inn) empByInn[inn] = empId; else empByName[name] = empId;
            }

            const empUpd = {};
            const bd = parseDate(get(row,'birth_date')); if (bd) empUpd.birth_date = bd;
            const pp = get(row,'passport_data'); if (pp) empUpd.passport_data = pp;
            const fa = parseDate(get(row,'fired_at')); if (fa) empUpd.fired_at = fa;
            if (Object.keys(empUpd).length) await db.from('employees').update(empUpd).eq('id', empId);

            const doc = { employee_id: empId };
            const docFields = ['doc_status','patent_series','patent_number','doc_link','contract_link','issues'];
            const docDates  = ['registration_end_at','patent_issued_at','contract_date'];
            docFields.forEach(k => { const v = get(row,k); if (v) doc[k] = v; });
            docDates.forEach(k  => { const v = parseDate(get(row,k)); if (v) doc[k] = v; });

            const { data: ed } = await db.from('employee_documents').select('id').eq('employee_id', empId).limit(1);
            if (ed?.length) {
                await db.from('employee_documents').update(doc).eq('id', ed[0].id);
            } else {
                await db.from('employee_documents').insert(doc);
            }

            await db.from('salary_sheets').insert({ employee_id: empId, restaurant_id: restaurantId });
            ok++;
        } catch (rowErr) {
            errors++;
            if (errors <= 5) addLog(`✗ Строка ${i+2}: ${rowErr.message}`, 'err');
        }
    }

    addLog(`Итого: ${ok} успешно · ${skipped} пропущено · ${errors} ошибок`, errors ? 'err' : 'ok');
    return `${ok} документов импортировано`;
}

function _admParsePeriod(label, year) {
    const clean = label.replace(/\s/g,'');
    const parts = clean.split(/[-–]/);
    if (parts.length < 2) return { month: 1, period_start: null, period_end: null };
    const [a, b] = parts;
    const [sd, sm] = a.split('.').map(Number);
    const [ed, em] = b.split('.').map(Number);
    if (!sd || !sm) return { month: sm||1, period_start: null, period_end: null };
    const pad = n => String(n).padStart(2,'0');
    return { month: sm, period_start: `${year}-${pad(sm)}-${pad(sd)}`, period_end: `${year}-${pad(em||sm)}-${pad(ed||sd)}` };
}

// ─── Restaurants tab ──────────────────────────────────────────────────────────
async function _admLoadRestaurants() {
    const cont = document.getElementById('adm-restaurants-panel');
    if (!cont) return;
    cont.innerHTML = `<div class="loading"><div class="spinner"></div><p>Загрузка…</p></div>`;

    const db = getSupabaseClient();
    if (!db) { cont.innerHTML = `<div class="adm-card"><p style="color:var(--er-fg)">Нет подключения к базе данных</p></div>`; return; }

    const { data: rests, error } = await db.from('restaurants').select('id, name').order('name');

    if (error) {
        cont.innerHTML = `<div class="adm-card"><p style="color:var(--er-fg)">Ошибка загрузки: ${error.message}</p></div>`;
        return;
    }

    const allRows = (rests || []).map(r => `
        <tr id="rest-row-${r.id}">
            <td><strong>${r.name}</strong></td>
            <td style="white-space:nowrap;text-align:right">
                <button class="btn btn-secondary btn-small" onclick="_admEditConfig('${r.name.replace(/'/g,"\\'")}')">
                    <i class="fas fa-cog"></i> Настройка
                </button>
                <button class="btn btn-secondary btn-small" style="color:var(--er-fg);margin-left:4px"
                    onclick="_admDeleteRestaurant(${r.id},'${r.name.replace(/'/g,"\\'")}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`).join('') || '<tr><td colspan="2" style="color:var(--tx3);text-align:center;padding:20px">Нет ресторанов в базе</td></tr>';

    cont.innerHTML = `
        <div class="adm-card">
            <h3>Рестораны в базе <span style="font-weight:400;color:var(--tx3);font-size:13px">(${(rests||[]).length} шт.)</span></h3>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Название</th><th style="width:160px"></th></tr></thead>
                    <tbody id="adm-rest-tbody">${allRows}</tbody>
                </table>
            </div>
        </div>
        <div class="adm-card">
            <h3>Добавить ресторан</h3>
            <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
                <div class="adm-field" style="min-width:220px;flex:1">
                    <label>Название</label>
                    <input type="text" id="adm-new-rest-name" placeholder="НАЗВАНИЕ" style="text-transform:uppercase">
                </div>
                <button class="btn btn-primary" onclick="_admCreateRestaurant()">
                    <i class="fas fa-plus"></i> Создать
                </button>
            </div>
            <div id="adm-rest-msg" class="hidden" style="margin-top:12px;font-size:13px"></div>
        </div>
        <div id="adm-edit-config-block" class="hidden"></div>
    `;
}

async function _admCreateRestaurant() {
    const name = document.getElementById('adm-new-rest-name')?.value.trim().toUpperCase();
    const msg  = document.getElementById('adm-rest-msg');
    if (!name) { if (msg) { msg.classList.remove('hidden'); msg.innerHTML = '<span style="color:var(--er-fg)">Введите название</span>'; } return; }
    const db = getSupabaseClient();
    if (!db) return;
    const { data, error } = await db.from('restaurants').insert({ name }).select('id').single();
    if (msg) {
        msg.classList.remove('hidden');
        msg.innerHTML = error
            ? `<span style="color:var(--er-fg)">Ошибка: ${error.message}</span>`
            : `<span style="color:var(--ok-fg)">✓ Ресторан «${name}» создан</span>`;
    }
    if (!error) {
        document.getElementById('adm-new-rest-name').value = '';
        // Добавляем строку в таблицу без полной перезагрузки
        const tbody = document.getElementById('adm-rest-tbody');
        if (tbody) {
            const placeholder = tbody.querySelector('td[colspan]');
            if (placeholder) tbody.innerHTML = '';
            const tr = document.createElement('tr');
            tr.id = `rest-row-${data.id}`;
            tr.innerHTML = `
                <td><strong>${name}</strong></td>
                <td style="white-space:nowrap;text-align:right">
                    <button class="btn btn-secondary btn-small" onclick="_admEditConfig('${name.replace(/'/g,"\\'")}')">
                        <i class="fas fa-cog"></i> Настройка
                    </button>
                    <button class="btn btn-secondary btn-small" style="color:var(--er-fg);margin-left:4px"
                        onclick="_admDeleteRestaurant(${data.id},'${name.replace(/'/g,"\\'")}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>`;
            tbody.appendChild(tr);
            // Обновляем счётчик
            const h3 = document.querySelector('#adm-restaurants-panel .adm-card h3');
            if (h3) {
                const cnt = tbody.querySelectorAll('tr').length;
                h3.innerHTML = `Рестораны в базе <span style="font-weight:400;color:var(--tx3);font-size:13px">(${cnt} шт.)</span>`;
            }
        }
    }
}

async function _admDeleteRestaurant(id, name) {
    if (!confirm(
        `Удалить ресторан «${name}» ПОЛНОСТЬЮ?\n\n` +
        `Будут удалены:\n` +
        `• Все записи выплат (payroll_records)\n` +
        `• Все платёжные ведомости (salary_sheets)\n` +
        `• Все периоды (billing_periods)\n\n` +
        `Данные сотрудников останутся в базе.\n` +
        `Это действие необратимо.`
    )) return;

    const row = document.getElementById(`rest-row-${id}`);
    if (row) row.style.opacity = '0.4';

    const db = getSupabaseClient();
    if (!db) { if (row) row.style.opacity = ''; return; }

    const fail = (msg) => { if (row) row.style.opacity = ''; _admToast('Ошибка: ' + msg); };

    // 1. Получаем employee_id и period_id связанные с этим рестораном
    const { data: sheets, error: sheetsFetchErr } = await db
        .from('salary_sheets')
        .select('employee_id, period_id')
        .eq('restaurant_id', id);
    if (sheetsFetchErr) { fail(sheetsFetchErr.message); return; }

    const empIds    = [...new Set((sheets || []).map(s => s.employee_id).filter(Boolean))];
    const periodIds = [...new Set((sheets || []).map(s => s.period_id).filter(Boolean))];

    // 2. Удаляем payroll_records для этих сотрудников в этих периодах
    if (empIds.length && periodIds.length) {
        const { error: prErr } = await db
            .from('payroll_records')
            .delete()
            .in('employee_id', empIds)
            .in('period_id', periodIds);
        if (prErr) { fail(prErr.message); return; }
    }

    // 3. Удаляем salary_sheets ресторана
    const { error: ssErr } = await db.from('salary_sheets').delete().eq('restaurant_id', id);
    if (ssErr) { fail(ssErr.message); return; }

    // 4. Удаляем периоды, которые больше не используются нигде
    if (periodIds.length) {
        const { data: stillUsed } = await db
            .from('salary_sheets')
            .select('period_id')
            .in('period_id', periodIds);
        const usedIds = new Set((stillUsed || []).map(s => s.period_id));
        const orphanPeriods = periodIds.filter(pid => !usedIds.has(pid));
        if (orphanPeriods.length) {
            const { error: perErr } = await db
                .from('billing_periods')
                .delete()
                .in('id', orphanPeriods);
            if (perErr) { fail(perErr.message); return; }
        }
    }

    // 5. Удаляем сам ресторан
    const { error: restErr } = await db.from('restaurants').delete().eq('id', id);
    if (restErr) { fail(restErr.message); return; }

    // Убираем строку из DOM
    if (row) row.remove();
    if (typeof setRestaurantGroup === 'function') setRestaurantGroup(name, null);
    _admToast(`Ресторан «${name}» и все его данные удалены`);

    const tbody = document.getElementById('adm-rest-tbody');
    const h3    = document.querySelector('#adm-restaurants-panel .adm-card h3');
    if (tbody && h3) {
        const cnt = tbody.querySelectorAll('tr').length;
        h3.innerHTML = `Рестораны в базе <span style="font-weight:400;color:var(--tx3);font-size:13px">(${cnt} шт.)</span>`;
        if (cnt === 0) tbody.innerHTML = '<tr><td colspan="2" style="color:var(--tx3);text-align:center;padding:20px">Нет ресторанов в базе</td></tr>';
    }
}

function _admEditConfig(name) {
    const cfg = JSON.parse(localStorage.getItem('restaurant_config_' + name) || '{}');
    const sel = cfg.metrics || [];
    const chart = cfg.chartType || 'bar';
    const block = document.getElementById('adm-edit-config-block');
    if (!block) return;
    block.classList.remove('hidden');
    block.innerHTML = `
        <div class="adm-card" style="margin-top:16px;">
            <h3>Настройка дашборда — ${name}</h3>
            <div class="adm-metrics-grid">
                ${ADM_METRICS.map(m => `
                <label class="adm-metric-card ${sel.includes(m.id)?'checked':''}">
                    <input type="checkbox" class="adm-re-cb" value="${m.id}" ${sel.includes(m.id)?'checked':''}>
                    <i class="fas ${m.icon}"></i><span>${m.label}</span>
                </label>`).join('')}
            </div>
            <div class="adm-chart-types" style="margin-top:14px;">
                ${[['bar','Столбчатый','fa-chart-bar'],['line','Линейный','fa-chart-line']].map(([v,l,ic]) => `
                <label class="adm-chart-card ${chart===v?'checked':''}">
                    <input type="radio" name="adm-re-chart" value="${v}" ${chart===v?'checked':''}>
                    <i class="fas ${ic}"></i> ${l}
                </label>`).join('')}
            </div>
            <div class="adm-actions" style="margin-top:14px;">
                <button class="btn btn-primary" onclick="_admSaveConfig('${name}')"><i class="fas fa-save"></i> Сохранить</button>
                <button class="btn btn-secondary" onclick="document.getElementById('adm-edit-config-block').classList.add('hidden')">Отмена</button>
            </div>
        </div>`;
    block.scrollIntoView({ behavior: 'smooth' });
    block.querySelectorAll('.adm-metric-card').forEach(c => {
        c.addEventListener('click', () => c.classList.toggle('checked', c.querySelector('input').checked));
    });
}

function _admSaveConfig(name) {
    const metrics = [...document.querySelectorAll('.adm-re-cb:checked')].map(cb => cb.value);
    const chartType = document.querySelector('input[name="adm-re-chart"]:checked')?.value || 'bar';
    localStorage.setItem('restaurant_config_' + name, JSON.stringify({ metrics, chartType, ts: Date.now() }));
    document.getElementById('adm-edit-config-block')?.classList.add('hidden');
    _admToast('Настройки сохранены');
}

function _admLoadUsers() {
    const cont = document.getElementById('adm-users-panel');
    if (!cont) return;

    const systemUsers = typeof AUTH_USERS !== 'undefined' ? AUTH_USERS : [];
    const customUsers = typeof getCustomUsers === 'function' ? getCustomUsers() : [];

    const groupLabel = g => g ? g : 'Все рестораны';
    const groupOpts = `
        <option value="">Все рестораны</option>
        <option value="ЧАЙХАНА">ЧАЙХАНА</option>
        <option value="ЧАО">ЧАО</option>
        <option value="ФРАНКЛИНС">ФРАНКЛИНС</option>
    `;

    const sysRows = systemUsers.map(u => `
        <tr>
            <td><strong>${u.login}</strong></td>
            <td>${u.name}</td>
            <td>${groupLabel(u.group)}</td>
            <td><span class="adm-badge-sys">системный</span></td>
        </tr>`).join('');

    const custRows = customUsers.map(u => `
        <tr>
            <td><strong>${u.login}</strong></td>
            <td>${u.name}</td>
            <td>${groupLabel(u.group)}</td>
            <td>
                <button class="btn btn-secondary btn-small" onclick="_admDeleteUser('${u.login}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`).join('');

    cont.innerHTML = `
        <div class="adm-card">
            <h3>Текущие пользователи</h3>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Логин</th><th>Имя</th><th>Доступ</th><th></th></tr></thead>
                    <tbody>${sysRows}${custRows || '<tr><td colspan="4" style="color:var(--tx3);text-align:center">Нет дополнительных пользователей</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        <div class="adm-card">
            <h3>Добавить пользователя</h3>
            <div class="adm-config-grid" style="grid-template-columns:1fr 1fr 1fr 1fr">
                <div class="adm-field">
                    <label>Логин</label>
                    <input type="text" id="adm-u-login" placeholder="director" autocomplete="off">
                </div>
                <div class="adm-field">
                    <label>Пароль</label>
                    <input type="text" id="adm-u-pass" placeholder="pass2025" autocomplete="off">
                </div>
                <div class="adm-field">
                    <label>Имя / должность</label>
                    <input type="text" id="adm-u-name" placeholder="Руководитель">
                </div>
                <div class="adm-field">
                    <label>Доступ к ресторанам</label>
                    <select id="adm-u-group">${groupOpts}</select>
                </div>
            </div>
            <div class="adm-actions">
                <button class="btn btn-primary" onclick="_admAddUser()">
                    <i class="fas fa-user-plus"></i> Добавить
                </button>
            </div>
            <div id="adm-u-msg" class="hidden" style="margin-top:10px;font-size:13px;"></div>
        </div>
    `;
}

function _admAddUser() {
    const login = document.getElementById('adm-u-login')?.value.trim();
    const pass  = document.getElementById('adm-u-pass')?.value.trim();
    const name  = document.getElementById('adm-u-name')?.value.trim();
    const group = document.getElementById('adm-u-group')?.value || null;
    const msg   = document.getElementById('adm-u-msg');

    if (!login || !pass || !name) {
        if (msg) { msg.className = ''; msg.style.color = 'var(--er-fg)'; msg.textContent = 'Заполните все поля'; }
        return;
    }

    const result = addCustomUser(login, pass, name, group);
    if (msg) {
        msg.className = '';
        msg.style.color = result.ok ? 'var(--ok-fg)' : 'var(--er-fg)';
        msg.textContent = result.ok ? `✓ Пользователь «${login}» добавлен` : result.error;
    }
    if (result.ok) {
        document.getElementById('adm-u-login').value = '';
        document.getElementById('adm-u-pass').value  = '';
        document.getElementById('adm-u-name').value  = '';
        _admLoadUsers();
    }
}

function _admDeleteUser(login) {
    if (!confirm(`Удалить пользователя «${login}»?`)) return;
    removeCustomUser(login);
    _admLoadUsers();
    _admToast(`Пользователь «${login}» удалён`);
}

function _admToast(msg) {
    let t = document.getElementById('adm-toast');
    if (!t) { t = document.createElement('div'); t.id = 'adm-toast'; t.className = 'adm-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── admin.html standalone page functions ─────────────────────────────────────
// Runs only when admin.html is loaded (login-screen element exists)
;(function () {
    if (!document.getElementById('login-screen')) return;

    const ADMIN_USERS = [
        { login: 'admin',   password: '445566',  name: 'Администратор' },
        // Добавьте новых пользователей здесь:
        // { login: 'manager', password: 'pass123', name: 'Менеджер' },
    ];

    window.doLogin = function () {
        const login = document.getElementById('login-username')?.value.trim();
        const pw    = document.getElementById('login-password')?.value;
        const user  = ADMIN_USERS.find(u => u.login === login && u.password === pw);
        if (user) {
            document.getElementById('admin-app').querySelector('.badge').textContent = user.name;
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('admin-app').classList.remove('hidden');
            document.getElementById('login-err').style.display = 'none';
            initAdminScreen();
        } else {
            document.getElementById('login-err').style.display = 'block';
        }
    };

    document.getElementById('login-username')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('login-password')?.focus();
    });

    document.getElementById('login-password')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') window.doLogin();
    });

    window.doLogout = function () {
        document.getElementById('admin-app').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('login-password').value = '';
        document.getElementById('login-err').style.display = 'none';
        document.getElementById('admin-screen').innerHTML = '';
    };
})();
