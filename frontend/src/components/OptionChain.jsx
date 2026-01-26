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

const OptionChain = ({ symbol = 'NIFTY', onClose, onSelectToken }) => {
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
      // Use Fyers market data endpoint for option chain
      let url = `${window.location.origin}/fyers/market/option-chain/${sym}`;
      if (expiry) {
        url += `?expiry=${expiry}`;
      }
      const res = await authApi(url);

      // Check if Fyers is connected
      if (!res.fyers_connected) {
        console.log('[OptionChain] Fyers not connected');
        setChainData(null);
        return;
      }

      // Transform Fyers format to display format expected by component
      if (res.strikeData) {
        const transformedData = {
          underlyingValue: res.spotPrice || 0,
          pcr: res.pcr || 0,
          expiryDates: res.expiryDate ? [res.expiryDate] : [],
          currentExpiry: res.expiryDate,
          data: Object.entries(res.strikeData).map(([strike, data]) => ({
            strikePrice: parseFloat(strike),
            expiryDate: res.expiryDate,
            CE: data.call_oi ? {
              openInterest: data.call_oi || 0,
              totalTradedVolume: data.call_volume || 0,
              lastPrice: data.call_ltp || 0,
              change: data.call_change || 0,
              pChange: data.call_pChange || 0,
            } : null,
            PE: data.put_oi ? {
              openInterest: data.put_oi || 0,
              totalTradedVolume: data.put_volume || 0,
              lastPrice: data.put_ltp || 0,
              change: data.put_change || 0,
              pChange: data.put_pChange || 0,
            } : null,
          })).sort((a, b) => a.strikePrice - b.strikePrice)
        };
        setChainData(transformedData);
        if (!expiry && transformedData.expiryDates.length > 0) {
          setExpiryDates(transformedData.expiryDates);
          setSelectedExpiry(transformedData.currentExpiry);
        }
      } else {
        setChainData(res);
        if (!expiry && res.expiryDates && res.expiryDates.length > 0) {
          setExpiryDates(res.expiryDates);
          setSelectedExpiry(res.currentExpiry);
        }
      }
    } catch (err) {
      console.error("Failed to fetch option chain from Fyers", err);
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
                      {row.CE && onSelectToken && (
                        <div style={{display:'flex', gap:'2px', justifyContent:'center', marginTop:'2px', opacity: 0.8}}>
                           <button 
                             style={{fontSize:'10px', padding:'1px 4px', cursor:'pointer', background:'#00d09c', border:'none', borderRadius:'2px', color:'black'}} 
                             onClick={() => onSelectToken({...row.CE, symbol: selectedSymbol, expiry: row.expiryDate, strike: row.strikePrice, type: 'CE'})}
                           >B</button>
                           <button 
                             style={{fontSize:'10px', padding:'1px 4px', cursor:'pointer', background:'#ff4d4d', border:'none', borderRadius:'2px', color:'white'}} 
                             onClick={() => onSelectToken({...row.CE, symbol: selectedSymbol, expiry: row.expiryDate, strike: row.strikePrice, type: 'CE'})}
                           >S</button>
                        </div>
                      )}
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
                      {row.PE && onSelectToken && (
                        <div style={{display:'flex', gap:'2px', justifyContent:'center', marginTop:'2px', opacity: 0.8}}>
                           <button 
                             style={{fontSize:'10px', padding:'1px 4px', cursor:'pointer', background:'#00d09c', border:'none', borderRadius:'2px', color:'black'}} 
                             onClick={() => onSelectToken({...row.PE, symbol: selectedSymbol, expiry: row.expiryDate, strike: row.strikePrice, type: 'PE'})}
                           >B</button>
                           <button 
                             style={{fontSize:'10px', padding:'1px 4px', cursor:'pointer', background:'#ff4d4d', border:'none', borderRadius:'2px', color:'white'}} 
                             onClick={() => onSelectToken({...row.PE, symbol: selectedSymbol, expiry: row.expiryDate, strike: row.strikePrice, type: 'PE'})}
                           >S</button>
                        </div>
                      )}
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
