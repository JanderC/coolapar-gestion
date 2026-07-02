import React, { useEffect, useState } from 'react';
import { Table, Button, Form, Alert, Badge, Card } from 'react-bootstrap';
import * as semanasApi from '../../api/semanasPago.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const SemanasPago = () => {
  const [semanas, setSemanas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fechaInicio, setFechaInicio] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    setCargando(true);
    try {
      const { data } = await semanasApi.listarSemanas();
      setSemanas(data);
    } catch {
      setError('No se pudieron cargar las semanas.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirSemana = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    try {
      await semanasApi.abrirSemana(fechaInicio);
      setMensaje('Semana abierta correctamente.');
      setFechaInicio('');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo abrir la semana.');
    }
  };

  const cerrar = async (id) => {
    if (!window.confirm('¿Cerrar esta semana de pago?')) return;
    await semanasApi.cerrarSemana(id, new Date().toISOString().slice(0, 10));
    await cargar();
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando semanas de pago..." />;

  return (
    <div>
      <h4 className="mb-1">Semanas de pago</h4>
      <p className="text-muted">Registra la fecha de inicio de cada semana para llevar el control de pagos.</p>

      <Card className="mb-4 p-3 border-0 shadow-sm" style={{ maxWidth: 420 }}>
        <Form onSubmit={abrirSemana} className="d-flex gap-2 align-items-end">
          <Form.Group className="flex-grow-1">
            <Form.Label>Nueva semana - fecha de inicio</Form.Label>
            <Form.Control
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              required
            />
          </Form.Group>
          <Button type="submit" variant="success">
            Abrir semana
          </Button>
        </Form>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}
      {mensaje && <Alert variant="success">{mensaje}</Alert>}

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {semanas.map((s) => (
            <tr key={s.id}>
              <td>{s.fecha_inicio}</td>
              <td>{s.fecha_fin || '—'}</td>
              <td>
                <Badge bg={s.estado === 'abierta' ? 'success' : 'secondary'}>{s.estado}</Badge>
              </td>
              <td className="text-end">
                {s.estado === 'abierta' && (
                  <Button size="sm" variant="outline-danger" onClick={() => cerrar(s.id)}>
                    Cerrar semana
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {semanas.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center text-muted py-4">
                No hay semanas registradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default SemanasPago;
