import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card, Tabs, Tab } from 'react-bootstrap';
import * as insumosApi from '../../api/insumos.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';
import { aNumero, desempacar, formatoCorto, hoy, vacio } from '../../utils/fechas';

const OPCIONES_MONEDA = [
  { codigo: 'BS', etiqueta: 'Bs. — Bolívares' },
  { codigo: 'USD', etiqueta: '$ — Dólares' },
  { codigo: 'COP', etiqueta: 'COL$ — Pesos colombianos' },
];

const UNIDADES_SUGERIDAS = ['kg', 'g', 'L', 'ml', 'unidades', 'sacos', 'cajas'];

const formInsumoVacio = {
  nombre: '',
  unidad_medida: '',
  precio_unitario_referencia: '',
  moneda_referencia: 'BS',
  stock_minimo: '',
  proveedor: '',
};

const formMovimientoVacio = {
  tipo: 'entrada',
  cantidad: '',
  precio_unitario: '',
  moneda: 'BS',
  fecha: hoy(),
  descripcion: '',
};

// Un insumo esta "en alerta" cuando su stock ya cayo al minimo o por debajo.
// stock_minimo es opcional: si no se definio, nunca entra en alerta.
const stockBajo = (i) =>
  i.stock_minimo !== null && i.stock_minimo !== undefined && aNumero(i.stock_actual) <= aNumero(i.stock_minimo);

