import React, { useEffect, useState } from 'react';
import { Table, Button, Alert, Badge, Form, Card } from 'react-bootstrap';
import * as pagosApi from '../../api/pagosProductores.api';
import * as semanasApi from '../../api/semanasPago.api';
import ColorBadge from '../../components/common/ColorBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const PagosProductores = () => {
  const [pagos, setPagos] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [semanaId, setSemanaId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarSemanas = async () => {
    const { data } = await semanasApi.listarSemanas();
    setSemanas(data);
    if (data.length > 0) setSemanaId(String(data[0].id));
  };

  const cargarPagos = async (id) => {
    if (!id) return;
    setCargando(true);
    try {
      const { data } = await pagosApi.listarPagosProductores({ semana_id: id });
      setPagos(data);
    } catch {
      setError('No se pudieron cargar los pagos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarSemanas();
  }, []);

  useEffect(() => {
    if (semanaId) cargarPagos(semanaId);
  }, [semanaId]);

  const liquidarSemana = async () => {
    setProcesando(true);
    setError('');
    setMensaje('');
    try {
      await pagosApi.generarLiquidacionesSemana(semanaId);
      setMensaje('Liquidaciones generadas correctamente para todos los productores con registros.');
      await cargarPagos(semanaId);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo generar la liquidación.');
    } finally {
      setProcesando(false);
    }
  };

  const marcarPagado = async (id) => {
    await pagosApi.marcarPagoComoPagado(id, new Date().toISOString().slice(0, 10));
    await cargarPagos(semanaId);
  };

  return (
    <div>
      <h4 className="mb-1">Pagos a productores</h4>
      <p className="text-muted">Genera la liquidación semanal a partir de los registros diarios de leche.</p>

      <Card className="mb-4 p-3 border-0 shadow-sm">
        <div className="d-flex gap-3 align-items-end flex-wrap">
          <Form.Group>
            <Form.Label>Semana</Form.Label>
            <Form.Select value={semanaId} onChange={(e) => setSemanaId(e.target.value)}>
              {semanas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fecha_inicio} ({s.estado})
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Button variant="success" onClick={liquidarSemana} disabled={procesando || !semanaId}>
            {procesando ? 'Generando...' : 'Generar liquidación de la semana'}
          </Button>
        </div>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}
      {mensaje && <Alert variant="success">{mensaje}</Alert>}

      {cargando ? (
        <LoadingSpinner mensaje="Cargando pagos..." />
      ) : (
        <Table hover responsive bordered className="bg-white">
          <thead>
            <tr>
              <th>Productor</th>
              <th>Total litros</th>
              <th>Total a pagar</th>
              <th>Estado</th>
              <th>Fecha de pago</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id}>
                <td>
                  <ColorBadge color={p.Productor?.color_identificativo} texto={p.Productor?.nombre} />
                </td>
                <td>{p.total_litros} L</td>
                <td>Bs. {p.total_pagar}</td>
                <td>
                  <Badge bg={p.estado_pago === 'pagado' ? 'success' : 'warning'} text={p.estado_pago === 'pagado' ? undefined : 'dark'}>
                    {p.estado_pago}
                  </Badge>
                </td>
                <td>{p.fecha_pago || '—'}</td>
                <td className="text-end">
                  {p.estado_pago === 'pendiente' && (
                    <Button size="sm" variant="outline-success" onClick={() => marcarPagado(p.id)}>
                      Marcar pagado
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {pagos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  No hay liquidaciones generadas para esta semana todavía.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default PagosProductores;
