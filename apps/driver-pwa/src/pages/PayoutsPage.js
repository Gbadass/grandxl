import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Building2, Pencil, X, CheckCircle2, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { riderPayoutsApi } from '@grandxl/api-client';
import { formatMoney } from '@grandxl/utils';
import { useRiderStore } from '../store/rider.store';
// ─── Animation variants ──────────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.07, duration: 0.22 },
    }),
};
const sheetVariants = {
    hidden: { y: '100%' },
    visible: { y: 0, transition: { type: 'spring', damping: 28, stiffness: 280 } },
    exit: { y: '100%', transition: { duration: 0.22, ease: 'easeIn' } },
};
// ─── Status pill ─────────────────────────────────────────────────────────────
const STATUS_STYLES = {
    pending: 'bg-yellow-500/15 text-yellow-400',
    approved: 'bg-blue-500/15 text-blue-400',
    paid: 'bg-green-500/15 text-green-400',
    rejected: 'bg-red-500/15 text-red-400',
};
function StatusPill({ status }) {
    return (_jsx("span", { className: `rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`, children: status.charAt(0).toUpperCase() + status.slice(1) }));
}
function BankAccountForm({ initial, onSaved, onCancel }) {
    const queryClient = useQueryClient();
    // Step 1 — bank selection
    const [selectedBank, setSelectedBank] = useState(initial?.bankCode ? { id: 0, name: initial.bankName ?? '', code: initial.bankCode } : null);
    const [bankSearch, setBankSearch] = useState(initial?.bankName ?? '');
    const [showBankList, setShowBankList] = useState(false);
    const bankInputRef = useRef(null);
    // Step 2 — account number
    const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? '');
    // Step 3 — resolved account name from Paystack
    const [resolvedName, setResolvedName] = useState(initial?.accountName ?? null);
    const [resolving, setResolving] = useState(false);
    const [resolveError, setResolveError] = useState(null);
    // Step 4 — save
    const [saving, setSaving] = useState(false);
    // Banks list from our backend (which proxies Paystack)
    const { data: banks = [] } = useQuery({
        queryKey: ['nigerian-banks'],
        queryFn: () => riderPayoutsApi.getBanks().then((r) => r.data.data),
        staleTime: 1000 * 60 * 60, // 1 hour — bank list rarely changes
    });
    const filteredBanks = banks.filter((b) => b.name.toLowerCase().includes(bankSearch.toLowerCase()));
    // Auto-resolve when bank + 10-digit account number are both set
    useEffect(() => {
        if (!selectedBank || accountNumber.length !== 10) {
            setResolvedName(null);
            setResolveError(null);
            return;
        }
        let cancelled = false;
        setResolving(true);
        setResolveError(null);
        setResolvedName(null);
        riderPayoutsApi
            .verifyAccount(accountNumber, selectedBank.code)
            .then((r) => {
            if (!cancelled)
                setResolvedName(r.data.data.accountName);
        })
            .catch(() => {
            if (!cancelled)
                setResolveError('Account not found — check the number and bank');
        })
            .finally(() => {
            if (!cancelled)
                setResolving(false);
        });
        return () => { cancelled = true; };
    }, [selectedBank, accountNumber]);
    const canSave = selectedBank !== null && accountNumber.length === 10 && resolvedName !== null;
    async function handleSave() {
        if (!canSave || saving || !selectedBank || !resolvedName)
            return;
        setSaving(true);
        try {
            await riderPayoutsApi.updateBankAccount({
                bankName: selectedBank.name,
                accountNumber,
                accountName: resolvedName,
                bankCode: selectedBank.code,
            });
            await queryClient.invalidateQueries({ queryKey: ['rider-bank-account'] });
            toast.success('Bank account saved');
            onSaved();
        }
        catch {
            toast.error('Failed to save bank account');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-xs font-medium text-zinc-400", children: "Bank" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "pointer-events-none absolute inset-y-0 left-3.5 flex items-center", children: _jsx(Search, { size: 14, className: "text-zinc-500" }) }), _jsx("input", { ref: bankInputRef, type: "text", value: bankSearch, onChange: (e) => {
                                    setBankSearch(e.target.value);
                                    setSelectedBank(null);
                                    setShowBankList(true);
                                }, onFocus: () => setShowBankList(true), placeholder: "Search for your bank\u2026", className: "w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-9 pr-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-primary", style: { minHeight: '48px' } }), selectedBank && (_jsx("div", { className: "pointer-events-none absolute inset-y-0 right-3.5 flex items-center", children: _jsx(CheckCircle2, { size: 16, className: "text-green-400" }) }))] }), _jsx(AnimatePresence, { children: showBankList && filteredBanks.length > 0 && (_jsx(motion.div, { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.15 }, className: "z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-800 shadow-xl", children: filteredBanks.slice(0, 20).map((bank) => (_jsx("button", { type: "button", onClick: () => {
                                    setSelectedBank(bank);
                                    setBankSearch(bank.name);
                                    setShowBankList(false);
                                    setAccountNumber('');
                                    setResolvedName(null);
                                }, className: "w-full cursor-pointer px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 transition-colors", style: { touchAction: 'manipulation' }, children: bank.name }, bank.id))) })) })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-xs font-medium text-zinc-400", children: "Account Number" }), _jsx("input", { type: "text", inputMode: "numeric", value: accountNumber, onChange: (e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setAccountNumber(val);
                        }, placeholder: "10-digit account number", disabled: !selectedBank, className: "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-primary disabled:opacity-40", style: { minHeight: '48px' } }), accountNumber.length > 0 && accountNumber.length < 10 && (_jsxs("p", { className: "mt-1 text-[11px] text-zinc-500", children: [10 - accountNumber.length, " more digits"] }))] }), _jsxs(AnimatePresence, { mode: "wait", children: [resolving && (_jsxs(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3", children: [_jsx(Loader2, { size: 15, className: "animate-spin text-zinc-500" }), _jsx("span", { className: "text-sm text-zinc-400", children: "Verifying account\u2026" })] }, "resolving")), resolvedName && !resolving && (_jsxs(motion.div, { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0 }, className: "flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3", children: [_jsx(CheckCircle2, { size: 18, className: "shrink-0 text-green-400" }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-green-500", children: "Account verified" }), _jsx("p", { className: "font-semibold text-sm text-green-300", children: resolvedName })] })] }, "resolved")), resolveError && !resolving && (_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, className: "rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400", children: resolveError }, "error"))] }), _jsxs("div", { className: "flex gap-2.5 pt-1", children: [onCancel && (_jsx("button", { onClick: onCancel, className: "flex-1 cursor-pointer rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-400 transition-colors hover:border-zinc-600", style: { touchAction: 'manipulation', minHeight: '48px' }, children: "Cancel" })), _jsx("button", { onClick: () => void handleSave(), disabled: !canSave || saving, className: "flex-1 cursor-pointer rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity", style: { touchAction: 'manipulation', minHeight: '48px' }, children: saving ? 'Saving…' : 'Confirm account' })] })] }));
}
// ─── Payout history row ──────────────────────────────────────────────────────
function PayoutRow({ item }) {
    const date = new Date(item.createdAt).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    return (_jsxs("div", { className: "flex items-center justify-between py-3.5 border-b border-zinc-800/60 last:border-0", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-zinc-100", children: formatMoney(item.amountKobo, 'NGN') }), _jsx("p", { className: "mt-0.5 text-xs text-zinc-500", children: date })] }), _jsx(StatusPill, { status: item.status })] }));
}
// ─── Main page ───────────────────────────────────────────────────────────────
export default function PayoutsPage() {
    const { t } = useTranslation('rider');
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { rider, setRider } = useRiderStore();
    const pendingKobo = rider?.earnings.pendingKobo ?? 0;
    // Bank account query
    const { data: bankAccount, isLoading: loadingBank, } = useQuery({
        queryKey: ['rider-bank-account'],
        queryFn: () => riderPayoutsApi.getBankAccount().then((r) => r.data.data),
        staleTime: 1000 * 60 * 5,
    });
    // Payout history query
    const [historyPage, setHistoryPage] = useState(1);
    const { data: historyData, isLoading: loadingHistory, isFetching: fetchingMore, } = useQuery({
        queryKey: ['rider-payouts', historyPage],
        queryFn: () => riderPayoutsApi.list({ page: historyPage, limit: 10 }).then((r) => r.data.data),
        staleTime: 1000 * 60,
    });
    // Accumulated rows across pages
    const [allItems, setAllItems] = useState([]);
    const [loadedPages, setLoadedPages] = useState([]);
    // Merge incoming page into allItems (avoid dupes)
    if (historyData?.items &&
        !loadedPages.includes(historyData.page)) {
        setLoadedPages((prev) => [...prev, historyData.page]);
        setAllItems((prev) => {
            const existingIds = new Set(prev.map((i) => i._id));
            const fresh = historyData.items.filter((i) => !existingIds.has(i._id));
            return [...prev, ...fresh];
        });
    }
    const hasMore = historyData ? historyPage < historyData.pages : false;
    // UI state
    const [editingBank, setEditingBank] = useState(false);
    const [showConfirmSheet, setShowConfirmSheet] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const hasBankAccount = bankAccount !== null &&
        bankAccount !== undefined &&
        bankAccount.bankName !== null &&
        bankAccount.accountNumber !== null &&
        bankAccount.accountName !== null;
    const canRequestPayout = pendingKobo > 0 && hasBankAccount;
    // Mask account number: show only last 4 digits
    function maskAccount(num) {
        if (!num)
            return '****';
        return `****${num.slice(-4)}`;
    }
    async function confirmPayout() {
        if (requesting)
            return;
        setRequesting(true);
        try {
            await riderPayoutsApi.request(pendingKobo);
            // Invalidate profile so pendingKobo resets
            await queryClient.invalidateQueries({ queryKey: ['rider-profile'] });
            await queryClient.invalidateQueries({ queryKey: ['rider-payouts'] });
            // Optimistically zero out store
            if (rider) {
                setRider({ ...rider, earnings: { ...rider.earnings, pendingKobo: 0 } });
            }
            // Reset history accumulator
            setAllItems([]);
            setLoadedPages([]);
            setHistoryPage(1);
            toast.success('Payout request submitted!');
            setShowConfirmSheet(false);
        }
        catch {
            toast.error('Failed to submit payout request');
        }
        finally {
            setRequesting(false);
        }
    }
    return (_jsxs("div", { className: "relative min-h-full bg-zinc-950 px-4 py-4 pb-10", children: [_jsxs("button", { onClick: () => void navigate(-1), className: "mb-6 flex cursor-pointer items-center gap-1 text-sm text-zinc-400", style: { touchAction: 'manipulation', minHeight: '40px' }, children: [_jsx(ChevronLeft, { size: 18 }), t('common:back')] }), _jsx("h1", { className: "mb-6 font-display text-lg font-bold text-zinc-100", children: t('payouts') }), _jsxs(motion.div, { custom: 0, variants: fadeUp, initial: "hidden", animate: "visible", className: "mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center", children: [_jsx("p", { className: "mb-1 text-sm text-zinc-400", children: t('earnings_pending') }), _jsx("p", { className: "mb-1 font-display text-3xl font-bold text-primary", children: formatMoney(pendingKobo, 'NGN') }), _jsx("p", { className: "mb-5 text-xs text-zinc-600", children: "Available for payout" }), !loadingBank && !hasBankAccount ? (_jsx("p", { className: "rounded-xl bg-yellow-500/10 px-4 py-2.5 text-xs font-medium text-yellow-400", children: "Set up a bank account below before requesting a payout" })) : (_jsx("button", { onClick: () => setShowConfirmSheet(true), disabled: !canRequestPayout, className: "w-full cursor-pointer rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-40 transition-opacity", style: { touchAction: 'manipulation', minHeight: '48px' }, children: t('request_payout') }))] }), _jsxs(motion.div, { custom: 1, variants: fadeUp, initial: "hidden", animate: "visible", className: "mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Building2, { size: 16, className: "text-zinc-500" }), _jsx("p", { className: "text-sm font-semibold text-zinc-300", children: "Bank account" })] }), hasBankAccount && !editingBank && (_jsxs("button", { onClick: () => setEditingBank(true), className: "flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors", style: { touchAction: 'manipulation', minHeight: '36px' }, children: [_jsx(Pencil, { size: 13 }), "Edit"] })), editingBank && (_jsxs("button", { onClick: () => setEditingBank(false), className: "flex cursor-pointer items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors", style: { touchAction: 'manipulation', minHeight: '36px' }, children: [_jsx(X, { size: 14 }), "Close"] }))] }), loadingBank ? (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "h-5 w-2/3 animate-pulse rounded-lg bg-zinc-800" }), _jsx("div", { className: "h-4 w-1/2 animate-pulse rounded-lg bg-zinc-800" })] })) : hasBankAccount && !editingBank ? (_jsxs("div", { className: "space-y-2.5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-zinc-500", children: "Bank" }), _jsx("span", { className: "text-sm font-medium text-zinc-200", children: bankAccount.bankName })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-zinc-500", children: "Account no." }), _jsx("span", { className: "font-mono text-sm font-semibold tracking-widest text-zinc-200", children: maskAccount(bankAccount.accountNumber) })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-zinc-500", children: "Account name" }), _jsx("span", { className: "text-sm font-medium text-zinc-200", children: bankAccount.accountName })] })] })) : editingBank ? (_jsx(BankAccountForm, { initial: bankAccount ?? null, onSaved: () => setEditingBank(false), onCancel: () => setEditingBank(false) })) : (
                    /* No bank account yet */
                    _jsxs("div", { children: [_jsx("p", { className: "mb-4 text-sm text-zinc-500", children: "Add your bank account to receive payouts directly." }), _jsx(BankAccountForm, { initial: null, onSaved: () => { } })] }))] }), _jsxs(motion.div, { custom: 2, variants: fadeUp, initial: "hidden", animate: "visible", className: "rounded-2xl border border-zinc-800 bg-zinc-900 p-5", children: [_jsx("p", { className: "mb-3 text-sm font-semibold text-zinc-300", children: t('payout_history') }), loadingHistory && allItems.length === 0 ? (_jsx("div", { className: "space-y-3 py-2", children: Array.from({ length: 3 }).map((_, i) => (_jsxs("div", { className: "flex items-center justify-between py-1", children: [_jsxs("div", { className: "space-y-1.5", children: [_jsx("div", { className: "h-4 w-24 animate-pulse rounded bg-zinc-800" }), _jsx("div", { className: "h-3 w-16 animate-pulse rounded bg-zinc-800" })] }), _jsx("div", { className: "h-5 w-16 animate-pulse rounded-full bg-zinc-800" })] }, i))) })) : allItems.length === 0 ? (_jsx("p", { className: "py-6 text-center text-sm text-zinc-600", children: "No payout requests yet" })) : (_jsxs(_Fragment, { children: [_jsx("div", { children: allItems.map((item) => (_jsx(PayoutRow, { item: item }, item._id))) }), hasMore && (_jsx("button", { onClick: () => setHistoryPage((p) => p + 1), disabled: fetchingMore, className: "mt-4 w-full cursor-pointer rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-50", style: { touchAction: 'manipulation', minHeight: '44px' }, children: fetchingMore ? 'Loading…' : 'Load more' }))] }))] }), _jsx(AnimatePresence, { children: showConfirmSheet && (_jsxs(_Fragment, { children: [_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, onClick: () => setShowConfirmSheet(false), className: "fixed inset-0 z-40 bg-black/60" }, "backdrop"), _jsxs(motion.div, { variants: sheetVariants, initial: "hidden", animate: "visible", exit: "exit", className: "fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-zinc-900 px-5 pb-10 pt-5", children: [_jsx("div", { className: "mx-auto mb-5 h-1 w-10 rounded-full bg-zinc-700" }), _jsxs("div", { className: "mb-1 flex items-center justify-between", children: [_jsx("p", { className: "font-display text-base font-bold text-zinc-100", children: "Confirm payout request" }), _jsx("button", { onClick: () => setShowConfirmSheet(false), className: "cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors", style: { touchAction: 'manipulation' }, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: "my-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center", children: [_jsx("p", { className: "mb-1 text-xs text-zinc-500", children: "Amount to request" }), _jsx("p", { className: "font-display text-3xl font-bold text-primary", children: formatMoney(pendingKobo, 'NGN') })] }), hasBankAccount && (_jsxs("div", { className: "mb-5 flex items-center gap-3 rounded-xl bg-zinc-800/60 px-4 py-3", children: [_jsx(CheckCircle2, { size: 16, className: "shrink-0 text-green-400" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-medium text-zinc-200", children: bankAccount.bankName }), _jsxs("p", { className: "text-xs text-zinc-500", children: [maskAccount(bankAccount.accountNumber), " \u00B7 ", bankAccount.accountName] })] })] })), _jsx("p", { className: "mb-5 text-center text-xs text-zinc-500", children: "Payouts are processed within 2 business days" }), _jsx("button", { onClick: () => void confirmPayout(), disabled: requesting, className: "w-full cursor-pointer rounded-xl bg-primary py-3.5 text-sm font-semibold text-white disabled:opacity-50 transition-opacity", style: { touchAction: 'manipulation', minHeight: '52px' }, children: requesting ? 'Submitting…' : 'Confirm payout request' })] }, "sheet")] })) })] }));
}
//# sourceMappingURL=PayoutsPage.js.map