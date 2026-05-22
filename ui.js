// ui.js
// UI функции: таблицы, навигация, модальные окна, карточка сотрудника

// Навигация между экранами
function showScreen(screenName, action = null) {
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    
    // Обновляем навигацию
    elements.navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === screenName) {
            link.classList.add('active');
        }
    });
    
    // Обновляем активность кнопки "Партнер – Чайхана"
    const partnerNameBtn = document.querySelector('.brand-partner-name[data-page="home"]');
    if (partnerNameBtn) {
        if (screenName === 'home') {
            partnerNameBtn.style.opacity = '1';
            partnerNameBtn.style.transform = 'scale(1.05)';
        } else {
            partnerNameBtn.style.opacity = '0.9';
            partnerNameBtn.style.transform = 'scale(1)';
        }
    }
    
    // Показываем нужный экран
    currentScreen = screenName;
    
    switch(screenName) {
        case 'home':
            if (elements.homeScreen) elements.homeScreen.classList.remove('hidden');
            break;
        case 'payments':
            if (elements.paymentsScreen) elements.paymentsScreen.classList.remove('hidden');
            if (action === 'last-payments') {
                setTimeout(() => showLastPeriod(), 100);
            }
            break;
        case 'documents':
            if (elements.documentsScreen) elements.documentsScreen.classList.remove('hidden');
            if (action === 'unprocessed') {
                setTimeout(() => {
                    if (elements.docStatusFilter) {
                        elements.docStatusFilter.value = 'not-processed';
                        applyDocFilters();
                    }
                }, 100);
            }
            break;
        case 'dashboard':
            if (elements.dashboardScreen) elements.dashboardScreen.classList.remove('hidden');
            setTimeout(() => {
                _switchDashboardMode();
            }, 50);
            break;
        case 'rounds':
            if (elements.roundsScreen) {
                elements.roundsScreen.classList.remove('hidden');
                // Показываем таблицу или индикатор загрузки
                if (allRounds.length > 0) {
                    updateRoundsFilters();
                    applyRoundsFilters();
                    if (elements.roundsLoading)        elements.roundsLoading.classList.add('hidden');
                    if (elements.roundsTableContainer) elements.roundsTableContainer.classList.remove('hidden');
                }
            }
            break;
        case 'sos':
            if (elements.sosScreen) {
                elements.sosScreen.classList.remove('hidden');
                renderAttentionScreen();
            }
            break;
        case 'employee':
            if (elements.employeeScreen) {
                elements.employeeScreen.classList.remove('hidden');
                console.log('Экран сотрудника отображен');
            } else {
                console.error('Элемент employeeScreen не найден!');
            }
            break;
        case 'admin':
            if (elements.adminScreen) {
                elements.adminScreen.classList.remove('hidden');
                if (typeof initAdminScreen === 'function') initAdminScreen();
            }
            break;
    }
    
    console.log('Переключение на экран:', screenName);
}

// Переключение между ресторанным и общим дашбордом
function _switchDashboardMode() {
    const hasRestaurantDash = typeof renderRestaurantDashboard === 'function'
        && renderRestaurantDashboard() !== false;

    const genericEl = document.getElementById('generic-dashboard');

    // renderRestaurantDashboard показывает/скрывает #restaurant-dashboard сам
    // Если ресторанный дашборд активен — скрыть общий, иначе показать
    const rEl = document.getElementById('restaurant-dashboard');
    const isRestaurant = rEl && !rEl.classList.contains('hidden');

    if (genericEl) genericEl.style.display = isRestaurant ? 'none' : '';

    if (!isRestaurant) {
        renderDashboardCharts();
        if (typeof renderAccountsDashboard === 'function') renderAccountsDashboard();
    }
}

