import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Truck, DollarSign, Clock, Navigation, Package, Camera, ArrowRight, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import RatingModal from '../components/RatingModal';
import ServiceCheckbox from '../components/ServiceCheckbox';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
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

const UserDashboard = () => {
    const { user, profile } = useAuth();

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

    // Autocomplete State
    const [originSuggestions, setOriginSuggestions] = useState([]);
    const [destinationSuggestions, setDestinationSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState({ origin: false, destination: false });
    const [routePoints, setRoutePoints] = useState([]);

    // UI State
    const [calculatedPrice, setCalculatedPrice] = useState(null);
    const [loadingPrice, setLoadingPrice] = useState(false);
    const [creatingTrip, setCreatingTrip] = useState(false);
    const [myTrips, setMyTrips] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [justCompletedTrip, setJustCompletedTrip] = useState(null);

    // Fetch trips
    useEffect(() => {
        if (user) fetchTrips();

        // Realtime subscription for my trips updates
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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchTrips = async () => {
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) {
            // Check if any trip just changed to completed to trigger rating
            const completedTrip = data.find(t => t.status === 'completed' && !myTrips.find(oldT => oldT.id === t.id && oldT.status === 'completed'));
            if (completedTrip && !justCompletedTrip) {
                setJustCompletedTrip(completedTrip);
                setRatingModalOpen(true);
            }
            setMyTrips(data);
        }
    };

    // Geolocation Functions
    const fetchSuggestions = async (query, type) => {
        if (query.length < 3) {
            type === 'origin' ? setOriginSuggestions([]) : setDestinationSuggestions([]);
            return;
        }

        setLoadingSuggestions(prev => ({ ...prev, [type]: true }));
        try {
            // Added featuretype=settlement,street to improve relevance and limit search area
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ar&limit=5&addressdetails=1`);
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

                // Set route points for the map
                const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                setRoutePoints(coordinates);

                // Trigger price calculation automatically
                // handleCalculatePrice(distance); // Don't auto-calc yet, let user finish form
            }
        } catch (err) {
            console.error('Error calculating distance:', err);
        }
    };

    const handleSelectSuggestion = (suggestion, type) => {
        if (type === 'origin') {
            setOrigin(suggestion.display_name);
            setOriginCoords({ lat: suggestion.lat, lon: suggestion.lon });
            setOriginSuggestions([]);
            if (destinationCoords) calculateRouteDistance({ lat: suggestion.lat, lon: suggestion.lon }, destinationCoords);
        } else {
            setDestination(suggestion.display_name);
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
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('fletea-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('fletea-images')
                .getPublicUrl(filePath);

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

    // Updated Calculate Price to include services
    const handleCalculatePrice = async () => {
        if (!distanceKm) return;
        setLoadingPrice(true);
        setCalculatedPrice(null);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/calculate-price`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    distance_km: parseFloat(distanceKm),
                    vehicle_type: vehicleType,
                    services: selectedServices
                })
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
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/trips/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    origin_address: origin,
                    destination_address: destination,
                    distance_km: parseFloat(distanceKm),
                    vehicle_type: vehicleType,
                    price: calculatedPrice,
                    category,
                    photos: photoUrl ? [photoUrl] : [],
                    services: selectedServices
                })
            });

            if (!response.ok) throw new Error('Failed to create trip');

            const data = await response.json();
            setSuccess('¡Pedido creado con éxito! Esperando un chofer...');
            setTimeout(() => {
                setSuccess('');
                setViewMode('home');
                // Reset form
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

    const submitRating = async ({ rating, comment }) => {
        if (!justCompletedTrip || !justCompletedTrip.driver_id) return;
        try {
            await fetch(`${import.meta.env.VITE_API_URL}/api/ratings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trip_id: justCompletedTrip.id,
                    reviewer_id: user.id,
                    reviewee_id: justCompletedTrip.driver_id,
                    rating,
                    comment
                })
            });
            setJustCompletedTrip(null);
            setRatingModalOpen(false);
        } catch (e) {
            console.error(e);
        }
    };

    // --- RENDER HELPERS ---

    const renderVehicleOption = (type, label, description, priceFactor) => (
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
                            center={[-34.6037, -58.3816]}
                            zoom={13}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />
                            {/* Mock nearby drivers */}
                            <Marker position={[-34.61, -58.39]}><Popup>Chofer Juan - Disponible</Popup></Marker>
                            <Marker position={[-34.59, -58.41]}><Popup>Chofer Luis - Disponible</Popup></Marker>
                        </MapContainer>
                    </div>

                    {/* Active Trips Quick View */}
                    {myTrips.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 mb-4 px-2">Mis Pedidos Recientes</h2>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {myTrips.slice(0, 3).map(trip => (
                                    <div key={trip.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                                                ${trip.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                                                ${trip.status === 'accepted' ? 'bg-blue-100 text-blue-700' : ''}
                                                ${trip.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                                            `}>
                                                {trip.status === 'pending' ? 'Pendiente' :
                                                    trip.status === 'accepted' ? 'En Camino' :
                                                        trip.status === 'completed' ? 'Finalizado' : trip.status}
                                            </span>
                                            <span className="text-gray-500 font-bold">${trip.price}</span>
                                        </div>
                                        <div className="space-y-2 text-sm text-gray-600">
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                {trip.origin_address}
                                            </div>
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                {trip.destination_address}
                                            </div>
                                        </div>
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
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <Navigation className="w-4 h-4 text-blue-600" /> Ruta
                            </h3>
                            <div className="space-y-3">
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-green-600" />
                                    <input
                                        type="text"
                                        value={origin}
                                        onChange={(e) => {
                                            setOrigin(e.target.value);
                                            fetchSuggestions(e.target.value, 'origin');
                                        }}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="¿Dónde retiramos?"
                                    />
                                    {originSuggestions.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                                            {originSuggestions.map((s, i) => (
                                                <li key={i} onClick={() => handleSelectSuggestion(s, 'origin')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm font-medium border-b border-gray-50 last:border-0">{s.display_name}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-red-600" />
                                    <input
                                        type="text"
                                        value={destination}
                                        onChange={(e) => {
                                            setDestination(e.target.value);
                                            fetchSuggestions(e.target.value, 'destination');
                                        }}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="¿Dónde entregamos?"
                                    />
                                    {destinationSuggestions.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                                            {destinationSuggestions.map((s, i) => (
                                                <li key={i} onClick={() => handleSelectSuggestion(s, 'destination')} className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm font-medium border-b border-gray-50 last:border-0">{s.display_name}</li>
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
                                        {photoUrl && !uploadingPhoto && <span className="absolute right-3 top-2.5 text-xs text-green-600">¡Imagen cargada!</span>}
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
                                {renderVehicleOption('flete_chico', 'Utilitario', 'Kangoo / Partner', '$900/km')}
                                {renderVehicleOption('flete_mediano', 'Camioneta', 'Hilux / S10', '$1500/km')}
                                {renderVehicleOption('mudancera', 'Camión', 'Con caja mudancera', '$2500/km')}
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
                                center={[-34.6037, -58.3816]}
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
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-bold text-white">
                                        {calculatedPrice ? `$${calculatedPrice}` : '---'}
                                    </span>
                                </div>
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
