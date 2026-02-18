import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login"; // Ajusta las rutas de tus archivos
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta inicial: si hay token va al dashboard, si no al login */}
        <Route path="/" element={<Login />} />
        
        {/* Ruta de Registro */}
        <Route path="/register" element={<Register />} />

        {/* Ruta Protegida del Dashboard */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />

        {/* Redirigir cualquier otra ruta al inicio */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;