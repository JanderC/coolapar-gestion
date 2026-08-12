import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Form, Alert, Badge, Card, Row, Col } from 'react-bootstrap';
import * as registroApi from '../../api/registroLeche.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';
import { desempacar, formatoCorto, hoy } from '../../utils/fechas';
import { construirBloqueProductor, construirBloqueTotales, imprimirDocumento } from '../../utils/impresionLeche';

const Punto = ({ color }) => (
  <span
    className="d-inline-block rounded-circle me-2 align-middle"
    style={{ width: 10, height: 10, background: color || '#ced4da', border: '1px solid #adb5bd' }}
  />
);

/** Suma (o resta) días a una fecha en texto yyyy-mm-dd, sin zonas horarias. */
const sumarDiasTexto = (texto, dias) => {
  const [anio, mes, dia] = String(texto).split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

/** Lunes de la semana a la que pertenece la fecha dada. */
const lunesDe = (texto) => {
  const [anio, mes, dia] = String(texto).split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const diaSemana = fecha.getUTCDay(); // 0 = domingo
  return sumarDiasTexto(texto, diaSemana === 0 ? -6 : 1 - diaSemana);
};

const plano = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const ResumenSemanal = () => {
  const { formatearMontoEnMoneda } = useMoneda();

  const lunesActual = lunesDe(hoy());
  const [fechaInicio, setFechaInicio] = useState(lunesActual);
  const [fechaFin, setFechaFin] = useState(sumarDiasTexto(lunesActual, 6));

  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState([]);
  const [imprimiendo, setImprimiendo] = useState(false);

  // Rango efectivamente consultado. Se guarda aparte de los inputs para
  // que al imprimir se use el rango de los datos en pantalla, no el que
  // el usuario pueda estar tecleando en ese momento.
  const [rangoConsultado, setRangoConsultado] = useState(null);

  const consultar = useCallback(async () => {
    if (!fechaInicio || !fechaFin) {
      setError('Indique la fecha de inicio y la de cierre.');
      return;
    }
    if (fechaInicio > fechaFin) {
      setError('La fecha de inicio debe ser anterior a la de cierre.');
      return;
    }

    setCargando(true);
    setError('');
    try {
      const datos = desempacar(
        await registroApi.resumenSemana({ fecha_inicio: fechaInicio, fecha_fin: fechaFin })
      );
      setResumen(datos);
      setRangoConsultado({ inicio: fechaInicio, fin: fechaFin });
      setSeleccion([]);
    } catch (err) {
      setResumen(null);
      setError(err.response?.data?.message || 'No se pudo cargar la semana.');
    } finally {
      setCargando(false);
    }
  }, [fechaInicio, fechaFin]);

  // Primera carga con la semana en curso.
  useEffect(() => {
    consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const irASemana = (desplazamiento) => {
    const nuevoInicio = sumarDiasTexto(fechaInicio, desplazamiento * 7);
    setFechaInicio(nuevoInicio);
    setFechaFin(sumarDiasTexto(nuevoInicio, 6));
  };

  const productores = resumen?.productores || [];

  const visibles = useMemo(() => {
    const q = plano(busqueda);
    if (!q) return productores;
    return productores.filter((p) => plano(p.nombre).includes(q));
  }, [productores, busqueda]);

  const alternar = (id) => {
    const clave = String(id);
    setSeleccion((prev) => (prev.includes(clave) ? prev.filter((x) => x !== clave) : [...prev, clave]));
  };

  const todosVisiblesMarcados = visibles.length > 0 && visibles.every((p) => seleccion.includes(String(p.productor_id)));

  const alternarTodos = () => {
    if (todosVisiblesMarcados) {
      const idsVisibles = visibles.map((p) => String(p.productor_id));
      setSeleccion((prev) => prev.filter((x) => !idsVisibles.includes(x)));
    } else {
      setSeleccion((prev) => [...new Set([...prev, ...visibles.map((p) => String(p.productor_id))])]);
    }
  };

  /** Totales de lo que está marcado, separados por moneda. */
  const totalesSeleccion = useMemo(() => {
    const mapa = new Map();
    productores
      .filter((p) => seleccion.includes(String(p.productor_id)))
      .forEach((p) => {
        if (!mapa.has(p.moneda)) {
          mapa.set(p.moneda, { moneda: p.moneda, productores: 0, total_litros: 0, total_pagar: 0 });
        }
        const t = mapa.get(p.moneda);
        t.productores += 1;
        t.total_litros += Number(p.total_litros || 0);
        t.total_pagar += Number(p.total_pagar || 0);
      });
    return [...mapa.values()].sort((a, b) => a.moneda.localeCompare(b.moneda));
  }, [productores, seleccion]);

  const imprimirSeleccionados = async () => {
    if (seleccion.length === 0 || !rangoConsultado) return;

    setImprimiendo(true);
    setError('');
    try {
      // Se respeta el orden alfabético de la tabla, no el orden en que se
      // fueron marcando las casillas.
      const idsOrdenados = productores
        .map((p) => String(p.productor_id))
        .filter((id) => seleccion.includes(id));

      const hojas = await Promise.all(
        idsOrdenados.map((id) =>
          registroApi
            .obtenerHoja({
              productor_id: id,
              fecha_inicio: rangoConsultado.inicio,
              fecha_fin: rangoConsultado.fin,
            })
            .then(desempacar)
        )
      );

      const bloques = hojas.map((h) => construirBloqueProductor(h, formatearMontoEnMoneda));
      // Con más de un productor se agrega la hoja de totales al final.
      if (idsOrdenados.length > 1) {
        bloques.push(construirBloqueTotales(totalesSeleccion, formatearMontoEnMoneda));
      }

      imprimirDocumento(
        bloques,
        `Semana del ${formatoCorto(rangoConsultado.inicio)} al ${formatoCorto(rangoConsultado.fin)}`
      );
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo preparar la impresión.');
    } finally {
      setImprimiendo(false);
    }
  };

  const totalesMoneda = resumen?.totales_por_moneda || [];

  return (
    <div>
      <div className="page-header mb-3">
        <h4 className="mb-1">Resumen semanal</h4>
        <p className="text-muted mb-0">
          Elija el rango de la semana y verá a todos los productores que trajeron leche en esos días, cada uno con
          su propio precio y su total. Marque los que quiera imprimir.
        </p>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      )}

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col xs={12} md={3}>
              <Form.Label>Desde</Form.Label>
              <Form.Control
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                max={fechaFin || undefined}
              />
            </Col>
            <Col xs={12} md={3}>
              <Form.Label>Hasta</Form.Label>
              <Form.Control
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                min={fechaInicio || undefined}
              />
            </Col>
            <Col xs={12} md={6} className="d-flex flex-wrap gap-2">
              <Button variant="success" onClick={consultar} disabled={cargando}>
                {cargando ? 'Consultando...' : 'Consultar semana'}
              </Button>
              <Button variant="outline-secondary" onClick={() => irASemana(-1)} disabled={cargando}>
                ← Semana anterior
              </Button>
              <Button variant="outline-secondary" onClick={() => irASemana(1)} disabled={cargando}>
                Semana siguiente →
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {cargando && <LoadingSpinner mensaje="Cargando la semana..." />}

      {!cargando && resumen && productores.length === 0 && (
        <Alert variant="secondary">
          Nadie trajo leche entre el {formatoCorto(resumen.rango.fecha_inicio)} y el{' '}
          {formatoCorto(resumen.rango.fecha_fin)}. Pruebe con otro rango, o cargue los litros desde «Registro diario
          de leche».
        </Alert>
      )}

      {!cargando && resumen && productores.length > 0 && (
        <>
          <Card className="mb-3">
            <Card.Body>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <div className="text-muted small">
                    Semana del {formatoCorto(resumen.rango.fecha_inicio)} al {formatoCorto(resumen.rango.fecha_fin)}
                  </div>
                  <div className="fs-5">
                    <strong>{resumen.totales.productores}</strong> productores ·{' '}
                    <strong>{resumen.totales.total_litros}</strong> litros
                    {resumen.totales.total_litros_acidos > 0 && (
                      <span className="text-muted fs-6"> ({resumen.totales.total_litros_acidos} L ácidos)</span>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  {totalesMoneda.map((t) => (
                    <div key={t.moneda} className="fs-5">
                      <span className="text-muted small me-2">Total {t.moneda}</span>
                      <strong>{formatearMontoEnMoneda(t.total_pagar, t.moneda)}</strong>
                    </div>
                  ))}
                </div>
              </div>
              {totalesMoneda.length > 1 && (
                <div className="text-muted small mt-2">
                  Hay más de una moneda en esta semana. Cada total se cuadra por separado, no se suman entre sí.
                </div>
              )}
            </Card.Body>
          </Card>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <Form.Control
              type="search"
              placeholder="Buscar productor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: 280 }}
            />
            <div className="d-flex align-items-center gap-2">
              {seleccion.length > 0 && (
                <span className="text-muted small">
                  {seleccion.length} marcado{seleccion.length === 1 ? '' : 's'}
                  {totalesSeleccion.map((t) => (
                    <span key={t.moneda}> · {formatearMontoEnMoneda(t.total_pagar, t.moneda)}</span>
                  ))}
                </span>
              )}
              <Button
                variant="success"
                onClick={imprimirSeleccionados}
                disabled={seleccion.length === 0 || imprimiendo}
              >
                {imprimiendo ? 'Preparando...' : `Imprimir seleccionados (${seleccion.length})`}
              </Button>
            </div>
          </div>

          <Table hover responsive className="align-middle">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <Form.Check
                    type="checkbox"
                    checked={todosVisiblesMarcados}
                    onChange={alternarTodos}
                    aria-label="Marcar todos los productores de la lista"
                  />
                </th>
                <th>Productor</th>
                <th className="text-center">Días</th>
                <th className="text-end">Litros buenos</th>
                <th className="text-end">Ácidos</th>
                <th className="text-end">Bajo en grasa</th>
                <th className="text-end">Precio/L</th>
                <th className="text-end">Total a pagar</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const marcado = seleccion.includes(String(p.productor_id));
                return (
                  <tr
                    key={p.productor_id}
                    onClick={() => alternar(p.productor_id)}
                    style={{ cursor: 'pointer' }}
                    className={marcado ? 'table-success' : undefined}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <Form.Check
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternar(p.productor_id)}
                        aria-label={`Marcar a ${p.nombre}`}
                      />
                    </td>
                    <td>
                      <Punto color={p.color_identificativo} />
                      {p.nombre}
                      {p.monedas_mezcladas && (
                        <Badge bg="warning" text="dark" className="ms-2">
                          Monedas mezcladas
                        </Badge>
                      )}
                    </td>
                    <td className="text-center">{p.dias_con_leche}</td>
                    <td className="text-end">{p.total_litros}</td>
                    <td className="text-end">{p.total_litros_acidos > 0 ? p.total_litros_acidos : '—'}</td>
                    <td className="text-end">{p.total_litros_bajo_grasa > 0 ? p.total_litros_bajo_grasa : '—'}</td>
                    <td className="text-end">{formatearMontoEnMoneda(p.precio_litro, p.moneda)}</td>
                    <td className="text-end fw-semibold">{formatearMontoEnMoneda(p.total_pagar, p.moneda)}</td>
                    <td>
                      {p.estado_pago === 'pagado' ? (
                        <Badge bg="success">Pagado</Badge>
                      ) : p.estado_semana === 'cerrada' ? (
                        <Badge bg="secondary">Cerrada</Badge>
                      ) : p.guardado ? (
                        <Badge bg="light" text="dark">
                          Abierta
                        </Badge>
                      ) : (
                        <Badge bg="warning" text="dark">
                          Sin guardar
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="table-light">
                <th />
                <th>{visibles.length === productores.length ? 'Total de la semana' : 'Total de lo que se ve'}</th>
                <th className="text-center">—</th>
                <th className="text-end">{visibles.reduce((s, p) => s + Number(p.total_litros || 0), 0).toFixed(2)}</th>
                <th className="text-end">
                  {visibles.reduce((s, p) => s + Number(p.total_litros_acidos || 0), 0).toFixed(2)}
                </th>
                <th className="text-end">
                  {visibles.reduce((s, p) => s + Number(p.total_litros_bajo_grasa || 0), 0).toFixed(2)}
                </th>
                <th />
                <th className="text-end">
                  {totalesMoneda.map((t) => (
                    <div key={t.moneda}>{formatearMontoEnMoneda(t.total_pagar, t.moneda)}</div>
                  ))}
                </th>
                <th />
              </tr>
            </tfoot>
          </Table>

          {busqueda && visibles.length === 0 && (
            <Alert variant="secondary">Ningún productor de esta semana coincide con «{busqueda}».</Alert>
          )}
        </>
      )}
    </div>
  );
};

export default ResumenSemanal;