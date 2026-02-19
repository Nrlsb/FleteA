import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { MapPin, Navigation, DollarSign } from 'lucide-react';
import RatingModal from '../components/RatingModal';
import ConfirmationModal from '../components/ConfirmationModal';

const DriverDashboard = () => {
    const { user, profile, updateProfileLocal } = useAuth();
    const [isAvailable, setIsAvailable] = useState(profile?.is_available || false);
    const [pendingTrips, setPendingTrips] = useState([]);
    const [activeTrip, setActiveTrip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [tripToComplete, setTripToComplete] = useState(null);
    const [loadingPhoto, setLoadingPhoto] = useState(false);
    const [loadingPhotoUrl, setLoadingPhotoUrl] = useState('');

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

        // Optimistically update local state AND global context
        setIsAvailable(newState);
        updateProfileLocal({ is_available: newState });

        // Update backend
        try {
            await fetch(`${import.meta.env.VITE_API_URL}/api/drivers/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driver_id: user.id, is_available: newState })
            });
        } catch (error) {
            console.error("Error updating status:", error);
            // Revert on error if needed, but for now just log
        }
    };

    const acceptTrip = async (tripId) => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripId}/accept`, {
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
        setTripToComplete(tripId);
        setConfirmModalOpen(true);
    };

    const handleConfirmComplete = async () => {
        if (!tripToComplete) return;
        try {
            await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${tripToComplete}/complete`, {
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
            await fetch(`${import.meta.env.VITE_API_URL}/api/ratings`, {
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

    const handleUpdateStatus = async (status, photoUrl = null) => {
        if (!activeTrip) return;
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/${activeTrip.id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, photo_url: photoUrl })
            });
            if (res.ok) {
                fetchActiveTrip();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadPhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoadingPhoto(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `load_${activeTrip.id}_${Math.random()}.${fileExt}`;
            const filePath = `proofs/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('fletea-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('fletea-images')
                .getPublicUrl(filePath);

            setLoadingPhotoUrl(data.publicUrl);
            // Auto update status to loading with photo? Or let user click button.
            // Let's just store URL and user confirms.
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Error al subir la imagen');
        } finally {
            setLoadingPhoto(false);
        }
    };

    // Calculate Earnings
    const totalEarnings = pendingTrips // Reuse pendingTrips variable name logic is bad here, need completed trips.
    // Actually fetchTrips doesn't fetch completed trips for history for driver in this component yet.
    // Let's create a quick simple earnings calc from what we can or just use a placeholder logic if data not avail.
    // Better: Fetch completed trips for earnings.

    const [earnings, setEarnings] = useState(0);

    useEffect(() => {
        const fetchEarnings = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('trips')
                .select('price')
                .eq('driver_id', user.id)
                .eq('status', 'completed');

            if (data) {
                const total = data.reduce((sum, t) => sum + t.price, 0);
                const platformFee = 0.15; // 15% fee
                setEarnings(total * (1 - platformFee));
            }
        };
        fetchEarnings();
    }, [user, justCompletedTrip]); // Refresh when a trip is completed

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header Status */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Panel de Chofer</h1>
                    <p className="text-gray-500">Vehículo: <span className="uppercase font-semibold">{profile?.vehicle_type}</span></p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Ganancias Hoy</p>
                        <p className="text-xl font-bold text-green-600">${earnings.toFixed(0)}</p>
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
                        {/* Status Bar */}
                        <div className="flex justify-between items-center mb-4 bg-blue-700/30 p-3 rounded-lg">
                            <div className={`flex flex-col items-center ${['accepted', 'loading', 'in_progress'].includes(activeTrip.status) ? 'text-white' : 'text-blue-300'}`}>
                                <div className="w-3 h-3 rounded-full bg-current mb-1" />
                                <span className="text-xs">Aceptado</span>
                            </div>
                            <div className={`h-[2px] flex-1 mx-2 ${['loading', 'in_progress'].includes(activeTrip.status) ? 'bg-white' : 'bg-blue-300/30'}`} />
                            <div className={`flex flex-col items-center ${['loading', 'in_progress'].includes(activeTrip.status) ? 'text-white' : 'text-blue-300'}`}>
                                <div className="w-3 h-3 rounded-full bg-current mb-1" />
                                <span className="text-xs">Cargando</span>
                            </div>
                            <div className={`h-[2px] flex-1 mx-2 ${activeTrip.status === 'in_progress' ? 'bg-white' : 'bg-blue-300/30'}`} />
                            <div className={`flex flex-col items-center ${activeTrip.status === 'in_progress' ? 'text-white' : 'text-blue-300'}`}>
                                <div className="w-3 h-3 rounded-full bg-current mb-1" />
                                <span className="text-xs">En Viaje</span>
                            </div>
                        </div>

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

                    {/* ACTION BUTTONS BASED ON STATUS */}
                    {activeTrip.status === 'accepted' && (
                        <button
                            onClick={() => handleUpdateStatus('loading')}
                            disabled={loading}
                            className="w-full py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition shadow-lg mb-2"
                        >
                            Llegué al Origen / Iniciar Carga
                        </button>
                    )}

                    {activeTrip.status === 'loading' && (
                        <div className="bg-white/10 p-4 rounded-xl border border-blue-400 mb-4">
                            <p className="text-sm font-medium mb-3">Foto de Seguridad (Obligatoria)</p>
                            {!loadingPhotoUrl ? (
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLoadPhotoUpload}
                                        className="block w-full text-sm text-blue-100
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-full file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-blue-50 file:text-blue-700
                                        hover:file:bg-blue-100"
                                    />
                                    {loadingPhoto && <p className="text-xs mt-1">Subiendo...</p>}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <img src={loadingPhotoUrl} alt="Carga" className="h-32 rounded-lg object-cover" />
                                    <button
                                        onClick={() => handleUpdateStatus('in_progress', loadingPhotoUrl)}
                                        disabled={loading}
                                        className="w-full py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition shadow-lg"
                                    >
                                        Confirmar Carga e Iniciar Viaje
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTrip.status === 'in_progress' && (
                        <button
                            onClick={() => completeTrip(activeTrip.id)}
                            className="w-full py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition shadow-lg"
                        >
                            Finalizar Viaje
                        </button>
                    )}
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

            <ConfirmationModal
                isOpen={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                onConfirm={handleConfirmComplete}
                title="¿Finalizar viaje?"
                message="Asegúrate de haber completado la entrega antes de finalizar."
                confirmText="Finalizar"
                cancelText="Volver"
                type="warning"
            />
        </div>
    );
};

export default DriverDashboard;
