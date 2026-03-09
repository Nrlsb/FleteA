import { supabase } from './supabase';

const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
};

export const apiGet = async (path) => {
    const headers = await getAuthHeaders();
    return fetch(`${import.meta.env.VITE_API_URL}${path}`, { headers });
};

export const apiPost = async (path, body) => {
    const headers = await getAuthHeaders();
    return fetch(`${import.meta.env.VITE_API_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
};

export const apiDelete = async (path) => {
    const headers = await getAuthHeaders();
    return fetch(`${import.meta.env.VITE_API_URL}${path}`, {
        method: 'DELETE',
        headers
    });
};
