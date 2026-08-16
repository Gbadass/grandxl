import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from './lib/queryClient'
import { AppRouter } from './router/AppRouter'
import { AuthInit } from './components/templates/AuthInit'
import './lib/axios' // register axios instance with api-client

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthInit>
          <AppRouter />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#27272a',
                color: '#f4f4f5',
                borderRadius: '12px',
                fontSize: '14px',
              },
            }}
          />
        </AuthInit>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
