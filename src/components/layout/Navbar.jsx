import React from 'react';
import { Navbar as BsNavbar, Container, Dropdown } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const handleCerrarSesion = () => {
    cerrarSesion();
    navigate('/login');
  };

  return (
    <BsNavbar bg="white" className="border-bottom shadow-sm px-3" sticky="top">
      <Container fluid>
        <BsNavbar.Brand className="fw-bold text-success">Edo. Táchira</BsNavbar.Brand>
        <Dropdown align="end">
          <Dropdown.Toggle variant="light" id="dropdown-usuario">
            {usuario?.nombre} ({usuario?.rol})
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
