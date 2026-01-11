import React, { useState, useEffect } from 'react';
import { authApi } from '../lib/api';
import '../watchlist.css'; 

// Basic styles for Option Chain - can be moved to CSS later
const styles = {
  container: { padding: '1rem', color: '#e1e3e6', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  controls: { display: 'flex', gap: '1rem', alignItems: 'center' },
  select: { padding: '0.5rem', borderRadius: '6px', background: '#2d333b', border: '1px solid #444c56', color: 'white' },
  tableContainer: { flex: 1, overflow: 'auto', border: '1px solid #444c56', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { position: 'sticky', top: 0, background: '#22272e', padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #444c56', zIndex: 10 },
  td: { padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #2d333b', color: '#adbac7' },
  strikeRow: { background: '#2d333b', fontWeight: 'bold' },
  callBg: { background: 'rgba(0, 208, 156, 0.05)' },
  putBg: { background: 'rgba(255, 77, 77, 0.05)' },
  atm: { background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)' },
};

const OptionChain = ({ symbol = 'NIFTY', onClose }) => {
  const [chainData, setChainData] = useState(null);
  const [expiryDates, setExpiryDates] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(symbol);

  // Common F&O Symbols
  const foSymbols = ["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE", "HDFCBANK", "INFY", "TCS"];

  const fetchOptionChain = async (sym, expiry = '') => {
    setLoading(true);
    try {
      let url = `${window.location.origin}/nse_data/fno/option-chain/${sym}`;
      if (expiry) {
        url += `?expiry=${expiry}`;
      }
      const res = await authApi(url);
      setChainData(res);
      if (!expiry && res.expiryDates && res.expiryDates.length > 0) {
        setExpiryDates(res.expiryDates);
        setSelectedExpiry(res.currentExpiry); // Auto-select nearest expiry
      }
    } catch (err) {
      console.error("Failed to fetch option chain", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptionChain(selectedSymbol, selectedExpiry);
  }, [selectedSymbol, selectedExpiry]);

  // Handle symbol change
  const handleSymbolChange = (e) => {
    setSelectedSymbol(e.target.value);
    setSelectedExpiry(''); // Reset expiry when symbol changes
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.controls}>
          <h2 style={{ margin: 0 }}>Option Chain</h2>
          <select style={styles.select} value={selectedSymbol} onChange={handleSymbolChange}>
            {foSymbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select 
            style={styles.select} 
            value={selectedExpiry} 
            onChange={(e) => setSelectedExpiry(e.target.value)}
            disabled={!expiryDates.length}
          >
            {expiryDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          {chainData && (
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
              Spot: <span style={{ color: '#00d09c' }}>{chainData.underlyingValue?.toFixed(2)}</span>
              <span style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#adbac7' }}>PCR: {chainData.pcr}</span>
            </span>
          )}
          {onClose && (
            <button 
              onClick={onClose}
              style={{ padding: '0.5rem 1rem', marginLeft: '1rem', background: '#373e47', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '2rem', color: '#adbac7' }}>Loading Option Chain...</div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th colSpan="4" style={{...styles.th, ...styles.callBg, color: '#00d09c'}}>CALLS</th>
                <th style={styles.th}>STRIKE</th>
                <th colSpan="4" style={{...styles.th, ...styles.putBg, color: '#ff4d4d'}}>PUTS</th>
              </tr>
              <tr>
                <th style={{...styles.th, top: '40px', fontSize: '0.75rem'}}>OI</th>
                <th style={{...styles.th, top: '40px', fontSize: '0.75rem'}}>Vol</th>
                <th style={{...styles.th, top: '40px', fontSize: '0.75rem'}}>LTP</th>
                <th style={{...styles.th, top: '40px', fontSize: '0.75rem'}}>Chg%</th>
                
                <th style={{...styles.th, top: '40px', fontSize: '0.75rem'}}>Price</th>
                
                <th style={{...styles.th, top: '40px', fontSize: '0.75rem'}}>Chg%</th>
                <th style={{...styles.th, top: '40px', fontSize: '0.75rem'}}>LTP</th>
                <th style={{...styles.th, top: '40px', fontSize: '0.75rem'}}>Vol</th>
                <th style={{...styles.th, top: '40px', fontSize: '0.75rem'}}>OI</th>
              </tr>
            </thead>
            <tbody>
              {chainData?.data?.map((row, idx) => {
                const isAtm = chainData.atmStrike === row.strikePrice; // Assuming ATM logic is passed or calculate roughly
                // Simple ATM Highlight: Closest to Spot
                const spot = chainData.underlyingValue;
                const dist = Math.abs(row.strikePrice - spot);
                // Highlight logic could be better, but this is a start
                
                return (
                  <tr key={idx}>
                    {/* CALLS */}
                    <td style={{...styles.td, ...styles.callBg}}>{row.CE?.openInterest?.toLocaleString() || '-'}</td>
                    <td style={{...styles.td, ...styles.callBg}}>{row.CE?.totalTradedVolume?.toLocaleString() || '-'}</td>
                    <td style={{...styles.td, ...styles.callBg, color: row.CE?.change >= 0 ? '#00d09c' : '#ff4d4d'}}>
                      {row.CE?.lastPrice?.toFixed(2) || '-'}
                    </td>
                    <td style={{...styles.td, ...styles.callBg, color: row.CE?.pChange >= 0 ? '#00d09c' : '#ff4d4d'}}>
                      {row.CE?.pChange?.toFixed(1)}%
                    </td>

                    {/* STRIKE */}
                    <td style={{...styles.td, ...styles.strikeRow}}>{row.strikePrice}</td>

                    {/* PUTS */}
                    <td style={{...styles.td, ...styles.putBg, color: row.PE?.pChange >= 0 ? '#00d09c' : '#ff4d4d'}}>
                      {row.PE?.pChange?.toFixed(1)}%
                    </td>
                    <td style={{...styles.td, ...styles.putBg, color: row.PE?.change >= 0 ? '#00d09c' : '#ff4d4d'}}>
                      {row.PE?.lastPrice?.toFixed(2) || '-'}
                    </td>
                    <td style={{...styles.td, ...styles.putBg}}>{row.PE?.totalTradedVolume?.toLocaleString() || '-'}</td>
                    <td style={{...styles.td, ...styles.putBg}}>{row.PE?.openInterest?.toLocaleString() || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OptionChain;
