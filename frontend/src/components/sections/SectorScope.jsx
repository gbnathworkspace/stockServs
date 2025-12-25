import React, { useState, useEffect } from 'react';
import { authApi } from '../../lib/api.js';

const API_BASE_URL = window.location.origin;

export default function SectorScope() {
  const [viewType, setViewType] = useState('heatmap');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [selectedSector, setSelectedSector] = useState(null);
  const [sectorStocks, setSectorStocks] = useState(null);
  const [loadingStocks, setLoadingStocks] = useState(false);

  const views = [
    { id: 'heatmap', label: 'Sector Heatmap' },
    { id: 'leaders', label: 'Leaders' },
    { id: 'laggards', label: 'Laggards' },
    { id: 'rotation', label: 'Rotation' }
  ];

  // Fetch heatmap data on component mount
  useEffect(() => {
    loadHeatmapData();
  }, []);

  // Fetch sector stocks when a sector is selected
  useEffect(() => {
    if (selectedSector) {
      loadSectorStocks(selectedSector);
    }
  }, [selectedSector]);

  const loadHeatmapData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authApi(`${API_BASE_URL}/sectors/heatmap`);
      setHeatmapData(data);
    } catch (err) {
      console.error('Failed to load sector data:', err);
      setError(err.message || 'Failed to load sector data');
    } finally {
      setLoading(false);
    }
  };

  const loadSectorStocks = async (sectorShort) => {
    setLoadingStocks(true);
    try {
      const data = await authApi(`${API_BASE_URL}/sectors/${sectorShort}/stocks`);
      setSectorStocks(data);
    } catch (err) {
      console.error('Failed to load sector stocks:', err);
      setSectorStocks(null);
    } finally {
      setLoadingStocks(false);
    }
  };

  // Get color class based on percentage change
  const getChangeColor = (change) => {
    if (change > 1.5) return 'strong-bullish';
    if (change > 0.5) return 'bullish';
    if (change > 0) return 'slight-bullish';
    if (change > -0.5) return 'slight-bearish';
    if (change > -1.5) return 'bearish';
    return 'strong-bearish';
  };

  // Get background color for heatmap cell
  const getHeatmapBg = (change) => {
    if (change > 2) return 'rgba(34, 197, 94, 0.4)';
    if (change > 1) return 'rgba(34, 197, 94, 0.25)';
    if (change > 0) return 'rgba(34, 197, 94, 0.1)';
    if (change > -1) return 'rgba(239, 68, 68, 0.1)';
    if (change > -2) return 'rgba(239, 68, 68, 0.25)';
    return 'rgba(239, 68, 68, 0.4)';
  };

  // Loading state
  if (loading) {
    return (
      <div className="product-section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-title-icon">&#128269;</span>
            <h2>Sector Scope</h2>
          </div>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading sector data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !heatmapData) {
    return (
      <div className="product-section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-title-icon">&#128269;</span>
            <h2>Sector Scope</h2>
          </div>
        </div>
        <div className="error-container">
          <div className="error-message">
            <span className="error-icon">&#9888;</span>
            <p>{error}</p>
            <button className="refresh-btn" onClick={loadHeatmapData}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const sectors = heatmapData?.sectors || [];
  const benchmark = heatmapData?.benchmark;
  const rotation = heatmapData?.rotation;
  const summary = heatmapData?.summary;

  // Filter sectors based on view
  const getFilteredSectors = () => {
    switch (viewType) {
      case 'leaders':
        return sectors.filter(s => s.percentChange > 0).slice(0, 8);
      case 'laggards':
        return [...sectors].sort((a, b) => a.percentChange - b.percentChange).slice(0, 8);
      default:
        return sectors;
    }
  };

  const filteredSectors = getFilteredSectors();

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">&#128269;</span>
          <h2>Sector Scope</h2>
        </div>
        <p className="section-subtitle">
          Sector performance analysis and rotation detection
        </p>
      </div>

      {/* Benchmark Card */}
      {benchmark && (
        <div className="card benchmark-card">
          <div className="benchmark-info">
            <span className="benchmark-label">Market Benchmark</span>
            <span className="benchmark-name">{benchmark.name}</span>
          </div>
          <div className="benchmark-value">
            <span className="benchmark-price">{benchmark.lastValue?.toLocaleString('en-IN')}</span>
            <span className={`benchmark-change ${benchmark.percentChange >= 0 ? 'positive' : 'negative'}`}>
              {benchmark.percentChange >= 0 ? '+' : ''}{benchmark.percentChange?.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* View Selector */}
      <div className="card">
        <div className="view-buttons">
          {views.map(view => (
            <button
              key={view.id}
              className={`view-btn ${viewType === view.id ? 'active' : ''}`}
              onClick={() => { setViewType(view.id); setSelectedSector(null); }}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      {summary && viewType === 'heatmap' && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card mini">
            <div className="stat-card-label">Total Sectors</div>
            <div className="stat-card-value">{summary.totalSectors}</div>
          </div>
          <div className="stat-card mini">
            <div className="stat-card-label">Advancing</div>
            <div className="stat-card-value positive">{summary.advancing}</div>
          </div>
          <div className="stat-card mini">
            <div className="stat-card-label">Declining</div>
            <div className="stat-card-value negative">{summary.declining}</div>
          </div>
          <div className="stat-card mini">
            <div className="stat-card-label">Breadth</div>
            <div className={`stat-card-value ${summary.breadth >= 50 ? 'positive' : 'negative'}`}>
              {summary.breadth}%
            </div>
          </div>
        </div>
      )}

      {/* Rotation Analysis */}
      {viewType === 'rotation' && rotation && (
        <div className="card rotation-card">
          <h3>Market Rotation Analysis</h3>
          <div className="rotation-phase">
            <span className="phase-label">Current Phase:</span>
            <span className={`phase-badge ${rotation.phase?.toLowerCase()}`}>
              {rotation.phase?.replace('_', ' ')}
            </span>
          </div>
          <p className="rotation-insight">{rotation.insight}</p>
          <div className="rotation-sectors">
            <div className="rotation-group">
              <span className="rotation-group-label">Leading Sectors:</span>
              <div className="rotation-tags">
                {rotation.leaders?.map(s => (
                  <span key={s} className="rotation-tag leader">{s}</span>
                ))}
              </div>
            </div>
            <div className="rotation-group">
              <span className="rotation-group-label">Lagging Sectors:</span>
              <div className="rotation-tags">
                {rotation.laggards?.map(s => (
                  <span key={s} className="rotation-tag laggard">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sector Heatmap Grid */}
      {viewType !== 'rotation' && (
        <div className="card">
          <h3>
            {viewType === 'heatmap' ? 'Sector Performance' :
             viewType === 'leaders' ? 'Top Performing Sectors' : 'Worst Performing Sectors'}
          </h3>
          <div className="sector-heatmap-grid">
            {filteredSectors.map((sector) => (
              <div
                key={sector.indexName}
                className={`sector-heatmap-cell ${selectedSector === sector.shortName ? 'selected' : ''}`}
                style={{ backgroundColor: getHeatmapBg(sector.percentChange) }}
                onClick={() => setSelectedSector(sector.shortName)}
              >
                <div className="sector-heatmap-name">{sector.name}</div>
                <div className={`sector-heatmap-change ${sector.percentChange >= 0 ? 'positive' : 'negative'}`}>
                  {sector.percentChange >= 0 ? '+' : ''}{sector.percentChange?.toFixed(2)}%
                </div>
                <div className="sector-heatmap-rs">
                  <span className="rs-label">RS:</span>
                  <span className={`rs-value ${sector.relativeStrength >= 0 ? 'positive' : 'negative'}`}>
                    {sector.relativeStrength >= 0 ? '+' : ''}{sector.relativeStrength}
                  </span>
                </div>
                <div className={`sector-position-badge ${sector.statusColor}`}>
                  {sector.position}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Sector Stocks */}
      {selectedSector && (
        <div className="card sector-stocks-card">
          <div className="sector-stocks-header">
            <h3>
              {sectorStocks?.sectorName || selectedSector} Stocks
              <span className="stock-count">({sectorStocks?.stockCount || 0} stocks)</span>
            </h3>
            <button
              className="close-btn"
              onClick={() => { setSelectedSector(null); setSectorStocks(null); }}
            >
              &times;
            </button>
          </div>

          {loadingStocks ? (
            <div className="loading-container" style={{ padding: '2rem' }}>
              <div className="loading-spinner"></div>
            </div>
          ) : sectorStocks?.stocks ? (
            <>
              <div className="sector-stocks-summary">
                <span className="advancing">&#9650; {sectorStocks.advancing} Advancing</span>
                <span className="declining">&#9660; {sectorStocks.declining} Declining</span>
              </div>
              <div className="sector-stocks-table">
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Price</th>
                      <th>Change</th>
                      <th>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectorStocks.stocks.slice(0, 15).map(stock => (
                      <tr key={stock.symbol}>
                        <td className="stock-symbol">{stock.symbol}</td>
                        <td>{stock.lastPrice?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                        <td className={stock.percentChange >= 0 ? 'positive' : 'negative'}>
                          {stock.percentChange >= 0 ? '+' : ''}{stock.percentChange?.toFixed(2)}%
                        </td>
                        <td>{(stock.volume / 100000).toFixed(2)}L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="no-data">No stocks data available</p>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
        <button className="refresh-btn" onClick={loadHeatmapData}>
          Refresh Data
        </button>
      </div>
    </div>
  );
}
