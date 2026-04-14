import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, User, Truck } from 'lucide-react';
import { Button } from './ui/button';
import { apiPost } from '../services/api';
import { useRealtime } from '../hooks/useRealtime';

const Chat = ({ tripId, receiverName, receiverRole }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState('');
    const scrollRef = useRef(null);

    const { data: messages = [], isLoading } = useQuery({
        queryKey: ['chat', tripId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('trip_id', tripId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data;
        },
    });

    useRealtime('messages', `trip_id=eq.${tripId}`, ['chat', tripId]);

    const sendMutation = useMutation({
        mutationFn: (content) => apiPost('/api/chat', { trip_id: tripId, content }),
        onSuccess: () => {
            setMessage('');
            queryClient.invalidateQueries({ queryKey: ['chat', tripId] });
        }
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!message.trim() || sendMutation.isLoading) return;
        sendMutation.mutate(message.trim());
    };

    return (
        <div className="flex flex-col h-[50dvh] min-h-[250px] max-h-[400px] bg-white rounded-xl shadow-inner border overflow-hidden">
            <div className="p-3 bg-gray-50 border-b flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-full">
                    {receiverRole === 'driver' ? <Truck className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-900 leading-none">{receiverName}</p>
                    <p className="text-[10px] text-gray-500 capitalize">{receiverRole}</p>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/30">
                {isLoading ? (
                    <p className="text-center text-xs text-gray-400">Cargando mensajes...</p>
                ) : messages.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-10">No hay mensajes aún. ¡Saluda!</p>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm ${msg.sender_id === user.id ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-gray-800 border rounded-tl-none'}`}>
                                {msg.content}
                                <p className={`text-[9px] mt-1 opacity-70 ${msg.sender_id === user.id ? 'text-right' : 'text-left'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSend} className="p-3 bg-white border-t flex gap-2">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
                <Button type="submit" size="icon" className="rounded-full w-10 h-10" disabled={!message.trim() || sendMutation.isLoading}>
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
    );
};

export default Chat;
