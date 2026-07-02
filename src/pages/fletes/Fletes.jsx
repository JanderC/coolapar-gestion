import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge } from 'react-bootstrap';
import * as fletesApi from '../../api/fletes.api';
import * as transportadoresApi from '../../api/transportadores.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const formVacio = { transportador_id: '', fecha: '', monto_flete: '', adelanto: '', observaciones: '' };

const Fletes = () => {
  const [fletes, setFletes] = useState([]);
  const [transportadores, setTransportadores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const [{ data: f }, { data: t }] = await Promise.all([
      fletesApi.listarFletes(),
      transportadoresApi.listarTransportadores(true),
    ]);
    setFletes(f);
    setTransportadores(t);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const seleccionarTransportador = (id) => {
    const t = transportadores.find((tr) => String(tr.id) === String(id));
    setForm({ ...form, transportador_id: id, monto_flete: t?.tarifa_flete_diario || '' });
  };

  const abrirNuevo = () => {
    setForm({ ...formVacio, fecha: new Date().toISOString().slice(0, 10) });
    setError('');
    setMostrarModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await fletesApi.crearFlete(form);
      setMostrarModal(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar el flete.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando fletes..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Fletes diarios</h4>
          <p className="text-muted mb-0">El monto neto descuenta automáticamente los adelantos dados.</p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          + Registrar flete
        </Button>
      </div>

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Transportador</th>
            <th>Fecha</th>
            <th>Monto flete</th>
            <th>Adelanto</th>
            <th>Neto a pagar</th>
          </tr>
        </thead>
        <tbody>
          {fletes.map((f) => (
            <tr key={f.id}>
              <td>{f.Transportador?.nombre}</td>
              <td>{f.fecha}</td>
              <td>Bs. {f.monto_flete}</td>
              <td>
                {f.adelanto > 0 ? <Badge bg="warning" text="dark">Bs. {f.adelanto}</Badge> : '—'}
              </td>
              <td className="fw-semibold">Bs. {f.monto_neto}</td>
            </tr>
          ))}
          {fletes.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted py-4">
                No hay fletes registrados.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>Registrar flete</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Transportador</Form.Label>
              <Form.Select
                value={form.transportador_id}
                onChange={(e) => seleccionarTransportador(e.target.value)}
                required
              >
                <option value="">Selecciona un transportador</option>
                {transportadores.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Fecha</Form.Label>
              <Form.Control
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Monto de flete</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={form.monto_flete}
                onChange={(e) => setForm({ ...form, monto_flete: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Adelanto (si aplica)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={form.adelanto}
                onChange={(e) => setForm({ ...form, adelanto: e.target.value })}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Observaciones</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
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

export default Fletes;
