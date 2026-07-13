import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge } from 'react-bootstrap';
import * as productoresApi from '../../api/productores.api';
import ColorBadge from '../../components/common/ColorBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';

const coloresSugeridos = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00897B', '#6D4C41', '#3949AB'];

const formVacio = {
  nombre: '',
  color_identificativo: coloresSugeridos[0],
  telefono: '',
  direccion: '',
  precio_litro_base: '',
  moneda: 'BS',
};

const OPCIONES_MONEDA = [
  { codigo: 'BS', etiqueta: 'Bs. — Bolivares' },
  { codigo: 'USD', etiqueta: '$ — Dólares' },
  { codigo: 'COP', etiqueta: 'COL$ — Pesos colombianos' },
];

const Productores = () => {
  const { formatearMontoEnMoneda } = useMoneda();
  const [productores, setProductores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const { data } = await productoresApi.listarProductores();
      setProductores(data);
    } catch (err) {
      setError('No se pudieron cargar los productores.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(formVacio);
    setMostrarModal(true);
  };

  const abrirEditar = (productor) => {
    setEditandoId(productor.id);
    setForm({
      nombre: productor.nombre,
      color_identificativo: productor.color_identificativo,
      telefono: productor.telefono || '',
      direccion: productor.direccion || '',
      precio_litro_base: productor.precio_litro_base || '',
      moneda: productor.moneda || 'BOB',
    });
    setMostrarModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      if (editandoId) {
        await productoresApi.actualizarProductor(editandoId, form);
      } else {
        await productoresApi.crearProductor(form);
      }
      setMostrarModal(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el productor.');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (id) => {
    if (!window.confirm('¿Desactivar este productor?')) return;
    await productoresApi.eliminarProductor(id);
    await cargar();
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando productores..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Productores</h4>
          <p className="text-muted mb-0">Cada productor tiene un color distintivo para identificarlo en el sistema.</p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          + Nuevo productor
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Productor</th>
            <th>Teléfono</th>
            <th>Dirección</th>
            <th>Precio litro base</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {productores.map((p) => (
            <tr key={p.id}>
              <td>
                <ColorBadge color={p.color_identificativo} texto={p.nombre} />
              </td>
              <td>{p.telefono || '—'}</td>
              <td>{p.direccion || '—'}</td>
              <td>{p.precio_litro_base ? formatearMontoEnMoneda(p.precio_litro_base, p.moneda) : '—'}</td>
              <td>
                <Badge bg={p.activo ? 'success' : 'secondary'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
              </td>
              <td className="text-end">
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirEditar(p)}>
                  Editar
                </Button>
                {p.activo && (
                  <Button size="sm" variant="outline-danger" onClick={() => desactivar(p.id)}>
                    Desactivar
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {productores.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted py-4">
                Aún no hay productores registrados.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar productor' : 'Nuevo productor'}</Modal.Title>
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
              <Form.Label>Color identificativo</Form.Label>
              <div className="d-flex gap-2 flex-wrap">
                {coloresSugeridos.map((c) => (
                  <span
                    key={c}
                    onClick={() => setForm({ ...form, color_identificativo: c })}
                    style={{
                      backgroundColor: c,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'inline-block',
                      border: form.color_identificativo === c ? '3px solid #333' : '2px solid #ddd',
                    }}
                  />
                ))}
              </div>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Teléfono</Form.Label>
              <Form.Control
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Dirección</Form.Label>
              <Form.Control
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Precio por litro base</Form.Label>
              <div className="d-flex align-items-center gap-2">
                <Form.Select
                  value={form.moneda}
                  onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                  style={{ maxWidth: 190 }}
                >
                  {OPCIONES_MONEDA.map((op) => (
                    <option key={op.codigo} value={op.codigo}>
                      {op.etiqueta}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={form.precio_litro_base}
                  onChange={(e) => setForm({ ...form, precio_litro_base: e.target.value })}
                />
              </div>
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

export default Productores;