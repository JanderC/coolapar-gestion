import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, Row, Col } from 'react-bootstrap';
import * as cuartoFrioApi from '../../api/cuartoFrio.api';
import * as piezasApi from '../../api/piezasQueso.api';
import * as lotesApi from '../../api/lotesProduccion.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const formIngresoVacio = { elaboracion_id: '', fecha_ingreso: '', peso_inicial: '' };
const formPiezaVacia = { numero_pieza: '', peso_inicial: '' };

const CuartoFrio = () => {
  const [registros, setRegistros] = useState([]);
  const [elaboraciones, setElaboraciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModalIngreso, setMostrarModalIngreso] = useState(false);
  const [mostrarModalRetiro, setMostrarModalRetiro] = useState(false);
  const [mostrarModalPieza, setMostrarModalPieza] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState(null);
  const [formIngreso, setFormIngreso] = useState(formIngresoVacio);
  const [pesoFinal, setPesoFinal] = useState('');
  const [formPieza, setFormPieza] = useState(formPiezaVacia);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const [{ data: r }, { data: lotes }] = await Promise.all([
      cuartoFrioApi.listarCuartoFrio(),
      lotesApi.listarLotesProduccion(),
    ]);
    setRegistros(r);
    // Aplana todas las elaboraciones de todos los lotes para el selector
    const todasElaboraciones = lotes.flatMap((l) =>
      (l.ElaboracionProductos || []).map((ep) => ({ ...ep, loteInfo: l.fecha }))
    );
    setElaboraciones(todasElaboraciones);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirIngreso = () => {
    setFormIngreso({ ...formIngresoVacio, fecha_ingreso: new Date().toISOString().slice(0, 10) });
    setError('');
    setMostrarModalIngreso(true);
  };

  const guardarIngreso = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await cuartoFrioApi.crearCuartoFrio(formIngreso);
      setMostrarModalIngreso(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar el ingreso.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirRetiro = (registro) => {
    setRegistroSeleccionado(registro);
    setPesoFinal('');
    setError('');
    setMostrarModalRetiro(true);
  };

  const confirmarRetiro = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await cuartoFrioApi.retirarCuartoFrio(registroSeleccionado.id, {
        peso_final: pesoFinal,
        fecha_salida: new Date().toISOString().slice(0, 10),
      });
      setMostrarModalRetiro(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar el retiro.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirNuevaPieza = (registro) => {
    setRegistroSeleccionado(registro);
    setFormPieza(formPiezaVacia);
    setError('');
    setMostrarModalPieza(true);
  };

  const guardarPieza = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await piezasApi.crearPiezaQueso({ ...formPieza, cuarto_frio_id: registroSeleccionado.id });
      setMostrarModalPieza(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar la pieza.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando cuarto frío..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Cuarto frío</h4>
          <p className="text-muted mb-0">Ingreso y retiro de quesos, con el control de pérdida de peso.</p>
        </div>
        <Button variant="success" onClick={abrirIngreso}>
          + Ingresar al cuarto frío
        </Button>
      </div>

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Producto elaborado</th>
            <th>Ingreso</th>
            <th>Peso inicial</th>
            <th>Salida</th>
            <th>Peso final</th>
            <th>Pérdida</th>
            <th>Estado</th>
            <th>Piezas</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => (
            <tr key={r.id}>
              <td>{r.ElaboracionProducto?.Producto?.nombre || '—'}</td>
              <td>{r.fecha_ingreso}</td>
              <td>{r.peso_inicial} kg</td>
              <td>{r.fecha_salida || '—'}</td>
              <td>{r.peso_final ?? '—'}</td>
              <td>{r.perdida_peso ?? '—'} kg</td>
              <td>
                <Badge bg={r.estado === 'en_frio' ? 'info' : 'secondary'} text={r.estado === 'en_frio' ? 'dark' : undefined}>
                  {r.estado}
                </Badge>
              </td>
              <td>{r.PiezaQuesos?.length || 0}</td>
              <td className="text-end">
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirNuevaPieza(r)}>
                  + Pieza
                </Button>
                {r.estado === 'en_frio' && (
                  <Button size="sm" variant="outline-success" onClick={() => abrirRetiro(r)}>
                    Retirar
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {registros.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-muted py-4">
                No hay registros de cuarto frío todavía.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* Modal ingreso */}
      <Modal show={mostrarModalIngreso} onHide={() => setMostrarModalIngreso(false)} centered>
        <Form onSubmit={guardarIngreso}>
          <Modal.Header closeButton>
            <Modal.Title>Ingresar al cuarto frío</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Producto elaborado</Form.Label>
              <Form.Select
                value={formIngreso.elaboracion_id}
                onChange={(e) => setFormIngreso({ ...formIngreso, elaboracion_id: e.target.value })}
                required
              >
                <option value="">Selecciona</option>
                {elaboraciones.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.Producto?.nombre} — lote {ep.loteInfo}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Fecha de ingreso</Form.Label>
                  <Form.Control
                    type="date"
                    value={formIngreso.fecha_ingreso}
                    onChange={(e) => setFormIngreso({ ...formIngreso, fecha_ingreso: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Peso inicial (kg)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    value={formIngreso.peso_inicial}
                    onChange={(e) => setFormIngreso({ ...formIngreso, peso_inicial: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalIngreso(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal retiro */}
      <Modal show={mostrarModalRetiro} onHide={() => setMostrarModalRetiro(false)} centered>
        <Form onSubmit={confirmarRetiro}>
          <Modal.Header closeButton>
            <Modal.Title>Retirar del cuarto frío</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <p className="text-muted">
              Peso inicial: <strong>{registroSeleccionado?.peso_inicial} kg</strong>
            </p>
            <Form.Group>
              <Form.Label>Peso final (kg)</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={pesoFinal}
                onChange={(e) => setPesoFinal(e.target.value)}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalRetiro(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Confirmar retiro'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal nueva pieza */}
      <Modal show={mostrarModalPieza} onHide={() => setMostrarModalPieza(false)} centered>
        <Form onSubmit={guardarPieza}>
          <Modal.Header closeButton>
            <Modal.Title>Registrar pieza</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Número de pieza</Form.Label>
              <Form.Control
                value={formPieza.numero_pieza}
                onChange={(e) => setFormPieza({ ...formPieza, numero_pieza: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Peso inicial (kg)</Form.Label>
              <Form.Control
                type="number"
                step="0.001"
                value={formPieza.peso_inicial}
                onChange={(e) => setFormPieza({ ...formPieza, peso_inicial: e.target.value })}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalPieza(false)}>
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

export default CuartoFrio;
