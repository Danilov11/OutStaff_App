// charts.js
// Графики для дашборда и отображение счетов

// ── Палитра дизайн-системы для Chart.js ──────────────────────────────────────
const DS = {
    // Семантические цвета — те же оттенки дизайн-системы, чуть светлее
    ok:   '#3d7d60',  // ok-fg #2d5f49 + яркость
    ca:   '#9a7820',  // ca-fg #7a5f14 + яркость
    teal: '#1a6a80',  // teal  #0f4c5c + яркость
    tx2:  '#6d8295',  // tx2   #556575 + яркость
    er:   '#b54850',  // er-fg #8f383f + яркость

    // Расширенная палитра — те же оттенки дизайн-системы, чуть светлее
    palette: [
        '#1a6a80', // teal
        '#3d7d60', // ok-fg
        '#9a7820', // ca-fg
        '#b54850', // er-fg
        '#1e85a0', // teal-h
        '#5e9e89', // зелёный средний
        '#b89232', // янтарный средний
        '#6d8295', // tx2
        '#c46070', // красный средний
        '#93a7bc', // tx3
    ],

    // Цвета для bar-графиков (оригинал дизайн-системы)
    barPrimary: '#0f4c5c',
    barOk:      '#2d5f49',
};

// Общие опции для donut-графиков
function doughnutOptions(total, legendPos = 'right') {
    return {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
            legend: {
                position: legendPos,
                labels: {
                    boxWidth: 14,
                    boxHeight: 14,
                    borderRadius: 4,
                    useBorderRadius: true,
                    padding: 16,
                    color: '#141c26',
                    font: { family: 'Montserrat', size: 13, weight: '600' },
                }
            },
            tooltip: {
                backgroundColor: '#141c26',
                titleFont: { family: 'Montserrat', size: 12, weight: '600' },
                bodyFont:  { family: 'Montserrat', size: 12 },
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                    label(ctx) {
                        const v = ctx.parsed || 0;
                        const pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
                        return `  ${ctx.label}: ${v} (${pct}%)`;
                    }
                }
            }
        }
    };
}

// Функции для графиков на дашборде
// Документы, доступные текущему пользователю (фильтр по группе)
function _getFilteredDocuments() {
    if (typeof canAccessRestaurant !== 'function') return allDocuments;
    return allDocuments.filter(doc => {
        if (!doc.restaurant) return true; // без ресторана показываем
        return canAccessRestaurant(doc.restaurant);
    });
}

function renderDashboardCharts() {
    if (currentScreen !== 'dashboard') return;

    // Обновляем карточки с метриками
    updateDashboardStats();

    // Рендерим все графики
    renderStatusChart();
    renderPositionChart();
    renderRestaurantChart();
}

// Обновление карточек с метриками
function updateDashboardStats() {
    const docs = _getFilteredDocuments();
    const total = docs.length;
    const processed = docs.filter(d => {
        const status = (d.realStatus || '').toLowerCase();
        return status.includes('оформлен') && !status.includes('на оформлении') && !status.includes('уволен');
    }).length;

    const inProcess = docs.filter(d => {
        const status = (d.realStatus || '').toLowerCase();
        return (status.includes('на оформлении') || status.includes('обработке') || status.includes('обновлено'))
            && !status.includes('уволен');
    }).length;

    // Уволенные - те, у кого в статусе есть "уволен" или есть дата увольнения
    const dismissed = docs.filter(d => {
        const status = (d.realStatus || '').toLowerCase();
        const hasDismissedDate = d.dismissedDate && d.dismissedDate.trim() !== '';
        return status.includes('уволен') || hasDismissedDate;
    }).length;
    
    // Обновляем значения
    const totalEl = document.getElementById('stat-total-employees');
    const processedEl = document.getElementById('stat-processed-employees');
    const processedPercentEl = document.getElementById('stat-processed-percent');
    const inProcessEl = document.getElementById('stat-in-process-employees');
    const inProcessPercentEl = document.getElementById('stat-in-process-percent');
    const dismissedEl = document.getElementById('stat-dismissed-employees');
    const dismissedPercentEl = document.getElementById('stat-dismissed-percent');
    
    if (totalEl) totalEl.textContent = total;
    if (processedEl) processedEl.textContent = processed;
    if (processedPercentEl) processedPercentEl.textContent = total > 0 ? `${Math.round((processed / total) * 100)}%` : '0%';
    if (inProcessEl) inProcessEl.textContent = inProcess;
    if (inProcessPercentEl) inProcessPercentEl.textContent = total > 0 ? `${Math.round((inProcess / total) * 100)}%` : '0%';
    if (dismissedEl) dismissedEl.textContent = dismissed;
    if (dismissedPercentEl) dismissedPercentEl.textContent = total > 0 ? `${Math.round((dismissed / total) * 100)}%` : '0%';
}

