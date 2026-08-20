import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Bike, Clock, Target, ChevronRight, Package } from 'lucide-react';
import { ridersApi } from '@grandxl/api-client';
import { formatMoney } from '@grandxl/utils';
import { useRiderStore } from '../store/rider.store';
const stagger = {
    hidden: { opacity: 0, y: 14 },
    visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.22 } }),
};
function formatRelativeDate(date) {
    const d = new Date(date);
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0)
        return `Today · ${d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1)
        return 'Yesterday';
    if (diffDays < 7)
        return `${diffDays} days ago`;
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}
/** Builds a 7-bucket histogram (Mon–Sun of current week) from a list of completed orders */
function buildWeeklyBars(orders) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const buckets = new Array(7).fill(0);
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // shift so Mon=0
    orders.forEach((o) => {
        const d = new Date(o.updatedAt);
        const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 7) {
            const bucket = (dayOfWeek - diff + 7) % 7;
            buckets[bucket] += o.pricing.deliveryFee + (o.pricing.tip ?? 0);
        }
    });
    const max = Math.max(...buckets, 1);
    return days.map((label, i) => ({
        label,
        amount: buckets[i],
        height: buckets[i] / max,
        isToday: i === dayOfWeek,
    }));
}
function WeeklyBarChart({ orders }) {
    const bars = buildWeeklyBars(orders);
    const totalWeekKobo = bars.reduce((s, b) => s + b.amount, 0);
    return (_jsxs("div", { className: "rounded-2xl border border-zinc-800 bg-zinc-900 p-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("p", { className: "text-xs font-semibold text-zinc-500 uppercase tracking-wider", children: "This week" }), _jsx("p", { className: "text-sm font-bold text-zinc-100", children: formatMoney(totalWeekKobo, 'NGN') })] }), _jsx("p", { className: "text-[10px] text-zinc-600 mb-4", children: "Your earnings by day" }), _jsx("div", { className: "flex items-end gap-1.5 h-16", children: bars.map((bar, i) => (_jsxs("div", { className: "flex-1 flex flex-col items-center gap-1", children: [_jsx("div", { className: "w-full flex items-end justify-center", style: { height: '48px' }, children: _jsx(motion.div, { className: `w-full rounded-t-md ${bar.isToday ? 'bg-primary' : 'bg-zinc-700'}`, initial: { height: 0 }, animate: { height: `${Math.max(bar.height * 48, bar.amount > 0 ? 4 : 1)}px` }, transition: { duration: 0.6, delay: i * 0.06, ease: 'easeOut' } }) }), _jsx("p", { className: `text-[9px] font-medium ${bar.isToday ? 'text-primary' : 'text-zinc-600'}`, children: bar.label })] }, bar.label))) })] }));
}
export default function EarningsPage() {
    const { t } = useTranslation('rider');
    const navigate = useNavigate();
    const { rider, setRider } = useRiderStore();
    const [historyPage, setHistoryPage] = useState(1);
    const [allDeliveries, setAllDeliveries] = useState([]);
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
    const currency = 'NGN';
    const totalKobo = liveRider?.earnings.totalKobo ?? 0;
    const pendingKobo = liveRider?.earnings.pendingKobo ?? 0;
    const { data: metrics, isLoading: loadingMetrics } = useQuery({
        queryKey: ['rider-metrics'],
        queryFn: () => ridersApi.getMetrics(30).then((r) => r.data.data),
        staleTime: 1000 * 60 * 5,
    });
    const { data: historyData, isFetching: historyFetching } = useQuery({
        queryKey: ['rider-delivery-history', historyPage],
        queryFn: () => ridersApi.getDeliveryHistory({ page: historyPage, limit: 10 }).then((r) => r.data.data),
        staleTime: 1000 * 60 * 2,
    });
    useEffect(() => {
        if (!historyData)
            return;
        const incoming = historyData.data ?? [];
        setAllDeliveries((prev) => {
            const ids = new Set(prev.map((o) => o._id));
            return [...prev, ...incoming.filter((o) => !ids.has(o._id))];
        });
    }, [historyData]);
    return (_jsxs("div", { className: "min-h-full px-4 py-4 pb-8", children: [_jsx(motion.h1, { custom: 0, variants: stagger, initial: "hidden", animate: "visible", className: "mb-5 font-display text-lg font-bold text-zinc-100", children: t('earnings') }), _jsx(motion.div, { custom: 1, variants: stagger, initial: "hidden", animate: "visible", className: "mb-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5", children: _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-1", children: t('earnings_total') }), _jsx("p", { className: "font-display text-2xl font-bold text-zinc-100 tabular-nums", children: formatMoney(totalKobo, currency) }), _jsx("p", { className: "text-[10px] text-zinc-600 mt-0.5", children: "All-time settled" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-1", children: t('earnings_pending') }), _jsx("p", { className: "font-display text-2xl font-bold text-amber-400 tabular-nums", children: formatMoney(pendingKobo, currency) }), _jsx("p", { className: "text-[10px] text-zinc-600 mt-0.5", children: "Paid weekly" })] })] }) }), allDeliveries.length > 0 && (_jsx(motion.div, { custom: 2, variants: stagger, initial: "hidden", animate: "visible", className: "mb-4", children: _jsx(WeeklyBarChart, { orders: allDeliveries }) })), _jsxs(motion.div, { custom: 3, variants: stagger, initial: "hidden", animate: "visible", className: "mb-4", children: [_jsx("p", { className: "text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3", children: "Last 30 days" }), loadingMetrics ? (_jsx("div", { className: "grid grid-cols-2 gap-3", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "h-20 rounded-2xl bg-zinc-900 animate-pulse" }, i))) })) : (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3", children: [_jsx("div", { className: "h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0", children: _jsx(Bike, { size: 17, className: "text-primary" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-zinc-500", children: "Deliveries" }), _jsx("p", { className: "font-bold text-zinc-100 text-lg", children: metrics?.deliveriesCount ?? rider?.totalDeliveries ?? 0 })] })] }), _jsxs("div", { className: "rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3", children: [_jsx("div", { className: "h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0", children: _jsx(Clock, { size: 17, className: "text-secondary" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-zinc-500", children: "Avg time" }), _jsx("p", { className: "font-bold text-zinc-100 text-lg", children: metrics?.avgDeliveryMinutes ? `${Math.round(metrics.avgDeliveryMinutes)}m` : '—' })] })] }), _jsxs("div", { className: "rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3", children: [_jsx("div", { className: "h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0", children: _jsx(Target, { size: 17, className: "text-green-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-zinc-500", children: "On time" }), _jsx("p", { className: "font-bold text-zinc-100 text-lg", children: metrics ? `${Math.round(metrics.onTimeRate * 100)}%` : '—' })] })] }), _jsxs("div", { className: "rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3", children: [_jsx("div", { className: "h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0", children: _jsx(TrendingUp, { size: 17, className: "text-orange-400" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-zinc-500", children: "Cancel rate" }), _jsx("p", { className: "font-bold text-zinc-100 text-lg", children: metrics ? `${Math.round(metrics.cancellationRate * 100)}%` : '—' })] })] })] }))] }), _jsxs(motion.button, { custom: 4, variants: stagger, initial: "hidden", animate: "visible", whileTap: { scale: 0.97 }, onClick: () => void navigate('/payouts'), className: "w-full flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 cursor-pointer hover:border-zinc-700 transition-colors mb-4", style: { touchAction: 'manipulation' }, children: [_jsx("div", { className: "h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0", children: _jsx(TrendingUp, { size: 18, className: "text-primary" }) }), _jsxs("div", { className: "flex-1 text-left", children: [_jsx("p", { className: "text-sm font-medium text-zinc-200", children: "Request payout" }), _jsxs("p", { className: "text-xs text-zinc-500 mt-0.5", children: [formatMoney(liveRider?.earnings.pendingKobo ?? 0, 'NGN'), " pending \u00B7 Tap to request"] })] }), _jsx(ChevronRight, { size: 16, className: "text-zinc-600" })] }), _jsxs(motion.div, { custom: 5, variants: stagger, initial: "hidden", animate: "visible", children: [_jsx("p", { className: "text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3", children: "Delivery history" }), allDeliveries.length === 0 && !historyFetching ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-10 rounded-2xl border border-zinc-800 bg-zinc-900", children: [_jsx(Package, { size: 32, className: "text-zinc-700 mb-2" }), _jsx("p", { className: "text-sm text-zinc-500", children: "No deliveries yet" }), _jsx("p", { className: "text-xs text-zinc-600 mt-1", children: "Completed deliveries will appear here" })] })) : (_jsxs("div", { className: "space-y-2", children: [allDeliveries.map((order) => {
                                const earned = order.pricing.deliveryFee + (order.pricing.tip ?? 0);
                                const hasTip = (order.pricing.tip ?? 0) > 0;
                                const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
                                return (_jsxs("div", { className: "rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "h-7 w-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0", children: _jsx(Bike, { size: 13, className: "text-primary" }) }), _jsx("span", { className: "text-xs font-mono text-zinc-500", children: order.orderNumber })] }), _jsxs("div", { className: "text-right", children: [_jsxs("p", { className: "text-sm font-bold text-green-400", children: ["+", formatMoney(earned, order.currency)] }), hasTip && (_jsxs("p", { className: "text-[10px] text-secondary mt-0.5", children: ["incl. tip ", formatMoney(order.pricing.tip, order.currency)] }))] })] }), _jsxs("p", { className: "text-xs text-zinc-300 truncate mb-1", children: [order.deliveryAddress.street, ", ", order.deliveryAddress.city] }), _jsxs("div", { className: "flex items-center gap-2 text-[10px] text-zinc-600", children: [_jsx("span", { children: formatRelativeDate(order.updatedAt) }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: [itemCount, " ", itemCount === 1 ? 'item' : 'items'] })] })] }, order._id));
                            }), historyData && historyPage < historyData.meta.totalPages && (_jsx("button", { onClick: () => setHistoryPage((p) => p + 1), disabled: historyFetching, className: "w-full py-3 text-sm font-medium text-zinc-400 border border-zinc-800 rounded-2xl cursor-pointer hover:border-zinc-700 transition-colors disabled:opacity-50", children: historyFetching ? 'Loading…' : 'Load more' }))] }))] })] }));
}
//# sourceMappingURL=EarningsPage.js.map