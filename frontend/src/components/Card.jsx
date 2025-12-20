import React from 'react';

const Card = ({ title, actionLabel, onAction, isLoading, disabled = false, children }) => {
  return (
    <section className="card">
      <div className="card-header">
        <h2>{title}</h2>
        {onAction && (
          <button className="ghost" onClick={onAction} disabled={isLoading || disabled}>
            {isLoading ? 'Loading...' : actionLabel || 'Load'}
          </button>
        )}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
};

export default Card;
