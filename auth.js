// auth.js — условная авторизация

const RESTAURANT_GROUPS = {
    'ЧАЙХАНА': [
        'АЛЕКСЕЕВСКАЯ', 'БУТЫРКА', 'ДМИТРОВКА', 'СУЩЕВКА',
        'СМОЛЬНАЯ', 'ХОДЫНКА', 'ПРЕСНЯ', 'ПРОИЗВОДСТВО',
        'ПРОИЗВОДСТВО НОВОЕ', 'САВЕЛОВСКАЯ', 'ЧАСОВАЯ'
    ],
    'ЧАО':      ['ЧАО'],
    'ФРАНКЛИНС': ['ФРАНКЛИНС'],
};

const AUTH_USERS = [
    { login: 'admin',      password: '445566',    name: 'Администратор', group: null },
    { login: 'chaikhana',  password: 'chai2025',  name: 'Чайхана',       group: 'ЧАЙХАНА' },
    { login: 'chao',       password: 'chao2025',  name: 'ЧАО',           group: 'ЧАО' },
    { login: 'franklins',  password: 'fb2025',    name: 'Франклинс',     group: 'ФРАНКЛИНС' },
];

let currentUser = null;

const CUSTOM_USERS_KEY      = 'app_custom_users';
const RESTAURANT_GROUP_MAP_KEY = 'restaurant_group_map';

function getCustomUsers() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_USERS_KEY) || '[]'); } catch { return []; }
}

function saveCustomUsers(users) {
    localStorage.setItem(CUSTOM_USERS_KEY, JSON.stringify(users));
}

// Динамическая карта «ресторан → группа» (перекрывает хардкод)
function getRestaurantGroupMap() {
    try { return JSON.parse(localStorage.getItem(RESTAURANT_GROUP_MAP_KEY) || '{}'); } catch { return {}; }
}

function setRestaurantGroup(restaurantName, group) {
    const map = getRestaurantGroupMap();
    if (group) map[restaurantName.toUpperCase()] = group;
    else delete map[restaurantName.toUpperCase()];
    localStorage.setItem(RESTAURANT_GROUP_MAP_KEY, JSON.stringify(map));
}

// Возвращает группу для ресторана (динамика + хардкод)
function getRestaurantGroupName(name) {
    const upper = (name || '').toUpperCase();
    const dynMap = getRestaurantGroupMap();
    if (dynMap[upper]) return dynMap[upper];
    for (const [group, names] of Object.entries(RESTAURANT_GROUPS)) {
        if (names.includes(upper)) return group;
    }
    return null;
}

function addCustomUser(login, password, name, group) {
    const users = getCustomUsers();
    if (AUTH_USERS.find(u => u.login === login) || users.find(u => u.login === login)) {
        return { ok: false, error: 'Пользователь с таким логином уже существует' };
    }
    users.push({ login, password, name, group: group || null });
    saveCustomUsers(users);
    return { ok: true };
}

function removeCustomUser(login) {
    const users = getCustomUsers().filter(u => u.login !== login);
    saveCustomUsers(users);
}

function updateCustomUser(login, updates) {
    const users = getCustomUsers().map(u => u.login === login ? { ...u, ...updates } : u);
    saveCustomUsers(users);
}

function authInit() {
    const saved = sessionStorage.getItem('auth_user');
    if (saved) {
        try { currentUser = JSON.parse(saved); return true; } catch {}
    }
    return false;
}

function authLogin(login, password) {
    const allUsers = [...AUTH_USERS, ...getCustomUsers()];
    const user = allUsers.find(u => u.login === login.trim() && u.password === password);
    if (!user) return false;
    currentUser = user;
    sessionStorage.setItem('auth_user', JSON.stringify(user));
    return true;
}

function authLogout() {
    currentUser = null;
    sessionStorage.removeItem('auth_user');
    location.reload();
}

// Список ресторанов, доступных текущему пользователю
function getUserRestaurants() {
    if (!currentUser || !currentUser.group) return null; // null = все
    const hardcoded = RESTAURANT_GROUPS[currentUser.group] || [];
    // Добавляем рестораны, назначенные в этот группе через admin UI
    const dynMap = getRestaurantGroupMap();
    const dynamic = Object.entries(dynMap)
        .filter(([, g]) => g === currentUser.group)
        .map(([n]) => n);
    return [...new Set([...hardcoded, ...dynamic])];
}

// Можно ли показать этот ресторан пользователю
function canAccessRestaurant(name) {
    const allowed = getUserRestaurants();
    if (!allowed) return true;
    return allowed.map(r => r.toUpperCase()).includes((name || '').toUpperCase());
}

// Имя группы текущего пользователя
function getUserGroupName() {
    return currentUser?.group || null;
}

// Авторизация сотрудника по ИНН (асинхронно через Supabase)
async function authLoginEmployee(inn) {
    const db = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (!db) return false;

    const { data, error } = await db.from('employees')
        .select('id, full_name, phone, inn, position, city, citizenship')
        .eq('inn', inn.trim())
        .limit(1);

    if (error || !data?.length) return false;
    const emp = data[0];

    currentUser = {
        role:        'employee',
        employeeId:  emp.id,
        inn:         emp.inn,
        name:        emp.full_name,
        phone:       emp.phone       || '',
        position:    emp.position    || '',
        city:        emp.city        || '',
        citizenship: emp.citizenship || '',
        group:       null,
        login:       inn
    };
    sessionStorage.setItem('auth_user', JSON.stringify(currentUser));
    return true;
}
