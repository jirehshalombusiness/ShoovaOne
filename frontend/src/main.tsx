import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { NotificationProvider } from '@/lib/notifications';
import { AppRouter } from '@/app/router';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppRouter />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'var(--card)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 10px 30px rgb(0 0 0 / 0.12)',
                },
              }}
            />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);