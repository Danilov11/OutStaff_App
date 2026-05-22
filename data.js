// data.js
// Работа с данными: фильтры, сортировка, статистика, объединение данных

// Нормализация ИНН для сравнения
function normalizeINN(inn) {
    if (!inn) return '';
    // Убираем все нецифровые символы
    return String(inn).replace(/\D/g, '').trim();
}

// Слияние данных по ИНН (вместо телефона)
function mergeDataByINN() {
    mergedData = {};
    
    // Добавляем выплаты
    allPayments.forEach(payment => {
        const inn = normalizeINN(payment.inn);
        if (!inn) {
            // Если нет ИНН, пропускаем (не можем объединить)
            return;
        }
        
        if (!mergedData[inn]) {
            mergedData[inn] = {
                inn: inn,
                phone: payment.phone || '',
                payments: [],
                documents: null
            };
        }
        mergedData[inn].payments.push(payment);
        // Сохраняем телефон из выплат если есть
        if (payment.phone && !mergedData[inn].phone) {
            mergedData[inn].phone = payment.phone;
        }
    });
    
    // Добавляем документы
    allDocuments.forEach(doc => {
        const inn = normalizeINN(doc.inn);
        if (!inn) {
            // Если нет ИНН, пропускаем (не можем объединить)
            return;
        }
        
        if (!mergedData[inn]) {
            mergedData[inn] = {
                inn: inn,
                phone: doc.phone || '',
                payments: [],
                documents: null
            };
        }
        mergedData[inn].documents = doc;
        // Сохраняем телефон из документов если есть
        if (doc.phone && !mergedData[inn].phone) {
            mergedData[inn].phone = doc.phone;
        }
    });
    
    console.log('Объединено записей по ИНН:', Object.keys(mergedData).length);
    console.log('Выплат:', allPayments.length, 'Документов:', allDocuments.length);
    
    // Проверяем ИНН, которые есть в выплатах, но нет в документах
    const paymentINNs = new Set();
    allPayments.forEach(p => {
        const inn = normalizeINN(p.inn);
        if (inn) paymentINNs.add(inn);
    });
    
    const docINNs = new Set();
    allDocuments.forEach(d => {
        const inn = normalizeINN(d.inn);
        if (inn) docINNs.add(inn);
    });
    
    const paymentOnlyINNs = [...paymentINNs].filter(inn => !docINNs.has(inn));
    const docOnlyINNs = [...docINNs].filter(inn => !paymentINNs.has(inn));
    
    console.log('ИНН только в выплатах (без документов):', paymentOnlyINNs.length);
    console.log('ИНН только в документах (без выплат):', docOnlyINNs.length);
    if (paymentOnlyINNs.length > 0) {
        console.log('Примеры ИНН только в выплатах:', paymentOnlyINNs.slice(0, 5));
    }
    if (docOnlyINNs.length > 0) {
        console.log('Примеры ИНН только в документах:', docOnlyINNs.slice(0, 5));
    }
    
    // Отладочная информация: проверяем несколько примеров
    const sampleINNs = Object.keys(mergedData).slice(0, 3);
    sampleINNs.forEach(inn => {
        const data = mergedData[inn];
        console.log(`ИНН ${inn}: выплат=${data.payments.length}, документов=${data.documents ? 'есть' : 'нет'}`);
        if (data.documents) {
            console.log(`  Статус: ${data.documents.realStatus || data.documents.documentStatus}`);
        }
    });
}

// Определение статуса документов (по прямому полю status)
function getDocumentStatus(doc) {
    if (!doc || typeof doc !== 'object') return 'not-processed';

    // Используем прямое поле status (новая структура)
    const s = (doc.status || doc.realStatus || '').toString().toLowerCase().trim();

    if (!s) return 'not-processed';
    if (s === 'оформлен') return 'processed';
    if (s.includes('обработке') || s.includes('на оформлении')) return 'partial';
    if (s.includes('уволен') || s === 'отказ') return 'not-processed';

    // Если статус есть, но не распознан — считаем в процессе
    return 'partial';
}

