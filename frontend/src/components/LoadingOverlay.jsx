import React from 'react';
import { useLoading } from '../contexts/LoadingContext';

const LoadingOverlay = () => {
  const { isLoading, loadingMessage } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-backdrop" />
      <div className="loading-content">
        <div className="loading-spinner" />
        <p className="loading-message">{loadingMessage}</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
