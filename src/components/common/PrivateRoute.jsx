import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

// Protege rutas que requieren sesion iniciada. Si se pasa `rolesPermitidos`,
// tambien valida que el rol del usuario este autorizado.
const PrivateRoute = ({ children, rolesPermitidos }) => {
  const { estaAutenticado, usuario, cargando } = useAuth();

  if (cargando) return <LoadingSpinner />;

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;