// Отображение таблицы выплат
function renderTable() {
    window.renderTableStartTime = performance.now();
    console.log('Отрисовка таблицы...');
    
    logEvent('ui.js:renderTable', 'Начало отрисовки таблицы', {
        filteredPaymentsCount: filteredPayments.length,
        currentPage: currentPage
    });
    
    // Убеждаемся, что данные объединены
    if (Object.keys(mergedData).length === 0 && allPayments.length > 0) {
        console.log('Данные не объединены, выполняю слияние...');
        mergeDataByINN();
    }
    
    if (!elements.tableBody) {
        console.error('Элемент tableBody не найден');
        return;
    }
    
    if (filteredPayments.length === 0) {
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px;">
                    <i class="fas fa-search" style="font-size: 2rem; color: #bdc3c7; margin-bottom: 15px; display: block;"></i>
                    <p>Нет данных, соответствующих фильтрам</p>
                </td>
            </tr>
        `;
        if (elements.rowCount) {
            elements.rowCount.textContent = '0';
        }
        return;
    }
    
    // Определяем диапазон отображаемых записей
    const startIndex = (currentPage - 1) * CONFIG.itemsPerPage;
    const endIndex = Math.min(startIndex + CONFIG.itemsPerPage, filteredPayments.length);
    const pagePayments = filteredPayments.slice(startIndex, endIndex);
    
    // Генерация строк таблицы
    let tableHTML = '';
    
    pagePayments.forEach(payment => {
        // Определяем класс для статуса
        const statusClass = getStatusClass(payment.status);
        
        // Получаем данные о документах (используем нормализованный ИНН)
        const normalizedINN = normalizeINN(payment.inn);
        
        const docData = normalizedINN ? mergedData[normalizedINN] : null;
        const docForStatus = docData && docData.documents ? docData.documents : null;
        
        // Отладочная информация (только для первых нескольких записей)
        if (pagePayments.indexOf(payment) < 3) {
            console.log(`Платеж: ${payment.employee}, ИНН: ${payment.inn}, нормализованный: ${normalizedINN}`);
            console.log(`  Найдены документы:`, !!docForStatus);
            if (docForStatus) {
                console.log(`  Статус документов:`, docForStatus.realStatus || docForStatus.documentStatus);
            }
        }
        
        const docStatusIndicator = getDocumentStatusIndicator(docForStatus);
        
        tableHTML += `
            <tr>
                <td>${payment.period}</td>
                <td>
                    <a href="#" class="employee-link" data-id="${payment.id}">
                        ${payment.employee}
                    </a>
                </td>
                <td>${formatPhone(payment.phone)}</td>
                <td>${payment.inn || '-'}</td>
                <td>${payment.formattedAmount}</td>
                <td class="${statusClass}">${payment.status}</td>
                <td>${docStatusIndicator}</td>
                <td>${payment.comment || '-'}</td>
            </tr>
        `;
    });
    
    elements.tableBody.innerHTML = tableHTML;
    if (elements.rowCount) {
        elements.rowCount.textContent = filteredPayments.length;
    }
    
    // Назначаем обработчики для ссылок на сотрудников
    document.querySelectorAll('.employee-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const paymentId = parseInt(link.getAttribute('data-id'));
            showEmployeeDetails(paymentId);
        });
    });
    
    const renderTime = performance.now() - (window.renderTableStartTime || performance.now());
    logEvent('ui.js:renderTable', 'Таблица отрисована', {
        totalPayments: filteredPayments.length,
        pagePayments: pagePayments.length,
        currentPage: currentPage,
        renderTime: renderTime.toFixed(2) + 'ms'
    });
    
    console.log('Таблица отрисована, записей:', filteredPayments.length);
}

// Индикатор статуса документов - показывает реальный статус из таблицы
function getDocumentStatusIndicator(doc) {
    // Проверяем что doc существует и не null
    if (!doc || doc === null) {
        return '<span class="doc-status-indicator status-partial"><i class="fas fa-question-circle"></i> Нет данных</span>';
    }
    
    // Если передан объект документа, используем реальный статус
    if (typeof doc === 'object' && doc.realStatus !== undefined) {
        const status = (doc.realStatus || '').toString().trim();
        if (!status) {
            return '<span class="doc-status-indicator status-partial"><i class="fas fa-question-circle"></i> Нет данных</span>';
        }
        
        // Определяем класс и иконку в зависимости от статуса
        // ВАЖНО: сначала проверяем "на оформлении", потом "оформлен", чтобы не перехватить неправильно
        let statusClass = 'status-partial';
        let icon = 'fa-exclamation-circle';
        
        const statusLower = status.toLowerCase();
        
        if (statusLower.includes('на оформлении')) {
            statusClass = 'status-warning';
            icon = 'fa-clock';
        } else if (statusLower.includes('уволен')) {
            statusClass = 'status-error';
            icon = 'fa-times-circle';
        } else if (statusLower.includes('оформлен') && !statusLower.includes('на оформлении')) {
            statusClass = 'status-ok';
            icon = 'fa-check-circle';
        } else if (statusLower.includes('обработке') || statusLower.includes('обновлено')) {
            statusClass = 'status-partial';
            icon = 'fa-clock';
        }
        
        return `<span class="doc-status-indicator ${statusClass}"><i class="fas ${icon}"></i> ${status}</span>`;
    }
    
    // Обратная совместимость для старого кода (если передана строка)
    if (typeof doc === 'string') {
        switch(doc) {
            case 'processed':
                return '<span class="doc-status-indicator status-ok"><i class="fas fa-check-circle"></i> Оформлен</span>';
            case 'partial':
                return '<span class="doc-status-indicator status-partial"><i class="fas fa-exclamation-circle"></i> Частично</span>';
            case 'not-processed':
                return '<span class="doc-status-indicator status-error"><i class="fas fa-times-circle"></i> Не оформлен</span>';
            default:
                return '<span class="doc-status-indicator status-partial"><i class="fas fa-question-circle"></i> Нет данных</span>';
        }
    }
    
    return '<span class="doc-status-indicator status-partial"><i class="fas fa-question-circle"></i> Нет данных</span>';
}

// Отображение таблицы документов
function renderDocumentsTable() {
    if (!elements.docTableBody) return;
    
    if (filteredDocuments.length === 0) {
        elements.docTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <i class="fas fa-search" style="font-size: 2rem; color: #bdc3c7; margin-bottom: 15px; display: block;"></i>
                    <p>Нет данных, соответствующих фильтрам</p>
                </td>
            </tr>
        `;
        if (elements.docRowCount) {
            elements.docRowCount.textContent = '0';
        }
        return;
    }
    
    let tableHTML = '';
    
    filteredDocuments.forEach(doc => {
        const statusIndicator = getDocumentStatusIndicator(doc);
        
        // Формируем отображение проблем
        let problemsBadge = '-';
        if (doc.problems && doc.problems.trim()) {
            const problemsText = doc.problems.trim();
            const problemsLower = problemsText.toLowerCase();
            
            // Если в проблемах написано "Собран" - не подсвечиваем красным
            if (problemsLower.includes('собран')) {
                problemsBadge = `<span title="${problemsText}">${problemsText.substring(0, 30)}${problemsText.length > 30 ? '...' : ''}</span>`;
            } else {
                // Для остальных случаев применяем красную подсветку
                problemsBadge = `<span class="problems-badge" title="${problemsText}">${problemsText.substring(0, 30)}${problemsText.length > 30 ? '...' : ''}</span>`;
            }
        }
        
        tableHTML += `
            <tr class="doc-table-row" data-inn="${doc.inn || ''}" style="cursor: pointer;">
                <td>
                    <a href="#" class="employee-link" data-inn="${doc.inn || ''}">
                        ${doc.employee}
                    </a>
                </td>
                <td>${formatPhone(doc.phone)}</td>
                <td>${doc.inn || '-'}</td>
                <td>${doc.position || '-'}</td>
                <td>${doc.restaurant || '-'}</td>
                <td>${statusIndicator}</td>
                <td>${problemsBadge}</td>
            </tr>
        `;
    });
    
    elements.docTableBody.innerHTML = tableHTML;
    if (elements.docRowCount) {
        elements.docRowCount.textContent = filteredDocuments.length;
    }
    
    // Назначаем обработчики для ссылок и строк на сотрудников (по ИНН)
    document.querySelectorAll('.employee-link[data-inn]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const inn = link.getAttribute('data-inn');
            showEmployeeDetailsByINN(inn);
        });
    });
    
    // Клик на строку также открывает карточку
    document.querySelectorAll('.doc-table-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Не открываем если кликнули на ссылку
            if (e.target.closest('.employee-link')) return;
            
            const inn = row.getAttribute('data-inn');
            showEmployeeDetailsByINN(inn);
        });
    });
}

// Сортировка таблицы выплат
function sortTable(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'desc';
    }
    
    updateSortIcons();
    sortPayments();
    renderTable();
}

// Обновление иконок сортировки
function updateSortIcons() {
    document.querySelectorAll('#payments-table th i').forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    
    const activeTh = document.querySelector(`#payments-table th[data-sort="${currentSort.field}"]`);
    if (activeTh) {
        const icon = activeTh.querySelector('i');
        icon.className = currentSort.direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
    }
}

// Сортировка таблицы документов
function sortDocumentTable(field) {
    if (currentDocSort.field === field) {
        currentDocSort.direction = currentDocSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentDocSort.field = field;
        currentDocSort.direction = 'asc';
    }
    
    sortDocuments();
    renderDocumentsTable();
}

// Пагинация
function changePage(delta) {
    const totalPages = Math.ceil(filteredPayments.length / CONFIG.itemsPerPage);
    const newPage = currentPage + delta;
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTable();
        updatePagination();
    }
}

function updatePagination() {
    const totalPages = Math.ceil(filteredPayments.length / CONFIG.itemsPerPage);
    
    if (elements.pageInfo) {
        elements.pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
    }
    if (elements.prevPageBtn) {
        elements.prevPageBtn.disabled = currentPage <= 1;
    }
    if (elements.nextPageBtn) {
        elements.nextPageBtn.disabled = currentPage >= totalPages;
    }
    if (elements.prevPageBtn && elements.prevPageBtn.parentElement) {
        elements.prevPageBtn.parentElement.classList.toggle('hidden', totalPages <= 1);
    }
}

