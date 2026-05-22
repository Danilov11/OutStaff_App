// cabinet.js — Личный кабинет сотрудника

async function renderEmployeeCabinet() {
    const overlay = document.getElementById('cabinet-overlay');
    if (!overlay) return;

    const emp = currentUser;
    if (!emp?.employeeId) return;

    // Показываем шапку + спиннер немедленно
    overlay.innerHTML = `
        <div class="cab-topbar">
            <div class="cab-topbar-brand">
                <img src="лого.png" alt="" class="cab-topbar-logo">
                <span>Личный кабинет</span>
            </div>
            <div class="cab-topbar-right">
                <span class="cab-topbar-name">${emp.name}</span>
                <button class="cab-logout-btn" id="cab-logout-btn">
                    <i class="fas fa-sign-out-alt"></i> Выйти
                </button>
            </div>
        </div>
        <div class="cab-body" id="cab-body">
            <div class="loading" style="padding:60px 0;">
                <div class="spinner"></div>
                <p>Загрузка данных…</p>
            </div>
        </div>
    `;

    document.getElementById('cab-logout-btn')?.addEventListener('click', authLogout);

    const db = getSupabaseClient();
    if (!db) { _cabError('Нет подключения к базе данных'); return; }

    // Загружаем данные
    let payrollRaw, docRaw, sheetRaw;
    try {
        const [r1, r2, r3] = await Promise.all([
            db.from('payroll_records')
              .select('registry_amount, total_payout, status, comment, billing_periods(year, label)')
              .eq('employee_id', emp.employeeId)
              .order('id', { ascending: false }),

            db.from('employee_documents')
              .select('doc_status, patent_series, patent_number, registration_end_at, patent_issued_at, contract_date, doc_link, contract_link, issues')
              .eq('employee_id', emp.employeeId)
              .maybeSingle(),

            db.from('salary_sheets')
              .select('restaurants(name)')
              .eq('employee_id', emp.employeeId)
              .order('id', { ascending: false })
              .limit(1)
              .maybeSingle()
        ]);

        if (r1.error) throw new Error('payroll: ' + r1.error.message);
        payrollRaw = r1.data || [];
        docRaw     = r2.data || null;
        sheetRaw   = r3.data || null;
    } catch (e) {
        console.error('[cabinet] Ошибка загрузки:', e);
        _cabError('Ошибка загрузки данных: ' + e.message);
        return;
    }

    const restaurant   = sheetRaw?.restaurants?.name || '';
    const doc          = docRaw || {};
    const payroll      = payrollRaw;
    const totalEarned  = payroll.reduce((s, p) => s + (parseFloat(p.total_payout) || 0), 0);
    const lastPayment  = payroll[0];
    const lastPeriodLbl = lastPayment
        ? ((lastPayment.billing_periods?.year || '') + ' ' + (lastPayment.billing_periods?.label || '')).trim()
        : '—';

    const body = document.getElementById('cab-body');
    if (!body) return;

    body.innerHTML = `
        <!-- Профиль -->
        <div class="cab-profile-card">
            <div class="cab-avatar"><i class="fas fa-user-circle"></i></div>
            <div class="cab-profile-info">
                <h2 class="cab-name">${emp.name}</h2>
                <div class="cab-meta">
                    ${emp.position    ? `<span><i class="fas fa-briefcase"></i> ${emp.position}</span>` : ''}
                    ${restaurant      ? `<span><i class="fas fa-store"></i> ${restaurant}</span>`       : ''}
                    ${emp.city        ? `<span><i class="fas fa-city"></i> ${emp.city}</span>`          : ''}
                    ${emp.citizenship ? `<span><i class="fas fa-flag"></i> ${emp.citizenship}</span>`   : ''}
                    ${emp.phone       ? `<span><i class="fas fa-phone"></i> ${formatPhone(emp.phone)}</span>` : ''}
                    <span><i class="fas fa-id-card"></i> ИНН: ${emp.inn}</span>
                </div>
            </div>
        </div>

        <!-- KPI строка -->
        <div class="cab-kpi-row">
            <div class="cab-kpi">
                <div class="cab-kpi-label">Всего периодов</div>
                <div class="cab-kpi-value">${payroll.length}</div>
            </div>
            <div class="cab-kpi">
                <div class="cab-kpi-label">Общая сумма</div>
                <div class="cab-kpi-value">${_cabMoney(totalEarned)}</div>
            </div>
            <div class="cab-kpi">
                <div class="cab-kpi-label">Последняя выплата</div>
                <div class="cab-kpi-value">${lastPayment ? _cabMoney(parseFloat(lastPayment.total_payout) || 0) : '—'}</div>
            </div>
            <div class="cab-kpi">
                <div class="cab-kpi-label">Последний период</div>
                <div class="cab-kpi-value cab-kpi-period">${lastPeriodLbl}</div>
            </div>
        </div>

        <!-- Документы -->
        <div class="cab-section">
            <h3><i class="fas fa-file-alt"></i> Документы</h3>
            ${_cabRenderDocs(doc)}
        </div>

        <!-- История выплат -->
        <div class="cab-section">
            <h3><i class="fas fa-history"></i> История выплат</h3>
            ${_cabRenderPayroll(payroll)}
        </div>

        ${payroll.length > 1 ? `
        <div class="cab-section">
            <h3><i class="fas fa-chart-bar"></i> Динамика выплат</h3>
            <div class="cab-chart-wrap"><canvas id="cab-chart"></canvas></div>
        </div>
        ` : ''}
    `;

    if (payroll.length > 1) _cabRenderChart(payroll);
}