// Обновление статистики
function updateStatistics() {
    let scopedDocuments = [...allDocuments];
    const userAllowed = getUserRestaurants();
    if (userAllowed) scopedDocuments = scopedDocuments.filter(d => userAllowed.includes(d.restaurant));
    if (currentRestaurant) {
        scopedDocuments = scopedDocuments.filter(d => d.restaurant === currentRestaurant);
    } else if (currentRestaurantGroup) {
        scopedDocuments = scopedDocuments.filter(d => currentRestaurantGroup.includes(d.restaurant));
    }

    const processed = scopedDocuments.filter(d => {
        const s = (d.status || d.realStatus || '').toLowerCase().trim();
        return s === 'оформлен';
    }).length;

    const totalWithoutDismissed = scopedDocuments.filter(d => {
        const s = (d.status || d.realStatus || '').toLowerCase().trim();
        return !s.includes('уволен') && s !== 'отказ';
    }).length;
    
    if (elements.statProcessedCount) {
        elements.statProcessedCount.textContent = processed;
    }
    if (elements.statProcessedPercent && totalWithoutDismissed > 0) {
        const percent = Math.round((processed / totalWithoutDismissed) * 100);
        elements.statProcessedPercent.textContent = `(${percent}%)`;
    } else if (elements.statProcessedPercent) {
        elements.statProcessedPercent.textContent = '(0%)';
    }
}

// ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ ПЕРИОДОВ И СТАТУСОВ
function updatePeriodsAndStatuses(payments) {
    // Получаем все уникальные периоды
    const periodsSet = new Set();
    const statusesSet = new Set();
    
    payments.forEach(payment => {
        if (payment.period) periodsSet.add(payment.period);
        if (payment.status) statusesSet.add(payment.status);
    });
    
    // Сортируем периоды (предполагаем формат DD.MM-DD.MM)
    allPeriods = Array.from(periodsSet).sort((a, b) => {
        // Простая сортировка по строкам, для более сложной нужен парсинг дат
        return b.localeCompare(a); // От новых к старым
    });
    
    // Сортируем статусы
    allStatuses = Array.from(statusesSet).sort();
    
    console.log('Найдено периодов:', allPeriods.length);
    console.log('Найдено статусов:', allStatuses.length);
    
    // Сохраняем в localStorage для будущих сессий
    try {
        localStorage.setItem('payment_periods', JSON.stringify(allPeriods));
        localStorage.setItem('payment_statuses', JSON.stringify(allStatuses));
    } catch (e) {
        console.log('Не удалось сохранить в localStorage:', e);
    }
}

// Заполнение фильтров
function populateFilters(payments) {
    console.log('Заполнение фильтров...');
    
    // ⭐ КОМБИНИРОВАННЫЙ ФИЛЬТР: Год + Период
    // Создаем уникальные комбинации год|период
    const periodYearCombinations = new Map();
    
    payments.forEach(payment => {
        if (!payment.year || !payment.period) return;
        const key = `${payment.year}|${payment.period}`;
        if (!periodYearCombinations.has(key)) {
            periodYearCombinations.set(key, {
                year: payment.year,
                period: payment.period,
                date: parsePeriodEndDate(payment.period, payment.year)
            });
        }
    });
    
    // Преобразуем в массив и сортируем по дате (новые сверху)
    const sortedCombinations = Array.from(periodYearCombinations.values())
        .sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date.getTime() - a.date.getTime(); // Новые сверху
        });
    
    if (elements.periodYearFilter) {
        elements.periodYearFilter.innerHTML = '<option value="">Все периоды</option>';
        sortedCombinations.forEach(combo => {
            const option = document.createElement('option');
            option.value = `${combo.year}|${combo.period}`;
            option.textContent = `${combo.year} ${combo.period}`;
            elements.periodYearFilter.appendChild(option);
        });
    }
    
    // Статусы (динамически из allStatuses)
    if (elements.statusFilter) {
        elements.statusFilter.innerHTML = '<option value="">Все статусы</option>';
        allStatuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            elements.statusFilter.appendChild(option);
        });
    }

    console.log('Фильтры заполнены');
}

