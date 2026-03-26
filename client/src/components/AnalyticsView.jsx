import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { TrendingUp, Award, Clock, DollarSign, Map } from 'lucide-react';

const AnalyticsView = ({ userId, role }) => {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['analytics', userId],
        queryFn: async () => {
            const query = supabase.from('trips').select('price, distance_km, status, created_at');
            if (role === 'driver') query.eq('driver_id', userId);
            else query.eq('user_id', userId);

            const { data } = await query;
            const completed = (data || []).filter(t => t.status === 'completed');

            return {
                totalTrips: data?.length || 0,
                completedTrips: completed.length,
                totalSpent: completed.reduce((sum, t) => sum + t.price, 0),
                totalKm: completed.reduce((sum, t) => sum + (parseFloat(t.distance_km) || 0), 0).toFixed(1),
                earnings: role === 'driver' ? completed.reduce((sum, t) => sum + t.price, 0) * 0.85 : 0
            };
        },
    });

    if (isLoading) return <div className="py-20 text-center text-gray-400">Cargando estadísticas...</div>;

    const Card = ({ title, value, icon: Icon, color }) => (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{title}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
            <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('600', '100')}`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 px-2">Tu actividad</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card title="Viajes Totales" value={stats.totalTrips} icon={Clock} color="text-blue-600" />
                <Card title="Completados" value={stats.completedTrips} icon={Award} color="text-green-600" />
                <Card title={role === 'driver' ? "Ganancias" : "Inversión"} value={`$${role === 'driver' ? stats.earnings.toFixed(0) : stats.totalSpent}`} icon={DollarSign} color="text-primary" />
                <Card title="Distancia Total" value={`${stats.totalKm} km`} icon={Map} color="text-orange-600" />
            </div>

            <div className="bg-gradient-to-br from-primary to-blue-700 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden group">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h3 className="text-2xl font-bold mb-2">¡Sigue así!</h3>
                        <p className="text-blue-100 opacity-90 max-w-md">Estás haciendo un gran trabajo. Fletea crece contigo cada día.</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 text-center">
                        <TrendingUp className="w-8 h-8 mb-2 mx-auto" />
                        <p className="text-xs uppercase font-bold text-blue-100">Crecimiento Mensual</p>
                        <p className="text-2xl font-bold">+12%</p>
                    </div>
                </div>
                {/* Decorative circles */}
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute -top-20 -left-20 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
            </div>
        </div>
    );
};

export default AnalyticsView;
