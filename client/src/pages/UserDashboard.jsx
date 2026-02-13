import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Truck, DollarSign, Clock, Navigation } from 'lucide-react';
import { supabase } from '../services/supabase';
import RatingModal from '../components/RatingModal';
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

    // Form State
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [originCoords, setOriginCoords] = useState(null);
    const [destinationCoords, setDestinationCoords] = useState(null);
    const [distanceKm, setDistanceKm] = useState('');
    const [vehicleType, setVehicleType] = useState('auto');

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

        if (data) setMyTrips(data);
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
                handleCalculatePrice(distance);
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

    const handleCalculatePrice = async (dist = distanceKm) => {
        if (!dist) return;
        setLoadingPrice(true);
        setCalculatedPrice(null);
        try {
            const response = await fetch('http://localhost:3000/api/trips/calculate-price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ distance_km: parseFloat(dist), vehicle_type: vehicleType })
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
            const response = await fetch('http://localhost:3000/api/trips/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    origin_address: origin,
                    destination_address: destination,
                    distance_km: parseFloat(distanceKm),
                    vehicle_type: vehicleType,
                    price: calculatedPrice
                })
            });

            if (!response.ok) throw new Error('Failed to create trip');

            const data = await response.json();
            setSuccess('¡Pedido creado con éxito! Esperando un chofer...');
            setOrigin('');
            setDestination('');
            setOriginCoords(null);
            setDestinationCoords(null);
            setRoutePoints([]);
            setDistanceKm('');
            setCalculatedPrice(null);
            fetchTrips();
        } catch (err) {
            setError('Error al crear el pedido. Intente nuevamente.');
        } finally {
            setCreatingTrip(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Trip Section */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <Truck className="w-5 h-5 mr-2 text-blue-600" />
                        Nuevo Pedido
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={origin}
                                    onChange={(e) => {
                                        setOrigin(e.target.value);
                                        fetchSuggestions(e.target.value, 'origin');
                                    }}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Dirección de retiro"
                                />
                                {originSuggestions.length > 0 && (
                                    <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                                        {originSuggestions.map((s, i) => (
                                            <li
                                                key={i}
                                                onClick={() => handleSelectSuggestion(s, 'origin')}
                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 truncate"
                                            >
                                                {s.display_name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={destination}
                                    onChange={(e) => {
                                        setDestination(e.target.value);
                                        fetchSuggestions(e.target.value, 'destination');
                                    }}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Dirección de entrega"
                                />
                                {destinationSuggestions.length > 0 && (
                                    <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                                        {destinationSuggestions.map((s, i) => (
                                            <li
                                                key={i}
                                                onClick={() => handleSelectSuggestion(s, 'destination')}
                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 truncate"
                                            >
                                                {s.display_name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Distancia Estimada (km)</label>
                            <input
                                type="number"
                                value={distanceKm}
                                readOnly
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none cursor-not-allowed"
                                placeholder="Calculando automáticamente..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Vehículo</label>
                            <select
                                value={vehicleType}
                                onChange={(e) => setVehicleType(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="auto">Auto</option>
                                <option value="camioneta">Camioneta</option>
                                <option value="camion">Camión</option>
                            </select>
                        </div>

                        <button
                            onClick={handleCalculatePrice}
                            disabled={!distanceKm || loadingPrice}
                            className="w-full py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
                        >
                            {loadingPrice ? 'Calculando...' : 'Cotizar Precio'}
                        </button>

                        {calculatedPrice && (
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 animate-fade-in">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-gray-600">Precio Estimado:</span>
                                    <span className="text-2xl font-bold text-blue-700">${calculatedPrice}</span>
                                </div>
                                <button
                                    onClick={handleCreateTrip}
                                    disabled={creatingTrip}
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-md"
                                >
                                    {creatingTrip ? 'Procesando...' : 'Confirmar Pedido'}
                                </button>
                            </div>
                        )}

                        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                        {success && <p className="text-green-600 text-sm mt-2">{success}</p>}
                    </div>
                </div>
            </div>

            {/* Map and Trips Section */}
            <div className="lg:col-span-2 space-y-8">
                {/* Map Section */}
                <div className="bg-white p-4 rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center">
                            <Navigation className="w-5 h-5 mr-2 text-blue-600" />
                            Mapa del Recorrido
                        </h2>
                        {distanceKm && <span className="text-blue-600 font-semibold">{distanceKm} km</span>}
                    </div>
                    <div className="h-[300px] w-full rounded-lg overflow-hidden border border-gray-200 z-0">
                        <MapContainer
                            center={[-34.6037, -58.3816]} // Default to BA
                            zoom={13}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />
                            {originCoords && (
                                <Marker position={[originCoords.lat, originCoords.lon]}>
                                    <Popup>Origen: {origin}</Popup>
                                </Marker>
                            )}
                            {destinationCoords && (
                                <Marker position={[destinationCoords.lat, destinationCoords.lon]}>
                                    <Popup>Destino: {destination}</Popup>
                                </Marker>
                            )}
                            {routePoints.length > 0 && (
                                <Polyline pathOptions={{ color: '#2563eb', weight: 4 }} positions={routePoints} />
                            )}
                            <MapUpdater coords={{ origin: originCoords, destination: destinationCoords }} />
                        </MapContainer>
                    </div>
                </div>

                {/* Trips List */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Mis Pedidos</h2>
                    {myTrips.length === 0 ? (
                        <div className="bg-white p-8 rounded-xl shadow-sm text-center text-gray-500">
                            <Truck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No has realizado pedidos aún.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {myTrips.map((trip) => (
                                <div key={trip.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                            ${trip.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                            ${trip.status === 'accepted' ? 'bg-blue-100 text-blue-700' : ''}
                            ${trip.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                            ${trip.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                          `}>
                                                {trip.status === 'pending' && 'Pendiente'}
                                                {trip.status === 'accepted' && 'En Camino'}
                                                {trip.status === 'completed' && 'Finalizado'}
                                                {trip.status === 'cancelled' && 'Cancelado'}
                                            </span>
                                            <span className="text-gray-400 text-sm flex items-center"><Clock className="w-3 h-3 mr-1" /> {new Date(trip.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="grid gap-1">
                                            <div className="flex items-start gap-2">
                                                <div className="mt-1 min-w-[16px]"><div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm ring-1 ring-blue-100"></div></div>
                                                <p className="text-gray-800 font-medium line-clamp-1">{trip.origin_address}</p>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <div className="mt-1 min-w-[16px]"><div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm ring-1 ring-red-100"></div></div>
                                                <p className="text-gray-800 font-medium line-clamp-1">{trip.destination_address}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right sm:border-l sm:pl-6 border-gray-100">
                                        <p className="text-sm text-gray-500 mb-1">Precio</p>
                                        <p className="text-xl font-bold text-gray-900">${trip.price}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;
