import React from 'react';
import { Row, Col, Card } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { usuario } = useAuth();

  return (
    <div>
      <h3 className="mb-1">Bienvenido, {usuario?.nombre} 👋</h3>
      <p className="text-muted mb-4">Panel principal de COOLAPAR</p>

      <Row className="g-3">
        <Col md={4}>
          <Card className="card-stat p-3">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Productores activos</Card.Title>
              <Card.Text className="fs-2 fw-bold text-success">--</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="card-stat p-3">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Litros recibidos hoy</Card.Title>
              <Card.Text className="fs-2 fw-bold text-success">--</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="card-stat p-3">
            <Card.Body>
              <Card.Title className="text-muted fs-6">Kilos en cuarto frío</Card.Title>
              <Card.Text className="fs-2 fw-bold text-success">--</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <p className="text-muted mt-4">
        Estas tarjetas se conectarán a los endpoints reales en la siguiente iteración del dashboard.
      </p>
    </div>
  );
};

export default Dashboard;
