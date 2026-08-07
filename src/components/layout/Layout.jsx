import React, { useState, useEffect } from 'react';
import { Offcanvas } from 'react-bootstrap';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const CLAVE_COLAPSADO = 'coolapar_sidebar_colapsado';

const Layout = ({ children }) => {
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [colapsado, setColapsado] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_COLAPSADO) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_COLAPSADO, colapsado ? '1' : '0');
    } catch {
      // localStorage no disponible (modo privado, etc.); se ignora sin romper la app
    }
  }, [colapsado]);

  return (
    <>
      <div className="app-shell d-flex">
        {/* Sidebar fijo, solo visible en pantallas md en adelante. Se puede contraer a solo íconos */}
        <div className={`app-sidebar d-none d-md-block${colapsado ? ' app-sidebar--colapsado' : ''}`}>
          <Sidebar colapsado={colapsado} onToggleColapsar={() => setColapsado((v) => !v)} />
        </div>

        <div className="app-content d-flex flex-column flex-grow-1">
          <Navbar onToggleSidebar={() => setMostrarMenu(true)} />
          <main className="flex-grow-1 p-3 p-md-4">{children}</main>
        </div>
      </div>

      {/* Menu deslizante, solo en mobile (oculto en md en adelante via CSS) */}
      <Offcanvas
        show={mostrarMenu}
        onHide={() => setMostrarMenu(false)}
        className="sidebar-offcanvas d-md-none"
        responsive="md"
      >
        <Offcanvas.Header closeButton closeVariant="white" className="sidebar-offcanvas-header">
          <Offcanvas.Title className="text-white fw-bold">🧀 COOLAPAR</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          <Sidebar onNavigate={() => setMostrarMenu(false)} mostrarEncabezado={false} />
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
};

export default Layout;