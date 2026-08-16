import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card } from 'react-bootstrap';
import * as ventasApi from '../../api/ventas.api';
import * as sucursalesApi from '../../api/sucursales.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatoCorto, hoy, vacio } from '../../utils/fechas';

const MONEDAS = ['BS', 'USD', 'COP'];

const METODOS_PAGO = [
  { valor: '', etiqueta: 'Sin especificar' },
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'pago_movil', etiqueta: 'Pago móvil' },
  { valor: 'credito', etiqueta: 'A crédito' },
];

const ESTADO_DESPACHO = {
  no_aplica: { etiqueta: 'Entregado', color: 'secondary' },
  pendiente: { etiqueta: 'Esperando confirmación', color: 'warning' },
  recibido: { etiqueta: 'Recibido', color: 'success' },
  diferencia: { etiqueta: 'Diferencia por resolver', color: 'danger' },
  cerrado: { etiqueta: 'Cerrado', color: 'success' },
};

let contador = 0;
const nuevoId = () => {
  contador += 1;
  return `linea-${contador}`;
};

const formVacio = () => ({
  fecha: hoy(),
  destino: 'sucursal',
  sucursal_id: '',
  cliente_nombre: '',
  moneda: 'BS',
  metodo_pago: '',
  referencia: '',
  notas: '',
});

const detalleError = (err) => {
  if (err?.response) return err.response.data?.message || `El servidor respondió ${err.response.status}.`;
  if (err?.request) return 'El servidor no respondió. Revise la conexión.';
  return err?.message || 'Error desconocido.';
};

