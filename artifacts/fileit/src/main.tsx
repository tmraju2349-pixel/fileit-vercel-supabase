import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// Initialize theme immediately to prevent flash (guarded for restricted iframe storage)
try {
  const savedTheme = window.localStorage.getItem('theme');
  if (
    savedTheme === 'dark' ||
    (!savedTheme && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} catch {
  // Ignore storage access errors in sandboxed iframes
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
