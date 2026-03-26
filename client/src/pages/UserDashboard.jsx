import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Truck, DollarSign, Clock, Navigation, Package, Camera, ArrowRight, X, Pencil } from 'lucide-react';
import { supabase } from '../services/supabase';
import { apiGet, apiPost, apiDelete } from '../services/api';
import RatingModal from '../components/RatingModal';
import ServiceCheckbox from '../components/ServiceCheckbox';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import useDebounce from '../hooks/useDebounce';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const userLocationIcon = new L.DivIcon({
    html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>',
    className: 'user-location-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

// Helper component to update map view
const MapUpdater = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords.origin && coords.destination) {
            const bounds = L.latLngBounds([
                [coords.origin.lat, coords.origin.lon],
                [coords.destination.lat, coords.destination.lon]
            ]);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (coords.origin) {
            map.setView([coords.origin.lat, coords.origin.lon], 13);
        } else if (coords.destination) {
            map.setView([coords.destination.lat, coords.destination.lon], 13);
        }
    }, [coords, map]);
    return null;
};

// Component to show and follow user's location
const UserLocationMarker = ({ position }) => {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.panTo(position);
        }
    }, [position, map]);

    return position ? (
        <Marker position={position} icon={userLocationIcon}>
            <Popup>Tu ubicación actual</Popup>
        </Marker>
    ) : null;
};

