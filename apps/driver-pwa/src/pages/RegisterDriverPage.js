import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, Car, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi, ridersApi } from '@grandxl/api-client';
import { VehicleType } from '@grandxl/types';
import { useRiderStore } from '../store/rider.store';
import { useAuthStore } from '../store/auth.store';
import { saveRiderToken } from '../lib/riderAuth';
import { ROUTES } from '../router/routes';
const VEHICLES = [
    { type: VehicleType.BICYCLE, label: 'Bicycle', sub: 'Eco-friendly short routes', Icon: Bike },
    { type: VehicleType.MOTORCYCLE, label: 'Motorcycle', sub: 'Fast city deliveries', Icon: Bike },
    { type: VehicleType.CAR, label: 'Car', sub: 'Comfortable all-weather rides', Icon: Car },
];
export default function RegisterDriverPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const phone = location.state?.phone ?? '';
    const { setRider } = useRiderStore();
    const { setAuth } = useAuthStore();
    const [step, setStep] = useState('personal');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [vehicle, setVehicle] = useState(VehicleType.MOTORCYCLE);
    const [plate, setPlate] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    // Redirect if no phone in state (arrived directly without OTP flow)
    if (!phone) {
        void navigate(ROUTES.LOGIN, { replace: true });
        return null;
    }
    function validatePersonal() {
        const e = {};
        if (!firstName.trim())
            e.firstName = 'First name is required';
        if (!lastName.trim())
            e.lastName = 'Last name is required';
        setErrors(e);
        return Object.keys(e).length === 0;
    }
    function validateVehicle() {
        const e = {};
        if (!plate.trim())
            e.plate = 'Plate number is required';
        setErrors(e);
        return Object.keys(e).length === 0;
    }
    function goToVehicle() {
        if (validatePersonal()) {
            setErrors({});
            setStep('vehicle');
        }
    }
    async function handleSubmit() {
        if (!validateVehicle())
            return;
        setLoading(true);
        try {
            // 1. Create account using the phone-verified Redis flag
            const regRes = await authApi.registerDriver({ phone, firstName: firstName.trim(), lastName: lastName.trim() });
            const { accessToken, refreshToken, user } = regRes.data.data;
            if (refreshToken)
                saveRiderToken(refreshToken);
            setAuth(user, accessToken);
            // 2. Create rider profile with vehicle info (now authenticated)
            const riderRes = await ridersApi.registerRider({
                vehicleType: vehicle,
                vehiclePlate: plate.trim().toUpperCase(),
            });
            setRider(riderRes.data.data);
            toast.success('Application submitted! Upload your documents next.');
            void navigate(ROUTES.KYC_UPLOAD, { replace: true });
        }
        catch (err) {
            const msg = err
                ?.response?.data?.message;
            if (msg?.includes('expired')) {
                toast.error('Verification expired. Please start again.');
                void navigate(ROUTES.LOGIN, { replace: true });
            }
            else {
                toast.error('Could not submit. Please try again.');
            }
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("div", { className: "flex min-h-screen flex-col bg-zinc-950 px-5 pt-14 pb-10", children: [_jsx("div", { className: "absolute top-5 left-1/2 -translate-x-1/2 flex gap-2", children: ['personal', 'vehicle'].map((s) => (_jsx("div", { className: `h-1.5 w-6 rounded-full transition-colors duration-300 ${step === s ? 'bg-primary' : 'bg-zinc-800'}` }, s))) }), _jsxs(motion.button, { initial: { opacity: 0 }, animate: { opacity: 1 }, onClick: () => step === 'vehicle' ? setStep('personal') : void navigate(-1), className: "mb-8 flex cursor-pointer items-center gap-1.5 self-start text-sm text-zinc-400 transition-colors hover:text-zinc-100", style: { touchAction: 'manipulation' }, children: [_jsx(ChevronLeft, { size: 18 }), "Back"] }), _jsxs(AnimatePresence, { mode: "wait", children: [step === 'personal' && (_jsxs(motion.div, { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 }, transition: { duration: 0.2 }, className: "flex flex-1 flex-col", children: [_jsxs("div", { className: "mb-8", children: [_jsx("div", { className: "mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15", children: _jsx(Bike, { size: 24, className: "text-primary" }) }), _jsx("h1", { className: "font-display text-2xl font-bold leading-tight text-zinc-100", children: "Create your account" }), _jsx("p", { className: "mt-1.5 text-sm text-zinc-500", children: "Tell us who you are \u2014 phone confirmed \u2713" })] }), _jsxs("div", { className: "flex flex-col gap-4 mb-8", children: [_jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500", children: "First name" }), _jsx("input", { type: "text", value: firstName, onChange: (e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: undefined })); }, placeholder: "e.g. Emeka", className: `w-full rounded-2xl border bg-zinc-900 px-4 py-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all focus:ring-2 ${errors.firstName
                                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                                    : 'border-zinc-800 focus:border-primary focus:ring-primary/20'}`, style: { fontSize: '16px', touchAction: 'manipulation' } }), _jsx(AnimatePresence, { children: errors.firstName && (_jsxs(motion.p, { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, className: "mt-1.5 flex items-center gap-1.5 text-xs text-red-400", children: [_jsx(AlertCircle, { size: 12 }), errors.firstName] })) })] }), _jsxs("div", { children: [_jsx("label", { className: "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500", children: "Last name" }), _jsx("input", { type: "text", value: lastName, onChange: (e) => { setLastName(e.target.value); setErrors((p) => ({ ...p, lastName: undefined })); }, placeholder: "e.g. Okonkwo", className: `w-full rounded-2xl border bg-zinc-900 px-4 py-4 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-all focus:ring-2 ${errors.lastName
                                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                                    : 'border-zinc-800 focus:border-primary focus:ring-primary/20'}`, style: { fontSize: '16px', touchAction: 'manipulation' } }), _jsx(AnimatePresence, { children: errors.lastName && (_jsxs(motion.p, { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, className: "mt-1.5 flex items-center gap-1.5 text-xs text-red-400", children: [_jsx(AlertCircle, { size: 12 }), errors.lastName] })) })] })] }), _jsxs(motion.button, { whileTap: { scale: 0.97 }, onClick: goToVehicle, className: "mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 cursor-pointer", style: { minHeight: '56px', touchAction: 'manipulation' }, children: ["Continue", _jsx(ChevronRight, { size: 18 })] })] }, "personal")), step === 'vehicle' && (_jsxs(motion.div, { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 }, transition: { duration: 0.2 }, className: "flex flex-1 flex-col", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "font-display text-2xl font-bold leading-tight text-zinc-100", children: "Your vehicle" }), _jsx("p", { className: "mt-1.5 text-sm text-zinc-500", children: "Select your vehicle type and enter your plate number" })] }), _jsx("div", { className: "mb-5 flex flex-col gap-2.5", children: VEHICLES.map(({ type, label, sub, Icon }, i) => {
                                    const isSelected = vehicle === type;
                                    return (_jsxs(motion.button, { initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 }, transition: { delay: i * 0.06 }, type: "button", onClick: () => setVehicle(type), className: `flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all duration-200 cursor-pointer ${isSelected
                                            ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                                            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`, style: { touchAction: 'manipulation' }, children: [_jsx("div", { className: `h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 ${isSelected ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-400'}`, children: _jsx(Icon, { size: 20 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: `font-semibold text-sm transition-colors ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`, children: label }), _jsx("p", { className: "text-xs text-zinc-500 mt-0.5", children: sub })] }), _jsx("div", { className: `h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-primary bg-primary' : 'border-zinc-700'}`, children: isSelected && (_jsx(motion.div, { initial: { scale: 0 }, animate: { scale: 1 }, className: "h-2 w-2 rounded-full bg-white" })) })] }, type));
                                }) }), _jsxs("div", { className: "mb-8", children: [_jsx("label", { className: "mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500", children: "Plate number" }), _jsx("input", { type: "text", value: plate, onChange: (e) => { setPlate(e.target.value); setErrors((p) => ({ ...p, plate: undefined })); }, placeholder: "e.g. ABC-123-XY", className: `w-full rounded-2xl border bg-zinc-900 px-4 py-4 font-mono text-sm tracking-widest text-zinc-100 placeholder-zinc-700 outline-none transition-all focus:ring-2 ${errors.plate
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                            : 'border-zinc-800 focus:border-primary focus:ring-primary/20'}`, style: { fontSize: '16px', touchAction: 'manipulation' }, autoCapitalize: "characters" }), _jsx(AnimatePresence, { children: errors.plate && (_jsxs(motion.p, { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, className: "mt-2 flex items-center gap-1.5 text-xs text-red-400", children: [_jsx(AlertCircle, { size: 12 }), errors.plate] })) })] }), _jsx("div", { className: "mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-500 leading-relaxed", children: "Your application will be reviewed within 24 hours. We may contact you to verify your vehicle documents." }), _jsx(motion.button, { whileTap: { scale: 0.97 }, onClick: () => void handleSubmit(), disabled: loading, className: "mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer", style: { minHeight: '56px', touchAction: 'manipulation' }, children: loading ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" }), "Submitting\u2026"] })) : (_jsxs(_Fragment, { children: ["Submit application", _jsx(ChevronRight, { size: 18 })] })) })] }, "vehicle"))] })] }));
}
//# sourceMappingURL=RegisterDriverPage.js.map