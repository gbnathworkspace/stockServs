// Use dynamic API URL based on current origin for network access
const API_BASE_URL = window.location.origin;

let allStocks = [];
let displayedStocks = [];
let selectedStock = null;

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
}

async function fetchData() {
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = 'Loading...';

    try {
        await Promise.all([
            fetchAllStocks(),
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

// Virtual trading view
async function fetchAllStocks(forceSelect = false) {
    const listElement = document.getElementById('stock-list');
    if (listElement) {
        listElement.innerHTML = '<div class="loading">Loading stocks...</div>';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/nse_data/all-stocks`);
        const data = await response.json();
        allStocks = (data.stocks || []).filter(stock => stock && stock.symbol);
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
    renderSelectedStock(stock);
    renderAllStocksList(displayedStocks);
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
            <button class="trade-btn outline" onclick="simulateTrade('CHART')">Chart</button>
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

function simulateTrade(action) {
    const toast = document.getElementById('virtual-toast');
    if (!toast || !selectedStock) return;

    toast.textContent = `${action} ${selectedStock.symbol} in virtual mode`;
    toast.classList.remove('hidden');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hidden');
    }, 1600);
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
    fetchData();
    attachStockListHandler();
});
