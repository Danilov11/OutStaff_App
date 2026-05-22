// dashboards.js — ресторанные дашборды

// ── Точка входа: выбрать нужный дашборд ─────────────────────────────────────
function renderRestaurantDashboard() {
    const el = document.getElementById('restaurant-dashboard');
    if (!el) return;

    const restaurant = currentRestaurant || (getUserGroupName() === null ? '' : getUserGroupName());

    if (restaurant === 'ЧАО') {
        el.classList.remove('hidden');
        renderChaoDashboard(el);
    } else if (restaurant === 'ФРАНКЛИНС') {
        el.classList.remove('hidden');
        renderFrankinsDashboard(el);
    } else {
        el.classList.add('hidden');
    }
}

// ── Форматирование числа ─────────────────────────────────────────────────────
function fmtMoney(v) {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₽';
}

// ── Дашборд ЧАО ──────────────────────────────────────────────────────────────
function renderChaoDashboard(container) {
    // Фильтруем выплаты только по ЧАО
    const payments = allPayments.filter(p => p.restaurant === 'ЧАО');

    if (!payments.length) {
        container.innerHTML = `<div class="dashboard-section"><p style="color:var(--tx2)">Нет данных для ЧАО</p></div>`;
        return;
    }

    // ── Агрегация по периодам ────────────────────────────────────────────────
    const byPeriod = {};
    payments.forEach(p => {
        const key = `${p.year}|${p.period}`;
        if (!byPeriod[key]) byPeriod[key] = { year: p.year, period: p.period, total: 0, employees: new Set(), count: 0 };
        byPeriod[key].total += p.amount || 0;
        byPeriod[key].employees.add(p.employee);
        byPeriod[key].count++;
    });

    // Сортировка по дате
    const periods = Object.values(byPeriod).sort((a, b) => {
        const da = _parsePeriodDate(a.period, a.year);
        const db = _parsePeriodDate(b.period, b.year);
        return da - db;
    });

    // ── Агрегация по сотрудникам ─────────────────────────────────────────────
    const byEmployee = {};
    payments.forEach(p => {
        if (!byEmployee[p.employee]) byEmployee[p.employee] = { name: p.employee, total: 0, periods: 0 };
        byEmployee[p.employee].total  += p.amount || 0;
        byEmployee[p.employee].periods++;
    });
    const topEmployees = Object.values(byEmployee).sort((a, b) => b.total - a.total).slice(0, 15);

    // ── KPI ──────────────────────────────────────────────────────────────────
    const totalSum    = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const uniqueEmps  = new Set(payments.map(p => p.employee)).size;
    const avgPerEmp   = uniqueEmps ? totalSum / uniqueEmps : 0;
    const lastPeriod  = periods[periods.length - 1];
    const lastTotal   = lastPeriod?.total || 0;

    container.innerHTML = `
        <header>
            <h1><i class="fas fa-chart-bar"></i> Дашборд — ЧАО</h1>
            <p class="subtitle">Динамика выплат и аналитика по сотрудникам</p>
        </header>

        <!-- KPI карточки -->
        <div class="dashboard-stats-grid chao-kpi">
            <div class="stat-card stat-card-primary">
                <div class="stat-card-icon"><i class="fas fa-ruble-sign"></i></div>
                <div class="stat-card-content">
                    <div class="stat-card-label">Выплачено всего</div>
                    <div class="stat-card-value">${fmtMoney(totalSum)}</div>
                </div>
            </div>
            <div class="stat-card stat-card-success">
                <div class="stat-card-icon"><i class="fas fa-users"></i></div>
                <div class="stat-card-content">
                    <div class="stat-card-label">Уникальных сотрудников</div>
                    <div class="stat-card-value">${uniqueEmps}</div>
                </div>
            </div>
            <div class="stat-card stat-card-warning">
                <div class="stat-card-icon"><i class="fas fa-calculator"></i></div>
                <div class="stat-card-content">
                    <div class="stat-card-label">Средняя выплата / чел.</div>
                    <div class="stat-card-value">${fmtMoney(avgPerEmp)}</div>
                </div>
            </div>
            <div class="stat-card stat-card-primary" style="--card-accent:var(--in-fg)">
                <div class="stat-card-icon"><i class="fas fa-calendar-check"></i></div>
                <div class="stat-card-content">
                    <div class="stat-card-label">Последний период</div>
                    <div class="stat-card-value" style="font-size:18px">${lastPeriod ? lastPeriod.year + ' ' + lastPeriod.period : '—'}</div>
                    <div class="stat-card-percent">${fmtMoney(lastTotal)}</div>
                </div>
            </div>
        </div>

        <!-- График динамики -->
        <div class="dashboard-section">
            <h2><i class="fas fa-chart-bar"></i> Динамика выплат по периодам</h2>
            <div class="chart-container" style="height:260px">
                <canvas id="chao-period-chart"></canvas>
            </div>
        </div>

        <!-- Две колонки: таблица периодов + топ сотрудников -->
        <div class="dashboard-row">
            <div class="dashboard-section dashboard-section-half">
                <h2><i class="fas fa-table"></i> Детализация по периодам</h2>
                <div class="table-wrapper" style="border:1px solid var(--bdr-line);border-radius:var(--r-md);overflow:hidden">
                    <table class="data-table">
                        <thead><tr>
                            <th>Период</th>
                            <th style="text-align:right">Сотрудников</th>
                            <th style="text-align:right">Сумма выплат</th>
                            <th style="text-align:right">Средняя</th>
                        </tr></thead>
                        <tbody>
                            ${periods.map(p => `
                            <tr>
                                <td>${p.year} ${p.period}</td>
                                <td style="text-align:right">${p.employees.size}</td>
                                <td style="text-align:right;font-weight:600">${fmtMoney(p.total)}</td>
                                <td style="text-align:right;color:var(--tx2)">${fmtMoney(p.total / p.employees.size)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="dashboard-section dashboard-section-half">
                <h2><i class="fas fa-trophy"></i> Топ сотрудников по выплатам</h2>
                <div class="table-wrapper" style="border:1px solid var(--bdr-line);border-radius:var(--r-md);overflow:hidden">
                    <table class="data-table">
                        <thead><tr>
                            <th>Сотрудник</th>
                            <th style="text-align:right">Периодов</th>
                            <th style="text-align:right">Итого</th>
                        </tr></thead>
                        <tbody>
                            ${topEmployees.map((e, i) => `
                            <tr>
                                <td>
                                    <span style="color:var(--tx2);font-size:11px;margin-right:6px">#${i+1}</span>
                                    ${e.name}
                                </td>
                                <td style="text-align:right;color:var(--tx2)">${e.periods}</td>
                                <td style="text-align:right;font-weight:600">${fmtMoney(e.total)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // ── Нарисовать бар-чарт ──────────────────────────────────────────────────
    _renderChaoPeriodChart(periods);
}

function _parsePeriodDate(period, year) {
    const parsed = typeof parsePeriodEndDate === 'function'
        ? parsePeriodEndDate(period, year)
        : null;
    if (parsed && !isNaN(parsed.getTime())) return parsed;

    const m = String(period).match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
    const normalizedYear = Number(year) || new Date().getFullYear();
    if (!m) return new Date(normalizedYear, 0, 1);
    return new Date(
        m[3] ? parseInt(m[3], 10) : normalizedYear,
        parseInt(m[2], 10) - 1,
        parseInt(m[1], 10)
    );
}

function _formatPeriodLabel(p) {
    return p.year ? `${p.year} ${p.period}` : p.period;
}

function _renderChaoPeriodChart(periods) {
    const canvas = document.getElementById('chao-period-chart');
    if (!canvas) return;

    // Уничтожить предыдущий
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const labels = periods.map(_formatPeriodLabel);
    const data   = periods.map(p => p.total);
    const emps   = periods.map(p => p.employees.size);

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Сумма выплат, ₽',
                    data,
                    backgroundColor: 'rgba(15,76,92,0.75)',
                    borderColor: '#0f4c5c',
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y',
                },
                {
                    label: 'Сотрудников',
                    data: emps,
                    type: 'line',
                    borderColor: '#3d7d60',
                    backgroundColor: 'rgba(61,125,96,0.1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#3d7d60',
                    tension: 0.3,
                    yAxisID: 'y2',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { family: 'Montserrat', size: 12, weight: '600' }, color: '#141c26', boxWidth: 12, boxHeight: 12, borderRadius: 3, useBorderRadius: true }
                },
                tooltip: {
                    backgroundColor: '#141c26',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ctx.datasetIndex === 0
                            ? ' ' + new Intl.NumberFormat('ru-RU').format(ctx.parsed.y) + ' ₽'
                            : ' ' + ctx.parsed.y + ' чел.'
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Montserrat', size: 11 }, color: '#556575' }
                },
                y: {
                    position: 'left',
                    grid: { color: 'rgba(0,0,0,.06)' },
                    ticks: {
                        font: { family: 'Montserrat', size: 11 },
                        color: '#556575',
                        callback: v => new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(v) + ' ₽'
                    }
                },
                y2: {
                    position: 'right',
                    grid: { display: false },
                    ticks: { font: { family: 'Montserrat', size: 11 }, color: '#3d7d60' },
                    title: { display: true, text: 'Сотрудников', color: '#3d7d60', font: { size: 11 } }
                }
            }
        }
    });
}

// ── Дашборд ФРАНКЛИНС ────────────────────────────────────────────────────────
function renderFrankinsDashboard(container) {
    const payments  = allPayments.filter(p => p.restaurant === 'ФРАНКЛИНС');
    const documents = allDocuments.filter(d => d.restaurant === 'ФРАНКЛИНС');

    if (!payments.length) {
        container.innerHTML = `<div class="dashboard-section"><p style="color:var(--tx2)">Нет данных для Франклинс</p></div>`;
        return;
    }

    // ── Агрегация по периодам ────────────────────────────────────────────────
    const byPeriod = {};
    payments.forEach(p => {
        const key = `${p.year}|${p.period}`;
        if (!byPeriod[key]) byPeriod[key] = { year: p.year, period: p.period, total: 0, employees: new Set() };
        byPeriod[key].total += p.amount || 0;
        byPeriod[key].employees.add(p.employee);
    });
    const periods = Object.values(byPeriod).sort((a, b) =>
        _parsePeriodDate(a.period, a.year) - _parsePeriodDate(b.period, b.year)
    );

    // ── Агрегация по сотрудникам ─────────────────────────────────────────────
    const byEmployee = {};
    payments.forEach(p => {
        if (!byEmployee[p.employee]) byEmployee[p.employee] = { name: p.employee, total: 0, periods: 0 };
        byEmployee[p.employee].total  += p.amount || 0;
        byEmployee[p.employee].periods++;
    });
    const topEmployees = Object.values(byEmployee).sort((a, b) => b.total - a.total).slice(0, 15);

    // ── Документы ────────────────────────────────────────────────────────────
    const docStatuses = {};
    let withIssues = 0;
    documents.forEach(d => {
        const st = d.status || 'Не указан';
        docStatuses[st] = (docStatuses[st] || 0) + 1;
        if (d.problems) withIssues++;
    });

    // ── KPI ──────────────────────────────────────────────────────────────────
    const totalSum   = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const uniqueEmps = new Set(payments.map(p => p.employee)).size;
    const avgPerEmp  = uniqueEmps ? totalSum / uniqueEmps : 0;
    const lastP      = periods[periods.length - 1];
    const firstP     = periods[0];
    const peakPeriod = periods.reduce((mx, p) => p.employees.size > mx.employees.size ? p : mx, periods[0]);
    const trend      = lastP && firstP ? ((lastP.employees.size - firstP.employees.size) / firstP.employees.size * 100) : 0;
    const trendSign  = trend >= 0 ? '+' : '';
    const trendColor = trend >= 0 ? 'var(--ok-fg)' : 'var(--er-fg)';

    container.innerHTML = `
        <header>
            <h1><i class="fas fa-chart-bar"></i> Дашборд — Франклинс</h1>
            <p class="subtitle">Динамика выплат · ${periods.length} периодов · ${uniqueEmps} уникальных сотрудников</p>
        </header>

        <!-- KPI карточки -->
        <div class="dashboard-stats-grid chao-kpi">
            <div class="stat-card stat-card-primary">
                <div class="stat-card-icon"><i class="fas fa-ruble-sign"></i></div>
                <div class="stat-card-content">
                    <div class="stat-card-label">Выплачено всего</div>
                    <div class="stat-card-value">${fmtMoney(totalSum)}</div>
                </div>
            </div>
            <div class="stat-card stat-card-success">
                <div class="stat-card-icon"><i class="fas fa-users"></i></div>
                <div class="stat-card-content">
                    <div class="stat-card-label">Уникальных сотрудников</div>
                    <div class="stat-card-value">${uniqueEmps}</div>
                    <div class="stat-card-percent">Пик: ${peakPeriod.employees.size} чел. в ${peakPeriod.period}</div>
                </div>
            </div>
            <div class="stat-card stat-card-warning">
                <div class="stat-card-icon"><i class="fas fa-calculator"></i></div>
                <div class="stat-card-content">
                    <div class="stat-card-label">Средняя выплата / чел.</div>
                    <div class="stat-card-value">${fmtMoney(avgPerEmp)}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon"><i class="fas fa-chart-line"></i></div>
                <div class="stat-card-content">
                    <div class="stat-card-label">Активных в посл. периоде</div>
                    <div class="stat-card-value">${lastP ? lastP.employees.size : '—'}</div>
                    <div class="stat-card-percent" style="color:${trendColor}">${trendSign}${trend.toFixed(0)}% к первому периоду</div>
                </div>
            </div>
        </div>

        <!-- График динамики -->
        <div class="dashboard-section">
            <h2><i class="fas fa-chart-bar"></i> Динамика выплат по периодам</h2>
            <div class="chart-container" style="height:280px">
                <canvas id="fb-period-chart"></canvas>
            </div>
        </div>

        <!-- Три блока: таблица + документы + топ -->
        <div class="dashboard-row">
            <div class="dashboard-section dashboard-section-half">
                <h2><i class="fas fa-table"></i> Детализация по периодам</h2>
                <div class="table-wrapper" style="border:1px solid var(--bdr-line);border-radius:var(--r-md);overflow:hidden;max-height:400px;overflow-y:auto">
                    <table class="data-table">
                        <thead><tr>
                            <th>Период</th>
                            <th style="text-align:right">Сотрудников</th>
                            <th style="text-align:right">Сумма выплат</th>
                            <th style="text-align:right">Средняя</th>
                        </tr></thead>
                        <tbody>
                            ${periods.map(p => `
                            <tr>
                                <td>${p.year} ${p.period}</td>
                                <td style="text-align:right">${p.employees.size}</td>
                                <td style="text-align:right;font-weight:600">${fmtMoney(p.total)}</td>
                                <td style="text-align:right;color:var(--tx2)">${fmtMoney(p.total / p.employees.size)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="dashboard-section dashboard-section-half">
                ${documents.length ? `
                <h2><i class="fas fa-file-alt"></i> Статусы документов</h2>
                <div class="fb-doc-stats">
                    ${Object.entries(docStatuses).sort((a,b)=>b[1]-a[1]).map(([st, cnt]) => `
                    <div class="fb-doc-stat-row">
                        <span class="fb-doc-stat-label">${st}</span>
                        <span class="fb-doc-stat-bar">
                            <span class="fb-doc-stat-fill" style="width:${Math.round(cnt/documents.length*100)}%"></span>
                        </span>
                        <span class="fb-doc-stat-count">${cnt}</span>
                    </div>`).join('')}
                    ${withIssues ? `<div class="fb-doc-issues"><i class="fas fa-exclamation-triangle"></i> ${withIssues} сотрудников с проблемами в документах</div>` : ''}
                </div>
                <div style="margin-top:20px">
                <h2><i class="fas fa-trophy"></i> Топ сотрудников</h2>` : `<h2><i class="fas fa-trophy"></i> Топ сотрудников по выплатам</h2>`}
                <div class="table-wrapper" style="border:1px solid var(--bdr-line);border-radius:var(--r-md);overflow:hidden;max-height:300px;overflow-y:auto">
                    <table class="data-table">
                        <thead><tr>
                            <th>Сотрудник</th>
                            <th style="text-align:right">Периодов</th>
                            <th style="text-align:right">Итого</th>
                        </tr></thead>
                        <tbody>
                            ${topEmployees.map((e, i) => `
                            <tr>
                                <td><span style="color:var(--tx2);font-size:11px;margin-right:6px">#${i+1}</span>${e.name}</td>
                                <td style="text-align:right;color:var(--tx2)">${e.periods}</td>
                                <td style="text-align:right;font-weight:600">${fmtMoney(e.total)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                ${documents.length ? '</div>' : ''}
            </div>
        </div>
    `;

    _renderFbPeriodChart(periods);
}

function _renderFbPeriodChart(periods) {
    const canvas = document.getElementById('fb-period-chart');
    if (!canvas) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const labels = periods.map(_formatPeriodLabel);
    const data   = periods.map(p => p.total);
    const emps   = periods.map(p => p.employees.size);

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Сумма выплат, ₽',
                    data,
                    backgroundColor: 'rgba(154,120,32,0.7)',
                    borderColor: '#9a7820',
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y',
                },
                {
                    label: 'Сотрудников',
                    data: emps,
                    type: 'line',
                    borderColor: '#b54850',
                    backgroundColor: 'rgba(181,72,80,0.08)',
                    borderWidth: 2.5,
                    pointRadius: 5,
                    pointBackgroundColor: '#b54850',
                    tension: 0.35,
                    yAxisID: 'y2',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { family: 'Montserrat', size: 12, weight: '600' }, color: '#141c26', boxWidth: 12, boxHeight: 12, borderRadius: 3, useBorderRadius: true }
                },
                tooltip: {
                    backgroundColor: '#141c26',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ctx.datasetIndex === 0
                            ? ' ' + new Intl.NumberFormat('ru-RU').format(ctx.parsed.y) + ' ₽'
                            : ' ' + ctx.parsed.y + ' чел.'
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Montserrat', size: 11 }, color: '#556575', maxRotation: 35 } },
                y: {
                    position: 'left',
                    grid: { color: 'rgba(0,0,0,.06)' },
                    ticks: {
                        font: { family: 'Montserrat', size: 11 }, color: '#556575',
                        callback: v => new Intl.NumberFormat('ru-RU', { notation: 'compact' }).format(v) + ' ₽'
                    }
                },
                y2: {
                    position: 'right',
                    grid: { display: false },
                    ticks: { font: { family: 'Montserrat', size: 11 }, color: '#b54850' },
                    title: { display: true, text: 'Сотрудников', color: '#b54850', font: { size: 11 } }
                }
            }
        }
    });
}
