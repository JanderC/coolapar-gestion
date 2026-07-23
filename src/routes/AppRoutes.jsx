import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from '../components/common/PrivateRoute';
import Layout from '../components/layout/Layout';

import Login from '../pages/Login';
import Productores from '../pages/productores/Productores';
import RegistroLeche from '../pages/registroLeche/RegistroLeche';
import Ruteros from '../pages/ruteros/Ruteros';
import Insumos from '../pages/insumos/Insumos';

// Módulos fuera de servicio. Los archivos siguen en el repo; si hay que
// reactivar alguno, se descomenta su import y su <Route>.
// import Dashboard from '../pages/Dashboard';
// import SemanasPago from '../pages/semanas/SemanasPago';
// import PagosProductores from '../pages/pagos/PagosProductores';
// import Fletes from '../pages/fletes/Fletes';
// import Recibidos from '../pages/recibidos/Recibidos';
// import LotesProduccion from '../pages/produccion/LotesProduccion';
// import Productos from '../pages/productos/Productos';
// import CuartoFrio from '../pages/cuartoFrio/CuartoFrio';
// import Proveedores from '../pages/proveedores/Proveedores';
// import Devoluciones from '../pages/devoluciones/Devoluciones';

// Envuelve cada página con el layout general (sidebar + navbar) y la
// protección de sesión, para no repetirlo en cada <Route>.
const conLayout = (Componente) => (
  <PrivateRoute>
    <Layout>
      <Componente />
    </Layout>
  </PrivateRoute>
);

const INICIO = '/registro-leche';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<Navigate to={INICIO} replace />} />

      <Route path="/productores" element={conLayout(Productores)} />
      <Route path="/registro-leche" element={conLayout(RegistroLeche)} />
      <Route path="/ruteros" element={conLayout(Ruteros)} />
      <Route path="/insumos" element={conLayout(Insumos)} />

      {/* Enlaces viejos que la gente puede tener guardados */}
      <Route path="/transportadores" element={<Navigate to="/ruteros" replace />} />
      <Route path="/semanas-pago" element={<Navigate to={INICIO} replace />} />
      <Route path="/pagos-productores" element={<Navigate to={INICIO} replace />} />

      <Route path="*" element={<Navigate to={INICIO} replace />} />
    </Routes>
  );
};

export default AppRoutes;