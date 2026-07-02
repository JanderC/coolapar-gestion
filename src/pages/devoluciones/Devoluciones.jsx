import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert } from 'react-bootstrap';
import * as devolucionesApi from '../../api/devoluciones.api';
import * as proveedoresApi from '../../api/proveedores.api';
import * as productosApi from '../../api/productos.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const formVacio = { fecha: '', proveedor_id: '', producto_id: '', cantidad: '', motivo: '' };

const Devoluciones = () => {
  const [devoluciones, setDevoluciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const [{ data: d }, { data: p }, { data: pr }] = await Promise.all([
      devolucionesApi.listarDevoluciones(),
      proveedoresApi.listarProveedores(),
      productosApi.listarProductos(),
    ]);
    setDevoluciones(d);
    setProveedores(p);
    setProductos(pr);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

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
      await devolucionesApi.crearDevolucion(form);
      setMostrarModal(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar la devolución.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando devoluciones..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Devoluciones</h4>
          <p className="text-muted mb-0">Movimientos aparte, que no dependen de la producción propia de COOLAPAR.</p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          + Nueva devolución
        </Button>
      </div>

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {devoluciones.map((d) => (
            <tr key={d.id}>
              <td>{d.fecha}</td>
              <td>{d.Proveedor?.nombre || '—'}</td>
              <td>{d.Producto?.nombre || '—'}</td>
              <td>{d.cantidad}</td>
              <td>{d.motivo || '—'}</td>
            </tr>
          ))}
          {devoluciones.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted py-4">
                No hay devoluciones registradas.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>Registrar devolución</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
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
              <Form.Label>Proveedor (opcional)</Form.Label>
              <Form.Select
                value={form.proveedor_id}
                onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}
              >
                <option value="">Ninguno</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Producto (opcional)</Form.Label>
              <Form.Select
                value={form.producto_id}
                onChange={(e) => setForm({ ...form, producto_id: e.target.value })}
              >
                <option value="">Ninguno</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Cantidad</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Motivo</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
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

export default Devoluciones;