// Экспорт в CSV
function exportToCSV() {
    if (filteredPayments.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }
    
    const headers = ['Период выплаты', 'Сотрудник', 'Телефон', 'Сумма из реестра', 'Статус', 'Комментарий'];
    const rows = filteredPayments.map(payment => [
        payment.period,
        payment.employee,
        payment.phone,
        payment.amount,
        payment.status,
        payment.comment || ''
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `выплаты_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
    
    URL.revokeObjectURL(url);
}

// Отображение деталей сотрудника
function showEmployeeDetails(paymentId) {
    console.log('Показать детали сотрудника, ID:', paymentId);
    
    // Находим платеж по ID
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) {
        console.error('Платеж не найден:', paymentId);
        return;
    }
    
    showEmployeeDetailsByINN(payment.inn, payment);
}

// Отображение деталей сотрудника по ИНН
function showEmployeeDetailsByINN(inn, payment = null) {
    // Нормализуем ИНН для поиска
    const normalizedINN = normalizeINN(inn);
    console.log('Поиск сотрудника по ИНН:', inn, 'нормализованный:', normalizedINN);
    
    // ⭐ ИЗМЕНЕНО: Если нет ИНН, пытаемся найти по телефону (fallback)
    if (!normalizedINN || normalizedINN === '') {
        console.warn('У сотрудника отсутствует ИНН, пытаемся найти по телефону');
        
        // Если есть выплата с телефоном, пытаемся найти документы по телефону
        if (payment && payment.phone) {
            const normalizedPhone = normalizePhone(payment.phone);
            const docByPhone = allDocuments.find(d => normalizePhone(d.phone) === normalizedPhone);
            
            if (docByPhone || payment) {
                // Нашли документы по телефону или есть выплата - создаем карточку
                currentEmployee = {
                    employee: docByPhone?.employee || payment.employee || '',
                    phone: payment.phone || docByPhone?.phone || '',
                    inn: docByPhone?.inn || '',
                    citizenship: docByPhone?.citizenship || '',
                    payment: payment || null,
                    document: docByPhone || null
                };
                
                currentEmployeePayments = allPayments.filter(p => normalizePhone(p.phone) === normalizedPhone);
                
                // Заполняем информацию о сотруднике
                if (elements.employeeName) {
                    elements.employeeName.textContent = currentEmployee.employee;
                }
                if (elements.employeePhone) {
                    elements.employeePhone.textContent = `📱 ${formatPhone(currentEmployee.phone)}`;
                }
                if (elements.employeeCitizenship && currentEmployee.citizenship) {
                    elements.employeeCitizenship.textContent = `🌍 ${currentEmployee.citizenship}`;
                }
                
                // Настраиваем Telegram ссылку
                if (elements.telegramLink && currentEmployee.phone) {
                    const phoneNumber = formatPhoneForTelegram(currentEmployee.phone);
                    const telegramUrl = `${CONFIG.telegramUrl}+${phoneNumber}`;
                    elements.telegramLink.href = telegramUrl;
                    elements.telegramLink.title = `Написать ${currentEmployee.employee} в Telegram`;
                }
                
                // Показываем предупреждение об отсутствии ИНН
                const mismatchWarning = document.getElementById('employee-mismatch-warning');
                if (mismatchWarning) {
                    mismatchWarning.innerHTML = `
                        <div class="mismatch-content">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div class="mismatch-text">
                                <strong>⚠️ Внимание:</strong> У сотрудника отсутствует ИНН в таблице выплат. 
                                Данные найдены по номеру телефона. Просьба добавить ИНН в таблицу "Выплаты".
                            </div>
                        </div>
                    `;
                    mismatchWarning.classList.remove('hidden');
                }
                
                showScreen('employee');
                renderEmployeeDocuments();
                renderEmployeeTable();
                
                return;
            }
        }
        
        // Если ничего не найдено - показываем сообщение
        showEmployeeNotFoundMessage(payment);
        return;
    }
    
    // Находим платеж если не передан
    if (!payment) {
        payment = allPayments.find(p => normalizeINN(p.inn) === normalizedINN);
    }
    
    // Находим документы по нормализованному ИНН
    const doc = allDocuments.find(d => normalizeINN(d.inn) === normalizedINN);
    
    // ⭐ ИЗМЕНЕНО: Если документы не найдены, но есть выплата - все равно показываем карточку
    // Только если нет ни выплаты, ни документов - показываем сообщение об ошибке
    if (!doc && !payment) {
        console.warn('Документы и выплаты не найдены по ИНН:', normalizedINN);
        showEmployeeNotFoundMessage(null);
        return;
    }
    
    // Если документы не найдены, но есть выплата - логируем это
    if (!doc && payment) {
        console.warn('Документы не найдены по ИНН, но есть выплата:', normalizedINN, payment.employee);
    }
    
    // Формируем объект текущего сотрудника
    // ⭐ ВАЖНО: ФИО берем из документов, если они есть, иначе из выплат
    currentEmployee = {
        employee: doc?.employee || payment?.employee || '', // Приоритет документам, но можно и из выплат
        phone: doc?.phone || payment?.phone || '',
        inn: normalizedINN,
        citizenship: doc?.citizenship || '',
        payment: payment || null,
        document: doc || null
    };
    
    console.log('Найден сотрудник:', currentEmployee);
    
    // Находим все платежи этого сотрудника по нормализованному ИНН
    currentEmployeePayments = allPayments.filter(p => normalizeINN(p.inn) === normalizedINN);
    
    // Если нет платежей, но есть документ - пытаемся найти платежи по телефону (fallback)
    if (currentEmployeePayments.length === 0 && doc && doc.phone) {
        const normalizedPhone = normalizePhone(doc.phone);
        currentEmployeePayments = allPayments.filter(p => normalizePhone(p.phone) === normalizedPhone);
    }
    
    // Заполняем информацию о сотруднике
    if (elements.employeeName) {
        elements.employeeName.textContent = currentEmployee.employee;
    }
    if (elements.employeePhone) {
        elements.employeePhone.textContent = `📱 ${formatPhone(currentEmployee.phone)}`;
    }
    if (elements.employeeCitizenship && currentEmployee.citizenship) {
        elements.employeeCitizenship.textContent = `🌍 ${currentEmployee.citizenship}`;
    }
    
    // Настраиваем Telegram ссылку
    if (elements.telegramLink && currentEmployee.phone) {
        const phoneNumber = formatPhoneForTelegram(currentEmployee.phone);
        const telegramUrl = `${CONFIG.telegramUrl}+${phoneNumber}`;
        elements.telegramLink.href = telegramUrl;
        elements.telegramLink.title = `Написать ${currentEmployee.employee} в Telegram`;
    }
    
    // Скрываем предупреждение о несовпадении (теперь работаем по ИНН, это неактуально)
    const mismatchWarning = document.getElementById('employee-mismatch-warning');
    if (mismatchWarning) {
        mismatchWarning.classList.add('hidden');
    }
    
    // Переключаем экраны ПЕРЕД отображением данных
    showScreen('employee');
    
    // Отображаем документы
    renderEmployeeDocuments();
    
    // Отображаем историю выплат
    renderEmployeeTable();
    
    console.log('Загружено выплат сотрудника:', currentEmployeePayments.length);
    console.log('Карточка сотрудника открыта:', currentEmployee.employee);
}

// Показать сообщение о том, что карточка сотрудника не найдена
function showEmployeeNotFoundMessage(payment = null) {
    const employeeName = payment?.employee || 'Сотрудник';
    const phone = payment?.phone || '';
    const inn = payment?.inn || '';
    
    // Переключаемся на экран сотрудника
    showScreen('employee');
    
    // Заполняем заголовок
    if (elements.employeeName) {
        elements.employeeName.textContent = employeeName;
    }
    if (elements.employeePhone) {
        elements.employeePhone.textContent = phone ? `📱 ${formatPhone(phone)}` : '';
    }
    if (elements.employeeCitizenship) {
        elements.employeeCitizenship.textContent = '';
    }
    
    // Скрываем Telegram ссылку
    if (elements.telegramLink) {
        elements.telegramLink.style.display = 'none';
    }
    
    // Скрываем предупреждения
    const mismatchWarning = document.getElementById('employee-mismatch-warning');
    if (mismatchWarning) {
        mismatchWarning.classList.add('hidden');
    }
    const employeeWarning = document.getElementById('employee-warning');
    if (employeeWarning) {
        employeeWarning.classList.add('hidden');
    }
    
    // Создаем сообщение с просьбой отправить данные
    const messageHTML = `
        <div class="employee-not-found-message">
            <div class="not-found-icon">⚠️</div>
            <h2>Карточка сотрудника не найдена</h2>
            <p>Для сотрудника <strong>${employeeName}</strong> отсутствует ИНН или документы не найдены в системе.</p>
            <div class="not-found-details">
                ${phone ? `<p><strong>Телефон:</strong> ${formatPhone(phone)}</p>` : ''}
                ${inn ? `<p><strong>ИНН:</strong> ${inn}</p>` : '<p><strong>ИНН:</strong> не указан</p>'}
            </div>
            <div class="not-found-action">
                <p><strong>Просьба отправить в чат партнеров:</strong></p>
                <ul>
                    <li>ФИО сотрудника</li>
                    <li>Номер телефона</li>
                    <li>ИНН сотрудника</li>
                </ul>
                <p>После добавления данных карточка сотрудника будет доступна.</p>
            </div>
        </div>
    `;
    
    // Скрываем загрузку документов и таблицу выплат
    const employeeDocsLoading = document.getElementById('employee-docs-loading');
    if (employeeDocsLoading) {
        employeeDocsLoading.classList.add('hidden');
    }
    const employeeDocuments = document.getElementById('employee-documents');
    if (employeeDocuments) {
        employeeDocuments.classList.add('hidden');
    }
    const employeeLoading = document.getElementById('employee-loading');
    if (employeeLoading) {
        employeeLoading.classList.add('hidden');
    }
    const employeeTableContainer = document.getElementById('employee-table-container');
    if (employeeTableContainer) {
        employeeTableContainer.classList.add('hidden');
    }
    
    // Вставляем сообщение в контейнер информации о документах
    const employeeInfo = document.querySelector('.employee-info');
    if (employeeInfo) {
        employeeInfo.innerHTML = messageHTML;
    } else {
        // Если контейнера нет, создаем его
        const employeeScreen = document.getElementById('employee-screen');
        if (employeeScreen) {
            const newInfoDiv = document.createElement('div');
            newInfoDiv.className = 'employee-info';
            newInfoDiv.innerHTML = messageHTML;
            employeeScreen.appendChild(newInfoDiv);
        }
    }
}

// Показать предупреждение о несовпадении данных
function showEmployeeDataMismatchWarning(paymentName, docName, paymentPhone, docPhone) {
    // Создаем или находим элемент предупреждения
    let warningElement = document.getElementById('employee-mismatch-warning');
    
    if (!warningElement) {
        // Создаем элемент если его нет
        warningElement = document.createElement('div');
        warningElement.id = 'employee-mismatch-warning';
        warningElement.className = 'employee-mismatch-warning';
        
        // Вставляем после заголовка сотрудника
        const employeeHeader = document.querySelector('.employee-header');
        if (employeeHeader && employeeHeader.parentElement) {
            employeeHeader.parentElement.insertBefore(warningElement, employeeHeader.nextSibling);
        }
    }
    
    const nameDiff = paymentName.toLowerCase().trim() !== docName.toLowerCase().trim();
    const phoneDiff = normalizePhone(paymentPhone) !== normalizePhone(docPhone);
    
    let message = '<strong>⚠️ Внимание: Данные сотрудника различаются между листами</strong><br><br>';
    
    if (nameDiff) {
        message += `• <strong>Имя в выплатах:</strong> ${paymentName || 'не указано'}<br>`;
        message += `• <strong>Имя в документах:</strong> ${docName || 'не указано'}<br><br>`;
    }
    
    if (phoneDiff) {
        message += `• <strong>Телефон в выплатах:</strong> ${formatPhone(paymentPhone) || 'не указано'}<br>`;
        message += `• <strong>Телефон в документах:</strong> ${formatPhone(docPhone) || 'не указано'}<br><br>`;
    }
    
    message += 'Если вы видите уведомление о том, что сотрудник не оформлен, перейдите в раздел "Документы" и попробуйте найти его по имени или телефону.<br>';
    message += 'В дальнейшем мы добавим уникальный идентификатор сотрудника для корректной работы системы.';
    
    warningElement.innerHTML = `
        <div class="mismatch-content">
            <i class="fas fa-exclamation-triangle"></i>
            <div class="mismatch-text">${message}</div>
        </div>
    `;
    
    warningElement.classList.remove('hidden');
}

// Отображение таблицы выплат сотрудника
function renderEmployeeTable() {
    if (!elements.employeeTableBody) return;
    
    if (currentEmployeePayments.length === 0) {
        elements.employeeTableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px;">
                    Нет данных о выплатах
                </td>
            </tr>
        `;
        if (elements.totalPayments) elements.totalPayments.textContent = '0';
        if (elements.totalAmount) elements.totalAmount.textContent = '0';
        if (elements.lastPaymentDate) elements.lastPaymentDate.textContent = '-';
        return;
    }
    
    // Сортируем по периоду (от новых к старым)
    currentEmployeePayments.sort((a, b) => b.period.localeCompare(a.period));
    
    // Генерация строк таблицы
    let tableHTML = '';
    let totalAmount = 0;
    let lastPayment = '';
    
    currentEmployeePayments.forEach(payment => {
        const statusClass = getStatusClass(payment.status);
        
        tableHTML += `
            <tr>
                <td>${payment.period}</td>
                <td>${payment.formattedAmount}</td>
                <td class="${statusClass}">${payment.status}</td>
                <td>${payment.comment || '-'}</td>
            </tr>
        `;
        
        totalAmount += payment.amount;
        
        // Определяем последнюю выплату
        if (!lastPayment || payment.period > lastPayment) {
            lastPayment = payment.period;
        }
    });
    
    elements.employeeTableBody.innerHTML = tableHTML;
    if (elements.totalPayments) elements.totalPayments.textContent = currentEmployeePayments.length;
    if (elements.totalAmount) elements.totalAmount.textContent = formatCurrency(totalAmount);
    if (elements.lastPaymentDate) elements.lastPaymentDate.textContent = lastPayment;
    
    // Показываем таблицу
    if (elements.employeeLoading) elements.employeeLoading.classList.add('hidden');
    if (elements.employeeTableContainer) elements.employeeTableContainer.classList.remove('hidden');
    if (elements.employeeError) elements.employeeError.classList.add('hidden');
}

// Сортировка таблицы сотрудника
function sortEmployeeTable(field) {
    currentEmployeePayments.sort((a, b) => {
        if (field === 'period') {
            return b.period.localeCompare(a.period);
        } else if (field === 'amount') {
            return b.amount - a.amount;
        } else if (field === 'status') {
            return a.status.localeCompare(b.status);
        }
        return 0;
    });
    
    renderEmployeeTable();
}

// Отображение документов сотрудника
function renderEmployeeDocuments() {
    if (!currentEmployee) return;
    
    // Показываем загрузку
    if (elements.employeeDocsLoading) elements.employeeDocsLoading.classList.remove('hidden');
    if (elements.employeeDocuments) elements.employeeDocuments.classList.add('hidden');
    
    setTimeout(() => {
        const doc = currentEmployee.document;
        
        if (!doc) {
            // Нет данных о документах, но есть выплаты - показываем информативное сообщение
            const hasPayments = currentEmployeePayments && currentEmployeePayments.length > 0;
            const inn = currentEmployee.inn || '';
            
            if (elements.employeeWarning) {
                const warningReason = document.getElementById('warning-reason');
                if (warningReason) {
                    let message = '';
                    if (hasPayments) {
                        message = `
                            <strong>⚠️ Документы не найдены в системе</strong><br><br>
                            Для сотрудника <strong>${currentEmployee.employee || 'не указано'}</strong> найдены выплаты, но документы отсутствуют.<br><br>
                            ${inn ? `<strong>ИНН:</strong> ${inn}<br>` : '<strong>ИНН:</strong> не указан<br>'}
                            <strong>Телефон:</strong> ${currentEmployee.phone ? formatPhone(currentEmployee.phone) : 'не указан'}<br><br>
                            <strong>Возможные причины:</strong><br>
                            1. Документы не поданы в систему<br>
                            2. ИНН в таблице "Документы" отличается от ИНН в таблице "Выплаты"<br>
                            3. Оформление через другого оператора<br><br>
                            <strong>Действия:</strong><br>
                            1. Проверьте ИНН сотрудника в таблице "Документы"<br>
                            2. Если документы не поданы — подайте их срочно<br>
                            3. Свяжитесь с оператором для уточнения данных
                        `;
                    } else {
                        message = `
                            <strong>Возможные причины:</strong><br>
                            1. Документы не поданы<br>
                            2. Неверный ИНН в таблице<br>
                            3. Оформление через другого оператора<br><br>
                            <strong>Действия:</strong><br>
                            1. Проверьте ИНН в таблице документов<br>
                            2. Если не подавали — подайте документы срочно<br>
                            3. Свяжитесь с оператором
                        `;
                    }
                    warningReason.innerHTML = message;
                }
                elements.employeeWarning.classList.remove('hidden');
            }
            
            // Показываем пустой блок документов с сообщением
            const documentsGrid = elements.employeeDocuments?.querySelector('.documents-grid');
            if (documentsGrid) {
                documentsGrid.innerHTML = `
                    <div class="document-item status-error" style="grid-column: 1 / -1;">
                        <div class="document-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="document-info">
                            <div class="document-label">Документы не найдены</div>
                            <div class="document-value">Проверьте данные в таблице "Документы"</div>
                        </div>
                    </div>
                `;
            }
            
            if (elements.employeeDocsLoading) elements.employeeDocsLoading.classList.add('hidden');
            if (elements.employeeDocuments) elements.employeeDocuments.classList.remove('hidden');
            return;
        }
        
        // Скрываем предупреждение если документы есть
        if (elements.employeeWarning) elements.employeeWarning.classList.add('hidden');
        
        // Проверяем статус "Оформлен" в первой колонке (collected или inProcess)
        const isProcessed = (doc.collected && doc.collected.toLowerCase().includes('оформлен')) || 
                           (doc.inProcess && doc.inProcess.toLowerCase().includes('оформлен'));
        
        // Формируем список документов
        let documentsHTML = '';
        
        // Паспорт
        documentsHTML += `
            <div class="document-item ${doc.passportData ? 'status-ok' : 'status-error'}">
                <div class="document-icon">
                    <i class="fas fa-${doc.passportData ? 'check-circle' : 'times-circle'}"></i>
                </div>
                <div class="document-info">
                    <div class="document-label">Паспорт</div>
                    <div class="document-value">${doc.passportData || 'Отсутствует'}</div>
                    ${doc.passportIssueDate ? `<small style="color: var(--gray-600);">Выдан: ${formatDateRussian(doc.passportIssueDate)}</small>` : ''}
                </div>
            </div>
        `;
        
        // Дата рождения
        if (doc.birthDate) {
            documentsHTML += `
                <div class="document-item status-ok">
                    <div class="document-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="document-info">
                        <div class="document-label">Дата рождения</div>
                        <div class="document-value">${formatDateRussian(doc.birthDate)}</div>
                    </div>
                </div>
            `;
        }
        
        // Регистрация
        documentsHTML += `
            <div class="document-item ${doc.registrationEndDate ? 'status-warning' : 'status-error'}">
                <div class="document-icon">
                    <i class="fas fa-${doc.registrationEndDate ? 'exclamation-circle' : 'times-circle'}"></i>
                </div>
                <div class="document-info">
                    <div class="document-label">Регистрация</div>
                    <div class="document-value">${doc.registrationEndDate ? `Истекает: ${formatDateRussian(doc.registrationEndDate)}` : 'Отсутствует'}</div>
                </div>
            </div>
        `;
        
        // Патент
        documentsHTML += `
            <div class="document-item ${doc.patentIssueDate ? 'status-ok' : 'status-error'}">
                <div class="document-icon">
                    <i class="fas fa-${doc.patentIssueDate ? 'check-circle' : 'times-circle'}"></i>
                </div>
                <div class="document-info">
                    <div class="document-label">Патент</div>
                    <div class="document-value">${doc.patentIssueDate ? `Выдан: ${formatDateRussian(doc.patentIssueDate)}` : 'Отсутствует'}</div>
                </div>
            </div>
        `;
        
        // Договор
        documentsHTML += `
            <div class="document-item ${doc.contractDate ? 'status-ok' : 'status-error'}">
                <div class="document-icon">
                    <i class="fas fa-${doc.contractDate ? 'check-circle' : 'times-circle'}"></i>
                </div>
                <div class="document-info">
                    <div class="document-label">Договор</div>
                    <div class="document-value">${doc.contractDate ? `Заключён: ${formatDateRussian(doc.contractDate)}` : 'Отсутствует'}</div>
                    ${doc.contractLink ? `<small><a href="${doc.contractLink}" target="_blank">Ссылка на договор</a></small>` : ''}
                </div>
            </div>
        `;
        
        // Ссылка на полный пакет
        if (doc.documentsLink) {
            documentsHTML += `
                <div class="document-item status-ok" style="grid-column: 1 / -1;">
                    <div class="document-icon">
                        <i class="fas fa-link"></i>
                    </div>
                    <div class="document-info">
                        <div class="document-label">Полный пакет документов</div>
                        <div class="document-value">
                            <a href="${doc.documentsLink}" target="_blank">${doc.documentsLink}</a>
                        </div>
                    </div>
                </div>
            `;
        }
        
        const documentsGrid = elements.employeeDocuments?.querySelector('.documents-grid');
        if (documentsGrid) {
            documentsGrid.innerHTML = documentsHTML;
        }
        
        // Проблемы - показываем только если статус НЕ "Оформлен"
        if (!isProcessed && doc.problems && doc.problems.trim()) {
            const problems = doc.problems.split(',').map(p => p.trim()).filter(Boolean);
            if (elements.problemsList) {
                elements.problemsList.innerHTML = problems.map(p => `<li>${p}</li>`).join('');
            }
            if (elements.employeeProblems) {
                elements.employeeProblems.classList.remove('hidden');
            }
        } else {
            if (elements.employeeProblems) {
                elements.employeeProblems.classList.add('hidden');
            }
        }
        
        // Рекомендации
        const recommendations = generateRecommendations(doc);
        if (recommendations.length > 0) {
            if (elements.recommendationsList) {
                elements.recommendationsList.innerHTML = recommendations.map(r => `<li>${r}</li>`).join('');
            }
            if (elements.employeeRecommendations) {
                elements.employeeRecommendations.classList.remove('hidden');
            }
        } else {
            if (elements.employeeRecommendations) {
                elements.employeeRecommendations.classList.add('hidden');
            }
        }
        
        // Показываем документы
        if (elements.employeeDocsLoading) elements.employeeDocsLoading.classList.add('hidden');
        if (elements.employeeDocuments) elements.employeeDocuments.classList.remove('hidden');
    }, 300);
}

// Генерация рекомендаций
function generateRecommendations(doc) {
    // Проверяем статус "Оформлен" - если оформлен, не показываем рекомендации
    const isProcessed = (doc.collected && doc.collected.toLowerCase().includes('оформлен')) || 
                       (doc.inProcess && doc.inProcess.toLowerCase().includes('оформлен'));
    
    if (isProcessed) {
        return []; // Если оформлен - нет рекомендаций
    }
    
    const recommendations = [];
    
    if (!doc.passportData) {
        recommendations.push('Запросить паспорт у сотрудника');
    }
    
    if (!doc.registrationEndDate) {
        recommendations.push('Проверить наличие регистрации');
    }
    
    if (!doc.patentIssueDate) {
        recommendations.push('Запросить патент у сотрудника');
    }
    
    if (!doc.contractDate) {
        recommendations.push('Заключить договор');
    }
    
    if (doc.registrationEndDate) {
        const endDate = new Date(doc.registrationEndDate.split('.').reverse().join('-'));
        const now = new Date();
        const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 30 && daysUntilExpiry > 0) {
            recommendations.push(`Регистрация истекает через ${daysUntilExpiry} дней. Необходимо продление`);
        }
    }
    
    if (doc.problems && doc.problems.toLowerCase().includes('качество')) {
        recommendations.push('Перезагрузить скан паспорта с лучшим качеством');
    }
    
    return recommendations;
}

