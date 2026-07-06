import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { RoomsPage } from './pages/RoomsPage';
import { RoomPage } from './pages/RoomPage';
import { DashboardPage } from './pages/DashboardPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/rooms" replace />} />

          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/rooms/:id" element={<RoomPage />} />
            <Route path="/rooms/:id/dashboard" element={<DashboardPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/rooms" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
