import React from 'react';
import { X, MapPin, Calendar, DollarSign, Navigation, Package, Clock, ShieldCheck, Star } from 'lucide-react';
import { Button } from './ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../services/api';

const TripDetailModal = ({ isOpen, onClose, trip, role }) => {
    if (!isOpen || !trip) return null;

    const STATUS_LABELS = {
        pending: 'Pendiente',
        driver_pending: 'Esperando Confirmación',
        accepted: 'Aceptado / En Camino',
        loading: 'Cargando',
        in_progress: 'En Viaje',
        completed: 'Finalizado',
        cancelled: 'Cancelado'
    };

    const STATUS_COLORS = {
        pending: 'bg-gray-100 text-gray-700',
        driver_pending: 'bg-yellow-100 text-yellow-800',
        accepted: 'bg-blue-100 text-blue-700',
        loading: 'bg-indigo-100 text-indigo-700',
        in_progress: 'bg-purple-100 text-purple-700',
        completed: 'bg-green-100 text-green-700',
        cancelled: 'bg-red-100 text-red-700'
    };

    const SERVICE_LABELS = {
        helper: 'Ayuda Peón',
        packing: 'Embalaje'
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Detalle del Servicio</h3>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-0.5">ID: {trip.id.split('-')[0]}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Status & Date */}
                    <div className="flex justify-between items-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-tight ${STATUS_COLORS[trip.status] || 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_LABELS[trip.status] || 'Otro'}
                        </span>
                        <div className="flex items-center gap-2 text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <span className="text-xs font-bold">{new Date(trip.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Route Section */}
                    <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100 italic">
                        <div className="flex gap-4">
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <div className="w-0.5 h-full border-l-2 border-dashed border-gray-200" />
                            </div>
                            <div className="pb-2">
                                <p className="text-[10px] uppercase font-black text-blue-600 tracking-widest mb-1">Origen</p>
                                <p className="text-sm font-bold text-gray-800 leading-tight">{trip.origin_address}</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                <Navigation className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-black text-red-600 tracking-widest mb-1">Destino</p>
                                <p className="text-sm font-bold text-gray-800 leading-tight">{trip.destination_address}</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total</p>
                            <div className="text-2xl font-black text-gray-900 flex items-center gap-1">
                                <span className="text-green-600">$</span>{trip.price}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Distancia</p>
                            <div className="text-2xl font-black text-gray-900 flex items-center gap-1 text-sm md:text-xl">
                                {trip.distance_km} <span className="text-xs font-bold text-gray-400">KM</span>
                            </div>
                        </div>
                    </div>

                    {/* Details List */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 font-medium flex items-center gap-2"><Package className="w-4 h-4" /> Categoria</span>
                            <span className="font-bold text-gray-800 capitalize">{trip.category}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 font-medium flex items-center gap-2"><Clock className="w-4 h-4" /> Vehiculo</span>
                            <span className="font-bold text-gray-800 uppercase tracking-tighter">{trip.vehicle_type?.replace('_', ' ')}</span>
                        </div>
                        {trip.services && trip.services.length > 0 && (
                            <div className="pt-2">
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2">Servicios Extra</p>
                                <div className="flex flex-wrap gap-2">
                                    {trip.services.map(s => (
                                        <span key={s} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-black rounded-lg border border-blue-100 flex items-center gap-1.5">
                                            <ShieldCheck className="w-3 h-3" /> {SERVICE_LABELS[s] || s}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Proof Photos Section */}
                    {(trip.proof_loading_photo || trip.proof_delivery_photo || (trip.photos && trip.photos.length > 0)) && (
                        <div className="space-y-4 pt-4 border-t border-gray-50">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Fotos de Comprobante / Carga</p>
                            <div className="grid grid-cols-2 gap-3">
                                {trip.photos?.map((p, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="aspect-square rounded-xl overflow-hidden border border-gray-100 shadow-inner bg-gray-50">
                                            <img src={p} alt="Fletea carga" className="w-full h-full object-cover" />
                                        </div>
                                        <p className="text-[9px] text-center font-bold text-gray-400 uppercase tracking-tighter">Pedido Inicial</p>
                                    </div>
                                ))}
                                {trip.proof_loading_photo && (
                                    <div className="space-y-1">
                                        <div className="aspect-square rounded-xl overflow-hidden border border-gray-100 shadow-inner bg-gray-50">
                                            <img src={trip.proof_loading_photo} alt="Fletea carga inicial" className="w-full h-full object-cover" />
                                        </div>
                                        <p className="text-[9px] text-center font-bold text-blue-500 uppercase tracking-tighter">Carga Realizada</p>
                                    </div>
                                )}
                                {trip.proof_delivery_photo && (
                                    <div className="space-y-1">
                                        <div className="aspect-square rounded-xl overflow-hidden border border-gray-100 shadow-inner bg-gray-50">
                                            <img src={trip.proof_delivery_photo} alt="Fletea entrega" className="w-full h-full object-cover" />
                                        </div>
                                        <p className="text-[9px] text-center font-bold text-green-500 uppercase tracking-tighter">Entrega Finalizada</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Ratings Section */}
                    {trip.status === 'completed' && (
                        <TripRatings tripId={trip.id} role={role} />
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <Button variant="outline" className="w-full font-bold h-12 rounded-xl" onClick={onClose}>
                        Cerrar
                    </Button>
                </div>
            </div>
        </div>
    );
};

const TripRatings = ({ tripId, role }) => {
    const { data: ratings = [], isLoading } = useQuery({
        queryKey: ['tripRatings', tripId],
        queryFn: async () => {
            const res = await apiGet(`/api/ratings/trip/${tripId}`);
            if (!res.ok) throw new Error('Error al cargar calificaciones');
            return res.json();
        },
        enabled: !!tripId,
    });

    if (isLoading) return <div className="py-4 text-center text-xs text-gray-400">Cargando calificaciones...</div>;
    if (ratings.length === 0) return null;

    // Separate ratings by who gave them
    const myRating = ratings.find(r => (role === 'driver' && r.profiles?.role === 'driver') || (role === 'client' && r.profiles?.role === 'client'));
    const receivedRating = ratings.find(r => (role === 'driver' && r.profiles?.role === 'client') || (role === 'client' && r.profiles?.role === 'driver'));

    return (
        <div className="space-y-4 pt-4 border-t border-gray-50">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest text-center md:text-left">Calificaciones del Viaje</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {receivedRating && (
                    <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 italic">
                        <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest mb-1">Calificación Recibida</p>
                        <div className="flex items-center gap-1 mb-1">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-3 h-3 ${i < receivedRating.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`} />
                            ))}
                        </div>
                        <p className="text-xs text-gray-700">"{receivedRating.comment || 'Sin comentarios'}"</p>
                    </div>
                )}
                {myRating && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 italic">
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Tu Calificación</p>
                        <div className="flex items-center gap-1 mb-1">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-3 h-3 ${i < myRating.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`} />
                            ))}
                        </div>
                        <p className="text-xs text-gray-500">"{myRating.comment || 'Sin comentarios'}"</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TripDetailModal;