// Применение фильтров
function applyFilters() {
    const startTime = performance.now();
    console.log('Применение фильтров...');
    
    // Логируем начало применения фильтров
    logEvent('data.js:applyFilters', 'Начало применения фильтров', {
        totalPayments: allPayments.length,
        currentMode: currentMode
    });
    
    // Сбрасываем специальные режимы
    exitMode();
    
    // Применяем фильтры
    let filtered = [...allPayments];
    const initialCount = filtered.length;
    
    // ⭐ КОМБИНИРОВАННЫЙ ФИЛЬТР: Год + Период
    const selectedPeriodYear = elements.periodYearFilter ? elements.periodYearFilter.value : '';
    if (selectedPeriodYear) {
        const [selectedYear, selectedPeriod] = selectedPeriodYear.split('|');
        if (selectedYear && selectedPeriod) {
            const beforeFilter = filtered.length;
            filtered = filtered.filter(p => p.year == selectedYear && p.period === selectedPeriod);
            logEvent('data.js:applyFilters', 'Фильтр по периоду применен', {
                selectedYear: selectedYear,
                selectedPeriod: selectedPeriod,
                beforeFilter: beforeFilter,
                afterFilter: filtered.length
            });
            if (elements.periodInfo) {
                elements.periodInfo.textContent = `Период: ${selectedYear} ${selectedPeriod}`;
            }
        }
    } else {
        if (elements.periodInfo) {
            elements.periodInfo.textContent = '';
        }
    }
    
    // Фильтр по статусу
    const selectedStatus = elements.statusFilter ? elements.statusFilter.value : '';
    if (selectedStatus) {
        const beforeFilter = filtered.length;
        filtered = filtered.filter(p => p.status === selectedStatus);
        logEvent('data.js:applyFilters', 'Фильтр по статусу применен', {
            selectedStatus: selectedStatus,
            beforeFilter: beforeFilter,
            afterFilter: filtered.length
        });
    }
    
    // Фильтр по правам доступа пользователя
    const userAllowed = getUserRestaurants();
    if (userAllowed) filtered = filtered.filter(p => userAllowed.includes(p.restaurant));

    // Фильтр переключателя ресторана
    if (currentRestaurant) {
        filtered = filtered.filter(p => p.restaurant === currentRestaurant);
    } else if (currentRestaurantGroup) {
        filtered = filtered.filter(p => currentRestaurantGroup.includes(p.restaurant));
    }

    // Фильтр по поиску
    const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase() : '';
    if (searchTerm) {
        const beforeFilter = filtered.length;
        filtered = filtered.filter(p => 
            p.employee.toLowerCase().includes(searchTerm) || 
            p.phone.includes(searchTerm)
        );
        logEvent('data.js:applyFilters', 'Фильтр по поиску применен', {
            searchTerm: searchTerm,
            beforeFilter: beforeFilter,
            afterFilter: filtered.length
        });
    }
    
    filteredPayments = filtered;
    currentPage = 1;
    
    const filterTime = performance.now() - startTime;
    
    // Сортировка
    const sortStartTime = performance.now();
    sortPayments();
    const sortTime = performance.now() - sortStartTime;
    
    // Отображение
    const renderStartTime = performance.now();
    renderTable();
    updatePagination();
    const renderTime = performance.now() - renderStartTime;
    
    const totalTime = performance.now() - startTime;
    
    // Логируем результат
    logEvent('data.js:applyFilters', 'Фильтры применены', {
        initialCount: initialCount,
        finalCount: filteredPayments.length,
        selectedPeriodYear: selectedPeriodYear,
        selectedStatus: selectedStatus,
        searchTerm: searchTerm,
        filterTime: filterTime.toFixed(2) + 'ms',
        sortTime: sortTime.toFixed(2) + 'ms',
        renderTime: renderTime.toFixed(2) + 'ms',
        totalTime: totalTime.toFixed(2) + 'ms'
    });
    
    console.log('Фильтры применены, записей:', filteredPayments.length, `(время: ${totalTime.toFixed(2)}ms)`);
}

