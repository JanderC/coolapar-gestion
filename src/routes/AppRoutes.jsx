import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from '../components/common/PrivateRoute';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';

import Login from '../pages/Login';
import Productores from '../pages/productores/Productores';
import RegistroLeche from '../pages/registroLeche/RegistroLeche';
import Ruteros from '../pages/ruteros/Ruteros';
import Insumos from '../pages/insumos/Insumos';
import Produccion from '../pages/produccion/Produccion';
import CuartoFrio from '../pages/cuartoFrio/CuartoFrio';
import Nomina from '../pages/nomina/Nomina';
import Equipos from '../pages/equipos/Equipos';
import Sucursales from '../pages/sucursales/Sucursales';
import SucursalDetalle from '../pages/sucursales/SucursalDetalle';
import Usuarios from '../pages/usuarios/Usuarios';
import Ventas from '../pages/ventas/Ventas';
import Reportes from '../pages/reportes/Reportes';
import MiSucursal from '../pages/sucursales/MiSucursal';

// Módulos fuera de servicio. Los archivos siguen en el repo; si hay que
// reactivar alguno, se descomenta su import y su <Route>.
// import Dashboard from '../pages/Dashboard';
// import SemanasPago from '../pages/semanas/SemanasPago';
// import PagosProductores from '../pages/pagos/PagosProductores';
// import Fletes from '../pages/fletes/Fletes';
// import Recibidos from '../pages/recibidos/Recibidos';
// import LotesProduccion from '../pages/produccion/LotesProduccion';
// import Productos from '../pages/productos/Productos';
// import Proveedores from '../pages/proveedores/Proveedores';

// Envuelve cada página con el layout general (sidebar + navbar) y la
// protección de sesión, para no repetirlo en cada <Route>.
const conLayout = (Componente, rolesPermitidos) => (
  <PrivateRoute rolesPermitidos={rolesPermitidos}>
    <Layout>
      <Componente />
    </Layout>
  </PrivateRoute>
);

const PLANTA = ['admin', 'operador', 'contabilidad'];

const INICIO = '/registro-leche';
const INICIO_SUCURSAL = '/mi-sucursal';

/**
 * A donde va cada quien al entrar. Un usuario de sucursal no tiene nada
 * que hacer en el registro de leche, asi que aterriza en su pantalla.
 */
const Inicio = () => {
  const { usuario } = useAuth();
  return <Navigate to={usuario?.rol === 'sucursal' ? INICIO_SUCURSAL : INICIO} replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<Inicio />} />

      <Route path="/productores" element={conLayout(Productores, PLANTA)} />
      <Route path="/registro-leche" element={conLayout(RegistroLeche, PLANTA)} />
      <Route path="/ruteros" element={conLayout(Ruteros, PLANTA)} />
      <Route path="/insumos" element={conLayout(Insumos, PLANTA)} />
      <Route path="/produccion" element={conLayout(Produccion, PLANTA)} />
      <Route path="/cuarto-frio" element={conLayout(CuartoFrio, PLANTA)} />
      {/* Empleados, compras, préstamos y libro de caja: son cuatro
          pestañas dentro de la misma pantalla. */}
      <Route path="/pagos" element={conLayout(Nomina, ['admin', 'contabilidad'])} />
      {/* Inventario suelto: no se relaciona con insumos ni con producción. */}
      <Route path="/equipos" element={conLayout(Equipos, PLANTA)} />
      <Route path="/sucursales" element={conLayout(Sucursales, ['admin', 'contabilidad'])} />
      {/* El desglose de una sucursal: sus ventas, su inventario y lo que se le envió. */}
      <Route path="/sucursales/:id" element={conLayout(SucursalDetalle, ['admin', 'contabilidad', 'operador'])} />
      <Route path="/usuarios" element={conLayout(Usuarios, ['admin'])} />
      <Route path="/ventas" element={conLayout(Ventas, PLANTA)} />
      <Route path="/reportes" element={conLayout(Reportes, ['admin', 'contabilidad'])} />

      {/* Lo único que alcanza un usuario de sucursal. */}
      <Route path="/mi-sucursal" element={conLayout(MiSucursal, ['sucursal'])} />

      {/* Enlaces viejos que la gente puede tener guardados */}
      <Route path="/transportadores" element={<Navigate to="/ruteros" replace />} />
      <Route path="/semanas-pago" element={<Navigate to={INICIO} replace />} />
      <Route path="/pagos-productores" element={<Navigate to={INICIO} replace />} />
      {/* Las devoluciones viven dentro de Cuarto frío, y los pagos
          quedaron todos bajo /pagos. */}
      <Route path="/devoluciones" element={<Navigate to="/cuarto-frio" replace />} />
      <Route path="/nomina" element={<Navigate to="/pagos" replace />} />
      <Route path="/caja" element={<Navigate to="/pagos" replace />} />

      <Route path="*" element={<Inicio />} />
    </Routes>
  );
};

export default AppRoutes;