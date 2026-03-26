import { useState, useEffect, useRef } from 'react';
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

const DriverDashboard = () => {
    const { user, profile, updateProfileLocal } = useAuth();
    const queryClient = useQueryClient();

    // --- Local UI State ---
    const [viewMode, setViewMode] = useState('home');
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
            <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border shadow-sm w-fit mx-auto sm:mx-0">
                <button onClick={() => setViewMode('home')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'home' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <Home className="w-4 h-4" /> Inicio
                </button>
                <button onClick={() => setViewMode('history')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'history' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <History className="w-4 h-4" /> Historial
                </button>
                <button onClick={() => setViewMode('analytics')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'analytics' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <PieChart className="w-4 h-4" /> Estadísticas
                </button>
            </div>

            {viewMode === 'home' && (
                <>
                    <div className="bg-white p-6 rounded-xl shadow-md border flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-gray-900">Panel de Chofer</h1>
                                <button onClick={openEditModal} className="p-1 text-gray-400 hover:text-primary"><Pencil className="w-4 h-4" /></button>
                            </div>
                            <p className="text-gray-500 text-sm">Vehículo: <span className="uppercase font-bold">{profile?.vehicle_type}</span></p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase">Hoy</p>
                                <p className="text-xl font-bold text-green-600">${earnings.toFixed(0)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-sm font-medium ${isAvailable ? 'text-green-600' : 'text-gray-400'}`}>{isAvailable ? 'En línea' : 'Desconectado'}</span>
                                <button onClick={() => toggleAvailabilityMutation.mutate(!isAvailable)} className={`relative h-6 w-11 rounded-full transition-colors ${isAvailable ? 'bg-green-500' : 'bg-gray-200'}`}>
                                    <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${isAvailable ? 'translate-x-5' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {activeTrip ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-primary p-6 rounded-xl shadow-lg text-white animate-fade-in space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-bold">Viaje en curso</h2>
                                        <p className="text-primary-foreground/80">Cliente: {activeTrip.profiles?.full_name || 'Particular'}</p>
                                    </div>
                                    <div className="bg-white/20 px-3 py-1 rounded-lg text-xl font-bold">${activeTrip.price}</div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex gap-3"><MapPin className="w-5 h-5 opacity-70" /> <div><p className="text-[10px] uppercase opacity-70">Origen</p><p className="font-medium">{activeTrip.origin_address}</p></div></div>
                                    <div className="flex gap-3"><Navigation className="w-5 h-5 opacity-70" /> <div><p className="text-[10px] uppercase opacity-70">Destino</p><p className="font-medium">{activeTrip.destination_address}</p></div></div>
                                </div>

                                {activeTrip.status === 'driver_pending' ? (
                                    <div className="bg-white/10 p-4 rounded-lg border border-white/20 text-center animate-pulse font-bold">Esperando confirmación del cliente...</div>
                                ) : (
                                    <div className="space-y-4">
                                        {activeTrip.status === 'accepted' && (
                                            <Button className="w-full bg-white text-primary hover:bg-white/90 font-bold" onClick={() => updateStatusMutation.mutate({ id: activeTrip.id, status: 'loading' })}>Llegué al origen / Cargar</Button>
                                        )}
                                        {activeTrip.status === 'loading' && (
                                            <div className="space-y-4 bg-white/10 p-4 rounded-lg">
                                                <p className="text-sm font-bold">Prueba de Carga</p>
                                                {!loadingPhotoUrl ? (
                                                    <input type="file" onChange={async (e) => { const url = await uploadPhoto(e.target.files[0], 'loading'); if (url) setLoadingPhotoUrl(url); }} className="text-xs" />
                                                ) : (
                                                    <div className="space-y-3">
                                                        <img src={loadingPhotoUrl} className="h-24 rounded-lg" alt="Carga" />
                                                        <Button className="w-full bg-green-500 hover:bg-green-600" onClick={() => updateStatusMutation.mutate({ id: activeTrip.id, status: 'in_progress', photoUrl: loadingPhotoUrl })}>Iniciar Viaje</Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {activeTrip.status === 'in_progress' && (
                                            <div className="space-y-4 bg-white/10 p-4 rounded-lg">
                                                <p className="text-sm font-bold">Prueba de Entrega</p>
                                                {!deliveryPhotoUrl ? (
                                                    <input type="file" onChange={async (e) => { const url = await uploadPhoto(e.target.files[0], 'delivery'); if (url) setDeliveryPhotoUrl(url); }} className="text-xs" />
                                                ) : (
                                                    <div className="space-y-3">
                                                        <img src={deliveryPhotoUrl} className="h-24 rounded-lg" alt="Entrega" />
                                                        <Button className="w-full bg-white text-primary hover:bg-white/90" onClick={() => { setTripToComplete(activeTrip.id); setConfirmModalOpen(true); }}>Confirmar Entrega</Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {activeTrip.status !== 'driver_pending' && (
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
                            {editError && <p className="text-sm text-red-600">{editError}</p>}
                        </div>
                        <div className="p-6 border-t flex gap-3 justify-end">
                            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
                            <Button onClick={() => saveProfileMutation.mutate(editForm)} disabled={saveProfileMutation.isLoading}>{saveProfileMutation.isLoading ? 'Guardando...' : 'Guardar'}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverDashboard;
