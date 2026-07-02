import React, { createContext, useContext, useState, useEffect } from 'react';
import * as authApi from '../api/auth.api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('coolapar_usuario');
    const token = localStorage.getItem('coolapar_token');

    if (usuarioGuardado && token) {
      setUsuario(JSON.parse(usuarioGuardado));
    }

    setCargando(false);
  }, []);

  const iniciarSesion = async (email, password) => {
    const { data } = await authApi.login(email, password);

    const usuarioData = {
      id: data.id,
      nombre: data.nombre,
      email: data.email,
      rol: data.rol,
    };

    localStorage.setItem('coolapar_token', data.token);
    localStorage.setItem('coolapar_usuario', JSON.stringify(usuarioData));
    setUsuario(usuarioData);

    return usuarioData;
  };

  const cerrarSesion = () => {
    localStorage.removeItem('coolapar_token');
    localStorage.removeItem('coolapar_usuario');
    setUsuario(null);
  };

  const estaAutenticado = !!usuario;

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion, estaAutenticado }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
