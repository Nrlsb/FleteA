import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null); // Extended profile (role, etc.)
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Init session from localStorage (Simulated Session)
        const storedUser = localStorage.getItem('fletea_user');
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                setProfile(parsedUser); // In this simple model, user has profile data
            } catch (e) {
                console.error("Error parsing stored user", e);
                localStorage.removeItem('fletea_user');
            }
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            // Query public.users table
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .eq('password', password) // Plain text pending hash implementation
                .maybeSingle();

            if (error) throw new Error('Credenciales inválidas o usuario no encontrado');
            if (!data) throw new Error('Usuario no encontrado');

            // Set session
            setUser(data);
            setProfile(data);
            localStorage.setItem('fletea_user', JSON.stringify(data));

            return { data: { user: data }, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    };

    const logout = async () => {
        setUser(null);
        setProfile(null);
        localStorage.removeItem('fletea_user');
        // Optional: clear supabase auth too if mixed usage
        return supabase.auth.signOut();
    };

    const register = async (email, password, metadata = {}) => {
        try {
            // Check if user exists
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (existingUser) {
                throw new Error('El usuario ya existe');
            }

            const newUser = {
                email,
                password, // Plain text for dev
                full_name: metadata.full_name,
                role: metadata.role,
                vehicle_type: metadata.role === 'driver' ? metadata.vehicle_type : null,
                is_available: metadata.role === 'driver' ? false : null,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('users')
                .insert([newUser])
                .select()
                .single();

            if (error) throw error;

            // Auto-login on register
            setUser(data);
            setProfile(data);
            localStorage.setItem('fletea_user', JSON.stringify(data));

            return { data: { user: data }, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, login, logout, register }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
