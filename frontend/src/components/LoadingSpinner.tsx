import React from 'react';

interface Props {
  size?: 'sm' | 'md';
}

const LoadingSpinner: React.FC<Props> = ({ size = 'md' }) => (
  <div className={size === 'md' ? 'spinner-container' : ''}>
    <div className={`spinner ${size === 'sm' ? 'spinner-sm' : ''}`} />
  </div>
);

export default LoadingSpinner;
