import React, { useCallback, useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card } from 'react-bootstrap';
import * as nominaApi from '../../api/nomina.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { desempacar, formatoCorto, hoy, vacio } from '../../utils/fechas';
import { MONEDAS, METODOS_PAGO, detalleError, monto, inicioDeMes } from './nominaComun';

const movimientoVacio = {
  fecha: hoy(),
  tipo: 'ingreso',
  categoria: 'venta',
  concepto: '',
  monto: '',
  moneda: 'BS',
  contraparte: '',
  metodo_pago: '',
  referencia: '',
};

const CATEGORIAS_INGRESO = [
  { valor: 'venta', etiqueta: 'Venta' },
  { valor: 'otro_ingreso', etiqueta: 'Otro ingreso' },
];

const CATEGORIAS_EGRESO = [
  { valor: 'compra', etiqueta: 'Compra' },
  { valor: 'servicio', etiqueta: 'Servicio o gasto' },
  { valor: 'otro_egreso', etiqueta: 'Otro egreso' },
];

// Las que no se cargan a mano: salen de otros módulos.
const FILTROS = [
  { valor: '', etiqueta: 'Todo' },
  { valor: 'venta', etiqueta: 'Ventas' },
  { valor: 'nomina', etiqueta: 'Nómina' },
  { valor: 'adelanto', etiqueta: 'Adelantos' },
  { valor: 'prestamo', etiqueta: 'Préstamos entregados' },
  { valor: 'abono_prestamo', etiqueta: 'Abonos recibidos' },
  { valor: 'compra_inventario', etiqueta: 'Compras de inventario' },
  { valor: 'pago_productor', etiqueta: 'Pagos a productores' },
  { valor: 'pago_rutero', etiqueta: 'Pagos a ruteros' },
];

