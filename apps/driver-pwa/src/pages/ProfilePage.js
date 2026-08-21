import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Star, Bike, LogOut, ChevronRight, Shield, Wallet, TrendingUp, HelpCircle, FileText, Info, Phone, } from 'lucide-react';
import toast from 'react-hot-toast';
import { ridersApi, authApi } from '@grandxl/api-client';
import { useAuthStore } from '../store/auth.store';
import { useRiderStore } from '../store/rider.store';
import { clearRiderToken } from '../lib/riderAuth';
import { VehicleType } from '@grandxl/types';
import { ROUTES } from '../router/routes';
import { formatMoney } from '@grandxl/utils';
const vehicleLabel = {
    [VehicleType.BICYCLE]: 'Bicycle',
    [VehicleType.MOTORCYCLE]: 'Motorcycle',
    [VehicleType.CAR]: 'Car',
};
const vehicleIcon = {
    [VehicleType.BICYCLE]: '🚲',
    [VehicleType.MOTORCYCLE]: '🏍️',
    [VehicleType.CAR]: '🚗',
};
const stagger = {
    hidden: { opacity: 0, y: 12 },
    visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.22 } }),
};
function SectionRow({ icon: Icon, iconColor, iconBg, label, value, onClick, danger = false, }) {
    return (_jsxs("button", { onClick: onClick, disabled: !onClick, className: `flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors cursor-pointer hover:bg-zinc-800/50 disabled:cursor-default disabled:hover:bg-transparent ${danger ? 'text-red-400' : 'text-zinc-300'}`, style: { touchAction: 'manipulation' }, children: [_jsx("div", { className: `h-8 w-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0`, children: _jsx(Icon, { size: 14, className: iconColor }) }), _jsx("span", { className: "flex-1 text-left", children: label }), value && _jsx("span", { className: "text-xs text-zinc-500 mr-1", children: value }), onClick && _jsx(ChevronRight, { size: 14, className: danger ? 'text-red-700' : 'text-zinc-600' })] }));
}
export default function ProfilePage() {
    const navigate = useNavigate();
    const { user, clearAuth } = useAuthStore();
    const { rider, setRider, setActiveOrder, clearPendingJobs } = useRiderStore();
    async function signOut() {
        // Clear all rider state first so no in-flight effects re-navigate to /delivery
        setActiveOrder(null);
        clearPendingJobs();
        setRider(null);
        clearAuth();
        clearRiderToken();
        // Fire-and-forget — invalidate the refresh token on the server
        void authApi.logout().catch(() => undefined);
        void navigate(ROUTES.LOGIN, { replace: true });
        toast.success('Signed out successfully');
    }
    // Always fetch fresh profile on mount so verified status / name are up to date
    const { data: freshProfile } = useQuery({
        queryKey: ['rider-profile'],
        queryFn: () => ridersApi.getProfile().then((r) => r.data.data),
        staleTime: 0,
        refetchOnMount: 'always',
    });
    useEffect(() => {
        if (freshProfile)
            setRider(freshProfile);
    }, [freshProfile, setRider]);
    const liveRider = freshProfile ?? rider;
    const initials = [user?.firstName?.charAt(0), user?.lastName?.charAt(0)].filter(Boolean).join('') || '?';
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Rider';
    return (_jsxs("div", { className: "min-h-full px-4 py-4 pb-8", children: [_jsxs(motion.div, { custom: 0, variants: stagger, initial: "hidden", animate: "visible", className: "mb-4 flex items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: `p-0.5 rounded-2xl ${liveRider?.isVerified ? 'bg-gradient-to-br from-green-400 to-green-600' : ''}`, children: _jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20", children: _jsx("span", { className: "font-display text-2xl font-bold text-primary", children: initials }) }) }), liveRider?.isVerified && (_jsx("div", { className: "absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-zinc-900 flex items-center justify-center", children: _jsx(Shield, { size: 10, className: "text-white" }) }))] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "font-display font-bold text-zinc-100 text-lg leading-tight truncate", children: fullName }), _jsx("p", { className: "text-sm text-zinc-500 mt-0.5", children: user?.phone }), liveRider?.isVerified ? (_jsxs("span", { className: "mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full", children: [_jsx(Shield, { size: 9 }), " Verified rider"] })) : liveRider ? (_jsx("span", { className: "mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full", children: "Pending verification" })) : null] })] }), liveRider && (_jsxs(motion.div, { custom: 1, variants: stagger, initial: "hidden", animate: "visible", className: "mb-4 grid grid-cols-3 gap-2.5", children: [_jsxs("div", { className: "rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center", children: [_jsx(Star, { size: 13, className: "text-yellow-400 mx-auto mb-1" }), _jsx("p", { className: "font-display text-xl font-bold text-zinc-100", children: liveRider.rating.toFixed(1) }), _jsx("p", { className: "text-[10px] text-zinc-600 mt-0.5", children: "Rating" })] }), _jsxs("div", { className: "rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center", children: [_jsx(Bike, { size: 13, className: "text-primary mx-auto mb-1" }), _jsx("p", { className: "font-display text-xl font-bold text-zinc-100", children: liveRider.totalDeliveries }), _jsx("p", { className: "text-[10px] text-zinc-600 mt-0.5", children: "Deliveries" })] }), _jsxs("div", { className: "rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center", children: [_jsx(Wallet, { size: 13, className: "text-green-400 mx-auto mb-1" }), _jsx("p", { className: "font-display text-sm font-bold text-zinc-100 truncate leading-tight", children: formatMoney(liveRider.earnings.totalKobo ?? 0, 'NGN') }), _jsx("p", { className: "text-[10px] text-zinc-600 mt-0.5", children: "Total earned" })] })] })), liveRider && (_jsxs(motion.div, { custom: 2, variants: stagger, initial: "hidden", animate: "visible", className: "mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden", children: [_jsx("div", { className: "flex items-center gap-2 px-4 py-3 border-b border-zinc-800", children: _jsx("p", { className: "text-[10px] font-semibold text-zinc-600 uppercase tracking-wider", children: "Vehicle" }) }), _jsxs("div", { className: "flex items-center gap-3 px-4 py-3.5", children: [_jsx("span", { className: "text-2xl", children: vehicleIcon[liveRider.vehicleType] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-zinc-200", children: vehicleLabel[liveRider.vehicleType] }), liveRider.vehiclePlate && (_jsx("p", { className: "text-xs font-mono text-zinc-500 tracking-widest mt-0.5", children: liveRider.vehiclePlate }))] })] })] })), _jsxs(motion.div, { custom: 3, variants: stagger, initial: "hidden", animate: "visible", className: "mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden", children: [_jsx("div", { className: "px-4 py-3 border-b border-zinc-800", children: _jsx("p", { className: "text-[10px] font-semibold text-zinc-600 uppercase tracking-wider", children: "Account" }) }), _jsxs("div", { className: "divide-y divide-zinc-800/60", children: [_jsx(SectionRow, { icon: Wallet, iconColor: "text-zinc-400", iconBg: "bg-zinc-800", label: "Payouts", onClick: () => void navigate(ROUTES.PAYOUTS) }), _jsx(SectionRow, { icon: TrendingUp, iconColor: "text-zinc-400", iconBg: "bg-zinc-800", label: "Earnings & metrics", onClick: () => void navigate(ROUTES.EARNINGS) })] })] }), _jsxs(motion.div, { custom: 4, variants: stagger, initial: "hidden", animate: "visible", className: "mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden", children: [_jsx("div", { className: "px-4 py-3 border-b border-zinc-800", children: _jsx("p", { className: "text-[10px] font-semibold text-zinc-600 uppercase tracking-wider", children: "Help & support" }) }), _jsxs("div", { className: "divide-y divide-zinc-800/60", children: [_jsx(SectionRow, { icon: Phone, iconColor: "text-blue-400", iconBg: "bg-blue-500/10", label: "Contact support", onClick: () => {
                                    window.open('tel:+234800GRANDXL', '_self');
                                } }), _jsx(SectionRow, { icon: HelpCircle, iconColor: "text-zinc-400", iconBg: "bg-zinc-800", label: "Help centre", onClick: () => toast('Help centre coming soon') }), _jsx(SectionRow, { icon: FileText, iconColor: "text-zinc-400", iconBg: "bg-zinc-800", label: "Terms & conditions", onClick: () => toast('Opening terms...') }), _jsx(SectionRow, { icon: Info, iconColor: "text-zinc-400", iconBg: "bg-zinc-800", label: "App version", value: "1.0.0" })] })] }), _jsxs(motion.button, { custom: 5, variants: stagger, initial: "hidden", animate: "visible", whileTap: { scale: 0.97 }, onClick: () => void signOut(), className: "flex w-full items-center justify-center gap-2 rounded-2xl border border-red-900/40 bg-red-950/20 py-4 text-sm font-semibold text-red-500 transition-colors hover:bg-red-950/40 cursor-pointer", style: { touchAction: 'manipulation', minHeight: '52px' }, children: [_jsx(LogOut, { size: 16 }), "Sign out"] })] }));
}
//# sourceMappingURL=ProfilePage.js.map