import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge } from 'react-bootstrap';
import * as productosApi from '../../api/productos.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const formVacio = { nombre: '', descripcion: '', unidad_medida: 'kg', precio_venta: '' };

const Productos = () => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const { data } = await productosApi.listarProductos();
    setProductos(data);
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

  const abrirEditar = (p) => {
    setEditandoId(p.id);
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      unidad_medida: p.unidad_medida,
      precio_venta: p.precio_venta || '',
    });
    setMostrarModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      if (editandoId) {
        await productosApi.actualizarProducto(editandoId, form);
      } else {
        await productosApi.crearProducto(form);
      }
      setMostrarModal(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el producto.');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (id) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    await productosApi.eliminarProducto(id);
    await cargar();
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando productos..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Productos</h4>
          <p className="text-muted mb-0">Catálogo de quesos y derivados que elabora COOLAPAR.</p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          + Nuevo producto
        </Button>
      </div>

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Descripción</th>
            <th>Unidad</th>
            <th>Precio de venta</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td>{p.descripcion || '—'}</td>
              <td>{p.unidad_medida}</td>
              <td>{p.precio_venta ? `Bs. ${p.precio_venta}` : '—'}</td>
              <td>
                <Badge bg={p.activo ? 'success' : 'secondary'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
              </td>
              <td className="text-end">
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirEditar(p)}>
                  Editar
                </Button>
                {p.activo && (
                  <Button size="sm" variant="outline-danger" onClick={() => desactivar(p.id)}>
                    Eliminar
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {productos.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted py-4">
                No hay productos registrados.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar producto' : 'Nuevo producto'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                placeholder="Ej: Queso telita"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Unidad de medida</Form.Label>
              <Form.Control
                value={form.unidad_medida}
                onChange={(e) => setForm({ ...form, unidad_medida: e.target.value })}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Precio de venta</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={form.precio_venta}
                onChange={(e) => setForm({ ...form, precio_venta: e.target.value })}
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

export default Productos;
