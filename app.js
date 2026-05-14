// Mock Data
const MOCK_PAYMENTS = [
    { period: '15.10-31.10', employee: 'Иванов Иван', phone: '+7 999 123-45-67', amount: '45 000 ₽', status: 'Оплачено', comment: '-', restaurant: 'Чайхана' },
    { period: '15.10-31.10', employee: 'Петров Петр', phone: '+7 999 987-65-43', amount: '38 500 ₽', status: 'Ожидает', comment: 'Ждем реквизиты', restaurant: 'Чайхана' },
    { period: '01.10-14.10', employee: 'Сидоров Сидор', phone: '+7 999 555-44-33', amount: '42 000 ₽', status: 'Оплачено', comment: '-', restaurant: 'Евразия' },
    { period: '15.10-31.10', employee: 'Алексеев Алексей', phone: '+7 900 111-22-33', amount: '50 000 ₽', status: 'Оплачено', comment: '-', restaurant: 'Токио-City' },
];

const MOCK_DOCUMENTS = [
    { employee: 'Иванов Иван', phone: '+7 999 123-45-67', position: 'Официант', restaurant: 'Чайхана', status: 'processed' },
    { employee: 'Петров Петр', phone: '+7 999 987-65-43', position: 'Бармен', restaurant: 'Чайхана', status: 'partial' },
    { employee: 'Сидоров Сидор', phone: '+7 999 555-44-33', position: 'Повар', restaurant: 'Евразия', status: 'processed' },
    { employee: 'Алексеев Алексей', phone: '+7 900 111-22-33', position: 'Менеджер', restaurant: 'Токио-City', status: 'not-processed' },
];