const UserDashboard = () => {
    const { user } = useAuth();

    // Mode: 'home' | 'requesting'
    const [viewMode, setViewMode] = useState('home');

    // Form State
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [originCoords, setOriginCoords] = useState(null);
    const [destinationCoords, setDestinationCoords] = useState(null);
    const [distanceKm, setDistanceKm] = useState('');

    // New Form State
    const [category, setCategory] = useState('general');
    const [photoUrl, setPhotoUrl] = useState('');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [vehicleType, setVehicleType] = useState('flete_chico');
    const [selectedServices, setSelectedServices] = useState([]);

    // Autocomplete State (debounced to avoid hammering Nominatim)
    const [originSuggestions, setOriginSuggestions] = useState([]);
    const [destinationSuggestions, setDestinationSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState({ origin: false, destination: false });
    const [routePoints, setRoutePoints] = useState([]);

    // City reference for address search
    const [searchCity, setSearchCity] = useState('');
    const [editingCity, setEditingCity] = useState(false);
    const [cityInput, setCityInput] = useState('');

    const debouncedOrigin = useDebounce(origin, 300);
    const debouncedDestination = useDebounce(destination, 300);

    // Map center — defaults to Buenos Aires, updates to user's location
    const [mapCenter, setMapCenter] = useState([-34.6037, -58.3816]);

    // UI State
    const [calculatedPrice, setCalculatedPrice] = useState(null);
    const [loadingPrice, setLoadingPrice] = useState(false);
    const [creatingTrip, setCreatingTrip] = useState(false);
    const [myTrips, setMyTrips] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [justCompletedTrip, setJustCompletedTrip] = useState(null);
    const [availableDrivers, setAvailableDrivers] = useState([]);
    const [pendingDriverProfiles, setPendingDriverProfiles] = useState({});
    const initialFetchDone = useRef(false);

    // Detect user location for map center and city reference
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    setMapCenter([latitude, longitude]);
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
                        const data = await res.json();
                        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || '';
                        if (city) setSearchCity(city);
                    } catch (_) { }
                },
                () => { } // fallback to default Buenos Aires
            );
        }
    }, []);

    // Fetch trips
    useEffect(() => {
        if (user) fetchTrips();

        const channel = supabase
            .channel('my_trips')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'trips',
                filter: `user_id=eq.${user?.id}`
            }, () => {
                fetchTrips();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const fetchTrips = async () => {
        const { data } = await supabase
            .from('trips')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) {
            if (initialFetchDone.current) {
                const completedTrip = data.find(t => t.status === 'completed' && !myTrips.find(oldT => oldT.id === t.id && oldT.status === 'completed'));
                if (completedTrip && !justCompletedTrip) {
                    setJustCompletedTrip(completedTrip);
                    setRatingModalOpen(true);
                }
            }
            initialFetchDone.current = true;

            // Fetch driver profiles for pending approvals
            const pendingTrips = data.filter(t => t.status === 'driver_pending' && t.driver_id);
            if (pendingTrips.length > 0) {
                const driverIds = [...new Set(pendingTrips.map(t => t.driver_id))];
                const { data: drivers } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', driverIds);
                if (drivers) {
                    const profMap = {};
                    drivers.forEach(d => profMap[d.id] = d);
                    setPendingDriverProfiles(profMap);
                }
            }

            setMyTrips(data);
        }
    };

    // Fetch available drivers directly from Supabase (public query, no auth needed)
    useEffect(() => {
        const fetchDrivers = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, vehicle_type, driver_lat, driver_lon')
                    .eq('is_available', true)
                    .eq('role', 'driver')
                    .not('driver_lat', 'is', null)
                    .not('driver_lon', 'is', null);
                if (!error && data) setAvailableDrivers(data);
            } catch (err) {
                console.error('Error fetching drivers:', err);
            }
        };
        fetchDrivers();
        const interval = setInterval(fetchDrivers, 30000);
        return () => clearInterval(interval);
    }, []);

    // Autocomplete with debounce
    useEffect(() => {
        fetchSuggestions(debouncedOrigin, 'origin');
    }, [debouncedOrigin]);

    useEffect(() => {
        fetchSuggestions(debouncedDestination, 'destination');
    }, [debouncedDestination]);

    const formatSuggestion = (s) => {
        const a = s.address || {};
        const parts = [
            a.road || a.pedestrian || a.footway || a.path,
            a.house_number,
            a.suburb || a.neighbourhood || a.city_district,
            a.city || a.town || a.village,
        ].filter(Boolean);
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
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(biasedQuery)}&countrycodes=ar&limit=5&addressdetails=1`);
            const data = await response.json();
            type === 'origin' ? setOriginSuggestions(data) : setDestinationSuggestions(data);
        } catch (err) {
            console.error('Error fetching suggestions:', err);
        } finally {
            setLoadingSuggestions(prev => ({ ...prev, [type]: false }));
        }
    };

    const calculateRouteDistance = async (start, end) => {
        if (!start || !end) return;
        try {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`);
            const data = await response.json();
            if (data.routes && data.routes[0]) {
                const distance = (data.routes[0].distance / 1000).toFixed(1);
                setDistanceKm(distance);
                const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                setRoutePoints(coordinates);
            }
        } catch (err) {
            console.error('Error calculating distance:', err);
        }
    };

    const handleSelectSuggestion = (suggestion, type) => {
        const label = formatSuggestion(suggestion);
        if (type === 'origin') {
            setOrigin(label);
            setOriginCoords({ lat: suggestion.lat, lon: suggestion.lon });
            setOriginSuggestions([]);
            if (destinationCoords) calculateRouteDistance({ lat: suggestion.lat, lon: suggestion.lon }, destinationCoords);
        } else {
            setDestination(label);
            setDestinationCoords({ lat: suggestion.lat, lon: suggestion.lon });
            setDestinationSuggestions([]);
            if (originCoords) calculateRouteDistance(originCoords, { lat: suggestion.lat, lon: suggestion.lon });
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingPhoto(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('fletea-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('fletea-images').getPublicUrl(filePath);
            setPhotoUrl(data.publicUrl);
        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Error al subir la imagen');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const toggleService = (serviceId) => {
        setSelectedServices(prev =>
            prev.includes(serviceId)
                ? prev.filter(id => id !== serviceId)
                : [...prev, serviceId]
        );
    };

    const handleCalculatePrice = async () => {
        if (!distanceKm) return;
        setLoadingPrice(true);
        setCalculatedPrice(null);
        try {
            const response = await apiPost('/api/trips/calculate-price', {
                distance_km: parseFloat(distanceKm),
                vehicle_type: vehicleType,
                services: selectedServices
            });
            const data = await response.json();
            if (data.price) setCalculatedPrice(data.price);
        } catch (err) {
            console.error('Error calculating price:', err);
        } finally {
            setLoadingPrice(false);
        }
    };

    const handleCreateTrip = async () => {
        if (!calculatedPrice) return;
        setCreatingTrip(true);
        setError('');
        setSuccess('');

        try {
            const response = await apiPost('/api/trips/create', {
                origin_address: origin,
                destination_address: destination,
                distance_km: parseFloat(distanceKm),
                vehicle_type: vehicleType,
                price: calculatedPrice,
                category,
                photos: photoUrl ? [photoUrl] : [],
                services: selectedServices
            });

            if (!response.ok) throw new Error('Failed to create trip');

            setSuccess('¡Pedido creado con éxito! Esperando un chofer...');
            setTimeout(() => {
                setSuccess('');
                setViewMode('home');
                setOrigin('');
                setDestination('');
                setOriginCoords(null);
                setDestinationCoords(null);
                setRoutePoints([]);
                setDistanceKm('');
                setCalculatedPrice(null);
                setSelectedServices([]);
                setPhotoUrl('');
            }, 3000);
            fetchTrips();
        } catch (err) {
            setError('Error al crear el pedido. Intente nuevamente.');
        } finally {
            setCreatingTrip(false);
        }
    };

    const handleCancelTrip = async (tripId) => {
        try {
            const res = await apiDelete(`/api/trips/${tripId}`);
            if (res.ok) fetchTrips();
        } catch (err) {
            console.error('Error cancelling trip:', err);
        }
    };

    const confirmDriver = async (tripId) => {
        try {
            const res = await apiPost(`/api/trips/${tripId}/confirm_driver`, {});
            if (res.ok) fetchTrips();
        } catch (e) { console.error('Error confirming driver:', e); }
    };

    const rejectDriver = async (tripId) => {
        try {
            const res = await apiPost(`/api/trips/${tripId}/reject_driver`, {});
            if (res.ok) fetchTrips();
        } catch (e) { console.error('Error rejecting driver:', e); }
    };

    const submitRating = async ({ rating, comment }) => {
        if (!justCompletedTrip || !justCompletedTrip.driver_id) return;
        try {
            await apiPost('/api/ratings', {
                trip_id: justCompletedTrip.id,
                reviewee_id: justCompletedTrip.driver_id,
                rating,
                comment
            });
            setJustCompletedTrip(null);
            setRatingModalOpen(false);
        } catch (e) {
            console.error(e);
        }
    };

    // --- RENDER HELPERS ---

    const renderVehicleOption = (type, label, description) => (
        <div
            onClick={() => setVehicleType(type)}
            className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${vehicleType === type ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}
        >
            <div className="flex items-center justify-between mb-2">
                <Truck className={`w-8 h-8 ${vehicleType === type ? 'text-blue-600' : 'text-gray-400'}`} />
                {vehicleType === type && <div className="w-4 h-4 rounded-full bg-blue-600" />}
            </div>
            <h3 className={`font-bold ${vehicleType === type ? 'text-blue-900' : 'text-gray-700'}`}>{label}</h3>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
    );

    const STATUS_LABELS = {
        pending: 'Pendiente',
        driver_pending: 'Esperando Confirmación',
        accepted: 'En Camino',
        loading: 'Cargando',
        in_progress: 'En Viaje',
        completed: 'Finalizado',
        cancelled: 'Cancelado',
    };

    const STATUS_COLORS = {
        pending: 'bg-gray-100 text-gray-700',
        driver_pending: 'bg-yellow-200 text-yellow-800',
        accepted: 'bg-blue-100 text-blue-700',
        loading: 'bg-indigo-100 text-indigo-700',
        in_progress: 'bg-purple-100 text-purple-700',
        completed: 'bg-green-100 text-green-700',
        cancelled: 'bg-gray-100 text-gray-500',
    };

    return (
        <div className="relative min-h-[calc(100vh-100px)]">
            {/* HOME VIEW: MAP + CTA */}
            {viewMode === 'home' && (
                <div className="space-y-6">
                    <div className="relative h-[60vh] w-full rounded-2xl overflow-hidden shadow-xl border border-gray-200">
                        {/* Map Overlay: CTA */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-11/12 max-w-md">
                            <button
                                onClick={() => setViewMode('requesting')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-4 px-6 rounded-xl shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
                            >
                                <Truck className="w-6 h-6" />
                                Pedir Flete Ahora
                            </button>
                        </div>

                        {/* Interactive Map */}
                        <MapContainer
                            center={mapCenter}
                            zoom={13}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />
                            <UserLocationMarker position={mapCenter} />
                            {availableDrivers.map(driver => (
                                <Marker key={driver.id} position={[driver.driver_lat, driver.driver_lon]}>
                                    <Popup>{driver.full_name} - {driver.vehicle_type} - Disponible</Popup>
                                </Marker>
                            ))}
                        </MapContainer>

                        {/* City Badge Overlay */}
                        {searchCity && (
                            <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md border border-gray-200 flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-xs font-bold text-gray-700 capitalize">{searchCity}</span>
                            </div>
                        )}
                    </div>

                    {/* Live Driver Tracking */}
                    {(() => {
                        const activeStatuses = ['accepted', 'loading', 'in_progress'];
                        const trackedTrip = myTrips.find(t => activeStatuses.includes(t.status));
                        if (!trackedTrip) return null;

                        return (
                            <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100">
                                    <h3 className="font-semibold text-blue-900">Seguimiento en vivo</h3>
                                    <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                        {STATUS_LABELS[trackedTrip.status] || trackedTrip.status}
                                    </span>
                                </div>
                                {trackedTrip.driver_lat && trackedTrip.driver_lon ? (
                                    <div style={{ height: '220px' }}>
                                        <MapContainer
                                            center={[trackedTrip.driver_lat, trackedTrip.driver_lon]}
                                            zoom={14}
                                            style={{ height: '100%', width: '100%' }}
                                            zoomControl={false}
                                        >
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                            <Marker position={[trackedTrip.driver_lat, trackedTrip.driver_lon]}>
                                                <Popup>Tu chofer</Popup>
                                            </Marker>
                                        </MapContainer>
                                    </div>
                                ) : (
                                    <div className="h-16 flex items-center justify-center text-sm text-gray-500">
                                        Esperando ubicación del chofer...
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Active Trips Quick View */}
                    {myTrips.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 mb-4 px-2">Mis Pedidos Recientes</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {myTrips.slice(0, 3).map(trip => (
                                    <div key={trip.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[trip.status] || ''}`}>
                                                {STATUS_LABELS[trip.status] || trip.status}
                                            </span>
                                            <span className="text-gray-500 font-bold">${trip.price}</span>
                                        </div>
                                        <div className="space-y-2 text-sm text-gray-600 mb-3">
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                                                <span className="truncate">{trip.origin_address}</span>
                                            </div>
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                                                <span className="truncate">{trip.destination_address}</span>
                                            </div>
                                        </div>
                                        {trip.status === 'pending' && (
                                            <button
                                                onClick={() => handleCancelTrip(trip.id)}
                                                className="w-full text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg py-1.5 transition"
                                            >
                                                Cancelar pedido
                                            </button>
                                        )}
                                        {trip.status === 'driver_pending' && (
                                            <div className="mt-3 bg-yellow-50 p-3 rounded border border-yellow-200">
                                                <p className="text-xs font-bold text-yellow-800 mb-2">¡Chofer Encontrado!</p>
                                                {pendingDriverProfiles[trip.driver_id] && (
                                                    <p className="text-xs text-yellow-700 mb-3 hover:text-yellow-900 transition">
                                                        Chofer: <span className="font-semibold">{pendingDriverProfiles[trip.driver_id].full_name}</span> - <span className="uppercase">{pendingDriverProfiles[trip.driver_id].vehicle_type?.replace('_', ' ')}</span>
                                                    </p>
                                                )}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => confirmDriver(trip.id)}
                                                        className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1.5 rounded transition shadow-sm"
                                                    >
                                                        Aceptar
                                                    </button>
                                                    <button
                                                        onClick={() => rejectDriver(trip.id)}
                                                        className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1.5 rounded transition shadow-sm"
                                                    >
                                                        Rechazar
                                                    </button>
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

            {/* REQUESTING VIEW: FORM + MAP SIDEBAR */}
            {viewMode === 'requesting' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Form Wizard */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <button onClick={() => setViewMode('home')} className="p-2 hover:bg-gray-100 rounded-full">
                                <ArrowRight className="w-6 h-6 rotate-180 text-gray-600" />
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">Configura tu Flete</h1>
                        </div>

                        {/* 1. Route */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Navigation className="w-4 h-4 text-blue-600" /> Ruta
                                </h3>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <MapPin className="w-3 h-3" />
                                    <span>Ciudad:</span>
                                    {editingCity ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="text"
                                                value={cityInput}
                                                onChange={(e) => setCityInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { setSearchCity(cityInput.trim()); setEditingCity(false); }
                                                    if (e.key === 'Escape') setEditingCity(false);
                                                }}
                                                className="border border-blue-300 rounded px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-blue-400 w-28"
                                                autoFocus
                                                placeholder="Ej: Córdoba"
                                            />
                                            <button onClick={() => { setSearchCity(cityInput.trim()); setEditingCity(false); }} className="text-blue-600 font-semibold hover:text-blue-800">OK</button>
                                            <button onClick={() => setEditingCity(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setCityInput(searchCity); setEditingCity(true); }}
                                            className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800"
                                        >
                                            {searchCity || 'Detectando...'}
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-green-600" />
                                    <input
                                        type="text"
                                        value={origin}
                                        onChange={(e) => setOrigin(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="¿Dónde retiramos?"
                                    />
                                    {loadingSuggestions.origin && (
                                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">Buscando...</span>
                                    )}
                                    {originSuggestions.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                                            {originSuggestions.map((s, i) => (
                                                <li key={i} onClick={() => handleSelectSuggestion(s, 'origin')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-50 last:border-0">
                                                    <span className="font-medium">{formatSuggestion(s)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-red-600" />
                                    <input
                                        type="text"
                                        value={destination}
                                        onChange={(e) => setDestination(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="¿Dónde entregamos?"
                                    />
                                    {loadingSuggestions.destination && (
                                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">Buscando...</span>
                                    )}
                                    {destinationSuggestions.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                                            {destinationSuggestions.map((s, i) => (
                                                <li key={i} onClick={() => handleSelectSuggestion(s, 'destination')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-50 last:border-0">
                                                    <span className="font-medium">{formatSuggestion(s)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            {distanceKm && (
                                <div className="text-sm text-gray-500 font-medium flex items-center gap-1 bg-gray-50 p-2 rounded-lg w-fit">
                                    <Navigation className="w-3 h-3" /> Distancia: <span className="text-gray-900">{distanceKm} km</span>
                                </div>
                            )}
                        </div>

                        {/* 2. Carga */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Package className="w-4 h-4 text-blue-600" /> Carga
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Categoría</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="general">Cargas Generales</option>
                                        <option value="furniture">Muebles</option>
                                        <option value="appliances">Electrodomésticos</option>
                                        <option value="construction">Materiales de Construcción</option>
                                        <option value="small_move">Mudanza Pequeña</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Foto (Opcional)</label>
                                    <div className="relative">
                                        <Camera className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                        {uploadingPhoto && <span className="absolute right-3 top-2.5 text-xs text-blue-600">Subiendo...</span>}
                                        {photoUrl && !uploadingPhoto && <span className="absolute right-3 top-2.5 text-xs text-green-600">¡Cargada!</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Vehículo */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Truck className="w-4 h-4 text-blue-600" /> Vehículo
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {renderVehicleOption('flete_chico', 'Utilitario', 'Kangoo / Partner')}
                                {renderVehicleOption('flete_mediano', 'Camioneta', 'Hilux / S10')}
                                {renderVehicleOption('mudancera', 'Camión', 'Con caja mudancera')}
                            </div>
                        </div>

                        {/* 4. Servicios Adicionales */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-blue-600" /> Servicios Adicionales
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <ServiceCheckbox
                                    label="Ayuda Peón"
                                    price="2000"
                                    checked={selectedServices.includes('helper')}
                                    onChange={() => toggleService('helper')}
                                />
                                <ServiceCheckbox
                                    label="Embalaje"
                                    price="1500"
                                    checked={selectedServices.includes('packing')}
                                    onChange={() => toggleService('packing')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Summary & Map sticky */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* Map Preview */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[300px] relative z-0">
                            <MapContainer
                                center={mapCenter}
                                zoom={12}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                {originCoords && <Marker position={[originCoords.lat, originCoords.lon]}><Popup>Origen</Popup></Marker>}
                                {destinationCoords && <Marker position={[destinationCoords.lat, destinationCoords.lon]}><Popup>Destino</Popup></Marker>}
                                {routePoints.length > 0 && <Polyline pathOptions={{ color: '#2563eb', weight: 4 }} positions={routePoints} />}
                                <MapUpdater coords={{ origin: originCoords, destination: destinationCoords }} />
                            </MapContainer>
                        </div>

                        {/* Quote Summary */}
                        <div className="bg-blue-900 text-white p-6 rounded-2xl shadow-xl">
                            <h2 className="text-xl font-bold mb-6">Resumen</h2>

                            <div className="space-y-4 mb-6 text-blue-100 text-sm">
                                <div className="flex justify-between">
                                    <span>Distancia</span>
                                    <span className="font-bold text-white">{distanceKm || '-'} km</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Vehículo</span>
                                    <span className="font-bold text-white uppercase">{vehicleType.replace('_', ' ')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Servicios</span>
                                    <span className="font-bold text-white">{selectedServices.length > 0 ? selectedServices.length : '-'}</span>
                                </div>
                            </div>

                            <div className="bg-white/10 p-4 rounded-xl mb-6">
                                <p className="text-xs text-blue-200 mb-1 uppercase tracking-wider">Total Estimado</p>
                                <span className="text-3xl font-bold text-white">
                                    {calculatedPrice ? `$${calculatedPrice}` : '---'}
                                </span>
                            </div>

                            {!calculatedPrice ? (
                                <button
                                    onClick={handleCalculatePrice}
                                    disabled={!distanceKm || loadingPrice}
                                    className="w-full py-4 bg-white text-blue-900 font-bold rounded-xl hover:bg-blue-50 transition shadow-lg disabled:opacity-50"
                                >
                                    {loadingPrice ? 'Calculando...' : 'Cotizar Precio'}
                                </button>
                            ) : (
                                <button
                                    onClick={handleCreateTrip}
                                    disabled={creatingTrip}
                                    className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg transform transition hover:scale-[1.02]"
                                >
                                    {creatingTrip ? 'Procesando...' : 'Confirmar Pedido'}
                                </button>
                            )}

                            {error && <p className="text-red-300 text-sm mt-4 text-center">{error}</p>}
                            {success && <p className="text-green-300 text-sm mt-4 text-center">{success}</p>}
                        </div>
                    </div>
                </div>
            )}

            <RatingModal
                isOpen={ratingModalOpen}
                onClose={() => setRatingModalOpen(false)}
                onSubmit={submitRating}
                title="Calificar Chofer"
            />
        </div>
    );
};

export default UserDashboard;