// Вспомогательные функции UI
function showMainScreen() {
    showScreen('home');
}

function showLoading() {
    if (elements.loading) elements.loading.classList.remove('hidden');
    if (elements.tableContainer) elements.tableContainer.classList.add('hidden');
    if (elements.errorMessage) elements.errorMessage.classList.add('hidden');
}

function hideLoading() {
    if (elements.loading) elements.loading.classList.add('hidden');
    if (elements.tableContainer) elements.tableContainer.classList.remove('hidden');
}

function showError() {
    if (elements.loading) elements.loading.classList.add('hidden');
    if (elements.tableContainer) elements.tableContainer.classList.add('hidden');
    if (elements.errorMessage) elements.errorMessage.classList.remove('hidden');
}

function hideError() {
    if (elements.errorMessage) elements.errorMessage.classList.add('hidden');
    hideLoading();
}

function showWarning(message) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'warning-message';
    warningDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <p>${message}</p>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.prepend(warningDiv);
    }
}

// ── Таблица объездов ─────────────────────────────────────────────────────────
function renderRoundsTable() {
    if (!elements.roundsTableBody) return;

    if (elements.roundsRowCount) {
        elements.roundsRowCount.textContent = filteredRounds.length;
    }

    if (filteredRounds.length === 0) {
        elements.roundsTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;padding:40px;">
                    <i class="fas fa-search" style="font-size:2rem;color:#bdc3c7;display:block;margin-bottom:15px;"></i>
                    <p>Нет данных, соответствующих фильтрам</p>
                </td>
            </tr>`;
        return;
    }

    const statusClass = (s) => {
        const sl = (s || '').toLowerCase();
        if (sl.includes('доставлено'))      return 'status-paid';
        if (sl.includes('отменено'))        return 'status-unpaid';
        if (sl.includes('зпланировано') || sl.includes('запланировано')) return 'status-pending';
        if (sl.includes('готовится'))       return 'status-processing';
        return '';
    };

    let html = '';
    filteredRounds.forEach((r, i) => {
        html += `
            <tr>
                <td>${r.id}</td>
                <td>${r.restaurant || '-'}</td>
                <td>${r.employeeName || '-'}</td>
                <td>${r.employeeInn || '-'}</td>
                <td>${r.plannedVisitDate || '-'}</td>
                <td class="${statusClass(r.status)}">${r.status || '-'}</td>
                <td>${r.contractDeliveryDate || '-'}</td>
                <td>${r.adminComment || '-'}</td>
            </tr>`;
    });

    elements.roundsTableBody.innerHTML = html;

    if (elements.roundsLoading)        elements.roundsLoading.classList.add('hidden');
    if (elements.roundsTableContainer) elements.roundsTableContainer.classList.remove('hidden');
}

function updateLastUpdateTime() {
    const now = new Date();
    const formattedTime = now.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    if (elements.lastUpdate) {
        elements.lastUpdate.textContent = `Последнее обновление: ${formattedTime}`;
    }
}

// Функция форматирования валюты (используется в charts.js для счетов)
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// ── Экран «Требующее внимания» ────────────────────────────────────────────────
function renderAttentionScreen() {
    const wrap = document.getElementById('attention-content');
    if (!wrap) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    function parseDate(str) {
        if (!str) return null;
        const m = String(str).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (!m) return null;
        return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    }

    function daysLeft(dateStr) {
        const d = parseDate(dateStr);
        if (!d) return null;
        return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
    }

    const issues = {
        unpaid:       [],   // не выплатили в последнем периоде
        notPaying:    [],   // статус «Не платим»
        regExpiring:  [],   // регистрация истекает ≤ 60 дн
        patExpiring:  [],   // патент истекает ≤ 60 дн (с даты выдачи + 1 год)
        withIssues:   [],   // есть запись в поле «Проблемы»
    };

    // --- Не выплачено в последнем периоде ---
    if (allPayments && allPayments.length) {
        const periods = [...new Set(allPayments.map(p => p.period))].filter(Boolean).sort();
        const lastPeriod = periods[periods.length - 1];
        const paidINNs = new Set(
            allPayments
                .filter(p => p.period === lastPeriod && p.status !== 'Не платим' && p.inn)
                .map(p => p.inn)
        );
        if (allDocuments) {
            allDocuments.forEach(d => {
                if (d.inn && !paidINNs.has(d.inn) && !d.dismissedDate) {
                    issues.unpaid.push({ name: d.employee, inn: d.inn, restaurant: d.restaurant });
                }
            });
        }

        // --- «Не платим» ---
        const notPaySet = new Set();
        allPayments.filter(p => p.status === 'Не платим').forEach(p => {
            if (!notPaySet.has(p.inn)) {
                notPaySet.add(p.inn);
                issues.notPaying.push({ name: p.employee, inn: p.inn, period: p.period });
            }
        });
    }

    // --- Истекающие документы ---
    if (allDocuments) {
        allDocuments.forEach(d => {
            if (d.dismissedDate) return;

            const regDays = daysLeft(d.registrationEndDate);
            if (regDays !== null && regDays <= 60) {
                issues.regExpiring.push({
                    name: d.employee, inn: d.inn, restaurant: d.restaurant,
                    date: d.registrationEndDate, days: regDays
                });
            }

            // Патент действует 1 год с даты выдачи
            const patDate = parseDate(d.patentIssueDate);
            if (patDate) {
                const expiry = new Date(patDate.getFullYear() + 1, patDate.getMonth(), patDate.getDate());
                const patDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                if (patDays <= 60) {
                    issues.patExpiring.push({
                        name: d.employee, inn: d.inn, restaurant: d.restaurant,
                        date: expiry.toLocaleDateString('ru-RU'), days: patDays
                    });
                }
            }

            if (d.problems && d.problems.trim()) {
                issues.withIssues.push({ name: d.employee, inn: d.inn, restaurant: d.restaurant, text: d.problems });
            }
        });
    }

    // --- Рендер ---
    function badge(days) {
        if (days === null) return '';
        const cls = days < 0 ? 'er' : days <= 14 ? 'ca' : 'in';
        const label = days < 0 ? `просрочено ${Math.abs(days)} дн` : `через ${days} дн`;
        return `<span style="font-size:11px;padding:2px 7px;border-radius:999px;background:var(--${cls}-bg);color:var(--${cls}-fg);font-weight:600;margin-left:6px">${label}</span>`;
    }

    function section(icon, title, color, items, rowFn, emptyText) {
        const count = items.length;
        const dot = count ? `<span style="background:var(--${color}-fg);color:#fff;border-radius:999px;padding:1px 8px;font-size:12px;margin-left:8px">${count}</span>` : '';
        const rows = count
            ? items.map(rowFn).join('')
            : `<div style="color:var(--tx3);font-size:13px;padding:12px 0">${emptyText}</div>`;
        return `
        <div style="background:var(--surface);border:1px solid var(--bdr-line);border-radius:var(--r-lg);padding:20px 24px;margin-bottom:16px">
            <div style="font-size:15px;font-weight:700;color:var(--tx);margin-bottom:14px">
                <i class="fas ${icon}" style="color:var(--${color}-fg);margin-right:8px"></i>${title}${dot}
            </div>
            ${rows}
        </div>`;
    }

    function empRow(item, extra) {
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bdr-line);font-size:13px">
            <span style="font-weight:600;color:var(--tx);min-width:200px">${item.name || '—'}</span>
            <span style="color:var(--tx2)">${item.restaurant || ''}</span>
            ${extra || ''}
        </div>`;
    }

    const total = issues.unpaid.length + issues.notPaying.length +
                  issues.regExpiring.length + issues.patExpiring.length + issues.withIssues.length;

    wrap.innerHTML = total === 0
        ? `<div style="text-align:center;padding:60px 0;color:var(--tx2)"><i class="fas fa-check-circle" style="font-size:48px;color:var(--ok-fg);display:block;margin-bottom:16px"></i><div style="font-size:17px;font-weight:600">Всё в порядке</div><div style="font-size:14px;margin-top:6px">Проблем не обнаружено</div></div>`
        : section('fa-money-bill-wave', 'Не выплачено в последнем периоде', 'er',
              issues.unpaid, i => empRow(i, `<span style="color:var(--tx3)">${i.inn || ''}</span>`), 'Все выплаты произведены ✓') +
          section('fa-ban', 'Статус «Не платим»', 'ca',
              issues.notPaying, i => empRow(i, `<span style="color:var(--tx3)">${i.period || ''}</span>`), 'Нет записей') +
          section('fa-id-card', 'Истекает регистрация (≤ 60 дней)', 'ca',
              issues.regExpiring, i => empRow(i, `${i.date}${badge(i.days)}`), 'Регистрации в норме ✓') +
          section('fa-file-contract', 'Истекает патент (≤ 60 дней)', 'ca',
              issues.patExpiring, i => empRow(i, `${i.date}${badge(i.days)}`), 'Патенты в норме ✓') +
          section('fa-exclamation-circle', 'Проблемы с документами', 'er',
              issues.withIssues, i => empRow(i, `<span style="color:var(--er-fg)">${i.text}</span>`), 'Проблем нет ✓');
}

