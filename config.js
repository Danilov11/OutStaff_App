// config.js
// Конфигурация приложения

const CONFIG = {
    // ── Supabase (основной источник данных) ──────────────
    supabaseUrl: 'https://gjhcvsmaatwrzortwdms.supabase.co',
    supabaseKey: 'sb_publishable_S-FgwOI0NXtaVYIFTHE1HQ_FvSoj1_x',

    // ── Google Apps Script (fallback) ────────────────────
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycby_22OoB_4A1EtQsOFQDPz4DQvcnmtWEWdwXCMgmoGoh9uGGhWVmdt5D8rcWG9qq9wjqg/exec',

    // ── UI ───────────────────────────────────────────────
    itemsPerPage: 50,
    sortDirection: 'desc',
    sortField: 'period',

    // ── Обновление данных ────────────────────────────────
    refreshInterval: 5 * 60 * 1000,  // 5 минут
    dataUpdateDelay: 2 * 60 * 1000,  // 2-3 минуты на обновление из Google

    // ── Telegram ─────────────────────────────────────────
    telegramUrl: 'https://t.me/',

    // ── Безопасность ─────────────────────────────────────
    dashboardPassword: '445566',
    platformPassword: '44'
};
