import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card, Tabs, Tab } from 'react-bootstrap';
import * as ruterosApi from '../../api/ruteros.api';
import * as registroApi from '../../api/registroLeche.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';
import { aNumero, desempacar, etiquetaSemana, formatoCorto, vacio } from '../../utils/fechas';

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
  const [semanas, setSemanas] = useState([]);
  const [ruteroId, setRuteroId] = useState('');
  const [semanaId, setSemanaId] = useState('');

  const [dias, setDias] = useState([]);
  const [precioLitro, setPrecioLitro] = useState('');
  const [moneda, setMoneda] = useState('COP');
  const [pago, setPago] = useState(null);
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
  const semana = useMemo(
    () => semanas.find((s) => String(s.id) === String(semanaId)) || null,
    [semanas, semanaId]
  );
  const semanaCerrada = semana?.estado === 'cerrada';

  const cargarBase = async () => {
    setCargando(true);
    setError('');
    try {
      const [resRuteros, resSemanas] = await Promise.all([
        ruterosApi.listarRuteros(),
        registroApi.listarSemanas(),
      ]);
      const listaRuteros = desempacar(resRuteros) || [];
      const listaSemanas = desempacar(resSemanas) || [];
      setRuteros(listaRuteros);
      setSemanas(listaSemanas);
      if (listaSemanas.length && !semanaId) setSemanaId(String(listaSemanas[0].id));
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los ruteros.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarHoja = useCallback(async () => {
    if (!ruteroId || !semanaId) {
      setDias([]);
      setPago(null);
      return;
    }
    setCargandoHoja(true);
    setError('');
    try {
      const hoja = desempacar(await ruterosApi.obtenerHojaRutero(ruteroId, semanaId));
      setDias(
        hoja.dias.map((d) => ({
          ...d,
          litros: d.litros === null ? '' : String(d.litros),
          sobrante: d.sobrante ? String(d.sobrante) : '',
          faltante: d.faltante ? String(d.faltante) : '',
          descripcion: d.descripcion || '',
        }))
      );
      setPrecioLitro(hoja.precio_litro ? String(hoja.precio_litro) : '');
      setMoneda(hoja.moneda || 'COP');
      setPago(hoja.pago || null);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo abrir la hoja de la semana.');
    } finally {
      setCargandoHoja(false);
    }
  }, [ruteroId, semanaId]);

  useEffect(() => {
    cargarHoja();
  }, [cargarHoja]);

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

  const elegirRutero = (id) => {
    setRuteroId(id);
    const r = ruteros.find((x) => String(x.id) === String(id));
    if (r) {
      if (!vacio(r.precio_litro) && aNumero(r.precio_litro, 0) > 0) setPrecioLitro(String(r.precio_litro));
      if (r.moneda) setMoneda(r.moneda);
    }
  };

  const cuerpoHoja = () => ({
    rutero_id: Number(ruteroId),
    semana_id: Number(semanaId),
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
    if (!ruteroId || !semanaId) return setError('Seleccione el rutero y la semana.');
    if (aNumero(precioLitro, 0) <= 0) return setError('Indique cuánto se le paga al rutero por litro.');

    setGuardando(true);
    setError('');
    try {
      const hoja = desempacar(await ruterosApi.guardarHojaRutero(cuerpoHoja()));
      setPago(hoja.pago || null);
      setAviso(`Semana guardada: ${hoja.totales.total_litros} litros.`);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar la semana.');
    } finally {
      setGuardando(false);
    }
  };

  const registrarPago = async () => {
    if (totales.litros <= 0) return setError('Cargue los litros antes de registrar el pago.');
    const texto = `${totales.litros} litros × ${formatearMontoEnMoneda(aNumero(precioLitro, 0), moneda)} = ${formatearMontoEnMoneda(totales.pagar, moneda)}`;
    if (!window.confirm(`¿Registrar el pago de ${rutero?.nombre}?\n${texto}`)) return;

    setGuardando(true);
    setError('');
    try {
      await ruterosApi.guardarHojaRutero(cuerpoHoja());
      const respuesta = await ruterosApi.registrarPagoRutero({
        rutero_id: Number(ruteroId),
        semana_id: Number(semanaId),
        marcar_pagado: true,
      });
      setPago(desempacar(respuesta));
      setAviso('Pago registrado.');
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
      await cargarBase();
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
      await cargarBase();
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
            Cada rutero acumula los litros que trae durante la semana. El total se multiplica por el precio por litro
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
        {/* ---------------- Hoja semanal ---------------- */}
        <Tab eventKey="hoja" title="Hoja semanal">
          <Card className="mb-3">
            <Card.Body className="d-flex flex-wrap gap-3 align-items-end">
              <div style={{ minWidth: 240 }}>
                <Form.Label className="small text-muted mb-1">Semana</Form.Label>
                <Form.Select value={semanaId} onChange={(e) => setSemanaId(e.target.value)}>
                  <option value="">Seleccione una semana</option>
                  {semanas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {etiquetaSemana(s)} {s.estado === 'cerrada' ? '(cerrada)' : ''}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">Las semanas se abren en Registro diario de leche.</Form.Text>
              </div>

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

          {!ruteroId || !semanaId ? (
            <Alert variant="light" className="border text-muted">
              Elija una semana y un rutero para cargar la libreta.
            </Alert>
          ) : cargandoHoja ? (
            <LoadingSpinner mensaje="Abriendo la hoja de la semana..." />
          ) : (
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <strong>{rutero?.nombre}</strong>{' '}
                  <span className="text-muted small">{etiquetaSemana(semana)}</span>
                </div>
                {pago && (
                  <Badge bg={pago.estado_pago === 'pagado' ? 'success' : 'warning'}>
                    {pago.estado_pago === 'pagado'
                      ? `Pagado el ${formatoCorto(pago.fecha_pago)}`
                      : 'Pago pendiente'}
                  </Badge>
                )}
              </Card.Header>

              <Table hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Día</th>
                    <th style={{ width: 120 }}>Fecha</th>
                    <th style={{ width: 140 }}>Litros</th>
                    <th style={{ width: 120 }}>Sobrante</th>
                    <th style={{ width: 120 }}>Faltante</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d) => (
                    <tr key={d.fecha}>
                      <td className="fw-semibold text-uppercase small">{d.dia}</td>
                      <td>{formatoCorto(d.fecha)}</td>
                      <td>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.01"
                          size="sm"
                          value={d.litros}
                          disabled={semanaCerrada}
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
                          disabled={semanaCerrada}
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
                          disabled={semanaCerrada}
                          placeholder="0"
                          onChange={(e) => cambiarDia(d.fecha, 'faltante', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          value={d.descripcion}
                          disabled={semanaCerrada}
                          placeholder="Nota del día"
                          onChange={(e) => cambiarDia(d.fecha, 'descripcion', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <th colSpan={2}>Totales de la semana</th>
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
                <Button variant="outline-success" onClick={guardarHoja} disabled={guardando || semanaCerrada}>
                  {guardando ? 'Guardando...' : 'Guardar semana'}
                </Button>
                <Button variant="success" onClick={registrarPago} disabled={guardando || totales.litros <= 0}>
                  Registrar pago
                </Button>
              </Card.Footer>
            </Card>
          )}
        </Tab>

        {/* ---------------- Lista de ruteros ---------------- */}
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