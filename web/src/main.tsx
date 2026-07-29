import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AuthProvider } from './providers/auth-provider';
import { CartProvider } from './providers/cart-provider';
import { ThemeProvider } from './providers/theme-provider';
import './index.css';

// eslint-disable-next-line no-console
console.log('GLOBAL_ERROR_BOUNDARY_ADDED');

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('CLIENT_CRASH_CAUGHT DETAIL=ROOT_ELEMENT_MISSING');
}

createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
