import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { apiPost, apiPut } from '../services/api';
import { MapPin, Navigation, DollarSign, Pencil, X, Package, Wrench, Home, History, PieChart } from 'lucide-react';
import RatingModal from '../components/RatingModal';
import ConfirmationModal from '../components/ConfirmationModal';
import useDriverTracking from '../hooks/useDriverTracking';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtime } from '../hooks/useRealtime';
import { Button } from '../components/ui/button';
import Chat from '../components/Chat';
import HistoryTab from '../components/HistoryTab';
import AnalyticsView from '../components/AnalyticsView';
import UserProfileModal from '../components/UserProfileModal';
import { User as UserIcon } from 'lucide-react';

const DriverDashboard = () => {
    const { user, profile, updateProfileLocal } = useAuth();
    const queryClient = useQueryClient();

    // --- Local UI State ---
    const [searchParams, setSearchParams] = useSearchParams();
    const viewMode = searchParams.get('view') || 'home';
    const setViewMode = (mode) => {
        if (mode === 'home') {
            searchParams.delete('view');
        } else {
            searchParams.set('view', mode);
        }
        setSearchParams(searchParams);
    };
    const [isAvailable, setIsAvailable] = useState(profile?.is_available || false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [tripToComplete, setTripToComplete] = useState(null);
    const [loadingPhotoUrl, setLoadingPhotoUrl] = useState('');
    const [deliveryPhotoUrl, setDeliveryPhotoUrl] = useState('');
    const [uploadingPhoto, setUploadingPhoto] = useState({ loading: false, delivery: false });
    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [justCompletedTrip, setJustCompletedTrip] = useState(null);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [editError, setEditError] = useState('');
    const [userProfileOpen, setUserProfileOpen] = useState(false);

    // --- Data Queries ---
    const { data: pendingTrips = [] } = useQuery({
        queryKey: ['pendingTrips', profile?.vehicle_type],
        queryFn: async () => {
            let query = supabase.from('trips').select('*').eq('status', 'pending').order('created_at', { ascending: false });
            if (profile?.vehicle_type) query = query.eq('vehicle_type', profile.vehicle_type);
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!profile,
    });

    const { data: activeTrip = null } = useQuery({
        queryKey: ['activeTrip', user?.id],
        queryFn: async () => {
            const { data: trip, error } = await supabase.from('trips').select('*').eq('driver_id', user.id).in('status', ['driver_pending', 'accepted', 'loading', 'in_progress']).maybeSingle();
            if (error) throw error;
            if (trip?.user_id) {
                const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', trip.user_id).maybeSingle();
                return { ...trip, profiles: prof };
            }
            return trip;
        },
        enabled: !!user,
    });

    const { data: earnings = 0 } = useQuery({
        queryKey: ['earnings', user?.id, activeTrip === null], // refetch when trip completes
        queryFn: async () => {
            const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
            const { data } = await supabase.from('trips').select('price').eq('driver_id', user.id).eq('status', 'completed').gte('updated_at', startOfDay.toISOString());
            return (data || []).reduce((sum, t) => sum + t.price, 0) * 0.85;
        },
        enabled: !!user,
    });

    // Realtime Sync for ALL relevant trip changes
    useRealtime('trips', `status=eq.pending`, ['pendingTrips', profile?.vehicle_type]);
    useRealtime('trips', `driver_id=eq.${user?.id}`, ['activeTrip', user?.id]);

    // Track active trip location
    useDriverTracking(activeTrip);

    // --- Mutations ---
    const toggleAvailabilityMutation = useMutation({
        mutationFn: async (newState) => {
            const location = await new Promise(r => {
                if (!newState || !navigator.geolocation) return r(null);
                navigator.geolocation.getCurrentPosition(p => r({ lat: p.coords.latitude, lon: p.coords.longitude }), () => r(null));
            });
            return apiPost('/api/drivers/status', { is_available: newState, location });
        },
        onSuccess: async (res) => {
            const data = await res.json();
            updateProfileLocal(data.driver);
            setIsAvailable(data.driver.is_available);
        }
    });

    const acceptTripMutation = useMutation({
        mutationFn: (id) => apiPost(`/api/trips/${id}/accept`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activeTrip'] });
            queryClient.invalidateQueries({ queryKey: ['pendingTrips'] });
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status, photoUrl }) => apiPost(`/api/trips/${id}/status`, { status, photo_url: photoUrl }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activeTrip'] }),
    });

    const saveProfileMutation = useMutation({
        mutationFn: (data) => apiPut('/api/drivers/profile', data),
        onSuccess: async (res) => {
            const json = await res.json();
            updateProfileLocal(json.profile);
            setEditModalOpen(false);
        },
        onError: (err) => setEditError(err.message || 'Error al guardar.')
    });

    // --- Handlers ---
    const openEditModal = () => {
        const dims = profile?.vehicle_dimensions || {};
        setEditForm({
            full_name: profile?.full_name || '',
            vehicle_type: profile?.vehicle_type || 'flete_chico',
            max_cargo_weight: profile?.max_cargo_weight || '',
            dim_length: dims.length || '', dim_width: dims.width || '', dim_height: dims.height || '',
            base_price: profile?.base_price || '',
            price_per_km: profile?.price_per_km || '',
            helper_price: profile?.helper_price || '',
            packing_price: profile?.packing_price || '',
        });
        setEditError(''); setEditModalOpen(true);
    };

    const handleConfirmComplete = async () => {
        if (!tripToComplete) return;
        try {
            await apiPost(`/api/trips/${tripToComplete}/status`, { status: 'completed', photo_url: deliveryPhotoUrl });
            setJustCompletedTrip(activeTrip);
            setDeliveryPhotoUrl(''); setConfirmModalOpen(false); setRatingModalOpen(true);
            queryClient.invalidateQueries({ queryKey: ['activeTrip'] });
            queryClient.invalidateQueries({ queryKey: ['earnings'] });
        } catch (_) { }
    };

    const uploadPhoto = async (file, type) => {
        if (!file || !activeTrip) return;
        setUploadingPhoto(p => ({ ...p, [type]: true }));
        try {
            const path = `proofs/${type}_${activeTrip.id}_${crypto.randomUUID()}.${file.name.split('.').pop()}`;
            const { error } = await supabase.storage.from('fletea-images').upload(path, file);
            if (error) throw error;
            return supabase.storage.from('fletea-images').getPublicUrl(path).data.publicUrl;
        } catch (_) { alert('Error al subir imagen'); return null; }
        finally { setUploadingPhoto(p => ({ ...p, [type]: false })); }
    };

    const STATUS_LABELS = { driver_pending: 'Confirmación Pendiente', accepted: 'En Curso', loading: 'Cargando', in_progress: 'En Viaje' };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            {/* Top Navigation Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border shadow-sm w-fit">
                    <button onClick={() => setViewMode('home')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'home' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <Home className="w-4 h-4" /> Panel de Trabajo
                    </button>
                    <button onClick={() => setViewMode('history')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'history' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <History className="w-4 h-4" /> Viajes Realizados
                    </button>
                    <button onClick={() => setViewMode('analytics')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'analytics' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <PieChart className="w-4 h-4" /> Mis Ganancias
                    </button>
                    <button onClick={() => setUserProfileOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all">
                        <UserIcon className="w-4 h-4" /> Mi Perfil
                    </button>
                </div>
                <div className="flex items-center gap-6 bg-white px-6 py-3 rounded-2xl border shadow-sm">
                    <div className="text-right">
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Hoy</p>
                        <p className="text-xl font-black text-green-600">${earnings.toFixed(0)}</p>
                    </div>
                    <div className="flex items-center gap-3 border-l pl-6">
                        <span className={`text-xs font-black uppercase tracking-tight ${isAvailable ? 'text-green-600' : 'text-gray-400'}`}>{isAvailable ? 'En línea' : 'Fuera de servicio'}</span>
                        <button onClick={() => toggleAvailabilityMutation.mutate(!isAvailable)} className={`relative h-6 w-11 rounded-full transition-all duration-300 ${isAvailable ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 'bg-gray-200'}`}>
                            <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${isAvailable ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'home' && (
                <>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center group hover:border-primary/20 transition-all">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Hola, {profile?.full_name?.split(' ')[0] || 'Chofer'} 👋</h1>
                                <button onClick={openEditModal} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                            </div>
                            <p className="text-gray-500 text-sm font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                Vehículo: <span className="uppercase font-bold text-gray-700">{profile?.vehicle_type?.replace('_', ' ')}</span>
                            </p>
                        </div>
                        <div className="hidden md:flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                            <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">{isAvailable ? 'Recibiendo Pedidos' : 'Modo Descanso'}</span>
                        </div>
                    </div>

                    {activeTrip ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-xl border-2 border-primary/10 animate-fade-in space-y-6 relative overflow-hidden">
                                {/* Accent gradient bar */}
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-blue-400" />

                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                            <h2 className="text-xl font-extrabold text-gray-900">Viaje en curso</h2>
                                        </div>
                                        <p className="text-gray-500 text-sm font-medium">Cliente: <span className="text-gray-900">{activeTrip.profiles?.full_name || 'Particular'}</span></p>
                                    </div>
                                    <div className="bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">
                                        <p className="text-xs text-primary font-bold uppercase tracking-wider mb-0.5">Precio</p>
                                        <div className="text-2xl font-black text-primary">${activeTrip.price}</div>
                                    </div>
                                </div>

                                <div className="grid gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                    <div className="flex gap-4">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <div className="w-0.5 h-full bg-dashed border-l-2 border-dashed border-gray-200" />
                                        </div>
                                        <div className="pb-2">
                                            <p className="text-[10px] uppercase font-bold text-primary tracking-widest mb-1">Origen</p>
                                            <p className="text-sm font-semibold text-gray-800 leading-tight">{activeTrip.origin_address}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                            <Navigation className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-green-600 tracking-widest mb-1">Destino</p>
                                            <p className="text-sm font-semibold text-gray-800 leading-tight">{activeTrip.destination_address}</p>
                                        </div>
                                    </div>
                                </div>

                                {activeTrip.status === 'driver_pending' ? (
                                    <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 text-center animate-pulse">
                                        <p className="text-amber-700 font-bold flex items-center justify-center gap-2">
                                            <Wrench className="w-5 h-5" />
                                            Esperando confirmación del cliente...
                                        </p>
                                        <p className="text-amber-600/70 text-xs mt-1">El cliente debe aceptar tu propuesta para comenzar.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 pt-2">
                                        {activeTrip.status === 'accepted' && (
                                            <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" onClick={() => updateStatusMutation.mutate({ id: activeTrip.id, status: 'loading' })}>
                                                Llegué al origen / Cargar
                                            </Button>
                                        )}
                                        {activeTrip.status === 'loading' && (
                                            <div className="space-y-4 p-5 bg-blue-50/50 rounded-xl border border-blue-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-sm font-bold text-blue-900 uppercase tracking-tight">Prueba de Carga</p>
                                                    {uploadingPhoto.loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                                                </div>
                                                {!loadingPhotoUrl ? (
                                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-200 rounded-xl bg-white hover:bg-blue-50 transition-colors cursor-pointer group">
                                                        <Package className="w-8 h-8 text-blue-300 group-hover:text-blue-500 mb-2" />
                                                        <span className="text-xs font-bold text-blue-400 group-hover:text-blue-600">Subir foto de la carga</span>
                                                        <input type="file" onChange={async (e) => { const url = await uploadPhoto(e.target.files[0], 'loading'); if (url) setLoadingPhotoUrl(url); }} className="hidden" />
                                                    </label>
                                                ) : (
                                                    <div className="space-y-4">
                                                        <div className="relative rounded-xl overflow-hidden shadow-md">
                                                            <img src={loadingPhotoUrl} className="w-full h-40 object-cover" alt="Carga" />
                                                            <button onClick={() => setLoadingPhotoUrl('')} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"><X className="w-4 h-4" /></button>
                                                        </div>
                                                        <Button className="w-full bg-green-500 hover:bg-green-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-green-200" onClick={() => updateStatusMutation.mutate({ id: activeTrip.id, status: 'in_progress', photoUrl: loadingPhotoUrl })}>Iniciar Viaje</Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {activeTrip.status === 'in_progress' && (
                                            <div className="space-y-4 p-5 bg-green-50/50 rounded-xl border border-green-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-sm font-bold text-green-900 uppercase tracking-tight">Prueba de Entrega</p>
                                                    {uploadingPhoto.delivery && <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />}
                                                </div>
                                                {!deliveryPhotoUrl ? (
                                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-green-200 rounded-xl bg-white hover:bg-green-50 transition-colors cursor-pointer group">
                                                        <Package className="w-8 h-8 text-green-300 group-hover:text-green-500 mb-2" />
                                                        <span className="text-xs font-bold text-green-400 group-hover:text-green-600">Subir foto de entrega</span>
                                                        <input type="file" onChange={async (e) => { const url = await uploadPhoto(e.target.files[0], 'delivery'); if (url) setDeliveryPhotoUrl(url); }} className="hidden" />
                                                    </label>
                                                ) : (
                                                    <div className="space-y-4">
                                                        <div className="relative rounded-xl overflow-hidden shadow-md">
                                                            <img src={deliveryPhotoUrl} className="w-full h-40 object-cover" alt="Entrega" />
                                                            <button onClick={() => setDeliveryPhotoUrl('')} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"><X className="w-4 h-4" /></button>
                                                        </div>
                                                        <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl shadow-lg shadow-primary/20" onClick={() => { setTripToComplete(activeTrip.id); setConfirmModalOpen(true); }}>Confirmar Entrega</Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {activeTrip && (
                                <Chat tripId={activeTrip.id} receiverName={activeTrip.profiles?.full_name || 'Cliente'} receiverRole="client" />
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-800">Pedidos Disponibles</h3>
                            {pendingTrips.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed rounded-xl text-gray-400">No hay pedidos pendientes para tu tipo de vehículo.</div>
                            ) : (
                                <div className="grid gap-4">
                                    {pendingTrips.map(trip => (
                                        <div key={trip.id} onClick={() => setSelectedTrip(trip)} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:border-primary cursor-pointer transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <span className="text-2xl font-bold">${trip.price}</span>
                                                <span className="bg-gray-100 px-2 py-1 rounded text-[10px] font-bold uppercase">{trip.distance_km} KM</span>
                                            </div>
                                            <div className="space-y-2 text-sm text-gray-600">
                                                <p className="truncate">● {trip.origin_address}</p>
                                                <p className="truncate">● {trip.destination_address}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {viewMode === 'history' && <HistoryTab userId={user.id} role="driver" />}
            {viewMode === 'analytics' && <AnalyticsView userId={user.id} role="driver" />}

            {/* Modals & Profile Edit */}
            {selectedTrip && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b font-bold flex justify-between items-center">
                            Detalles del Pedido
                            <button onClick={() => setSelectedTrip(null)}><X /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg"><p className="text-xs opacity-60">GANANCIA ESTIMADA</p><p className="text-2xl font-bold">${(selectedTrip.price * 0.85).toFixed(0)}</p></div>
                            <div className="space-y-2">
                                <p className="text-sm"><strong>Desde:</strong> {selectedTrip.origin_address}</p>
                                <p className="text-sm"><strong>Hacia:</strong> {selectedTrip.destination_address}</p>
                                <p className="text-sm"><strong>Carga:</strong> <span className="capitalize">{selectedTrip.category}</span></p>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setSelectedTrip(null)}>Volver</Button>
                            <Button className="flex-1" onClick={() => { acceptTripMutation.mutate(selectedTrip.id); setSelectedTrip(null); }} disabled={!isAvailable}>Aceptar Viaje</Button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} onConfirm={handleConfirmComplete} title="¿Confirmar entrega?" message="Se notificará al cliente del fin del viaje." confirmText="Confirmar" type="warning" />
            <RatingModal isOpen={ratingModalOpen} onClose={() => setRatingModalOpen(false)} onSubmit={async (v) => { await apiPost('/api/ratings', { trip_id: justCompletedTrip.id, reviewee_id: justCompletedTrip.user_id, ...v }); setJustCompletedTrip(null); setRatingModalOpen(false); }} title="Calificar Cliente" />

            {editModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Editar Perfil</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                                <input type="text" value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de vehículo</label>
                                <select value={editForm.vehicle_type} onChange={e => setEditForm(f => ({ ...f, vehicle_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                                    <option value="flete_chico">Flete Chico</option>
                                    <option value="flete_mediano">Flete Mediano</option>
                                    <option value="mudancera">Mudancera</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa Base ($)</label>
                                    <input type="number" value={editForm.base_price} onChange={e => setEditForm(f => ({ ...f, base_price: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ej: 3000" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio por KM ($)</label>
                                    <input type="number" value={editForm.price_per_km} onChange={e => setEditForm(f => ({ ...f, price_per_km: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ej: 900" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio Peón ($)</label>
                                    <input type="number" value={editForm.helper_price} onChange={e => setEditForm(f => ({ ...f, helper_price: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ej: 2000" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio Embalaje ($)</label>
                                    <input type="number" value={editForm.packing_price} onChange={e => setEditForm(f => ({ ...f, packing_price: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ej: 1500" />
                                </div>
                            </div>
                            {editError && <p className="text-sm text-red-600">{editError}</p>}
                        </div>
                        <div className="p-6 border-t flex gap-3 justify-end">
                            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
                            <Button onClick={() => saveProfileMutation.mutate(editForm)} disabled={saveProfileMutation.isLoading}>{saveProfileMutation.isLoading ? 'Guardando...' : 'Guardar'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Profile Modal */}
            <UserProfileModal
                isOpen={userProfileOpen}
                onClose={() => setUserProfileOpen(false)}
                userId={user.id}
                profile={profile}
            />
        </div>
    );
};

export default DriverDashboard;
