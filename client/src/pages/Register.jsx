import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

const Register = () => {
    const [searchParams] = useSearchParams();
    const initialRole = searchParams.get('role') === 'driver' ? 'driver' : 'client';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState(initialRole);
    const [vehicleType, setVehicleType] = useState('moto');

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // 1. Sign Up with Supabase Auth
            const { data: authData, error: authError } = await register(email, password, {
                full_name: fullName,
                role: role,
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('No user created');

            // 2. Create Profile in public.profiles
            // Note: If you have a Trigger to create profile, this step might trigger a duplicate key error or be redundant.
            // Assuming NO Trigger for MVP (safe approach).
            const profileData = {
                id: authData.user.id,
                email: email,
                full_name: fullName,
                role: role,
                vehicle_type: role === 'driver' ? vehicleType : null,
                is_available: role === 'driver' ? false : null
            };

            const { error: profileError } = await supabase
                .from('profiles')
                .insert([profileData]);

            if (profileError) {
                console.error('Profile creation error:', profileError);
                // If duplicate key (trigger exists), ignore. Else throw.
                if (!profileError.message.includes('duplicate key')) {
                    throw profileError;
                }
            }

            navigate('/dashboard'); // Or /driver based on role, logic in Layout/Protected route will handle redirection
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[80vh] py-10">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Crear Cuenta</h1>
                    <p className="text-gray-500 mt-2">Únete a Fletea hoy mismo</p>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            placeholder="Juan Pérez"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <div className="pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Quiero ser:</label>
                        <div className="flex gap-4">
                            <label className={`flex-1 py-2 px-4 rounded-lg border cursor-pointer text-center transition ${role === 'client' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                <input type="radio" className="hidden" name="role" value="client" checked={role === 'client'} onChange={() => setRole('client')} />
                                Usuario
                            </label>
                            <label className={`flex-1 py-2 px-4 rounded-lg border cursor-pointer text-center transition ${role === 'driver' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                <input type="radio" className="hidden" name="role" value="driver" checked={role === 'driver'} onChange={() => setRole('driver')} />
                                Chofer
                            </label>
                        </div>
                    </div>

                    {role === 'driver' && (
                        <div className="animate-fade-in">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Vehículo</label>
                            <select
                                value={vehicleType}
                                onChange={(e) => setVehicleType(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            >
                                <option value="moto">Moto</option>
                                <option value="auto">Auto</option>
                                <option value="camioneta">Camioneta</option>
                                <option value="camion">Camión</option>
                            </select>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 mt-6"
                    >
                        {loading ? 'Registrando...' : 'Crear Cuenta'}
                    </button>
                </form>
                <div className="mt-6 text-center text-sm text-gray-600">
                    ¿Ya tienes cuenta? <Link to="/login" className="text-blue-600 hover:underline font-medium">Inicia Sesión</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