// График по статусам оформления
function renderStatusChart() {
    const ctx = document.getElementById('status-chart');
    if (!ctx) return;
    
    // Уничтожаем предыдущий график если он существует
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }
    
    // Подсчитываем статусы
    const statusCounts = {
        'Оформлен': 0,
        'На оформлении': 0,
        'В обработке': 0,
        'Уволено': 0,
        'Не оформлен': 0
    };
    
    _getFilteredDocuments().forEach(doc => {
        const status = doc.realStatus || '';
        const statusLower = status.toLowerCase();

        // Проверяем уволенных отдельно
        if (statusLower.includes('уволен') || (doc.dismissedDate && doc.dismissedDate.trim() !== '')) {
            statusCounts['Уволено']++;
        } else if (statusLower.includes('оформлен') && !statusLower.includes('на оформлении')) {
            statusCounts['Оформлен']++;
        } else if (statusLower.includes('на оформлении')) {
            statusCounts['На оформлении']++;
        } else if (statusLower.includes('обработке') || statusLower.includes('обновлено')) {
            statusCounts['В обработке']++;
        } else {
            statusCounts['Не оформлен']++;
        }
    });
    
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Оформлен', 'На оформлении', 'В обработке', 'Уволено', 'Не оформлен'],
            datasets: [{
                data: [
                    statusCounts['Оформлен'],
                    statusCounts['На оформлении'],
                    statusCounts['В обработке'],
                    statusCounts['Уволено'],
                    statusCounts['Не оформлен']
                ],
                backgroundColor: [DS.ok, DS.ca, DS.teal, DS.tx2, DS.er],
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 6,
            }]
        },
        options: doughnutOptions(total),
    });
}

// График по ресторанам
function renderRestaurantChart() {
    const ctx = document.getElementById('restaurant-chart');
    if (!ctx) return;
    
    // Уничтожаем предыдущий график если он существует
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }
    
    // Группируем по ресторанам
    const restaurantData = {};
    
    _getFilteredDocuments().forEach(doc => {
        const restaurant = doc.restaurant || 'Не указан';
        if (!restaurantData[restaurant]) {
            restaurantData[restaurant] = {
                total: 0,
                processed: 0
            };
        }
        
        // Не считаем уволенных в общее количество
        const status = (doc.realStatus || '').toLowerCase();
        const isDismissed = status.includes('уволен') || (doc.dismissedDate && doc.dismissedDate.trim() !== '');
        
        if (!isDismissed) {
            restaurantData[restaurant].total++;
            
            if (status.includes('оформлен') && !status.includes('на оформлении')) {
                restaurantData[restaurant].processed++;
            }
        }
    });
    
    const restaurants = Object.keys(restaurantData).sort();
    const totalData = restaurants.map(r => restaurantData[r].total);
    const processedData = restaurants.map(r => restaurantData[r].processed);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: restaurants,
            datasets: [
                {
                    label: 'Подано на оформление',
                    data: totalData,
                    backgroundColor: DS.barPrimary + 'aa',
                    borderColor: DS.barPrimary,
                    borderWidth: 1,
                    borderRadius: 4,
                },
                {
                    label: 'Оформлено',
                    data: processedData,
                    backgroundColor: DS.barOk + 'aa',
                    borderColor: DS.barOk,
                    borderWidth: 1,
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { family: 'Montserrat', size: 11 }, color: '#556575' },
                    grid: { color: '#e2e8ef' }
                },
                x: {
                    ticks: { font: { family: 'Montserrat', size: 11 }, color: '#556575' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 10, boxHeight: 10, borderRadius: 3, useBorderRadius: true,
                        padding: 14, color: '#141c26',
                        font: { family: 'Montserrat', size: 12, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: '#141c26',
                    titleFont: { family: 'Montserrat', size: 12, weight: '600' },
                    bodyFont:  { family: 'Montserrat', size: 12 },
                    padding: 10, cornerRadius: 8,
                }
            }
        }
    });
}

