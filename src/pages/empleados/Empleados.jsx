import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card } from 'react-bootstrap';
import * as nominaApi from '../../api/nomina.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { desempacar, formatoCorto, hoy, vacio } from '../../utils/fechas';
import { MONEDAS, METODOS_PAGO, FRECUENCIAS, detalleError, monto, montosPorMoneda, periodoSugerido } from '../nomina/nominaComun';

const empleadoVacio = {
  nombre: '',
  cedula: '',
  cargo: '',
  sueldo: '',
  moneda: 'BS',
  frecuencia_pago: 'semanal',
  telefono: '',
  fecha_ingreso: '',
  notas: '',
};

const adelantoVacio = { fecha: hoy(), monto: '', moneda: 'BS', concepto: '', metodo_pago: '', referencia: '' };

const Empleados = () => {
  const [empleados, setEmpleados] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [verArchivados, setVerArchivados] = useState(false);

  // ---- Modal empleado ----
  const [mostrarEmpleado, setMostrarEmpleado] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formEmpleado, setFormEmpleado] = useState(empleadoVacio);
  const [guardandoEmpleado, setGuardandoEmpleado] = useState(false);
  const [errorEmpleado, setErrorEmpleado] = useState('');

  // ---- Modal adelanto ----
  const [mostrarAdelanto, setMostrarAdelanto] = useState(false);
  const [empleadoAdelanto, setEmpleadoAdelanto] = useState(null);
  const [formAdelanto, setFormAdelanto] = useState(adelantoVacio);
  const [guardandoAdelanto, setGuardandoAdelanto] = useState(false);
  const [errorAdelanto, setErrorAdelanto] = useState('');

  // ---- Modal recibo ----
  const [mostrarRecibo, setMostrarRecibo] = useState(false);
  const [empleadoRecibo, setEmpleadoRecibo] = useState(null);
  const [previsualizacion, setPrevisualizacion] = useState(null);
  const [cargandoPrevia, setCargandoPrevia] = useState(false);
  const [formRecibo, setFormRecibo] = useState(null);
  const [adelantosElegidos, setAdelantosElegidos] = useState([]);
  const [guardandoRecibo, setGuardandoRecibo] = useState(false);
  const [errorRecibo, setErrorRecibo] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [emp, rec] = await Promise.all([
        nominaApi.listarEmpleados().then(desempacar),
        nominaApi.listarRecibos().then(desempacar),
      ]);
      setEmpleados(emp || []);
      setRecibos(rec || []);
    } catch (err) {
      setError(`No se pudo cargar la nómina. ${detalleError(err)}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return empleados.filter((e) => {
      if (!verArchivados && !e.activo) return false;
      if (texto && !e.nombre.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [empleados, busqueda, verArchivados]);

  // ---------- Empleado ----------
  const abrirNuevoEmpleado = () => {
    setEditandoId(null);
    setFormEmpleado(empleadoVacio);
    setErrorEmpleado('');
    setMostrarEmpleado(true);
  };

  const abrirEditarEmpleado = (e) => {
    setEditandoId(e.id);
    setFormEmpleado({
      nombre: e.nombre || '',
      cedula: e.cedula || '',
      cargo: e.cargo || '',
      sueldo: e.sueldo ?? '',
      moneda: e.moneda || 'BS',
      frecuencia_pago: e.frecuencia_pago || 'semanal',
      telefono: e.telefono || '',
      fecha_ingreso: e.fecha_ingreso || '',
      notas: e.notas || '',
    });
    setErrorEmpleado('');
    setMostrarEmpleado(true);
  };

  const guardarEmpleado = async (ev) => {
    ev.preventDefault();
    setErrorEmpleado('');
    if (!formEmpleado.nombre.trim()) return setErrorEmpleado('Escriba el nombre del empleado.');

    const payload = {
      ...formEmpleado,
      nombre: formEmpleado.nombre.trim(),
      sueldo: vacio(formEmpleado.sueldo) ? null : Number(formEmpleado.sueldo),
      fecha_ingreso: vacio(formEmpleado.fecha_ingreso) ? null : formEmpleado.fecha_ingreso,
    };

    setGuardandoEmpleado(true);
    try {
      if (editandoId) await nominaApi.actualizarEmpleado(editandoId, payload);
      else await nominaApi.crearEmpleado(payload);
      setMostrarEmpleado(false);
      setAviso(editandoId ? 'Empleado actualizado.' : 'Empleado agregado.');
      await cargar();
    } catch (err) {
      setErrorEmpleado(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardandoEmpleado(false);
    }
  };

  const archivar = async (e) => {
    if (!window.confirm(`¿Archivar a ${e.nombre}? Su historial se conserva.`)) return;
    setError('');
    try {
      await nominaApi.archivarEmpleado(e.id);
      setAviso('Empleado archivado.');
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    }
  };

  // ---------- Adelanto ----------
  const abrirAdelanto = (e) => {
    setEmpleadoAdelanto(e);
    setFormAdelanto({ ...adelantoVacio, fecha: hoy(), moneda: e.moneda || 'BS' });
    setErrorAdelanto('');
    setMostrarAdelanto(true);
  };

  const guardarAdelanto = async (ev) => {
    ev.preventDefault();
    setErrorAdelanto('');
    if (vacio(formAdelanto.monto) || Number(formAdelanto.monto) <= 0) {
      return setErrorAdelanto('Indique el monto del adelanto.');
    }

    setGuardandoAdelanto(true);
    try {
      await nominaApi.crearAdelanto({
        empleado_id: empleadoAdelanto.id,
        fecha: formAdelanto.fecha,
        monto: Number(formAdelanto.monto),
        moneda: formAdelanto.moneda,
        concepto: vacio(formAdelanto.concepto) ? null : formAdelanto.concepto.trim(),
        metodo_pago: formAdelanto.metodo_pago || null,
        referencia: vacio(formAdelanto.referencia) ? null : formAdelanto.referencia.trim(),
      });
      setMostrarAdelanto(false);
      setAviso('Adelanto registrado. Se descontará en el próximo recibo.');
      await cargar();
    } catch (err) {
      setErrorAdelanto(`No se pudo registrar. ${detalleError(err)}`);
    } finally {
      setGuardandoAdelanto(false);
    }
  };

  // ---------- Recibo ----------
  const abrirRecibo = async (e) => {
    setEmpleadoRecibo(e);
    setMostrarRecibo(true);
    setErrorRecibo('');
    setPrevisualizacion(null);
    setCargandoPrevia(true);

    const periodo = periodoSugerido(e.frecuencia_pago, hoy());
    try {
      const previa = desempacar(await nominaApi.previsualizarRecibo(e.id, { periodo_fin: periodo.fin }));
      setPrevisualizacion(previa);
      // Por defecto se descuentan todos los adelantos de la misma moneda.
      setAdelantosElegidos(
        (previa.adelantos || []).filter((a) => a.moneda === (e.moneda || 'BS')).map((a) => a.id)
      );
      setFormRecibo({
        fecha: hoy(),
        periodo_inicio: periodo.inicio,
        periodo_fin: periodo.fin,
        sueldo_base: previa.empleado.sueldo ?? '',
        otras_asignaciones: '',
        otras_deducciones: '',
        moneda: e.moneda || 'BS',
        metodo_pago: '',
        referencia: '',
        notas: '',
        estado: 'pagado',
      });
    } catch (err) {
      setErrorRecibo(`No se pudo preparar el recibo. ${detalleError(err)}`);
    } finally {
      setCargandoPrevia(false);
    }
  };

  const adelantosDescontables = useMemo(() => {
    if (!previsualizacion || !formRecibo) return [];
    // Solo los de la MISMA moneda del recibo: restar dólares de un sueldo
    // en bolívares necesitaría una tasa, y esa decisión no le toca al sistema.
    return (previsualizacion.adelantos || []).filter((a) => a.moneda === formRecibo.moneda);
  }, [previsualizacion, formRecibo]);

  const totales = useMemo(() => {
    if (!formRecibo) return null;
    const base = Number(formRecibo.sueldo_base || 0);
    const asignaciones = Number(formRecibo.otras_asignaciones || 0);
    const deducciones = Number(formRecibo.otras_deducciones || 0);
    const adelantos = adelantosDescontables
      .filter((a) => adelantosElegidos.includes(a.id))
      .reduce((s, a) => s + a.monto, 0);
    return {
      base,
      asignaciones,
      adelantos: Number(adelantos.toFixed(2)),
      deducciones,
      neto: Number((base + asignaciones - adelantos - deducciones).toFixed(2)),
    };
  }, [formRecibo, adelantosDescontables, adelantosElegidos]);

  const guardarRecibo = async (ev) => {
    ev.preventDefault();
    setErrorRecibo('');
    if (!formRecibo.periodo_inicio || !formRecibo.periodo_fin) {
      return setErrorRecibo('Indique el período que se está pagando.');
    }
    if (totales.neto < 0) {
      return setErrorRecibo('El neto queda en negativo. Descuente menos adelantos en este recibo.');
    }

    setGuardandoRecibo(true);
    try {
      const respuesta = await nominaApi.crearRecibo({
        empleado_id: empleadoRecibo.id,
        fecha: formRecibo.fecha,
        periodo_inicio: formRecibo.periodo_inicio,
        periodo_fin: formRecibo.periodo_fin,
        sueldo_base: Number(formRecibo.sueldo_base || 0),
        otras_asignaciones: Number(formRecibo.otras_asignaciones || 0),
        otras_deducciones: Number(formRecibo.otras_deducciones || 0),
        moneda: formRecibo.moneda,
        metodo_pago: formRecibo.metodo_pago || null,
        referencia: vacio(formRecibo.referencia) ? null : formRecibo.referencia.trim(),
        notas: vacio(formRecibo.notas) ? null : formRecibo.notas.trim(),
        estado: formRecibo.estado,
        adelantos_ids: adelantosElegidos,
      });
      setMostrarRecibo(false);
      setAviso(respuesta?.message || 'Recibo guardado.');
      await cargar();
    } catch (err) {
      setErrorRecibo(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardandoRecibo(false);
    }
  };

  const pagarRecibo = async (r) => {
    if (!window.confirm(`¿Marcar como pagado el recibo de ${r.Empleado?.nombre}?`)) return;
    try {
      await nominaApi.pagarRecibo(r.id, { fecha: hoy() });
      setAviso('Recibo pagado y anotado en caja.');
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    }
  };

  const anularRecibo = async (r) => {
    const motivo = window.prompt('¿Por qué se anula este recibo?');
    if (motivo === null) return;
    try {
      await nominaApi.anularRecibo(r.id, motivo);
      setAviso('Recibo anulado. Los adelantos vuelven a quedar pendientes.');
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando empleados..." />;

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

      <Card className="mb-4">
        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>Empleados</strong>
            <div className="text-muted small">
              Gente que cobra por trabajar. Un adelanto se descuenta del próximo sueldo; un préstamo no.
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <Form.Control
              type="search"
              size="sm"
              placeholder="Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: 200 }}
            />
            <Form.Check
              type="switch"
              id="ver-archivados-empleados"
              label="Archivados"
              checked={verArchivados}
              onChange={(e) => setVerArchivados(e.target.checked)}
            />
            <Button variant="success" size="sm" onClick={abrirNuevoEmpleado}>
              Nuevo empleado
            </Button>
          </div>
        </Card.Header>

        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Cargo</th>
              <th className="text-end">Sueldo</th>
              <th>Cobra</th>
              <th>Adelantos por descontar</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((e) => {
              const pendientes = montosPorMoneda(e.adelantos_pendientes);
              return (
                <tr key={e.id}>
                  <td>
                    <span className="fw-semibold">{e.nombre}</span>
                    {!e.activo && (
                      <Badge bg="secondary" className="ms-2">
                        Archivado
                      </Badge>
                    )}
                    {e.cedula && <div className="text-muted small">{e.cedula}</div>}
                  </td>
                  <td className="text-muted">{e.cargo || '—'}</td>
                  <td className="text-end">{e.sueldo === null ? '—' : monto(e.sueldo, e.moneda)}</td>
                  <td className="text-muted text-capitalize">{e.frecuencia_pago}</td>
                  <td>
                    {pendientes ? (
                      <Badge bg="warning" text="dark">
                        {pendientes}
                      </Badge>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-end">
                    <div className="d-flex gap-2 justify-content-end flex-wrap">
                      {e.activo && (
                        <>
                          <Button size="sm" variant="outline-success" onClick={() => abrirRecibo(e)}>
                            Hacer recibo
                          </Button>
                          <Button size="sm" variant="outline-warning" onClick={() => abrirAdelanto(e)}>
                            Adelanto
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline-secondary" onClick={() => abrirEditarEmpleado(e)}>
                        Editar
                      </Button>
                      {e.activo && (
                        <Button size="sm" variant="outline-danger" onClick={() => archivar(e)}>
                          Archivar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  {busqueda ? `Nadie coincide con «${busqueda}».` : 'Todavía no hay empleados cargados.'}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Recibos ---------- */}
      <Card>
        <Card.Header>
          <strong>Recibos de pago</strong>
          <div className="text-muted small">
            Un borrador todavía no movió plata. Al marcarlo pagado, se anota en el libro de caja.
          </div>
        </Card.Header>
        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Empleado</th>
              <th>Período</th>
              <th className="text-end">Sueldo</th>
              <th className="text-end">Adelantos</th>
              <th className="text-end">Neto</th>
              <th>Estado</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {recibos.map((r) => (
              <tr key={r.id} className={r.anulado ? 'text-muted' : undefined}>
                <td>{formatoCorto(r.fecha)}</td>
                <td className={r.anulado ? '' : 'fw-semibold'}>{r.Empleado?.nombre || `#${r.empleado_id}`}</td>
                <td className="text-muted small">
                  {formatoCorto(r.periodo_inicio)} — {formatoCorto(r.periodo_fin)}
                </td>
                <td className="text-end">{monto(r.sueldo_base, r.moneda)}</td>
                <td className="text-end text-warning-emphasis">
                  {Number(r.total_adelantos) > 0 ? `− ${monto(r.total_adelantos, r.moneda)}` : '—'}
                </td>
                <td className="text-end fw-semibold">{monto(r.neto, r.moneda)}</td>
                <td>
                  {r.anulado ? (
                    <Badge bg="secondary">Anulado</Badge>
                  ) : r.estado === 'pagado' ? (
                    <Badge bg="success">Pagado</Badge>
                  ) : (
                    <Badge bg="light" text="dark">
                      Borrador
                    </Badge>
                  )}
                </td>
                <td className="text-end">
                  {!r.anulado && (
                    <div className="d-flex gap-2 justify-content-end">
                      {r.estado === 'borrador' && (
                        <Button size="sm" variant="outline-success" onClick={() => pagarRecibo(r)}>
                          Pagar
                        </Button>
                      )}
                      <Button size="sm" variant="outline-danger" onClick={() => anularRecibo(r)}>
                        Anular
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {recibos.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted py-4">
                  Todavía no se ha hecho ningún recibo.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Modal empleado ---------- */}
      <Modal show={mostrarEmpleado} onHide={() => setMostrarEmpleado(false)} centered>
        <Form onSubmit={guardarEmpleado}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar empleado' : 'Nuevo empleado'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorEmpleado && <Alert variant="danger">{errorEmpleado}</Alert>}

            <div className="row g-3">
              <div className="col-sm-7">
                <Form.Label>Nombre</Form.Label>
                <Form.Control
                  autoFocus
                  value={formEmpleado.nombre}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, nombre: e.target.value })}
                />
              </div>
              <div className="col-sm-5">
                <Form.Label>Cédula</Form.Label>
                <Form.Control
                  value={formEmpleado.cedula}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, cedula: e.target.value })}
                />
              </div>
              <div className="col-sm-7">
                <Form.Label>Cargo</Form.Label>
                <Form.Control
                  value={formEmpleado.cargo}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, cargo: e.target.value })}
                  placeholder="Quesero, chofer, administración..."
                />
              </div>
              <div className="col-sm-5">
                <Form.Label>Cobra cada</Form.Label>
                <Form.Select
                  value={formEmpleado.frecuencia_pago}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, frecuencia_pago: e.target.value })}
                >
                  {FRECUENCIAS.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.etiqueta}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Label>Sueldo del período</Form.Label>
                <InputGroup>
                  <Form.Select
                    value={formEmpleado.moneda}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, moneda: e.target.value })}
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
                    value={formEmpleado.sueldo}
                    onChange={(e) => setFormEmpleado({ ...formEmpleado, sueldo: e.target.value })}
                    placeholder="0.00"
                  />
                </InputGroup>
                <Form.Text className="text-muted">
                  Lo que cobra por período completo: si cobra semanal, lo de una semana.
                </Form.Text>
              </div>
              <div className="col-sm-6">
                <Form.Label>Teléfono</Form.Label>
                <Form.Control
                  value={formEmpleado.telefono}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, telefono: e.target.value })}
                />
              </div>
              <div className="col-sm-6">
                <Form.Label>Entró el</Form.Label>
                <Form.Control
                  type="date"
                  value={formEmpleado.fecha_ingreso}
                  onChange={(e) => setFormEmpleado({ ...formEmpleado, fecha_ingreso: e.target.value })}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarEmpleado(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoEmpleado}>
              {guardandoEmpleado ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- Modal adelanto ---------- */}
      <Modal show={mostrarAdelanto} onHide={() => setMostrarAdelanto(false)} centered>
        <Form onSubmit={guardarAdelanto}>
          <Modal.Header closeButton>
            <Modal.Title>Adelanto a {empleadoAdelanto?.nombre}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorAdelanto && <Alert variant="danger">{errorAdelanto}</Alert>}

            <Alert variant="warning" className="py-2 small">
              Un adelanto es plata a cuenta del sueldo: <strong>se descuenta sola</strong> en el próximo recibo. Si
              es plata que la persona va a ir cancelando aparte, use «Préstamos».
            </Alert>

            <div className="row g-3">
              <div className="col-sm-5">
                <Form.Label>Fecha</Form.Label>
                <Form.Control
                  type="date"
                  value={formAdelanto.fecha}
                  onChange={(e) => setFormAdelanto({ ...formAdelanto, fecha: e.target.value })}
                />
              </div>
              <div className="col-sm-7">
                <Form.Label>Monto</Form.Label>
                <InputGroup>
                  <Form.Select
                    value={formAdelanto.moneda}
                    onChange={(e) => setFormAdelanto({ ...formAdelanto, moneda: e.target.value })}
                    style={{ maxWidth: 110 }}
                  >
                    {MONEDAS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    value={formAdelanto.monto}
                    onChange={(e) => setFormAdelanto({ ...formAdelanto, monto: e.target.value })}
                  />
                </InputGroup>
                {empleadoAdelanto && formAdelanto.moneda !== empleadoAdelanto.moneda && (
                  <Form.Text className="text-danger">
                    {empleadoAdelanto.nombre} cobra en {empleadoAdelanto.moneda}. Un adelanto en otra moneda no se
                    descuenta solo: haría falta una tasa.
                  </Form.Text>
                )}
              </div>
              <div className="col-sm-6">
                <Form.Label>Cómo se entregó</Form.Label>
                <Form.Select
                  value={formAdelanto.metodo_pago}
                  onChange={(e) => setFormAdelanto({ ...formAdelanto, metodo_pago: e.target.value })}
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
                  value={formAdelanto.referencia}
                  onChange={(e) => setFormAdelanto({ ...formAdelanto, referencia: e.target.value })}
                />
              </div>
              <div className="col-12">
                <Form.Label>Concepto (opcional)</Form.Label>
                <Form.Control
                  value={formAdelanto.concepto}
                  onChange={(e) => setFormAdelanto({ ...formAdelanto, concepto: e.target.value })}
                  placeholder="Para qué lo pidió"
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarAdelanto(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoAdelanto}>
              {guardandoAdelanto ? 'Guardando...' : 'Registrar adelanto'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- Modal recibo ---------- */}
      <Modal show={mostrarRecibo} onHide={() => setMostrarRecibo(false)} centered size="lg">
        <Form onSubmit={guardarRecibo}>
          <Modal.Header closeButton>
            <Modal.Title>Recibo de {empleadoRecibo?.nombre}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorRecibo && <Alert variant="danger">{errorRecibo}</Alert>}

            {cargandoPrevia && <LoadingSpinner mensaje="Calculando..." />}

            {!cargandoPrevia && formRecibo && (
              <>
                <div className="row g-3 mb-3">
                  <div className="col-sm-4">
                    <Form.Label>Fecha del pago</Form.Label>
                    <Form.Control
                      type="date"
                      value={formRecibo.fecha}
                      onChange={(e) => setFormRecibo({ ...formRecibo, fecha: e.target.value })}
                    />
                  </div>
                  <div className="col-sm-4">
                    <Form.Label>Período desde</Form.Label>
                    <Form.Control
                      type="date"
                      value={formRecibo.periodo_inicio}
                      onChange={(e) => setFormRecibo({ ...formRecibo, periodo_inicio: e.target.value })}
                    />
                  </div>
                  <div className="col-sm-4">
                    <Form.Label>Hasta</Form.Label>
                    <Form.Control
                      type="date"
                      value={formRecibo.periodo_fin}
                      onChange={(e) => setFormRecibo({ ...formRecibo, periodo_fin: e.target.value })}
                    />
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-sm-6">
                    <Form.Label>Sueldo del período</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>{formRecibo.moneda}</InputGroup.Text>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        value={formRecibo.sueldo_base}
                        onChange={(e) => setFormRecibo({ ...formRecibo, sueldo_base: e.target.value })}
                      />
                    </InputGroup>
                  </div>
                  <div className="col-sm-3">
                    <Form.Label>Otras asignaciones</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      step="0.01"
                      value={formRecibo.otras_asignaciones}
                      onChange={(e) => setFormRecibo({ ...formRecibo, otras_asignaciones: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-sm-3">
                    <Form.Label>Otras deducciones</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      step="0.01"
                      value={formRecibo.otras_deducciones}
                      onChange={(e) => setFormRecibo({ ...formRecibo, otras_deducciones: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Adelantos: se descuentan */}
                <div className="border rounded p-3 mb-3">
                  <strong className="small">Adelantos a descontar</strong>
                  {adelantosDescontables.length === 0 ? (
                    <p className="text-muted small mb-0 mt-1">No tiene adelantos pendientes.</p>
                  ) : (
                    <div className="mt-2 d-flex flex-column gap-1">
                      {adelantosDescontables.map((a) => (
                        <Form.Check
                          key={a.id}
                          type="checkbox"
                          id={`adelanto-${a.id}`}
                          checked={adelantosElegidos.includes(a.id)}
                          onChange={() =>
                            setAdelantosElegidos((prev) =>
                              prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                            )
                          }
                          label={
                            <span className="small">
                              {formatoCorto(a.fecha)} — <strong>{monto(a.monto, a.moneda)}</strong>
                              {a.concepto ? ` · ${a.concepto}` : ''}
                            </span>
                          }
                        />
                      ))}
                    </div>
                  )}
                  {previsualizacion?.adelantos_en_otra_moneda?.length > 0 && (
                    <div className="text-muted small mt-2">
                      Hay adelantos en otra moneda que no se pueden descontar de este recibo sin una tasa de cambio.
                    </div>
                  )}
                </div>

                {/* Préstamos: NO se descuentan */}
                {previsualizacion?.prestamos_abiertos?.length > 0 && (
                  <Alert variant="light" className="border py-2 small">
                    <strong>Tiene préstamos abiertos:</strong>{' '}
                    {previsualizacion.prestamos_abiertos.map((p) => monto(p.saldo, p.moneda)).join(' · ')}. No se
                    descuentan de este recibo — se cobran por abonos en la pestaña «Préstamos».
                  </Alert>
                )}

                <div className="bg-light rounded p-3 mb-3">
                  <div className="d-flex justify-content-between small">
                    <span>Sueldo del período</span>
                    <span>{monto(totales.base, formRecibo.moneda)}</span>
                  </div>
                  {totales.asignaciones > 0 && (
                    <div className="d-flex justify-content-between small text-success">
                      <span>Otras asignaciones</span>
                      <span>+ {monto(totales.asignaciones, formRecibo.moneda)}</span>
                    </div>
                  )}
                  {totales.adelantos > 0 && (
                    <div className="d-flex justify-content-between small text-danger">
                      <span>Adelantos ya entregados</span>
                      <span>− {monto(totales.adelantos, formRecibo.moneda)}</span>
                    </div>
                  )}
                  {totales.deducciones > 0 && (
                    <div className="d-flex justify-content-between small text-danger">
                      <span>Otras deducciones</span>
                      <span>− {monto(totales.deducciones, formRecibo.moneda)}</span>
                    </div>
                  )}
                  <hr className="my-2" />
                  <div className="d-flex justify-content-between fs-5">
                    <strong>Neto a entregar</strong>
                    <strong className={totales.neto < 0 ? 'text-danger' : ''}>
                      {monto(totales.neto, formRecibo.moneda)}
                    </strong>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-sm-4">
                    <Form.Label>Estado</Form.Label>
                    <Form.Select
                      value={formRecibo.estado}
                      onChange={(e) => setFormRecibo({ ...formRecibo, estado: e.target.value })}
                    >
                      <option value="pagado">Pagado — ya se le entregó</option>
                      <option value="borrador">Borrador — todavía no</option>
                    </Form.Select>
                  </div>
                  <div className="col-sm-4">
                    <Form.Label>Cómo se pagó</Form.Label>
                    <Form.Select
                      value={formRecibo.metodo_pago}
                      onChange={(e) => setFormRecibo({ ...formRecibo, metodo_pago: e.target.value })}
                    >
                      {METODOS_PAGO.map((m) => (
                        <option key={m.valor} value={m.valor}>
                          {m.etiqueta}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-sm-4">
                    <Form.Label>Referencia</Form.Label>
                    <Form.Control
                      value={formRecibo.referencia}
                      onChange={(e) => setFormRecibo({ ...formRecibo, referencia: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarRecibo(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoRecibo || cargandoPrevia || !formRecibo}>
              {guardandoRecibo ? 'Guardando...' : 'Guardar recibo'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Empleados;
