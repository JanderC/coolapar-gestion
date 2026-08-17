import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card, Nav } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import * as ventasApi from '../../api/ventas.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { desempacar, formatoCorto, hoy, vacio } from '../../utils/fechas';

const MONEDAS = ['BS', 'USD', 'COP'];

const UNIDADES = ['kg', 'g', 'L', 'ml', 'unidades', 'paquetes', 'cajas', 'bultos', 'docenas'];

const ESTADO_DESPACHO = {
  pendiente: { etiqueta: 'Esperando que confirmen', color: 'warning' },
  recibido: { etiqueta: 'Recibido', color: 'success' },
  diferencia: { etiqueta: 'Con diferencia', color: 'danger' },
  cerrado: { etiqueta: 'Cerrado', color: 'success' },
  no_aplica: { etiqueta: '—', color: 'secondary' },
};

const COLOR_MOVIMIENTO = {
  recepcion: 'success',
  venta: 'primary',
  ajuste: 'warning',
  merma: 'dark',
};

const inicioDeMes = (texto) => `${String(texto).slice(0, 7)}-01`;

const detalleError = (err) => {
  if (err?.response) return err.response.data?.message || `El servidor respondió ${err.response.status}.`;
  if (err?.request) return 'El servidor no respondió. Revise la conexión.';
  return err?.message || 'Error desconocido.';
};