// Режим: Последний период (все выплаты)
function showLastPeriod() {
    const startTime = performance.now();
    console.log('Показать последний период');
    
    logEvent('data.js:showLastPeriod', 'Нажата кнопка "Последний период"', {
        allPaymentsCount: allPayments.length
    });
    
    // Получаем последний период и год
    const periodStartTime = performance.now();
    const lastPeriodData = getLastPeriodAndYear(allPayments);
    const periodTime = performance.now() - periodStartTime;
    
    if (!lastPeriodData) {
        logEvent('data.js:showLastPeriod', 'Ошибка: нет данных о последнем периоде', {});
        console.log('Нет данных о последнем периоде');
        return;
    }
    
    logEvent('data.js:showLastPeriod', 'Последний период определен', {
        year: lastPeriodData.year,
        period: lastPeriodData.period,
        periodTime: periodTime.toFixed(2) + 'ms'
    });
    
    currentMode = 'last-period';
    
    // Сбрасываем другие фильтры
    if (elements.statusFilter) elements.statusFilter.value = '';
    if (elements.searchInput) elements.searchInput.value = '';
    
    // ⭐ УСТАНАВЛИВАЕМ ФИЛЬТР НА ПОСЛЕДНИЙ ГОД И ПЕРИОД
    if (elements.periodYearFilter) {
        const filterValue = `${lastPeriodData.year}|${lastPeriodData.period}`;
        elements.periodYearFilter.value = filterValue;
    }
    
    // Применяем фильтры
    const filterStartTime = performance.now();
    applyFilters();
    const filterTime = performance.now() - filterStartTime;
    
    // Показываем индикатор режима
    showModeIndicator(`Показаны <strong>все выплаты</strong> за последний период: <strong>${lastPeriodData.year} ${lastPeriodData.period}</strong>`);
    
    // Обновляем интерфейс
    currentPage = 1;
    const sortStartTime = performance.now();
    sortPayments();
    const sortTime = performance.now() - sortStartTime;
    
    const renderStartTime = performance.now();
    renderTable();
    updatePagination();
    const renderTime = performance.now() - renderStartTime;
    
    const totalTime = performance.now() - startTime;
    
    logEvent('data.js:showLastPeriod', 'Режим "Последний период" активирован', {
        year: lastPeriodData.year,
        period: lastPeriodData.period,
        resultCount: filteredPayments.length,
        filterTime: filterTime.toFixed(2) + 'ms',
        sortTime: sortTime.toFixed(2) + 'ms',
        renderTime: renderTime.toFixed(2) + 'ms',
        totalTime: totalTime.toFixed(2) + 'ms'
    });
    
    console.log('Показано записей последнего периода:', filteredPayments.length, `(время: ${totalTime.toFixed(2)}ms)`);
}

