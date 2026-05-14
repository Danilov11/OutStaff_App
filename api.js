// api.js
// Загрузка данных из Supabase (нормализованная схема)

// ── Supabase клиент ──────────────────────────────────────────────────────────
let _supabaseClient = null;

function getSupabaseClient() {
    if (!_supabaseClient && CONFIG.supabaseUrl && CONFIG.supabaseKey) {
        _supabaseClient = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
    }
    return _supabaseClient;
}

// ── Главная функция загрузки ─────────────────────────────────────────────────
async function loadData() {
    const indicator = document.getElementById('data-loading-indicator');
    if (indicator) indicator.classList.remove('hidden');

    showLoading();
    if (elements.docLoading) elements.docLoading.classList.remove('hidden');

    try {
        if (CONFIG.supabaseUrl && CONFIG.supabaseKey) {
            console.log('[API] Загрузка из Supabase…');
            await loadFromSupabase();
        } else {
            console.log('[API] Supabase не настроен, загрузка из GAS…');
            await loadFromGAS();
        }
    } catch (error) {
        console.error('[API] Ошибка загрузки данных:', error);
        useDemoData();
    } finally {
        if (indicator) indicator.classList.add('hidden');
    }
}

// ── Загрузка из Supabase (нормализованная схема) ─────────────────────────────
async function loadFromSupabase() {
    const db = getSupabaseClient();

    // Параллельные запросы
    const PAYROLL_SELECT = 'id, registry_amount, deduction, after_deduction, platform_fee, total_payout, status, comment, employees(full_name, phone, inn), billing_periods(year, label)';

    const [
        { data: payrollRaw1,   error: errPay1 },
        { data: payrollRaw2,   error: errPay2 },
        { data: docsRaw,       error: errDoc },
        { data: sheetsRaw,     error: errSh  },
        { data: visitsRaw,     error: errVis },
        { data: invoicesRaw,   error: errInv },
        { data: txRaw,         error: errTx  }
    ] = await Promise.all([
        // Выплаты стр.1 (0–999)
        db.from('payroll_records')
          .select(PAYROLL_SELECT)
          .order('id', { ascending: false })
          .range(0, 999),

        // Выплаты стр.2 (1000–1999)
        db.from('payroll_records')
          .select(PAYROLL_SELECT)
          .order('id', { ascending: false })
          .range(1000, 1999),

        // Документы: employee_documents + employees
        db.from('employee_documents')
          .select('id, doc_status, patent_series, patent_number, form_series, form_number, passport_issued_at, registration_end_at, patent_issued_at, contract_date, doc_link, contract_link, issues, vacation, employees(id, full_name, phone, inn, citizenship, position, birth_date, passport_data, fired_at, city, project)')
          .order('id'),

        // Последний ресторан для каждого сотрудника (через salary_sheets)
        db.from('salary_sheets')
          .select('employee_id, restaurants(name)')
          .order('id', { ascending: false }),

        // Объезды: document_visits + employees + restaurants
        db.from('document_visits')
          .select('external_id, director, paper_reason, planned_date, delivery_date, status, admin_deadline, admin_comment, employees(full_name, inn), restaurants(name)')
          .order('id', { ascending: false }),

        // Счета: invoices + billing_periods
        db.from('invoices')
          .select('payroll_fund, revenue, paid, difference, status, comment, billing_periods(year, label)')
          .order('id'),

        // Транзакции: invoice_payments + contractors
        db.from('invoice_payments')
          .select('payment_date, amount, contractors(name)')
          .order('id', { ascending: false })
    ]);

    if (errPay1) throw new Error('payroll_records p1: ' + errPay1.message);
    if (errDoc)  throw new Error('employee_documents: ' + errDoc.message);

    const payrollRaw = [...(payrollRaw1 || []), ...(payrollRaw2 || [])];

    console.log('[Supabase] Выплат:', payrollRaw.length,
                '| Документов:', docsRaw?.length,
                '| Объездов:', visitsRaw?.length);

    // Карта employee_id → название ресторана (последнее)
    const restaurantMap = {};
    (sheetsRaw || []).forEach(s => {
        if (s.employee_id && s.restaurants?.name && !restaurantMap[s.employee_id]) {
            restaurantMap[s.employee_id] = s.restaurants.name;
        }
    });

    const result = {
        // ── Выплаты ────────────────────────────────────────────────────────
        data: (payrollRaw || []).map(p => ({
            year:               p.billing_periods?.year    || new Date().getFullYear(),
            period:             p.billing_periods?.label   || '',
            employee:           p.employees?.full_name     || '',
            phone:              p.employees?.phone         || '',
            inn:                p.employees?.inn           || '',
            amountRegistry:     parseFloat(p.registry_amount)    || 0,
            deduction:          parseFloat(p.deduction)          || 0,
            totalWithDeduction: parseFloat(p.after_deduction)    || 0,
            platformFee:        parseFloat(p.platform_fee)       || 0,
            amount:             parseFloat(p.total_payout)       || 0,
            status:             p.status   || '',
            comment:            p.comment  || ''
        })),

        // ── Документы ──────────────────────────────────────────────────────
        documents: (docsRaw || []).map(d => {
            const emp = d.employees || {};
            return {
                status:              d.doc_status           || '',
                project:             emp.project            || '',
                city:                emp.city               || '',
                position:            emp.position           || '',
                restaurant:          restaurantMap[emp.id]  || '',
                comment:             '',
                rclCheckDate:        '',
                vacation:            d.vacation ? 'Да' : '',
                inn:                 emp.inn                || '',
                patentSeries:        d.patent_series        || '',
                patentNumber:        d.patent_number        || '',
                patentBlankSeries:   d.form_series          || '',
                patentBlankNumber:   d.form_number          || '',
                passportIssueDate:   fmtDate(d.passport_issued_at),
                birthDate:           fmtDate(emp.birth_date),
                passportData:        emp.passport_data      || '',
                employee:            emp.full_name          || '',
                phone:               emp.phone              || '',
                citizenship:         emp.citizenship        || '',
                documentsLink:       d.doc_link             || '',
                problems:            d.issues               || '',
                registrationEndDate: fmtDate(d.registration_end_at),
                patentIssueDate:     fmtDate(d.patent_issued_at),
                contractDate:        fmtDate(d.contract_date),
                contractLink:        d.contract_link        || '',
                dismissedDate:       fmtDate(emp.fired_at),
                ipContracts:         ''
            };
        }),

        // ── Счета ──────────────────────────────────────────────────────────
        accounts: {
            payments: (invoicesRaw || []).map(inv => ({
                year:        inv.billing_periods?.year   || '',
                period:      inv.billing_periods?.label  || '',
                payrollFund: parseFloat(inv.payroll_fund) || 0,
                revenue:     parseFloat(inv.revenue)     || 0,
                amountPaid:  parseFloat(inv.paid)        || 0,
                diff:        parseFloat(inv.difference)  || 0,
                status:      inv.status  || '',
                comment:     inv.comment || ''
            })),
            transactions: (txRaw || []).map(t => ({
                date:   fmtDate(t.payment_date) || '',
                person: t.contractors?.name || '',
                amount: parseFloat(t.amount) || 0
            }))
        },

        // ── Объезды ────────────────────────────────────────────────────────
        rounds: (visitsRaw || []).map(v => ({
            id:                   v.external_id              || '',
            restaurant:           v.restaurants?.name        || '',
            director:             v.director                 || '',
            employeeName:         v.employees?.full_name     || '',
            employeeInn:          v.employees?.inn           || '',
            paperReason:          v.paper_reason             || '',
            plannedVisitDate:     fmtDate(v.planned_date),
            status:               v.status                   || '',
            adminDeadline:        fmtDate(v.admin_deadline),
            adminComment:         v.admin_comment            || '',
            contractDeliveryDate: fmtDate(v.delivery_date)
        }))
    };

    processLoadedData(result);
}