const dinero = (valor, moneda = 'BS') =>
  `${Number(valor || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;

const Ventas = () => {
  const [ventas, setVentas] = useState([]);
  const [totales, setTotales] = useState([]);
  const [disponibles, setDisponibles] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [mostrarModal, setMostrarModal] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [lineas, setLineas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const [ventaResolver, setVentaResolver] = useState(null);
  const [resolucion, setResolucion] = useState('acepta_recibido');
  const [notaResolucion, setNotaResolucion] = useState('');
  const [resolviendo, setResolviendo] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [respVentas, respDisp, respSuc] = await Promise.all([
        ventasApi.listarVentas(),
        ventasApi.productosDisponibles(),
        sucursalesApi.listarSucursales({ activo: 'true' }),
      ]);
      setVentas(respVentas?.data || []);
      setTotales(respVentas?.totales || []);
      setDisponibles(respDisp?.data || []);
      setSucursales(respSuc?.data || []);
    } catch (err) {
      setError(`No se pudieron cargar las ventas. ${detalleError(err)}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Lo que reclama atención: despachos que la sucursal contó distinto.
  const conDiferencia = useMemo(
    () => ventas.filter((v) => v.estado_despacho === 'diferencia' && v.estado === 'registrada'),
    [ventas]
  );
  const esperando = useMemo(
    () => ventas.filter((v) => v.estado_despacho === 'pendiente' && v.estado === 'registrada'),
    [ventas]
  );

  const esASucursal = form.destino === 'sucursal';

  // ---------- Armado de la venta ----------
  const agregarLinea = () =>
    setLineas((prev) => [...prev, { id: nuevoId(), producto: '', kilos: '', piezas: '', precio_kilo: '' }]);

  const quitarLinea = (id) => setLineas((prev) => prev.filter((l) => l.id !== id));

  const cambiarLinea = (id, campo, valor) =>
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));

  const disponibleDe = useCallback(
    (producto) => Number(disponibles.find((p) => p.producto === producto)?.kilos || 0),
    [disponibles]
  );

  const lineasSinExistencia = useMemo(
    () =>
      lineas.filter((l) => {
        if (vacio(l.producto) || vacio(l.kilos)) return false;
        return Number(l.kilos) > disponibleDe(l.producto);
      }),
    [lineas, disponibleDe]
  );

  const totalVenta = useMemo(
    () => lineas.reduce((s, l) => s + Number(l.kilos || 0) * Number(l.precio_kilo || 0), 0),
    [lineas]
  );

  const abrirNueva = () => {
    setForm(formVacio());
    setLineas([{ id: nuevoId(), producto: '', kilos: '', piezas: '', precio_kilo: '' }]);
    setErrorForm('');
    setMostrarModal(true);
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    setErrorForm('');

    if (esASucursal && !form.sucursal_id) return setErrorForm('Elija la sucursal.');
    if (!esASucursal && !form.cliente_nombre.trim()) return setErrorForm('Escriba a quién se le vende.');

    const items = lineas
      .filter((l) => !vacio(l.producto) && !vacio(l.kilos) && Number(l.kilos) > 0)
      .map((l) => ({
        producto: l.producto,
        kilos: Number(l.kilos),
        piezas: vacio(l.piezas) ? null : Number(l.piezas),
        precio_kilo: vacio(l.precio_kilo) ? 0 : Number(l.precio_kilo),
      }));

    if (items.length === 0) return setErrorForm('Agregue al menos un producto.');
    if (lineasSinExistencia.length > 0) {
      return setErrorForm('No hay suficiente producto en cuarto frío. Revise las líneas en rojo.');
    }
    if (items.some((i) => i.precio_kilo <= 0)) {
      return setErrorForm('Falta el precio por kilo de algún producto.');
    }

    setGuardando(true);
    try {
      const respuesta = await ventasApi.crearVenta({
        fecha: form.fecha,
        sucursal_id: esASucursal ? Number(form.sucursal_id) : null,
        cliente_nombre: esASucursal ? null : form.cliente_nombre.trim(),
        moneda: form.moneda,
        metodo_pago: form.metodo_pago || null,
        referencia: vacio(form.referencia) ? null : form.referencia.trim(),
        notas: vacio(form.notas) ? null : form.notas.trim(),
        items,
      });
      setMostrarModal(false);
      setAviso(respuesta?.message || 'Venta registrada.');
      await cargar();
    } catch (err) {
      setErrorForm(`No se pudo registrar. ${detalleError(err)}`);
    } finally {
      setGuardando(false);
    }
  };

  const anular = async (v) => {
    const motivo = window.prompt(`¿Por qué se anula la venta #${v.id}?`);
    if (motivo === null) return;
    try {
      await ventasApi.anularVenta(v.id, motivo);
      setAviso('Venta anulada y existencias devueltas.');
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    }
  };

  const abrirResolver = (v) => {
    setVentaResolver(v);
    setResolucion('acepta_recibido');
    setNotaResolucion('');
  };

  const guardarResolucion = async () => {
    setResolviendo(true);
    setError('');
    try {
      await ventasApi.resolverDiferencia(ventaResolver.id, resolucion, notaResolucion);
      setVentaResolver(null);
      setAviso('Diferencia resuelta.');
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    } finally {
      setResolviendo(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando ventas..." />;

  return (
    <div>
      <div className="page-header mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Ventas</h4>
          <p className="text-muted mb-0">
            Lo que sale de cuarto frío, con su precio. A una sucursal se le despacha y ella confirma cuánto recibió;
            al cliente de mostrador se le entrega en el momento.
          </p>
        </div>
        <Button variant="success" onClick={abrirNueva} disabled={disponibles.length === 0}>
          <span className="btn-icon-plus">+</span>Nueva venta
        </Button>
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

      {disponibles.length === 0 && (
        <Alert variant="secondary">
          No hay producto en cuarto frío. Registre un lote en «Creación de producto» antes de vender.
        </Alert>
      )}

      {/* ---------- Lo que reclama atención ---------- */}
      {conDiferencia.length > 0 && (
        <Alert variant="danger">
          <strong>
            {conDiferencia.length} despacho(s) con diferencia entre lo enviado y lo que contó la sucursal.
          </strong>
          <div className="mt-2 d-flex flex-column gap-2">
            {conDiferencia.map((v) => (
              <div key={v.id} className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <span className="small">
                  #{v.id} · {v.Sucursal?.nombre} · {formatoCorto(v.fecha)} ·{' '}
                  {v.Items.map((i) => `${i.producto}: envió ${i.kilos} / contó ${i.kilos_recibidos}`).join(' — ')}
                </span>
                <Button size="sm" variant="danger" onClick={() => abrirResolver(v)}>
                  Resolver
                </Button>
              </div>
            ))}
          </div>
        </Alert>
      )}

      {esperando.length > 0 && (
        <Alert variant="warning" className="py-2">
          {esperando.length} despacho(s) esperando que la sucursal confirme lo que recibió.
        </Alert>
      )}

      {/* ---------- Totales ---------- */}
      {totales.length > 0 && (
        <div className="d-flex flex-wrap gap-3 mb-3">
          {totales
            .filter((t) => t.origen === 'planta')
            .map((t) => (
              <Card key={`${t.origen}-${t.moneda}`} className="flex-grow-1" style={{ minWidth: 220 }}>
                <Card.Body className="py-3">
                  <div className="text-muted small text-uppercase">Vendido en {t.moneda}</div>
                  <div className="fs-4 fw-semibold lh-1 mt-1">{dinero(t.total, t.moneda)}</div>
                  <div className="text-muted small mt-1">{t.ventas} venta(s)</div>
                </Card.Body>
              </Card>
            ))}
        </div>
      )}

      <Card>
        <Card.Header>
          <strong>Ventas registradas</strong>
        </Card.Header>
        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>A quién</th>
              <th>Productos</th>
              <th className="text-end">Total</th>
              <th>Despacho</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => {
              const estado = ESTADO_DESPACHO[v.estado_despacho] || { etiqueta: v.estado_despacho, color: 'secondary' };
              const anulada = v.estado === 'anulada';
              return (
                <tr key={v.id} className={anulada ? 'text-muted' : undefined}>
                  <td>
                    {formatoCorto(v.fecha)}
                    <div className="text-muted small">#{v.id}</div>
                  </td>
                  <td>
                    <span className={anulada ? '' : 'fw-semibold'}>
                      {v.Sucursal?.nombre || v.cliente_nombre || '—'}
                    </span>
                    {v.origen === 'sucursal' && (
                      <Badge bg="light" text="dark" className="ms-2">
                        Venta de sucursal
                      </Badge>
                    )}
                    {anulada && (
                      <Badge bg="secondary" className="ms-2">
                        Anulada
                      </Badge>
                    )}
                  </td>
                  <td className="small text-muted">
                    {(v.Items || []).map((i) => (
                      <div key={i.id}>
                        {i.producto}: {i.kilos} kg
                        {i.diferencia !== null && i.diferencia !== undefined && Math.abs(i.diferencia) > 0.005 && (
                          <span className={i.diferencia < 0 ? 'text-danger' : 'text-success'}>
                            {' '}
                            (contó {i.kilos_recibidos})
                          </span>
                        )}
                      </div>
                    ))}
                  </td>
                  <td className="text-end fw-semibold">{dinero(v.total, v.moneda)}</td>
                  <td>
                    <Badge bg={estado.color}>{estado.etiqueta}</Badge>
                    {v.fecha_recepcion && (
                      <div className="text-muted small">Recibido {formatoCorto(v.fecha_recepcion)}</div>
                    )}
                  </td>
                  <td className="text-end">
                    <div className="d-flex gap-2 justify-content-end">
                      {v.estado_despacho === 'diferencia' && !anulada && (
                        <Button size="sm" variant="danger" onClick={() => abrirResolver(v)}>
                          Resolver
                        </Button>
                      )}
                      {!anulada && (
                        <Button size="sm" variant="outline-danger" onClick={() => anular(v)}>
                          Anular
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {ventas.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  Todavía no hay ventas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Modal nueva venta ---------- */}
      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered size="lg">
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>Nueva venta</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorForm && <Alert variant="danger">{errorForm}</Alert>}

            <div className="row g-3 mb-3">
              <div className="col-sm-4">
                <Form.Label>Fecha</Form.Label>
                <Form.Control
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </div>
              <div className="col-sm-4">
                <Form.Label>¿A quién?</Form.Label>
                <Form.Select
                  value={form.destino}
                  onChange={(e) => setForm({ ...form, destino: e.target.value, sucursal_id: '', cliente_nombre: '' })}
                >
                  <option value="sucursal">A una sucursal</option>
                  <option value="directo">Venta directa</option>
                </Form.Select>
              </div>
              <div className="col-sm-4">
                <Form.Label>Moneda</Form.Label>
                <Form.Select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Form.Select>
              </div>

              <div className="col-12">
                {esASucursal ? (
                  <>
                    <Form.Label>Sucursal</Form.Label>
                    <Form.Select
                      value={form.sucursal_id}
                      onChange={(e) => {
                        const elegida = sucursales.find((s) => String(s.id) === e.target.value);
                        setForm({
                          ...form,
                          sucursal_id: e.target.value,
                          moneda: elegida?.moneda || form.moneda,
                        });
                      }}
                    >
                      <option value="">Elija la sucursal</option>
                      {sucursales.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      La sucursal tendrá que confirmar cuántos kilos recibió, sin ver lo que se despachó.
                    </Form.Text>
                  </>
                ) : (
                  <>
                    <Form.Label>Cliente</Form.Label>
                    <Form.Control
                      value={form.cliente_nombre}
                      onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })}
                      placeholder="Nombre de quien compra"
                    />
                  </>
                )}
              </div>
            </div>

            {/* ---- Productos ---- */}
            <div className="border rounded p-3 mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>¿Qué se vende?</strong>
                <Button size="sm" variant="outline-success" onClick={agregarLinea}>
                  + Agregar producto
                </Button>
              </div>

              <div className="d-flex flex-column gap-2">
                {lineas.map((l) => {
                  const disponible = l.producto ? disponibleDe(l.producto) : null;
                  const excede = l.producto && !vacio(l.kilos) && Number(l.kilos) > disponible;
                  const subtotal = Number(l.kilos || 0) * Number(l.precio_kilo || 0);
                  return (
                    <div key={l.id}>
                      <InputGroup>
                        <Form.Select
                          value={l.producto}
                          onChange={(e) => cambiarLinea(l.id, 'producto', e.target.value)}
                        >
                          <option value="">Elija el producto</option>
                          {disponibles.map((p) => (
                            <option key={p.producto} value={p.producto}>
                              {p.producto} ({p.kilos} kg disponibles)
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.001"
                          value={l.kilos}
                          isInvalid={excede}
                          onChange={(e) => cambiarLinea(l.id, 'kilos', e.target.value)}
                          placeholder="Kilos"
                          style={{ maxWidth: 120 }}
                        />
                        <InputGroup.Text>kg</InputGroup.Text>
                        <Form.Control
                          type="number"
                          min="0"
                          value={l.piezas}
                          onChange={(e) => cambiarLinea(l.id, 'piezas', e.target.value)}
                          placeholder="Piezas"
                          style={{ maxWidth: 100 }}
                        />
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.precio_kilo}
                          onChange={(e) => cambiarLinea(l.id, 'precio_kilo', e.target.value)}
                          placeholder="Precio/kg"
                          style={{ maxWidth: 130 }}
                        />
                        <Button variant="outline-danger" onClick={() => quitarLinea(l.id)}>
                          ✕
                        </Button>
                      </InputGroup>
                      <div className="d-flex justify-content-between mt-1">
                        {excede ? (
                          <span className="text-danger small">
                            En cuarto frío solo hay {disponible} kg de {l.producto}.
                          </span>
                        ) : (
                          <span />
                        )}
                        {subtotal > 0 && (
                          <span className="text-muted small">{dinero(subtotal, form.moneda)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-end mt-3 pt-2 border-top fs-5">
                Total: <strong>{dinero(totalVenta, form.moneda)}</strong>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-sm-5">
                <Form.Label>Cómo paga</Form.Label>
                <Form.Select
                  value={form.metodo_pago}
                  onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.etiqueta}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-sm-7">
                <Form.Label>Referencia o factura</Form.Label>
                <Form.Control
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                />
              </div>
              <div className="col-12">
                <Form.Label>Nota (opcional)</Form.Label>
                <Form.Control value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModal(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardando}>
              {guardando ? 'Registrando...' : 'Registrar venta'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- Modal resolver diferencia ---------- */}
      <Modal show={Boolean(ventaResolver)} onHide={() => setVentaResolver(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Diferencia en el despacho #{ventaResolver?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {ventaResolver && (
            <>
              <p className="text-muted small">
                {ventaResolver.Sucursal?.nombre} contó una cantidad distinta a la que salió de la planta. Mientras no
                se decida, el producto no entra a su inventario.
              </p>

              <Table size="sm" className="mb-3">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-end">Se envió</th>
                    <th className="text-end">Contó</th>
                    <th className="text-end">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {ventaResolver.Items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.producto}</td>
                      <td className="text-end">{i.kilos}</td>
                      <td className="text-end">{i.kilos_recibidos}</td>
                      <td className={`text-end fw-semibold ${i.diferencia < 0 ? 'text-danger' : 'text-success'}`}>
                        {i.diferencia > 0 ? '+' : ''}
                        {i.diferencia}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <Form.Group className="mb-3">
                <Form.Label>¿Qué se hace?</Form.Label>
                <Form.Select value={resolucion} onChange={(e) => setResolucion(e.target.value)}>
                  <option value="acepta_recibido">
                    Vale lo que contó la sucursal — se le cobra eso y lo demás vuelve a cuarto frío
                  </option>
                  <option value="merma_transito">
                    Se perdió en el camino — se le cobra lo enviado, pero solo carga lo que recibió
                  </option>
                  <option value="acepta_enviado">
                    Vale lo que salió de la planta — contaron mal, se le carga todo
                  </option>
                </Form.Select>
              </Form.Group>

              <Form.Group>
                <Form.Label>Nota (opcional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={notaResolucion}
                  onChange={(e) => setNotaResolucion(e.target.value)}
                  placeholder="Qué se conversó, quién revisó..."
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setVentaResolver(null)}>
            Cancelar
          </Button>
          <Button variant="success" onClick={guardarResolucion} disabled={resolviendo}>
            {resolviendo ? 'Guardando...' : 'Resolver'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Ventas;
