import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
import { authApi, ridersApi } from '@grandxl/api-client';
import { useAuthStore } from '../../store/auth.store';
import { useRiderStore } from '../../store/rider.store';
import { useWebPush } from '../../hooks/useWebPush';
import { useRiderSocket } from '../../hooks/useRiderSocket';
import { loadRiderToken, saveRiderToken, clearRiderToken } from '../../lib/riderAuth';
import { UserRole, OrderStatus } from '@grandxl/types';
export function AuthInit({ children }) {
    const { setAuth, clearAuth, setInitializing } = useAuthStore();
    const { setRider, setActiveOrder } = useRiderStore();
    useWebPush();
    useRiderSocket();
    useEffect(() => {
        async function init() {
            try {
                // Prefer the localStorage token (port-isolated) over the shared cookie.
                // This prevents the customer web app (localhost:5173) from clobbering the
                // rider session when both run on localhost simultaneously.
                const storedToken = loadRiderToken();
                let accessToken = null;
                let user = null;
                if (storedToken) {
                    const mobileRes = await authApi.refreshMobile({ refreshToken: storedToken });
                    const d = mobileRes.data.data;
                    accessToken = d.accessToken;
                    user = d.user;
                    if (d.refreshToken)
                        saveRiderToken(d.refreshToken);
                }
                else {
                    const cookieRes = await authApi.refresh();
                    const d = cookieRes.data.data;
                    accessToken = d.accessToken ?? null;
                    user = d.user ?? null;
                }
                if (!accessToken || !user) {
                    clearRiderToken();
                    clearAuth();
                    return;
                }
                setAuth(user, accessToken);
                // Restore rider profile + any in-progress active job
                if (user.roles.includes(UserRole.RIDER)) {
                    const [riderRes, activeRes] = await Promise.allSettled([
                        ridersApi.getProfile(),
                        ridersApi.getActiveJob(),
                    ]);
                    if (riderRes.status === 'fulfilled') {
                        setRider(riderRes.value.data.data);
                    }
                    if (activeRes.status === 'fulfilled') {
                        const activeOrder = activeRes.value.data.data;
                        const activeStatuses = [
                            OrderStatus.CONFIRMED,
                            OrderStatus.PREPARING,
                            OrderStatus.READY,
                            OrderStatus.PICKED_UP,
                        ];
                        if (activeOrder && activeStatuses.includes(activeOrder.status)) {
                            setActiveOrder(activeOrder);
                        }
                    }
                    // If activeRes rejected, AvailableJobsPage's recovery poll will find the active job
                    // within 10 seconds of arriving on that page.
                }
            }
            catch {
                // Invalid/expired refresh token — wipe stored token and treat as logged out
                clearRiderToken();
                clearAuth();
            }
            finally {
                setInitializing(false);
            }
        }
        void init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return _jsx(_Fragment, { children: children });
}
//# sourceMappingURL=AuthInit.js.map