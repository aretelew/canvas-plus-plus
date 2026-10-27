import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './style.css';

const container = document.body.appendChild(document.createElement('div'));

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
