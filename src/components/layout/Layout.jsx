import React, { useState } from 'react';
import { Row, Col, Offcanvas } from 'react-bootstrap';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  const [mostrarMenu, setMostrarMenu] = useState(false);

  return (
    <>
      <Row className="g-0">
        {/* Sidebar fijo, solo visible en pantallas md en adelante */}
        <Col md={3} lg={2} className="d-none d-md-block p-0">
          <Sidebar />
        </Col>

        <Col xs={12} md={9} lg={10} className="p-0">
          <Navbar onToggleSidebar={() => setMostrarMenu(true)} />
          <div className="p-3 p-md-4">{children}</div>
        </Col>
      </Row>

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