// Режим: Неоплаченные в последнем периоде
function showLastUnpaid() {
    const startTime = performance.now();
    console.log('Показать неоплаченные последнего периода');
    
    logEvent('data.js:showLastUnpaid', 'Нажата кнопка "Неоплаченные"', {
        allPaymentsCount: allPayments.length
    });
    
    // Получаем последний период и год
    const periodStartTime = performance.now();
    const lastPeriodData = getLastPeriodAndYear(allPayments);
    const periodTime = performance.now() - periodStartTime;
    
    if (!lastPeriodData) {
        logEvent('data.js:showLastUnpaid', 'Ошибка: нет данных о последнем периоде', {});
        console.log('Нет данных о последнем периоде');
        return;
    }
    
    logEvent('data.js:showLastUnpaid', 'Последний период определен', {
        year: lastPeriodData.year,
        period: lastPeriodData.period,
        periodTime: periodTime.toFixed(2) + 'ms'
    });
    
    currentMode = 'last-unpaid';
    
    // Сбрасываем другие фильтры
    if (elements.statusFilter) elements.statusFilter.value = '';
    if (elements.searchInput) elements.searchInput.value = '';
    
    // ⭐ УСТАНАВЛИВАЕМ ФИЛЬТР НА ПОСЛЕДНИЙ ГОД И ПЕРИОД
    if (elements.periodYearFilter) {
        const filterValue = `${lastPeriodData.year}|${lastPeriodData.period}`;
        elements.periodYearFilter.value = filterValue;
    }
    
    // Применяем фильтры
    const filterStartTime = performance.now();
    applyFilters();
    const filterTime = performance.now() - filterStartTime;
    
    // Показываем только НЕОПЛАЧЕННЫЕ записи последнего периода
    const unpaidFilterStartTime = performance.now();
    const unpaidStatuses = allStatuses.filter(status =>
        !status.toLowerCase().includes('оплатили') && 
        !status.toLowerCase().includes('оплачено')
    );
    
    filteredPayments = allPayments.filter(p => 
        p.period === lastPeriod && unpaidStatuses.includes(p.status)
    );
    const unpaidFilterTime = performance.now() - unpaidFilterStartTime;
    
    logEvent('data.js:showLastUnpaid', 'Фильтр неоплаченных применен', {
        unpaidStatusesCount: unpaidStatuses.length,
        unpaidStatuses: unpaidStatuses,
        resultCount: filteredPayments.length,
        unpaidFilterTime: unpaidFilterTime.toFixed(2) + 'ms'
    });
    
    // Показываем индикатор режима
    showModeIndicator(`Показаны <strong>неоплаченные выплаты</strong> за период: <strong>${lastPeriod}</strong>`);
    
    // Обновляем интерфейс
    currentPage = 1;
    const sortStartTime = performance.now();
    sortPayments();
    const sortTime = performance.now() - sortStartTime;
    
    const renderStartTime = performance.now();
    renderTable();
    updatePagination();
    const renderTime = performance.now() - renderStartTime;
    
    const totalTime = performance.now() - startTime;
    
    logEvent('data.js:showLastUnpaid', 'Режим "Неоплаченные" активирован', {
        year: lastPeriodData.year,
        period: lastPeriodData.period,
        resultCount: filteredPayments.length,
        filterTime: filterTime.toFixed(2) + 'ms',
        unpaidFilterTime: unpaidFilterTime.toFixed(2) + 'ms',
        sortTime: sortTime.toFixed(2) + 'ms',
        renderTime: renderTime.toFixed(2) + 'ms',
        totalTime: totalTime.toFixed(2) + 'ms'
    });
    
    console.log('Показано неоплаченных записей:', filteredPayments.length, `(время: ${totalTime.toFixed(2)}ms)`);
}

// Выход из специального режима
function exitMode() {
    if (!currentMode) return;
    
    currentMode = null;
    if (elements.modeIndicator) {
        elements.modeIndicator.classList.add('hidden');
    }
    if (elements.lastPeriodBtn) {
        elements.lastPeriodBtn.classList.remove('active');
    }
    if (elements.lastUnpaidBtn) {
        elements.lastUnpaidBtn.classList.remove('active');
    }
}

// Показать индикатор режима
function showModeIndicator(message) {
    if (!elements.modeIndicator || !elements.modeMessage) return;
    
    elements.modeMessage.innerHTML = message;
    elements.modeIndicator.classList.remove('hidden');
    
    // Активируем соответствующую кнопку
    if (currentMode === 'last-period' && elements.lastPeriodBtn) {
        elements.lastPeriodBtn.classList.add('active');
        if (elements.lastUnpaidBtn) elements.lastUnpaidBtn.classList.remove('active');
    } else if (currentMode === 'last-unpaid' && elements.lastUnpaidBtn) {
        elements.lastUnpaidBtn.classList.add('active');
        if (elements.lastPeriodBtn) elements.lastPeriodBtn.classList.remove('active');
    }
}

// Сброс фильтров
function resetFilters() {
    console.log('Сброс фильтров');
    
    if (elements.periodYearFilter) elements.periodYearFilter.value = '';
    if (elements.statusFilter)     elements.statusFilter.value = '';
    if (elements.searchInput)      elements.searchInput.value = '';
    
    exitMode();
    applyFilters();
}

