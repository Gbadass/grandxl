import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Car, Camera, CheckCircle2, Upload, AlertCircle, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadsApi, ridersApi } from '@grandxl/api-client';
import { useRiderStore } from '../store/rider.store';
import { ROUTES } from '../router/routes';
const DOC_SLOTS = [
    {
        key: 'idCard',
        label: 'Government ID',
        sub: "National ID, International Passport, or Voter's Card",
        Icon: CreditCard,
        accept: 'image/*',
    },
    {
        key: 'driverLicense',
        label: "Driver's License",
        sub: 'Must be current and not expired',
        Icon: Car,
        accept: 'image/*',
    },
    {
        key: 'vehiclePhoto',
        label: 'Vehicle Photo',
        sub: 'Clear photo showing the plate number',
        Icon: Camera,
        accept: 'image/*',
    },
];
const initSlot = () => ({ url: null, preview: null, uploading: false, error: null });
export default function KycUploadPage() {
    const navigate = useNavigate();
    const { setRider } = useRiderStore();
    const [uploads, setUploads] = useState({
        idCard: initSlot(),
        driverLicense: initSlot(),
        vehiclePhoto: initSlot(),
    });
    const [submitting, setSubmitting] = useState(false);
    const inputRefs = useRef({});
    function setSlot(key, patch) {
        setUploads((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    }
    async function handleFileChange(key, file) {
        const preview = URL.createObjectURL(file);
        setSlot(key, { preview, uploading: true, error: null, url: null });
        try {
            const res = await uploadsApi.uploadRiderDocument(file);
            setSlot(key, { url: res.data.data.url, uploading: false });
        }
        catch {
            setSlot(key, { uploading: false, error: 'Upload failed. Tap to retry.' });
        }
    }
    const allUploaded = DOC_SLOTS.every((s) => uploads[s.key].url !== null);
    async function handleSubmit() {
        if (!allUploaded || submitting)
            return;
        setSubmitting(true);
        try {
            const res = await ridersApi.updateDocuments({
                idCard: uploads.idCard.url,
                driverLicense: uploads.driverLicense.url,
                vehiclePhoto: uploads.vehiclePhoto.url,
            });
            setRider(res.data.data);
            toast.success("Documents submitted! We'll review within 24 hours.");
            void navigate(ROUTES.PENDING_VERIFICATION, { replace: true });
        }
        catch {
            toast.error('Could not submit documents. Please try again.');
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsxs("div", { className: "flex min-h-screen flex-col bg-zinc-950 px-5 pt-14 pb-10", children: [_jsxs(motion.div, { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, className: "mb-8", children: [_jsx("div", { className: "mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15", children: _jsx(Upload, { size: 24, className: "text-primary" }) }), _jsx("h1", { className: "font-display text-2xl font-bold text-zinc-100 leading-tight", children: "Upload documents" }), _jsx("p", { className: "mt-1.5 text-sm text-zinc-500", children: "We need to verify your identity before you can start delivering" })] }), _jsxs(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.05 }, className: "mb-6 flex items-center gap-2", children: [[1, 2, 3].map((step) => (_jsx("div", { className: "flex flex-1 items-center", children: _jsx("div", { className: `h-1.5 w-full rounded-full transition-colors duration-500 ${step === 1 ? 'bg-green-500' : step === 2 ? 'bg-primary' : 'bg-zinc-800'}` }) }, step))), _jsx("p", { className: "ml-2 text-xs font-medium text-zinc-500 shrink-0", children: "Step 2 of 3" })] }), _jsx("div", { className: "flex flex-col gap-3 mb-6", children: DOC_SLOTS.map(({ key, label, sub, Icon, accept }, i) => {
                    const slot = uploads[key];
                    const isDone = slot.url !== null;
                    const isUploading = slot.uploading;
                    return (_jsxs(motion.div, { initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 }, transition: { delay: 0.1 + i * 0.08 }, className: `rounded-2xl border transition-all duration-200 overflow-hidden ${isDone
                            ? 'border-green-500/30 bg-green-500/5'
                            : slot.error
                                ? 'border-red-500/40 bg-red-500/5'
                                : 'border-zinc-800 bg-zinc-900'}`, children: [_jsx("input", { ref: (el) => { inputRefs.current[key] = el; }, type: "file", accept: accept, className: "hidden", onChange: (e) => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                        void handleFileChange(key, file);
                                    e.target.value = '';
                                } }), _jsxs("div", { role: "button", tabIndex: 0, onClick: () => inputRefs.current[key]?.click(), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ')
                                    inputRefs.current[key]?.click(); }, className: "flex items-center gap-4 px-4 py-4 cursor-pointer", style: { touchAction: 'manipulation' }, children: [_jsxs("div", { className: `relative h-12 w-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden transition-colors duration-200 ${isDone ? 'bg-green-500/15' : 'bg-zinc-800'}`, children: [slot.preview ? (_jsx("img", { src: slot.preview, alt: "", className: "h-full w-full object-cover" })) : (_jsx(Icon, { size: 20, className: isDone ? 'text-green-400' : 'text-zinc-400' })), isUploading && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-zinc-900/80", children: _jsx("div", { className: "h-5 w-5 rounded-full border-2 border-zinc-600 border-t-primary animate-spin" }) }))] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: `text-sm font-semibold transition-colors ${isDone ? 'text-green-400' : 'text-zinc-200'}`, children: label }), _jsx("p", { className: "text-xs text-zinc-500 mt-0.5 leading-snug", children: sub }), slot.error && (_jsxs("p", { className: "mt-1 flex items-center gap-1 text-xs text-red-400", children: [_jsx(AlertCircle, { size: 10 }), slot.error] }))] }), _jsx("div", { className: "shrink-0", children: _jsx(AnimatePresence, { mode: "wait", children: isDone ? (_jsx(motion.div, { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0, opacity: 0 }, children: _jsx(CheckCircle2, { size: 20, className: "text-green-400" }) }, "done")) : (_jsx(motion.div, { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0, opacity: 0 }, children: _jsx(Upload, { size: 16, className: "text-zinc-600" }) }, "upload")) }) })] }), _jsx(AnimatePresence, { children: isDone && slot.preview && (_jsx(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: 140, opacity: 1 }, exit: { height: 0, opacity: 0 }, transition: { duration: 0.2 }, style: { overflow: 'hidden' }, children: _jsxs("div", { className: "relative h-[140px] w-full bg-zinc-950 flex items-center justify-center", children: [_jsx("img", { src: slot.preview, alt: "Document preview", className: "max-h-full max-w-full object-contain" }), _jsx("div", { className: "absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-950/80 to-transparent" }), _jsx("button", { type: "button", onClick: (e) => {
                                                    e.stopPropagation();
                                                    setSlot(key, initSlot());
                                                }, className: "absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-300 cursor-pointer hover:bg-zinc-800 transition-colors", "aria-label": "Remove document", children: _jsx(X, { size: 13 }) }), _jsxs("span", { className: "absolute bottom-2 left-3 text-[10px] font-semibold text-green-300 flex items-center gap-1", children: [_jsx(CheckCircle2, { size: 10 }), "Uploaded"] })] }) })) })] }, key));
                }) }), _jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.38 }, className: "mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-500 leading-relaxed", children: "Your documents are uploaded securely over HTTPS and stored with Cloudinary. They are used only for identity verification and reviewed by our team before your account is activated." }), _jsx(motion.button, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.44 }, whileTap: { scale: 0.97 }, onClick: () => void handleSubmit(), disabled: !allUploaded || submitting, className: "mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer", style: { minHeight: '56px', touchAction: 'manipulation' }, children: submitting ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" }), "Submitting\u2026"] })) : (_jsxs(_Fragment, { children: ["Submit documents", _jsx(ChevronRight, { size: 18 })] })) }), !allUploaded && (_jsx("p", { className: "mt-3 text-center text-xs text-zinc-600", children: "Upload all 3 documents to continue" }))] }));
}
//# sourceMappingURL=KycUploadPage.js.map