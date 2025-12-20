import React, { useState } from 'react';
import Card from './Card.jsx';

const TabCard = ({ title, tabs, disabled }) => {
  const [active, setActive] = useState(tabs[0]?.key);

  const current = tabs.find((t) => t.key === active);

  const onTabClick = (tab) => {
    setActive(tab.key);
    if (!tab.isLoaded) tab.onLoad();
  };

  return (
    <Card
      title={title}
      actionLabel={current?.isLoaded ? 'Refresh' : 'Load'}
      onAction={current?.onLoad}
      isLoading={current?.isLoading}
      disabled={disabled}
    >
      <div className="tabs-header">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${tab.key === active ? 'active' : ''}`}
            onClick={() => onTabClick(tab)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="text-right">Price</th>
              <th className="text-right">% Chg</th>
            </tr>
          </thead>
          <tbody>
            {!current?.rows?.length ? (
              <tr>
                <td colSpan="3" className="loading">
                  {current?.isLoaded ? 'No data' : 'Click load to fetch data'}
                </td>
              </tr>
            ) : (
              current.rows.slice(0, 10).map((item) => (
                <tr key={item.symbol}>
                  <td>{item.symbol}</td>
                  <td className="text-right">₹{Number(item.lastPrice).toFixed(2)}</td>
                  <td className={`text-right ${item.pChange >= 0 ? 'positive' : 'negative'}`}>
                    {item.pChange >= 0 ? '+' : ''}
                    {Number(item.pChange).toFixed(2)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default TabCard;
