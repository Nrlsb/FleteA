import { useState } from 'react';
import { Star } from 'lucide-react';

const RatingModal = ({ isOpen, onClose, onSubmit, title = "Calificar Viaje" }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [hoveredRating, setHoveredRating] = useState(0);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (rating === 0) return;
        onSubmit({ rating, comment });
        setRating(0);
        setComment('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100">
                <h3 className="text-xl font-bold text-gray-900 text-center mb-4">{title}</h3>

                <div className="flex justify-center gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            onClick={() => setRating(star)}
                            className="focus:outline-none transition-transform hover:scale-110"
                        >
                            <Star
                                className={`w-8 h-8 ${star <= (hoveredRating || rating)
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                    }`}
                            />
                        </button>
                    ))}
                </div>

                <textarea
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-4"
                    rows="3"
                    placeholder="Deja un comentario (opcional)..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                />

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition"
                    >
                        Omitir
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={rating === 0}
                        className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Enviar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RatingModal;
