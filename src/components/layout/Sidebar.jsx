import React from 'react';
import { Nav, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';

// --- Iconos en línea (sin dependencias nuevas) ---
const IconProductores = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="10" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconLeche = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 2h6" />
    <path d="M10 2v4.2a3 3 0 0 1-.6 1.8L8 10.6A4 4 0 0 0 7.2 13v7.2A1.8 1.8 0 0 0 9 22h6a1.8 1.8 0 0 0 1.8-1.8V13a4 4 0 0 0-.8-2.4l-1.4-2.6A3 3 0 0 1 14 6.2V2" />
    <path d="M7.5 15h9" />
  </svg>
);

const IconRuteros = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 17h1a2 2 0 0 0 2-2V8a2 2 0 0 1 2-2h6l5 5v4a2 2 0 0 1-2 2h-1" />
    <circle cx="7.5" cy="17.5" r="1.8" />
    <circle cx="16.5" cy="17.5" r="1.8" />
    <path d="M14 6v5h5" />
  </svg>
);

const IconInsumos = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 8 12 3 3 8l9 5 9-5Z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
);

const IconProduccion = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 2h6" />
    <path d="M10 2v5l-5.5 9.5A2 2 0 0 0 6.2 20h11.6a2 2 0 0 0 1.7-3.03L14 7V2" />
    <path d="M6.5 14h11" />
  </svg>
);

const IconCuartoFrio = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2v20" />
    <path d="M4.5 6.5 19.5 17.5" />
    <path d="M19.5 6.5 4.5 17.5" />
    <path d="M12 6 9.5 3.5M12 6l2.5-2.5" />
    <path d="M12 18l-2.5 2.5M12 18l2.5 2.5" />
  </svg>
);

const IconChevron = ({ colapsado }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points={colapsado ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} />
  </svg>
);

// Módulos activos. El resto quedó fuera del menú a propósito;
// el código sigue en el repo, solo no se navega.
const enlaces = [
  { to: '/productores', label: 'Productores', icon: IconProductores },
  { to: '/registro-leche', label: 'Registro diario de leche', icon: IconLeche },
  { to: '/ruteros', label: 'Ruteros', icon: IconRuteros },
  { to: '/insumos', label: 'Inventario de insumos', icon: IconInsumos },
  { to: '/produccion', label: 'Creación de producto', icon: IconProduccion },
  { to: '/cuarto-frio', label: 'Cuarto frío', icon: IconCuartoFrio },
];

const Sidebar = ({ onNavigate, mostrarEncabezado = true, colapsado = false, onToggleColapsar }) => {
  return (
    <div className={`sidebar h-100 d-flex flex-column${colapsado ? ' sidebar--colapsado' : ''}`}>
      {mostrarEncabezado && (
        <div className="sidebar-header d-flex align-items-center">
          <span className="sidebar-brand-icon">🧀</span>
          <span className="sidebar-brand-text fw-bold">COOLAPAR</span>
        </div>
      )}

      <Nav className="sidebar-nav flex-column gap-1 flex-grow-1">
        {enlaces.map((enlace) => {
          const Icono = enlace.icon;
          const contenido = (
            <Nav.Link
              as={NavLink}
              to={enlace.to}
              onClick={onNavigate}
              className="sidebar-link d-flex align-items-center gap-2"
            >
              <Icono className="sidebar-link-icon flex-shrink-0" />
              <span className="sidebar-link-text">{enlace.label}</span>
            </Nav.Link>
          );

          return (
            <React.Fragment key={enlace.to}>
              {colapsado ? (
                <OverlayTrigger placement="right" overlay={<Tooltip>{enlace.label}</Tooltip>}>
                  {contenido}
                </OverlayTrigger>
              ) : (
                contenido
              )}
            </React.Fragment>
          );
        })}
      </Nav>

      {onToggleColapsar && (
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleColapsar}
          aria-label={colapsado ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!colapsado}
        >
          <IconChevron colapsado={colapsado} />
          <span className="sidebar-toggle-text">Contraer</span>
        </button>
      )}
    </div>
  );
};

export default Sidebar;