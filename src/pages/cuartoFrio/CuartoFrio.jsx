import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card } from 'react-bootstrap';
import * as cuartoFrioApi from '../../api/cuartoFrio.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatoCorto, hoy, vacio } from '../../utils/fechas';

const desempacar = (r) => (r && r.data !== undefined ? r.data : r);

const devolucionVacia = {
  fecha: hoy(),
  producto: '',
  kilos: '',
  piezas: '',
  cliente: '',
  motivo: '',
  apto_reproceso: 'si',
};

const ajusteVacio = { fecha: hoy(), producto: '', kilos: '', piezas: '', motivo: '', suma: 'false' };

const COLOR_TIPO = {
  produccion: 'success',
  devolucion: 'info',
  descarte: 'dark',
  reproceso: 'primary',
  salida: 'secondary',
  ajuste: 'warning',
};

const detalleError = (err) => {
  if (err?.response) return err.response.data?.message || `El servidor respondió ${err.response.status}.`;
  if (err?.request) return 'El servidor no respondió. Revise la conexión.';
  return err?.message || 'Error desconocido.';
};

const kg = (n) => `${Number(n || 0).toFixed(3)} kg`;

const CuartoFrio = () => {
  const [existencias, setExistencias] = useState({ productos: [], totales: { productos: 0, kilos: 0, piezas: 0 } });
  const [productosConocidos, setProductosConocidos] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [verMovimientos, setVerMovimientos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');

  const [mostrarDevolucion, setMostrarDevolucion] = useState(false);
  const [formDevolucion, setFormDevolucion] = useState(devolucionVacia);
  const [guardandoDevolucion, setGuardandoDevolucion] = useState(false);
  const [errorFormDevolucion, setErrorFormDevolucion] = useState('');

  const [mostrarAjuste, setMostrarAjuste] = useState(false);
  const [formAjuste, setFormAjuste] = useState(ajusteVacio);
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [errorFormAjuste, setErrorFormAjuste] = useState('');

  const cargarTodo = useCallback(async () => {
    setError('');
    try {
      const [ex, prods, devs] = await Promise.all([
        cuartoFrioApi.obtenerExistencias().then(desempacar),
        cuartoFrioApi.listarProductos().then(desempacar),
        cuartoFrioApi.listarDevoluciones().then(desempacar),
      ]);
      setExistencias(ex || { productos: [], totales: { productos: 0, kilos: 0, piezas: 0 } });
      setProductosConocidos(prods || []);
      setDevoluciones(devs || []);
    } catch (err) {
      setError(`No se pudo cargar el cuarto frío. ${detalleError(err)}`);
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarMovimientos = useCallback(async () => {
    try {
      const datos = await cuartoFrioApi
        .listarMovimientos(filtroTipo ? { tipo: filtroTipo } : {})
        .then(desempacar);
      setMovimientos(datos || []);
    } catch (err) {
      setError(`No se pudieron cargar los movimientos. ${detalleError(err)}`);
    }
  }, [filtroTipo]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  useEffect(() => {
    if (verMovimientos) cargarMovimientos();
  }, [verMovimientos, cargarMovimientos]);

  const existenciaDe = useCallback(
    (producto) => existencias.productos.find((p) => p.producto === producto) || null,
    [existencias]
  );

  // Se ofrecen los productos que hay en cuarto frío primero, y después los
  // demás que alguna vez se fabricaron (para devolver algo que ya se agotó).
  const opcionesProducto = useMemo(() => {
    const enFrio = existencias.productos.map((p) => p.producto);
    const resto = productosConocidos.filter((p) => !enFrio.includes(p));
    return [...enFrio, ...resto];
  }, [existencias, productosConocidos]);

  const guardarDevolucion = async (e) => {
    e.preventDefault();
    setErrorFormDevolucion('');
    if (!formDevolucion.producto.trim()) return setErrorFormDevolucion('Indique qué producto fue devuelto.');
    if (vacio(formDevolucion.kilos) || Number(formDevolucion.kilos) <= 0) {
      return setErrorFormDevolucion('Indique cuántos kilos volvieron.');
    }

    setGuardandoDevolucion(true);
    try {
      const respuesta = await cuartoFrioApi.registrarDevolucion({
        fecha: formDevolucion.fecha,
        producto: formDevolucion.producto.trim(),
        kilos: Number(formDevolucion.kilos),
        piezas: vacio(formDevolucion.piezas) ? null : Number(formDevolucion.piezas),
        cliente: vacio(formDevolucion.cliente) ? null : formDevolucion.cliente.trim(),
        motivo: vacio(formDevolucion.motivo) ? null : formDevolucion.motivo.trim(),
        apto_reproceso: formDevolucion.apto_reproceso === 'si',
      });
      setMostrarDevolucion(false);
      setFormDevolucion(devolucionVacia);
      setAviso(respuesta?.message || 'Devolución registrada.');
      await cargarTodo();
      if (verMovimientos) await cargarMovimientos();
    } catch (err) {
      setErrorFormDevolucion(`No se pudo registrar. ${detalleError(err)}`);
    } finally {
      setGuardandoDevolucion(false);
    }
  };

  const anularDevolucion = async (d) => {
    if (!window.confirm(`¿Anular la devolución de ${kg(d.kilos)} de ${d.producto}?`)) return;
    setError('');
    try {
      await cuartoFrioApi.anularDevolucion(d.id);
      setAviso('Devolución anulada.');
      await cargarTodo();
      if (verMovimientos) await cargarMovimientos();
    } catch (err) {
      setError(`No se pudo anular. ${detalleError(err)}`);
    }
  };

  const guardarAjuste = async (e) => {
    e.preventDefault();
    setErrorFormAjuste('');
    if (!formAjuste.producto.trim()) return setErrorFormAjuste('Indique el producto.');
    if (vacio(formAjuste.kilos) || Number(formAjuste.kilos) <= 0) {
      return setErrorFormAjuste('Indique cuántos kilos ajustar.');
    }

    setGuardandoAjuste(true);
    try {
      await cuartoFrioApi.registrarAjuste({
        fecha: formAjuste.fecha,
        producto: formAjuste.producto.trim(),
        kilos: Number(formAjuste.kilos),
        piezas: vacio(formAjuste.piezas) ? null : Number(formAjuste.piezas),
        motivo: vacio(formAjuste.motivo) ? null : formAjuste.motivo.trim(),
        suma: formAjuste.suma === 'true',
      });
      setMostrarAjuste(false);
      setFormAjuste(ajusteVacio);
      setAviso('Inventario ajustado.');
      await cargarTodo();
      if (verMovimientos) await cargarMovimientos();
    } catch (err) {
      setErrorFormAjuste(`No se pudo ajustar. ${detalleError(err)}`);
    } finally {
      setGuardandoAjuste(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando cuarto frío..." />;

  const existenciaElegida = formAjuste.producto ? existenciaDe(formAjuste.producto) : null;

  return (
    <div>
      <div className="page-header mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Cuarto frío</h4>
          <p className="text-muted mb-0">
            Todo lo que sale de producción entra aquí solo. También entra el queso que devuelven los clientes, y sale
            lo que se vuelve a fundir para hacer otro queso.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={() => setMostrarAjuste(true)}>
            Ajustar inventario
          </Button>
          <Button variant="success" onClick={() => setMostrarDevolucion(true)}>
            Registrar devolución
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      )}
      {aviso && (
        <Alert variant="success" onClose={() => setAviso('')} dismissible>
          {aviso}
        </Alert>
      )}

      {/* ---------- Existencias ---------- */}
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <strong>Lo que hay ahora</strong>
          <span className="text-muted">
            {existencias.totales.productos} producto(s) · <strong>{kg(existencias.totales.kilos)}</strong>
            {existencias.totales.piezas > 0 && ` · ${existencias.totales.piezas} piezas`}
          </span>
        </Card.Header>
        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="text-end">Kilos</th>
              <th className="text-end">Piezas</th>
            </tr>
          </thead>
          <tbody>
            {existencias.productos.map((p) => (
              <tr key={p.producto}>
                <td className="fw-semibold">{p.producto}</td>
                <td className="text-end fw-semibold">{Number(p.kilos).toFixed(3)}</td>
                <td className="text-end text-muted">{p.piezas > 0 ? p.piezas : '—'}</td>
              </tr>
            ))}
            {existencias.productos.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-muted py-4">
                  El cuarto frío está vacío. En cuanto registre un lote en «Creación de producto», aparecerá aquí.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Devoluciones ---------- */}
      <Card className="mb-4">
        <Card.Header>
          <strong>Devoluciones</strong>
          <div className="text-muted small">
            Queso que volvió de un cliente. El que sirve para reprocesar suma al inventario; el que no, queda
            registrado pero descartado.
          </div>
        </Card.Header>
        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Cliente</th>
              <th className="text-end">Kilos</th>
              <th className="text-end">Piezas</th>
              <th>¿Sirve?</th>
              <th>Motivo</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {devoluciones.map((d) => (
              <tr key={d.id} className={d.anulada ? 'text-muted' : undefined}>
                <td>{formatoCorto(d.fecha)}</td>
                <td className={d.anulada ? '' : 'fw-semibold'}>
                  {d.producto}
                  {d.anulada && (
                    <Badge bg="secondary" className="ms-2">
                      Anulada
                    </Badge>
                  )}
                </td>
                <td>{d.cliente || '—'}</td>
                <td className="text-end">{Number(d.kilos).toFixed(3)}</td>
                <td className="text-end">{d.piezas || '—'}</td>
                <td>
                  {d.apto_reproceso ? (
                    <Badge bg="success">Se reprocesa</Badge>
                  ) : (
                    <Badge bg="dark">Descartado</Badge>
                  )}
                </td>
                <td className="text-muted small">{d.motivo || '—'}</td>
                <td className="text-end">
                  {!d.anulada && (
                    <Button size="sm" variant="outline-danger" onClick={() => anularDevolucion(d)}>
                      Anular
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {devoluciones.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted py-4">
                  Todavía no hay devoluciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Movimientos ---------- */}
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <strong>Todo lo que entró y salió</strong>
            <div className="text-muted small">El historial completo, para saber de dónde salió cada kilo.</div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {verMovimientos && (
              <Form.Select
                size="sm"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                style={{ maxWidth: 220 }}
              >
                <option value="">Todo</option>
                <option value="produccion">Entradas de producción</option>
                <option value="devolucion">Devoluciones</option>
                <option value="reproceso">Usado para reprocesar</option>
                <option value="descarte">Descartado</option>
                <option value="ajuste">Ajustes</option>
              </Form.Select>
            )}
            <Button size="sm" variant="outline-secondary" onClick={() => setVerMovimientos((v) => !v)}>
              {verMovimientos ? 'Ocultar' : 'Ver historial'}
            </Button>
          </div>
        </Card.Header>

        {verMovimientos && (
          <Table hover responsive className="mb-0 align-middle small">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Qué pasó</th>
                <th className="text-end">Kilos</th>
                <th className="text-end">Piezas</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const suma = m.signo > 0;
                return (
                  <tr key={m.id}>
                    <td className="text-muted">{formatoCorto(m.fecha)}</td>
                    <td className="fw-semibold">{m.producto}</td>
                    <td>
                      <Badge bg={COLOR_TIPO[m.tipo] || 'secondary'}>{m.etiqueta_tipo}</Badge>
                    </td>
                    <td className={`text-end fw-semibold ${suma ? 'text-success' : 'text-primary'}`}>
                      {suma ? '+' : '−'}
                      {Number(m.kilos).toFixed(3)}
                    </td>
                    <td className="text-end text-muted">{m.piezas || '—'}</td>
                    <td className="text-muted">
                      {m.descripcion || m.motivo || '—'}
                      {m.cliente && <div>Cliente: {m.cliente}</div>}
                    </td>
                  </tr>
                );
              })}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No hay movimientos con ese filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Card>

      {/* ---------- Modal: devolución ---------- */}
      <Modal show={mostrarDevolucion} onHide={() => setMostrarDevolucion(false)} centered>
        <Form onSubmit={guardarDevolucion}>
          <Modal.Header closeButton>
            <Modal.Title>Registrar devolución</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorFormDevolucion && <Alert variant="danger">{errorFormDevolucion}</Alert>}

            <div className="row g-3">
              <div className="col-sm-5">
                <Form.Label>Fecha</Form.Label>
                <Form.Control
                  type="date"
                  value={formDevolucion.fecha}
                  onChange={(e) => setFormDevolucion({ ...formDevolucion, fecha: e.target.value })}
                />
              </div>
              <div className="col-sm-7">
                <Form.Label>Producto devuelto</Form.Label>
                <Form.Control
                  autoFocus
                  list="productos-cuarto-frio"
                  value={formDevolucion.producto}
                  onChange={(e) => setFormDevolucion({ ...formDevolucion, producto: e.target.value })}
                  placeholder="Semiduro, Queso blanco..."
                />
                <datalist id="productos-cuarto-frio">
                  {opcionesProducto.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="row g-3 mt-0">
              <div className="col-sm-6">
                <Form.Label>Kilos</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.001"
                    value={formDevolucion.kilos}
                    onChange={(e) => setFormDevolucion({ ...formDevolucion, kilos: e.target.value })}
                    placeholder="0.000"
                  />
                  <InputGroup.Text>kg</InputGroup.Text>
                </InputGroup>
              </div>
              <div className="col-sm-6">
                <Form.Label>Piezas (opcional)</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={formDevolucion.piezas}
                  onChange={(e) => setFormDevolucion({ ...formDevolucion, piezas: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <Form.Group className="mt-3">
              <Form.Label>¿Sirve para volver a procesar?</Form.Label>
              <Form.Select
                value={formDevolucion.apto_reproceso}
                onChange={(e) => setFormDevolucion({ ...formDevolucion, apto_reproceso: e.target.value })}
              >
                <option value="si">Sí — entra al cuarto frío y se puede fundir</option>
                <option value="no">No — queda registrado pero se descarta</option>
              </Form.Select>
              <Form.Text className="text-muted">
                {formDevolucion.apto_reproceso === 'si'
                  ? 'Sumará a la existencia y podrá elegirse al crear un producto nuevo.'
                  : 'Queda en el historial de devoluciones, pero no suma al inventario.'}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Cliente (opcional)</Form.Label>
              <Form.Control
                value={formDevolucion.cliente}
                onChange={(e) => setFormDevolucion({ ...formDevolucion, cliente: e.target.value })}
                placeholder="Quién lo devolvió"
              />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Motivo (opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formDevolucion.motivo}
                onChange={(e) => setFormDevolucion({ ...formDevolucion, motivo: e.target.value })}
                placeholder="Por qué volvió"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarDevolucion(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoDevolucion}>
              {guardandoDevolucion ? 'Guardando...' : 'Registrar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- Modal: ajuste ---------- */}
      <Modal show={mostrarAjuste} onHide={() => setMostrarAjuste(false)} centered>
        <Form onSubmit={guardarAjuste}>
          <Modal.Header closeButton>
            <Modal.Title>Ajustar inventario</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorFormAjuste && <Alert variant="danger">{errorFormAjuste}</Alert>}

            <p className="text-muted small">
              Para cuadrar contra un conteo físico o anotar una pérdida. Queda registrado como ajuste, así que se
              nota que no vino de producción.
            </p>

            <Form.Group className="mb-3">
              <Form.Label>Producto</Form.Label>
              <Form.Control
                autoFocus
                list="productos-cuarto-frio-ajuste"
                value={formAjuste.producto}
                onChange={(e) => setFormAjuste({ ...formAjuste, producto: e.target.value })}
              />
              <datalist id="productos-cuarto-frio-ajuste">
                {opcionesProducto.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              {existenciaElegida && (
                <Form.Text className="text-muted">
                  Ahora hay {kg(existenciaElegida.kilos)}
                  {existenciaElegida.piezas > 0 && ` y ${existenciaElegida.piezas} piezas`}.
                </Form.Text>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>¿Qué hago?</Form.Label>
              <Form.Select
                value={formAjuste.suma}
                onChange={(e) => setFormAjuste({ ...formAjuste, suma: e.target.value })}
              >
                <option value="false">Restar del inventario</option>
                <option value="true">Sumar al inventario</option>
              </Form.Select>
            </Form.Group>

            <div className="row g-3">
              <div className="col-sm-6">
                <Form.Label>Kilos</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.001"
                    value={formAjuste.kilos}
                    onChange={(e) => setFormAjuste({ ...formAjuste, kilos: e.target.value })}
                  />
                  <InputGroup.Text>kg</InputGroup.Text>
                </InputGroup>
              </div>
              <div className="col-sm-6">
                <Form.Label>Piezas (opcional)</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  value={formAjuste.piezas}
                  onChange={(e) => setFormAjuste({ ...formAjuste, piezas: e.target.value })}
                />
              </div>
            </div>

            <Form.Group className="mt-3">
              <Form.Label>Motivo</Form.Label>
              <Form.Control
                value={formAjuste.motivo}
                onChange={(e) => setFormAjuste({ ...formAjuste, motivo: e.target.value })}
                placeholder="Conteo físico, pérdida de peso, queso dañado..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarAjuste(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoAjuste}>
              {guardandoAjuste ? 'Guardando...' : 'Ajustar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default CuartoFrio;