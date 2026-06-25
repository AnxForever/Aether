import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/Toast';
import OfflineIndicator from './components/OfflineIndicator';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <OfflineIndicator />
        <App />
        <ToastContainer />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// Register service worker in production only
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => {
    // Service worker registered
  }).catch(() => {
    // Service worker registration failed
  });
}
