import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Truck, DollarSign, Clock, Navigation, Package, Camera, ArrowRight, X, Pencil, History, PieChart, Home, Search, Star } from 'lucide-react';
import { supabase } from '../services/supabase';
import { apiGet, apiPost, apiDelete } from '../services/api';
import RatingModal from '../components/RatingModal';
import ServiceCheckbox from '../components/ServiceCheckbox';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import useDebounce from '../hooks/useDebounce';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtime } from '../hooks/useRealtime';
import { Button } from '../components/ui/button';
import Chat from '../components/Chat';
import HistoryTab from '../components/HistoryTab';
import AnalyticsView from '../components/AnalyticsView';
import DriverProfileModal from '../components/DriverProfileModal';
import { MessageCircle, User as UserIcon } from 'lucide-react';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MapUpdater = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords.origin && coords.destination) {
            const bounds = L.latLngBounds([[coords.origin.lat, coords.origin.lon], [coords.destination.lat, coords.destination.lon]]);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (coords.origin) {
            map.setView([coords.origin.lat, coords.origin.lon], 13);
        } else if (coords.destination) {
            map.setView([coords.destination.lat, coords.destination.lon], 13);
        }
    }, [coords, map]);
    return null;
};

const UserLocationMarker = ({ position }) => {
    const map = useMap();
    useEffect(() => {
        if (position) map.panTo(position);
    }, [position, map]);
    return position ? <Marker position={position} icon={userLocationIcon}><Popup>Tu ubicación actual</Popup></Marker> : null;
};

