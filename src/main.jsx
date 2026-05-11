import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

window.__APP_LOADED__ = true;
document.getElementById('boot-status')?.remove();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
