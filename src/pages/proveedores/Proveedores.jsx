import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, Tabs, Tab, Row, Col } from 'react-bootstrap';
import * as proveedoresApi from '../../api/proveedores.api';
import * as comprasApi from '../../api/comprasProveedores.api';
import * as insumosApi from '../../api/insumos.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const formProveedorVacio = { nombre: '', tipo_suministro: '', telefono: '', direccion: '', contacto: '' };
const formCompraVacio = { proveedor_id: '', insumo_id: '', fecha: '', cantidad: '', costo_unitario: '', observaciones: '' };

const Proveedores = () => {
  const [proveedores, setProveedores] = useState([]);
  const [compras, setCompras] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModalProveedor, setMostrarModalProveedor] = useState(false);
  const [mostrarModalCompra, setMostrarModalCompra] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formProveedor, setFormProveedor] = useState(formProveedorVacio);
  const [formCompra, setFormCompra] = useState(formCompraVacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const [{ data: p }, { data: c }, { data: i }] = await Promise.all([
      proveedoresApi.listarProveedores(),
      comprasApi.listarComprasProveedores(),
      insumosApi.listarInsumos(),
    ]);
    setProveedores(p);
    setCompras(c);
    setInsumos(i);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevoProveedor = () => {
    setEditandoId(null);
    setFormProveedor(formProveedorVacio);
    setMostrarModalProveedor(true);
  };

  const abrirEditarProveedor = (p) => {
    setEditandoId(p.id);
    setFormProveedor({
      nombre: p.nombre,
      tipo_suministro: p.tipo_suministro || '',
      telefono: p.telefono || '',
      direccion: p.direccion || '',
      contacto: p.contacto || '',
    });
    setMostrarModalProveedor(true);
  };

  const guardarProveedor = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      if (editandoId) {
        await proveedoresApi.actualizarProveedor(editandoId, formProveedor);
      } else {
        await proveedoresApi.crearProveedor(formProveedor);
      }
      setMostrarModalProveedor(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el proveedor.');
    } finally {
      setGuardando(false);
    }
  };

  const desactivarProveedor = async (id) => {
    if (!window.confirm('¿Desactivar este proveedor?')) return;
    await proveedoresApi.eliminarProveedor(id);
    await cargar();
  };

  const abrirNuevaCompra = () => {
    setFormCompra({ ...formCompraVacio, fecha: new Date().toISOString().slice(0, 10) });
    setError('');
    setMostrarModalCompra(true);
  };

  const guardarCompra = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await comprasApi.crearCompraProveedor(formCompra);
      setMostrarModalCompra(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar la compra.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando proveedores..." />;

  return (
    <div>
      <h4 className="mb-1">Proveedores</h4>
      <p className="text-muted">Proveedores de insumos y materiales (distintos de los productores de leche).</p>

      <Tabs defaultActiveKey="proveedores" className="mb-3">
        <Tab eventKey="proveedores" title="Proveedores">
          <div className="d-flex justify-content-end mb-3">
            <Button variant="success" onClick={abrirNuevoProveedor}>
              + Nuevo proveedor
            </Button>
          </div>
          <Table hover responsive bordered className="bg-white">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo de suministro</th>
                <th>Teléfono</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{p.tipo_suministro || '—'}</td>
                  <td>{p.telefono || '—'}</td>
                  <td>{p.contacto || '—'}</td>
                  <td>
                    <Badge bg={p.activo ? 'success' : 'secondary'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="text-end">
                    <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirEditarProveedor(p)}>
                      Editar
                    </Button>
                    {p.activo && (
                      <Button size="sm" variant="outline-danger" onClick={() => desactivarProveedor(p.id)}>
                        Desactivar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {proveedores.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No hay proveedores registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Tab>

        <Tab eventKey="compras" title="Compras">
          <div className="d-flex justify-content-end mb-3">
            <Button variant="success" onClick={abrirNuevaCompra}>
              + Nueva compra
            </Button>
          </div>
          <Table hover responsive bordered className="bg-white">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Insumo</th>
                <th>Cantidad</th>
                <th>Costo total</th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => (
                <tr key={c.id}>
                  <td>{c.fecha}</td>
                  <td>{c.Proveedor?.nombre}</td>
                  <td>{c.Insumo?.nombre || '—'}</td>
                  <td>
                    {c.cantidad} {c.Insumo?.unidad_medida || ''}
                  </td>
                  <td>Bs. {c.costo_total}</td>
                </tr>
              ))}
              {compras.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    No hay compras registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Tab>
      </Tabs>

      {/* Modal proveedor */}
      <Modal show={mostrarModalProveedor} onHide={() => setMostrarModalProveedor(false)} centered>
        <Form onSubmit={guardarProveedor}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar proveedor' : 'Nuevo proveedor'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                value={formProveedor.nombre}
                onChange={(e) => setFormProveedor({ ...formProveedor, nombre: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tipo de suministro</Form.Label>
              <Form.Control
                value={formProveedor.tipo_suministro}
                onChange={(e) => setFormProveedor({ ...formProveedor, tipo_suministro: e.target.value })}
                placeholder="Ej: Empaques, sal, químicos"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Teléfono</Form.Label>
              <Form.Control
                value={formProveedor.telefono}
                onChange={(e) => setFormProveedor({ ...formProveedor, telefono: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Dirección</Form.Label>
              <Form.Control
                value={formProveedor.direccion}
                onChange={(e) => setFormProveedor({ ...formProveedor, direccion: e.target.value })}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Persona de contacto</Form.Label>
              <Form.Control
                value={formProveedor.contacto}
                onChange={(e) => setFormProveedor({ ...formProveedor, contacto: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalProveedor(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal compra */}
      <Modal show={mostrarModalCompra} onHide={() => setMostrarModalCompra(false)} centered>
        <Form onSubmit={guardarCompra}>
          <Modal.Header closeButton>
            <Modal.Title>Registrar compra</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Proveedor</Form.Label>
              <Form.Select
                value={formCompra.proveedor_id}
                onChange={(e) => setFormCompra({ ...formCompra, proveedor_id: e.target.value })}
                required
              >
                <option value="">Selecciona un proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Insumo (opcional)</Form.Label>
              <Form.Select
                value={formCompra.insumo_id}
                onChange={(e) => setFormCompra({ ...formCompra, insumo_id: e.target.value })}
              >
                <option value="">Ninguno</option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Row className="mb-3">
              <Col>
                <Form.Group>
                  <Form.Label>Fecha</Form.Label>
                  <Form.Control
                    type="date"
                    value={formCompra.fecha}
                    onChange={(e) => setFormCompra({ ...formCompra, fecha: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group>
                  <Form.Label>Cantidad</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={formCompra.cantidad}
                    onChange={(e) => setFormCompra({ ...formCompra, cantidad: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group>
              <Form.Label>Costo unitario</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={formCompra.costo_unitario}
                onChange={(e) => setFormCompra({ ...formCompra, costo_unitario: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalCompra(false)}>
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

export default Proveedores;
