import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Truck, MapPin } from 'lucide-react';
import { useState } from 'react';

const Layout = ({ children }) => {
    const { user, profile, logout } = useAuth();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            <nav className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <Link to="/" className="flex-shrink-0 flex items-center">
                                <img className="h-10 w-auto" src="/src/assets/logo.jpeg" alt="Fletea" />
                                <span className="ml-2 text-xl font-bold text-blue-900">Fletea</span>
                            </Link>
                        </div>

                        <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
                            {user ? (
                                <>
                                    <span className="text-gray-700">Hola, {profile?.full_name || user.email}</span>
                                    {profile?.role === 'driver' && (
                                        <Link to="/driver" className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">Panel Chofer</Link>
                                    )}
                                    {profile?.role === 'client' && (
                                        <Link to="/dashboard" className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">Pedir Flete</Link>
                                    )}
                                    <button onClick={handleLogout} className="flex items-center text-gray-600 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium">
                                        <LogOut className="h-4 w-4 mr-1" /> Salir
                                    </button>
                                </>
                            ) : (
                                <div className="space-x-4">
                                    <Link to="/login" className="text-gray-600 hover:text-blue-600 font-medium">Iniciar Sesión</Link>
                                    <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">Registrarse</Link>
                                </div>
                            )}
                        </div>

                        {/* Mobile menu button */}
                        <div className="flex items-center sm:hidden">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-600 hover:text-blue-600 focus:outline-none p-2">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {isMenuOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="sm:hidden bg-white border-t border-gray-200">
                        <div className="px-2 pt-2 pb-3 space-y-1">
                            {user ? (
                                <>
                                    <div className="px-3 py-2 text-gray-700 font-medium">Hola, {profile?.full_name || user.email}</div>
                                    {profile?.role === 'driver' && (
                                        <Link to="/driver" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50">Panel Chofer</Link>
                                    )}
                                    {profile?.role === 'client' && (
                                        <Link to="/dashboard" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50">Pedir Flete</Link>
                                    )}
                                    <button onClick={handleLogout} className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-gray-50">
                                        <span className="flex items-center"><LogOut className="h-4 w-4 mr-2" /> Salir</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50">Iniciar Sesión</Link>
                                    <Link to="/register" className="block px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-blue-50">Registrarse</Link>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </nav>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {children}
            </main>
        </div>
    );
};

export default Layout;
