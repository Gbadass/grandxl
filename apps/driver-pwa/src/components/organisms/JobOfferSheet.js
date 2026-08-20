import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useRiderStore } from '../../store/rider.store';
import { ridersApi } from '@grandxl/api-client';
import { formatMoney } from '@grandxl/utils';
const OFFER_SECONDS = 45;
function Sheet({ order, onDismiss }) {
    const navigate = useNavigate();
    const { setActiveOrder, removePendingJob } = useRiderStore();
    const [seconds, setSeconds] = useState(OFFER_SECONDS);
    const intervalRef = useRef(null);
    const dismiss = useCallback(() => {
        removePendingJob(order._id);
        onDismiss();
    }, [order._id, removePendingJob, onDismiss]);
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setSeconds((s) => (s <= 1 ? 0 : s - 1));
        }, 1000);
        return () => { if (intervalRef.current)
            clearInterval(intervalRef.current); };
    }, []);
    useEffect(() => {
        if (seconds === 0)
            dismiss();
    }, [seconds, dismiss]);
    const acceptMutation = useMutation({
        mutationFn: () => ridersApi.acceptJob(order._id),
        onSuccess: () => {
            if (intervalRef.current)
                clearInterval(intervalRef.current);
            setActiveOrder(order);
            removePendingJob(order._id);
            onDismiss();
            void navigate(`/delivery/${order._id}`, { replace: true });
        },
        onError: (err) => {
            const message = err instanceof Error ? err.message : '';
            if (message.includes('409') || message.includes('conflict')) {
                toast.error('Job was already taken by another rider.');
            }
            else {
                toast.error('Could not accept job — try again.');
            }
            dismiss();
        },
    });
    const progress = (seconds / OFFER_SECONDS) * 100;
    const pickup = order.restaurantPickupAddress;
    const dropoff = order.deliveryAddress;
    const payout = order.pricing.deliveryFee + (order.pricing.tip ?? 0);
    return (_jsxs("div", { className: "fixed inset-x-0 bottom-0 z-[9999] flex flex-col", children: [_jsx("div", { className: "fixed inset-0 bg-black/50", onClick: dismiss }), _jsxs("div", { className: "relative rounded-t-3xl bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-slide-in-up", children: [_jsx("div", { className: "flex justify-center pt-3 pb-1", children: _jsx("div", { className: "h-1 w-10 rounded-full bg-zinc-600" }) }), _jsx("div", { className: "mx-4 h-1 overflow-hidden rounded-full bg-zinc-700", children: _jsx("div", { className: "h-full rounded-full bg-primary transition-all duration-1000 ease-linear", style: { width: `${progress}%` } }) }), _jsxs("div", { className: "flex items-center justify-between px-5 pt-4 pb-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-lg font-bold text-white", children: "New Job Offer" }), _jsxs("p", { className: "text-sm text-zinc-400", children: ["#", order.orderNumber, " \u00B7 ", seconds, "s left"] })] }), _jsxs("div", { className: "rounded-xl bg-primary/15 px-3 py-1.5", children: [_jsx("p", { className: "text-base font-bold text-primary", children: formatMoney(payout, order.currency) }), _jsx("p", { className: "text-center text-[10px] text-primary/70", children: "Earn" })] })] }), _jsxs("div", { className: "mx-5 mb-4 overflow-hidden rounded-2xl bg-zinc-800", children: [_jsxs("div", { className: "flex items-start gap-3 px-4 py-3 border-b border-zinc-700", children: [_jsx("div", { className: "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/20", children: _jsx("div", { className: "h-2.5 w-2.5 rounded-full bg-orange-500" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-zinc-500", children: "Pickup" }), _jsx("p", { className: "truncate text-sm font-medium text-white", children: pickup ? `${pickup.street}, ${pickup.city}` : 'Restaurant address' })] })] }), _jsxs("div", { className: "flex items-start gap-3 px-4 py-3", children: [_jsx("div", { className: "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20", children: _jsx("div", { className: "h-2.5 w-2.5 rounded-full bg-green-500" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-zinc-500", children: "Drop-off" }), _jsxs("p", { className: "truncate text-sm font-medium text-white", children: [dropoff.street, ", ", dropoff.city] })] })] })] }), _jsxs("div", { className: "mx-5 mb-5", children: [_jsxs("p", { className: "text-xs text-zinc-500 mb-1.5", children: [order.items.length, " item", order.items.length !== 1 ? 's' : ''] }), _jsxs("div", { className: "flex flex-wrap gap-1.5", children: [order.items.slice(0, 4).map((item, i) => (_jsxs("span", { className: "rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300", children: [item.quantity, "\u00D7 ", item.name] }, i))), order.items.length > 4 && (_jsxs("span", { className: "rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400", children: ["+", order.items.length - 4, " more"] }))] })] }), _jsxs("div", { className: "flex gap-3 px-5 pb-8", children: [_jsx("button", { onClick: dismiss, disabled: acceptMutation.isPending, className: "flex-1 rounded-2xl border border-zinc-600 py-4 text-base font-bold text-zinc-300 transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50", children: "Decline" }), _jsx("button", { onClick: () => acceptMutation.mutate(), disabled: acceptMutation.isPending, className: "flex-[2] rounded-2xl bg-primary py-4 text-base font-bold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50", children: acceptMutation.isPending ? 'Accepting…' : 'Accept Job' })] })] })] }));
}
export function JobOfferSheet() {
    const { pendingJobs, removePendingJob } = useRiderStore();
    if (pendingJobs.length === 0)
        return null;
    const currentJob = pendingJobs[0];
    return (_jsx(Sheet, { order: currentJob, onDismiss: () => removePendingJob(currentJob._id) }, currentJob._id));
}
//# sourceMappingURL=JobOfferSheet.js.map