// Определение последнего периода
/**
 * Парсит период в формате "DD.MM-DD.MM" и возвращает последнее число периода
 * @param {string} period - Период в формате "16.10-5.11" или "06.11-15.11"
 * @returns {string|null} - Последнее число периода в формате "DD.MM" или null
 */
function parsePeriodEndDate(period) {
    if (!period || typeof period !== 'string') return null;
    
    // Убираем пробелы и разбиваем по дефису
    const parts = period.trim().split('-');
    if (parts.length !== 2) return null;
    
    // Берем последнюю часть (последнее число периода)
    const endDate = parts[1].trim();
    
    // Проверяем формат DD.MM
    if (!endDate.match(/^\d{1,2}\.\d{1,2}$/)) return null;
    
    return endDate;
}

/**
 * Создает объект Date из года и даты в формате "DD.MM"
 * @param {number} year - Год (например, 2025)
 * @param {string} dateStr - Дата в формате "DD.MM" (например, "5.11")
 * @returns {Date|null} - Объект Date или null при ошибке
 */
function createDateFromYearAndPeriod(year, dateStr) {
    if (!year || !dateStr) return null;
    
    const parts = dateStr.split('.');
    if (parts.length !== 2) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Месяцы в JS начинаются с 0
    
    if (isNaN(day) || isNaN(month) || month < 0 || month > 11) return null;
    
    return new Date(year, month, day);
}

/**
 * Определяет последний период выплаты на основе года и последнего числа периода
 * @param {Array} payments - Массив выплат с полями year и period
 * @returns {string} - Последний период (строка в формате "DD.MM-DD.MM")
 */
function getLastPeriod(payments) {
    const result = getLastPeriodAndYear(payments);
    return result ? result.period : '';
}

/**
 * Определяет последний период и год выплаты на основе последнего числа периода
 * @returns {Object|null} - {year: number, period: string} или null
 */
function getLastPeriodAndYear(payments) {
    if (!payments || payments.length === 0) return null;
    
    let lastPeriod = null;
    let lastYear = null;
    let lastDate = null;
    
    // Проходим по всем выплатам и находим период с максимальной датой окончания
    payments.forEach(payment => {
        if (!payment.period || !payment.year) return;
        
        // Получаем дату окончания периода
        const periodEndDate = parsePeriodEndDate(payment.period, payment.year);
        if (!periodEndDate) return;
        
        // Если это первый период или дата больше текущей максимальной
        if (!lastDate || periodEndDate > lastDate) {
            lastDate = periodEndDate;
            lastPeriod = payment.period;
            lastYear = payment.year;
        }
    });
    
    if (lastPeriod && lastYear) {
        console.log('Определен последний период:', lastPeriod, 'год:', lastYear, 'с датой окончания:', lastDate);
        return { year: lastYear, period: lastPeriod };
    }
    
    return null;
}

// Сортировка выплат
// Парсинг периода для получения даты окончания
// Формат: "16.01-31.01" -> Date(31.01.2026)
function parsePeriodEndDate(period, year) {
    if (!period || !year) return null;
    
    // Формат периода: "16.01-31.01" или "1-31.10.2025"
    const parts = period.split('-');
    if (parts.length < 2) return null;
    
    // Берем последнюю часть (дату окончания)
    const endPart = parts[parts.length - 1].trim();
    
    // Парсим дату окончания
    // Формат может быть: "31.01" или "31.01.2025"
    const dateMatch = endPart.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
    if (!dateMatch) return null;
    
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]) - 1; // месяцы в JS начинаются с 0
    const periodYear = dateMatch[3] ? parseInt(dateMatch[3]) : year;
    
    return new Date(periodYear, month, day);
}

