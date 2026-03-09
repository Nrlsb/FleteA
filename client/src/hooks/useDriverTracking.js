import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

const ACTIVE_STATUSES = ['accepted', 'loading', 'in_progress'];
const THROTTLE_MS = 7000;

const useDriverTracking = (activeTrip) => {
    const watchIdRef = useRef(null);
    const lastSentRef = useRef(0);

    useEffect(() => {
        const isActive = activeTrip && ACTIVE_STATUSES.includes(activeTrip.status);

        if (!isActive) {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            return;
        }

        if (!navigator.geolocation) return;

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const now = Date.now();
                if (now - lastSentRef.current < THROTTLE_MS) return;
                lastSentRef.current = now;

                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const headers = { 'Content-Type': 'application/json' };
                    if (session?.access_token) {
                        headers['Authorization'] = `Bearer ${session.access_token}`;
                    }

                    await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${activeTrip.id}/location`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            lat: position.coords.latitude,
                            lon: position.coords.longitude
                        })
                    });
                } catch (err) {
                    console.error('Error sending location:', err);
                }
            },
            (err) => console.error('Geolocation error:', err),
            { enableHighAccuracy: true }
        );

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [activeTrip?.id, activeTrip?.status]);
};

export default useDriverTracking;
