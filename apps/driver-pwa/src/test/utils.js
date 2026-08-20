import { jsx as _jsx } from "react/jsx-runtime";
import { render } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false },
        },
    });
}
function AllProviders({ children }) {
    const queryClient = createTestQueryClient();
    return (_jsx(QueryClientProvider, { client: queryClient, children: _jsx(MemoryRouter, { children: children }) }));
}
function customRender(ui, options) {
    return render(ui, { wrapper: AllProviders, ...options });
}
export * from '@testing-library/react';
export { customRender as render };
//# sourceMappingURL=utils.js.map