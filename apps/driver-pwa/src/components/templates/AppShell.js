import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import { TopBar } from '../organisms/TopBar';
import { BottomNav } from '../organisms/BottomNav';
import { OfflineBanner } from '../organisms/OfflineBanner';
import { JobOfferSheet } from '../organisms/JobOfferSheet';
export function AppShell() {
    return (_jsxs("div", { className: "flex min-h-screen flex-col bg-zinc-950", children: [_jsx(OfflineBanner, {}), _jsx(TopBar, {}), _jsx("main", { className: "flex-1 pt-14 pb-16 overflow-y-auto", children: _jsx(Outlet, {}) }), _jsx(BottomNav, {}), _jsx(JobOfferSheet, {})] }));
}
//# sourceMappingURL=AppShell.js.map