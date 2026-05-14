// ============================================
// ПРОСТОЙ КОД - КАК БЫЛО С ЛИСТ2, НО + ДОКУМЕНТЫ
// Скопируйте весь этот код в ваш Apps Script проект
// ============================================

// ID вашей Google Таблицы
var SPREADSHEET_ID = '1qqUSVi8zuWH0xFrN4FxSlDs-WTp3CPSgzH3N3oycwbk';

// Названия листов
var PAYMENTS_SHEET_NAME = 'Выплаты';
var DOCUMENTS_SHEET_NAME = 'Документы';
var ACCOUNTS_SHEET_NAME = 'Счета';

// Функция, вызываемая при GET запросе
function doGet(e) {
  try {
    // Открываем таблицу
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // ===================== ЛИСТ ВЫПЛАТ =====================
    var paymentsSheet = spreadsheet.getSheetByName(PAYMENTS_SHEET_NAME);
    var paymentsData = [];
    
    if (paymentsSheet) {
      var paymentsValues = paymentsSheet.getDataRange().getValues();
      var paymentHeaders = paymentsValues[0];
      
      // Определяем индексы колонок по заголовкам
      var paymentColumnIndexes = {
        year: findColumnIndex(paymentHeaders, ['Год', 'год']),
        period: findColumnIndex(paymentHeaders, ['Период выплаты', 'Период', 'период']),
        employee: findColumnIndex(paymentHeaders, ['Сотрудник', 'ФИО', 'Имя', 'сотрудник', 'фио']),
        phone: findColumnIndex(paymentHeaders, ['Телефон', 'Номер телефона', 'телефон', 'номер']),
        amount: findColumnIndex(paymentHeaders, ['Сумма из реестра', 'Сумма', 'сумма']),
        status: findColumnIndex(paymentHeaders, ['Статус', 'статус']),
        comment: findColumnIndex(paymentHeaders, ['Комментарий', 'комментарий'])
      };
      
      // Обрабатываем данные, начиная со второй строки
      for (var i = 1; i < paymentsValues.length; i++) {
        var row = paymentsValues[i];
        
        // Пропускаем пустые строки
        if (!row[paymentColumnIndexes.employee] || row[paymentColumnIndexes.employee] === '') {
          continue;
        }
        
        // Преобразуем сумму в число
        var amount = parseFloat(row[paymentColumnIndexes.amount]) || 0;
        
        // Преобразуем год в число
        var year = parseInt(row[paymentColumnIndexes.year]) || new Date().getFullYear();
        
        paymentsData.push({
          id: i,
          year: year,
          period: row[paymentColumnIndexes.period] || '',
          employee: row[paymentColumnIndexes.employee] || '',
          phone: String(row[paymentColumnIndexes.phone] || ''),
          amount: amount,
          status: row[paymentColumnIndexes.status] || '',
          comment: row[paymentColumnIndexes.comment] || ''
        });
      }
    }
    
    // ===================== ЛИСТ ДОКУМЕНТЫ =====================
    var documentsSheet = spreadsheet.getSheetByName(DOCUMENTS_SHEET_NAME);
    var documentsData = [];
    
    if (documentsSheet) {
      var documentsValues = documentsSheet.getDataRange().getValues();
      
      // В первой строке заголовки могут быть объединены с примерами
      // Определяем индексы колонок по позициям (A=0, B=1, C=2, и т.д.)
      // На основе структуры: A=Собран/В обработке, B=Проект, C=Город, D=Должность, E=Ресторан, F=Комментарий, G=Отпуск, H=Дата выдачи паспорта, I=Дата рождения, J=Паспортные данные, K=ФИО, L=Телефон, M=Гражданство, N=Ссылка на документы, O=Проблемы
      
      var documentColumnIndexes = {
        collected: 0,  // A - Собран В обработке (первое слово)
        inProcess: 0,  // A - Собран В обработке (второе слово)
        project: 1,    // B - Проект
        city: 2,       // C - Город
        position: 3,   // D - Должность
        restaurant: 4, // E - Ресторан
        comment: 5,    // F - Комментарий
        vacation: 6,   // G - Отпуск
        passportIssueDate: 7,  // H - Дата выдачи паспорта
        birthDate: 8,  // I - Дата рождения
        passportData: 9,  // J - Паспортные данные
        employee: 10,  // K - ФИО
        phone: 11,     // L - Номер телефона
        citizenship: 12, // M - Гражданство (Граждансво - опечатка)
        documentsLink: 13, // N - Ссылка на полный пакет документов
        problems: 14,  // O - Проблемы
        registrationEndDate: 15, // P - Регистрация (если есть)
        patentIssueDate: 16,     // Q - Патент (если есть)
        contractDate: 17,        // R - Договор (если есть)
        contractLink: 18,        // S - Ссылка на договор (если есть)
        dismissedDate: 19        // T - Уволен (если есть)
      };
      
      // Обрабатываем данные, начиная со второй строки (первая - заголовки с примерами)
      for (var j = 1; j < documentsValues.length; j++) {
        var row = documentsValues[j];
        
        // Пропускаем пустые строки (проверяем ФИО или телефон)
        var employee = row[documentColumnIndexes.employee] ? String(row[documentColumnIndexes.employee]).trim() : '';
        var phone = row[documentColumnIndexes.phone] ? String(row[documentColumnIndexes.phone]).trim() : '';
        
        if (!employee && !phone) {
          continue;
        }
        
        // Обрабатываем первую колонку (A) - там может быть "Собран В обработке" или отдельно "Собран"/"В обработке"
        var collected = '';
        var inProcess = '';
        var colA = row[documentColumnIndexes.collected] ? String(row[documentColumnIndexes.collected]).trim() : '';
        
        if (colA) {
          if (colA.toLowerCase().includes('собран') && !colA.toLowerCase().includes('обработке')) {
            collected = colA;
          } else if (colA.toLowerCase().includes('обработке') || colA.toLowerCase().includes('обновлено')) {
            inProcess = colA;
          } else if (colA.toLowerCase().includes('собран') && colA.toLowerCase().includes('обработке')) {
            // Оба в одной ячейке - разделяем
            var parts = colA.split(/\s+/);
            if (parts[0].toLowerCase().includes('собран')) collected = parts[0];
            if (parts.length > 1 && parts[1].toLowerCase().includes('обработке')) {
              inProcess = parts.slice(1).join(' ');
            }
          } else {
            // Неизвестный формат - пробуем угадать
            if (colA.toLowerCase() === 'обновлено') {
              collected = colA;
            } else {
              inProcess = colA;
            }
          }
        }
        
        // Преобразуем даты из Excel формата (числа) в читаемый формат
        function formatExcelDate(excelDate) {
          if (!excelDate) return '';
          if (typeof excelDate === 'string') return excelDate.trim();
          if (typeof excelDate === 'number') {
            // Excel дата - это количество дней с 1 января 1900
            var date = new Date((excelDate - 25569) * 86400 * 1000);
            var day = ('0' + date.getDate()).slice(-2);
            var month = ('0' + (date.getMonth() + 1)).slice(-2);
            var year = date.getFullYear();
            return day + '.' + month + '.' + year;
          }
          return String(excelDate).trim();
        }
        
        documentsData.push({
          id: j,
          collected: collected,
          inProcess: inProcess,
          project: row[documentColumnIndexes.project] ? String(row[documentColumnIndexes.project]).trim() : '',
          city: row[documentColumnIndexes.city] ? String(row[documentColumnIndexes.city]).trim() : '',
          position: row[documentColumnIndexes.position] ? String(row[documentColumnIndexes.position]).trim() : '',
          restaurant: row[documentColumnIndexes.restaurant] ? String(row[documentColumnIndexes.restaurant]).trim() : '',
          comment: row[documentColumnIndexes.comment] ? String(row[documentColumnIndexes.comment]).trim() : '',
          vacation: row[documentColumnIndexes.vacation] ? String(row[documentColumnIndexes.vacation]).trim() : '',
          passportIssueDate: formatExcelDate(row[documentColumnIndexes.passportIssueDate]),
          birthDate: formatExcelDate(row[documentColumnIndexes.birthDate]),
          passportData: row[documentColumnIndexes.passportData] ? String(row[documentColumnIndexes.passportData]).trim() : '',
          employee: employee,
          phone: phone,
          citizenship: row[documentColumnIndexes.citizenship] ? String(row[documentColumnIndexes.citizenship]).trim() : '',
          documentsLink: row[documentColumnIndexes.documentsLink] ? String(row[documentColumnIndexes.documentsLink]).trim() : '',
          problems: row[documentColumnIndexes.problems] ? String(row[documentColumnIndexes.problems]).trim() : '',
          registrationEndDate: formatExcelDate(row[documentColumnIndexes.registrationEndDate]),
          patentIssueDate: formatExcelDate(row[documentColumnIndexes.patentIssueDate]),
          contractDate: formatExcelDate(row[documentColumnIndexes.contractDate]),
          contractLink: row[documentColumnIndexes.contractLink] ? String(row[documentColumnIndexes.contractLink]).trim() : '',
          dismissedDate: formatExcelDate(row[documentColumnIndexes.dismissedDate])
        });
      }
    }
    
    // ===================== ЛИСТ СЧЕТА =====================
    var accountsSheet = spreadsheet.getSheetByName(ACCOUNTS_SHEET_NAME);
    var accountsData = {
      payments: [],         // Данные выплат из листа "Счета" (период, выручка, оплачено, разница, статус, комментарий)
      transactions: []      // История транзакций (данные вниз)
    };
    
    if (accountsSheet) {
      Logger.log('Лист "Счета" найден, всего строк: ' + accountsSheet.getLastRow() + ', всего колонок: ' + accountsSheet.getLastColumn());
      var accountsValues = accountsSheet.getDataRange().getValues();
      Logger.log('Всего строк данных: ' + accountsValues.length);
      Logger.log('Первая строка (первые 5 ячеек): ' + JSON.stringify(accountsValues[0] ? accountsValues[0].slice(0, 5) : []));
      Logger.log('Вторая строка (первые 5 ячеек): ' + JSON.stringify(accountsValues[1] ? accountsValues[1].slice(0, 5) : []));
      Logger.log('Третья строка (первые 5 ячеек): ' + JSON.stringify(accountsValues[2] ? accountsValues[2].slice(0, 5) : []));
      
      // Упрощенная структура листа "Счета":
      // - Строка 0 (1 в Excel): заголовки выплат в колонках A, D, E, F, G, H (индексы 0, 3, 4, 5, 6, 7)
      // - Строки 1+ (2+ в Excel): данные выплат
      // - Строка 0 (1 в Excel): заголовки транзакций в колонках K-M (индексы 10-12): "Лицо", "Дата", "Сумма"
      // - Строки 1+ (2+ в Excel): данные транзакций
      
      var transactionsStartRow = -1;
      
      // Проверяем наличие заголовков транзакций в строке 0
      if (accountsValues.length > 0) {
        var headerRow = accountsValues[0];
        var headerK = String(headerRow[10] || '').toLowerCase().trim();
        var headerL = String(headerRow[11] || '').toLowerCase().trim();
        var headerM = String(headerRow[12] || '').toLowerCase().trim();
        
        if (headerK.includes('лицо') && headerL.includes('дата') && headerM.includes('сумма')) {
          transactionsStartRow = 0;
          Logger.log('Найдена таблица транзакций: заголовки в строке 0, колонки K-M');
        }
      }
      
      // Обрабатываем данные выплат из листа "Счета"
      // Колонки: A (0) - Период, D (3) - Выручка, E (4) - Оплачено Чайханой, F (5) - Разница счетов, G (6) - Статус, H (7) - Комментарий
      if (accountsValues.length > 0) {
        // Читаем данные выплат начиная со строки 1 (2 в Excel)
        for (var i = 1; i < accountsValues.length; i++) {
          var row = accountsValues[i];
          
          // Период в колонке A (индекс 0)
          var period = String(row[0] || '').trim();
          
          // Пропускаем пустые строки
          if (!period || period === '') {
            continue;
          }
          
          // Пропускаем строки которые не являются периодами выплат
          if (!period.match(/^\d+-\d+\.\d+\.\d+$/)) {
            continue;
          }
          
          // Читаем данные из нужных колонок
          var revenue = 0; // Выручка (D, индекс 3)
          if (row[3] !== undefined && row[3] !== null && row[3] !== '') {
            if (typeof row[3] === 'number') {
              revenue = row[3];
            } else if (typeof row[3] === 'string') {
              revenue = parseFloat(row[3].replace(/\s/g, '').replace(',', '.')) || 0;
            }
          }
          
          var paid = 0; // Оплачено Чайханой (E, индекс 4)
          if (row[4] !== undefined && row[4] !== null && row[4] !== '') {
            if (typeof row[4] === 'number') {
              paid = row[4];
            } else if (typeof row[4] === 'string') {
              paid = parseFloat(row[4].replace(/\s/g, '').replace(',', '.')) || 0;
            }
          }
          
          var difference = 0; // Разница счетов (F, индекс 5)
          if (row[5] !== undefined && row[5] !== null && row[5] !== '') {
            if (typeof row[5] === 'number') {
              difference = row[5];
            } else if (typeof row[5] === 'string') {
              difference = parseFloat(row[5].replace(/\s/g, '').replace(',', '.')) || 0;
            }
          }
          
          var status = String(row[6] || '').trim(); // Статус (G, индекс 6)
          var comment = String(row[7] || '').trim(); // Комментарий (H, индекс 7)
          
          accountsData.payments.push({
            period: period,
            revenue: revenue,
            paid: paid,
            difference: difference,
            status: status,
            comment: comment
          });
        }
        
        Logger.log('Загружено выплат из листа "Счета": ' + accountsData.payments.length);
      }
      
      // Обрабатываем таблицу транзакций
      // Заголовки в строке 0 (1 в Excel), колонки K-M (индексы 10-12): "Лицо", "Дата", "Сумма"
      // Данные начинаются со строки 1 (2 в Excel)
      if (transactionsStartRow >= 0) {
        // Читаем данные начиная со строки 1 (2 в Excel)
        var skippedPaymentsRows = 0;
        var skippedNoAmountRows = 0;
        var transactionsInPaymentRows = [];
        
        for (var i = 1; i < accountsValues.length; i++) {
          var row = accountsValues[i];
          
          // Проверяем наличие суммы в колонке M (индекс 12) - это главный критерий транзакции
          var amountValue = row[12];
          var hasAmount = false;
          var amount = 0;
          
          if (amountValue !== undefined && amountValue !== null && amountValue !== '') {
            hasAmount = true;
            
            if (typeof amountValue === 'number') {
              amount = amountValue;
            } else if (typeof amountValue === 'string') {
              var amountStr = String(amountValue).trim();
              // Убираем все пробелы (разделители тысяч)
              amountStr = amountStr.replace(/\s/g, '');
              // Обрабатываем запятые: если запятая не в последних 3 символах, это разделитель тысяч
              var commaIndex = amountStr.indexOf(',');
              if (commaIndex !== -1) {
                var afterComma = amountStr.substring(commaIndex + 1);
                // Если после запятой больше 2 цифр, это разделитель тысяч
                if (afterComma.length > 2) {
                  // Убираем все запятые (разделители тысяч)
                  amountStr = amountStr.replace(/,/g, '');
                } else {
                  // Запятая - это десятичный разделитель, заменяем на точку
                  amountStr = amountStr.replace(',', '.');
                }
              }
              amount = parseFloat(amountStr) || 0;
              
              // Логируем для отладки, если сумма не распарсилась
              if (isNaN(amount)) {
                Logger.log('Проблема с парсингом суммы на строке ' + (i + 1) + ', исходное значение: "' + amountValue + '", после обработки: "' + amountStr + '"');
              }
            }
          }
          
          // Проверяем, является ли это строка выплат (проверяем первую колонку)
          var firstCell = String(row[0] || '').trim();
          var isPaymentRow = firstCell && firstCell.match(/^\d+-\d+\.\d+\.\d+$/);
          
          if (isPaymentRow) {
            // Если в строке выплат есть сумма в колонке M, это тоже транзакция - загружаем её!
            if (hasAmount) {
              transactionsInPaymentRows.push({
                row: i + 1,
                period: firstCell,
                amount: amount
              });
              Logger.log('Найдена транзакция в строке выплат ' + (i + 1) + ', период: ' + firstCell + ', сумма: ' + amount);
              // Продолжаем обработку - это транзакция, не пропускаем!
            } else {
              skippedPaymentsRows++;
              continue; // Это строка выплат без транзакции
            }
          }
          
          // Если нет суммы, пропускаем строку
          if (!hasAmount) {
            skippedNoAmountRows++;
            // Логируем первые несколько пропущенных строк для отладки
            if (skippedNoAmountRows <= 5) {
              Logger.log('Пропущена строка ' + (i + 1) + ' - нет суммы, Лицо: "' + (row[10] || '') + '", Дата: "' + (row[11] || '') + '"');
            }
            continue;
          }
          
          var dateValue = row[11];
          var dateStr = '';
          
          if (dateValue) {
            if (typeof dateValue === 'string') {
              dateStr = dateValue.trim();
            } else if (dateValue instanceof Date) {
              var day = ('0' + dateValue.getDate()).slice(-2);
              var month = ('0' + (dateValue.getMonth() + 1)).slice(-2);
              var year = dateValue.getFullYear();
              dateStr = day + '.' + month + '.' + year;
            } else if (typeof dateValue === 'number') {
              // Excel дата
              var date = new Date((dateValue - 25569) * 86400 * 1000);
              var day = ('0' + date.getDate()).slice(-2);
              var month = ('0' + (date.getMonth() + 1)).slice(-2);
              var year = date.getFullYear();
              dateStr = day + '.' + month + '.' + year;
            } else {
              dateStr = String(dateValue).trim();
            }
          }
          
          var accountName = row[10] ? String(row[10]).trim() : '';
          
          accountsData.transactions.push({
            id: accountsData.transactions.length + 1,
            date: dateStr,
            amount: amount,
            account: accountName
          });
        }
        
        // Вычисляем общую сумму для проверки
        var totalAmount = 0;
        for (var t = 0; t < accountsData.transactions.length; t++) {
          totalAmount += accountsData.transactions[t].amount || 0;
        }
        
        Logger.log('Пропущено строк выплат (без транзакций): ' + skippedPaymentsRows);
        Logger.log('Найдено транзакций в строках выплат: ' + transactionsInPaymentRows.length);
        Logger.log('Пропущено строк без суммы: ' + skippedNoAmountRows);
        Logger.log('Загружено транзакций: ' + accountsData.transactions.length);
        Logger.log('Общая сумма транзакций: ' + totalAmount);
        
        // Если есть транзакции в строках выплат, логируем их суммы
        if (transactionsInPaymentRows.length > 0) {
          var sumInPaymentRows = 0;
          for (var p = 0; p < transactionsInPaymentRows.length; p++) {
            sumInPaymentRows += transactionsInPaymentRows[p].amount || 0;
          }
          Logger.log('Сумма транзакций в строках выплат: ' + sumInPaymentRows);
        }
      } else {
        Logger.log('Таблица транзакций не найдена');
      }
      
    } else {
      Logger.log('Лист "Счета" не найден');
    }
    
    // Возвращаем данные
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: paymentsData,
        documents: documentsData,
        accounts: accountsData,  // ⭐ ДОБАВЛЕНО: счета
        timestamp: new Date().toISOString(),
        totalRecords: paymentsData.length,
        totalDocuments: documentsData.length
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // В случае ошибки возвращаем сообщение об ошибке
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        message: 'Ошибка при загрузке данных из Google Таблицы',
        data: [],
        documents: [],  // ⭐ ВСЕГДА возвращаем, даже при ошибке
        accounts: { payments: [], transactions: [] }
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Вспомогательная функция для поиска индекса колонки по различным вариантам названий
function findColumnIndex(headers, possibleNames) {
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || '').toLowerCase().trim();
    for (var j = 0; j < possibleNames.length; j++) {
      if (header === possibleNames[j].toLowerCase()) {
        return i;
      }
    }
  }
  return -1; // Не найдено
}

// Функция для тестирования скрипта
function testGetData() {
  var result = doGet({});
  Logger.log(result.getContent());
}
