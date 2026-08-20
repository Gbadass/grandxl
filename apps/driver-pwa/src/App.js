import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './lib/queryClient';
import { AppRouter } from './router/AppRouter';
import { AuthInit } from './components/templates/AuthInit';
import { RootErrorBoundary } from './components/errors/RootErrorBoundary';
import './lib/axios'; // register axios instance with api-client
export function App() {
    return (_jsx(RootErrorBoundary, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(BrowserRouter, { children: _jsxs(AuthInit, { children: [_jsx(AppRouter, {}), _jsx(Toaster, { position: "top-center", toastOptions: {
                                style: {
                                    background: '#27272a',
                                    color: '#f4f4f5',
                                    borderRadius: '12px',
                                    fontSize: '14px',
                                },
                            } })] }) }) }) }));
}
//# sourceMappingURL=App.js.map