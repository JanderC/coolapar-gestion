import React from 'react';
import { Spinner } from 'react-bootstrap';

const LoadingSpinner = ({ mensaje = 'Cargando...' }) => (
  <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '200px' }}>
    <Spinner animation="border" variant="success" />
    <p className="mt-3 text-muted">{mensaje}</p>
  </div>
);

export default LoadingSpinner;
