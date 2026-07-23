import React from 'react';
import { Nav } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';

// Módulos activos. El resto quedó fuera del menú a propósito;
// el código sigue en el repo, solo no se navega.
const enlaces = [
  { to: '/productores', label: 'Productores' },
  { to: '/registro-leche', label: 'Registro diario de leche' },
  { to: '/ruteros', label: 'Ruteros' },
  { to: '/insumos', label: 'Inventario de insumos' },
];

const Sidebar = ({ onNavigate, mostrarEncabezado = true }) => {
  return (
    <div className="sidebar p-3 h-100">
      {mostrarEncabezado && <h5 className="text-white mb-4 text-center">🧀 COOLAPAR</h5>}
      <Nav className="flex-column gap-1">
        {enlaces.map((enlace) => (
          <Nav.Link key={enlace.to} as={NavLink} to={enlace.to} onClick={onNavigate}>
            {enlace.label}
          </Nav.Link>
        ))}
      </Nav>
    </div>
  );
};

export default Sidebar;
