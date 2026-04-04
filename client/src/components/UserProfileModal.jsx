import { X, Star, Truck, User as UserIcon, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/api';

const UserProfileModal = ({ isOpen, onClose, userId, profile }) => {
    const { data: reviews = [], isLoading: loadingReviews } = useQuery({
        queryKey: ['userReviews', userId],
        queryFn: async () => {
            const res = await apiGet(`/api/ratings/${userId}`);
            if (!res.ok) throw new Error('Error al cargar reseñas');
            return res.json();
        },
        enabled: !!userId && isOpen,
    });

    if (!isOpen) return null;

    const avgRating = reviews.length > 0
        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
        : '0.0';

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                {/* Header */}
                <div className="relative h-32 bg-gradient-to-r from-blue-600 to-indigo-700 shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="absolute -bottom-12 left-8">
                        <div className="w-24 h-24 bg-white rounded-3xl shadow-xl border-4 border-white overflow-hidden flex items-center justify-center">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                                    <UserIcon className="w-10 h-10 text-blue-300" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Profile Info */}
                <div className="pt-16 px-8 pb-4 shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">{profile?.full_name || 'Usuario'}</h2>
                            <p className="text-gray-500 font-medium capitalize flex items-center gap-2">
                                {profile?.role === 'driver' ? <Truck className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                                {profile?.role === 'driver' ? profile.vehicle_type?.replace('_', ' ') : 'Cliente'}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center justify-end gap-1 mb-1">
                                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                <span className="text-xl font-black text-gray-900">{avgRating}</span>
                            </div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{reviews.length} Reseñas</p>
                        </div>
                    </div>
                </div>

                {/* Tabs/Section Title */}
                <div className="px-8 border-b border-gray-100 pb-2 mb-2 shrink-0">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Lo que dicen los usuarios</h3>
                </div>

                {/* Reviews List */}
                <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4 min-h-0 scrollbar-thin scrollbar-thumb-gray-200">
                    {loadingReviews ? (
                        <div className="py-10 text-center text-gray-400">Cargando reseñas...</div>
                    ) : reviews.length === 0 ? (
                        <div className="py-10 text-center text-gray-400 italic">Aún no tienes reseñas escritas.</div>
                    ) : (
                        reviews.map((review) => (
                            <div key={review.id} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                                    {review.profiles?.avatar_url ? (
                                        <img src={review.profiles.avatar_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <UserIcon className="w-5 h-5 text-gray-300" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-sm font-bold text-gray-800">{review.profiles?.full_name || 'Usuario'}</p>
                                        <div className="flex items-center gap-0.5">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`} />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 leading-relaxed italic">"{review.comment || 'Sin comentarios'}"</p>
                                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(review.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 shrink-0 border-t border-gray-100">
                    <Button onClick={onClose} className="w-full h-12 rounded-xl bg-gray-900 hover:bg-black text-white font-bold transition-all shadow-lg shadow-gray-200">
                        Cerrar Perfil
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
