// Use dynamic API URL based on current origin for network access
const API_BASE_URL = window.location.origin;
const RELEASE_VERSION = "2024-12-21.v1";

let allStocks = [];
let displayedStocks = [];
let selectedStock = null;
let priceMap = {};
let portfolioHoldings = [];
let chartState = {
    symbol: null,
    interval: '5m',
    period: '5d',
    chart: null,
    rsiChart: null,
    candleSeries: null,
    volumeSeries: null,
    smaSeries: null,
    emaSeries: null,
    rsiSeries: null,
    rsiLinesReady: false,
};
let fiiDiiHistoryRecords = [];
let sectionLoaded = {
    gainers: false,
    losers: false,
    fii: false,
    mostActive: false,
    week52: false,
    weekly: false,
    bulkDeals: false,
};

function buildPriceMap(stocks = []) {
    const map = {};
    stocks.forEach(item => {
        if (!item || !item.symbol) return;
        const raw = item.lastPrice ?? item.last_price ?? item.closePrice ?? item.close_price;
        const price = parseFloat(raw);
        if (Number.isFinite(price)) {
            map[item.symbol] = price;
        }
    });
    return map;
}

function getToken() {
    return localStorage.getItem("access_token");
}

function redirectToLogin() {
    window.location.href = "/static/login.html";
}

function ensureAuthenticated() {
    const token = getToken();
    if (!token) {
        redirectToLogin();
        return false;
    }
    return true;
}

async function authFetch(url, options = {}) {
    if (!ensureAuthenticated()) {
        return Promise.reject(new Error("Not authenticated"));
    }
    const token = getToken();
    const headers = options.headers ? { ...options.headers } : {};
    headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        redirectToLogin();
        throw new Error("Unauthorized");
    }

    return res;
}

function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_email");
    redirectToLogin();
}

function setReleaseTag() {
    const el = document.getElementById("release-tag");
    if (el) {
        el.textContent = RELEASE_VERSION;
    }
}

function setInitialPlaceholders() {
    const msg3 = '<tr><td colspan="3" class="loading">Tap Refresh to load</td></tr>';
    const msg4 = '<tr><td colspan="4" class="loading">Tap Refresh to load</td></tr>';
    const msg5 = '<tr><td colspan="5" class="loading">Tap Refresh to load</td></tr>';

    const gainers = document.querySelector('#gainers-table tbody');
    if (gainers) gainers.innerHTML = msg3;
    const losers = document.querySelector('#losers-table tbody');
    if (losers) losers.innerHTML = msg3;
    const mostActive = document.querySelector('#most-active-table tbody');
    if (mostActive) mostActive.innerHTML = msg3;
    const weekHigh = document.querySelector('#week-52-high-table tbody');
    if (weekHigh) weekHigh.innerHTML = msg3;
    const bulkDeals = document.querySelector('#bulk-deals-table tbody');
    if (bulkDeals) bulkDeals.innerHTML = msg4;
    const weekly = document.getElementById('weekly-movers-container');
    if (weekly) weekly.innerHTML = '<div class="loading">Tap Refresh to load</div>';
    const portfolioTable = document.querySelector('#portfolio-table tbody');
    if (portfolioTable) portfolioTable.innerHTML = msg5;
    const stockList = document.getElementById('stock-list');
    if (stockList) stockList.innerHTML = '<div class="loading">Tap "Refresh list" to load stocks</div>';
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) lastUpdated.textContent = 'Last updated: tap Refresh to load';

    hideDataSections();
}

function hideDataSections() {
    const selectors = [
        '#gainers-content',
        '#losers-content',
        '.fii-dii-timeline',
        '.fii-dii-container',
        '#most-active-table',
        '#week-52-high-table',
        '#weekly-movers-container',
        '#bulk-deals-table',
    ];
    selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.classList.add('hidden');
    });
}

function revealSection(key) {
    const map = {
        gainers: '#gainers-content',
        losers: '#losers-content',
        fii: '.fii-dii-container',
        mostActive: '#most-active-table',
        week52: '#week-52-high-table',
        weekly: '#weekly-movers-container',
        bulkDeals: '#bulk-deals-table',
    };
    const sel = map[key];
    if (!sel) return;
    const el = document.querySelector(sel);
    if (el) el.classList.remove('hidden');

    if (key === 'fii') {
        const timeline = document.querySelector('.fii-dii-timeline');
        if (timeline) timeline.classList.remove('hidden');
    }
}

function loadSection(key) {
    switch (key) {
        case 'gainers':
            revealSection('gainers');
            fetchGainers();
            break;
        case 'losers':
            revealSection('losers');
            fetchLosers();
            break;
        case 'fii':
            revealSection('fii');
            fetchFIIDII();
            break;
        case 'mostActive':
            revealSection('mostActive');
            fetchMostActive();
            break;
        case 'week52':
            revealSection('week52');
            fetch52WeekHigh();
            break;
        case 'bulkDeals':
            revealSection('bulkDeals');
            fetchBulkDeals();
            break;
        case 'weekly':
            revealSection('weekly');
            fetchWeeklyGainers();
            break;
        default:
            break;
    }
}

async function fetchProfile() {
    try {
        const res = await authFetch(`${API_BASE_URL}/profile/me`);
        const data = await res.json();
        setUserChip(data.profile);
    } catch (err) {
        console.error("Error fetching profile:", err);
        setUserChip(null);
    }
}

function setUserChip(profile) {
    const chip = document.getElementById("user-chip");
    if (!chip) return;

    const nameEl = chip.querySelector(".user-name");
    const emailEl = chip.querySelector(".user-email");

    if (profile) {
        nameEl.textContent = profile.display_name || "User";
        emailEl.textContent = profile.preferences?.email || localStorage.getItem("user_email") || profile.user_id;
    } else {
        nameEl.textContent = "Signed in";
        emailEl.textContent = localStorage.getItem("user_email") || "";
    }
}