// График распределения по должностям
function renderPositionChart() {
    const ctx = document.getElementById('position-chart');
    if (!ctx) return;
    
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }
    
    // Группируем по должностям
    const positionData = {};
    
    _getFilteredDocuments().forEach(doc => {
        const position = doc.position || 'Не указана';
        if (!positionData[position]) {
            positionData[position] = 0;
        }
        positionData[position]++;
    });
    
    const positions = Object.keys(positionData).sort((a, b) => positionData[b] - positionData[a]);
    const counts = positions.map(p => positionData[p]);
    
    const total = counts.reduce((a, b) => a + b, 0);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: positions,
            datasets: [{
                data: counts,
                backgroundColor: DS.palette.slice(0, positions.length),
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 6,
            }]
        },
        options: doughnutOptions(total),
    });
}

// Отображение данных счетов на дашборде
function renderAccountsDashboard() {
    // Отображаем таблицу выплат
    renderAccountsPaymentsTable();
    
    // Отображаем историю транзакций
    renderTransactionsTable();
}

// Отображение таблицы выплат из листа "Счета"
function renderAccountsPaymentsTable() {
    const tbody = document.getElementById('accounts-payments-table-body');
    if (!tbody) {
        console.warn('Элемент accounts-payments-table-body не найден');
        return;
    }
    
    if (!accountsData || !accountsData.payments || accountsData.payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--gray-500);">Нет данных о выплатах</td></tr>';
        return;
    }
    
    console.log('Отображение выплат из листа "Счета":', accountsData.payments);
    
    let html = '';
    accountsData.payments.forEach(payment => {
        const diffVal = payment.diff || 0;
        const diffClass = diffVal > 0 ? 'status-unpaid' : (diffVal < 0 ? 'status-paid' : '');
        html += `
            <tr>
                <td>${payment.period || '-'}</td>
                <td>${formatCurrency(payment.payrollFund || 0)} ₽</td>
                <td>${formatCurrency(payment.revenue || 0)} ₽</td>
                <td>${formatCurrency(payment.amountPaid || 0)} ₽</td>
                <td class="${diffClass}">${formatCurrency(Math.abs(diffVal))} ₽</td>
                <td>${payment.status || '-'}</td>
                <td>${payment.comment || '-'}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Показываем кнопку экспорта CSV для выплат
    const exportPaymentsBtn = document.getElementById('export-payments-csv');
    if (exportPaymentsBtn && accountsData.payments && accountsData.payments.length > 0) {
        exportPaymentsBtn.style.display = 'block';
        exportPaymentsBtn.onclick = function() {
            exportPaymentsToCSV(accountsData.payments);
        };
    } else if (exportPaymentsBtn) {
        exportPaymentsBtn.style.display = 'none';
    }
}

// Отображение таблицы транзакций (раскрывающаяся)
function renderTransactionsTable() {
    const summaryDiv = document.getElementById('transactions-summary');
    const tbody = document.getElementById('transactions-table-body');
    const toggleButton = document.getElementById('toggle-transactions');
    const fullListDiv = document.getElementById('transactions-full-list');
    const totalSumEl = document.getElementById('transactions-total-sum');
    
    if (!summaryDiv || !tbody || !toggleButton || !fullListDiv) {
        console.warn('Элементы для транзакций не найдены');
        return;
    }
    
    if (!accountsData || !accountsData.transactions || accountsData.transactions.length === 0) {
        summaryDiv.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--gray-500);">Нет транзакций</p>';
        toggleButton.style.display = 'none';
        if (totalSumEl) totalSumEl.textContent = '0 ₽';
        return;
    }
    
    console.log('Отображение транзакций:', accountsData.transactions);
    
    // Вычисляем сумму всех транзакций
    const totalSum = accountsData.transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    if (totalSumEl) {
        totalSumEl.textContent = formatCurrency(Math.abs(totalSum)) + ' ₽';
    }
    
    // Сортируем транзакции по дате (от новых к старым) или берем последнюю добавленную
    // Берем последнюю транзакцию из массива (которая была добавлена последней)
    const sortedTransactions = [...accountsData.transactions].reverse(); // Переворачиваем массив, чтобы последняя была первой
    
    // Показываем последнюю транзакцию в summary (первая в перевернутом массиве)
    const lastTransaction = sortedTransactions[0];
    const amountClass = lastTransaction.amount >= 0 ? 'positive' : 'negative';
    
    summaryDiv.innerHTML = `
        <table class="transactions-table">
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Лицо</th>
                    <th>Сумма</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${lastTransaction.date || '-'}</td>
                    <td>${lastTransaction.account || '-'}</td>
                    <td class="${amountClass}">${formatCurrency(Math.abs(lastTransaction.amount))} ₽</td>
                </tr>
            </tbody>
        </table>
    `;
    
    // Если транзакций больше одной, показываем кнопку раскрытия
    if (sortedTransactions.length > 1) {
        toggleButton.style.display = 'block';
        toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i> Показать всю историю (' + sortedTransactions.length + ' транзакций)';
        
        // Обработчик клика на кнопку
        toggleButton.onclick = function() {
            const isExpanded = fullListDiv.style.display !== 'none';
            if (isExpanded) {
                fullListDiv.style.display = 'none';
                toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i> Показать всю историю (' + sortedTransactions.length + ' транзакций)';
            } else {
                fullListDiv.style.display = 'block';
                toggleButton.innerHTML = '<i class="fas fa-chevron-up"></i> Скрыть историю';
            }
        };
        
        // Заполняем полный список транзакций
        let html = '';
        sortedTransactions.forEach(transaction => {
            const amountClass = transaction.amount >= 0 ? 'positive' : 'negative';
            html += `
                <tr>
                    <td>${transaction.date || '-'}</td>
                    <td>${transaction.account || '-'}</td>
                    <td class="${amountClass}">${formatCurrency(Math.abs(transaction.amount))} ₽</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Показываем кнопку экспорта CSV
        const exportBtn = document.getElementById('export-transactions-csv');
        if (exportBtn) {
            exportBtn.style.display = 'block';
            exportBtn.onclick = function() {
                exportTransactionsToCSV(sortedTransactions);
            };
        }
    } else {
        toggleButton.style.display = 'none';
        const exportBtn = document.getElementById('export-transactions-csv');
        if (exportBtn) exportBtn.style.display = 'none';
    }
}