// ── Форматирование даты из ISO/Date в DD.MM.YYYY ─────────────────────────────
function fmtDate(val) {
    if (!val) return '';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        const day   = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year  = d.getUTCFullYear();
        return `${day}.${month}.${year}`;
    } catch (e) {
        return String(val);
    }
}

// ── Загрузка из Google Apps Script (fallback) ────────────────────────────────
async function loadFromGAS() {
    console.log('[API] Загрузка с GAS:', CONFIG.appsScriptUrl);
    const response = await fetch(CONFIG.appsScriptUrl);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const text = await response.text();
    const result = JSON.parse(text);
    processLoadedData(result);
}

// ── Демо-данные ──────────────────────────────────────────────────────────────
function useDemoData() {
    console.log('[API] Используются демо-данные');
    allPayments  = generateTestData();
    allDocuments = generateTestDocuments();
    allRounds    = [];
    updatePeriodsAndStatuses(allPayments);
    lastPeriod   = getLastPeriod(allPayments);
    populateFilters(allPayments);
    updateDocumentFilters();
    applyFilters();
    applyDocFilters();
    mergeDataByINN();
    updateStatistics();
    hideLoading();
    if (elements.docLoading)        elements.docLoading.classList.add('hidden');
    if (elements.docTableContainer) elements.docTableContainer.classList.remove('hidden');
    showWarning('Supabase недоступен. Показаны демо-данные.');
}

