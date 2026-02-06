import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setAuth } from "../api"; // Asegúrate de importar setAuth también
import logo from '../assets/logo.png';

export default function Register() {
    const nav = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            // 1. Enviamos los datos al servidor
            const { data } = await api.post("/auth/register", { name, email, password });
            
            // 2. Guardamos el token para entrar directo
            localStorage.setItem("token", data.token);
            setAuth(data.token);
            
            // 3. Redirigimos al Dashboard
            nav("/dashboard"); 
        } catch (err: any) {
            setError(err.response?.data?.message || "Error al crear la cuenta");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-wrap">
            <div className="card">
                <div className="brand">
                    <img src={logo} alt="Logo" className="logo-img" />
                    <h2>Crear Cuenta</h2>
                    <p className="muted">Únete a TO-DO PWA</p>
                </div>
                <form className="form" onSubmit={onSubmit}>
                    <label>Nombre Completo</label>
                    <input 
                        type="text" 
                        placeholder="Tu nombre" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        required 
                    />

                    <label>Email</label>
                    <input 
                        type="email" 
                        placeholder="tucorreo@dominio.com" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                    />

                    <label>Contraseña</label>
                    <input 
                        type="password" 
                        placeholder="Crea una contraseña" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                    />

                    {error && <p className="alert">{error}</p>}
                    
                    <button className="btn primary" disabled={loading}>
                        {loading ? "Registrando..." : "Registrarse"}
                    </button>
                </form>
                <div className="footer-links">
                    <span className="muted">¿Ya tienes cuenta?</span>
                    <Link to="/login">Inicia sesión aquí</Link>
                </div>
            </div>
        </div>
    );
}