function sortPayments() {
    filteredPayments.sort((a, b) => {
        let valueA = a[currentSort.field];
        let valueB = b[currentSort.field];
        
        if (currentSort.field === 'amount') {
            valueA = a.amount;
            valueB = b.amount;
        }
        
        // ⭐ СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ ПЕРИОДА: сортировка по году + последней дате периода
        if (currentSort.field === 'period') {
            // Получаем даты окончания периодов
            const dateA = parsePeriodEndDate(a.period, a.year);
            const dateB = parsePeriodEndDate(b.period, b.year);
            
            if (!dateA && !dateB) {
                // Если обе даты не распарсились, используем простую сортировку
                return currentSort.direction === 'asc' 
                    ? valueA.localeCompare(valueB)
                    : valueB.localeCompare(valueA);
            }
            
            if (!dateA) return 1; // Если у A нет даты, ставим вниз
            if (!dateB) return -1; // Если у B нет даты, ставим вниз
            
            // Сравниваем по дате окончания периода
            // По умолчанию desc (новые сверху) - большая дата идет первой
            if (currentSort.direction === 'desc') {
                return dateB.getTime() - dateA.getTime(); // Новые сверху
            } else {
                return dateA.getTime() - dateB.getTime(); // Старые сверху
            }
        }
        
        if (typeof valueA === 'string' && typeof valueB === 'string') {
            return currentSort.direction === 'asc'
                ? valueA.localeCompare(valueB)
                : valueB.localeCompare(valueA);
        }
        
        return currentSort.direction === 'asc' ? valueA - valueB : valueB - valueA;
    });
}

// Обновление фильтров документов
function updateDocumentFilters() {
    // Должности
    const positions = [...new Set(allDocuments.map(d => d.position).filter(Boolean))].sort();
    if (elements.docPositionFilter) {
        elements.docPositionFilter.innerHTML = '<option value="">Все должности</option>';
        positions.forEach(pos => {
            const option = document.createElement('option');
            option.value = pos;
            option.textContent = pos;
            elements.docPositionFilter.appendChild(option);
        });
    }
    
    // Рестораны
    const restaurants = [...new Set(allDocuments.map(d => d.restaurant).filter(Boolean))].sort();
    if (elements.docRestaurantFilter) {
        elements.docRestaurantFilter.innerHTML = '<option value="">Все рестораны</option>';
        restaurants.forEach(rest => {
            const option = document.createElement('option');
            option.value = rest;
            option.textContent = rest;
            elements.docRestaurantFilter.appendChild(option);
        });
    }
    
    allPositions = positions;
    allRestaurants = restaurants;
}

// Применение фильтров документов
function applyDocFilters() {
    console.log('Применение фильтров документов...');
    
    let filtered = [...allDocuments];
    
    // Фильтр по статусу
    const selectedStatus = elements.docStatusFilter ? elements.docStatusFilter.value : '';
    if (selectedStatus) {
        filtered = filtered.filter(d => {
            // Для фильтра "Уволен" (not-processed) проверяем реальный статус из таблицы
            if (selectedStatus === 'not-processed') {
                const realStatus = (d.realStatus || '').toLowerCase().trim();
                const hasDismissedDate = d.dismissedDate && d.dismissedDate.toString().trim() !== '';
                // Уволен = статус содержит "уволен" ИЛИ есть дата увольнения
                return realStatus.includes('уволен') || hasDismissedDate;
            }
            // Для других фильтров используем documentStatus
            return d.documentStatus === selectedStatus;
        });
    }
    
    // Фильтр по должности
    const selectedPosition = elements.docPositionFilter ? elements.docPositionFilter.value : '';
    if (selectedPosition) {
        filtered = filtered.filter(d => d.position === selectedPosition);
    }
    
    // Фильтр по правам доступа пользователя
    const userAllowedDoc = getUserRestaurants();
    if (userAllowedDoc) filtered = filtered.filter(d => userAllowedDoc.includes(d.restaurant));

    // Фильтр переключателя
    const localRest = elements.docRestaurantFilter ? elements.docRestaurantFilter.value : '';
    const effectiveRest = currentRestaurant || localRest;
    if (effectiveRest) {
        filtered = filtered.filter(d => d.restaurant === effectiveRest);
    } else if (currentRestaurantGroup) {
        filtered = filtered.filter(d => currentRestaurantGroup.includes(d.restaurant));
    }
    
    // Фильтр по проблемам
    const selectedProblems = elements.docProblemsFilter ? elements.docProblemsFilter.value : '';
    if (selectedProblems === 'has-problems') {
        filtered = filtered.filter(d => d.problems && d.problems.trim() !== '');
    } else if (selectedProblems === 'no-problems') {
        filtered = filtered.filter(d => !d.problems || d.problems.trim() === '');
    }
    
    // Фильтр по поиску
    const searchTerm = elements.docSearchInput ? elements.docSearchInput.value.toLowerCase() : '';
    if (searchTerm) {
        filtered = filtered.filter(d => 
            d.employee.toLowerCase().includes(searchTerm) || 
            d.phone.includes(searchTerm)
        );
    }
    
    filteredDocuments = filtered;
    currentDocPage = 1;
    
    // Сортировка
    sortDocuments();
    
    // Отображение
    renderDocumentsTable();
    
    console.log('Фильтры документов применены, записей:', filteredDocuments.length);
}