const Insumos = () => {
  const { formatearMontoEnMoneda } = useMoneda();

  const [pestana, setPestana] = useState('kardex');
  const [insumos, setInsumos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // ---------- Catálogo ----------
  const [busqueda, setBusqueda] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [mostrarModalInsumo, setMostrarModalInsumo] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formInsumo, setFormInsumo] = useState(formInsumoVacio);
  const [guardandoInsumo, setGuardandoInsumo] = useState(false);
  const [errorFormInsumo, setErrorFormInsumo] = useState('');

  // ---------- Kardex ----------
  const [insumoId, setInsumoId] = useState('');
  const [movimientos, setMovimientos] = useState([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [mostrarModalMovimiento, setMostrarModalMovimiento] = useState(false);
  const [formMovimiento, setFormMovimiento] = useState(formMovimientoVacio);
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);
  const [errorFormMovimiento, setErrorFormMovimiento] = useState('');
  const [anulando, setAnulando] = useState(false);

  const insumo = useMemo(
    () => insumos.find((i) => String(i.id) === String(insumoId)) || null,
    [insumos, insumoId]
  );

  const cargarInsumos = async () => {
    setCargando(true);
    setError('');
    try {
      setInsumos(desempacar(await insumosApi.listarInsumos()) || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los insumos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarInsumos();
  }, []);

  const cargarMovimientos = useCallback(async () => {
    if (!insumoId) {
      setMovimientos([]);
      return;
    }
    setCargandoMovimientos(true);
    setError('');
    try {
      setMovimientos(desempacar(await insumosApi.listarMovimientos(insumoId)) || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar el kardex de este insumo.');
    } finally {
      setCargandoMovimientos(false);
    }
  }, [insumoId]);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  const insumosVisibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return insumos.filter((i) => {
      if (!verInactivos && !i.activo) return false;
      if (texto && !i.nombre.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [insumos, busqueda, verInactivos]);

  const enAlerta = useMemo(() => insumos.filter((i) => i.activo && stockBajo(i)), [insumos]);

  // ---------- CRUD del catálogo ----------
  const abrirNuevoInsumo = () => {
    setEditandoId(null);
    setFormInsumo(formInsumoVacio);
    setErrorFormInsumo('');
    setMostrarModalInsumo(true);
  };

  const abrirEditarInsumo = (i) => {
    setEditandoId(i.id);
    setFormInsumo({
      nombre: i.nombre || '',
      unidad_medida: i.unidad_medida || '',
      precio_unitario_referencia: i.precio_unitario_referencia ?? '',
      moneda_referencia: i.moneda_referencia || 'BS',
      stock_minimo: i.stock_minimo ?? '',
      proveedor: i.proveedor || '',
    });
    setErrorFormInsumo('');
    setMostrarModalInsumo(true);
  };

  const guardarInsumo = async (e) => {
    e.preventDefault();
    setErrorFormInsumo('');
    if (!formInsumo.nombre.trim()) return setErrorFormInsumo('Escriba el nombre del insumo.');
    if (!formInsumo.unidad_medida.trim()) return setErrorFormInsumo('Indique la unidad de medida.');

    const payload = {
      nombre: formInsumo.nombre.trim(),
      unidad_medida: formInsumo.unidad_medida.trim(),
      precio_unitario_referencia: vacio(formInsumo.precio_unitario_referencia)
        ? null
        : Number(formInsumo.precio_unitario_referencia),
      moneda_referencia: formInsumo.moneda_referencia,
      stock_minimo: vacio(formInsumo.stock_minimo) ? null : Number(formInsumo.stock_minimo),
      proveedor: vacio(formInsumo.proveedor) ? null : formInsumo.proveedor.trim(),
    };

    setGuardandoInsumo(true);
    try {
      let creado = null;
      if (editandoId) {
        await insumosApi.actualizarInsumo(editandoId, payload);
      } else {
        creado = desempacar(await insumosApi.crearInsumo(payload));
      }
      setMostrarModalInsumo(false);
      setAviso(editandoId ? 'Insumo actualizado.' : 'Insumo registrado. Ahora cargue su stock inicial en el Kardex.');
      await cargarInsumos();

      // Insumo nuevo: lo llevamos directo al Kardex para que carguen el
      // stock inicial como una entrada, en vez de dejarlos en el catálogo.
      if (creado) {
        setInsumoId(String(creado.id));
        setPestana('kardex');
      }
    } catch (err) {
      setErrorFormInsumo(err.response?.data?.message || 'No se pudo guardar el insumo.');
    } finally {
      setGuardandoInsumo(false);
    }
  };

  const cambiarEstadoInsumo = async (i) => {
    const desactivando = i.activo;
    const pregunta = desactivando
      ? `¿Desactivar ${i.nombre}? Dejará de aparecer para registrar movimientos nuevos.`
      : `¿Reactivar ${i.nombre}?`;
    if (!window.confirm(pregunta)) return;

    setError('');
    try {
      if (desactivando) {
        await insumosApi.eliminarInsumo(i.id);
      } else {
        await insumosApi.actualizarInsumo(i.id, { activo: true });
      }
      setAviso(desactivando ? 'Insumo desactivado.' : 'Insumo reactivado.');
      await cargarInsumos();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cambiar el estado del insumo.');
    }
  };

  // ---------- Kardex ----------
  const abrirModalMovimiento = (tipo) => {
    setFormMovimiento({ ...formMovimientoVacio, tipo, fecha: hoy() });
    setErrorFormMovimiento('');
    setMostrarModalMovimiento(true);
  };

  const guardarMovimiento = async (e) => {
    e.preventDefault();
    setErrorFormMovimiento('');

    const cantidad = Number(formMovimiento.cantidad);
    if (!formMovimiento.cantidad || Number.isNaN(cantidad) || cantidad <= 0) {
      return setErrorFormMovimiento('Indique una cantidad mayor a 0.');
    }
    if (formMovimiento.tipo === 'entrada' && (vacio(formMovimiento.precio_unitario) || !formMovimiento.moneda)) {
      return setErrorFormMovimiento('Las entradas necesitan precio unitario y moneda.');
    }
    if (formMovimiento.tipo === 'salida' && insumo && cantidad > aNumero(insumo.stock_actual)) {
      return setErrorFormMovimiento(`Stock insuficiente. Hay ${insumo.stock_actual} ${insumo.unidad_medida} disponibles.`);
    }

    const payload = {
      tipo: formMovimiento.tipo,
      cantidad,
      precio_unitario:
        formMovimiento.tipo === 'entrada' && !vacio(formMovimiento.precio_unitario)
          ? Number(formMovimiento.precio_unitario)
          : null,
      moneda: formMovimiento.tipo === 'entrada' ? formMovimiento.moneda : null,
      fecha: formMovimiento.fecha,
      descripcion: vacio(formMovimiento.descripcion) ? null : formMovimiento.descripcion.trim(),
    };

    setGuardandoMovimiento(true);
    try {
      await insumosApi.registrarMovimiento(insumoId, payload);
      setMostrarModalMovimiento(false);
      setAviso(formMovimiento.tipo === 'entrada' ? 'Entrada registrada.' : 'Salida registrada.');
      await Promise.all([cargarInsumos(), cargarMovimientos()]);
    } catch (err) {
      setErrorFormMovimiento(err.response?.data?.message || 'No se pudo registrar el movimiento.');
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  const anularUltimoMovimiento = async () => {
    if (movimientos.length === 0) return;
    if (!window.confirm('¿Anular el último movimiento? Esto revierte el stock.')) return;

    setAnulando(true);
    setError('');
    try {
      await insumosApi.anularMovimiento(movimientos[0].id);
      setAviso('Movimiento anulado.');
      await Promise.all([cargarInsumos(), cargarMovimientos()]);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo anular el movimiento.');
    } finally {
      setAnulando(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando insumos..." />;

  return (
    <div>
      <div className="page-header mb-3">
        <h4 className="mb-1">Insumos</h4>
        <p className="text-muted mb-0">
          El stock se lleva por kardex: cada compra es una entrada y cada consumo o merma es una salida. El stock
          actual nunca se edita a mano — se calcula solo, a partir del historial.
        </p>
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

      {enAlerta.length > 0 && (
        <Alert variant="warning" className="d-flex flex-wrap align-items-center gap-2">
          <strong className="me-1">Stock bajo:</strong>
          {enAlerta.map((i) => (
            <Badge key={i.id} bg="dark" className="fw-normal">
              {i.nombre} — {i.stock_actual} {i.unidad_medida}
            </Badge>
          ))}
        </Alert>
      )}

      <Tabs activeKey={pestana} onSelect={(k) => setPestana(k || 'kardex')} className="mb-3">
        {/* ---------- Kardex ---------- */}
        <Tab eventKey="kardex" title="Kardex">
          <Card className="mb-3">
            <Card.Body className="d-flex flex-wrap gap-4 align-items-center">
              <div style={{ minWidth: 260 }}>
                <Form.Label className="small text-muted mb-1">Insumo</Form.Label>
                <Form.Select value={insumoId} onChange={(e) => setInsumoId(e.target.value)}>
                  <option value="">Seleccione un insumo</option>
                  {insumos
                    .filter((i) => i.activo)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nombre}
                      </option>
                    ))}
                </Form.Select>
              </div>

              {insumo && (
                <>
                  <div>
                    <div className="small text-muted mb-1">Stock actual</div>
                    <div className="fs-4 fw-bold lh-1">
                      {insumo.stock_actual} <span className="fs-6 fw-normal text-muted">{insumo.unidad_medida}</span>
                    </div>
                  </div>
                  {!vacio(insumo.stock_minimo) && (
                    <div>
                      <div className="small text-muted mb-1">Stock mínimo</div>
                      <div className="fw-semibold">
                        {insumo.stock_minimo} {insumo.unidad_medida}
                      </div>
                    </div>
                  )}
                  {stockBajo(insumo) && <Badge bg="danger">Stock bajo</Badge>}
                  {insumo.proveedor && (
                    <div>
                      <div className="small text-muted mb-1">Proveedor</div>
                      <div>{insumo.proveedor}</div>
                    </div>
                  )}
                </>
              )}
            </Card.Body>

            {insumo && (
              <Card.Footer className="d-flex justify-content-end gap-2 flex-wrap">
                <Button variant="outline-success" onClick={() => abrirModalMovimiento('entrada')}>
                  <span className="btn-icon-plus">+</span>Registrar entrada
                </Button>
                <Button variant="outline-danger" onClick={() => abrirModalMovimiento('salida')}>
                  Registrar salida
                </Button>
              </Card.Footer>
            )}
          </Card>

          {!insumoId ? (
            <Alert variant="light" className="border text-muted">
              Seleccione un insumo para ver su kardex.
            </Alert>
          ) : cargandoMovimientos ? (
            <LoadingSpinner mensaje="Cargando kardex..." />
          ) : (
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span>Movimientos de {insumo?.nombre}</span>
                {movimientos.length > 0 && (
                  <Button size="sm" variant="outline-secondary" onClick={anularUltimoMovimiento} disabled={anulando}>
                    {anulando ? 'Anulando...' : 'Anular último movimiento'}
                  </Button>
                )}
              </Card.Header>
              <Table hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th className="text-end">Cantidad</th>
                    <th className="text-end">Precio unitario</th>
                    <th className="text-end">Stock resultante</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="text-muted">{formatoCorto(m.fecha)}</td>
                      <td>
                        <Badge bg={m.tipo === 'entrada' ? 'success' : 'secondary'}>
                          {m.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                        </Badge>
                      </td>
                      <td className="text-end">
                        {m.cantidad} {insumo?.unidad_medida}
                      </td>
                      <td className="text-end">
                        {m.precio_unitario ? formatearMontoEnMoneda(m.precio_unitario, m.moneda) : '—'}
                      </td>
                      <td className="text-end fw-semibold">
                        {m.stock_resultante} {insumo?.unidad_medida}
                      </td>
                      <td className="text-muted">{m.descripcion || '—'}</td>
                    </tr>
                  ))}
                  {movimientos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        Todavía no hay movimientos. Registre la primera entrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card>
          )}
        </Tab>

        {/* ---------- Catálogo ---------- */}
        <Tab eventKey="catalogo" title="Catálogo de insumos">
          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
            <Form.Control
              style={{ maxWidth: 280 }}
              placeholder="Buscar insumo por nombre"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <Form.Check
              type="switch"
              id="ver-insumos-inactivos"
              label="Ver inactivos"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
            />
            <span className="text-muted small ms-auto">{insumosVisibles.length} en pantalla</span>
            <Button variant="success" onClick={abrirNuevoInsumo}>
              <span className="btn-icon-plus">+</span>Nuevo insumo
            </Button>
          </div>

          <Table hover responsive bordered className="bg-white align-middle">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Unidad</th>
                <th className="text-end">Stock actual</th>
                <th className="text-end">Stock mínimo</th>
                <th className="text-end">Precio referencia</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {insumosVisibles.map((i) => (
                <tr key={i.id}>
                  <td className="fw-semibold">{i.nombre}</td>
                  <td>{i.unidad_medida}</td>
                  <td className="text-end">
                    <span className={stockBajo(i) ? 'text-danger fw-semibold' : ''}>{i.stock_actual}</span>
                  </td>
                  <td className="text-end text-muted">{vacio(i.stock_minimo) ? '—' : i.stock_minimo}</td>
                  <td className="text-end">
                    {vacio(i.precio_unitario_referencia) ? (
                      <span className="text-muted">—</span>
                    ) : (
                      formatearMontoEnMoneda(i.precio_unitario_referencia, i.moneda_referencia || 'BS')
                    )}
                  </td>
                  <td>{i.proveedor || <span className="text-muted">—</span>}</td>
                  <td>
                    <Badge bg={i.activo ? 'success' : 'secondary'}>{i.activo ? 'Activo' : 'Inactivo'}</Badge>
                    {i.activo && stockBajo(i) && (
                      <Badge bg="danger" className="ms-1">
                        Stock bajo
                      </Badge>
                    )}
                  </td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirEditarInsumo(i)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={i.activo ? 'outline-danger' : 'outline-success'}
                      onClick={() => cambiarEstadoInsumo(i)}
                    >
                      {i.activo ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  </td>
                </tr>
              ))}
              {insumosVisibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">
                    {insumos.length === 0
                      ? 'Todavía no hay insumos. Registre el primero para empezar a llevar el stock.'
                      : 'Ningún insumo coincide con el filtro.'}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Tab>
      </Tabs>

      {/* ---------- Modal: catálogo ---------- */}
      <Modal show={mostrarModalInsumo} onHide={() => setMostrarModalInsumo(false)} centered>
        <Form onSubmit={guardarInsumo}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar insumo' : 'Nuevo insumo'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorFormInsumo && <Alert variant="danger">{errorFormInsumo}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                value={formInsumo.nombre}
                onChange={(e) => setFormInsumo({ ...formInsumo, nombre: e.target.value })}
                placeholder="Ej: Sal, Cuajo, Envases 500g"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Unidad de medida</Form.Label>
              <Form.Control
                value={formInsumo.unidad_medida}
                onChange={(e) => setFormInsumo({ ...formInsumo, unidad_medida: e.target.value })}
                placeholder="kg, L, unidades..."
                list="unidades-insumo-sugeridas"
                required
              />
              <datalist id="unidades-insumo-sugeridas">
                {UNIDADES_SUGERIDAS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Precio de referencia (opcional)</Form.Label>
              <InputGroup>
                <Form.Select
                  value={formInsumo.moneda_referencia}
                  onChange={(e) => setFormInsumo({ ...formInsumo, moneda_referencia: e.target.value })}
                  style={{ maxWidth: 190 }}
                >
                  {OPCIONES_MONEDA.map((op) => (
                    <option key={op.codigo} value={op.codigo}>
                      {op.etiqueta}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={formInsumo.precio_unitario_referencia}
                  onChange={(e) => setFormInsumo({ ...formInsumo, precio_unitario_referencia: e.target.value })}
                  placeholder="0.00"
                />
              </InputGroup>
              <Form.Text className="text-muted">
                Solo informativo. El precio real de cada compra se guarda en su propio movimiento del kardex.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Stock mínimo (alerta de reposición, opcional)</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={formInsumo.stock_minimo}
                  onChange={(e) => setFormInsumo({ ...formInsumo, stock_minimo: e.target.value })}
                  placeholder="0.00"
                />
                <InputGroup.Text>{formInsumo.unidad_medida || 'unid.'}</InputGroup.Text>
              </InputGroup>
            </Form.Group>

            <Form.Group>
              <Form.Label>Proveedor (opcional)</Form.Label>
              <Form.Control
                value={formInsumo.proveedor}
                onChange={(e) => setFormInsumo({ ...formInsumo, proveedor: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalInsumo(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoInsumo}>
              {guardandoInsumo ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- Modal: movimiento de kardex ---------- */}
      <Modal show={mostrarModalMovimiento} onHide={() => setMostrarModalMovimiento(false)} centered>
        <Form onSubmit={guardarMovimiento}>
          <Modal.Header closeButton>
            <Modal.Title>
              {formMovimiento.tipo === 'entrada' ? 'Registrar entrada' : 'Registrar salida'}
              {insumo ? ` — ${insumo.nombre}` : ''}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorFormMovimiento && <Alert variant="danger">{errorFormMovimiento}</Alert>}

            <Alert variant="light" className="border py-2 small mb-3">
              Stock actual: <strong>{insumo?.stock_actual} {insumo?.unidad_medida}</strong>
            </Alert>

            <Form.Group className="mb-3">
              <Form.Label>Cantidad</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={formMovimiento.cantidad}
                  onChange={(e) => setFormMovimiento({ ...formMovimiento, cantidad: e.target.value })}
                  autoFocus
                  required
                />
                <InputGroup.Text>{insumo?.unidad_medida}</InputGroup.Text>
              </InputGroup>
            </Form.Group>

            {formMovimiento.tipo === 'entrada' && (
              <Form.Group className="mb-3">
                <Form.Label>Precio unitario pagado</Form.Label>
                <InputGroup>
                  <Form.Select
                    value={formMovimiento.moneda}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, moneda: e.target.value })}
                    style={{ maxWidth: 190 }}
                  >
                    {OPCIONES_MONEDA.map((op) => (
                      <option key={op.codigo} value={op.codigo}>
                        {op.etiqueta}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.01"
                    value={formMovimiento.precio_unitario}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, precio_unitario: e.target.value })}
                    placeholder="0.00"
                  />
                </InputGroup>
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Fecha</Form.Label>
              <Form.Control
                type="date"
                value={formMovimiento.fecha}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, fecha: e.target.value })}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Descripción (opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formMovimiento.descripcion}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, descripcion: e.target.value })}
                placeholder={
                  formMovimiento.tipo === 'entrada' ? 'Ej: Compra a proveedor X' : 'Ej: Consumo en producción, merma...'
                }
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalMovimiento(false)}>
              Cancelar
            </Button>
            <Button
              variant={formMovimiento.tipo === 'entrada' ? 'success' : 'danger'}
              type="submit"
              disabled={guardandoMovimiento}
            >
              {guardandoMovimiento ? 'Guardando...' : 'Registrar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Insumos;