import React from 'react';
import { Nav } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';

const enlaces = [
  { to: '/', label: 'Panel principal', roles: null },
  { to: '/productores', label: 'Productores', roles: null },
  { to: '/semanas-pago', label: 'Semanas de pago', roles: null },
  { to: '/registro-leche', label: 'Registro diario de leche', roles: null },
  { to: '/pagos-productores', label: 'Pagos a productores', roles: null },
  { to: '/transportadores', label: 'Transportadores', roles: null },
  { to: '/fletes', label: 'Fletes', roles: null },
  { to: '/recibidos', label: 'Recibidos', roles: null },
  { to: '/produccion', label: 'Producción / % litro-kilo', roles: null },
  { to: '/insumos', label: 'Insumos', roles: null },
  { to: '/productos', label: 'Productos', roles: null },
  { to: '/cuarto-frio', label: 'Cuarto frío', roles: null },
  { to: '/proveedores', label: 'Proveedores', roles: null },
  { to: '/devoluciones', label: 'Devoluciones', roles: null },
];

const Sidebar = () => {
  return (
    <div className="sidebar p-3">
      <h5 className="text-white mb-4 text-center">🧀 COOLAPAR</h5>
      <Nav className="flex-column gap-1">
        {enlaces.map((enlace) => (
          <Nav.Link key={enlace.to} as={NavLink} to={enlace.to} end={enlace.to === '/'}>
            {enlace.label}
          </Nav.Link>
        ))}
      </Nav>
    </div>
  );
};

export default Sidebar;
