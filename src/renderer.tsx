import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Declare the 'electronAPI' on the window object
declare global {
  interface Window {
    electronAPI: import('./preload').ElectronAPI;
  }
}

const container = document.getElementById('root');

// Fix: Add a null check for the container
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );
} else {
  console.error(
    "Failed to find the root element. The app can't be mounted."
  );
}