const userLocationIcon = new L.DivIcon({
    html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>',
    className: 'user-location-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

const UserDashboard = () => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();

    // --- State ---
    const [viewMode, setViewMode] = useState('home');
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [originCoords, setOriginCoords] = useState(null);
    const [destinationCoords, setDestinationCoords] = useState(null);
    const [distanceKm, setDistanceKm] = useState('');
    const [category, setCategory] = useState('general');
    const [photoUrl, setPhotoUrl] = useState('');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [vehicleType, setVehicleType] = useState('flete_chico');
    const [selectedServices, setSelectedServices] = useState([]);
    const [originSuggestions, setOriginSuggestions] = useState([]);
    const [destinationSuggestions, setDestinationSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState({ origin: false, destination: false });
    const [routePoints, setRoutePoints] = useState([]);
    const [searchCity, setSearchCity] = useState('');
    const [editingCity, setEditingCity] = useState(false);
    const [cityInput, setCityInput] = useState('');
    const [mapCenter, setMapCenter] = useState([-34.6037, -58.3816]);
    const [loadingPrice, setLoadingPrice] = useState(false);
    const [calculatedPrice, setCalculatedPrice] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [justCompletedTrip, setJustCompletedTrip] = useState(null);
    const [pendingDriverProfiles, setPendingDriverProfiles] = useState({});

    // --- Driver Selection State ---
    const [selectedManualDriver, setSelectedManualDriver] = useState(null);
    const [searchDriverQuery, setSearchDriverQuery] = useState('');
    const [isSearchingDrivers, setIsSearchingDrivers] = useState(false);
    const [driverSearchResults, setDriverSearchResults] = useState([]);

    // --- Modal States ---
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [chatModalOpen, setChatModalOpen] = useState(false);
    const [selectedDriverId, setSelectedDriverId] = useState(null);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [activeRoutePoints, setActiveRoutePoints] = useState([]);

    const debouncedOrigin = useDebounce(origin, 300);
    const debouncedDestination = useDebounce(destination, 300);

    // --- Data Queries ---
    const { data: myTrips = [] } = useQuery({
        queryKey: ['trips', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('trips').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    useRealtime('trips', `user_id=eq.${user?.id}`, ['trips', user?.id]);

    const { data: availableDrivers = [] } = useQuery({
        queryKey: ['availableDrivers'],
        queryFn: async () => {
            const { data, error } = await supabase.from('profiles').select('id, full_name, vehicle_type, driver_lat, driver_lon').eq('is_available', true).eq('role', 'driver').not('driver_lat', 'is', null).not('driver_lon', 'is', null);
            if (error) throw error;
            return data;
        },
        refetchInterval: 30000,
    });

    const { data: knownDrivers = [] } = useQuery({
        queryKey: ['knownDrivers'],
        queryFn: () => apiGet('/api/drivers/known').then(res => res.json()),
        enabled: !!user,
    });

    // --- Mutations ---
    const cancelTripMutation = useMutation({
        mutationFn: (id) => apiDelete(`/api/trips/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
    });

    const confirmDriverMutation = useMutation({
        mutationFn: (id) => apiPost(`/api/trips/${id}/confirm_driver`, {}),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
    });

    const rejectDriverMutation = useMutation({
        mutationFn: (id) => apiPost(`/api/trips/${id}/reject_driver`, {}),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
    });

    const createTripMutation = useMutation({
        mutationFn: (data) => apiPost('/api/trips/create', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trips'] });
            setSuccess('¡Pedido creado con éxito! Esperando un chofer...');
            setTimeout(() => {
                setSuccess('');
                setViewMode('home');
                setOrigin(''); setDestination(''); setOriginCoords(null); setDestinationCoords(null);
                setRoutePoints([]); setDistanceKm(''); setCalculatedPrice(null); setSelectedServices([]); setPhotoUrl('');
                setSelectedManualDriver(null);
            }, 3000);
        },
        onError: () => setError('Error al crear el pedido. Intente nuevamente.'),
    });

    // Detect user location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude, longitude } = pos.coords;
                setMapCenter([latitude, longitude]);
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
                    const data = await res.json();
                    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || '';
                    if (city) setSearchCity(city);
                } catch (_) { }
            });
        }
    }, []);

    // Watch for completed trips to show rating modal
    const prevTripsRef = useRef(null);
    useEffect(() => {
        // Skip first load to avoid showing modal for old completed trips
        if (prevTripsRef.current === null) {
            prevTripsRef.current = myTrips;
            return;
        }

        const newlyCompleted = myTrips.find(t =>
            t.status === 'completed' &&
            !t.client_rated &&
            !prevTripsRef.current.find(oldT => oldT.id === t.id && oldT.status === 'completed')
        );

        if (newlyCompleted) {
            setJustCompletedTrip(newlyCompleted);
            setRatingModalOpen(true);
        }
        prevTripsRef.current = myTrips;

        // Fetch driver profiles for pending approvals
        const pendingTrips = myTrips.filter(t => t.status === 'driver_pending' && t.driver_id);
        if (pendingTrips.length > 0) {
            const driverIds = [...new Set(pendingTrips.map(t => t.driver_id))];
            supabase.from('profiles').select('*').in('id', driverIds).then(({ data }) => {
                if (data) {
                    const profMap = {};
                    data.forEach(d => profMap[d.id] = d);
                    setPendingDriverProfiles(profMap);
                }
            });
        }
    }, [myTrips]);

    useEffect(() => {
        const active = myTrips.find(t => ['accepted', 'loading', 'in_progress'].includes(t.status));
        if (!active || !active.origin_lat || !active.destination_lat) {
            setActiveRoutePoints([]);
            return;
        }

        const fetchRoute = async () => {
            try {
                const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${active.origin_lon},${active.origin_lat};${active.destination_lon},${active.destination_lat}?overview=full&geometries=geojson`);
                const data = await r.json();
                if (data.routes?.[0]) {
                    setActiveRoutePoints(data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]));
                }
            } catch (_) { }
        };
        fetchRoute();
    }, [myTrips.find(t => ['accepted', 'loading', 'in_progress'].includes(t.status))?.id]);

    useEffect(() => { fetchSuggestions(debouncedOrigin, 'origin'); }, [debouncedOrigin]);
    useEffect(() => { fetchSuggestions(debouncedDestination, 'destination'); }, [debouncedDestination]);

    const formatSuggestion = (s) => {
        const a = s.address || {};
        const parts = [a.road || a.pedestrian || a.footway, a.house_number, a.suburb || a.neighbourhood, a.city || a.town].filter(Boolean);
        return parts.length > 1 ? parts.join(', ') : s.display_name;
    };

    const fetchSuggestions = async (query, type) => {
        if (query.length < 3) {
            type === 'origin' ? setOriginSuggestions([]) : setDestinationSuggestions([]);
            return;
        }
        const biasedQuery = searchCity ? `${query}, ${searchCity}` : query;
        setLoadingSuggestions(prev => ({ ...prev, [type]: true }));
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(biasedQuery)}&countrycodes=ar&limit=5&addressdetails=1`);
            const data = await r.json();
            type === 'origin' ? setOriginSuggestions(data) : setDestinationSuggestions(data);
        } catch (_) { } finally { setLoadingSuggestions(prev => ({ ...prev, [type]: false })); }
    };

    const calculateRouteDistance = async (start, end) => {
        try {
            const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`);
            const data = await r.json();
            if (data.routes?.[0]) {
                setDistanceKm((data.routes[0].distance / 1000).toFixed(1));
                setRoutePoints(data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]));
            }
        } catch (_) { }
    };

    const handleSelectSuggestion = (suggestion, type) => {
        const label = formatSuggestion(suggestion);
        const coords = { lat: suggestion.lat, lon: suggestion.lon };
        if (type === 'origin') {
            setOrigin(label); setOriginCoords(coords); setOriginSuggestions([]);
            if (destinationCoords) calculateRouteDistance(coords, destinationCoords);
        } else {
            setDestination(label); setDestinationCoords(coords); setDestinationSuggestions([]);
            if (originCoords) calculateRouteDistance(originCoords, coords);
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingPhoto(true);
        try {
            const filePath = `${user.id}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
            const { error } = await supabase.storage.from('fletea-images').upload(filePath, file);
            if (error) throw error;
            setPhotoUrl(supabase.storage.from('fletea-images').getPublicUrl(filePath).data.publicUrl);
        } catch (_) { alert('Error al subir imagen'); } finally { setUploadingPhoto(false); }
    };

    const handleSearchDrivers = async (query) => {
        if (query.length < 3) {
            setDriverSearchResults([]);
            return;
        }
        setIsSearchingDrivers(true);
        try {
            const res = await apiGet(`/api/drivers/search?query=${encodeURIComponent(query)}`);
            const data = await res.json();
            setDriverSearchResults(data);
        } catch (_) { } finally { setIsSearchingDrivers(false); }
    };

    const handleCalculatePrice = async () => {
        if (!distanceKm) return;
        setLoadingPrice(true);
        try {
            const r = await apiPost('/api/trips/calculate-price', { distance_km: parseFloat(distanceKm), vehicle_type: vehicleType, services: selectedServices });
            const data = await r.json();
            if (data.price) setCalculatedPrice(data.price);
        } catch (_) { } finally { setLoadingPrice(false); }
    };

    const handleCreateTrip = () => {
        createTripMutation.mutate({
            origin_address: origin, destination_address: destination,
            origin_lat: originCoords.lat, origin_lon: originCoords.lon,
            destination_lat: destinationCoords.lat, destination_lon: destinationCoords.lon,
            distance_km: parseFloat(distanceKm),
            vehicle_type: vehicleType, price: calculatedPrice, category, photos: photoUrl ? [photoUrl] : [], services: selectedServices,
            driver_id: selectedManualDriver?.id
        });
    };

    const submitRating = async ({ rating, comment }) => {
        if (!justCompletedTrip?.driver_id) return;
        try {
            await apiPost('/api/ratings', { trip_id: justCompletedTrip.id, reviewee_id: justCompletedTrip.driver_id, rating, comment });
            setJustCompletedTrip(null); setRatingModalOpen(false);
        } catch (_) { }
    };

    const renderVehicleOption = (type, label, description) => (
        <div onClick={() => setVehicleType(type)} className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${vehicleType === type ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/20'}`}>
            <div className="flex items-center justify-between mb-2">
                <Truck className={`w-8 h-8 ${vehicleType === type ? 'text-primary' : 'text-gray-400'}`} />
                {vehicleType === type && <div className="w-4 h-4 rounded-full bg-primary" />}
            </div>
            <h3 className={`font-bold ${vehicleType === type ? 'text-primary' : 'text-gray-700'}`}>{label}</h3>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
    );

    const STATUS_LABELS = { pending: 'Pendiente', driver_pending: 'Esperando Confirmación', accepted: 'En Camino', loading: 'Cargando', in_progress: 'En Viaje', completed: 'Finalizado', cancelled: 'Cancelado' };
    const STATUS_COLORS = { pending: 'bg-gray-100 text-gray-700', driver_pending: 'bg-yellow-200 text-yellow-800', accepted: 'bg-blue-100 text-blue-700', loading: 'bg-indigo-100 text-indigo-700', in_progress: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500' };

    return (
        <div className="relative min-h-[calc(100vh-100px)] pb-10">
            {/* Top Navigation Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Hola, {profile?.full_name?.split(' ')[0] || 'Usuario'} 👋</h1>
                    <p className="text-gray-500 text-sm">¿A dónde enviamos tu flete hoy?</p>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border shadow-sm w-fit">
                    <Button
                        variant={viewMode === 'home' || viewMode === 'requesting' ? 'default' : 'ghost'}
                        onClick={() => setViewMode('home')}
                        className={`gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'home' || viewMode === 'requesting' ? '' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Truck className="w-4 h-4" /> Pedir Flete
                    </Button>
                    <Button
                        variant={viewMode === 'history' ? 'default' : 'ghost'}
                        onClick={() => setViewMode('history')}
                        className={`gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'history' ? '' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <History className="w-4 h-4" /> Mis Pedidos
                    </Button>
                    <Button
                        variant={viewMode === 'analytics' ? 'default' : 'ghost'}
                        onClick={() => setViewMode('analytics')}
                        className={`gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'analytics' ? '' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <PieChart className="w-4 h-4" /> Mi Actividad
                    </Button>
                </div>
            </div>

            {viewMode === 'home' && (
                <div className="space-y-6">
                    <div className="relative h-[60vh] w-full rounded-2xl overflow-hidden shadow-xl border border-gray-200">
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-sm px-4">
                            <Button onClick={() => setViewMode('requesting')} className="w-full h-14 text-lg font-bold rounded-2xl shadow-2xl transform transition active:scale-95 gap-3 bg-blue-600 hover:bg-blue-700 text-white border-2 border-white/20 backdrop-blur-sm">
                                <Truck className="w-6 h-6" /> Pedir Flete Ahora
                            </Button>
                        </div>
                        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <UserLocationMarker position={mapCenter} />
                            {availableDrivers.map(d => (
                                <Marker key={d.id} position={[d.driver_lat, d.driver_lon]}><Popup>{d.full_name} - {d.vehicle_type}</Popup></Marker>
                            ))}
                        </MapContainer>
                        {searchCity && (
                            <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md border border-gray-200 flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-bold text-gray-700 capitalize">{searchCity}</span>
                            </div>
                        )}
                    </div>

                    {(() => {
                        const active = myTrips.find(t => ['accepted', 'loading', 'in_progress'].includes(t.status));
                        if (!active) return null;
                        return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden flex flex-col">
                                    <div className="flex items-center justify-between px-4 py-3 bg-blue-50">
                                        <h3 className="font-semibold text-blue-900">Seguimiento en vivo</h3>
                                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${STATUS_COLORS[active.status]}`}>{STATUS_LABELS[active.status]}</span>
                                    </div>
                                    <div style={{ height: '320px' }} className="relative">
                                        <MapContainer
                                            center={active.driver_lat ? [active.driver_lat, active.driver_lon] : [active.origin_lat, active.origin_lon]}
                                            zoom={13}
                                            style={{ height: '100%', width: '100%' }}
                                            zoomControl={false}
                                        >
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                                            {/* Marcadores de origen y destino */}
                                            {active.origin_lat && <Marker position={[active.origin_lat, active.origin_lon]}><Popup>Origen</Popup></Marker>}
                                            {active.destination_lat && <Marker position={[active.destination_lat, active.destination_lon]}><Popup>Destino</Popup></Marker>}

                                            {/* Ruta del viaje */}
                                            {activeRoutePoints.length > 0 && <Polyline pathOptions={{ color: '#2563eb', weight: 4, dashArray: '10, 10' }} positions={activeRoutePoints} />}

                                            {/* Ubicación del chofer */}
                                            {active.driver_lat && (
                                                <Marker position={[active.driver_lat, active.driver_lon]}>
                                                    <Popup>Tu chofer está aquí</Popup>
                                                </Marker>
                                            )}

                                            {/* Centrar el mapa automáticamente si cambia la ubicación */}
                                            <MapUpdater coords={{
                                                origin: { lat: active.driver_lat || active.origin_lat, lon: active.driver_lon || active.origin_lon },
                                                destination: { lat: active.destination_lat, lon: active.destination_lon }
                                            }} />
                                        </MapContainer>

                                        {!active.driver_lat && (
                                            <div className="absolute inset-0 z-[1001] bg-white/40 backdrop-blur-[1px] flex items-center justify-center p-6 text-center">
                                                <div className="bg-white/90 p-4 rounded-xl shadow-lg border border-blue-100 flex flex-col items-center gap-3">
                                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                    <p className="text-sm font-bold text-gray-800">Conectando con el chofer...</p>
                                                    <p className="text-[10px] text-gray-500">Muestra la ruta teórica mientras esperamos señal de GPS.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Chat tripId={active.id} receiverName="Tu Chofer" receiverRole="driver" />
                            </div>
                        );
                    })()}

                    {myTrips.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 mb-4 px-2">Mis Pedidos Recientes</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {myTrips.slice(0, 3).map(trip => (
                                    <div key={trip.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[trip.status]}`}>{STATUS_LABELS[trip.status]}</span>
                                            <span className="text-gray-500 font-bold">${trip.price}</span>
                                        </div>
                                        <div className="space-y-2 text-sm text-gray-600 mb-3">
                                            <div className="flex items-center gap-2 truncate"><div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /><span className="truncate">{trip.origin_address}</span></div>
                                            <div className="flex items-center gap-2 truncate"><div className="w-2 h-2 rounded-full bg-red-500 shrink-0" /><span className="truncate">{trip.destination_address}</span></div>
                                        </div>
                                        {trip.status === 'pending' && (
                                            <Button variant="outline" size="sm" onClick={() => cancelTripMutation.mutate(trip.id)} className="w-full text-red-500 border-red-100 hover:bg-red-50">Cancelar pedido</Button>
                                        )}
                                        {trip.status === 'driver_pending' && (
                                            <div className="mt-3 bg-yellow-50 p-3 rounded border border-yellow-200">
                                                <p className="text-xs font-bold text-yellow-800 mb-2">¡Chofer Encontrado!</p>
                                                {pendingDriverProfiles[trip.driver_id] && <p className="text-xs text-yellow-700 mb-3">Chofer: <span className="font-semibold">{pendingDriverProfiles[trip.driver_id].full_name}</span></p>}
                                                <div className="flex gap-2 mb-3">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex-1 bg-white border-yellow-200 text-yellow-800 hover:bg-yellow-100 gap-1.5"
                                                        onClick={() => {
                                                            setSelectedDriverId(trip.driver_id);
                                                            setProfileModalOpen(true);
                                                        }}
                                                    >
                                                        <UserIcon className="w-3.5 h-3.5" /> Perfil
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex-1 bg-white border-yellow-200 text-yellow-800 hover:bg-yellow-100 gap-1.5"
                                                        onClick={() => {
                                                            setSelectedTrip(trip);
                                                            setChatModalOpen(true);
                                                        }}
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5" /> Mensaje
                                                    </Button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" className="flex-1 bg-green-500 hover:bg-green-600" onClick={() => confirmDriverMutation.mutate(trip.id)}>Aceptar</Button>
                                                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => rejectDriverMutation.mutate(trip.id)}>Rechazar</Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {viewMode === 'requesting' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-7 space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => setViewMode('home')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowRight className="w-6 h-6 rotate-180 text-gray-600" /></button>
                            <h1 className="text-2xl font-bold text-gray-900">Configura tu Flete</h1>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Navigation className="w-4 h-4 text-primary" /> Ruta</h3>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <MapPin className="w-3 h-3" /> <span>Ciudad:</span>
                                    {editingCity ? (
                                        <div className="flex items-center gap-1">
                                            <input type="text" value={cityInput} onChange={(e) => setCityInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setSearchCity(cityInput.trim()); setEditingCity(false); } }} className="border rounded px-2 py-0.5 text-xs w-28" autoFocus />
                                            <Button size="sm" onClick={() => { setSearchCity(cityInput.trim()); setEditingCity(false); }}>OK</Button>
                                        </div>
                                    ) : (
                                        <button onClick={() => { setCityInput(searchCity); setEditingCity(true); }} className="flex items-center gap-1 font-semibold text-primary">{searchCity || 'Detectando...'} <Pencil className="w-3 h-3" /></button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-green-600" />
                                    <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg outline-none" placeholder="¿Dónde retiramos?" />
                                    {loadingSuggestions.origin && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Buscando...</span>}
                                    {originSuggestions.length > 0 && (
                                        <ul className="absolute z-50 w-full bg-white border rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                                            {originSuggestions.map((s, i) => <li key={i} onClick={() => handleSelectSuggestion(s, 'origin')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm">{formatSuggestion(s)}</li>)}
                                        </ul>
                                    )}
                                </div>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-red-600" />
                                    <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg outline-none" placeholder="¿Dónde entregamos?" />
                                    {loadingSuggestions.destination && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Buscando...</span>}
                                    {destinationSuggestions.length > 0 && (
                                        <ul className="absolute z-50 w-full bg-white border rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                                            {destinationSuggestions.map((s, i) => <li key={i} onClick={() => handleSelectSuggestion(s, 'destination')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm">{formatSuggestion(s)}</li>)}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Carga</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none">
                                    <option value="general">Cargas Generales</option><option value="furniture">Muebles</option><option value="small_move">Mudanza Pequeña</option>
                                </select>
                                <div className="relative flex items-center border rounded-lg px-3 py-2">
                                    <Camera className="w-5 h-5 text-gray-400 mr-2" />
                                    <input type="file" onChange={handlePhotoUpload} className="text-xs file:hidden w-full cursor-pointer" />
                                    {uploadingPhoto && <span className="text-[10px] text-primary">Subiendo...</span>}
                                    {photoUrl && <span className="text-[10px] text-green-600">¡OK!</span>}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> Vehículo</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {renderVehicleOption('flete_chico', 'Utilitario', 'Kangoo / Partner')}
                                {renderVehicleOption('flete_mediano', 'Camioneta', 'Hilux / S10')}
                                {renderVehicleOption('mudancera', 'Camión', 'Mudanzas')}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Servicios</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <ServiceCheckbox label="Ayuda Peón" price="2000" checked={selectedServices.includes('helper')} onChange={() => setSelectedServices(p => p.includes('helper') ? p.filter(i => i !== 'helper') : [...p, 'helper'])} />
                                <ServiceCheckbox label="Embalaje" price="1500" checked={selectedServices.includes('packing')} onChange={() => setSelectedServices(p => p.includes('packing') ? p.filter(i => i !== 'packing') : [...p, 'packing'])} />
                            </div>
                        </div>

                        {/* Selección de Fletero */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Star className="w-4 h-4 text-yellow-500" /> Fletero Preferido (Opcional)
                            </h3>

                            {selectedManualDriver ? (
                                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center overflow-hidden">
                                            <UserIcon className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-blue-900">{selectedManualDriver.full_name}</p>
                                            <p className="text-xs text-blue-700 capitalize">{selectedManualDriver.vehicle_type?.replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedManualDriver(null)}
                                        className="p-2 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar fletero por nombre..."
                                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                                            value={searchDriverQuery}
                                            onChange={(e) => {
                                                setSearchDriverQuery(e.target.value);
                                                handleSearchDrivers(e.target.value);
                                            }}
                                        />
                                        {isSearchingDrivers && <div className="absolute right-3 top-2.5 text-[10px] text-gray-400">Buscando...</div>}
                                    </div>

                                    {(driverSearchResults.length > 0 || knownDrivers.length > 0) && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-gray-500 uppercase px-1">
                                                {searchDriverQuery.length >= 3 ? 'Resultados de búsqueda' : 'Fleteros conocidos'}
                                            </p>
                                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                                {(searchDriverQuery.length >= 3 ? driverSearchResults : knownDrivers).map(d => (
                                                    <div
                                                        key={d.id}
                                                        onClick={() => {
                                                            setSelectedManualDriver(d);
                                                            setSearchDriverQuery('');
                                                            setDriverSearchResults([]);
                                                        }}
                                                        className="flex-shrink-0 w-40 p-3 bg-gray-50 border border-gray-100 rounded-xl hover:border-primary/40 cursor-pointer transition-all active:scale-95"
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-gray-200 mb-2 flex items-center justify-center overflow-hidden mx-auto relative">
                                                            <UserIcon className="w-5 h-5 text-gray-400" />
                                                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${d.is_available ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                        </div>
                                                        <p className="text-xs font-bold text-gray-700 text-center truncate">{d.full_name}</p>
                                                        <p className="text-[10px] text-gray-500 text-center capitalize">{d.vehicle_type?.replace('_', ' ')}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {searchDriverQuery.length < 3 && knownDrivers.length === 0 && (
                                        <p className="text-xs text-gray-400 text-center py-2">No tienes fleteros conocidos guardados aún.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-5 space-y-6 text-white">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[300px] relative z-0">
                            <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                {originCoords && <Marker position={[originCoords.lat, originCoords.lon]}><Popup>Origen</Popup></Marker>}
                                {destinationCoords && <Marker position={[destinationCoords.lat, destinationCoords.lon]}><Popup>Destino</Popup></Marker>}
                                {routePoints.length > 0 && <Polyline pathOptions={{ color: '#2563eb', weight: 4 }} positions={routePoints} />}
                                <MapUpdater coords={{ origin: originCoords, destination: destinationCoords }} />
                            </MapContainer>
                        </div>
                        <div className="bg-blue-900 p-6 rounded-2xl shadow-xl space-y-6">
                            <h2 className="text-xl font-bold">Resumen</h2>
                            <div className="bg-white/10 p-4 rounded-xl">
                                <p className="text-xs text-blue-200 mb-1">TOTAL ESTIMADO</p>
                                <span className="text-3xl font-bold">{calculatedPrice ? `$${calculatedPrice}` : '---'}</span>
                            </div>
                            {!calculatedPrice ? (
                                <Button className="w-full h-14 bg-white text-blue-900 hover:bg-blue-50 font-bold" onClick={handleCalculatePrice} disabled={!distanceKm || loadingPrice}>
                                    {loadingPrice ? 'Calculando...' : 'Cotizar Precio'}
                                </Button>
                            ) : (
                                <Button className="w-full h-14 bg-green-500 hover:bg-green-600 font-bold" onClick={handleCreateTrip} disabled={createTripMutation.isLoading}>
                                    {createTripMutation.isLoading ? 'Enviando...' : 'Confirmar Pedido'}
                                </Button>
                            )}
                            {error && <p className="text-red-300 text-sm text-center">{error}</p>}
                            {success && <p className="text-green-300 text-sm text-center">{success}</p>}
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'history' && <HistoryTab userId={user.id} role="user" />}
            {viewMode === 'analytics' && <AnalyticsView userId={user.id} role="user" />}

            <RatingModal isOpen={ratingModalOpen} onClose={() => setRatingModalOpen(false)} onSubmit={submitRating} title="Calificar Chofer" />

            {/* Driver Profile Modal */}
            <DriverProfileModal
                isOpen={profileModalOpen}
                onClose={() => setProfileModalOpen(false)}
                driverId={selectedDriverId}
            />

            {/* Pre-acceptance Chat Modal */}
            {chatModalOpen && selectedTrip && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-bold text-gray-800">Chat con {pendingDriverProfiles[selectedTrip.driver_id]?.full_name || 'Chofer'}</h3>
                            <button onClick={() => setChatModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <Chat
                                tripId={selectedTrip.id}
                                receiverName={pendingDriverProfiles[selectedTrip.driver_id]?.full_name || 'Chofer'}
                                receiverRole="driver"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDashboard;