const dinero = (valor, moneda = 'BS') =>
  `${Number(valor || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;

const SucursalDetalle = () => {
  const { id } = useParams();
  const navegar = useNavigate();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [vista, setVista] = useState('ventas');

  const [desde, setDesde] = useState(() => inicioDeMes(hoy()));
  const [hasta, setHasta] = useState(() => hoy());

  // ---- Corregir existencia ----
  const [mostrarAjuste, setMostrarAjuste] = useState(false);
  const [ajuste, setAjuste] = useState({ producto: '', cantidad: '', suma: 'true', motivo: '' });
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [errorAjuste, setErrorAjuste] = useState('');

  // ---- Editar la ficha del producto ----
  const [productoEditar, setProductoEditar] = useState(null);
  const [formProducto, setFormProducto] = useState(null);
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [errorProducto, setErrorProducto] = useState('');

  const cargar = useCallback(
    async (rangoDesde = desde, rangoHasta = hasta) => {
      setError('');
      try {
        setDatos(
          desempacar(await ventasApi.detalleSucursal(id, { fecha_inicio: rangoDesde, fecha_fin: rangoHasta })) || null
        );
      } catch (err) {
        setError(`No se pudo cargar la sucursal. ${detalleError(err)}`);
      } finally {
        setCargando(false);
      }
    },
    [id, desde, hasta]
  );

  useEffect(() => {
    cargar();
    // Solo la primera vez: después se consulta con el botón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const inventario = datos?.inventario || [];
  const conExistencia = useMemo(() => inventario.filter((p) => p.cantidad > 0), [inventario]);

  const unidadDe = useCallback(
    (producto) => inventario.find((p) => p.producto === producto)?.unidad_medida || 'u',
    [inventario]
  );

  // ---------- Corregir existencia ----------
  const abrirAjuste = (producto = '') => {
    setAjuste({ producto, cantidad: '', suma: 'true', motivo: '' });
    setErrorAjuste('');
    setMostrarAjuste(true);
  };

  const guardarAjuste = async (ev) => {
    ev.preventDefault();
    setErrorAjuste('');
    if (!ajuste.producto) return setErrorAjuste('Elija el producto.');
    if (vacio(ajuste.cantidad) || Number(ajuste.cantidad) <= 0) return setErrorAjuste('Indique la cantidad.');
    if (vacio(ajuste.motivo)) return setErrorAjuste('Escriba por qué se corrige: quedará en el historial.');

    setGuardandoAjuste(true);
    try {
      const respuesta = await ventasApi.ajustarInventarioSucursal({
        sucursal_id: Number(id),
        producto: ajuste.producto,
        kilos: Number(ajuste.cantidad),
        suma: ajuste.suma === 'true',
        motivo: ajuste.motivo.trim(),
      });
      setMostrarAjuste(false);
      setAviso(respuesta?.message || 'Inventario corregido.');
      await cargar();
    } catch (err) {
      setErrorAjuste(`No se pudo corregir. ${detalleError(err)}`);
    } finally {
      setGuardandoAjuste(false);
    }
  };

  // ---------- Editar la ficha ----------
  const abrirProducto = (p) => {
    const ficha = (datos?.catalogo || []).find((c) => c.nombre === p.producto);
    setProductoEditar(ficha || null);
    setFormProducto({
      nombre: p.producto,
      categoria: ficha?.categoria || '',
      unidad_medida: p.unidad_medida || 'kg',
      precio_venta: p.precio_venta ?? '',
      moneda: p.moneda || datos?.sucursal?.moneda || 'BS',
      codigo_barras: ficha?.codigo_barras || '',
    });
    setErrorProducto('');
  };

  const guardarProducto = async (ev) => {
    ev.preventDefault();
    setErrorProducto('');

    setGuardandoProducto(true);
    try {
      const cuerpo = { ...formProducto, sucursal_id: Number(id) };
      if (productoEditar) await ventasApi.actualizarProductoSucursal(productoEditar.id, cuerpo);
      else await ventasApi.crearProductoSucursal(cuerpo);

      setFormProducto(null);
      setProductoEditar(null);
      setAviso('Producto actualizado.');
      await cargar();
    } catch (err) {
      setErrorProducto(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardandoProducto(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando sucursal..." />;
  if (!datos) return <Alert variant="danger">{error || 'No se encontró la sucursal.'}</Alert>;

  const { sucursal, totales, ventas, despachos, movimientos } = datos;

  return (
    <div>
      <div className="page-header mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <Button variant="link" className="p-0 mb-1" onClick={() => navegar('/sucursales')}>
            ← Todas las sucursales
          </Button>
          <h4 className="mb-1">{sucursal.nombre}</h4>
          <p className="text-muted mb-0">
            {sucursal.encargado ? `${sucursal.encargado} · ` : ''}
            {sucursal.direccion || 'Sin dirección cargada'}
          </p>
        </div>
        <div className="d-flex flex-wrap align-items-end gap-2">
          <div>
            <Form.Label className="small text-muted mb-1">Desde</Form.Label>
            <Form.Control type="date" size="sm" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Form.Label className="small text-muted mb-1">Hasta</Form.Label>
            <Form.Control type="date" size="sm" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button size="sm" variant="success" onClick={() => cargar()}>
            Ver
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

      {totales.despachos_con_diferencia > 0 && (
        <Alert variant="danger" className="py-2">
          {totales.despachos_con_diferencia} despacho(s) con diferencia sin resolver. Se resuelven desde «Ventas».
        </Alert>
      )}

      {/* ---------- Lo vendido en el período ---------- */}
      <div className="d-flex flex-wrap gap-3 mb-3">
        {totales.por_moneda.map((t) => (
          <Card key={t.moneda} className="flex-grow-1" style={{ minWidth: 220 }}>
            <Card.Body className="py-3">
              <div className="text-muted small text-uppercase">Vendió en {t.moneda}</div>
              <div className="fs-3 fw-semibold lh-1 mt-1">{dinero(t.total, t.moneda)}</div>
              <div className="text-muted small mt-1">{t.ventas} venta(s) en el período</div>
            </Card.Body>
          </Card>
        ))}
        <Card className="flex-grow-1" style={{ minWidth: 200 }}>
          <Card.Body className="py-3">
            <div className="text-muted small text-uppercase">En existencia</div>
            <div className="fs-3 fw-semibold lh-1 mt-1">{conExistencia.length}</div>
            <div className="text-muted small mt-1">producto(s) cargados</div>
          </Card.Body>
        </Card>
        {totales.despachos_pendientes > 0 && (
          <Card className="flex-grow-1 border-warning" style={{ minWidth: 200 }}>
            <Card.Body className="py-3">
              <div className="text-muted small text-uppercase">Sin confirmar</div>
              <div className="fs-3 fw-semibold lh-1 mt-1">{totales.despachos_pendientes}</div>
              <div className="text-muted small mt-1">despacho(s) por recibir</div>
            </Card.Body>
          </Card>
        )}
      </div>

      <Nav variant="tabs" activeKey={vista} onSelect={(k) => k && setVista(k)} className="mb-3">
        <Nav.Item>
          <Nav.Link eventKey="ventas">Sus ventas</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="inventario">Su inventario</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="despachos">Lo que le envié</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="movimientos">Todos los movimientos</Nav.Link>
        </Nav.Item>
      </Nav>

      {/* ---------- VENTAS ---------- */}
      {vista === 'ventas' && (
        <>
          {totales.por_dia.length > 0 && (
            <Card className="mb-3">
              <Card.Header>
                <strong>Día por día</strong>
              </Card.Header>
              <Table size="sm" responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="text-end">Ventas</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {totales.por_dia.map((d) => (
                    <tr key={`${d.fecha}-${d.moneda}`}>
                      <td>{formatoCorto(d.fecha)}</td>
                      <td className="text-end text-muted">{d.ventas}</td>
                      <td className="text-end fw-semibold">{dinero(d.total, d.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {totales.por_producto.length > 0 && (
            <Card className="mb-3">
              <Card.Header>
                <strong>Qué se vendió más</strong>
              </Card.Header>
              <Table size="sm" responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-end">Cantidad</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {totales.por_producto.map((p) => (
                    <tr key={p.producto}>
                      <td className="fw-semibold">{p.producto}</td>
                      <td className="text-end">
                        {p.cantidad} {unidadDe(p.producto)}
                      </td>
                      <td className="text-end fw-semibold">{dinero(p.total, p.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          <Card>
            <Card.Header>
              <strong>Cada venta</strong>
            </Card.Header>
            <Table hover responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Qué llevó</th>
                  <th>Pagó con</th>
                  <th className="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id} className={v.estado === 'anulada' ? 'text-muted' : undefined}>
                    <td>
                      {formatoCorto(v.fecha)}
                      <div className="text-muted small">#{v.id}</div>
                    </td>
                    <td>
                      {v.cliente_nombre || 'Mostrador'}
                      {v.estado === 'anulada' && (
                        <Badge bg="secondary" className="ms-2">
                          Anulada
                        </Badge>
                      )}
                    </td>
                    <td className="small text-muted">
                      {(v.Items || []).map((i) => (
                        <div key={i.id}>
                          {i.producto}: {i.kilos} × {dinero(i.precio_kilo, v.moneda)}
                        </div>
                      ))}
                    </td>
                    <td className="text-muted text-capitalize">{v.metodo_pago || '—'}</td>
                    <td className="text-end fw-semibold">{dinero(v.total, v.moneda)}</td>
                  </tr>
                ))}
                {ventas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      No registró ventas entre esas fechas.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      {/* ---------- INVENTARIO ---------- */}
      {vista === 'inventario' && (
        <Card>
          <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <strong>Lo que tiene cargado</strong>
              <div className="text-muted small">
                Incluye lo que recibió de la planta y lo que cargó por su cuenta.
              </div>
            </div>
            <Button size="sm" variant="outline-success" onClick={() => abrirAjuste()}>
              Corregir existencia
            </Button>
          </Card.Header>
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="text-end">Existencia</th>
                <th className="text-end">Precio</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inventario.map((p) => (
                <tr key={p.producto} className={p.cantidad > 0 ? undefined : 'text-muted'}>
                  <td>
                    <span className={p.cantidad > 0 ? 'fw-semibold' : ''}>{p.producto}</span>
                    {p.codigo_barras && <div className="text-muted small">{p.codigo_barras}</div>}
                  </td>
                  <td className="text-muted">{p.categoria}</td>
                  <td className="text-end fw-semibold">
                    {p.cantidad} <span className="fw-normal text-muted">{p.unidad_medida}</span>
                  </td>
                  <td className="text-end text-muted">
                    {p.precio_venta === null
                      ? '—'
                      : `${dinero(p.precio_venta, p.moneda || sucursal.moneda)} / ${p.unidad_medida}`}
                  </td>
                  <td className="text-end">
                    <div className="d-flex gap-2 justify-content-end">
                      <Button size="sm" variant="outline-secondary" onClick={() => abrirProducto(p)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="outline-warning" onClick={() => abrirAjuste(p.producto)}>
                        Corregir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {inventario.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Esta sucursal no tiene productos cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ---------- DESPACHOS ---------- */}
      {vista === 'despachos' && (
        <Card>
          <Card.Header>
            <strong>Lo que le envié</strong>
            <div className="text-muted small">
              Lo despachado desde la planta y lo que la sucursal contó al recibirlo.
            </div>
          </Card.Header>
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th className="text-end">Envié</th>
                <th className="text-end">Contó</th>
                <th>Estado</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              {despachos.map((d) => {
                const estado = ESTADO_DESPACHO[d.estado_despacho] || { etiqueta: d.estado_despacho, color: 'secondary' };
                return (
                  <tr key={d.id} className={d.estado === 'anulada' ? 'text-muted' : undefined}>
                    <td>
                      {formatoCorto(d.fecha)}
                      <div className="text-muted small">#{d.id}</div>
                    </td>
                    <td className="small">
                      {(d.Items || []).map((i) => (
                        <div key={i.id}>{i.producto}</div>
                      ))}
                    </td>
                    <td className="text-end small">
                      {(d.Items || []).map((i) => (
                        <div key={i.id}>{i.kilos} kg</div>
                      ))}
                    </td>
                    <td className="text-end small">
                      {(d.Items || []).map((i) => {
                        const recibido = i.kilos_recibidos;
                        const cuadra =
                          recibido === null || Math.abs(Number(recibido) - Number(i.kilos)) <= 0.005;
                        return (
                          <div key={i.id} className={cuadra ? '' : 'text-danger fw-semibold'}>
                            {recibido === null ? '—' : `${recibido} kg`}
                          </div>
                        );
                      })}
                    </td>
                    <td>
                      <Badge bg={estado.color}>{estado.etiqueta}</Badge>
                      {d.fecha_recepcion && (
                        <div className="text-muted small">{formatoCorto(d.fecha_recepcion)}</div>
                      )}
                    </td>
                    <td className="text-end fw-semibold">{dinero(d.total, d.moneda)}</td>
                  </tr>
                );
              })}
              {despachos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No se le despachó nada entre esas fechas.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ---------- MOVIMIENTOS ---------- */}
      {vista === 'movimientos' && (
        <Card>
          <Card.Header>
            <strong>Todo lo que entró y salió</strong>
            <div className="text-muted small">
              Para saber de dónde salió cada unidad: lo recibido, lo vendido y lo que se corrigió a mano.
            </div>
          </Card.Header>
          <Table hover responsive className="mb-0 align-middle small">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Qué pasó</th>
                <th className="text-end">Cantidad</th>
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
                      <Badge bg={COLOR_MOVIMIENTO[m.tipo] || 'secondary'}>{m.tipo}</Badge>
                    </td>
                    <td className={`text-end fw-semibold ${suma ? 'text-success' : 'text-primary'}`}>
                      {suma ? '+' : '−'}
                      {m.cantidad} {m.unidad_medida}
                    </td>
                    <td className="text-muted">{m.descripcion || '—'}</td>
                  </tr>
                );
              })}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Sin movimientos entre esas fechas.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ---------- Modal: corregir existencia ---------- */}
      <Modal show={mostrarAjuste} onHide={() => setMostrarAjuste(false)} centered>
        <Form onSubmit={guardarAjuste}>
          <Modal.Header closeButton>
            <Modal.Title>Corregir existencia</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorAjuste && <Alert variant="danger">{errorAjuste}</Alert>}

            <Alert variant="warning" className="py-2 small">
              Está corrigiendo el inventario de {sucursal.nombre} a distancia, sin ver el producto. Conviene
              confirmarlo antes con quien está en la tienda.
            </Alert>

            <Form.Group className="mb-3">
              <Form.Label>Producto</Form.Label>
              <Form.Select
                value={ajuste.producto}
                onChange={(e) => setAjuste({ ...ajuste, producto: e.target.value })}
              >
                <option value="">Elija el producto</option>
                {inventario.map((p) => (
                  <option key={p.producto} value={p.producto}>
                    {p.producto} ({p.cantidad} {p.unidad_medida})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <div className="row g-3">
              <div className="col-sm-6">
                <Form.Label>¿Qué se hace?</Form.Label>
                <Form.Select value={ajuste.suma} onChange={(e) => setAjuste({ ...ajuste, suma: e.target.value })}>
                  <option value="true">Sumar</option>
                  <option value="false">Restar</option>
                </Form.Select>
              </div>
              <div className="col-sm-6">
                <Form.Label>Cantidad</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.001"
                    value={ajuste.cantidad}
                    onChange={(e) => setAjuste({ ...ajuste, cantidad: e.target.value })}
                  />
                  <InputGroup.Text>{ajuste.producto ? unidadDe(ajuste.producto) : 'u'}</InputGroup.Text>
                </InputGroup>
              </div>
              <div className="col-12">
                <Form.Label>Motivo</Form.Label>
                <Form.Control
                  value={ajuste.motivo}
                  onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })}
                  placeholder="Conteo con el encargado, producto dañado..."
                />
                <Form.Text className="text-muted">Queda en el historial de movimientos.</Form.Text>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarAjuste(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoAjuste}>
              {guardandoAjuste ? 'Guardando...' : 'Corregir'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- Modal: ficha del producto ---------- */}
      <Modal show={Boolean(formProducto)} onHide={() => setFormProducto(null)} centered>
        <Form onSubmit={guardarProducto}>
          <Modal.Header closeButton>
            <Modal.Title>{formProducto?.nombre}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorProducto && <Alert variant="danger">{errorProducto}</Alert>}

            {formProducto && (
              <div className="row g-3">
                <div className="col-12">
                  <Form.Label>Nombre</Form.Label>
                  <Form.Control
                    value={formProducto.nombre}
                    onChange={(e) => setFormProducto({ ...formProducto, nombre: e.target.value })}
                  />
                </div>
                <div className="col-sm-7">
                  <Form.Label>Código de barras</Form.Label>
                  <Form.Control
                    value={formProducto.codigo_barras}
                    onChange={(e) => setFormProducto({ ...formProducto, codigo_barras: e.target.value })}
                  />
                </div>
                <div className="col-sm-5">
                  <Form.Label>Se mide en</Form.Label>
                  <Form.Select
                    value={formProducto.unidad_medida}
                    onChange={(e) => setFormProducto({ ...formProducto, unidad_medida: e.target.value })}
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">Solo se puede cambiar si está en cero.</Form.Text>
                </div>
                <div className="col-sm-7">
                  <Form.Label>Precio de venta</Form.Label>
                  <InputGroup>
                    <Form.Select
                      value={formProducto.moneda}
                      onChange={(e) => setFormProducto({ ...formProducto, moneda: e.target.value })}
                      style={{ maxWidth: 100 }}
                    >
                      {MONEDAS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Control
                      type="number"
                      min="0"
                      step="0.01"
                      value={formProducto.precio_venta}
                      onChange={(e) => setFormProducto({ ...formProducto, precio_venta: e.target.value })}
                    />
                  </InputGroup>
                </div>
                <div className="col-sm-5">
                  <Form.Label>Categoría</Form.Label>
                  <Form.Control
                    value={formProducto.categoria}
                    onChange={(e) => setFormProducto({ ...formProducto, categoria: e.target.value })}
                  />
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setFormProducto(null)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoProducto}>
              {guardandoProducto ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default SucursalDetalle;
