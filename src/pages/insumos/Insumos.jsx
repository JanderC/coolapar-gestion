import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert } from 'react-bootstrap';
import * as insumosApi from '../../api/insumos.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const formVacio = { nombre: '', unidad_medida: 'kg', factor_por_litro: '', stock_actual: '', costo_unitario: '' };

const Insumos = () => {
  const [insumos, setInsumos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const { data } = await insumosApi.listarInsumos();
    setInsumos(data);
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

  const abrirEditar = (i) => {
    setEditandoId(i.id);
    setForm({
      nombre: i.nombre,
      unidad_medida: i.unidad_medida,
      factor_por_litro: i.factor_por_litro || '',
      stock_actual: i.stock_actual,
      costo_unitario: i.costo_unitario || '',
    });
    setMostrarModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      if (editandoId) {
        await insumosApi.actualizarInsumo(editandoId, form);
      } else {
        await insumosApi.crearInsumo(form);
      }
      setMostrarModal(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el insumo.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este insumo?')) return;
    await insumosApi.eliminarInsumo(id);
    await cargar();
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando insumos..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Insumos</h4>
          <p className="text-muted mb-0">
            El "factor por litro" es cuánto se gasta de este insumo por cada litro de leche (ej: sal).
          </p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          + Nuevo insumo
        </Button>
      </div>

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Unidad</th>
            <th>Factor por litro</th>
            <th>Stock actual</th>
            <th>Costo unitario</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((i) => (
            <tr key={i.id}>
              <td>{i.nombre}</td>
              <td>{i.unidad_medida}</td>
              <td>{i.factor_por_litro ?? '—'}</td>
              <td>{i.stock_actual}</td>
              <td>{i.costo_unitario ? `Bs. ${i.costo_unitario}` : '—'}</td>
              <td className="text-end">
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirEditar(i)}>
                  Editar
                </Button>
                <Button size="sm" variant="outline-danger" onClick={() => eliminar(i.id)}>
                  Eliminar
                </Button>
              </td>
            </tr>
          ))}
          {insumos.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted py-4">
                No hay insumos registrados.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar insumo' : 'Nuevo insumo'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                placeholder="Ej: Sal"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Unidad de medida</Form.Label>
              <Form.Control
                value={form.unidad_medida}
                onChange={(e) => setForm({ ...form, unidad_medida: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Factor por litro (cantidad usada por litro de leche)</Form.Label>
              <Form.Control
                type="number"
                step="0.000001"
                value={form.factor_por_litro}
                onChange={(e) => setForm({ ...form, factor_por_litro: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Stock actual</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={form.stock_actual}
                onChange={(e) => setForm({ ...form, stock_actual: e.target.value })}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Costo unitario</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={form.costo_unitario}
                onChange={(e) => setForm({ ...form, costo_unitario: e.target.value })}
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

export default Insumos;
