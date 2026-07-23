import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card } from 'react-bootstrap';
import * as registroApi from '../../api/registroLeche.api';
import * as productoresApi from '../../api/productores.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';
import { aNumero, desempacar, etiquetaSemana, formatoCorto, hoy, lunesDe, sumarDias, vacio } from '../../utils/fechas';

const OPCIONES_MONEDA = [
  { codigo: 'BS', etiqueta: 'Bs. — Bolívares' },
  { codigo: 'USD', etiqueta: '$ — Dólares' },
  { codigo: 'COP', etiqueta: 'COL$ — Pesos colombianos' },
];

const Punto = ({ color }) => (
  <span
    style={{
      backgroundColor: color || 'transparent',
      border: color ? '1px solid rgba(0,0,0,.15)' : '1px dashed #bbb',
      width: 12,
      height: 12,
      borderRadius: '50%',
      display: 'inline-block',
      flexShrink: 0,
    }}
  />
);

const RegistroLeche = () => {
  const { formatearMontoEnMoneda } = useMoneda();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [semanas, setSemanas] = useState([]);
  const [semanaId, setSemanaId] = useState('');
  const [productores, setProductores] = useState([]);
  const [productorId, setProductorId] = useState('');

  const [dias, setDias] = useState([]);
  const [precioLitro, setPrecioLitro] = useState('');
  const [moneda, setMoneda] = useState('BS');
  const [pago, setPago] = useState(null);
  const [cargandoHoja, setCargandoHoja] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [resumen, setResumen] = useState(null);

  const [modalSemana, setModalSemana] = useState(false);
  const [formSemana, setFormSemana] = useState({ fecha_inicio: lunesDe(), fecha_fin: sumarDias(lunesDe(), 6) });
  const [guardandoSemana, setGuardandoSemana] = useState(false);
  const [errorSemana, setErrorSemana] = useState('');

  const semana = useMemo(
    () => semanas.find((s) => String(s.id) === String(semanaId)) || null,
    [semanas, semanaId]
  );
  const productor = useMemo(
    () => productores.find((p) => String(p.id) === String(productorId)) || null,
    [productores, productorId]
  );

  // ---------- carga inicial ----------
  const cargarBase = async () => {
    setCargando(true);
    setError('');
    try {
      const [resSemanas, resProductores] = await Promise.all([
        registroApi.listarSemanas(),
        productoresApi.listarProductores(),
      ]);
      const listaSemanas = desempacar(resSemanas) || [];
      const listaProductores = (desempacar(resProductores) || []).filter((p) => p.activo !== false);
      setSemanas(listaSemanas);
      setProductores(listaProductores);
      if (listaSemanas.length && !semanaId) setSemanaId(String(listaSemanas[0].id));
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar las semanas y los productores.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- hoja del productor ----------
  const cargarHoja = useCallback(async () => {
    if (!productorId || !semanaId) {
      setDias([]);
      setPago(null);
      return;
    }
    setCargandoHoja(true);
    setError('');
    try {
      const hoja = desempacar(await registroApi.obtenerHoja(productorId, semanaId));
      setDias(hoja.dias.map((d) => ({ ...d, litros: d.litros === null ? '' : String(d.litros) })));
      setPrecioLitro(hoja.precio_litro ? String(hoja.precio_litro) : '');
      setMoneda(hoja.moneda || 'BS');
      setPago(hoja.pago || null);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo abrir la hoja de la semana.');
    } finally {
      setCargandoHoja(false);
    }
  }, [productorId, semanaId]);

  useEffect(() => {
    cargarHoja();
  }, [cargarHoja]);

  const cargarResumen = useCallback(async () => {
    if (!semanaId) return setResumen(null);
    try {
      setResumen(desempacar(await registroApi.resumenSemana(semanaId)));
    } catch {
      setResumen(null);
    }
  }, [semanaId]);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  // ---------- totales en vivo ----------
  const totales = useMemo(() => {
    const litros = dias.reduce((s, d) => s + aNumero(d.litros, 0), 0);
    const precio = aNumero(precioLitro, 0);
    return {
      dias: dias.filter((d) => aNumero(d.litros, 0) > 0).length,
      litros: Math.round(litros * 100) / 100,
      pagar: Math.round(litros * precio * 100) / 100,
    };
  }, [dias, precioLitro]);

  const cambiarLitros = (fecha, valor) => {
    setDias((prev) => prev.map((d) => (d.fecha === fecha ? { ...d, litros: valor } : d)));
  };

  const elegirProductor = (id) => {
    setProductorId(id);
    const p = productores.find((x) => String(x.id) === String(id));
    if (p) {
      if (!vacio(p.precio_litro_base)) setPrecioLitro(String(p.precio_litro_base));
      if (p.moneda) setMoneda(p.moneda);
    }
  };

  // ---------- acciones ----------
  const guardarSemanaProductor = async () => {
    if (!productorId || !semanaId) return setError('Seleccione el productor y la semana.');
    if (aNumero(precioLitro, 0) <= 0) return setError('Indique a cuánto se le paga el litro esta semana.');

    setGuardando(true);
    setError('');
    try {
      const respuesta = await registroApi.guardarHoja({
        productor_id: Number(productorId),
        semana_id: Number(semanaId),
        precio_litro: aNumero(precioLitro, 0),
        moneda,
        dias: dias.map((d) => ({ fecha: d.fecha, litros: vacio(d.litros) ? null : aNumero(d.litros, 0) })),
      });
      const hoja = desempacar(respuesta);
      setDias(hoja.dias.map((d) => ({ ...d, litros: d.litros === null ? '' : String(d.litros) })));
      setPago(hoja.pago || null);
      setAviso(`Semana guardada: ${hoja.totales.total_litros} litros.`);
      await cargarResumen();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar la semana.');
    } finally {
      setGuardando(false);
    }
  };

  const registrarPago = async () => {
    if (totales.litros <= 0) return setError('Cargue los litros antes de registrar el pago.');
    const texto = `${formatearMontoEnMoneda(totales.pagar, moneda)} por ${totales.litros} litros`;
    if (!window.confirm(`¿Registrar el pago de ${productor?.nombre}? Total: ${texto}`)) return;

    setGuardando(true);
    setError('');
    try {
      await registroApi.guardarHoja({
        productor_id: Number(productorId),
        semana_id: Number(semanaId),
        precio_litro: aNumero(precioLitro, 0),
        moneda,
        dias: dias.map((d) => ({ fecha: d.fecha, litros: vacio(d.litros) ? null : aNumero(d.litros, 0) })),
      });
      const respuesta = await registroApi.registrarPagoSemana({
        productor_id: Number(productorId),
        semana_id: Number(semanaId),
        marcar_pagado: true,
      });
      setPago(desempacar(respuesta));
      setAviso('Pago registrado.');
      await cargarResumen();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar el pago.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirSemana = async (e) => {
    e.preventDefault();
    setGuardandoSemana(true);
    setErrorSemana('');
    try {
      const nueva = desempacar(await registroApi.abrirSemana(formSemana));
      const resSemanas = desempacar(await registroApi.listarSemanas()) || [];
      setSemanas(resSemanas);
      setSemanaId(String(nueva.id));
      setModalSemana(false);
      setAviso(`Semana abierta: ${etiquetaSemana(nueva)}.`);
    } catch (err) {
      setErrorSemana(err.response?.data?.message || 'No se pudo abrir la semana.');
    } finally {
      setGuardandoSemana(false);
    }
  };

  const cerrarSemanaActual = async () => {
    if (!semana || semana.estado === 'cerrada') return;
    if (!window.confirm(`¿Cerrar la semana ${etiquetaSemana(semana)}? Ya no se podrán editar los litros.`)) return;
    try {
      await registroApi.cerrarSemana(semana.id);
      setSemanas((prev) => prev.map((s) => (s.id === semana.id ? { ...s, estado: 'cerrada' } : s)));
      setAviso('Semana cerrada.');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cerrar la semana.');
    }
  };

  const abrirModalSemana = () => {
    const lunes = lunesDe(hoy());
    setFormSemana({ fecha_inicio: lunes, fecha_fin: sumarDias(lunes, 6) });
    setErrorSemana('');
    setModalSemana(true);
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando registro de leche..." />;

  const semanaCerrada = semana?.estado === 'cerrada';

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-3 gap-3 flex-wrap">
        <div>
          <h4 className="mb-1">Registro diario de leche</h4>
          <p className="text-muted mb-0">
            Abra la semana, elija el productor y cargue los litros de cada día. Al final la pantalla totaliza los
            litros y cuánto hay que cancelarle.
          </p>
        </div>
        <Button variant="success" onClick={abrirModalSemana}>
          + Abrir semana
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
          </div>

          <div style={{ minWidth: 240 }}>
            <Form.Label className="small text-muted mb-1">Productor</Form.Label>
            <Form.Select value={productorId} onChange={(e) => elegirProductor(e.target.value)}>
              <option value="">Seleccione un productor</option>
              {productores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Form.Select>
          </div>

          <div style={{ minWidth: 300 }}>
            <Form.Label className="small text-muted mb-1">Precio por litro de esta semana</Form.Label>
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

          {semana && (
            <div className="ms-auto d-flex align-items-center gap-2">
              <Badge bg={semanaCerrada ? 'secondary' : 'success'}>
                {semanaCerrada ? 'Semana cerrada' : 'Semana abierta'}
              </Badge>
              {!semanaCerrada && (
                <Button size="sm" variant="outline-secondary" onClick={cerrarSemanaActual}>
                  Cerrar semana
                </Button>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {!productorId || !semanaId ? (
        <Alert variant="light" className="border text-muted">
          Elija una semana y un productor para cargar los litros del día.
        </Alert>
      ) : cargandoHoja ? (
        <LoadingSpinner mensaje="Abriendo la hoja de la semana..." />
      ) : (
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <Punto color={productor?.color_identificativo} />
              <strong>{productor?.nombre}</strong>
              <span className="text-muted small">{etiquetaSemana(semana)}</span>
            </div>
            {pago && (
              <Badge bg={pago.estado_pago === 'pagado' ? 'success' : 'warning'}>
                {pago.estado_pago === 'pagado' ? `Pagado el ${formatoCorto(pago.fecha_pago)}` : 'Pago pendiente'}
              </Badge>
            )}
          </Card.Header>

          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th style={{ width: 160 }}>Día</th>
                <th style={{ width: 140 }}>Fecha</th>
                <th style={{ width: 200 }}>Litros</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => {
                const litros = aNumero(d.litros, 0);
                return (
                  <tr key={d.fecha}>
                    <td className="fw-semibold">{d.dia}</td>
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
                        onChange={(e) => cambiarLitros(d.fecha, e.target.value)}
                      />
                    </td>
                    <td className={litros > 0 ? '' : 'text-muted'}>
                      {litros > 0 ? formatearMontoEnMoneda(litros * aNumero(precioLitro, 0), moneda) : 'No trajo'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="table-light">
              <tr>
                <th colSpan={2}>
                  Total de la semana
                  <div className="text-muted fw-normal small">{totales.dias} día(s) con leche</div>
                </th>
                <th>{totales.litros} litros</th>
                <th className="fs-5">{formatearMontoEnMoneda(totales.pagar, moneda)}</th>
              </tr>
            </tfoot>
          </Table>

          <Card.Footer className="d-flex justify-content-end gap-2 flex-wrap">
            <Button variant="outline-success" onClick={guardarSemanaProductor} disabled={guardando || semanaCerrada}>
              {guardando ? 'Guardando...' : 'Guardar semana'}
            </Button>
            <Button variant="success" onClick={registrarPago} disabled={guardando || totales.litros <= 0}>
              Registrar pago
            </Button>
          </Card.Footer>
        </Card>
      )}

      {resumen && resumen.productores?.length > 0 && (
        <Card className="mt-4">
          <Card.Header>
            Resumen de la semana {etiquetaSemana(resumen.semana)} — {resumen.total_litros} litros en total
          </Card.Header>
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Productor</th>
                <th>Ruta</th>
                <th>Días</th>
                <th>Litros</th>
                <th>Precio/litro</th>
                <th>Total a cancelar</th>
              </tr>
            </thead>
            <tbody>
              {resumen.productores.map((p) => (
                <tr
                  key={p.productor_id}
                  role="button"
                  onClick={() => setProductorId(String(p.productor_id))}
                >
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <Punto color={p.color_identificativo} />
                      {p.nombre}
                    </div>
                  </td>
                  <td className="text-muted small">{p.ruta?.nombre || '—'}</td>
                  <td>{p.dias}</td>
                  <td>{p.total_litros}</td>
                  <td>{formatearMontoEnMoneda(p.precio_litro, p.moneda)}</td>
                  <td className="fw-semibold">{formatearMontoEnMoneda(p.total_pagar, p.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal show={modalSemana} onHide={() => setModalSemana(false)} centered>
        <Form onSubmit={abrirSemana}>
          <Modal.Header closeButton>
            <Modal.Title>Abrir semana</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorSemana && <Alert variant="danger">{errorSemana}</Alert>}
            <p className="text-muted">
              Elija el día en que empieza la recolección y el día en que termina. Por defecto va de lunes a domingo.
            </p>
            <div className="row g-3">
              <div className="col-6">
                <Form.Label>Comienza</Form.Label>
                <Form.Control
                  type="date"
                  value={formSemana.fecha_inicio}
                  onChange={(e) =>
                    setFormSemana((prev) => ({
                      fecha_inicio: e.target.value,
                      fecha_fin: prev.fecha_fin < e.target.value ? sumarDias(e.target.value, 6) : prev.fecha_fin,
                    }))
                  }
                  required
                />
              </div>
              <div className="col-6">
                <Form.Label>Termina</Form.Label>
                <Form.Control
                  type="date"
                  value={formSemana.fecha_fin}
                  min={formSemana.fecha_inicio}
                  onChange={(e) => setFormSemana((prev) => ({ ...prev, fecha_fin: e.target.value }))}
                  required
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setModalSemana(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoSemana}>
              {guardandoSemana ? 'Abriendo...' : 'Abrir semana'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default RegistroLeche;