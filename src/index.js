import React from 'react';
import ReactDOM from 'react-dom/client';
import PrintingPressSystem from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <PrintingPressSystem />
  </React.StrictMode>
);

// Register the service worker (installable app + fast start). Production builds only.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}