// Экспорт транзакций в CSV
function exportTransactionsToCSV(transactions) {
    if (!transactions || transactions.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }
    
    const headers = ['Дата', 'Лицо', 'Сумма'];
    const rows = transactions.map(transaction => [
        transaction.date || '',
        transaction.account || '',
        transaction.amount || 0
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
            // Экранируем кавычки и оборачиваем в кавычки если содержит запятую
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM для правильной кодировки
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `история_транзакций_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
    
    URL.revokeObjectURL(url);
}

// Экспорт выплат из листа "Счета" в CSV
function exportPaymentsToCSV(payments) {
    if (!payments || payments.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }
    
    const headers = ['Период', 'К оплате', 'Оплачено', 'Разница счетов', 'Статус', 'Комментарий'];
    const rows = payments.map(payment => {
        // Убеждаемся, что числа - это чистые числа без форматирования
        const revenue = typeof payment.revenue === 'number' ? payment.revenue : (parseFloat(payment.revenue) || 0);
        const paid = typeof payment.paid === 'number' ? payment.paid : (parseFloat(payment.paid) || 0);
        const difference = typeof payment.difference === 'number' ? payment.difference : (parseFloat(payment.difference) || 0);
        
        return [
            payment.period || '',
            revenue.toFixed(2).replace('.', ','), // Формат с запятой для Excel
            paid.toFixed(2).replace('.', ','),
            difference.toFixed(2).replace('.', ','),
            payment.status || '',
            payment.comment || ''
        ];
    });
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
            // Экранируем кавычки и оборачиваем в кавычки если содержит запятую или перенос строки
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM для правильной кодировки
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `выплаты_счета_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
    
    URL.revokeObjectURL(url);
}

