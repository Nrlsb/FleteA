import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Truck, DollarSign, Clock } from 'lucide-react';
import { supabase } from '../services/supabase';
import RatingModal from '../components/RatingModal';

const UserDashboard = () => {
    const { user, profile } = useAuth();

    // Form State
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [distanceKm, setDistanceKm] = useState(''); // Manual input for MVP
    const [vehicleType, setVehicleType] = useState('auto');

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

    const handleCalculatePrice = async () => {
        if (!distanceKm) return;
        setLoadingPrice(true);
        setCalculatedPrice(null);
        try {
            const response = await fetch('http://localhost:3000/api/trips/calculate-price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ distance_km: parseFloat(distanceKm), vehicle_type: vehicleType })
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
                                    onChange={(e) => setOrigin(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Dirección de retiro"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={destination}
                                    onChange={(e) => setDestination(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Dirección de entrega"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Distancia Estimada (km)</label>
                            <input
                                type="number"
                                value={distanceKm}
                                onChange={(e) => setDistanceKm(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ej: 5.5"
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

            {/* Trips List Section */}
            <div className="lg:col-span-2">
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
        </div >
    );
};

export default UserDashboard;
