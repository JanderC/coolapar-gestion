import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card, ProgressBar } from 'react-bootstrap';
import * as nominaApi from '../../api/nomina.api';
import * as productoresApi from '../../api/productores.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { desempacar, formatoCorto, hoy, vacio } from '../../utils/fechas';
import { MONEDAS, METODOS_PAGO, detalleError, monto } from '../nomina/nominaComun';

const prestamoVacio = {
  beneficiario_tipo: 'productor',
  empleado_id: '',
  productor_id: '',
  beneficiario_nombre: '',
  fecha: hoy(),
  monto: '',
  moneda: 'BS',
  motivo: '',
  metodo_pago: '',
  referencia: '',
};

const abonoVacio = { fecha: hoy(), monto: '', metodo_pago: '', referencia: '' };

const Prestamos = () => {
  const [prestamos, setPrestamos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [productores, setProductores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('abierto');
  const [expandido, setExpandido] = useState(null);

  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [form, setForm] = useState(prestamoVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const [mostrarAbono, setMostrarAbono] = useState(false);
  const [prestamoAbono, setPrestamoAbono] = useState(null);
  const [formAbono, setFormAbono] = useState(abonoVacio);
  const [guardandoAbono, setGuardandoAbono] = useState(false);
  const [errorAbono, setErrorAbono] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [lista, emp] = await Promise.all([
        nominaApi.listarPrestamos().then(desempacar),
        nominaApi.listarEmpleados({ activo: 'true' }).then(desempacar),
      ]);
      setPrestamos(lista || []);
      setEmpleados(emp || []);
    } catch (err) {
      setError(`No se pudieron cargar los préstamos. ${detalleError(err)}`);
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarProductores = useCallback(async () => {
    try {
      // listarProductores recibe el valor suelto, no un objeto de params.
      // Se traen todos y se filtran aquí: así el selector no depende de
      // cómo esté armada la firma de esa función.
      const lista = desempacar(await productoresApi.listarProductores()) || [];
      setProductores(lista.filter((p) => p.activo));
    } catch {
      setProductores([]);
    }
  }, []);

  useEffect(() => {
    cargar();
    cargarProductores();
  }, [cargar, cargarProductores]);

  const visibles = useMemo(
    () => (filtroEstado ? prestamos.filter((p) => p.estado === filtroEstado) : prestamos),
    [prestamos, filtroEstado]
  );

  // Lo que se debe, separado por moneda. Nunca se suman entre sí.
  const porCobrar = useMemo(() => {
    const mapa = new Map();
    prestamos
      .filter((p) => p.estado === 'abierto')
      .forEach((p) => mapa.set(p.moneda, Number(((mapa.get(p.moneda) || 0) + p.saldo).toFixed(2))));
    return [...mapa.entries()].map(([moneda, total]) => ({ moneda, total }));
  }, [prestamos]);

  const abrirNuevo = () => {
    setForm({ ...prestamoVacio, fecha: hoy() });
    setErrorForm('');
    setMostrarNuevo(true);
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    setErrorForm('');

    if (form.beneficiario_tipo === 'empleado' && !form.empleado_id) {
      return setErrorForm('Elija el empleado.');
    }
    if (form.beneficiario_tipo === 'productor' && !form.productor_id) {
      return setErrorForm('Elija el productor.');
    }
    if (['rutero', 'otro'].includes(form.beneficiario_tipo) && !form.beneficiario_nombre.trim()) {
      return setErrorForm('Escriba a quién se le prestó.');
    }
    if (vacio(form.monto) || Number(form.monto) <= 0) return setErrorForm('Indique el monto del préstamo.');

    setGuardando(true);
    try {
      await nominaApi.crearPrestamo({
        beneficiario_tipo: form.beneficiario_tipo,
        empleado_id: form.beneficiario_tipo === 'empleado' ? Number(form.empleado_id) : null,
        productor_id: form.beneficiario_tipo === 'productor' ? Number(form.productor_id) : null,
        beneficiario_nombre: form.beneficiario_nombre.trim() || null,
        fecha: form.fecha,
        monto: Number(form.monto),
        moneda: form.moneda,
        motivo: vacio(form.motivo) ? null : form.motivo.trim(),
        metodo_pago: form.metodo_pago || null,
        referencia: vacio(form.referencia) ? null : form.referencia.trim(),
      });
      setMostrarNuevo(false);
      setAviso('Préstamo entregado. Se cobra por abonos, no se descuenta del sueldo.');
      await cargar();
    } catch (err) {
      setErrorForm(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardando(false);
    }
  };

  const abrirAbono = (p) => {
    setPrestamoAbono(p);
    setFormAbono({ ...abonoVacio, fecha: hoy() });
    setErrorAbono('');
    setMostrarAbono(true);
  };

  const guardarAbono = async (ev) => {
    ev.preventDefault();
    setErrorAbono('');
    const cantidad = Number(formAbono.monto);
    if (vacio(formAbono.monto) || cantidad <= 0) return setErrorAbono('Indique cuánto abonó.');
    if (cantidad > prestamoAbono.saldo + 0.004) {
      return setErrorAbono(`Solo quedan ${monto(prestamoAbono.saldo, prestamoAbono.moneda)} por cancelar.`);
    }

    setGuardandoAbono(true);
    try {
      const respuesta = await nominaApi.abonarPrestamo(prestamoAbono.id, {
        fecha: formAbono.fecha,
        monto: cantidad,
        metodo_pago: formAbono.metodo_pago || null,
        referencia: vacio(formAbono.referencia) ? null : formAbono.referencia.trim(),
      });
      setMostrarAbono(false);
      setAviso(respuesta?.message || 'Abono registrado.');
      await cargar();
    } catch (err) {
      setErrorAbono(`No se pudo registrar. ${detalleError(err)}`);
    } finally {
      setGuardandoAbono(false);
    }
  };

  const anular = async (p) => {
    const motivo = window.prompt(`¿Por qué se anula el préstamo de ${p.beneficiario_nombre}?`);
    if (motivo === null) return;
    try {
      await nominaApi.anularPrestamo(p.id, motivo);
      setAviso('Préstamo anulado.');
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando préstamos..." />;

  const esEmpleado = form.beneficiario_tipo === 'empleado';
  const esProductor = form.beneficiario_tipo === 'productor';

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
        Un préstamo <strong>no se descuenta del sueldo ni de la semana del productor</strong>: la persona lo va
        cancelando en abonos, y cada abono entra como ingreso. Si lo que quiere es plata a cuenta del próximo sueldo,
        eso es un adelanto y va en «Empleados».
      </Alert>

      <Card className="mb-4">
        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>Préstamos</strong>
            {porCobrar.length > 0 && (
              <div className="text-muted small">
                Por cobrar: {porCobrar.map((c) => monto(c.total, c.moneda)).join(' · ')}
              </div>
            )}
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <Form.Select
              size="sm"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{ maxWidth: 180 }}
            >
              <option value="abierto">Con saldo pendiente</option>
              <option value="pagado">Ya cancelados</option>
              <option value="anulado">Anulados</option>
              <option value="">Todos</option>
            </Form.Select>
            <Button variant="success" size="sm" onClick={abrirNuevo}>
              Nuevo préstamo
            </Button>
          </div>
        </Card.Header>

        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>A quién</th>
              <th className="text-end">Prestado</th>
              <th className="text-end">Abonado</th>
              <th className="text-end">Debe</th>
              <th style={{ minWidth: 130 }}>Avance</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => {
              const avance = p.monto > 0 ? Math.round((p.total_abonado / p.monto) * 100) : 0;
              const abierto = expandido === p.id;
              return (
                <React.Fragment key={p.id}>
                  <tr className={p.estado === 'anulado' ? 'text-muted' : undefined}>
                    <td>{formatoCorto(p.fecha)}</td>
                    <td>
                      <span className="fw-semibold">{p.beneficiario_nombre}</span>
                      <div className="text-muted small text-capitalize">
                        {p.beneficiario_tipo}
                        {p.motivo ? ` · ${p.motivo}` : ''}
                      </div>
                    </td>
                    <td className="text-end">{monto(p.monto, p.moneda)}</td>
                    <td className="text-end text-success">
                      {p.total_abonado > 0 ? monto(p.total_abonado, p.moneda) : '—'}
                    </td>
                    <td className="text-end fw-semibold">
                      {p.estado === 'anulado' ? '—' : monto(p.saldo, p.moneda)}
                    </td>
                    <td>
                      {p.estado === 'anulado' ? (
                        <Badge bg="secondary">Anulado</Badge>
                      ) : p.esta_pagado ? (
                        <Badge bg="success">Cancelado</Badge>
                      ) : (
                        <ProgressBar now={avance} label={`${avance}%`} variant="success" style={{ height: 18 }} />
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-flex gap-2 justify-content-end flex-wrap">
                        {p.estado === 'abierto' && (
                          <Button size="sm" variant="outline-success" onClick={() => abrirAbono(p)}>
                            Abonar
                          </Button>
                        )}
                        {p.abonos.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => setExpandido(abierto ? null : p.id)}
                          >
                            {abierto ? 'Ocultar' : `Abonos (${p.abonos.length})`}
                          </Button>
                        )}
                        {p.estado === 'abierto' && p.abonos.length === 0 && (
                          <Button size="sm" variant="outline-danger" onClick={() => anular(p)}>
                            Anular
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {abierto && (
                    <tr>
                      <td colSpan={7} className="bg-light">
                        <div className="small">
                          <strong>Abonos recibidos</strong>
                          <Table size="sm" className="mb-0 mt-2 bg-white">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th className="text-end">Monto</th>
                                <th>Cómo pagó</th>
                                <th>Referencia</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.abonos.map((a) => (
                                <tr key={a.id}>
                                  <td>{formatoCorto(a.fecha)}</td>
                                  <td className="text-end">{monto(a.monto, a.moneda)}</td>
                                  <td className="text-capitalize">{a.metodo_pago || '—'}</td>
                                  <td>{a.referencia || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-4">
                  No hay préstamos con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Modal nuevo préstamo ---------- */}
      <Modal show={mostrarNuevo} onHide={() => setMostrarNuevo(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>Nuevo préstamo</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorForm && <Alert variant="danger">{errorForm}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>¿A quién?</Form.Label>
              <Form.Select
                value={form.beneficiario_tipo}
                onChange={(e) =>
                  setForm({ ...form, beneficiario_tipo: e.target.value, empleado_id: '', productor_id: '' })
                }
              >
                <option value="productor">Un productor</option>
                <option value="empleado">Un empleado</option>
                <option value="rutero">Un rutero</option>
                <option value="otro">Otra persona</option>
              </Form.Select>
            </Form.Group>

            {esEmpleado && (
              <Form.Group className="mb-3">
                <Form.Label>Empleado</Form.Label>
                <Form.Select
                  value={form.empleado_id}
                  onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}
                >
                  <option value="">Elija el empleado</option>
                  {empleados.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                      {e.cargo ? ` — ${e.cargo}` : ''}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            {esProductor && (
              <Form.Group className="mb-3">
                <Form.Label>Productor</Form.Label>
                <Form.Select
                  value={form.productor_id}
                  onChange={(e) => setForm({ ...form, productor_id: e.target.value })}
                >
                  <option value="">Elija el productor</option>
                  {productores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            {['rutero', 'otro'].includes(form.beneficiario_tipo) && (
              <Form.Group className="mb-3">
                <Form.Label>Nombre</Form.Label>
                <Form.Control
                  value={form.beneficiario_nombre}
                  onChange={(e) => setForm({ ...form, beneficiario_nombre: e.target.value })}
                  placeholder="A quién se le prestó"
                />
              </Form.Group>
            )}

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
              <div className="col-sm-6">
                <Form.Label>Cómo se entregó</Form.Label>
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
              <div className="col-sm-6">
                <Form.Label>Referencia</Form.Label>
                <Form.Control
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                />
              </div>
              <div className="col-12">
                <Form.Label>Motivo (opcional)</Form.Label>
                <Form.Control
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  placeholder="Para qué lo pidió"
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarNuevo(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Entregar préstamo'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- Modal abono ---------- */}
      <Modal show={mostrarAbono} onHide={() => setMostrarAbono(false)} centered>
        <Form onSubmit={guardarAbono}>
          <Modal.Header closeButton>
            <Modal.Title>Abono de {prestamoAbono?.beneficiario_nombre}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorAbono && <Alert variant="danger">{errorAbono}</Alert>}

            {prestamoAbono && (
              <p className="text-muted small">
                Prestado: {monto(prestamoAbono.monto, prestamoAbono.moneda)} · Ya abonó{' '}
                {monto(prestamoAbono.total_abonado, prestamoAbono.moneda)} · Debe{' '}
                <strong>{monto(prestamoAbono.saldo, prestamoAbono.moneda)}</strong>.
              </p>
            )}

            <div className="row g-3">
              <div className="col-sm-5">
                <Form.Label>Fecha</Form.Label>
                <Form.Control
                  type="date"
                  value={formAbono.fecha}
                  onChange={(e) => setFormAbono({ ...formAbono, fecha: e.target.value })}
                />
              </div>
              <div className="col-sm-7">
                <Form.Label>Cuánto abonó</Form.Label>
                <InputGroup>
                  <InputGroup.Text>{prestamoAbono?.moneda}</InputGroup.Text>
                  <Form.Control
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    value={formAbono.monto}
                    onChange={(e) => setFormAbono({ ...formAbono, monto: e.target.value })}
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => setFormAbono({ ...formAbono, monto: String(prestamoAbono.saldo) })}
                  >
                    Todo
                  </Button>
                </InputGroup>
              </div>
              <div className="col-sm-6">
                <Form.Label>Cómo pagó</Form.Label>
                <Form.Select
                  value={formAbono.metodo_pago}
                  onChange={(e) => setFormAbono({ ...formAbono, metodo_pago: e.target.value })}
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.etiqueta}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-sm-6">
                <Form.Label>Referencia</Form.Label>
                <Form.Control
                  value={formAbono.referencia}
                  onChange={(e) => setFormAbono({ ...formAbono, referencia: e.target.value })}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarAbono(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoAbono}>
              {guardandoAbono ? 'Guardando...' : 'Registrar abono'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Prestamos;