const app = {
    currentRole: 'partner',
    currentRestaurant: 'Чайхана',
    currentView: 'home',

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.renderAll();
        this.initCharts();
    },

    cacheDOM() {
        this.roleSelect = document.getElementById('role-select');
        this.navItems = document.querySelectorAll('.nav-item');
        this.views = document.querySelectorAll('.view');
        this.userName = document.getElementById('current-user-name');
        this.userRole = document.getElementById('current-user-role');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.sidebar = document.querySelector('.sidebar');
        
        // Tables
        this.paymentsTableBody = document.querySelector('#payments-table tbody');
        this.documentsTableBody = document.querySelector('#documents-table tbody');
        
        // Stats
        this.dashTotal = document.getElementById('dash-total');
        this.dashProcessed = document.getElementById('dash-processed');
        this.dashInProcess = document.getElementById('dash-in-process');
        this.dashDismissed = document.getElementById('dash-dismissed');
        this.docCount = document.getElementById('doc-count');
        
        // Filters
        this.docRestaurantFilterGroup = document.getElementById('doc-restaurant-filter-group');
        this.docFilterRestaurant = document.getElementById('doc-filter-restaurant');
        this.docFilterStatus = document.getElementById('doc-filter-status');
        this.docFilterSearch = document.getElementById('doc-filter-search');
    },

    bindEvents() {
        // Role Switcher
        this.roleSelect.addEventListener('change', (e) => {
            this.setRole(e.target.value);
        });

        // Sidebar Toggle
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => {
                this.sidebar.classList.toggle('collapsed');
            });
        }

        // Navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.currentTarget.getAttribute('data-target');
                this.switchView(target);
            });
        });
        
        // Filters
        [this.docFilterRestaurant, this.docFilterStatus, this.docFilterSearch].forEach(el => {
            if(el) el.addEventListener('input', () => this.renderDocumentsTable());
        });
    },

    setRole(role) {
        this.currentRole = role;
        
        // Update UI based on role
        if (role === 'admin') {
            this.userName.textContent = 'Администратор';
            this.userRole.textContent = 'Полный доступ';
            this.currentRestaurant = 'all';
            this.docRestaurantFilterGroup.style.display = 'flex';
        } else if (role === 'partner') {
            this.userName.textContent = 'Чайхана';
            this.userRole.textContent = 'Партнер';
            this.currentRestaurant = 'Чайхана';
            this.docRestaurantFilterGroup.style.display = 'none';
        } else if (role === 'hr') {
            this.userName.textContent = 'HR Отдел';
            this.userRole.textContent = 'Менеджер по персоналу';
            this.currentRestaurant = 'all';
            this.docRestaurantFilterGroup.style.display = 'flex';
            // HR might land on documents page by default
            this.switchView('documents');
        }

        this.renderAll();
        this.updateCharts();
    },

    switchView(viewId) {
        this.currentView = viewId;
        
        // Update Nav
        this.navItems.forEach(item => {
            if (item.getAttribute('data-target') === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update Views
        this.views.forEach(view => {
            if (view.id === `view-${viewId}`) {
                view.classList.add('active');
            } else {
                view.classList.remove('active');
            }
        });

        // Update Header Titles
        const titles = {
            'home': 'Главная',
            'payments': 'Реестр выплат',
            'documents': 'Документы сотрудников',
            'dashboard': 'Аналитика'
        };
        document.getElementById('page-title').textContent = titles[viewId];
        
        // Refresh charts if dashboard
        if(viewId === 'dashboard') {
            this.updateCharts();
        }
    },

    renderAll() {
        this.renderPaymentsTable();
        this.renderDocumentsTable();
        this.renderStats();
    },

    getFilteredData(dataArray) {
        if (this.currentRole === 'partner') {
            return dataArray.filter(item => item.restaurant === this.currentRestaurant);
        }
        return dataArray; // Admin and HR see all
    },

    renderPaymentsTable() {
        let data = this.getFilteredData(MOCK_PAYMENTS);
        
        this.paymentsTableBody.innerHTML = '';
        data.forEach(payment => {
            const statusClass = payment.status === 'Оплачено' ? 'status-paid' : 'status-pending';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${payment.period}</td>
                <td><strong>${payment.employee}</strong><br><small style="color:var(--text-muted)">${this.currentRole !== 'partner' ? payment.restaurant : ''}</small></td>
                <td>${payment.phone}</td>
                <td><strong>${payment.amount}</strong></td>
                <td><span class="status-badge ${statusClass}">${payment.status}</span></td>
                <td>${payment.comment}</td>
            `;
            this.paymentsTableBody.appendChild(tr);
        });
    },

    renderDocumentsTable() {
        let data = this.getFilteredData(MOCK_DOCUMENTS);
        
        // Apply view filters
        const restFilter = this.docFilterRestaurant.value;
        const statusFilter = this.docFilterStatus.value;
        const searchFilter = this.docFilterSearch.value.toLowerCase();
        
        data = data.filter(doc => {
            let match = true;
            if (restFilter !== 'all' && doc.restaurant !== restFilter) match = false;
            if (statusFilter !== 'all' && doc.status !== statusFilter) match = false;
            if (searchFilter && !doc.employee.toLowerCase().includes(searchFilter) && !doc.phone.includes(searchFilter)) match = false;
            return match;
        });

        this.docCount.textContent = `${data.length} записей`;
        this.documentsTableBody.innerHTML = '';
        
        // Show/hide restaurant column based on role
        const colRest = document.querySelector('.col-restaurant');
        if(this.currentRole === 'partner') {
            colRest.style.display = 'none';
        } else {
            colRest.style.display = 'table-cell';
        }

        data.forEach(doc => {
            let statusText = '';
            let statusClass = '';
            if (doc.status === 'processed') { statusText = 'Оформлен'; statusClass = 'status-paid'; }
            else if (doc.status === 'partial') { statusText = 'Частично'; statusClass = 'status-partial'; }
            else { statusText = 'Не оформлен'; statusClass = 'status-error'; }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${doc.employee}</strong></td>
                <td>${doc.phone}</td>
                <td>${doc.position}</td>
                <td style="display: ${this.currentRole === 'partner' ? 'none' : 'table-cell'}">${doc.restaurant}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            `;
            this.documentsTableBody.appendChild(tr);
        });
    },

    renderStats() {
        const docs = this.getFilteredData(MOCK_DOCUMENTS);
        
        const total = docs.length;
        const processed = docs.filter(d => d.status === 'processed').length;
        const partial = docs.filter(d => d.status === 'partial').length;
        const error = docs.filter(d => d.status === 'not-processed').length;
        
        this.dashTotal.textContent = total;
        this.dashProcessed.textContent = processed;
        this.dashInProcess.textContent = partial;
        this.dashDismissed.textContent = error;
    },

    initCharts() {
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = 'Inter';

        const ctxStatus = document.getElementById('statusChart').getContext('2d');
        this.statusChart = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Оформлено', 'В процессе', 'Не оформлено'],
                datasets: [{
                    data: [2, 1, 1], // will be updated
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                },
                cutout: '70%'
            }
        });

        const ctxPayments = document.getElementById('paymentsChart').getContext('2d');
        this.paymentsChart = new Chart(ctxPayments, {
            type: 'bar',
            data: {
                labels: ['Сентябрь', '01.10-14.10', '15.10-31.10'],
                datasets: [{
                    label: 'Выплачено (₽)',
                    data: [120000, 42000, 133500], // will be updated
                    backgroundColor: '#6366f1',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
        
        this.updateCharts();
    },

    updateCharts() {
        if(!this.statusChart) return;
        
        const docs = this.getFilteredData(MOCK_DOCUMENTS);
        const processed = docs.filter(d => d.status === 'processed').length;
        const partial = docs.filter(d => d.status === 'partial').length;
        const error = docs.filter(d => d.status === 'not-processed').length;
        
        this.statusChart.data.datasets[0].data = [processed, partial, error];
        this.statusChart.update();
        
        // For payments chart, mock some different data based on role
        if(this.currentRole === 'partner') {
            this.paymentsChart.data.datasets[0].data = [45000, 0, 83500];
        } else {
            this.paymentsChart.data.datasets[0].data = [120000, 42000, 133500];
        }
        this.paymentsChart.update();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
