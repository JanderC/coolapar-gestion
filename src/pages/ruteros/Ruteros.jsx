import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card, Tabs, Tab } from 'react-bootstrap';
import * as ruterosApi from '../../api/ruteros.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';
import { OPCIONES_DIA, aNumero, desempacar, etiquetaDias, formatoCorto, largoCiclo, vacio } from '../../utils/fechas';

const OPCIONES_MONEDA = [
  { codigo: 'COP', etiqueta: 'COL$ — Pesos colombianos' },
  { codigo: 'BS', etiqueta: 'Bs. — Bolívares' },
  { codigo: 'USD', etiqueta: '$ — Dólares' },
];

const formVacio = { nombre: '', telefono: '', precio_litro: '', moneda: 'COP' };

const Ruteros = () => {
  const { formatearMontoEnMoneda } = useMoneda();

  const [pestana, setPestana] = useState('hoja');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [ruteros, setRuteros] = useState([]);
  const [ruteroId, setRuteroId] = useState('');

  // La semana se define por días de la semana, no por fechas.
  const [diaInicio, setDiaInicio] = useState(1); // lunes
  const [diaFin, setDiaFin] = useState(0); // domingo
  const [semanaId, setSemanaId] = useState(null); // solo al reabrir del historial

  const [hoja, setHoja] = useState(null);
  const [dias, setDias] = useState([]);
  const [precioLitro, setPrecioLitro] = useState('');
  const [moneda, setMoneda] = useState('COP');
  const [historial, setHistorial] = useState([]);
  const [cargandoHoja, setCargandoHoja] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [errorForm, setErrorForm] = useState('');
  const [guardandoRutero, setGuardandoRutero] = useState(false);
  const [verInactivos, setVerInactivos] = useState(false);

  const rutero = useMemo(
    () => ruteros.find((r) => String(r.id) === String(ruteroId)) || null,
    [ruteros, ruteroId]
  );
  const cerrada = hoja?.semana?.estado === 'cerrada';

  const cargarRuteros = async () => {
    setCargando(true);
    setError('');
    try {
      setRuteros(desempacar(await ruterosApi.listarRuteros()) || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los ruteros.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarRuteros();
  }, []);

  const cargarHoja = useCallback(async () => {
    if (!ruteroId) {
      setHoja(null);
      setDias([]);
      return;
    }
    setCargandoHoja(true);
    setError('');
    try {
      const params = semanaId
        ? { rutero_id: ruteroId, semana_id: semanaId }
        : { rutero_id: ruteroId, dia_inicio: diaInicio, dia_fin: diaFin };

      const datos = desempacar(await ruterosApi.obtenerHojaRutero(params));
      setHoja(datos);
      setDias(
        datos.dias.map((d) => ({
          ...d,
          litros: d.litros === null ? '' : String(d.litros),
          sobrante: d.sobrante ? String(d.sobrante) : '',
          faltante: d.faltante ? String(d.faltante) : '',
          descripcion: d.descripcion || '',
        }))
      );
      setPrecioLitro(datos.precio_litro ? String(datos.precio_litro) : '');
      setMoneda(datos.moneda || 'COP');
      if (semanaId) {
        setDiaInicio(datos.semana.dia_inicio);
        setDiaFin(datos.semana.dia_fin);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo abrir la semana.');
    } finally {
      setCargandoHoja(false);
    }
  }, [ruteroId, diaInicio, diaFin, semanaId]);

  useEffect(() => {
    cargarHoja();
  }, [cargarHoja]);

  const cargarHistorial = useCallback(async () => {
    if (!ruteroId) return setHistorial([]);
    try {
      setHistorial(desempacar(await ruterosApi.historialRutero(ruteroId)) || []);
    } catch {
      setHistorial([]);
    }
  }, [ruteroId]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const totales = useMemo(() => {
    const litros = dias.reduce((s, d) => s + aNumero(d.litros, 0), 0);
    const precio = aNumero(precioLitro, 0);
    return {
      litros: Math.round(litros * 100) / 100,
      sobrante: Math.round(dias.reduce((s, d) => s + aNumero(d.sobrante, 0), 0) * 100) / 100,
      faltante: Math.round(dias.reduce((s, d) => s + aNumero(d.faltante, 0), 0) * 100) / 100,
      pagar: Math.round(litros * precio * 100) / 100,
    };
  }, [dias, precioLitro]);

  const cambiarDia = (fecha, campo, valor) => {
    setDias((prev) => prev.map((d) => (d.fecha === fecha ? { ...d, [campo]: valor } : d)));
  };

  const cambiarDiaSemana = (cual, valor) => {
    setSemanaId(null);
    if (cual === 'inicio') setDiaInicio(Number(valor));
    else setDiaFin(Number(valor));
  };

  const elegirRutero = (id) => {
    setSemanaId(null);
    setRuteroId(id);
    const r = ruteros.find((x) => String(x.id) === String(id));
    if (r) {
      if (aNumero(r.precio_litro, 0) > 0) setPrecioLitro(String(r.precio_litro));
      if (r.moneda) setMoneda(r.moneda);
    }
  };

  const cuerpoHoja = () => ({
    rutero_id: Number(ruteroId),
    semana_id: hoja.semana.id,
    precio_litro: aNumero(precioLitro, 0),
    moneda,
    dias: dias.map((d) => ({
      fecha: d.fecha,
      litros: vacio(d.litros) ? null : aNumero(d.litros, 0),
      sobrante: aNumero(d.sobrante, 0),
      faltante: aNumero(d.faltante, 0),
      descripcion: d.descripcion || null,
    })),
  });

  const guardarHoja = async () => {
    if (!hoja) return;
    if (aNumero(precioLitro, 0) <= 0) return setError('Indique cuánto se le paga al rutero por litro.');

    setGuardando(true);
    setError('');
    try {
      const datos = desempacar(await ruterosApi.guardarHojaRutero(cuerpoHoja()));
      setHoja(datos);
      setAviso(`Semana guardada: ${datos.totales.total_litros} litros.`);
      await cargarHistorial();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar la semana.');
    } finally {
      setGuardando(false);
    }
  };

  const registrarPago = async () => {
    if (!hoja || totales.litros <= 0) return setError('Cargue los litros antes de registrar el pago.');
    const resumen = `${totales.litros} litros × ${formatearMontoEnMoneda(aNumero(precioLitro, 0), moneda)} = ${formatearMontoEnMoneda(totales.pagar, moneda)}`;
    if (!window.confirm(`¿Registrar el pago de ${rutero?.nombre}?\n${resumen}`)) return;

    setGuardando(true);
    setError('');
    try {
      await ruterosApi.guardarHojaRutero(cuerpoHoja());
      await ruterosApi.registrarPagoRutero({
        rutero_id: Number(ruteroId),
        semana_id: hoja.semana.id,
        marcar_pagado: true,
      });
      setAviso('Pago registrado.');
      await cargarHoja();
      await cargarHistorial();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar el pago.');
    } finally {
      setGuardando(false);
    }
  };

  // ---------- CRUD de ruteros ----------
  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(formVacio);
    setErrorForm('');
    setMostrarModal(true);
  };

  const abrirEditar = (r) => {
    setEditandoId(r.id);
    setForm({
      nombre: r.nombre || '',
      telefono: r.telefono || '',
      precio_litro: r.precio_litro ?? '',
      moneda: r.moneda || 'COP',
    });
    setErrorForm('');
    setMostrarModal(true);
  };

  const guardarRutero = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: form.nombre.trim(),
      telefono: vacio(form.telefono) ? null : form.telefono.trim(),
      precio_litro: vacio(form.precio_litro) ? 0 : aNumero(form.precio_litro, 0),
      moneda: form.moneda,
    };
    if (!payload.nombre) return setErrorForm('Escriba el nombre del rutero.');

    setGuardandoRutero(true);
    setErrorForm('');
    try {
      if (editandoId) {
        await ruterosApi.actualizarRutero(editandoId, payload);
      } else {
        await ruterosApi.crearRutero(payload);
      }
      setMostrarModal(false);
      setAviso(editandoId ? 'Rutero actualizado.' : 'Rutero registrado.');
      await cargarRuteros();
    } catch (err) {
      setErrorForm(err.response?.data?.message || 'No se pudo guardar el rutero.');
    } finally {
      setGuardandoRutero(false);
    }
  };

  const cambiarEstado = async (r) => {
    const desactivando = r.activo;
    if (!window.confirm(desactivando ? `¿Desactivar a ${r.nombre}?` : `¿Reactivar a ${r.nombre}?`)) return;
    setError('');
    try {
      if (desactivando) {
        await ruterosApi.eliminarRutero(r.id);
      } else {
        await ruterosApi.actualizarRutero(r.id, { activo: true });
      }
      await cargarRuteros();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cambiar el estado del rutero.');
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando ruteros..." />;

  const ruterosVisibles = ruteros.filter((r) => verInactivos || r.activo);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-3 gap-3 flex-wrap">
        <div>
          <h4 className="mb-1">Ruteros</h4>
          <p className="text-muted mb-0">
            Cada rutero acumula los litros que trae durante su semana. El total se multiplica por el precio por litro
            que se le cancela.
          </p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          + Nuevo rutero
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

      <Tabs activeKey={pestana} onSelect={(k) => setPestana(k || 'hoja')} className="mb-3">
        <Tab eventKey="hoja" title="Hoja semanal">
          <Card className="mb-3">
            <Card.Body className="d-flex flex-wrap gap-3 align-items-end">
              <div style={{ minWidth: 220 }}>
                <Form.Label className="small text-muted mb-1">Rutero</Form.Label>
                <Form.Select value={ruteroId} onChange={(e) => elegirRutero(e.target.value)}>
                  <option value="">Seleccione un rutero</option>
                  {ruteros
                    .filter((r) => r.activo)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                </Form.Select>
              </div>

              <div style={{ minWidth: 150 }}>
                <Form.Label className="small text-muted mb-1">Inicia</Form.Label>
                <Form.Select value={diaInicio} onChange={(e) => cambiarDiaSemana('inicio', e.target.value)}>
                  {OPCIONES_DIA.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.nombre}
                    </option>
                  ))}
                </Form.Select>
              </div>

              <div style={{ minWidth: 150 }}>
                <Form.Label className="small text-muted mb-1">Termina</Form.Label>
                <Form.Select value={diaFin} onChange={(e) => cambiarDiaSemana('fin', e.target.value)}>
                  {OPCIONES_DIA.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.nombre}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">{largoCiclo(diaInicio, diaFin)} día(s)</Form.Text>
              </div>

              <div style={{ minWidth: 300 }}>
                <Form.Label className="small text-muted mb-1">Se le paga por litro</Form.Label>
                <InputGroup>
                  <Form.Select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={{ maxWidth: 180 }}>
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
                    value={precioLitro}
                    onChange={(e) => setPrecioLitro(e.target.value)}
                    placeholder="0.00"
                  />
                </InputGroup>
              </div>
            </Card.Body>
          </Card>

          {!ruteroId ? (
            <Alert variant="light" className="border text-muted">
              Seleccione un rutero para cargar su libreta.
            </Alert>
          ) : cargandoHoja ? (
            <LoadingSpinner mensaje="Abriendo la semana..." />
          ) : hoja ? (
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <strong>{rutero?.nombre}</strong>{' '}
                  <span className="text-muted small">{etiquetaDias(diaInicio, diaFin)}</span>
                </div>
                {hoja.pago && (
                  <Badge bg={hoja.pago.estado_pago === 'pagado' ? 'success' : 'warning'}>
                    {hoja.pago.estado_pago === 'pagado'
                      ? `Pagado el ${formatoCorto(hoja.pago.fecha_pago)}`
                      : 'Pago pendiente'}
                  </Badge>
                )}
              </Card.Header>

              <Table hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Día</th>
                    <th style={{ width: 100 }}>Fecha</th>
                    <th style={{ width: 130 }}>Litros</th>
                    <th style={{ width: 120 }}>Sobrante</th>
                    <th style={{ width: 120 }}>Faltante</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d) => (
                    <tr key={d.fecha}>
                      <td className="fw-semibold">{d.dia}</td>
                      <td className="text-muted">{formatoCorto(d.fecha)}</td>
                      <td>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.01"
                          size="sm"
                          value={d.litros}
                          disabled={cerrada}
                          placeholder="—"
                          onChange={(e) => cambiarDia(d.fecha, 'litros', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.01"
                          size="sm"
                          value={d.sobrante}
                          disabled={cerrada}
                          placeholder="0"
                          onChange={(e) => cambiarDia(d.fecha, 'sobrante', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.01"
                          size="sm"
                          value={d.faltante}
                          disabled={cerrada}
                          placeholder="0"
                          onChange={(e) => cambiarDia(d.fecha, 'faltante', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          value={d.descripcion}
                          disabled={cerrada}
                          placeholder="Nota del día"
                          onChange={(e) => cambiarDia(d.fecha, 'descripcion', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <th colSpan={2}>Totales</th>
                    <th>{totales.litros} litros</th>
                    <th>{totales.sobrante}</th>
                    <th>{totales.faltante}</th>
                    <th className="fs-5">
                      {formatearMontoEnMoneda(totales.pagar, moneda)}
                      <div className="text-muted fw-normal small">
                        {totales.litros} × {formatearMontoEnMoneda(aNumero(precioLitro, 0), moneda)}
                      </div>
                    </th>
                  </tr>
                </tfoot>
              </Table>

              <Card.Footer className="d-flex justify-content-end gap-2 flex-wrap">
                <Button variant="outline-success" onClick={guardarHoja} disabled={guardando || cerrada}>
                  {guardando ? 'Guardando...' : 'Guardar semana'}
                </Button>
                <Button variant="success" onClick={registrarPago} disabled={guardando || totales.litros <= 0}>
                  Registrar pago
                </Button>
              </Card.Footer>
            </Card>
          ) : null}

          {historial.length > 0 && (
            <Card className="mt-4">
              <Card.Header>Semanas anteriores de {rutero?.nombre}</Card.Header>
              <Table hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Días</th>
                    <th>Litros</th>
                    <th>Total</th>
                    <th>Pago</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((s) => (
                    <tr key={s.id} className={String(s.id) === String(hoja?.semana?.id) ? 'table-active' : ''}>
                      <td className="fw-semibold">{s.etiqueta}</td>
                      <td>{s.total_litros}</td>
                      <td>{formatearMontoEnMoneda(s.total_pagar, s.moneda)}</td>
                      <td>
                        {s.estado_pago === 'pagado' ? (
                          <Badge bg="success">Pagado</Badge>
                        ) : s.estado_pago ? (
                          <Badge bg="warning">Pendiente</Badge>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td className="text-end">
                        <Button size="sm" variant="outline-secondary" onClick={() => setSemanaId(s.id)}>
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </Tab>

        <Tab eventKey="lista" title="Ruteros registrados">
          <div className="d-flex align-items-center mb-2">
            <Form.Check
              type="switch"
              id="ver-ruteros-inactivos"
              label="Ver inactivos"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
            />
          </div>

          <Table hover responsive bordered className="bg-white align-middle">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Se le paga por litro</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ruterosVisibles.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.nombre}</td>
                  <td>{r.telefono || '—'}</td>
                  <td>{formatearMontoEnMoneda(r.precio_litro || 0, r.moneda)}</td>
                  <td>
                    <Badge bg={r.activo ? 'success' : 'secondary'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirEditar(r)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={r.activo ? 'outline-danger' : 'outline-success'}
                      onClick={() => cambiarEstado(r)}
                    >
                      {r.activo ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  </td>
                </tr>
              ))}
              {ruterosVisibles.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Todavía no hay ruteros. Registre el primero para llevar su libreta semanal.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Tab>
      </Tabs>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardarRutero}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar rutero' : 'Nuevo rutero'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorForm && <Alert variant="danger">{errorForm}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Teléfono</Form.Label>
              <Form.Control
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Precio por litro que se le cancela</Form.Label>
              <InputGroup>
                <Form.Select
                  value={form.moneda}
                  onChange={(e) => setForm({ ...form, moneda: e.target.value })}
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
                  value={form.precio_litro}
                  onChange={(e) => setForm({ ...form, precio_litro: e.target.value })}
                  placeholder="0.00"
                />
              </InputGroup>
              <Form.Text className="text-muted">
                Es el valor por defecto. En cada semana se puede cambiar sin tocar la ficha.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModal(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoRutero}>
              {guardandoRutero ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Ruteros;