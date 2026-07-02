import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert } from 'react-bootstrap';
import * as registroApi from '../../api/registroLeche.api';
import * as productoresApi from '../../api/productores.api';
import * as semanasApi from '../../api/semanasPago.api';
import ColorBadge from '../../components/common/ColorBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const formVacio = { productor_id: '', semana_id: '', fecha: '', litros: '', precio_litro: '' };

const RegistroLeche = () => {
  const [registros, setRegistros] = useState([]);
  const [productores, setProductores] = useState([]);
  const [semanaActual, setSemanaActual] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const [{ data: prods }, semanaResp] = await Promise.all([
        productoresApi.listarProductores(true),
        semanasApi.obtenerSemanaActual(),
      ]);
      setProductores(prods);
      setSemanaActual(semanaResp?.data || null);

      if (semanaResp?.data) {
        const { data: regs } = await registroApi.listarRegistrosLeche({ semana_id: semanaResp.data.id });
        setRegistros(regs);
      } else {
        setRegistros([]);
      }
    } catch {
      setError('No se pudieron cargar los datos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setForm({
      ...formVacio,
      semana_id: semanaActual?.id || '',
      fecha: new Date().toISOString().slice(0, 10),
    });
    setError('');
    setMostrarModal(true);
  };

  const seleccionarProductor = (productorId) => {
    const productor = productores.find((p) => String(p.id) === String(productorId));
    setForm({
      ...form,
      productor_id: productorId,
      precio_litro: productor?.precio_litro_base || '',
    });
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await registroApi.crearRegistroLeche(form);
      setMostrarModal(false);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar el registro.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    await registroApi.eliminarRegistroLeche(id);
    await cargar();
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando registros de leche..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="mb-0">Registro diario de leche</h4>
          <p className="text-muted mb-0">
            {semanaActual ? (
              <>Semana abierta desde {semanaActual.fecha_inicio}</>
            ) : (
              <span className="text-danger">No hay una semana abierta. Ve a "Semanas de pago" para abrir una.</span>
            )}
          </p>
        </div>
        <Button variant="success" onClick={abrirNuevo} disabled={!semanaActual}>
          + Registrar leche
        </Button>
      </div>

      {error && !mostrarModal && <Alert variant="danger">{error}</Alert>}

      <Table hover responsive bordered className="bg-white">
        <thead>
          <tr>
            <th>Productor</th>
            <th>Fecha</th>
            <th>Litros</th>
            <th>Precio/litro</th>
            <th>Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => (
            <tr key={r.id}>
              <td>
                <ColorBadge color={r.Productor?.color_identificativo} texto={r.Productor?.nombre} />
              </td>
              <td>{r.fecha}</td>
              <td>{r.litros}</td>
              <td>Bs. {r.precio_litro}</td>
              <td>Bs. {r.subtotal}</td>
              <td className="text-end">
                <Button size="sm" variant="outline-danger" onClick={() => eliminar(r.id)}>
                  Eliminar
                </Button>
              </td>
            </tr>
          ))}
          {registros.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted py-4">
                Aún no hay registros esta semana.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>Registrar leche del día</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>Productor</Form.Label>
              <Form.Select
                value={form.productor_id}
                onChange={(e) => seleccionarProductor(e.target.value)}
                required
              >
                <option value="">Selecciona un productor</option>
                {productores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
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
              <Form.Label>Litros</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={form.litros}
                onChange={(e) => setForm({ ...form, litros: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Precio por litro</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={form.precio_litro}
                onChange={(e) => setForm({ ...form, precio_litro: e.target.value })}
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

export default RegistroLeche;
