import React, { useState } from 'react';
import { Form, Spinner } from 'react-bootstrap';
import { useMoneda } from '../../context/MonedaContext';

// Muestra un selector de moneda global. Pensado para el navbar o una pantalla
// de configuracion, visible solo para el rol admin.
const SelectorMoneda = () => {
  const { moneda, monedasDisponibles, cambiarMoneda } = useMoneda();
  const [guardando, setGuardando] = useState(false);

  const handleCambio = async (e) => {
    const nuevaMoneda = e.target.value;
    setGuardando(true);
    try {
      await cambiarMoneda(nuevaMoneda);
    } catch (err) {
      alert(err.response?.data?.message || 'No se pudo cambiar la moneda.');
    } finally {
      setGuardando(false);
    }
  };

  const opciones = Object.keys(monedasDisponibles).length > 0
    ? monedasDisponibles
    : { BOB: { nombre: 'Bolívares' }, USD: { nombre: 'Dólares' }, COP: { nombre: 'Pesos colombianos' } };

  return (
    <Form.Group className="d-flex align-items-center gap-2">
      <Form.Label className="mb-0 text-nowrap">Moneda:</Form.Label>
      <Form.Select size="sm" value={moneda} onChange={handleCambio} disabled={guardando} style={{ width: 'auto' }}>
        {Object.entries(opciones).map(([codigo, info]) => (
          <option key={codigo} value={codigo}>
            {codigo} - {info.nombre}
          </option>
        ))}
      </Form.Select>
      {guardando && <Spinner animation="border" size="sm" />}
    </Form.Group>
  );
};

export default SelectorMoneda;
