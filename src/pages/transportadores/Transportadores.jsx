import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge } from 'react-bootstrap';
import * as transportadoresApi from '../../api/transportadores.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const formVacio = { nombre: '', telefono: '', tarifa_flete_diario: '' };

const Transportadores = () => {
  const [transportadores, setTransportadores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const { data } = await transportadoresApi.listarTransportadores();
    setTransportadores(data);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(formVacio);
    setMostrarModal(true);
  };

  const abrirEditar = (t) => {
    setEditandoId(t.id);
    setForm({ nombre: t.nombre, telefono: t.telefono || '', tarifa_flete_diario: t.tarifa_flete_diario });
    setMostrarModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      if (editandoId) {
        await transportadoresApi.actualizarTransportador(editandoId, form);
      } else {
        await transportadoresApi.crearTransportador(form);
      }
      setMostrarModal(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el transportador.');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (id) => {
    if (!window.confirm('¿Desactivar este transportador?')) return;
    await transportadoresApi.eliminarTransportador(id);
    await cargar();
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando transportadores..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Transportadores (ruteros)</h4>
          <p className="text-muted mb-0">Pago de flete diario y control de adelantos.</p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          + Nuevo transportador
        </Button>
      </div>

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Tarifa flete diario</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {transportadores.map((t) => (
            <tr key={t.id}>
              <td>{t.nombre}</td>
              <td>{t.telefono || '—'}</td>
              <td>Bs. {t.tarifa_flete_diario}</td>
              <td>
                <Badge bg={t.activo ? 'success' : 'secondary'}>{t.activo ? 'Activo' : 'Inactivo'}</Badge>
              </td>
              <td className="text-end">
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirEditar(t)}>
                  Editar
                </Button>
                {t.activo && (
                  <Button size="sm" variant="outline-danger" onClick={() => desactivar(t.id)}>
                    Desactivar
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {transportadores.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted py-4">
                No hay transportadores registrados.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar transportador' : 'Nuevo transportador'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Teléfono</Form.Label>
              <Form.Control
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Tarifa de flete diario</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={form.tarifa_flete_diario}
                onChange={(e) => setForm({ ...form, tarifa_flete_diario: e.target.value })}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModal(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Transportadores;