function _cabError(msg) {
    const body = document.getElementById('cab-body');
    if (body) body.innerHTML = `<div class="error-message" style="margin:40px auto;max-width:480px;">
        <i class="fas fa-exclamation-triangle"></i><p>${msg}</p>
    </div>`;
}

function _cabMoney(v) {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₽';
}

function _cabRenderDocs(doc) {
    if (!doc?.doc_status) {
        return `<p class="cab-empty">Документы не найдены</p>`;
    }

    const statusMap = {
        'Оформлен':      { cls: 'cab-status-ok',   icon: 'fa-check-circle'  },
        'В обработке':   { cls: 'cab-status-warn',  icon: 'fa-clock'         },
        'На оформлении': { cls: 'cab-status-warn',  icon: 'fa-clock'         },
    };
    const s = statusMap[doc.doc_status] || { cls: 'cab-status-muted', icon: 'fa-circle' };

    const cleanNum = v => String(v || '').replace(/\.0$/, '').trim();
    const fields = [
        doc.patent_series && doc.patent_number
            ? ['Патент', `${cleanNum(doc.patent_series)} ${cleanNum(doc.patent_number)}`] : null,
        doc.registration_end_at ? ['Регистрация до',  fmtDate(doc.registration_end_at)] : null,
        doc.patent_issued_at    ? ['Патент выдан',    fmtDate(doc.patent_issued_at)]    : null,
        doc.contract_date       ? ['Дата договора',   fmtDate(doc.contract_date)]       : null,
    ].filter(Boolean);

    const links = [];
    if (doc.doc_link)      links.push(`<a href="${doc.doc_link}"      target="_blank" class="cab-doc-link"><i class="fas fa-folder-open"></i> Документы</a>`);
    if (doc.contract_link) links.push(`<a href="${doc.contract_link}" target="_blank" class="cab-doc-link"><i class="fas fa-file-contract"></i> Договор</a>`);

    return `
        <div class="cab-doc-status ${s.cls}">
            <i class="fas ${s.icon}"></i> ${doc.doc_status}
        </div>
        ${fields.length ? `
        <div class="cab-doc-grid">
            ${fields.map(([k, v]) => `
            <div class="cab-doc-row">
                <span class="cab-doc-key">${k}</span>
                <span class="cab-doc-val">${v}</span>
            </div>`).join('')}
        </div>` : ''}
        ${links.length ? `<div class="cab-doc-links">${links.join('')}</div>` : ''}
        ${doc.issues ? `<div class="cab-issues"><i class="fas fa-exclamation-triangle"></i> ${doc.issues}</div>` : ''}
    `;
}

function _cabRenderPayroll(payroll) {
    if (!payroll.length) return `<p class="cab-empty">Выплаты не найдены</p>`;

    const rows = payroll.map(p => {
        const amount  = parseFloat(p.total_payout) || 0;
        const period  = p.billing_periods?.label || '';
        const year    = p.billing_periods?.year  || '';
        const status  = p.status || '';
        const comment = p.comment || '';

        const sl = status.toLowerCase();
        const sc = sl.includes('оплат') && !sl.includes('не ')
            ? 'cab-badge-ok'
            : sl.includes('не плат') || sl.includes('отказ')
                ? 'cab-badge-err'
                : 'cab-badge-warn';

        return `<tr>
            <td>${year ? year + ' · ' : ''}${period}</td>
            <td class="cab-amount">${_cabMoney(amount)}</td>
            <td><span class="cab-badge ${sc}">${status}</span></td>
            <td class="cab-comment">${comment}</td>
        </tr>`;
    }).join('');

    return `
        <div class="table-wrapper">
            <table class="data-table">
                <thead><tr>
                    <th>Период</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Комментарий</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function _cabRenderChart(payroll) {
    const canvas = document.getElementById('cab-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const recent  = [...payroll].reverse().slice(-12);
    const labels  = recent.map(p => (p.billing_periods?.label || ''));
    const amounts = recent.map(p => parseFloat(p.total_payout) || 0);

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Выплата',
                data: amounts,
                backgroundColor: 'rgba(15,76,92,0.72)',
                borderColor: 'rgba(15,76,92,1)',
                borderWidth: 1,
                borderRadius: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => _cabMoney(ctx.parsed.y) } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => _cabMoney(v) } },
                x: { ticks: { maxRotation: 45, minRotation: 30 } }
            }
        }
    });
}