// ── Обработка загруженных данных ─────────────────────────────────────────────
function processLoadedData(result) {
    if (!result) { showError(); return; }

    let hasErrors = false;

    // ── Выплаты ──────────────────────────────────────────────────────────────
    try {
        if (result.data && Array.isArray(result.data)) {
            allPayments = result.data.map((item, index) => {
                try {
                    return {
                        id:                  index + 1,
                        year:                item.year    || new Date().getFullYear(),
                        period:              (item.period   || '').toString().trim(),
                        employee:            (item.employee || '').toString().trim(),
                        phone:               normalizePhone(String(item.phone || '')),
                        inn:                 (item.inn     || '').toString().trim(),
                        amountRegistry:      parseFloat(item.amountRegistry)     || 0,
                        deduction:           parseFloat(item.deduction)          || 0,
                        totalWithDeduction:  parseFloat(item.totalWithDeduction) || 0,
                        platformFee:         parseFloat(item.platformFee)        || 0,
                        amount:              parseFloat(item.amount)             || 0,
                        status:              (item.status  || '').toString().trim(),
                        comment:             (item.comment || '').toString().trim(),
                        formattedAmount:     formatCurrency(parseFloat(item.amount) || 0)
                    };
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);

            console.log('[API] Выплат:', allPayments.length);
            updatePeriodsAndStatuses(allPayments);
            const lp = getLastPeriodAndYear(allPayments);
            lastPeriod = lp ? lp.period : '';
            populateFilters(allPayments);
            mergeDataByINN();
            applyFilters();
            hideError();
        } else {
            allPayments = [];
            hasErrors = true;
            if (elements.periodYearFilter) elements.periodYearFilter.innerHTML = '<option value="">Все периоды</option>';
            if (elements.statusFilter)     elements.statusFilter.innerHTML     = '<option value="">Все статусы</option>';
            applyFilters();
            hideLoading();
        }
    } catch (error) {
        console.error('[API] Ошибка выплат:', error);
        allPayments = [];
        hasErrors = true;
    }

    // ── Документы ────────────────────────────────────────────────────────────
    try {
        if (result.documents && Array.isArray(result.documents)) {
            allDocuments = result.documents.map((item, index) => {
                try {
                    const status = (item.status || '').toString().trim();
                    let documentStatus = 'not-processed';
                    try { documentStatus = getDocumentStatus(item); } catch (e) {}

                    return {
                        id:                   index + 1,
                        status:               status,
                        realStatus:           status,
                        project:              (item.project              || '').toString().trim(),
                        city:                 (item.city                 || '').toString().trim(),
                        position:             (item.position             || '').toString().trim(),
                        restaurant:           (item.restaurant           || '').toString().trim(),
                        comment:              (item.comment              || '').toString().trim(),
                        rclCheckDate:         (item.rclCheckDate         || '').toString().trim(),
                        vacation:             (item.vacation             || '').toString().trim(),
                        inn:                  (item.inn                  || '').toString().trim(),
                        patentSeries:         (item.patentSeries         || '').toString().trim(),
                        patentNumber:         (item.patentNumber         || '').toString().trim(),
                        patentBlankSeries:    (item.patentBlankSeries    || '').toString().trim(),
                        patentBlankNumber:    (item.patentBlankNumber    || '').toString().trim(),
                        passportIssueDate:    (item.passportIssueDate    || '').toString().trim(),
                        birthDate:            (item.birthDate            || '').toString().trim(),
                        passportData:         (item.passportData         || '').toString().trim(),
                        employee:             (item.employee             || '').toString().trim(),
                        phone:                normalizePhone(String(item.phone || '')),
                        citizenship:          (item.citizenship          || '').toString().trim(),
                        documentsLink:        (item.documentsLink        || '').toString().trim(),
                        problems:             (item.problems             || '').toString().trim(),
                        registrationEndDate:  (item.registrationEndDate  || '').toString().trim(),
                        patentIssueDate:      (item.patentIssueDate      || '').toString().trim(),
                        contractDate:         (item.contractDate         || '').toString().trim(),
                        contractLink:         (item.contractLink         || '').toString().trim(),
                        dismissedDate:        (item.dismissedDate        || '').toString().trim(),
                        ipContracts:          (item.ipContracts          || '').toString().trim(),
                        documentStatus:       documentStatus
                    };
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);

            console.log('[API] Документов:', allDocuments.length);
            updateDocumentFilters();
            mergeDataByINN();
            if (currentScreen === 'payments' && filteredPayments.length > 0) renderTable();
            applyDocFilters();
            if (elements.docLoading)        elements.docLoading.classList.add('hidden');
            if (elements.docTableContainer) elements.docTableContainer.classList.remove('hidden');
            if (elements.docErrorMessage)   elements.docErrorMessage.classList.add('hidden');
        } else {
            allDocuments = [];
            if (elements.docLoading)        elements.docLoading.classList.add('hidden');
            if (elements.docTableContainer) elements.docTableContainer.classList.remove('hidden');
        }
    } catch (error) {
        console.error('[API] Ошибка документов:', error);
        allDocuments = [];
        hasErrors = true;
        if (elements.docLoading) elements.docLoading.classList.add('hidden');
    }

    // ── Объезды ──────────────────────────────────────────────────────────────
    try {
        allRounds = (result.rounds || []).map((item, index) => ({
            id:                   (item.id                    || String(index + 1)).toString().trim(),
            restaurant:           (item.restaurant            || '').toString().trim(),
            director:             (item.director              || '').toString().trim(),
            employeeName:         (item.employeeName          || '').toString().trim(),
            employeeInn:          (item.employeeInn           || '').toString().trim(),
            paperReason:          (item.paperReason           || '').toString().trim(),
            plannedVisitDate:     (item.plannedVisitDate      || '').toString().trim(),
            status:               (item.status                || '').toString().trim(),
            adminDeadline:        (item.adminDeadline         || '').toString().trim(),
            adminComment:         (item.adminComment          || '').toString().trim(),
            contractDeliveryDate: (item.contractDeliveryDate  || '').toString().trim()
        }));
        console.log('[API] Объездов:', allRounds.length);
        if (currentScreen === 'rounds' && typeof renderRoundsTable === 'function') {
            updateRoundsFilters();
            applyRoundsFilters();
        }
    } catch (error) {
        console.error('[API] Ошибка объездов:', error);
        allRounds = [];
    }

    // ── Слияние ──────────────────────────────────────────────────────────────
    try {
        if (Object.keys(mergedData).length === 0) mergeDataByINN();
    } catch (e) {}

    // ── Статистика ───────────────────────────────────────────────────────────
    try { updateStatistics(); } catch (e) {}

    // ── Счета ────────────────────────────────────────────────────────────────
    try {
        accountsData = result.accounts || { payments: [], transactions: [] };
        console.log('[API] Счетов:', accountsData.payments?.length,
                    '| Транзакций:', accountsData.transactions?.length);
    } catch (e) {
        accountsData = { payments: [], transactions: [] };
    }

    try { updateLastUpdateTime(); } catch (e) {}

    try {
        if (currentScreen === 'dashboard') {
            setTimeout(() => {
                renderDashboardCharts();
                if (typeof renderAccountsDashboard === 'function') renderAccountsDashboard();
            }, 100);
        }
    } catch (e) {}

    if (hasErrors && (allPayments.length > 0 || allDocuments.length > 0)) hideLoading();
}
