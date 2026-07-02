import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Row, Col } from 'react-bootstrap';
import * as recibidosApi from '../../api/recibidos.api';
import * as transportadoresApi from '../../api/transportadores.api';
import * as productoresApi from '../../api/productores.api';
import ColorBadge from '../../components/common/ColorBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const cabeceraVacia = {
  transportador_id: '',
  fecha: '',
  litros_traidos: '',
  litros_descartados: '0',
  motivo_descarte: '',
  observaciones: '',
};

const Recibidos = () => {
  const [recibidos, setRecibidos] = useState([]);
  const [transportadores, setTransportadores] = useState([]);
  const [productores, setProductores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [cabecera, setCabecera] = useState(cabeceraVacia);
  const [detalle, setDetalle] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const [{ data: r }, { data: t }, { data: p }] = await Promise.all([
      recibidosApi.listarRecibidos(),
      transportadoresApi.listarTransportadores(true),
      productoresApi.listarProductores(true),
    ]);
    setRecibidos(r);
    setTransportadores(t);
    setProductores(p);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setCabecera({ ...cabeceraVacia, fecha: new Date().toISOString().slice(0, 10) });
    setDetalle([{ productor_id: '', litros_aportados: '', resultado_prueba: '' }]);
    setError('');
    setMostrarModal(true);
  };

  const agregarFilaDetalle = () => {
    setDetalle([...detalle, { productor_id: '', litros_aportados: '', resultado_prueba: '' }]);
  };

  const actualizarDetalle = (index, campo, valor) => {
    const copia = [...detalle];
    copia[index][campo] = valor;
    setDetalle(copia);
  };

  const quitarFilaDetalle = (index) => {
    setDetalle(detalle.filter((_, i) => i !== index));
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const detalleValido = detalle.filter((d) => d.productor_id && d.litros_aportados);
      await recibidosApi.crearRecibido({ ...cabecera, detalle: detalleValido });
      setMostrarModal(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar el recibido.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando recibidos..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Recibidos</h4>
          <p className="text-muted mb-0">Litros que trae el rutero, con la prueba/aporte de cada productor.</p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          + Registrar recibido
        </Button>
      </div>

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Transportador</th>
            <th>Litros traídos</th>
            <th>Litros descartados</th>
            <th>Litros útiles</th>
            <th>Productores</th>
          </tr>
        </thead>
        <tbody>
          {recibidos.map((r) => (
            <tr key={r.id}>
              <td>{r.fecha}</td>
              <td>{r.Transportador?.nombre || '—'}</td>
              <td>{r.litros_traidos} L</td>
              <td>{r.litros_descartados} L</td>
              <td className="fw-semibold">{r.litros_utiles} L</td>
              <td>
                {r.RecibidoDetalles?.map((d) => (
                  <div key={d.id} className="small">
                    <ColorBadge color={d.Productor?.color_identificativo} texto={`${d.Productor?.nombre}: ${d.litros_aportados} L`} />
                  </div>
                ))}
              </td>
            </tr>
          ))}
          {recibidos.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted py-4">
                No hay recibidos registrados.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered size="lg">
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>Registrar recibido</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Transportador</Form.Label>
                  <Form.Select
                    value={cabecera.transportador_id}
                    onChange={(e) => setCabecera({ ...cabecera, transportador_id: e.target.value })}
                  >
                    <option value="">Selecciona (opcional)</option>
                    {transportadores.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Fecha</Form.Label>
                  <Form.Control
                    type="date"
                    value={cabecera.fecha}
                    onChange={(e) => setCabecera({ ...cabecera, fecha: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Litros traídos</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={cabecera.litros_traidos}
                    onChange={(e) => setCabecera({ ...cabecera, litros_traidos: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Litros descartados</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={cabecera.litros_descartados}
                    onChange={(e) => setCabecera({ ...cabecera, litros_descartados: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Label>Motivo del descarte (si aplica)</Form.Label>
              <Form.Control
                value={cabecera.motivo_descarte}
                onChange={(e) => setCabecera({ ...cabecera, motivo_descarte: e.target.value })}
              />
            </Form.Group>

            <h6>Detalle por productor</h6>
            {detalle.map((d, i) => (
              <Row key={i} className="mb-2 align-items-end">
                <Col md={5}>
                  <Form.Select
                    value={d.productor_id}
                    onChange={(e) => actualizarDetalle(i, 'productor_id', e.target.value)}
                  >
                    <option value="">Productor</option>
                    {productores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Control
                    type="number"
                    step="0.01"
                    placeholder="Litros"
                    value={d.litros_aportados}
                    onChange={(e) => actualizarDetalle(i, 'litros_aportados', e.target.value)}
                  />
                </Col>
                <Col md={3}>
                  <Form.Control
                    placeholder="Resultado prueba"
                    value={d.resultado_prueba}
                    onChange={(e) => actualizarDetalle(i, 'resultado_prueba', e.target.value)}
                  />
                </Col>
                <Col md={1}>
                  <Button variant="outline-danger" size="sm" onClick={() => quitarFilaDetalle(i)}>
                    ✕
                  </Button>
                </Col>
              </Row>
            ))}
            <Button variant="outline-success" size="sm" onClick={agregarFilaDetalle} className="mt-2">
              + Agregar productor
            </Button>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModal(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar recibido'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Recibidos;
