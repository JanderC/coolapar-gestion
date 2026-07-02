import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PrivateRoute from '../components/common/PrivateRoute';
import Layout from '../components/layout/Layout';

import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Productores from '../pages/productores/Productores';
import SemanasPago from '../pages/semanas/SemanasPago';
import RegistroLeche from '../pages/registroLeche/RegistroLeche';
import PagosProductores from '../pages/pagos/PagosProductores';
import Transportadores from '../pages/transportadores/Transportadores';
import Fletes from '../pages/fletes/Fletes';
import Recibidos from '../pages/recibidos/Recibidos';
import LotesProduccion from '../pages/produccion/LotesProduccion';
import Insumos from '../pages/insumos/Insumos';
import Productos from '../pages/productos/Productos';
import CuartoFrio from '../pages/cuartoFrio/CuartoFrio';
import Proveedores from '../pages/proveedores/Proveedores';
import Devoluciones from '../pages/devoluciones/Devoluciones';

// Envuelve cada pagina con el layout general (sidebar + navbar) y la
// proteccion de sesion, para no repetirlo en cada <Route>.
const conLayout = (Componente) => (
  <PrivateRoute>
    <Layout>
      <Componente />
    </Layout>
  </PrivateRoute>
);

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={conLayout(Dashboard)} />
      <Route path="/productores" element={conLayout(Productores)} />
      <Route path="/semanas-pago" element={conLayout(SemanasPago)} />
      <Route path="/registro-leche" element={conLayout(RegistroLeche)} />
      <Route path="/pagos-productores" element={conLayout(PagosProductores)} />
      <Route path="/transportadores" element={conLayout(Transportadores)} />
      <Route path="/fletes" element={conLayout(Fletes)} />
      <Route path="/recibidos" element={conLayout(Recibidos)} />
      <Route path="/produccion" element={conLayout(LotesProduccion)} />
      <Route path="/insumos" element={conLayout(Insumos)} />
      <Route path="/productos" element={conLayout(Productos)} />
      <Route path="/cuarto-frio" element={conLayout(CuartoFrio)} />
      <Route path="/proveedores" element={conLayout(Proveedores)} />
      <Route path="/devoluciones" element={conLayout(Devoluciones)} />
    </Routes>
  );
};

export default AppRoutes;
