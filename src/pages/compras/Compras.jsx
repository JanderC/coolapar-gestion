import React, { useCallback, useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card } from 'react-bootstrap';
import * as nominaApi from '../../api/nomina.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { desempacar, formatoCorto, hoy, vacio } from '../../utils/fechas';
import { MONEDAS, METODOS_PAGO, detalleError, monto, inicioDeMes } from './nominaComun';

const compraVacia = {
  fecha: hoy(),
  categoria: 'compra',
  concepto: '',
  monto: '',
  moneda: 'BS',
  contraparte: '',
  metodo_pago: '',
  referencia: '',
};

const CATEGORIAS = [
  { valor: 'compra', etiqueta: 'Compra general' },
  { valor: 'compra_insumo', etiqueta: 'Compra de insumos' },
  { valor: 'servicio', etiqueta: 'Servicio o gasto' },
];

const Compras = () => {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [desde, setDesde] = useState(() => inicioDeMes(hoy()));
  const [hasta, setHasta] = useState(() => hoy());

  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [form, setForm] = useState(compraVacia);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const cargar = useCallback(
    async (rangoDesde = desde, rangoHasta = hasta) => {
      setError('');
      try {
        setDatos(
          desempacar(await nominaApi.listarCompras({ fecha_inicio: rangoDesde, fecha_fin: rangoHasta })) || null
        );
      } catch (err) {
        setError(`No se pudieron cargar las compras. ${detalleError(err)}`);
      } finally {
        setCargando(false);
      }
    },
    [desde, hasta]
  );

  useEffect(() => {
    cargar();
    // Solo en la primera carga: después se refresca con el botón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardar = async (ev) => {
    ev.preventDefault();
    setErrorForm('');
    if (!form.concepto.trim()) return setErrorForm('Escriba qué se compró.');
    if (vacio(form.monto) || Number(form.monto) <= 0) return setErrorForm('Indique cuánto se pagó.');

    setGuardando(true);
    try {
      await nominaApi.crearCompra({
        fecha: form.fecha,
        categoria: form.categoria,
        concepto: form.concepto.trim(),
        monto: Number(form.monto),
        moneda: form.moneda,
        contraparte: vacio(form.contraparte) ? null : form.contraparte.trim(),
        metodo_pago: form.metodo_pago || null,
        referencia: vacio(form.referencia) ? null : form.referencia.trim(),
      });
      setMostrarNueva(false);
      setForm({ ...compraVacia, fecha: hoy() });
      setAviso('Compra registrada.');
      await cargar();
    } catch (err) {
      setErrorForm(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardando(false);
    }
  };

  const anular = async (c) => {
    const motivo = window.prompt('¿Por qué se anula esta compra?');
    if (motivo === null) return;
    try {
      await nominaApi.anularMovimientoCaja(c.id, motivo);
      setAviso('Compra anulada.');
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando compras..." />;

  const compras = datos?.compras || [];

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

      <Alert variant="light" className="border">
        Las compras de insumos <strong>no se cargan aquí</strong>: se leen del inventario, donde ya quedaron
        registradas con su precio al hacer la entrada. Aparecen marcadas como «Del inventario» y se corrigen allá.
      </Alert>

      <Card>
        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>Compras y gastos</strong>
            {datos?.totales_por_moneda?.length > 0 && (
              <div className="text-muted small">
                Total del período: {datos.totales_por_moneda.map((t) => monto(t.total, t.moneda)).join(' · ')}
              </div>
            )}
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
            <Button size="sm" variant="outline-success" onClick={() => cargar()}>
              Ver
            </Button>
            <Button size="sm" variant="success" onClick={() => setMostrarNueva(true)}>
              Registrar compra
            </Button>
          </div>
        </Card.Header>

        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Qué se compró</th>
              <th>A quién</th>
              <th>Tipo</th>
              <th className="text-end">Monto</th>
              <th>Cómo se pagó</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id} className={c.anulado ? 'text-muted' : undefined}>
                <td>{formatoCorto(c.fecha)}</td>
                <td className={c.anulado ? '' : 'fw-semibold'}>
                  {c.concepto}
                  {c.anulado && (
                    <Badge bg="secondary" className="ms-2">
                      Anulada
                    </Badge>
                  )}
                </td>
                <td className="text-muted">{c.contraparte || '—'}</td>
                <td>
                  {c.derivado ? (
                    <Badge bg="info">Del inventario</Badge>
                  ) : (
                    <Badge bg="light" text="dark">
                      {c.etiqueta_categoria}
                    </Badge>
                  )}
                </td>
                <td className="text-end fw-semibold">{monto(c.monto, c.moneda)}</td>
                <td className="text-muted text-capitalize">{c.metodo_pago || '—'}</td>
                <td className="text-end">
                  {!c.derivado && !c.anulado && (
                    <Button size="sm" variant="outline-danger" onClick={() => anular(c)}>
                      Anular
                    </Button>
                  )}
                  {c.derivado && <span className="text-muted small">Se corrige en Inventario</span>}
                </td>
              </tr>
            ))}
            {compras.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">
                  No hay compras registradas entre esas fechas.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Modal nueva compra ---------- */}
      <Modal show={mostrarNueva} onHide={() => setMostrarNueva(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>Registrar compra</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorForm && <Alert variant="danger">{errorForm}</Alert>}

            <Alert variant="light" className="border py-2 small">
              Si lo que compró es un insumo que lleva existencia (sal, cuajo, empaques), cárguelo como entrada en
              «Inventario»: así baja el stock y la compra aparece aquí sola.
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
                <Form.Label>Tipo</Form.Label>
                <Form.Select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.etiqueta}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Label>Qué se compró</Form.Label>
                <Form.Control
                  autoFocus
                  value={form.concepto}
                  onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                  placeholder="Repuesto del camión, electricidad, alquiler..."
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
                <Form.Label>Cómo se pagó</Form.Label>
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
                <Form.Label>Proveedor (opcional)</Form.Label>
                <Form.Control
                  value={form.contraparte}
                  onChange={(e) => setForm({ ...form, contraparte: e.target.value })}
                />
              </div>
              <div className="col-sm-5">
                <Form.Label>Factura o referencia</Form.Label>
                <Form.Control
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarNueva(false)}>
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

export default Compras;