const LibroCaja = () => {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [desde, setDesde] = useState(() => inicioDeMes(hoy()));
  const [hasta, setHasta] = useState(() => hoy());
  const [categoria, setCategoria] = useState('');

  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [form, setForm] = useState(movimientoVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setDatos(
        desempacar(
          await nominaApi.verLibro({
            fecha_inicio: desde,
            fecha_fin: hasta,
            categoria: categoria || undefined,
          })
        ) || null
      );
    } catch (err) {
      setError(`No se pudo cargar el libro. ${detalleError(err)}`);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, categoria]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async (ev) => {
    ev.preventDefault();
    setErrorForm('');
    if (!form.concepto.trim()) return setErrorForm('Escriba de qué se trata.');
    if (vacio(form.monto) || Number(form.monto) <= 0) return setErrorForm('Indique el monto.');

    setGuardando(true);
    try {
      await nominaApi.crearMovimientoCaja({
        fecha: form.fecha,
        tipo: form.tipo,
        categoria: form.categoria,
        concepto: form.concepto.trim(),
        monto: Number(form.monto),
        moneda: form.moneda,
        contraparte: vacio(form.contraparte) ? null : form.contraparte.trim(),
        metodo_pago: form.metodo_pago || null,
        referencia: vacio(form.referencia) ? null : form.referencia.trim(),
      });
      setMostrarNuevo(false);
      setForm({ ...movimientoVacio, fecha: hoy() });
      setAviso('Movimiento registrado.');
      await cargar();
    } catch (err) {
      setErrorForm(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardando(false);
    }
  };

  const anular = async (m) => {
    const motivo = window.prompt('¿Por qué se anula este movimiento?');
    if (motivo === null) return;
    try {
      await nominaApi.anularMovimientoCaja(m.id, motivo);
      setAviso('Movimiento anulado.');
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando libro de caja..." />;

  const movimientos = datos?.movimientos || [];
  const esIngreso = form.tipo === 'ingreso';

  return (
    <div>
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

      {/* ---------- Totales ---------- */}
      <div className="d-flex flex-wrap gap-3 mb-3">
        {(datos?.totales_por_moneda || []).map((t) => (
          <Card key={t.moneda} className="flex-grow-1" style={{ minWidth: 240 }}>
            <Card.Body className="py-3">
              <div className="text-muted small text-uppercase">Movimiento en {t.moneda}</div>
              <div className="d-flex justify-content-between mt-2 small">
                <span className="text-success">Entró</span>
                <strong className="text-success">{monto(t.ingresos, t.moneda)}</strong>
              </div>
              <div className="d-flex justify-content-between small">
                <span className="text-danger">Salió</span>
                <strong className="text-danger">{monto(t.egresos, t.moneda)}</strong>
              </div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between">
                <strong>Queda</strong>
                <strong className={t.saldo < 0 ? 'text-danger' : ''}>{monto(t.saldo, t.moneda)}</strong>
              </div>
            </Card.Body>
          </Card>
        ))}
        {(datos?.totales_por_moneda || []).length === 0 && (
          <Alert variant="secondary" className="w-100 mb-0">
            No hay movimientos entre esas fechas.
          </Alert>
        )}
      </div>

      <Card>
        <Card.Header className="d-flex flex-wrap justify-content-between align-items-end gap-2">
          <div>
            <strong>Libro de caja</strong>
            <div className="text-muted small">
              Todo junto: ventas, nómina, adelantos, préstamos, compras y los pagos a productores y ruteros.
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-end gap-2">
            <div>
              <Form.Label className="small text-muted mb-1">Desde</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div>
              <Form.Label className="small text-muted mb-1">Hasta</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
            <Form.Select
              size="sm"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              {FILTROS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.etiqueta}
                </option>
              ))}
            </Form.Select>
            <Button size="sm" variant="success" onClick={() => setMostrarNuevo(true)}>
              Registrar movimiento
            </Button>
          </div>
        </Card.Header>

        <Table hover responsive className="mb-0 align-middle small">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Concepto</th>
              <th>Con quién</th>
              <th>Categoría</th>
              <th className="text-end">Monto</th>
              <th>Cómo</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => {
              const entra = m.tipo === 'ingreso';
              return (
                <tr key={m.id} className={m.anulado ? 'text-muted' : undefined}>
                  <td>{formatoCorto(m.fecha)}</td>
                  <td className={m.anulado ? '' : 'fw-semibold'}>
                    {m.concepto}
                    {m.anulado && (
                      <Badge bg="secondary" className="ms-2">
                        Anulado
                      </Badge>
                    )}
                  </td>
                  <td className="text-muted">{m.contraparte || '—'}</td>
                  <td>
                    <Badge bg={m.derivado ? 'info' : entra ? 'success' : 'light'} text={m.derivado || entra ? undefined : 'dark'}>
                      {m.etiqueta_categoria}
                    </Badge>
                  </td>
                  <td className={`text-end fw-semibold ${entra ? 'text-success' : 'text-danger'}`}>
                    {entra ? '+' : '−'} {monto(m.monto, m.moneda)}
                  </td>
                  <td className="text-muted text-capitalize">{m.metodo_pago || '—'}</td>
                  <td className="text-end">
                    {m.derivado ? (
                      <span className="text-muted">Viene de otro módulo</span>
                    ) : (
                      !m.anulado && (
                        <Button size="sm" variant="outline-danger" onClick={() => anular(m)}>
                          Anular
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">
                  Sin movimientos con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        {(datos?.totales_por_categoria || []).length > 0 && (
          <Card.Footer>
            <div className="small text-muted mb-2">Resumen por categoría</div>
            <div className="d-flex flex-wrap gap-3">
              {datos.totales_por_categoria.map((c) => (
                <div key={`${c.categoria}-${c.moneda}`} className="small">
                  <span className="text-muted">{c.etiqueta}: </span>
                  <strong className={c.tipo === 'ingreso' ? 'text-success' : 'text-danger'}>
                    {monto(c.total, c.moneda)}
                  </strong>
                </div>
              ))}
            </div>
          </Card.Footer>
        )}
      </Card>

      {/* ---------- Modal movimiento ---------- */}
      <Modal show={mostrarNuevo} onHide={() => setMostrarNuevo(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>Registrar movimiento</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorForm && <Alert variant="danger">{errorForm}</Alert>}

            <Alert variant="light" className="border py-2 small">
              Los pagos de nómina, los adelantos, los préstamos y las compras de insumos entran solos desde su
              sector. Aquí van las ventas y los movimientos sueltos.
            </Alert>

            <div className="row g-3">
              <div className="col-sm-5">
                <Form.Label>Fecha</Form.Label>
                <Form.Control
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </div>
              <div className="col-sm-7">
                <Form.Label>¿Entra o sale?</Form.Label>
                <Form.Select
                  value={form.tipo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tipo: e.target.value,
                      categoria: e.target.value === 'ingreso' ? 'venta' : 'compra',
                    })
                  }
                >
                  <option value="ingreso">Entra plata</option>
                  <option value="egreso">Sale plata</option>
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Label>Categoría</Form.Label>
                <Form.Select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                >
                  {(esIngreso ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO).map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.etiqueta}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Label>De qué se trata</Form.Label>
                <Form.Control
                  autoFocus
                  value={form.concepto}
                  onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                  placeholder={esIngreso ? 'Venta de 40 kg de semiduro' : 'Pago de electricidad'}
                />
              </div>
              <div className="col-sm-7">
                <Form.Label>Monto</Form.Label>
                <InputGroup>
                  <Form.Select
                    value={form.moneda}
                    onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                    style={{ maxWidth: 110 }}
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
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  />
                </InputGroup>
              </div>
              <div className="col-sm-5">
                <Form.Label>Cómo</Form.Label>
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
                <Form.Label>{esIngreso ? 'Cliente' : 'A quién'} (opcional)</Form.Label>
                <Form.Control
                  value={form.contraparte}
                  onChange={(e) => setForm({ ...form, contraparte: e.target.value })}
                />
              </div>
              <div className="col-sm-5">
                <Form.Label>Referencia</Form.Label>
                <Form.Control
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarNuevo(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Registrar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default LibroCaja;
