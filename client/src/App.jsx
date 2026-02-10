import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import DriverDashboard from './pages/DriverDashboard';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div>Cargando...</div>;

  if (!user) return <Navigate to="/login" />;

  // If user is authenticated but has no profile, prevent redirect loop
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-xl font-bold text-red-600 mb-2">Error de Perfil</h2>
        <p className="text-gray-600">No se encontró un perfil para este usuario.</p>
        <p className="text-gray-500 text-sm mt-2">Por favor, contacta a soporte.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (allowedRole && profile?.role !== allowedRole) {
    // Redirect to their appropriate dashboard if wrong role
    return profile?.role === 'driver'
      ? <Navigate to="/driver" />
      : <Navigate to="/dashboard" />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/dashboard" element={
              <ProtectedRoute allowedRole="client">
                <UserDashboard />
              </ProtectedRoute>
            } />

            <Route path="/driver" element={
              <ProtectedRoute allowedRole="driver">
                <DriverDashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  );
}

export default App;
