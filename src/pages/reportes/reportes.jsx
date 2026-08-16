import React, { useCallback, useEffect, useState } from 'react';
import { Table, Button, Form, Alert, Badge, Card } from 'react-bootstrap';
import * as reportesApi from '../../api/reportes.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { desempacar, formatoCorto, hoy } from '../../utils/fechas';

const inicioDeMes = (texto) => `${String(texto).slice(0, 7)}-01`;

const detalleError = (err) => {
  if (err?.response) return err.response.data?.message || `El servidor respondió ${err.response.status}.`;
  if (err?.request) return 'El servidor no respondió. Revise la conexión.';
  return err?.message || 'Error desconocido.';
};

const dinero = (valor, moneda = 'BS') =>
  `${Number(valor || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;

/** Verde si gana, rojo si pierde. Sin costo no hay color: no se sabe. s*/
const colorMargen = (r) => {
  if (r.sin_costo) return 'text-muted';
  return r.ganancia >= 0 ? 'text-success' : 'text-danger';
};

const Reportes = () => {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [desde, setDesde] = useState(() => inicioDeMes(hoy()));
  const [hasta, setHasta] = useState(() => hoy());

  const cargar = useCallback(
    async (rangoDesde = desde, rangoHasta = hasta) => {
      setError('');
      try {
        setDatos(
          desempacar(await reportesApi.reporteVentas({ fecha_inicio: rangoDesde, fecha_fin: rangoHasta })) || null
        );
      } catch (err) {
        setError(`No se pudo cargar el reporte. ${detalleError(err)}`);
      } finally {
        setCargando(false);
      }
    },
    [desde, hasta]
  );

  useEffect(() => {
    cargar();
    // Solo la primera vez: después se consulta con el botón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cargando) return <LoadingSpinner mensaje="Calculando..." />;

  const resumen = datos?.resumen;
  const productos = datos?.productos || [];

  return (
    <div>
      <div className="page-header mb-3">
        <h4 className="mb-1">Reportes de venta</h4>
        <p className="text-muted mb-0">
          Qué se vendió más y si dejó ganancia. El costo sale de los lotes: litros de leche por su precio, más los
          insumos que se gastaron, entre los kilos obtenidos.
        </p>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      )}

      <Card className="mb-3">
        <Card.Body className="d-flex flex-wrap gap-3 align-items-end py-3">
          <div style={{ minWidth: 170 }}>
            <Form.Label className="small text-muted mb-1">Desde</Form.Label>
            <Form.Control type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div style={{ minWidth: 170 }}>
            <Form.Label className="small text-muted mb-1">Hasta</Form.Label>
            <Form.Control type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button variant="success" onClick={() => cargar()}>
            Ver
          </Button>
        </Card.Body>
      </Card>

      {/* ---------- Resumen ---------- */}
      <div className="d-flex flex-wrap gap-3 mb-3">
        {(datos?.totales_por_moneda || []).map((t) => (
          <Card key={t.moneda} className="flex-grow-1" style={{ minWidth: 260 }}>
            <Card.Body className="py-3">
              <div className="text-muted small text-uppercase">Resultado en {t.moneda}</div>
              <div className="d-flex justify-content-between small mt-2">
                <span>Se vendió</span>
                <strong>{dinero(t.ingreso, t.moneda)}</strong>
              </div>
              <div className="d-flex justify-content-between small">
                <span className="text-muted">Costó producirlo</span>
                <span className="text-muted">{dinero(t.costo, t.moneda)}</span>
              </div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between fs-5">
                <strong>{t.ganancia >= 0 ? 'Ganancia' : 'Pérdida'}</strong>
                <strong className={t.ganancia >= 0 ? 'text-success' : 'text-danger'}>
                  {dinero(t.ganancia, t.moneda)}
                  {t.margen !== null && <span className="fs-6 ms-2">({t.margen}%)</span>}
                </strong>
              </div>
            </Card.Body>
          </Card>
        ))}

        {resumen?.mas_vendido && (
          <Card className="flex-grow-1" style={{ minWidth: 240 }}>
            <Card.Body className="py-3">
              <div className="text-muted small text-uppercase">Lo más vendido</div>
              <div className="fs-4 fw-semibold lh-1 mt-1">{resumen.mas_vendido.producto}</div>
              <div className="text-muted small mt-1">
                {resumen.mas_vendido.kilos} kg de {resumen.kilos_vendidos} kg vendidos en total
              </div>
            </Card.Body>
          </Card>
        )}
      </div>

      {resumen?.sin_costo?.length > 0 && (
        <Alert variant="warning">
          <strong>Sin costo conocido:</strong> {resumen.sin_costo.join(', ')}. Esos productos no tienen lotes con
          precio de leche o insumos cargados, así que su margen no se puede calcular. Aparecen con la ganancia en
          blanco en lugar de con un número inventado.
        </Alert>
      )}

      {/* ---------- Producto por producto ---------- */}
      <Card className="mb-3">
        <Card.Header>
          <strong>Producto por producto</strong>
          <div className="text-muted small">Ordenados por lo que más salió.</div>
        </Card.Header>
        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="text-end">Kilos vendidos</th>
              <th className="text-end">Costo por kilo</th>
              <th className="text-end">Precio de venta</th>
              <th className="text-end">Ganancia</th>
              <th className="text-end">Margen</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) =>
              p.rentabilidad.map((r, indice) => (
                <tr key={`${p.producto}-${r.moneda}`}>
                  {indice === 0 ? (
                    <td rowSpan={p.rentabilidad.length}>
                      <span className="fw-semibold">{p.producto}</span>
                      {p.rendimiento_litros_kilo && (
                        <div className="text-muted small">{p.rendimiento_litros_kilo} L por kilo</div>
                      )}
                      {p.lotes_sin_precio_leche > 0 && (
                        <Badge bg="warning" text="dark" className="mt-1">
                          {p.lotes_sin_precio_leche} lote(s) sin precio de leche
                        </Badge>
                      )}
                    </td>
                  ) : null}
                  {indice === 0 ? (
                    <td className="text-end fw-semibold" rowSpan={p.rentabilidad.length}>
                      {p.kilos_vendidos}
                    </td>
                  ) : null}
                  <td className="text-end text-muted">
                    {r.sin_costo ? '—' : dinero(r.costo_kg, r.moneda)}
                  </td>
                  <td className="text-end">
                    {dinero(p.precio_kilo_promedio[r.moneda], r.moneda)}
                    <div className="text-muted small">{dinero(r.ingreso, r.moneda)} en total</div>
                  </td>
                  <td className={`text-end fw-semibold ${colorMargen(r)}`}>
                    {r.sin_costo ? 'Sin costo' : dinero(r.ganancia, r.moneda)}
                  </td>
                  <td className={`text-end fw-semibold ${colorMargen(r)}`}>
                    {r.sin_costo || r.margen === null ? '—' : `${r.margen}%`}
                    {r.costos_en_otra_moneda.length > 0 && (
                      <div className="text-warning-emphasis small fw-normal">
                        + {r.costos_en_otra_moneda.map((c) => dinero(c.costo_total, c.moneda)).join(' · ')} sin
                        descontar
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
            {productos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  No hubo ventas entre esas fechas.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Quién compra ---------- */}
      {(datos?.por_cliente || []).length > 0 && (
        <Card>
          <Card.Header>
            <strong>Quién compró</strong>
          </Card.Header>
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Cliente o sucursal</th>
                <th className="text-end">Compras</th>
                <th className="text-end">Kilos</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              {datos.por_cliente.map((c) => (
                <tr key={`${c.nombre}-${c.moneda}`}>
                  <td className="fw-semibold">{c.nombre}</td>
                  <td className="text-end">{c.ventas}</td>
                  <td className="text-end">{c.kilos}</td>
                  <td className="text-end fw-semibold">{dinero(c.total, c.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Card.Footer className="text-muted small">
            Solo lo que salió de la planta. Lo que una sucursal le vende a su cliente no se suma aquí: esa mercancía
            ya se cobró al despachársela, y contarla de nuevo duplicaría el ingreso.
          </Card.Footer>
        </Card>
      )}
    </div>
  );
};

export default Reportes;