// Top-level view switching (market dashboard vs virtual trading)
function switchView(viewName) {
    document.querySelectorAll('.view-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('hidden', panel.id !== `${viewName}-view`);
    });

    if (viewName === 'virtual' && allStocks.length === 0) {
        fetchAllStocks(true);
    }
}

// Tab switching function
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tabName}-content`).classList.remove('hidden');

    // Lazy load tab data on first open
    if (tabName === 'gainers') {
        revealSection('gainers');
        fetchGainers();
    } else if (tabName === 'losers') {
        revealSection('losers');
        fetchLosers();
    }
}

function switchVirtualTab(tabName) {
    const tabs = ['stocks', 'portfolio'];
    tabs.forEach(name => {
        document.querySelectorAll(`.virtual-subtab[data-tab="${name}"]`).forEach(btn => {
            btn.classList.toggle('active', name === tabName);
        });
        const panel = document.getElementById(`virtual-tab-${name}`);
        if (panel) {
            panel.classList.toggle('hidden', name !== tabName);
        }
    });

    if (tabName === 'portfolio') {
        fetchPortfolio();
    } else if (tabName === 'stocks' && allStocks.length === 0) {
        fetchAllStocks(true);
    }
}

async function fetchData() {
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = 'Loading...';

    // Reset lazy flags to force reload
    sectionLoaded = {
        gainers: false,
        losers: false,
        fii: false,
        mostActive: false,
        week52: false,
        weekly: false,
        bulkDeals: false,
    };

    try {
        await Promise.all([
            fetchAllStocks(true),
            fetchGainers(true),
            fetchLosers(true),
            fetchFIIDII(true),
            fetchMostActive(true),
            fetch52WeekHigh(true),
            fetchBulkDeals(true),
            fetchWeeklyGainers(true)
        ]);
        updateTimestamp();
    } catch (error) {
        console.error('Error fetching data:', error);
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
            Refresh
        `;
    }
}

async function fetchGainers(force = false) {
    if (!force && sectionLoaded.gainers) return;
    try {
        const tbody = document.querySelector('#gainers-table tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="loading">Loading...</td></tr>';

        const response = await authFetch(`${API_BASE_URL}/nse_data/top-gainers`);
        const data = await response.json();
        renderTable('gainers-table', data.top_gainers, true);
        sectionLoaded.gainers = true;
    } catch (error) {
        console.error('Error fetching gainers:', error);
        document.querySelector('#gainers-table tbody').innerHTML = '<tr><td colspan="3" class="loading">Error loading data</td></tr>';
    }
}

async function fetchLosers(force = false) {
    if (!force && sectionLoaded.losers) return;
    try {
        const tbody = document.querySelector('#losers-table tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="loading">Loading...</td></tr>';

        const response = await authFetch(`${API_BASE_URL}/nse_data/top-losers`);
        const data = await response.json();
        renderTable('losers-table', data.top_losers, false);
        sectionLoaded.losers = true;
    } catch (error) {
        console.error('Error fetching losers:', error);
        document.querySelector('#losers-table tbody').innerHTML = '<tr><td colspan="3" class="loading">Error loading data</td></tr>';
    }
}

function renderTable(tableId, items, isGainer) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="loading">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => `
        <tr>
            <td>
                <div style="font-weight: 600">${item.symbol}</div>
            </td>
            <td class="text-right">₹${parseFloat(item.lastPrice).toFixed(2)}</td>
            <td class="text-right ${isGainer ? 'positive' : 'negative'}">
                ${item.pChange > 0 ? '+' : ''}${parseFloat(item.pChange).toFixed(2)}%
            </td>
        </tr>
    `).join('');
}

async function fetchFIIDII(force = false) {
    if (!force && sectionLoaded.fii) return;
    try {
        const dateEl = document.getElementById('fii-dii-date');
        if (dateEl) dateEl.textContent = 'Loading...';
        revealSection('fii');

        const historyResponse = await authFetch(`${API_BASE_URL}/nse_data/fii-dii-history?limit=30`);
        const historyData = await historyResponse.json();
        if (historyData.records && historyData.records.length) {
            fiiDiiHistoryRecords = historyData.records;
            renderFIIDIIHistory(historyData.records);
            sectionLoaded.fii = true;
            return;
        }

        const response = await authFetch(`${API_BASE_URL}/nse_data/fii-dii-activity`);
        const data = await response.json();
        renderFIIDII(data);
        sectionLoaded.fii = true;
    } catch (error) {
        console.error('Error fetching FII/DII data:', error);
    }
}

function renderFIIDII(data) {
    if (!data) return;
    
    // Update date
    if (data.date) {
        document.getElementById('fii-dii-date').textContent = data.date;
    }
    
    // Render FII data
    if (data.fii) {
        document.getElementById('fii-buy').textContent = `₹${parseFloat(data.fii.buyValue).toFixed(2)} Cr`;
        document.getElementById('fii-sell').textContent = `₹${parseFloat(data.fii.sellValue).toFixed(2)} Cr`;
        
        const fiiNet = parseFloat(data.fii.netValue);
        const fiiNetElement = document.getElementById('fii-net');
        fiiNetElement.textContent = `${fiiNet > 0 ? '+' : ''}₹${fiiNet.toFixed(2)} Cr`;
        fiiNetElement.className = `stat-value ${fiiNet > 0 ? 'positive' : 'negative'}`;
    }
    
    // Render DII data
    if (data.dii) {
        document.getElementById('dii-buy').textContent = `₹${parseFloat(data.dii.buyValue).toFixed(2)} Cr`;
        document.getElementById('dii-sell').textContent = `₹${parseFloat(data.dii.sellValue).toFixed(2)} Cr`;
        
        const diiNet = parseFloat(data.dii.netValue);
        const diiNetElement = document.getElementById('dii-net');
        diiNetElement.textContent = `${diiNet > 0 ? '+' : ''}₹${diiNet.toFixed(2)} Cr`;
        diiNetElement.className = `stat-value ${diiNet > 0 ? 'positive' : 'negative'}`;
    }
}

