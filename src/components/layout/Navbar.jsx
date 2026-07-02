import React from 'react';
import { Navbar as BsNavbar, Container, Dropdown, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = ({ onToggleSidebar }) => {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const handleCerrarSesion = () => {
    cerrarSesion();
    navigate('/login');
  };

  return (
    <BsNavbar bg="white" className="border-bottom shadow-sm px-3" sticky="top">
      <Container fluid className="px-0 d-flex justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <Button
            variant="light"
            className="d-md-none border"
            onClick={onToggleSidebar}
            aria-label="Abrir menú"
          >
            ☰
          </Button>
          <BsNavbar.Brand className="fw-bold text-success mb-0">Edo. Táchira</BsNavbar.Brand>
        </div>
        <Dropdown align="end">
          <Dropdown.Toggle variant="light" id="dropdown-usuario" size="sm">
            <span className="d-none d-sm-inline">
              {usuario?.nombre} ({usuario?.rol})
            </span>
            <span className="d-inline d-sm-none">{usuario?.nombre}</span>
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={handleCerrarSesion}>Cerrar sesión</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </Container>
    </BsNavbar>
  );
};

export default Navbar;
