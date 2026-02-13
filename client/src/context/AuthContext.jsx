import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null); // Extended profile (role, etc.)
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session and subscribe to auth changes
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setUser(session.user);
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setUser(session.user);
                fetchProfile(session.user.id);
            } else {
                setUser(null);
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (data) setProfile(data);
        setLoading(false);
    };

    const login = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            return { data, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    };

    const logout = async () => {
        return supabase.auth.signOut();
    };

    const register = async (email, password, metadata = {}) => {
        try {
            // 1. Sign Up in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            // 2. Insert into public.profiles
            const newProfile = {
                id: authData.user.id,
                email,
                full_name: metadata.full_name,
                role: metadata.role,
                vehicle_type: metadata.role === 'driver' ? metadata.vehicle_type : null,
                is_available: metadata.role === 'driver' ? false : null,
                created_at: new Date().toISOString()
            };

            const { error: profileError } = await supabase
                .from('profiles')
                .insert([newProfile]);

            if (profileError) {
                console.error("Error creating profile:", profileError);
                // We don't throw here to allow the user to at least be registered in Auth
            }

            return { data: authData, error: null };
        } catch (err) {
            return { data: null, error: err };
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, login, logout, register }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
