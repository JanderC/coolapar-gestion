import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Alert, Spinner, Row, Col } from 'react-bootstrap';
import * as tasasApi from '../../api/tasas.api';

const valoresIniciales = { usd_a_cop: '', usd_a_bs: '', bs_a_cop: '' };

const Tasas = () => {
  const [form, setForm] = useState(valoresIniciales);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const { data } = await tasasApi.obtenerTasas();
      if (data) {
        setForm({
          usd_a_cop: data.usd_a_cop ?? '',
          usd_a_bs: data.usd_a_bs ?? '',
          bs_a_cop: data.bs_a_cop ?? '',
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudieron cargar las tasas.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const cambiar = (campo) => (e) => {
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');
    setGuardando(true);
    try {
      const { message } = await tasasApi.actualizarTasas({
        usd_a_cop: Number(form.usd_a_cop),
        usd_a_bs: Number(form.usd_a_bs),
        bs_a_cop: Number(form.bs_a_cop),
      });
      setExito(message || 'Tasas actualizadas.');
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudieron guardar las tasas.');
    } finally {
      setGuardando(false);
    }
  };

  // Vista previa en vivo, para que quede claro qué está configurando.
  const previa = (() => {
    const usdCop = Number(form.usd_a_cop);
    const usdBs = Number(form.usd_a_bs);
    const bsCop = Number(form.bs_a_cop);
    return {
      usdCop: usdCop > 0 ? `1 USD = ${usdCop.toLocaleString('es-CO')} COP` : null,
      usdBs: usdBs > 0 ? `1 USD = ${usdBs.toLocaleString('es-CO')} BS` : null,
      bsCop: bsCop > 0 ? `1.000 BS = ${(bsCop * 1000).toLocaleString('es-CO')} COP` : null,
    };
  })();

  if (cargando) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-3">Tasas de cambio</h4>
      <p className="text-muted">
        Configure aquí la tasa del día. Estas tasas se usan para calcular precios entre monedas al momento de vender.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}
      {exito && <Alert variant="success">{exito}</Alert>}

      <Card>
        <Card.Body>
          <Form onSubmit={guardar}>
            <Row className="g-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>1 USD equivale a (COP)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.usd_a_cop}
                    onChange={cambiar('usd_a_cop')}
                    placeholder="Ej: 3000"
                    required
                  />
                  {previa.usdCop && <Form.Text className="text-muted">{previa.usdCop}</Form.Text>}
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label>1 USD equivale a (BS)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.usd_a_bs}
                    onChange={cambiar('usd_a_bs')}
                    placeholder="Ej: 800"
                    required
                  />
                  {previa.usdBs && <Form.Text className="text-muted">{previa.usdBs}</Form.Text>}
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label>1 BS equivale a (COP)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.000001"
                    min="0"
                    value={form.bs_a_cop}
                    onChange={cambiar('bs_a_cop')}
                    placeholder="Ej: 3.2"
                    required
                  />
                  {previa.bsCop && <Form.Text className="text-muted">{previa.bsCop}</Form.Text>}
                </Form.Group>
              </Col>
            </Row>

            <div className="mt-4">
              <Button type="submit" variant="primary" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar tasas'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Tasas;
