import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
    const { user, profile, loading } = useAuth();

    if (loading) return <div className="flex justify-center items-center h-screen">Cargando...</div>;

    if (user && profile) {
        if (profile.role === 'driver') {
            return <Navigate to="/driver" />;
        } else {
            return <Navigate to="/dashboard" />;
        }
    }

    return (
        <div className="text-center py-20 px-4">
            <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight sm:text-6xl mb-6">
                Tu flete en <span className="text-blue-600">Santa Fe</span>
            </h1>
            <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto mb-10">
                Conectamos usuarios con fletes y mudanzas en Santa Fe, Esperanza y Santo Tomé. Rápido, seguro y transparente.
            </p>
            <div className="flex justify-center gap-4">
                <Link to="/register" className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                    Pedir Flete Ahora
                </Link>
                <Link to="/register?role=driver" className="px-8 py-3 bg-white text-blue-600 border border-blue-200 rounded-lg font-semibold hover:bg-blue-50 transition shadow-sm">
                    Soy Chofer
                </Link>
            </div>

            {/* Feature Grid */}
            <div className="grid md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto">
                <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Rápido y Fácil</h3>
                    <p className="text-gray-500">Pide tu flete en segundos. Sin llamadas interminables.</p>
                </div>
                <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Precio Justo</h3>
                    <p className="text-gray-500">Cotización transparente basada en kilómetros. Sin sorpresas.</p>
                </div>
                <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Seguridad</h3>
                    <p className="text-gray-500">Choferes verificados y calificados por la comunidad.</p>
                </div>
            </div>
        </div>
    );
};

export default Home;
