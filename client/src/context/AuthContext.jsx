import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null); // Extended profile (role, etc.)
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get session
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        };

        getSession();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
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
            .single();

        if (!error && data) {
            setProfile(data);
        }
        setLoading(false);
    };

    const login = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const logout = async () => {
        return supabase.auth.signOut();
    };

    const register = async (email, password, metadata = {}) => {
        // metadata contains full_name, role, etc.
        return supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });
        // Note: A trigger should create the profile, or we do it manually after signup if trigger fails/not set.
        // For MVP, relying on trigger is better, but consistent manual creates are safer if no trigger exists.
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, login, logout, register }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