// ══════════════════════════════════════════════════════════════
// МОДАЛКА: Добавить сотрудника
// ══════════════════════════════════════════════════════════════
function openAddEmployeeModal() {
    const modal = document.getElementById('add-employee-modal');
    if (!modal) { console.error('Modal #add-employee-modal not found'); return; }

    // Показываем сразу
    modal.classList.remove('hidden');

    // Сброс формы
    ['ae-name','ae-inn','ae-phone','ae-position','ae-citizenship'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    ['ae-restaurant','ae-docstatus'].forEach(id => {
        const el = document.getElementById(id); if (el) el.selectedIndex = 0;
    });
    const msg = document.getElementById('ae-msg');
    if (msg) msg.textContent = '';

    // Заполняем список ресторанов асинхронно (после показа)
    const sel = document.getElementById('ae-restaurant');
    if (sel && sel.options.length <= 1) {
        const db = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (db) {
            db.from('restaurants').select('id, name').order('name').then(({ data }) => {
                (data || []).forEach(r => {
                    if (sel.querySelector(`option[value="${r.id}"]`)) return;
                    const o = document.createElement('option');
                    o.value = r.id; o.textContent = r.name;
                    sel.appendChild(o);
                });
            });
        }
    }
}

function closeAddEmployeeModal() {
    document.getElementById('add-employee-modal')?.classList.add('hidden');
}

async function submitAddEmployee() {
    const name       = document.getElementById('ae-name')?.value.trim();
    const inn        = document.getElementById('ae-inn')?.value.trim().replace(/\D/g,'') || null;
    const phone      = document.getElementById('ae-phone')?.value.trim() || null;
    const position   = document.getElementById('ae-position')?.value.trim() || null;
    const citizen    = document.getElementById('ae-citizenship')?.value.trim() || null;
    const restId     = document.getElementById('ae-restaurant')?.value || null;
    const docStatus  = document.getElementById('ae-docstatus')?.value || null;
    const msg        = document.getElementById('ae-msg');
    const btn        = document.getElementById('ae-submit-btn');

    if (!name) {
        if (msg) { msg.style.color = 'var(--er-fg)'; msg.textContent = 'Введите ФИО сотрудника'; }
        return;
    }

    if (btn) btn.disabled = true;
    if (msg) { msg.style.color = 'var(--tx2)'; msg.textContent = 'Сохранение…'; }

    const db = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (!db) { if (msg) { msg.style.color='var(--er-fg)'; msg.textContent='Нет подключения к БД'; } if(btn) btn.disabled=false; return; }

    try {
        // 1. Вставляем сотрудника
        const empData = { full_name: name };
        if (inn)      empData.inn         = inn;
        if (phone)    empData.phone       = phone;
        if (position) empData.position    = position;
        if (citizen)  empData.citizenship = citizen;

        const { data: empRow, error: empErr } = await db.from('employees').insert(empData).select('id').single();
        if (empErr) throw empErr;

        // 2. Привязываем к ресторану
        if (restId) {
            await db.from('salary_sheets').insert({ employee_id: empRow.id, restaurant_id: parseInt(restId) });
        }

        // 3. Статус документов
        if (docStatus) {
            await db.from('employee_documents').insert({ employee_id: empRow.id, doc_status: docStatus });
        }

        if (msg) { msg.style.color = 'var(--ok-fg)'; msg.textContent = `✓ Сотрудник «${name}» добавлен`; }
        setTimeout(() => {
            closeAddEmployeeModal();
            if (typeof loadData === 'function') loadData();
        }, 1200);
    } catch(e) {
        if (msg) { msg.style.color = 'var(--er-fg)'; msg.textContent = 'Ошибка: ' + e.message; }
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ══════════════════════════════════════════════════════════════
// ФОРМА ОБЪЕЗДА: Заказать документы
// ══════════════════════════════════════════════════════════════
let _dofEmployeeId = null; // выбранный сотрудник

function openDocOrderForm() {
    const form = document.getElementById('doc-order-form');
    if (!form) { console.error('doc-order-form not found'); return; }

    // Сброс и показ сразу
    _dofEmployeeId = null;
    ['dof-employee','dof-reason','dof-comment'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    const dateEl = document.getElementById('dof-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    const msg = document.getElementById('dof-msg'); if(msg) msg.textContent='';

    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Заполняем рестораны асинхронно
    const restSel = document.getElementById('dof-restaurant');
    if (restSel && restSel.options.length <= 1) {
        const db = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (db) {
            const allowed = typeof getUserRestaurants === 'function' ? getUserRestaurants() : null;
            db.from('restaurants').select('id, name').order('name').then(({ data }) => {
                (data || []).forEach(r => {
                    if (allowed && !allowed.map(n=>n.toUpperCase()).includes(r.name.toUpperCase())) return;
                    if (restSel.querySelector(`option[value="${r.id}"]`)) return;
                    const o = document.createElement('option');
                    o.value = r.id; o.textContent = r.name;
                    restSel.appendChild(o);
                });
            });
        }
    }

    // Автодополнение по сотруднику
    const empInput = document.getElementById('dof-employee');
    const suggBox  = document.getElementById('dof-employee-suggestions');
    if (empInput && !empInput._dofBound) {
        empInput._dofBound = true;
        empInput.addEventListener('input', async () => {
            const q = empInput.value.trim();
            if (q.length < 2) { suggBox.classList.add('hidden'); return; }
            const db = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            if (!db) return;
            const { data } = await db.from('employees')
                .select('id, full_name, inn')
                .ilike('full_name', `%${q}%`)
                .limit(8);
            if (!data?.length) { suggBox.classList.add('hidden'); return; }
            suggBox.innerHTML = data.map(e =>
                `<div class="emp-sug-item" data-id="${e.id}" data-name="${e.full_name}">
                    <strong>${e.full_name}</strong>${e.inn ? ` <span style="color:var(--tx3);font-size:11px">ИНН ${e.inn}</span>` : ''}
                </div>`).join('');
            suggBox.classList.remove('hidden');
            suggBox.querySelectorAll('.emp-sug-item').forEach(item => {
                item.addEventListener('mousedown', () => {
                    _dofEmployeeId = parseInt(item.dataset.id);
                    empInput.value = item.dataset.name;
                    suggBox.classList.add('hidden');
                });
            });
        });
        empInput.addEventListener('blur', () => setTimeout(() => suggBox.classList.add('hidden'), 200));
    }
}

function closeDocOrderForm() {
    document.getElementById('doc-order-form')?.classList.add('hidden');
}

async function submitDocOrder() {
    const empName  = document.getElementById('dof-employee')?.value.trim();
    const restId   = document.getElementById('dof-restaurant')?.value;
    const date     = document.getElementById('dof-date')?.value;
    const reason   = document.getElementById('dof-reason')?.value.trim() || null;
    const comment  = document.getElementById('dof-comment')?.value.trim() || null;
    const msg      = document.getElementById('dof-msg');

    if (!empName) { if(msg){msg.style.color='var(--er-fg)';msg.textContent='Укажите сотрудника';} return; }
    if (!restId)  { if(msg){msg.style.color='var(--er-fg)';msg.textContent='Выберите ресторан';} return; }
    if (!date)    { if(msg){msg.style.color='var(--er-fg)';msg.textContent='Укажите дату';} return; }

    const db = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (!db) { if(msg){msg.style.color='var(--er-fg)';msg.textContent='Нет подключения к БД';} return; }

    if(msg){msg.style.color='var(--tx2)';msg.textContent='Создание…';}

    try {
        // Если сотрудник не выбран из списка — ищем по имени
        let empId = _dofEmployeeId;
        if (!empId) {
            const { data } = await db.from('employees').select('id').ilike('full_name', empName).limit(1);
            empId = data?.[0]?.id || null;
        }

        const record = {
            restaurant_id: parseInt(restId),
            planned_date:  date,
            status:        'Запланировано',
        };
        if (empId)   record.employee_id  = empId;
        if (reason)  record.paper_reason = reason;
        if (comment) record.admin_comment = comment;

        const { error } = await db.from('document_visits').insert(record);
        if (error) throw error;

        if(msg){msg.style.color='var(--ok-fg)';msg.textContent='✓ Заказ создан';}
        setTimeout(() => {
            closeDocOrderForm();
            if (typeof loadData === 'function') loadData();
        }, 1000);
    } catch(e) {
        if(msg){msg.style.color='var(--er-fg)';msg.textContent='Ошибка: '+e.message;}
    }
}
