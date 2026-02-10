import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { MapPin, Navigation, DollarSign } from 'lucide-react';
import RatingModal from '../components/RatingModal';

const DriverDashboard = () => {
    const { user, profile } = useAuth();
    const [isAvailable, setIsAvailable] = useState(profile?.is_available || false);
    const [pendingTrips, setPendingTrips] = useState([]);
    const [activeTrip, setActiveTrip] = useState(null);
    const [loading, setLoading] = useState(false);

    // Sync available state
    useEffect(() => {
        if (profile) setIsAvailable(profile.is_available);
    }, [profile]);

    // Fetch trips logic
    const fetchPendingTrips = async () => {
        // Should filter by vehicle type compatibility ideally, but MVP all pending
        const { data } = await supabase
            .from('trips')
            .select('*, profiles:user_id(full_name)') // Join to get user name
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        // Client side filter by vehicle type for now if needed, or rely on backend
        if (data) setPendingTrips(data);
    };

    const fetchActiveTrip = async () => {
        const { data } = await supabase
            .from('trips')
            .select('*, profiles:user_id(full_name)')
            .eq('driver_id', user.id)
            .in('status', ['accepted', 'in_progress'])
            .maybeSingle();

        setActiveTrip(data);
    };

    useEffect(() => {
        fetchPendingTrips();
        fetchActiveTrip();

        // Realtime subscription
        const channel = supabase
            .channel('driver_trips')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
                fetchPendingTrips();
                fetchActiveTrip();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const toggleAvailability = async () => {
        const newState = !isAvailable;
        setIsAvailable(newState);

        // Update backend (optional if we just use local toggle for filtering, but good to store)
        await fetch('http://localhost:3000/api/drivers/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driver_id: user.id, is_available: newState })
        });
    };

    const acceptTrip = async (tripId) => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3000/api/trips/${tripId}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driver_id: user.id })
            });
            if (res.ok) {
                fetchActiveTrip();
                fetchPendingTrips();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };



    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [justCompletedTrip, setJustCompletedTrip] = useState(null);

    const completeTrip = async (tripId) => {
        if (!confirm("¿Finalizar viaje?")) return;
        try {
            await fetch(`http://localhost:3000/api/trips/${tripId}/complete`, {
                method: 'POST'
            });
            // Keep the trip in memory effectively or fetch it to rate the user
            setJustCompletedTrip(activeTrip);
            setActiveTrip(null);
            setRatingModalOpen(true);
        } catch (e) { console.error(e); }
    };

    const submitRating = async ({ rating, comment }) => {
        if (!justCompletedTrip) return;
        try {
            await fetch('http://localhost:3000/api/ratings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trip_id: justCompletedTrip.id,
                    reviewer_id: user.id,
                    reviewee_id: justCompletedTrip.user_id, // Driver rates user
                    rating,
                    comment
                })
            });
            setJustCompletedTrip(null);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header Status */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Panel de Chofer</h1>
                    <p className="text-gray-500">Vehículo: <span className="uppercase font-semibold">{profile?.vehicle_type}</span></p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${isAvailable ? 'text-green-600' : 'text-gray-500'}`}>
                        {isAvailable ? 'Disponible para viajes' : 'No disponible'}
                    </span>
                    <button
                        onClick={toggleAvailability}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            {activeTrip ? (
                <div className="bg-blue-600 rounded-xl shadow-lg p-6 text-white mb-8 animate-fade-in">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-bold mb-1">Viaje En Curso via Google Maps</h2>
                            <p className="text-blue-100">Cliente: {activeTrip.profiles?.full_name}</p>
                        </div>
                        <div className="bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                            <span className="font-bold text-xl">${activeTrip.price}</span>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="flex gap-3 items-start">
                            <div className="p-2 bg-white/10 rounded-lg"><MapPin className="w-5 h-5" /></div>
                            <div>
                                <p className="text-xs text-blue-200 uppercase tracking-wider">Retirar en</p>
                                <p className="font-medium text-lg">{activeTrip.origin_address}</p>
                                <a target="_blank" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeTrip.origin_address)}`} className="text-xs text-blue-200 hover:text-white underline mt-1 block">Ver en Mapa</a>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className="p-2 bg-white/10 rounded-lg"><Navigation className="w-5 h-5" /></div>
                            <div>
                                <p className="text-xs text-blue-200 uppercase tracking-wider">Entregar en</p>
                                <p className="font-medium text-lg">{activeTrip.destination_address}</p>
                                <a target="_blank" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeTrip.destination_address)}`} className="text-xs text-blue-200 hover:text-white underline mt-1 block">Ver en Mapa</a>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => completeTrip(activeTrip.id)}
                        className="w-full py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition shadow-lg"
                    >
                        Finalizar Viaje
                    </button>
                </div>
            ) : (
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Pedidos Disponibles</h3>
                    {pendingTrips.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">No hay pedidos pendientes en este momento.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {pendingTrips.map(trip => (
                                <div key={trip.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><DollarSign className="w-5 h-5" /></div>
                                            <span className="text-2xl font-bold text-gray-900">${trip.price}</span>
                                        </div>
                                        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold uppercase">{trip.distance_km} km</span>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            <span className="text-gray-600 truncate">{trip.origin_address}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                            <span className="text-gray-600 truncate">{trip.destination_address}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => acceptTrip(trip.id)}
                                        disabled={!isAvailable}
                                        className="w-full py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isAvailable ? 'Aceptar Viaje' : 'Disponible para aceptar'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <RatingModal
                isOpen={ratingModalOpen}
                onClose={() => setRatingModalOpen(false)}
                onSubmit={submitRating}
                title="Calificar Cliente"
            />
        </div>
    );
};

export default DriverDashboard;
