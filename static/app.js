// Use dynamic API URL based on current origin for network access
const API_BASE_URL = window.location.origin;

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
}

async function fetchData() {
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = 'Loading...';

    try {
        await Promise.all([
            fetchGainers(),
            fetchLosers(),
            fetchFIIDII(),
            fetchMostActive(),
            fetch52WeekHigh(),
            fetchBulkDeals(),
            fetchWeeklyGainers()
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

async function fetchGainers() {
    try {
        const response = await fetch(`${API_BASE_URL}/nse_data/top-gainers`);
        const data = await response.json();
        renderTable('gainers-table', data.top_gainers, true);
    } catch (error) {
        console.error('Error fetching gainers:', error);
        document.querySelector('#gainers-table tbody').innerHTML = '<tr><td colspan="3" class="loading">Error loading data</td></tr>';
    }
}

async function fetchLosers() {
    try {
        const response = await fetch(`${API_BASE_URL}/nse_data/top-losers`);
        const data = await response.json();
        renderTable('losers-table', data.top_losers, false);
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

async function fetchFIIDII() {
    try {
        const response = await fetch(`${API_BASE_URL}/nse_data/fii-dii-activity`);
        const data = await response.json();
        renderFIIDII(data);
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


function updateTimestamp() {
    const now = new Date();
    document.getElementById('last-updated').textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

async function fetchMostActive() {
    try {
        const response = await fetch(`${API_BASE_URL}/nse_data/most-active-volume`);
        const data = await response.json();
        renderMostActive(data.most_active);
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

async function fetch52WeekHigh() {
    try {
        const response = await fetch(`${API_BASE_URL}/nse_data/52-week-high`);
        const data = await response.json();
        render52WeekHigh(data.stocks);
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

async function fetchBulkDeals() {
    try {
        const response = await fetch(`${API_BASE_URL}/nse_data/bulk-deals`);
        const data = await response.json();
        renderBulkDeals(data.bulk_deals, data.date);
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

// Initial load
document.addEventListener('DOMContentLoaded', fetchData);


async function fetchWeeklyGainers() {
    try {
        const response = await fetch(`${API_BASE_URL}/nse_data/weekly-gainers?days=5`);
        const data = await response.json();
        renderWeeklyGainers(data);
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
        renderStockList();
    }
}

function renderStockList() {
    const container = document.getElementById('nifty-list-content');
    container.innerHTML = NIFTY_100_LIST.map(symbol => 
        `<div class="stock-tag">${symbol}</div>`
    ).join('');
}