// ── Фильтры объездов ─────────────────────────────────────────────────────────

function updateRoundsFilters() {
    const statuses = [...new Set(allRounds.map(r => r.status).filter(Boolean))].sort();
    if (elements.roundsStatusFilter) {
        elements.roundsStatusFilter.innerHTML = '<option value="">Все статусы</option>';
        statuses.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.textContent = s;
            elements.roundsStatusFilter.appendChild(opt);
        });
    }
    const restaurants = [...new Set(allRounds.map(r => r.restaurant).filter(Boolean))].sort();
    if (elements.roundsRestaurantFilter) {
        elements.roundsRestaurantFilter.innerHTML = '<option value="">Все рестораны</option>';
        restaurants.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r; opt.textContent = r;
            elements.roundsRestaurantFilter.appendChild(opt);
        });
    }
}

function applyRoundsFilters() {
    let filtered = [...allRounds];

    const status = elements.roundsStatusFilter ? elements.roundsStatusFilter.value : '';
    if (status) filtered = filtered.filter(r => r.status === status);

    const userAllowedRounds = getUserRestaurants();
    if (userAllowedRounds) filtered = filtered.filter(r => userAllowedRounds.includes(r.restaurant));

    const restaurant = currentRestaurant || (elements.roundsRestaurantFilter ? elements.roundsRestaurantFilter.value : '');
    if (restaurant) filtered = filtered.filter(r => r.restaurant === restaurant);
    else if (currentRestaurantGroup) filtered = filtered.filter(r => currentRestaurantGroup.includes(r.restaurant));

    const search = elements.roundsSearchInput ? elements.roundsSearchInput.value.toLowerCase() : '';
    if (search) filtered = filtered.filter(r => r.employeeName.toLowerCase().includes(search));

    filteredRounds = filtered;
    if (typeof renderRoundsTable === 'function') renderRoundsTable();
}

function resetRoundsFilters() {
    if (elements.roundsStatusFilter)    elements.roundsStatusFilter.value = '';
    if (elements.roundsRestaurantFilter) elements.roundsRestaurantFilter.value = '';
    if (elements.roundsSearchInput)     elements.roundsSearchInput.value = '';
    applyRoundsFilters();
}

// Сброс фильтров документов
function resetDocFilters() {
    if (elements.docStatusFilter) elements.docStatusFilter.value = '';
    if (elements.docPositionFilter) elements.docPositionFilter.value = '';
    if (elements.docRestaurantFilter) elements.docRestaurantFilter.value = '';
    if (elements.docProblemsFilter) elements.docProblemsFilter.value = '';
    if (elements.docSearchInput) elements.docSearchInput.value = '';
    
    applyDocFilters();
}

// Сортировка документов
function sortDocuments() {
    filteredDocuments.sort((a, b) => {
        let valueA = a[currentDocSort.field];
        let valueB = b[currentDocSort.field];
        
        if (typeof valueA === 'string' && typeof valueB === 'string') {
            return currentDocSort.direction === 'asc'
                ? valueA.localeCompare(valueB)
                : valueB.localeCompare(valueA);
        }
        
        return currentDocSort.direction === 'asc' ? valueA - valueB : valueB - valueA;
    });
}
