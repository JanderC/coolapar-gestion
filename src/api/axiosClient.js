import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://coolapar-backend-production.up.railway.app/api',
});

// Adjunta el token JWT guardado en localStorage a cada peticion.
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('coolapar_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Si el backend responde 401, cierra la sesion local y manda al login.
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('coolapar_token');
      localStorage.removeItem('coolapar_usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