function renderFIIDIIHistory(records) {
    const scroll = document.getElementById('fii-dii-scroll');
    if (!scroll) return;

    if (!records || !records.length) {
        scroll.innerHTML = '<div class="loading">No dates available</div>';
        return;
    }

    scroll.innerHTML = records.map((record, idx) => {
        const label = formatDateChip(record.trade_date);
        const activeClass = idx === 0 ? 'active' : '';
        return `<button class="date-chip ${activeClass}" data-index="${idx}">${label}</button>`;
    }).join('');

    const buttons = scroll.querySelectorAll('.date-chip');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const index = Number(btn.dataset.index);
            setActiveDateChip(scroll, btn);
            const record = fiiDiiHistoryRecords[index];
            if (record) {
                renderFIIDIIRecord(record);
            }
        });
    });

    renderFIIDIIRecord(records[0]);
}

function renderFIIDIIRecord(record) {
    if (!record) return;
    const dateLabel = formatDateLabel(record.trade_date, record.source_date_str);
    const dateEl = document.getElementById('fii-dii-date');
    if (dateEl) dateEl.textContent = dateLabel;

    setValueWithPrefix('fii-buy', record.fii_buy_value);
    setValueWithPrefix('fii-sell', record.fii_sell_value);
    setNetValue('fii-net', record.fii_net_value);
    setValueWithPrefix('dii-buy', record.dii_buy_value);
    setValueWithPrefix('dii-sell', record.dii_sell_value);
    setNetValue('dii-net', record.dii_net_value);
}

function setValueWithPrefix(elementId, value) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        el.textContent = '--';
        el.className = 'stat-value';
        return;
    }
    el.textContent = `₹${Number(value).toFixed(2)} Cr`;
    el.className = 'stat-value';
}

function setNetValue(elementId, value) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        el.textContent = '--';
        el.className = 'stat-value';
        return;
    }
    const num = Number(value);
    el.textContent = `${num > 0 ? '+' : ''}₹${num.toFixed(2)} Cr`;
    el.className = `stat-value ${num > 0 ? 'positive' : 'negative'}`;
}

function setActiveDateChip(container, activeButton) {
    const chips = container.querySelectorAll('.date-chip');
    chips.forEach(chip => chip.classList.remove('active'));
    activeButton.classList.add('active');
}

