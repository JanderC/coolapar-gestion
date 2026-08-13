import React, { useState } from 'react';
import { Nav } from 'react-bootstrap';
import Empleados from './Empleados';
import Compras from './Compras';
import Prestamos from './Prestamos';
import LibroCaja from './LibroCaja';

// Los tres sectores van separados a propósito: son plata que se mueve por
// motivos distintos y confundirlos sale caro. Sobre todo estos dos, que se
// parecen pero no son lo mismo:
//   - Adelanto (en Empleados): se descuenta solo del próximo sueldo.
//   - Préstamo (en Préstamos):  la persona lo va cancelando en abonos.
const SECTORES = [
  {
    clave: 'empleados',
    titulo: 'Empleados',
    descripcion: 'Sueldos, recibos y adelantos que se descuentan del pago.',
    Componente: Empleados,
  },
  {
    clave: 'compras',
    titulo: 'Compras',
    descripcion: 'Lo que se le paga a proveedores, más lo que entra por inventario.',
    Componente: Compras,
  },
  {
    clave: 'prestamos',
    titulo: 'Préstamos',
    descripcion: 'Plata prestada a empleados o productores. No se descuenta: se cobra por abonos.',
    Componente: Prestamos,
  },
  {
    clave: 'caja',
    titulo: 'Libro de caja',
    descripcion: 'Todo lo que entró y salió, junto, para cuadrar el período.',
    Componente: LibroCaja,
  },
];

const Nomina = () => {
  const [sector, setSector] = useState('empleados');
  const actual = SECTORES.find((s) => s.clave === sector) || SECTORES[0];
  const Vista = actual.Componente;

  return (
    <div>
      <div className="page-header mb-3">
        <h4 className="mb-1">Pagos y contabilidad</h4>
        <p className="text-muted mb-0">{actual.descripcion}</p>
      </div>

      <Nav variant="tabs" activeKey={sector} onSelect={(clave) => clave && setSector(clave)} className="mb-3">
        {SECTORES.map((s) => (
          <Nav.Item key={s.clave}>
            <Nav.Link eventKey={s.clave}>{s.titulo}</Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {/* La key fuerza que cada sector se monte limpio al cambiar de
          pestaña, así no arrastra datos del anterior. */}
      <Vista key={sector} />
    </div>
  );
};

export default Nomina;
