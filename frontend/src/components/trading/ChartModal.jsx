import React, { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { authApi } from '../../lib/api';

const CHART_RANGES = [
  { label: '5m', interval: '5m', period: '5d' },
  { label: '15m', interval: '15m', period: '1mo' },
  { label: '1D', interval: '1d', period: '6mo' },
];

export default function ChartModal({ 
  isOpen, 
  onClose, 
  stock,
  API_BASE_URL 
}) {
  const [range, setRange] = useState({ interval: '5m', period: '5d' });
  const [status, setStatus] = useState({ loading: false, error: '' });
  const [showIndicators, setShowIndicators] = useState({ sma: false, ema: false, rsi: false });
  
  const candleContainerRef = useRef(null);
  const volumeContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const chartRefs = useRef({
    chart: null,
    volumeChart: null,
    rsiChart: null,
    candleSeries: null,
    volumeSeries: null,
    smaSeries: null,
    emaSeries: null,
    rsiSeries: null,
  });

  // Handle body scroll locking
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setRange({ interval: '5m', period: '5d' }); // Reset range on close
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Load data when chart opens or range changes
  useEffect(() => {
    if (!isOpen || !stock) return;

    const ready = ensureCharts();
    if (ready) {
      loadChartData();
    }

    const intervalId = setInterval(() => {
      if (ready) loadChartData();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [isOpen, stock, range]);

  // Handle resizing
  useEffect(() => {
    if (!isOpen) return;
    
    const handleResize = () => resizeCharts();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearCharts();
  }, []);

  const clearCharts = () => {
    if (chartRefs.current.chart) chartRefs.current.chart.remove();
    if (chartRefs.current.volumeChart) chartRefs.current.volumeChart.remove();
    if (chartRefs.current.rsiChart) chartRefs.current.rsiChart.remove();
    
    chartRefs.current = {
      chart: null,
      volumeChart: null,
      rsiChart: null,
      candleSeries: null,
      volumeSeries: null,
      smaSeries: null,
      emaSeries: null,
      rsiSeries: null,
    };
  };

  const resizeCharts = () => {
    const { chart, volumeChart, rsiChart } = chartRefs.current;
    const candleContainer = candleContainerRef.current;
    const volumeContainer = volumeContainerRef.current;
    const rsiContainer = rsiContainerRef.current;
    
    if (chart && candleContainer) {
      chart.applyOptions({ width: candleContainer.clientWidth, height: candleContainer.clientHeight });
    }
    if (volumeChart && volumeContainer) {
      volumeChart.applyOptions({ width: volumeContainer.clientWidth, height: volumeContainer.clientHeight });
    }
    if (rsiChart && rsiContainer) {
      rsiChart.applyOptions({ width: rsiContainer.clientWidth, height: rsiContainer.clientHeight });
    }
  };

  const ensureCharts = () => {
    if (chartRefs.current.chart && chartRefs.current.volumeChart) {
      resizeCharts();
      return true;
    }
    
    const candleContainer = candleContainerRef.current;
    if (!candleContainer) return false;
    
    const volumeContainer = volumeContainerRef.current;
    const rsiContainer = rsiContainerRef.current;

    // Main Chart
    chartRefs.current.chart = createChart(candleContainer, {
      layout: { background: { color: '#181b21' }, textColor: '#e1e3e6', fontFamily: 'Inter, system-ui, sans-serif' },
      grid: { vertLines: { color: '#1f242d' }, horzLines: { color: '#1f242d' } },
      rightPriceScale: { borderColor: '#2d333b' },
      timeScale: { timeVisible: true, visible: true },
      crosshair: { mode: CrosshairMode.Normal },
    });

    chartRefs.current.candleSeries = chartRefs.current.chart.addCandlestickSeries({
      upColor: '#00d09c', downColor: '#ff4d4d', wickUpColor: '#00d09c', wickDownColor: '#ff4d4d', borderVisible: false,
    });

    chartRefs.current.smaSeries = chartRefs.current.chart.addLineSeries({ color: '#f5c542', lineWidth: 2, priceLineVisible: false });
    chartRefs.current.emaSeries = chartRefs.current.chart.addLineSeries({ color: '#4f9cf7', lineWidth: 2, priceLineVisible: false });

    // Volume Chart
    if (volumeContainer) {
      chartRefs.current.volumeChart = createChart(volumeContainer, {
        layout: { background: { color: '#181b21' }, textColor: '#e1e3e6', fontFamily: 'Inter, system-ui, sans-serif' },
        grid: { vertLines: { color: '#1f242d' }, horzLines: { color: '#1f242d' } },
        rightPriceScale: { borderColor: '#2d333b' },
        timeScale: { timeVisible: false, visible: false },
        crosshair: { mode: CrosshairMode.Normal },
      });

      chartRefs.current.volumeSeries = chartRefs.current.volumeChart.addHistogramSeries({
        priceFormat: { type: 'volume' }, color: '#26a69a', priceScaleId: '',
      });

      // Sync Time Scales
      chartRefs.current.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && chartRefs.current.volumeChart) {
          chartRefs.current.volumeChart.timeScale().setVisibleLogicalRange(range);
        }
        if (range && chartRefs.current.rsiChart) {
          chartRefs.current.rsiChart.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    // RSI Chart
    if (rsiContainer) {
      chartRefs.current.rsiChart = createChart(rsiContainer, {
        layout: { background: { color: '#181b21' }, textColor: '#e1e3e6', fontFamily: 'Inter, system-ui, sans-serif' },
        grid: { vertLines: { color: '#1f242d' }, horzLines: { color: '#1f242d' } },
        rightPriceScale: { borderColor: '#2d333b' },
        timeScale: { timeVisible: true, visible: true },
        crosshair: { mode: CrosshairMode.Normal },
      });

      chartRefs.current.rsiSeries = chartRefs.current.rsiChart.addLineSeries({ color: '#9b74ff', lineWidth: 2, priceLineVisible: false });
      
      chartRefs.current.rsiChart.priceScale('right').applyOptions({ minValue: 0, maxValue: 100 });
      chartRefs.current.rsiSeries.createPriceLine({ price: 70, color: '#4f9cf7', lineWidth: 1, lineStyle: LineStyle.Dashed });
      chartRefs.current.rsiSeries.createPriceLine({ price: 30, color: '#ff4d4d', lineWidth: 1, lineStyle: LineStyle.Dashed });
    }

    resizeCharts();
    return true;
  };

  const loadChartData = async () => {
    if (!stock) return;
    setStatus({ loading: true, error: '' });
    
    try {
      const url = `${API_BASE_URL}/market-data/candles?symbol=${encodeURIComponent(stock.symbol)}&interval=${range.interval}&period=${range.period}`;
      const data = await authApi(url);
      applyChartData(data);
      setStatus({ loading: false, error: '' });
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'Failed to load chart' });
    }
  };

  const applyChartData = (data) => {
    if (!data) return;
    const { candleSeries, volumeSeries, smaSeries, emaSeries, rsiSeries, chart, rsiChart } = chartRefs.current;
    
    if (candleSeries) candleSeries.setData(data.candles || []);
    if (volumeSeries) volumeSeries.setData(data.volume || []);
    
    if (smaSeries) smaSeries.setData(showIndicators.sma ? (data.indicators?.sma20 || []) : []);
    if (emaSeries) emaSeries.setData(showIndicators.ema ? (data.indicators?.ema20 || []) : []);
    if (rsiSeries) rsiSeries.setData(showIndicators.rsi ? (data.indicators?.rsi14 || []) : []);
    
    if (chart) chart.timeScale().fitContent();
    if (rsiChart) rsiChart.timeScale().fitContent();
  };

  const toggleIndicator = (key) => {
    setShowIndicators(prev => {
      const newState = { ...prev, [key]: !prev[key] };
      // Re-apply data to show/hide lines
      // In a real optimized world we would keep data in ref and just set it, but re-fetching is safer for now or we rely on the state update to trigger a re-fetch?
      // Actually, we should just invoke loadChartData again or store the last data.
      // For now, let's just trigger a reload to keep it simple, or better yet, just let the next auto-refresh handle it?
      // No, we should reload immediately.
      setTimeout(loadChartData, 0); 
      return newState;
    });
  };

  if (!isOpen || !stock) return null;

  return (
    <div className="stock-modal-overlay show">
      <div className="stock-modal-content chart-mode">
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="modal-header">
          <div>
            <h2>{stock.symbol}</h2>
            <span className="stock-price">₹{stock.lastPrice?.toFixed(2)}</span>
            <span className={`stock-change ${stock.pChange >= 0 ? 'positive' : 'negative'}`}>
              {stock.pChange >= 0 ? '+' : ''}{stock.pChange?.toFixed(2)}%
            </span>
          </div>
          
          <div className="chart-controls">
            <div className="chart-toggles">
              <button 
                className={`chart-toggle ${showIndicators.sma ? 'active' : ''}`}
                onClick={() => toggleIndicator('sma')}
              >SMA 20</button>
              <button 
                className={`chart-toggle ${showIndicators.ema ? 'active' : ''}`}
                onClick={() => toggleIndicator('ema')}
              >EMA 20</button>
              <button 
                className={`chart-toggle ${showIndicators.rsi ? 'active' : ''}`}
                onClick={() => toggleIndicator('rsi')}
              >RSI</button>
            </div>
            
            <div className="chart-ranges">
              {CHART_RANGES.map(r => (
                <button
                  key={r.label}
                  className={`range-btn ${range.label === r.label ? 'active' : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-container-wrapper">
          {status.loading && <div className="chart-loading">Loading Chart...</div>}
          {status.error && <div className="chart-error">{status.error}</div>}
          
          <div className="main-chart" ref={candleContainerRef}></div>
          <div className="volume-chart" ref={volumeContainerRef}></div>
          <div className="rsi-chart" ref={rsiContainerRef}></div>
        </div>
      </div>
    </div>
  );
}