function formatDateChip(dateStr) {
    if (!dateStr) return '--';
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatDateLabel(dateStr, fallback) {
    if (fallback) return fallback;
    if (!dateStr) return '--';
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}


function updateTimestamp() {
    const now = new Date();
    document.getElementById('last-updated').textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

async function fetchMostActive(force = false) {
    if (!force && sectionLoaded.mostActive) return;
    try {
        const tbody = document.querySelector('#most-active-table tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="loading">Loading...</td></tr>';
        revealSection('mostActive');

        const response = await authFetch(`${API_BASE_URL}/nse_data/most-active-volume`);
        const data = await response.json();
        renderMostActive(data.most_active);
        sectionLoaded.mostActive = true;
    } catch (error) {
        console.error('Error fetching most active:', error);
        document.querySelector('#most-active-table tbody').innerHTML = '<tr><td colspan="3" class="loading">Error loading data</td></tr>';
    }
}

function renderMostActive(items) {
    const tbody = document.querySelector('#most-active-table tbody');
    
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="loading">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => {
        // NSE API returns standard stock fields, not specific volume/value fields
        const symbol = item.symbol || 'N/A';
        const lastPrice = item.lastPrice || 0;
        const pChange = item.pChange || 0;
        
        return `
        <tr>
            <td><div style="font-weight: 600">${symbol}</div></td>
            <td class="text-right">₹${parseFloat(lastPrice).toFixed(2)}</td>
            <td class="text-right ${pChange >= 0 ? 'positive' : 'negative'}">${pChange >= 0 ? '+' : ''}${parseFloat(pChange).toFixed(2)}%</td>
        </tr>
    `}).join('');
}

async function fetch52WeekHigh(force = false) {
    if (!force && sectionLoaded.week52) return;
    try {
        const tbody = document.querySelector('#week-52-high-table tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="loading">Loading...</td></tr>';
        revealSection('week52');

        const response = await authFetch(`${API_BASE_URL}/nse_data/52-week-high`);
        const data = await response.json();
        render52WeekHigh(data.stocks);
        sectionLoaded.week52 = true;
    } catch (error) {
        console.error('Error fetching 52-week high:', error);
        document.querySelector('#week-52-high-table tbody').innerHTML = '<tr><td colspan="3" class="loading">Error loading data</td></tr>';
    }
}

function render52WeekHigh(items) {
    const tbody = document.querySelector('#week-52-high-table tbody');
    
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="loading">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => {
        const symbol = item.symbol || 'N/A';
        const lastPrice = item.lastPrice || item.last_price || 0;
        const yearHigh = item.yearHigh || item.year_high || 0;
        
        return `
        <tr>
            <td><div style="font-weight: 600">${symbol}</div></td>
            <td class="text-right">₹${parseFloat(lastPrice).toFixed(2)}</td>
            <td class="text-right">₹${parseFloat(yearHigh).toFixed(2)}</td>
        </tr>
    `}).join('');
}

async function fetchBulkDeals(force = false) {
    if (!force && sectionLoaded.bulkDeals) return;
    try {
        const tbody = document.querySelector('#bulk-deals-table tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="loading">Loading...</td></tr>';
        revealSection('bulkDeals');

        const response = await authFetch(`${API_BASE_URL}/nse_data/bulk-deals`);
        const data = await response.json();
        renderBulkDeals(data.bulk_deals, data.date);
        sectionLoaded.bulkDeals = true;
    } catch (error) {
        console.error('Error fetching bulk deals:', error);
        document.querySelector('#bulk-deals-table tbody').innerHTML = '<tr><td colspan="4" class="loading">Error loading data</td></tr>';
    }
}

function renderBulkDeals(items, date) {
    const tbody = document.querySelector('#bulk-deals-table tbody');
    
    if (date) {
        document.getElementById('bulk-deals-date').textContent = date;
    }
    
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">No bulk deals today</td></tr>';
        return;
    }

    tbody.innerHTML = items.slice(0, 10).map(item => `
        <tr>
            <td><div style="font-weight: 600">${item.symbol || item.BD_SYMBOL || 'N/A'}</div></td>
            <td>${item.clientName || item.client_name || item.BD_CLIENT_NAME || 'N/A'}</td>
            <td class="text-right">${(item.quantity || item.quantityTraded || item.BD_QTY_TRD || 0).toLocaleString()}</td>
            <td class="text-right">₹${parseFloat(item.tradePrice || item.price || item.BD_TP_WATP || 0).toFixed(2)}</td>
        </tr>
    `).join('');
}

// Virtual trading view
async function fetchAllStocks(forceSelect = false) {
    const listElement = document.getElementById('stock-list');
    if (listElement) {
        listElement.innerHTML = '<div class="loading">Loading stocks...</div>';
    }

    try {
        const response = await authFetch(`${API_BASE_URL}/nse_data/all-stocks`);
        const data = await response.json();
        allStocks = (data.stocks || []).filter(stock => stock && stock.symbol);
        priceMap = buildPriceMap(allStocks);
        const searchInput = document.getElementById('stock-search');
        const currentQuery = searchInput ? searchInput.value : '';

        if (currentQuery) {
            filterStockList(currentQuery);
        } else {
            renderAllStocksList(allStocks);
        }

        const selectionPool = currentQuery ? displayedStocks : allStocks;

        if (selectionPool.length > 0 && (forceSelect || !selectedStock)) {
            selectStock(selectionPool[0].symbol);
        }

        if (portfolioHoldings.length > 0) {
            renderPortfolio(portfolioHoldings);
        }
    } catch (error) {
        console.error('Error fetching full stock list:', error);
        if (listElement) {
            listElement.innerHTML = '<div class="loading">Unable to load stocks</div>';
        }
    }
}

function renderAllStocksList(stocks) {
    const listElement = document.getElementById('stock-list');
    if (!listElement) return;

    displayedStocks = stocks;

    if (!stocks || stocks.length === 0) {
        listElement.innerHTML = '<div class="loading">No stocks found</div>';
        return;
    }

    listElement.innerHTML = stocks.map(stock => {
        const priceVal = parseFloat(stock.lastPrice || stock.last_price);
        const changeVal = parseFloat(stock.pChange);
        const priceText = Number.isFinite(priceVal) ? `₹${priceVal.toFixed(2)}` : '--';
        const changeText = Number.isFinite(changeVal) ? `${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(2)}%` : '--';
        const changeClass = Number.isFinite(changeVal) ? (changeVal >= 0 ? 'positive' : 'negative') : '';

        return `
            <div class="stock-row ${selectedStock && selectedStock.symbol === stock.symbol ? 'active' : ''}" data-symbol="${stock.symbol}">
                <div>
                    <div class="stock-row-symbol">${stock.symbol}</div>
                    <div class="stock-row-sub">NSE • ${stock.identifier || 'Equity'}</div>
                </div>
                <div class="stock-row-right">
                    <div class="stock-row-price">${priceText}</div>
                    <div class="chip ${changeClass}">${changeText}</div>
                </div>
            </div>
        `;
    }).join('');
}

function filterStockList(query) {
    const lower = (query || '').toLowerCase().trim();
    if (!lower) {
        renderAllStocksList(allStocks);
        return;
    }

    const filtered = allStocks.filter(stock => {
        const symbolMatch = (stock.symbol || '').toLowerCase().includes(lower);
        const idMatch = (stock.identifier || '').toLowerCase().includes(lower);
        return symbolMatch || idMatch;
    });

    renderAllStocksList(filtered);
}

function selectStock(symbol) {
    const stock = allStocks.find(item => item.symbol === symbol);
    if (!stock) return;

    selectedStock = stock;
    openStockTradeModal(stock);
    renderAllStocksList(displayedStocks);
}

function openStockTradeModal(stock) {
    const modal = document.getElementById('stock-trade-modal');
    const titleEl = document.getElementById('stock-trade-title');
    const contentEl = document.getElementById('stock-trade-content');
    
    if (!modal || !contentEl) return;

    const priceVal = parseFloat(stock.lastPrice || stock.last_price || 0);
    const changeVal = parseFloat(stock.pChange || 0);
    const openVal = parseFloat(stock.open || stock.openPrice || 0);
    const highVal = parseFloat(stock.dayHigh || stock.high || 0);
    const lowVal = parseFloat(stock.dayLow || stock.low || 0);

    const changeText = Number.isFinite(changeVal) ? `${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(2)}%` : '--';
    const priceText = Number.isFinite(priceVal) ? `₹${priceVal.toFixed(2)}` : '--';
    const changeClass = Number.isFinite(changeVal) ? (changeVal >= 0 ? 'positive' : 'negative') : '';

    titleEl.textContent = stock.symbol;

    contentEl.innerHTML = `
        <div class="stock-trade-price-row">
            <div class="stock-trade-price-block">
                <span class="stock-trade-label">Current Price</span>
                <span class="stock-trade-price">${priceText}</span>
            </div>
            <div class="chip large ${changeClass}">${changeText}</div>
        </div>
        <div class="stock-trade-stats">
            <div class="stock-trade-stat">
                <span class="stock-trade-stat-label">High</span>
                <span class="stock-trade-stat-value">₹${Number.isFinite(highVal) ? highVal.toFixed(2) : '--'}</span>
            </div>
            <div class="stock-trade-stat">
                <span class="stock-trade-stat-label">Low</span>
                <span class="stock-trade-stat-value">₹${Number.isFinite(lowVal) ? lowVal.toFixed(2) : '--'}</span>
            </div>
            <div class="stock-trade-stat">
                <span class="stock-trade-stat-label">Open</span>
                <span class="stock-trade-stat-value">₹${Number.isFinite(openVal) ? openVal.toFixed(2) : '--'}</span>
            </div>
        </div>
        <div class="stock-trade-input-row">
            <div class="stock-trade-input-group">
                <label>Quantity</label>
                <input type="number" id="trade-qty-input" value="1" min="1">
            </div>
            <div class="stock-trade-input-group">
                <label>Price (₹)</label>
                <input type="number" id="trade-price-input" value="${priceVal.toFixed(2)}" step="0.01">
            </div>
        </div>
        <div class="stock-trade-total">
            <span>Total Value</span>
            <span class="stock-trade-total-value ${changeClass}" id="trade-total-value">₹${priceVal.toFixed(2)}</span>
        </div>
        <div class="stock-trade-actions">
            <button class="trade-btn buy" onclick="executeModalTrade('BUY')">BUY</button>
            <button class="trade-btn sell" onclick="executeModalTrade('SELL')">SELL</button>
            <button class="trade-btn outline" onclick="closeStockTradeModal(); openChartModal();">View chart</button>
        </div>
        <div id="stock-trade-toast" class="stock-trade-toast hidden"></div>
    `;

    // Attach input listeners for live total calculation
    const qtyInput = document.getElementById('trade-qty-input');
    const priceInput = document.getElementById('trade-price-input');
    const totalEl = document.getElementById('trade-total-value');

    const updateTotal = () => {
        const qty = parseInt(qtyInput.value) || 0;
        const prc = parseFloat(priceInput.value) || 0;
        totalEl.textContent = `₹${(qty * prc).toFixed(2)}`;
    };

    qtyInput.addEventListener('input', updateTotal);
    priceInput.addEventListener('input', updateTotal);

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeStockTradeModal() {
    const modal = document.getElementById('stock-trade-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

async function executeModalTrade(action) {
    const toast = document.getElementById('stock-trade-toast');
    if (!toast || !selectedStock) return;

    const qtyInput = document.getElementById('trade-qty-input');
    const priceInput = document.getElementById('trade-price-input');
    
    const qty = parseInt(qtyInput?.value) || 1;
    const price = parseFloat(priceInput?.value) || parseFloat(selectedStock.lastPrice || selectedStock.last_price || 0);

    const side = action.toUpperCase();

    try {
        const res = await authFetch(`${API_BASE_URL}/portfolio/trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol: selectedStock.symbol,
                quantity: qty,
                price: price || 1,
                side,
            })
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body.detail || `Failed to ${side}`);
        }

        toast.textContent = `${side} ${qty} ${selectedStock.symbol} @ ₹${price.toFixed(2)}`;
        toast.className = 'stock-trade-toast success show';
        
        if (body?.holdings) {
            portfolioHoldings = body.holdings;
            renderPortfolio(portfolioHoldings);
        } else {
            fetchPortfolio();
        }

        // Close modal after successful trade
        setTimeout(() => {
            closeStockTradeModal();
        }, 1200);
    } catch (err) {
        toast.textContent = err?.message || `Failed to ${side}`;
        toast.className = 'stock-trade-toast error show';
    }

    setTimeout(() => {
        toast.className = 'stock-trade-toast hidden';
    }, 2500);
}

function renderSelectedStock(stock) {
    const panel = document.getElementById('trade-panel');
    if (!panel) return;

    panel.classList.remove('empty');

    const priceVal = parseFloat(stock.lastPrice || stock.last_price || 0);
    const changeVal = parseFloat(stock.pChange || 0);
    const openVal = parseFloat(stock.open || stock.openPrice || 0);
    const highVal = parseFloat(stock.dayHigh || stock.high || 0);
    const lowVal = parseFloat(stock.dayLow || stock.low || 0);
    const prevCloseVal = parseFloat(stock.previousClose || stock.closePrice || 0);
    const volumeVal = stock.totalTradedVolume || stock.volume || 0;
    const yearHigh = parseFloat(stock.yearHigh || stock.year_high || 0);
    const yearLow = parseFloat(stock.yearLow || stock.year_low || 0);

    const changeText = Number.isFinite(changeVal) ? `${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(2)}%` : '--';
    const priceText = Number.isFinite(priceVal) ? `₹${priceVal.toFixed(2)}` : '--';
    const changeClass = Number.isFinite(changeVal) ? (changeVal >= 0 ? 'positive' : 'negative') : '';

    panel.innerHTML = `
        <div class="trade-header">
            <div>
                <div class="symbol-label">${stock.symbol}</div>
                <div class="trade-sub">NSE • ${stock.identifier || 'Equity'}</div>
            </div>
            <div class="price-block">
                <div class="price">${priceText}</div>
                <div class="chip ${changeClass}">${changeText}</div>
            </div>
        </div>
        <div class="pill-row">
            <span class="pill">Virtual trading</span>
            <span class="pill subtle">Depth is simulated</span>
        </div>
        <div class="trade-actions">
            <button class="trade-btn buy" onclick="simulateTrade('BUY')">Buy</button>
            <button class="trade-btn sell" onclick="simulateTrade('SELL')">Sell</button>
            <button class="trade-btn outline" onclick="openChartModal()">View chart</button>
        </div>
        <div class="sparkline-card">
            <div class="sparkline-header">
                <div>
                    <div class="eyebrow">Trend</div>
                    <div class="sparkline-title">Past 30 ticks</div>
                </div>
                <span class="muted">Demo curve</span>
            </div>
            <canvas id="sparkline-canvas" width="360" height="120"></canvas>
        </div>
        <div class="depth-card">
            <div class="depth-header">
                <div>
                    <div class="eyebrow">Market depth</div>
                    <div class="muted">Bid / Offer ladders</div>
                </div>
                <div class="pill subtle">Live data soon</div>
            </div>
            <table class="depth-table">
                <thead>
                    <tr>
                        <th class="text-right">Bid</th>
                        <th class="text-right">Bid Qty</th>
                        <th class="text-right">Offer</th>
                        <th class="text-right">Offer Qty</th>
                    </tr>
                </thead>
                <tbody id="depth-body">
                </tbody>
            </table>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-label">Open</span>
                <span class="stat-value">₹${Number.isFinite(openVal) ? openVal.toFixed(2) : '--'}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">High</span>
                <span class="stat-value">₹${Number.isFinite(highVal) ? highVal.toFixed(2) : '--'}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Low</span>
                <span class="stat-value">₹${Number.isFinite(lowVal) ? lowVal.toFixed(2) : '--'}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Prev Close</span>
                <span class="stat-value">₹${Number.isFinite(prevCloseVal) ? prevCloseVal.toFixed(2) : '--'}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Volume</span>
                <span class="stat-value">${volumeVal ? volumeVal.toLocaleString() : '--'}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">52W Range</span>
                <span class="stat-value">₹${Number.isFinite(yearLow) ? yearLow.toFixed(2) : '--'} - ₹${Number.isFinite(yearHigh) ? yearHigh.toFixed(2) : '--'}</span>
            </div>
        </div>
        <div id="virtual-toast" class="virtual-toast hidden"></div>
    `;

    renderDepth(priceVal);
    drawSparkline('sparkline-canvas', stock);
}

function renderDepth(basePrice) {
    const tbody = document.getElementById('depth-body');
    if (!tbody) return;

    const price = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 100;

    const rows = Array.from({ length: 5 }).map((_, idx) => {
        const spread = (idx + 1) * 0.35;
        const bid = price - spread;
        const offer = price + spread;
        const bidQty = Math.round(price * 1.5 + idx * 25);
        const offerQty = Math.round(price * 1.2 + idx * 35);

        return `
            <tr>
                <td class="text-right">₹${bid.toFixed(2)}</td>
                <td class="text-right">${bidQty}</td>
                <td class="text-right">₹${offer.toFixed(2)}</td>
                <td class="text-right">${offerQty}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;
}

function generateSparklinePoints(stock) {
    const base = Number.isFinite(parseFloat(stock.lastPrice)) ? parseFloat(stock.lastPrice) : 120;
    const seed = (stock.symbol || 'STK').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    let current = base;

    return Array.from({ length: 30 }).map((_, idx) => {
        const wave = Math.sin((seed + idx) * 0.35) * 0.6 + Math.cos((seed + idx) * 0.2) * 0.4;
        current = Math.max(1, current + wave);
        return current;
    });
}

function drawSparkline(canvasId, stock) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const points = generateSparklinePoints(stock);
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    ctx.beginPath();
    points.forEach((point, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height - ((point - min) / range) * height;
        if (idx === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0, 208, 156, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 208, 156, 0)');

    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height - ((point - min) / range) * height;
        if (idx === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.strokeStyle = '#00d09c';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function openChartModal() {
    if (!selectedStock) return;
    const modal = document.getElementById('chart-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    chartState.symbol = selectedStock.symbol;
    updateChartHeader();
    const ready = initChartInstances();
    if (!ready) return;
    setActiveRangeButtons(chartState.interval, chartState.period);
    loadChartData(chartState.symbol, chartState.interval, chartState.period);
}

function closeChartModal() {
    const modal = document.getElementById('chart-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function initChartInstances() {
    if (chartState.chart && chartState.rsiChart) {
        resizeCharts();
        return true;
    }
    if (!window.LightweightCharts) {
        setChartLoading(false, 'Chart library failed to load');
        return false;
    }

    const candleContainer = document.getElementById('candles-chart');
    const rsiContainer = document.getElementById('rsi-chart');
    if (!candleContainer || !rsiContainer) return false;

    chartState.chart = LightweightCharts.createChart(candleContainer, {
        layout: {
            background: { color: '#181b21' },
            textColor: '#e1e3e6',
            fontFamily: 'Inter, system-ui, sans-serif',
        },
        grid: {
            vertLines: { color: '#1f242d' },
            horzLines: { color: '#1f242d' },
        },
        rightPriceScale: { borderColor: '#2d333b' },
        timeScale: { timeVisible: true },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    });

    chartState.candleSeries = chartState.chart.addCandlestickSeries({
        upColor: '#00d09c',
        downColor: '#ff4d4d',
        wickUpColor: '#00d09c',
        wickDownColor: '#ff4d4d',
        borderVisible: false,
    });

    chartState.volumeSeries = chartState.chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartState.smaSeries = chartState.chart.addLineSeries({
        color: '#f5c542',
        lineWidth: 2,
        priceLineVisible: false,
    });

    chartState.emaSeries = chartState.chart.addLineSeries({
        color: '#4f9cf7',
        lineWidth: 2,
        priceLineVisible: false,
    });

    chartState.rsiChart = LightweightCharts.createChart(rsiContainer, {
        layout: {
            background: { color: '#181b21' },
            textColor: '#e1e3e6',
            fontFamily: 'Inter, system-ui, sans-serif',
        },
        grid: {
            vertLines: { color: '#1f242d' },
            horzLines: { color: '#1f242d' },
        },
        rightPriceScale: { borderColor: '#2d333b' },
        timeScale: { timeVisible: true },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    });

    chartState.rsiSeries = chartState.rsiChart.addLineSeries({
        color: '#9b74ff',
        lineWidth: 2,
        priceLineVisible: false,
    });

    chartState.rsiChart.priceScale('right').applyOptions({ minValue: 0, maxValue: 100 });
    chartState.rsiSeries.createPriceLine({
        price: 70,
        color: '#4f9cf7',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
    });
    chartState.rsiSeries.createPriceLine({
        price: 30,
        color: '#ff4d4d',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
    });

    chartState.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range && chartState.rsiChart) {
            chartState.rsiChart.timeScale().setVisibleLogicalRange(range);
        }
    });

    resizeCharts();
    return true;
}

function resizeCharts() {
    const candleContainer = document.getElementById('candles-chart');
    const rsiContainer = document.getElementById('rsi-chart');
    if (!candleContainer || !rsiContainer) return;
    if (chartState.chart) {
        chartState.chart.applyOptions({
            width: candleContainer.clientWidth,
            height: candleContainer.clientHeight,
        });
    }
    if (chartState.rsiChart) {
        chartState.rsiChart.applyOptions({
            width: rsiContainer.clientWidth,
            height: rsiContainer.clientHeight,
        });
    }
}

async function loadChartData(symbol, interval, period) {
    if (!symbol) return;
    setChartLoading(true, 'Loading chart...');
    try {
        const url = `${API_BASE_URL}/market-data/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}&period=${period}`;
        const res = await authFetch(url);
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || 'Failed to load chart');
        }
        applyChartData(data);
        updateChartHeader(data.interval, data.period);
        setChartLoading(false);
    } catch (err) {
        setChartLoading(false, err?.message || 'Failed to load chart');
    }
}

function applyChartData(data) {
    if (!data || !chartState.candleSeries) return;
    chartState.candleSeries.setData(data.candles || []);
    if (chartState.volumeSeries) {
        chartState.volumeSeries.setData(data.volume || []);
    }
    if (chartState.smaSeries) {
        chartState.smaSeries.setData(data.indicators?.sma20 || []);
    }
    if (chartState.emaSeries) {
        chartState.emaSeries.setData(data.indicators?.ema20 || []);
    }
    if (chartState.rsiSeries) {
        chartState.rsiSeries.setData(data.indicators?.rsi14 || []);
    }
    if (chartState.chart) {
        chartState.chart.timeScale().fitContent();
    }
    if (chartState.rsiChart) {
        chartState.rsiChart.timeScale().fitContent();
    }
}

function updateChartHeader(interval = chartState.interval, period = chartState.period) {
    const title = document.getElementById('chart-title');
    const subtitle = document.getElementById('chart-subtitle');
    if (title) title.textContent = `${chartState.symbol || 'Chart'}`;
    if (subtitle) subtitle.textContent = `${interval.toUpperCase()} • ${period}`;
}

function setChartLoading(isLoading, message) {
    const loadingEl = document.getElementById('chart-loading');
    const contentEl = document.querySelector('.chart-content');
    const showContent = !isLoading && !message;
    if (loadingEl) {
        loadingEl.textContent = message || 'Loading chart...';
        loadingEl.style.display = isLoading || message ? 'block' : 'none';
    }
    if (contentEl) {
        contentEl.style.display = showContent ? 'flex' : 'none';
    }
}

function setActiveRangeButtons(interval, period) {
    const buttons = document.querySelectorAll('.chart-range');
    buttons.forEach(btn => {
        const isActive = btn.dataset.interval === interval && btn.dataset.period === period;
        btn.classList.toggle('active', isActive);
    });
}

function attachChartHandlers() {
    const modal = document.getElementById('chart-modal');
    if (modal) {
        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeChartModal();
            }
        });
    }

    document.querySelectorAll('.chart-range').forEach(btn => {
        btn.addEventListener('click', () => {
            const interval = btn.dataset.interval;
            const period = btn.dataset.period;
            chartState.interval = interval;
            chartState.period = period;
            setActiveRangeButtons(interval, period);
            loadChartData(chartState.symbol, interval, period);
        });
    });

    window.addEventListener('resize', () => {
        if (!document.getElementById('chart-modal')?.classList.contains('hidden')) {
            resizeCharts();
        }
    });
}

async function simulateTrade(action) {
    const toast = document.getElementById('virtual-toast');
    if (!toast || !selectedStock) return;

    const side = action.toUpperCase();
    if (side === 'CHART') {
        openChartModal();
        return;
    }

    const qty = 1;
    const priceVal = parseFloat(selectedStock.lastPrice || selectedStock.last_price || 0);

    try {
        const res = await authFetch(`${API_BASE_URL}/portfolio/trade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol: selectedStock.symbol,
                quantity: qty,
                price: priceVal || 1,
                side,
            })
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body.detail || `Failed to ${side}`);
        }

        toast.textContent = `${side} ${selectedStock.symbol} recorded`;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        if (body?.holdings) {
            portfolioHoldings = body.holdings;
            renderPortfolio(portfolioHoldings);
        } else {
            fetchPortfolio();
        }
    } catch (err) {
        toast.textContent = err?.message || `Failed to ${side}`;
        toast.classList.remove('hidden');
        toast.classList.add('show');
    } finally {
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hidden');
        }, 1600);
    }
}

function attachStockListHandler() {
    const listElement = document.getElementById('stock-list');
    if (!listElement) return;

    listElement.addEventListener('click', event => {
        const row = event.target.closest('.stock-row');
        if (row && row.dataset.symbol) {
            selectStock(row.dataset.symbol);
        }
    });
}

async function fetchPortfolio() {
    try {
        const res = await authFetch(`${API_BASE_URL}/portfolio`);
        if (!res.ok) {
            throw new Error('Failed to load portfolio');
        }
        const data = await res.json();
        portfolioHoldings = data.holdings || [];
        renderPortfolio(portfolioHoldings);
    } catch (err) {
        console.error('Error fetching portfolio', err);
    }
}

function renderPortfolio(holdings) {
    const tbody = document.querySelector('#portfolio-table tbody');
    if (!tbody) return;

    if (!holdings || holdings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No trades yet</td></tr>';
        return;
    }

    tbody.innerHTML = holdings.map(item => {
        const symbol = item.symbol || '';
        const qty = Number(item.quantity) || 0;
        const avg = Number(item.average_price) || 0;
        const ltpValue = item.ltp !== undefined ? Number(item.ltp) : priceMap[symbol];
        const pnlValue = item.pnl !== undefined ? Number(item.pnl) :
            (Number.isFinite(ltpValue) ? (ltpValue - avg) * qty : null);
        const ltpText = Number.isFinite(ltpValue) ? `₹${ltpValue.toFixed(2)}` : '--';
        const pnlClass = pnlValue > 0 ? 'positive' : pnlValue < 0 ? 'negative' : '';
        const pnlText = Number.isFinite(pnlValue) ? `₹${pnlValue.toFixed(2)}` : '--';
        return `
        <tr>
            <td><strong>${symbol}</strong></td>
            <td class="text-right">${qty}</td>
            <td class="text-right">₹${avg.toFixed(2)}</td>
            <td class="text-right">${ltpText}</td>
            <td class="text-right ${pnlClass}">${pnlText}</td>
        </tr>
    `;
    }).join('');
}

async function fetchWeeklyGainers(force = false) {
    if (!force && sectionLoaded.weekly) return;
    try {
        const container = document.getElementById('weekly-movers-container');
        if (container) container.innerHTML = '<div class="loading">Loading weekly data...</div>';
        revealSection('weekly');

        const response = await authFetch(`${API_BASE_URL}/nse_data/weekly-gainers?days=5`);
        const data = await response.json();
        renderWeeklyGainers(data);
        sectionLoaded.weekly = true;
    } catch (error) {
        console.error('Error fetching weekly gainers:', error);
        document.getElementById('weekly-movers-container').innerHTML = '<div class="loading">Error loading weekly data</div>';
    }
}

function renderWeeklyGainers(data) {
    const container = document.getElementById('weekly-movers-container');
    
    if (!data || !data.weeklyData || data.weeklyData.length === 0) {
        container.innerHTML = '<div class="loading">No weekly data available</div>';
        return;
    }

    container.innerHTML = data.weeklyData.map(day => `
        <div class="daily-column">
            <div class="daily-header">
                <h3>${day.dayName}</h3>
                <span>${day.date}</span>
            </div>
            <div class="daily-content">
                <span class="section-label gainers-label">Top Gainers</span>
                <table class="mini-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th class="text-right">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${day.topGainers.slice(0, 10).map(item => `
                            <tr>
                                <td>${item.symbol}</td>
                                <td class="text-right positive">+${item.pChange}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <span class="section-label losers-label">Top Losers</span>
                <table class="mini-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th class="text-right">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${day.topLosers.slice(0, 10).map(item => `
                            <tr>
                                <td>${item.symbol}</td>
                                <td class="text-right negative">${item.pChange}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `).join('');
}

// Modal functions
const NIFTY_100_LIST = [
    "ABB", "ACC", "ADANIENSOL", "ADANIENT", "ADANIGREEN", "ADANIPORTS",
    "ADANIPOWER", "ATGL", "AMBUJACEM", "APOLLOHOSP", "ASIANPAINT", "DMART",
    "AXISBANK", "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BAJAJHLDNG",
    "BALKRISIND", "BANDHANBNK", "BANKBARODA", "BANKINDIA", "BEL", "BERGEPAINT",
    "BHARATFORG", "BHARTIARTL", "BHEL", "BIOCON", "BOSCHLTD", "BPCL",
    "BRITANNIA", "CANBK", "CHOLAFIN", "CIPLA", "COALINDIA", "COFORGE",
    "COLPAL", "CONCOR", "DLF", "DABUR", "DIVISLAB", "DRREDDY", "EICHERMOT",
    "GAIL", "GICRE", "GODREJCP", "GODREJPROP", "GRASIM", "HCLTECH",
    "HDFCAMC", "HDFCBANK", "HDFCLIFE", "HAVELLS", "HEROMOTOCO", "HINDALCO",
    "HAL", "HINDUNILVR", "ICICIBANK", "ICICIGI", "ICICIPRULI", "ITC",
    "IOC", "IRCTC", "IRFC", "INDHOTEL", "INDUSINDBK", "INDUSTOWER", "INFY",
    "INDIGO", "JSWSTEEL", "JINDALSTEL", "JIOFIN", "KOTAKBANK", "LTIM", "LT",
    "LTTS", "LICI", "LUPIN", "M&M", "MARICO", "MARUTI", "MFSL", "MPHASIS",
    "MUTHOOTFIN", "NAUKRI", "NESTLEIND", "NTPC", "NHPC", "NMDC", "ONGC",
    "OIL", "PIIND", "PAGEIND", "PATANJALI", "PERSISTENT", "PETRONET", "PIDILITIND",
    "POONAWALLA", "PFC", "POWERGRID", "PRESTIGE", "PGHH", "PNB", "RECLTD",
    "RELIANCE", "SBICARD", "SBILIFE", "SRF", "MOTHERSON", "SHREECEM", "SHRIRAMFIN",
    "SIEMENS", "SOLARINDS", "SBIN", "SUNPHARMA", "SUZLON", "TVSMOTOR",
    "TATACHEM", "TATACOMM", "TCS", "TATACONSUM", "TATAELXSI", "TATAMOTORS",
    "TATAPOWER", "TATASTEEL", "TECHM", "TITAN", "TORNTPHARM", "TRENT",
    "TIINDIA", "ULTRACEMCO", "UNIONBANK", "UPL", "VBL", "VEDL", "WIPRO",
    "ZOMATO", "ZYDUSLIFE"
];

function toggleStockList() {
    const modal = document.getElementById('stock-list-modal');
    modal.classList.toggle('hidden');
    
    if (!modal.classList.contains('hidden')) {
        renderTrackedStockList();
    }
}

function renderTrackedStockList() {
    const container = document.getElementById('nifty-list-content');
    container.innerHTML = NIFTY_100_LIST.map(symbol => 
        `<div class="stock-tag">${symbol}</div>`
    ).join('');
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    if (!ensureAuthenticated()) return;
    setReleaseTag();
    setInitialPlaceholders();
    fetchProfile();
    attachStockListHandler();
    attachChartHandlers();
    attachStockTradeModalHandler();
});

function attachStockTradeModalHandler() {
    const modal = document.getElementById('stock-trade-modal');
    if (modal) {
        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeStockTradeModal();
            }
        });
    }
}

