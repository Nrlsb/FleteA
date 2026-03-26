import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { apiPost, apiPut } from '../services/api';
import { MapPin, Navigation, DollarSign, Pencil, X, Package, Wrench } from 'lucide-react';
import RatingModal from '../components/RatingModal';
import ConfirmationModal from '../components/ConfirmationModal';
import useDriverTracking from '../hooks/useDriverTracking';

const DriverDashboard = () => {
    const { user, profile, updateProfileLocal } = useAuth();
    const [isAvailable, setIsAvailable] = useState(profile?.is_available || false);
    const [pendingTrips, setPendingTrips] = useState([]);
    const [activeTrip, setActiveTrip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [tripToComplete, setTripToComplete] = useState(null);
    const [loadingPhotoUrl, setLoadingPhotoUrl] = useState('');
    const [deliveryPhotoUrl, setDeliveryPhotoUrl] = useState('');
    const [uploadingPhoto, setUploadingPhoto] = useState({ loading: false, delivery: false });
    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [justCompletedTrip, setJustCompletedTrip] = useState(null);
    const [earnings, setEarnings] = useState(0);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [savingProfile, setSavingProfile] = useState(false);
    const [editError, setEditError] = useState('');

    // GPS tracking hook
    useDriverTracking(activeTrip);

    // Sync available state
    useEffect(() => {
        if (profile) setIsAvailable(profile.is_available);
    }, [profile]);

    // Fetch trips logic
    const fetchPendingTrips = async () => {
        let query = supabase
            .from('trips')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        // Only show trips matching the driver's vehicle type
        if (profile?.vehicle_type) {
            query = query.eq('vehicle_type', profile.vehicle_type);
        }

        const { data, error } = await query;
        if (error) {
            console.error("Error en fetchPendingTrips:", error);
        }
        if (data) setPendingTrips(data);
    };

    const fetchActiveTrip = async () => {
        const { data: trip, error } = await supabase
            .from('trips')
            .select('*')
            .eq('driver_id', user.id)
            .in('status', ['driver_pending', 'accepted', 'loading', 'in_progress'])
            .maybeSingle();

        if (error) {
            console.error("Error en fetchActiveTrip:", error);
        }

        if (trip?.user_id) {
            const { data: prof } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', trip.user_id)
                .maybeSingle();
            setActiveTrip({ ...trip, profiles: prof });
        } else {
            setActiveTrip(trip);
        }
    };

    useEffect(() => {
        fetchPendingTrips();
        fetchActiveTrip();

        const channel = supabase
            .channel('driver_trips')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
                fetchPendingTrips();
                fetchActiveTrip();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, profile?.vehicle_type]);

    // Earnings: only today (uses end_time if available, falls back to updated_at)
    useEffect(() => {
        const fetchEarnings = async () => {
            if (!user) return;
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const { data } = await supabase
                .from('trips')
                .select('price, end_time, updated_at')
                .eq('driver_id', user.id)
                .eq('status', 'completed')
                .gte('updated_at', startOfDay.toISOString());

            if (data) {
                const total = data.reduce((sum, t) => sum + t.price, 0);
                setEarnings(total * 0.85);
            }
        };
        fetchEarnings();
    }, [user, justCompletedTrip]);

    const openEditModal = () => {
        const dims = profile?.vehicle_dimensions || {};
        setEditForm({
            full_name: profile?.full_name || '',
            vehicle_type: profile?.vehicle_type || 'flete_chico',
            max_cargo_weight: profile?.max_cargo_weight || '',
            dim_length: dims.length || '',
            dim_width: dims.width || '',
            dim_height: dims.height || '',
        });
        setEditError('');
        setEditModalOpen(true);
    };

    const saveProfile = async () => {
        if (!editForm.full_name.trim()) {
            setEditError('El nombre no puede estar vacío.');
            return;
        }
        setSavingProfile(true);
        setEditError('');
        try {
            const vehicle_dimensions = {
                length: editForm.dim_length ? parseFloat(editForm.dim_length) : null,
                width: editForm.dim_width ? parseFloat(editForm.dim_width) : null,
                height: editForm.dim_height ? parseFloat(editForm.dim_height) : null,
            };
            const res = await apiPut('/api/drivers/profile', {
                full_name: editForm.full_name,
                vehicle_type: editForm.vehicle_type,
                max_cargo_weight: editForm.max_cargo_weight ? parseInt(editForm.max_cargo_weight) : null,
                vehicle_dimensions,
            });
            const json = await res.json();
            if (!res.ok) {
                setEditError(json.error || 'Error al guardar.');
                return;
            }
            updateProfileLocal(json.profile);
            setEditModalOpen(false);
        } catch (e) {
            setEditError('Error de red.');
        } finally {
            setSavingProfile(false);
        }
    };

    const toggleAvailability = async () => {
        const newState = !isAvailable;
        setIsAvailable(newState);
        updateProfileLocal({ is_available: newState });

        const getLocation = () => new Promise((resolve) => {
            if (!newState || !navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                () => resolve(null)
            );
        });

        const location = await getLocation();
        try {
            await apiPost('/api/drivers/status', { is_available: newState, location });
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const acceptTrip = async (tripId) => {
        setLoading(true);
        try {
            const res = await apiPost(`/api/trips/${tripId}/accept`, {});
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

    const completeTrip = (tripId) => {
        setTripToComplete(tripId);
        setConfirmModalOpen(true);
    };

    const handleConfirmComplete = async () => {
        if (!tripToComplete) return;
        try {
            await apiPost(`/api/trips/${tripToComplete}/status`, {
                status: 'completed',
                photo_url: deliveryPhotoUrl
            });
            setJustCompletedTrip(activeTrip);
            setActiveTrip(null);
            setDeliveryPhotoUrl('');
            setRatingModalOpen(true);
        } catch (e) { console.error(e); }
    };

    const submitRating = async ({ rating, comment }) => {
        if (!justCompletedTrip) return;
        try {
            await apiPost('/api/ratings', {
                trip_id: justCompletedTrip.id,
                reviewee_id: justCompletedTrip.user_id,
                rating,
                comment
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
            const res = await apiPost(`/api/trips/${activeTrip.id}/status`, { status, photo_url: photoUrl });
            if (res.ok) fetchActiveTrip();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Unified photo upload for both loading and delivery proofs
    const uploadProofPhoto = async (file, type) => {
        if (!file || !activeTrip) return;

        setUploadingPhoto(prev => ({ ...prev, [type]: true }));
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${type}_${activeTrip.id}_${crypto.randomUUID()}.${fileExt}`;
            const filePath = `proofs/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('fletea-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('fletea-images').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Error al subir la imagen');
            return null;
        } finally {
            setUploadingPhoto(prev => ({ ...prev, [type]: false }));
        }
    };

    const handleLoadPhotoUpload = async (e) => {
        const url = await uploadProofPhoto(e.target.files[0], 'loading');
        if (url) setLoadingPhotoUrl(url);
    };

    const handleDeliveryPhotoUpload = async (e) => {
        const url = await uploadProofPhoto(e.target.files[0], 'delivery');
        if (url) setDeliveryPhotoUrl(url);
    };

    const dims = profile?.vehicle_dimensions;
    const dimsText = dims && (dims.length || dims.width || dims.height)
        ? `${dims.length || '-'}m × ${dims.width || '-'}m × ${dims.height || '-'}m`
        : null;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header Status */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex justify-between items-center mb-8">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900">Panel de Chofer</h1>
                        <button onClick={openEditModal} title="Editar perfil" className="p-1 text-gray-400 hover:text-gray-700 transition">
                            <Pencil className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-gray-500">Vehículo: <span className="uppercase font-semibold">{profile?.vehicle_type}</span></p>
                    {(dimsText || profile?.max_cargo_weight) && (
                        <p className="text-gray-400 text-sm">
                            {dimsText && <span>{dimsText}</span>}
                            {dimsText && profile?.max_cargo_weight && <span> · </span>}
                            {profile?.max_cargo_weight && <span>Máx {profile.max_cargo_weight} kg</span>}
                        </p>
                    )}
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
                            <h2 className="text-xl font-bold mb-1">Viaje En Curso</h2>
                            <p className="text-blue-100">Cliente: {activeTrip.profiles?.full_name}</p>
                        </div>
                        <div className="bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                            <span className="font-bold text-xl">${activeTrip.price}</span>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        {/* Status Bar */}
                        {activeTrip.status === 'driver_pending' ? (
                            <div className="bg-white/20 border border-white/40 text-white p-4 mb-6 rounded-lg text-center animate-pulse">
                                <p className="font-bold text-lg mb-1">¡Viaje Solicitado!</p>
                                <p className="text-sm text-blue-100">Esperando que el cliente confirme para iniciar.</p>
                            </div>
                        ) : (
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
                        )}

                        <div className="flex gap-3 items-start">
                            <div className="p-2 bg-white/10 rounded-lg"><MapPin className="w-5 h-5" /></div>
                            <div>
                                <p className="text-xs text-blue-200 uppercase tracking-wider">Retirar en</p>
                                <p className="font-medium text-lg">{activeTrip.origin_address}</p>
                                <div className="flex gap-3 mt-1">
                                    <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeTrip.origin_address)}`} className="text-xs text-blue-200 hover:text-white underline">Google Maps</a>
                                    <a target="_blank" rel="noreferrer" href={`https://waze.com/ul?q=${encodeURIComponent(activeTrip.origin_address)}&navigate=yes`} className="text-xs text-blue-200 hover:text-white underline">Waze</a>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className="p-2 bg-white/10 rounded-lg"><Navigation className="w-5 h-5" /></div>
                            <div>
                                <p className="text-xs text-blue-200 uppercase tracking-wider">Entregar en</p>
                                <p className="font-medium text-lg">{activeTrip.destination_address}</p>
                                <div className="flex gap-3 mt-1">
                                    <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeTrip.destination_address)}`} className="text-xs text-blue-200 hover:text-white underline">Google Maps</a>
                                    <a target="_blank" rel="noreferrer" href={`https://waze.com/ul?q=${encodeURIComponent(activeTrip.destination_address)}&navigate=yes`} className="text-xs text-blue-200 hover:text-white underline">Waze</a>
                                </div>
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
                                        className="block w-full text-sm text-blue-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    {uploadingPhoto.loading && <p className="text-xs mt-1">Subiendo...</p>}
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
                        <div className="bg-white/10 p-4 rounded-xl border border-blue-400 mb-4">
                            <p className="text-sm font-medium mb-3">Foto de Entrega (Obligatoria)</p>
                            {!deliveryPhotoUrl ? (
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleDeliveryPhotoUpload}
                                        className="block w-full text-sm text-blue-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    {uploadingPhoto.delivery && <p className="text-xs mt-1">Subiendo...</p>}
                                    {!uploadingPhoto.delivery && <p className="text-xs mt-2 text-blue-200">Sube la foto para habilitar el botón de entrega</p>}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <img src={deliveryPhotoUrl} alt="Entrega" className="h-32 rounded-lg object-cover" />
                                    <button
                                        onClick={() => completeTrip(activeTrip.id)}
                                        className="w-full py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition shadow-lg"
                                    >
                                        Confirmar Entrega
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Pedidos Disponibles</h3>
                    {pendingTrips.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">No hay pedidos pendientes en este momento.</p>
                            {profile?.vehicle_type && (
                                <p className="text-xs text-gray-400 mt-1">Filtrando por: <span className="font-semibold uppercase">{profile.vehicle_type.replace(/_/g, ' ')}</span></p>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {pendingTrips.map(trip => (
                                <button
                                    key={trip.id}
                                    onClick={() => setSelectedTrip(trip)}
                                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-400 hover:shadow-md transition-all text-left w-full"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><DollarSign className="w-5 h-5" /></div>
                                            <span className="text-2xl font-bold text-gray-900">${trip.price}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {trip.services?.length > 0 && (
                                                <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-xs font-semibold">+{trip.services.length} servicio{trip.services.length > 1 ? 's' : ''}</span>
                                            )}
                                            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold uppercase">{trip.distance_km} km</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                                            <span className="text-gray-600 truncate">{trip.origin_address}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                                            <span className="text-gray-600 truncate">{trip.destination_address}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-blue-500 mt-4 font-medium">Tap para ver detalles →</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {selectedTrip && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Detalles del Pedido</h2>
                            <button onClick={() => setSelectedTrip(null)} className="p-1 text-gray-400 hover:text-gray-700 transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-5">
                            {/* Price + distance */}
                            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Ganancia estimada</p>
                                    <p className="text-3xl font-bold text-gray-900">${(selectedTrip.price * 0.85).toFixed(0)}</p>
                                    <p className="text-xs text-gray-400">de ${selectedTrip.price} total</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Distancia</p>
                                    <p className="text-2xl font-bold text-gray-700">{selectedTrip.distance_km} km</p>
                                </div>
                            </div>

                            {/* Addresses */}
                            <div className="space-y-3">
                                <div className="flex gap-3 items-start">
                                    <div className="mt-1 w-3 h-3 rounded-full bg-blue-500 shrink-0"></div>
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Origen</p>
                                        <p className="text-gray-800 font-medium">{selectedTrip.origin_address}</p>
                                    </div>
                                </div>
                                <div className="ml-1.5 w-0.5 h-4 bg-gray-200"></div>
                                <div className="flex gap-3 items-start">
                                    <div className="mt-1 w-3 h-3 rounded-full bg-red-500 shrink-0"></div>
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Destino</p>
                                        <p className="text-gray-800 font-medium">{selectedTrip.destination_address}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Category */}
                            {selectedTrip.category && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Package className="w-4 h-4 text-gray-400" />
                                    <span>Categoría: <span className="font-semibold capitalize">{selectedTrip.category}</span></span>
                                </div>
                            )}

                            {/* Services */}
                            {selectedTrip.services?.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Wrench className="w-4 h-4 text-gray-400" />
                                        <p className="text-sm font-medium text-gray-700">Servicios adicionales</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedTrip.services.map(s => (
                                            <span key={s} className="bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1 rounded-full text-xs font-semibold capitalize">
                                                {s === 'helper' ? 'Ayudante' : s === 'packing' ? 'Embalaje' : s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Photos */}
                            {selectedTrip.photos?.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium text-gray-700 mb-2">Fotos de la carga</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {selectedTrip.photos.map((url, i) => (
                                            <a key={i} href={url} target="_blank" rel="noreferrer">
                                                <img src={url} alt={`Foto ${i + 1}`} className="h-20 w-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-5 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setSelectedTrip(null)}
                                className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                            >
                                Volver
                            </button>
                            <button
                                onClick={() => { acceptTrip(selectedTrip.id); setSelectedTrip(null); }}
                                disabled={!isAvailable || loading}
                                className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg font-semibold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {isAvailable ? 'Aceptar Viaje' : 'No disponible'}
                            </button>
                        </div>
                    </div>
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
                title="¿Confirmar entrega?"
                message="Asegúrate de haber completado la entrega antes de finalizar."
                confirmText="Confirmar"
                cancelText="Volver"
                type="warning"
            />

            {editModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Editar Perfil</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                                <input
                                    type="text"
                                    value={editForm.full_name}
                                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de vehículo</label>
                                <select
                                    value={editForm.vehicle_type}
                                    onChange={e => setEditForm(f => ({ ...f, vehicle_type: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="flete_chico">Flete Chico</option>
                                    <option value="flete_mediano">Flete Mediano</option>
                                    <option value="mudancera">Mudancera</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Peso máximo (kg)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editForm.max_cargo_weight}
                                    onChange={e => setEditForm(f => ({ ...f, max_cargo_weight: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Opcional"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dimensiones (metros)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={editForm.dim_length}
                                        onChange={e => setEditForm(f => ({ ...f, dim_length: e.target.value }))}
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Largo"
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={editForm.dim_width}
                                        onChange={e => setEditForm(f => ({ ...f, dim_width: e.target.value }))}
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ancho"
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={editForm.dim_height}
                                        onChange={e => setEditForm(f => ({ ...f, dim_height: e.target.value }))}
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Alto"
                                    />
                                </div>
                            </div>
                            {editError && <p className="text-sm text-red-600">{editError}</p>}
                        </div>
                        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                            <button
                                onClick={() => setEditModalOpen(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveProfile}
                                disabled={savingProfile}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {savingProfile ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverDashboard;
