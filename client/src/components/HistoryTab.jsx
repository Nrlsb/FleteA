import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { Calendar, MapPin, DollarSign, ChevronRight, Package, Star } from 'lucide-react';
import { Button } from './ui/button';
import { useState } from 'react';
import TripDetailModal from './TripDetailModal';

const HistoryTab = ({ userId, role }) => {
    const [selectedTripDetail, setSelectedTripDetail] = useState(null);

    const { data: trips = [], isLoading } = useQuery({
        queryKey: ['tripsHistory', userId],
        queryFn: async () => {
            const query = supabase.from('trips').select('*').order('created_at', { ascending: false });
            if (role === 'driver') query.eq('driver_id', userId);
            else query.eq('user_id', userId);
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
    });

    const STATUS_COLORS = { completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700', expired: 'bg-gray-100 text-gray-500' };

    if (isLoading) return <div className="py-20 text-center text-gray-400">Cargando historial...</div>;

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 px-2">
                {role === 'driver' ? 'Historial de Servicios' : 'Mis Pedidos Pasados'}
            </h2>
            {trips.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl text-gray-400">Aún no tienes viajes registrados.</div>
            ) : (
                <div className="grid gap-4">
                    {trips.map((trip) => (
                        <div key={trip.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="text-xs font-medium text-gray-500">{new Date(trip.created_at).toLocaleDateString()}</span>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[trip.status] || 'bg-gray-100 text-gray-500'}`}>
                                    {trip.status === 'completed' ? 'Completado' : trip.status === 'cancelled' ? 'Cancelado' : 'Otro'}
                                </span>
                            </div>

                            <div className="space-y-3 mb-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />
                                    <p className="text-sm text-gray-700 truncate">{trip.origin_address}</p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 mt-1.5 rounded-full bg-red-500 shrink-0" />
                                    <p className="text-sm text-gray-700 truncate">{trip.destination_address}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1 text-gray-900 font-bold">
                                        <DollarSign className="w-4 h-4 text-green-600" />
                                        <span>${trip.price}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Package className="w-3.5 h-3.5" />
                                        <span className="capitalize">{trip.category}</span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-primary group-hover:translate-x-1 transition-transform"
                                    onClick={() => setSelectedTripDetail(trip)}
                                >
                                    Detalles <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <TripDetailModal
                isOpen={!!selectedTripDetail}
                onClose={() => setSelectedTripDetail(null)}
                trip={selectedTripDetail}
                role={role}
            />
        </div>
    );
};

export default HistoryTab;
