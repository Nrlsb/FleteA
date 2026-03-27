import { X, Star, Truck, Weight, Maximize } from 'lucide-react';
import { Button } from './ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

const DriverProfileModal = ({ isOpen, onClose, driverId, tripId }) => {
    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ['driverProfile', driverId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', driverId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!driverId && isOpen,
    });

    const { data: ratingStats, isLoading: loadingRatings } = useQuery({
        queryKey: ['driverRatings', driverId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ratings')
                .select('rating')
                .eq('reviewee_id', driverId);
            if (error) throw error;

            if (data.length === 0) return { avg: 0, count: 0 };
            const sum = data.reduce((acc, curr) => acc + curr.rating, 0);
            return { avg: (sum / data.length).toFixed(1), count: data.length };
        },
        enabled: !!driverId && isOpen,
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="relative h-32 bg-primary">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="absolute -bottom-10 left-6">
                        <div className="w-20 h-20 bg-white rounded-2xl shadow-lg border-4 border-white overflow-hidden flex items-center justify-center">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                            ) : (
                                <Truck className="w-10 h-10 text-primary/20" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="pt-12 px-6 pb-6 space-y-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{profile?.full_name || 'Cargando...'}</h2>
                        <div className="flex items-center gap-1 mt-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="text-sm font-bold text-gray-700">{ratingStats?.avg || '0.0'}</span>
                            <span className="text-xs text-gray-400">({ratingStats?.count || 0} reseñas)</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 mb-1 text-gray-500">
                                <Truck className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Vehículo</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-800 capitalize">{profile?.vehicle_type?.replace('_', ' ') || '---'}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 mb-1 text-gray-500">
                                <Weight className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Carga Máxima</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-800">{profile?.max_cargo_weight ? `${profile.max_cargo_weight} kg` : '---'}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 col-span-2">
                            <div className="flex items-center gap-2 mb-1 text-gray-500">
                                <Maximize className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Dimensiones</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-800">
                                {profile?.vehicle_dimensions ?
                                    `${profile.vehicle_dimensions.largo || '0'}m x ${profile.vehicle_dimensions.ancho || '0'}m x ${profile.vehicle_dimensions.alto || '0'}m`
                                    : '---'}
                            </p>
                        </div>
                    </div>

                    <Button onClick={onClose} className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold">
                        Cerrar Perfil
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default DriverProfileModal;
