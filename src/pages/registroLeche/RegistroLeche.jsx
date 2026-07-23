import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Form, Alert, Badge, InputGroup, Card } from 'react-bootstrap';
import * as registroApi from '../../api/registroLeche.api';
import * as productoresApi from '../../api/productores.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';
import { OPCIONES_DIA, aNumero, desempacar, diaSemanaDeFecha, formatoCorto, hoy, largoCiclo, nombreDia, vacio } from '../../utils/fechas';

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

  const [productores, setProductores] = useState([]);
  const [productorId, setProductorId] = useState('');

  // El cliente elige la fecha exacta en que arranca la semana; el día que
  // le corresponde (lunes, martes...) se calcula solo. "Termina" sigue
  // siendo por nombre de día.
  const [fechaInicio, setFechaInicio] = useState(hoy());
  const [diaFin, setDiaFin] = useState(0); // domingo
  const [semanaId, setSemanaId] = useState(null); // solo al reabrir una del historial

  const [hoja, setHoja] = useState(null);
  const [dias, setDias] = useState([]);
  const [precioLitro, setPrecioLitro] = useState('');
  // Precio de la leche ácida: opcional. El mismo productor puede traer
  // litros buenos (precio normal) y litros ácidos (precio más bajo) el
  // mismo día; cada quien con su propio precio.
  const [precioAcida, setPrecioAcida] = useState('');
  const [moneda, setMoneda] = useState('BS');
  const [cargandoHoja, setCargandoHoja] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [historial, setHistorial] = useState([]);

  const productor = useMemo(
    () => productores.find((p) => String(p.id) === String(productorId)) || null,
    [productores, productorId]
  );

  const cargarProductores = async () => {
    setCargando(true);
    setError('');
    try {
      const lista = (desempacar(await productoresApi.listarProductores()) || []).filter((p) => p.activo !== false);
      setProductores(lista);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los productores.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarProductores();
  }, []);

  const cargarHoja = useCallback(async () => {
    if (!productorId) {
      setHoja(null);
      setDias([]);
      return;
    }
    setCargandoHoja(true);
    setError('');
    try {
      const params = semanaId
        ? { productor_id: productorId, semana_id: semanaId }
        : { productor_id: productorId, fecha_inicio: fechaInicio, dia_fin: diaFin };

      const datos = desempacar(await registroApi.obtenerHoja(params));
      setHoja(datos);
      setDias(
        datos.dias.map((d) => ({
          ...d,
          litros: d.litros === null ? '' : String(d.litros),
          litros_acidos: d.litros_acidos ? String(d.litros_acidos) : '',
        }))
      );
      setPrecioLitro(datos.precio_litro ? String(datos.precio_litro) : '');
      setPrecioAcida(datos.precio_litro_acida ? String(datos.precio_litro_acida) : '');
      setMoneda(datos.moneda || 'BS');
      if (semanaId && datos.dias.length > 0) {
        setFechaInicio(datos.dias[0].fecha);
        setDiaFin(datos.semana.dia_fin);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo abrir la semana.');
    } finally {
      setCargandoHoja(false);
    }
  }, [productorId, fechaInicio, diaFin, semanaId]);

  useEffect(() => {
    cargarHoja();
  }, [cargarHoja]);

  const cargarHistorial = useCallback(async () => {
    if (!productorId) return setHistorial([]);
    try {
      setHistorial(desempacar(await registroApi.historialProductor(productorId)) || []);
    } catch {
      setHistorial([]);
    }
  }, [productorId]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const totales = useMemo(() => {
    const litros = dias.reduce((s, d) => s + aNumero(d.litros, 0), 0);
    const litrosAcidos = dias.reduce((s, d) => s + aNumero(d.litros_acidos, 0), 0);
    const precio = aNumero(precioLitro, 0);
    const precioAc = aNumero(precioAcida, 0);
    return {
      dias: dias.filter((d) => aNumero(d.litros, 0) > 0 || aNumero(d.litros_acidos, 0) > 0).length,
      litros: Math.round(litros * 100) / 100,
      litrosAcidos: Math.round(litrosAcidos * 100) / 100,
      pagar: Math.round((litros * precio + litrosAcidos * precioAc) * 100) / 100,
    };
  }, [dias, precioLitro, precioAcida]);

  const elegirProductor = (id) => {
    setSemanaId(null);
    setProductorId(id);
    const p = productores.find((x) => String(x.id) === String(id));
    if (p) {
      if (!vacio(p.precio_litro_base)) setPrecioLitro(String(p.precio_litro_base));
      if (!vacio(p.precio_litro_acida)) setPrecioAcida(String(p.precio_litro_acida));
      if (p.moneda) setMoneda(p.moneda);
    }
  };

  const cambiarFechaInicio = (valor) => {
    setSemanaId(null);
    setFechaInicio(valor);
  };

  const cambiarDiaFin = (valor) => {
    setSemanaId(null);
    setDiaFin(Number(valor));
  };

  const cambiarDia = (fecha, campo, valor) => {
    setDias((prev) => prev.map((x) => (x.fecha === fecha ? { ...x, [campo]: valor } : x)));
  };

  const cuerpoHoja = () => ({
    productor_id: Number(productorId),
    semana_id: hoja.semana.id,
    precio_litro: aNumero(precioLitro, 0),
    precio_litro_acida: aNumero(precioAcida, 0),
    moneda,
    dias: dias.map((d) => ({
      fecha: d.fecha,
      litros: vacio(d.litros) ? null : aNumero(d.litros, 0),
      litros_acidos: vacio(d.litros_acidos) ? 0 : aNumero(d.litros_acidos, 0),
    })),
  });

  const guardarSemana = async () => {
    if (!hoja) return;
    if (aNumero(precioLitro, 0) <= 0) return setError('Indique a cuánto se le paga el litro esta semana.');
    if (totales.litrosAcidos > 0 && aNumero(precioAcida, 0) <= 0) {
      return setError('Indique el precio de la leche ácida: hay litros ácidos cargados.');
    }

    setGuardando(true);
    setError('');
    try {
      const datos = desempacar(await registroApi.guardarHoja(cuerpoHoja()));
      setHoja(datos);
      setDias(
        datos.dias.map((d) => ({
          ...d,
          litros: d.litros === null ? '' : String(d.litros),
          litros_acidos: d.litros_acidos ? String(d.litros_acidos) : '',
        }))
      );
      setAviso(
        `Semana guardada: ${datos.totales.total_litros} litros` +
          (datos.totales.total_litros_acidos > 0 ? ` + ${datos.totales.total_litros_acidos} ácidos.` : '.')
      );
      await cargarHistorial();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar la semana.');
    } finally {
      setGuardando(false);
    }
  };

  const registrarPago = async () => {
    if (!hoja || (totales.litros <= 0 && totales.litrosAcidos <= 0)) {
      return setError('Cargue los litros antes de registrar el pago.');
    }
    const partes = [`${totales.litros} litros × ${formatearMontoEnMoneda(aNumero(precioLitro, 0), moneda)}`];
    if (totales.litrosAcidos > 0) {
      partes.push(`${totales.litrosAcidos} ácidos × ${formatearMontoEnMoneda(aNumero(precioAcida, 0), moneda)}`);
    }
    const resumen = `${partes.join(' + ')} = ${formatearMontoEnMoneda(totales.pagar, moneda)}`;
    if (!window.confirm(`¿Registrar el pago de ${productor?.nombre}?\n${resumen}`)) return;

    setGuardando(true);
    setError('');
    try {
      await registroApi.guardarHoja(cuerpoHoja());
      await registroApi.registrarPagoSemana({
        productor_id: Number(productorId),
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

  const cambiarEstadoSemana = async (estado) => {
    if (!hoja) return;
    try {
      await registroApi.cambiarEstadoSemana(hoja.semana.id, estado);
      setAviso(estado === 'cerrada' ? 'Semana cerrada.' : 'Semana reabierta.');
      await cargarHoja();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cambiar el estado de la semana.');
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando registro de leche..." />;

  const cerrada = hoja?.semana?.estado === 'cerrada';

  return (
    <div>
      <div className="mb-3">
        <h4 className="mb-1">Registro diario de leche</h4>
        <p className="text-muted mb-0">
          Elija el productor y en qué días corre su semana. Cargue los litros buenos y, si trajo, los litros ácidos
          de cada día — cada uno se paga a su propio precio.
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

      <Card className="mb-3">
        <Card.Body className="d-flex flex-wrap gap-3 align-items-end">
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

          <div style={{ minWidth: 190 }}>
            <Form.Label className="small text-muted mb-1">Fecha de inicio</Form.Label>
            <Form.Control type="date" value={fechaInicio} onChange={(e) => cambiarFechaInicio(e.target.value)} />
            <Form.Text className="text-muted">{nombreDia(diaSemanaDeFecha(fechaInicio))}</Form.Text>
          </div>

          <div style={{ minWidth: 150 }}>
            <Form.Label className="small text-muted mb-1">Termina</Form.Label>
            <Form.Select value={diaFin} onChange={(e) => cambiarDiaFin(e.target.value)}>
              {OPCIONES_DIA.map((d) => (
                <option key={d.valor} value={d.valor}>
                  {d.nombre}
                </option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">{largoCiclo(diaSemanaDeFecha(fechaInicio), diaFin)} día(s)</Form.Text>
          </div>

          <div style={{ minWidth: 260 }}>
            <Form.Label className="small text-muted mb-1">Precio por litro (normal)</Form.Label>
            <InputGroup>
              <Form.Select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={{ maxWidth: 150 }}>
                {OPCIONES_MONEDA.map((op) => (
                  <option key={op.codigo} value={op.codigo}>
                    {op.codigo}
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

          <div style={{ minWidth: 200 }}>
            <Form.Label className="small text-muted mb-1">Precio leche ácida</Form.Label>
            <InputGroup>
              <InputGroup.Text>{moneda}</InputGroup.Text>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                value={precioAcida}
                onChange={(e) => setPrecioAcida(e.target.value)}
                placeholder="0.00"
              />
            </InputGroup>
            <Form.Text className="text-muted">Solo si trae litros ácidos.</Form.Text>
          </div>
        </Card.Body>
      </Card>

      {!productorId ? (
        <Alert variant="light" className="border text-muted">
          Seleccione un productor para cargar su semana.
        </Alert>
      ) : cargandoHoja ? (
        <LoadingSpinner mensaje="Abriendo la semana..." />
      ) : hoja ? (
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <Punto color={productor?.color_identificativo} />
              <strong>{productor?.nombre}</strong>
              <span className="text-muted small">
                {formatoCorto(fechaInicio)} a {formatoCorto(dias[dias.length - 1]?.fecha)}
              </span>
            </div>
            <div className="d-flex align-items-center gap-2">
              {hoja.pago && (
                <Badge bg={hoja.pago.estado_pago === 'pagado' ? 'success' : 'warning'}>
                  {hoja.pago.estado_pago === 'pagado'
                    ? `Pagado el ${formatoCorto(hoja.pago.fecha_pago)}`
                    : 'Pago pendiente'}
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => cambiarEstadoSemana(cerrada ? 'abierta' : 'cerrada')}
              >
                {cerrada ? 'Reabrir semana' : 'Cerrar semana'}
              </Button>
            </div>
          </Card.Header>

          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Día</th>
                <th style={{ width: 100 }}>Fecha</th>
                <th style={{ width: 150 }}>Litros buenos</th>
                <th style={{ width: 150 }}>Litros ácidos</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => {
                const litros = aNumero(d.litros, 0);
                const litrosAcidos = aNumero(d.litros_acidos, 0);
                const subtotal = litros * aNumero(precioLitro, 0) + litrosAcidos * aNumero(precioAcida, 0);
                return (
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
                        value={d.litros_acidos}
                        disabled={cerrada}
                        placeholder="—"
                        onChange={(e) => cambiarDia(d.fecha, 'litros_acidos', e.target.value)}
                      />
                    </td>
                    <td className={litros > 0 || litrosAcidos > 0 ? '' : 'text-muted'}>
                      {litros > 0 || litrosAcidos > 0 ? formatearMontoEnMoneda(subtotal, moneda) : 'No trajo'}
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
                <th>{totales.litrosAcidos > 0 ? `${totales.litrosAcidos} ácidos` : '—'}</th>
                <th className="fs-5">{formatearMontoEnMoneda(totales.pagar, moneda)}</th>
              </tr>
            </tfoot>
          </Table>

          <Card.Footer className="d-flex justify-content-end gap-2 flex-wrap">
            <Button variant="outline-success" onClick={guardarSemana} disabled={guardando || cerrada}>
              {guardando ? 'Guardando...' : 'Guardar semana'}
            </Button>
            <Button
              variant="success"
              onClick={registrarPago}
              disabled={guardando || (totales.litros <= 0 && totales.litrosAcidos <= 0)}
            >
              Registrar pago
            </Button>
          </Card.Footer>
        </Card>
      ) : null}

      {historial.length > 0 && (
        <Card className="mt-4">
          <Card.Header>Semanas anteriores de {productor?.nombre}</Card.Header>
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Días</th>
                <th>Con leche</th>
                <th>Litros</th>
                <th>Ácidos</th>
                <th>Total</th>
                <th>Pago</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historial.map((s) => (
                <tr key={s.id} className={String(s.id) === String(hoja?.semana?.id) ? 'table-active' : ''}>
                  <td className="fw-semibold">{s.etiqueta}</td>
                  <td>{s.dias_con_leche}</td>
                  <td>{s.total_litros}</td>
                  <td>{s.total_litros_acidos > 0 ? s.total_litros_acidos : '—'}</td>
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
    </div>
  );
};

export default RegistroLeche;