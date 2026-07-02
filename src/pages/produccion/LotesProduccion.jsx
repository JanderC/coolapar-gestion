import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, Row, Col } from 'react-bootstrap';
import * as lotesApi from '../../api/lotesProduccion.api';
import * as recibidosApi from '../../api/recibidos.api';
import * as productosApi from '../../api/productos.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const formVacio = { fecha: '', recibido_id: '', litros_utilizados: '', kilos_obtenidos: '', observaciones: '' };
const formElaboracionVacio = { producto_id: '', cantidad_piezas: '', kilos_totales: '' };

const LotesProduccion = () => {
  const [lotes, setLotes] = useState([]);
  const [recibidos, setRecibidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalElaboracion, setMostrarModalElaboracion] = useState(false);
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [formElaboracion, setFormElaboracion] = useState(formElaboracionVacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const [{ data: l }, { data: r }, { data: p }] = await Promise.all([
      lotesApi.listarLotesProduccion(),
      recibidosApi.listarRecibidos(),
      productosApi.listarProductos(true),
    ]);
    setLotes(l);
    setRecibidos(r);
    setProductos(p);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const seleccionarRecibido = (id) => {
    const r = recibidos.find((rec) => String(rec.id) === String(id));
    setForm({ ...form, recibido_id: id, litros_utilizados: r?.litros_utiles || '' });
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
      await lotesApi.crearLoteProduccion(form);
      setMostrarModal(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar el lote.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirElaboracion = (lote) => {
    setLoteSeleccionado(lote);
    setFormElaboracion(formElaboracionVacio);
    setError('');
    setMostrarModalElaboracion(true);
  };

  const guardarElaboracion = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await lotesApi.registrarElaboracion(loteSeleccionado.id, formElaboracion);
      setMostrarModalElaboracion(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar la elaboración.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando producción..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Producción — % litro / kilo</h4>
          <p className="text-muted mb-0">
            Al guardar un lote, el sistema calcula automáticamente el % litro/kilo y el consumo de insumos (ej. sal).
          </p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          + Nuevo lote de producción
        </Button>
      </div>

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Litros utilizados</th>
            <th>Kilos obtenidos</th>
            <th>% litro/kilo</th>
            <th>Insumos usados</th>
            <th>Productos elaborados</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((l) => (
            <tr key={l.id}>
              <td>{l.fecha}</td>
              <td>{l.litros_utilizados} L</td>
              <td>{l.kilos_obtenidos} kg</td>
              <td>
                <Badge bg="info" text="dark">
                  {l.porcentaje_litro_kilo}
                </Badge>
              </td>
              <td>
                {l.UsoInsumos?.map((u) => (
                  <div key={u.id} className="small text-muted">
                    {u.Insumo?.nombre}: {u.cantidad_calculada} {u.Insumo?.unidad_medida}
                  </div>
                ))}
              </td>
              <td>
                {l.ElaboracionProductos?.map((ep) => (
                  <div key={ep.id} className="small text-muted">
                    {ep.Producto?.nombre}: {ep.cantidad_piezas || 0} pzs / {ep.kilos_totales || 0} kg
                  </div>
                ))}
              </td>
              <td className="text-end">
                <Button size="sm" variant="outline-success" onClick={() => abrirElaboracion(l)}>
                  + Producto
                </Button>
              </td>
            </tr>
          ))}
          {lotes.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-muted py-4">
                No hay lotes de producción registrados.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* Modal: nuevo lote */}
      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>Nuevo lote de producción</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Recibido de origen (opcional)</Form.Label>
              <Form.Select value={form.recibido_id} onChange={(e) => seleccionarRecibido(e.target.value)}>
                <option value="">Sin recibido asociado</option>
                {recibidos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fecha} — {r.litros_utiles} L útiles
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
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row className="mb-3">
              <Col>
                <Form.Group>
                  <Form.Label>Litros utilizados</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={form.litros_utilizados}
                    onChange={(e) => setForm({ ...form, litros_utilizados: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group>
                  <Form.Label>Kilos obtenidos de queso</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={form.kilos_obtenidos}
                    onChange={(e) => setForm({ ...form, kilos_obtenidos: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
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
              {guardando ? 'Guardando...' : 'Guardar lote'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal: registrar elaboracion de producto para un lote */}
      <Modal show={mostrarModalElaboracion} onHide={() => setMostrarModalElaboracion(false)} centered>
        <Form onSubmit={guardarElaboracion}>
          <Modal.Header closeButton>
            <Modal.Title>Registrar producto elaborado</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Producto</Form.Label>
              <Form.Select
                value={formElaboracion.producto_id}
                onChange={(e) => setFormElaboracion({ ...formElaboracion, producto_id: e.target.value })}
                required
              >
                <option value="">Selecciona un producto</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Cantidad de piezas</Form.Label>
                  <Form.Control
                    type="number"
                    value={formElaboracion.cantidad_piezas}
                    onChange={(e) => setFormElaboracion({ ...formElaboracion, cantidad_piezas: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Kilos totales</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={formElaboracion.kilos_totales}
                    onChange={(e) => setFormElaboracion({ ...formElaboracion, kilos_totales: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalElaboracion(false)}>
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

export default LotesProduccion;
