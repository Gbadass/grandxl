import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
export class RootErrorBoundary extends Component {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        // Log to console in dev; swap for Sentry when the driver app is wired to it
        console.error('[RootErrorBoundary]', error, info.componentStack);
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { className: "flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center", children: [_jsx("div", { className: "h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5", children: _jsx("svg", { className: "w-8 h-8 text-red-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" }) }) }), _jsx("h1", { className: "text-lg font-bold text-zinc-100", children: "App error" }), _jsx("p", { className: "mt-2 text-sm text-zinc-500 max-w-xs", children: "Something went wrong. Your active delivery is safe \u2014 tap reload to continue." }), _jsx("button", { className: "mt-6 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 cursor-pointer", onClick: () => window.location.reload(), style: { touchAction: 'manipulation' }, children: "Reload app" })] }));
        }
        return this.props.children;
    }
}
//# sourceMappingURL=RootErrorBoundary.js.map