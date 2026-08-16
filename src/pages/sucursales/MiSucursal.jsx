import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card, Nav } from 'react-bootstrap';
import * as ventasApi from '../../api/ventas.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { formatoCorto, hoy, vacio } from '../../utils/fechas';

const METODOS_PAGO = [
  { valor: '', etiqueta: 'Sin especificar' },
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
  { valor: 'pago_movil', etiqueta: 'Pago móvil' },
  { valor: 'credito', etiqueta: 'A crédito' },
];

// No es una lista cerrada: se puede escribir cualquier otra. Las
// sucursales venden mucho más que queso.
const MONEDAS = ['BS', 'USD', 'COP'];

const UNIDADES = [
  { valor: 'kg', etiqueta: 'kg — kilogramos' },
  { valor: 'g', etiqueta: 'g — gramos' },
  { valor: 'L', etiqueta: 'L — litros' },
  { valor: 'ml', etiqueta: 'ml — mililitros' },
  { valor: 'unidades', etiqueta: 'unidades' },
  { valor: 'paquetes', etiqueta: 'paquetes' },
  { valor: 'cajas', etiqueta: 'cajas' },
  { valor: 'bultos', etiqueta: 'bultos' },
  { valor: 'docenas', etiqueta: 'docenas' },
];

const CATEGORIAS_SUGERIDAS = ['De la planta', 'Víveres', 'Bebidas', 'Charcutería', 'Limpieza', 'Otros'];

let contador = 0;
const nuevoId = () => {
  contador += 1;
  return `linea-${contador}`;
};

const detalleError = (err) => {
  if (err?.response) return err.response.data?.message || `El servidor respondió ${err.response.status}.`;
  if (err?.request) return 'El servidor no respondió. Revise la conexión.';
  return err?.message || 'Error desconocido.';
};

const dinero = (valor, moneda = 'BS') =>
  `${Number(valor || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;

const MiSucursal = () => {
  const { usuario } = useAuth();
  const monedaSucursal = usuario?.sucursal?.moneda || 'BS';

  const [vista, setVista] = useState('recibir');
  const [porRecibir, setPorRecibir] = useState([]);
  const [inventario, setInventario] = useState({ productos: [], totales: { productos: 0, por_unidad: [] } });
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // ---- Recepción ----
  const [despacho, setDespacho] = useState(null);
  const [conteos, setConteos] = useState({});
  const [confirmando, setConfirmando] = useState(false);
  const [errorConteo, setErrorConteo] = useState('');

  // ---- Venta ----
  const [mostrarVenta, setMostrarVenta] = useState(false);
  const [lineas, setLineas] = useState([]);
  const [cliente, setCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [monedaVenta, setMonedaVenta] = useState(monedaSucursal);
  const [busquedaVenta, setBusquedaVenta] = useState('');
  const [avisoBusqueda, setAvisoBusqueda] = useState(null);
  const [pagaCon, setPagaCon] = useState('');
  const [ventaHecha, setVentaHecha] = useState(null);
  const buscadorRef = useRef(null);
  const [fechaVenta, setFechaVenta] = useState(hoy());
  const [guardandoVenta, setGuardandoVenta] = useState(false);
  const [errorVenta, setErrorVenta] = useState('');

  // ---- Cargar o corregir inventario a mano ----
  const [mostrarAjuste, setMostrarAjuste] = useState(false);
  const [ajuste, setAjuste] = useState({
    producto: '',
    categoria: '',
    unidad_medida: 'kg',
    precio_venta: '',
    moneda: '',
    codigo_barras: '',
    cantidad: '',
    suma: 'true',
    motivo: '',
  });
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const [errorAjuste, setErrorAjuste] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [respDespachos, respInv, respVentas] = await Promise.all([
        ventasApi.despachosPendientes(),
        ventasApi.inventarioSucursal(),
        ventasApi.listarVentas({ origen: 'sucursal' }),
      ]);
      setPorRecibir(respDespachos?.data || []);
      setInventario(respInv?.data || { productos: [], totales: { productos: 0, por_unidad: [] } });
      setVentas(respVentas?.data || []);
    } catch (err) {
      setError(`No se pudo cargar la información. ${detalleError(err)}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ---------- Recepción ----------
  const abrirRecepcion = (d) => {
    setDespacho(d);
    setConteos({});
    setErrorConteo('');
  };

  const confirmar = async () => {
    setErrorConteo('');

    const faltante = (despacho.items || []).find((i) => vacio(conteos[i.id]?.kilos));
    if (faltante) return setErrorConteo(`Falta anotar cuántos kilos de ${faltante.producto} recibió.`);

    setConfirmando(true);
    try {
      const respuesta = await ventasApi.confirmarRecepcion(
        despacho.id,
        (despacho.items || []).map((i) => ({
          item_id: i.id,
          kilos: Number(conteos[i.id].kilos),
          piezas: vacio(conteos[i.id]?.piezas) ? null : Number(conteos[i.id].piezas),
        }))
      );
      setDespacho(null);
      setAviso(respuesta?.message || 'Recepción confirmada.');
      await cargar();
    } catch (err) {
      setErrorConteo(detalleError(err));
    } finally {
      setConfirmando(false);
    }
  };

  // ---------- Venta ----------
  const disponibleDe = useCallback(
    (producto) => Number(inventario.productos.find((p) => p.producto === producto)?.cantidad || 0),
    [inventario]
  );

  const unidadDe = useCallback(
    (producto) => inventario.productos.find((p) => p.producto === producto)?.unidad_medida || 'u',
    [inventario]
  );

  /**
   * Al elegir el producto se propone su precio de catálogo, pero solo si
   * está en la misma moneda de la venta: proponer 5000 COP en una venta
   * en dólares sería cobrar de más sin que nadie lo note.
   */
  const elegirProducto = (idLinea, producto) => {
    const ficha = inventario.productos.find((p) => p.producto === producto);
    const mismaMoneda = ficha?.moneda ? ficha.moneda === monedaVenta : true;
    const tienePrecio = ficha?.precio_venta !== null && ficha?.precio_venta !== undefined;

    setLineas((prev) =>
      prev.map((l) =>
        l.id === idLinea
          ? {
              ...l,
              producto,
              precio_kilo: mismaMoneda && tienePrecio ? String(ficha.precio_venta) : '',
            }
          : l
      )
    );
  };

  /** Productos elegidos cuyo precio está en otra moneda que la venta. */
  const enOtraMoneda = useMemo(
    () =>
      lineas
        .filter((l) => l.producto)
        .map((l) => inventario.productos.find((p) => p.producto === l.producto))
        .filter((p) => p && p.moneda && p.moneda !== monedaVenta && p.precio_venta !== null),
    [lineas, inventario, monedaVenta]
  );

  const lineasSinExistencia = useMemo(
    () =>
      lineas.filter((l) => {
        if (vacio(l.producto) || vacio(l.kilos)) return false;
        return Number(l.kilos) > disponibleDe(l.producto);
      }),
    [lineas, disponibleDe]
  );

  const totalVenta = useMemo(
    () => lineas.reduce((s, l) => s + Number(l.kilos || 0) * Number(l.precio_kilo || 0), 0),
    [lineas]
  );

  // Agrupado por categoría: con víveres además del queso, una lista
  // plana de cuarenta renglones no se puede leer.
  // La ficha del producto que se está ajustando, si ya existe: de ahí
  // salen su unidad y su precio.
  const productoExistente = useMemo(
    () => inventario.productos.find((p) => p.producto === ajuste.producto) || null,
    [inventario, ajuste.producto]
  );

  const gruposInventario = useMemo(() => {
    const mapa = new Map();
    inventario.productos.forEach((p) => {
      const clave = p.categoria || 'Sin categoría';
      mapa.set(clave, [...(mapa.get(clave) || []), p]);
    });
    return [...mapa.entries()]
      .map(([categoria, lista]) => ({ categoria, lista }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria, 'es'));
  }, [inventario]);

  /**
   * Coincidencia por código de barras primero, después por nombre.
   * El código manda: un lector escribe el número exacto, y si hubiera un
   * producto cuyo nombre contiene esos dígitos, ganaría el equivocado.
   */
  const buscarProducto = useCallback(
    (texto) => {
      const busca = String(texto || '').trim().toLowerCase();
      if (!busca) return null;

      const conStock = inventario.productos.filter((p) => p.cantidad > 0);

      const porCodigo = conStock.find((p) => (p.codigo_barras || '').toLowerCase() === busca);
      if (porCodigo) return porCodigo;

      const exacto = conStock.find((p) => p.producto.toLowerCase() === busca);
      if (exacto) return exacto;

      const parciales = conStock.filter((p) => p.producto.toLowerCase().includes(busca));
      return parciales.length === 1 ? parciales[0] : null;
    },
    [inventario]
  );

  /** Coincidencias parciales, para mostrarlas mientras escribe. */
  const sugerencias = useMemo(() => {
    const busca = busquedaVenta.trim().toLowerCase();
    if (busca.length < 2) return [];

    const conStock = inventario.productos.filter((p) => p.cantidad > 0);
    const encontrados = conStock.filter(
      (p) => p.producto.toLowerCase().includes(busca) || (p.codigo_barras || '').toLowerCase().includes(busca)
    );
    // Una sola coincidencia ya se agrega con Enter: no hace falta listarla.
    return encontrados.length === 1 ? [] : encontrados.slice(0, 6);
  }, [busquedaVenta, inventario]);

  /**
   * Agrega el producto a la venta. Si ya estaba, le suma uno en vez de
   * repetir el renglón: al pasar el lector dos veces por lo mismo, lo
   * natural es que sean dos unidades.
   */
  const agregarProducto = (ficha) => {
    if (!ficha) return;

    const mismaMoneda = ficha.moneda ? ficha.moneda === monedaVenta : true;
    const precio = mismaMoneda && ficha.precio_venta !== null ? String(ficha.precio_venta) : '';

    setLineas((prev) => {
      const existente = prev.find((l) => l.producto === ficha.producto);
      if (existente) {
        return prev.map((l) =>
          l.id === existente.id ? { ...l, kilos: String(Number(l.kilos || 0) + 1) } : l
        );
      }
      return [...prev, { id: nuevoId(), producto: ficha.producto, kilos: '1', piezas: '', precio_kilo: precio }];
    });

    setBusquedaVenta('');
    setAvisoBusqueda(
      precio === '' && ficha.precio_venta !== null
        ? { texto: `${ficha.producto} tiene su precio en ${ficha.moneda}: escríbalo a mano.`, error: true }
        : { texto: `${ficha.producto} agregado.`, error: false }
    );
    // El foco vuelve al buscador para poder pasar el siguiente.
    buscadorRef.current?.focus();
  };

  const agregarPorBusqueda = () => {
    const ficha = buscarProducto(busquedaVenta);
    if (ficha) return agregarProducto(ficha);

    setAvisoBusqueda({
      texto: sugerencias.length > 0
        ? 'Hay varios que coinciden: elija uno de la lista.'
        : `No se encontró «${busquedaVenta.trim()}» con existencia.`,
      error: sugerencias.length === 0,
    });
  };

  /** Vuelto. Negativo significa que lo entregado no alcanza. */
  const vuelto = useMemo(() => {
    if (vacio(pagaCon)) return null;
    return Number((Number(pagaCon) - totalVenta).toFixed(2));
  }, [pagaCon, totalVenta]);

  /**
   * Billetes que se ofrecen de atajo: los redondos por encima del total.
   * Se calculan sobre el monto para que sirvan igual en bolívares que en
   * pesos, donde los órdenes de magnitud no se parecen en nada.
   */
  const billetesSugeridos = useMemo(() => {
    if (totalVenta <= 0) return [];
    const escalas = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
    return escalas.filter((b) => b >= totalVenta).slice(0, 4);
  }, [totalVenta]);

  const imprimirRecibo = () => {
    if (!ventaHecha) return;

    const filas = ventaHecha.lineas
      .map(
        (l) => `<tr>
            <td>${l.producto}<br /><small>${l.cantidad} ${l.unidad} x ${dinero(l.precio, ventaHecha.moneda)}</small></td>
            <td class="num">${dinero(l.subtotal, ventaHecha.moneda)}</td>
          </tr>`
      )
      .join('');

    // Ancho de rollo de 80 mm, que es lo que usan las impresoras de punto
    // de venta.
    const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>Recibo</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; margin: 0; }
  h1 { font-size: 15px; margin: 0 0 2px; text-align: center; }
  .sub { text-align: center; color: #555; font-size: 11px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 3px 0; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  tfoot th { border-top: 1px dashed #000; font-size: 14px; }
  .pago { margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; }
  .pie { text-align: center; margin-top: 12px; font-size: 10px; color: #555; }
</style></head>
<body>
  <h1>COOLAPAR</h1>
  <div class="sub">${usuario?.sucursal?.nombre || ''}<br />${formatoCorto(ventaHecha.fecha)}${ventaHecha.id ? ` · Venta #${ventaHecha.id}` : ''}</div>
  <table>
    <tbody>${filas}</tbody>
    <tfoot><tr><th>TOTAL</th><th class="num">${dinero(ventaHecha.total, ventaHecha.moneda)}</th></tr></tfoot>
  </table>
  ${
    ventaHecha.pagaCon !== null
      ? `<div class="pago">
           <table>
             <tr><td>Pagó con</td><td class="num">${dinero(ventaHecha.pagaCon, ventaHecha.moneda)}</td></tr>
             <tr><td><strong>Vuelto</strong></td><td class="num"><strong>${dinero(ventaHecha.vuelto, ventaHecha.moneda)}</strong></td></tr>
           </table>
         </div>`
      : ''
  }
  <div class="pie">Gracias por su compra</div>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 200);
    };
    iframe.srcdoc = html;
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 8000);
  };

  const abrirVenta = () => {
    // Arranca vacía: los renglones entran por el buscador.
    setLineas([]);
    setBusquedaVenta('');
    setAvisoBusqueda(null);
    setPagaCon('');
    setCliente('');
    setMetodoPago('');
    setMonedaVenta(monedaSucursal);
    setFechaVenta(hoy());
    setErrorVenta('');
    setMostrarVenta(true);
  };

  const cambiarLinea = (id, campo, valor) =>
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));

  const guardarVenta = async (ev) => {
    if (ev?.preventDefault) ev.preventDefault();
    setErrorVenta('');

    const items = lineas
      .filter((l) => !vacio(l.producto) && !vacio(l.kilos) && Number(l.kilos) > 0)
      .map((l) => ({
        producto: l.producto,
        kilos: Number(l.kilos),
        piezas: vacio(l.piezas) ? null : Number(l.piezas),
        precio_kilo: vacio(l.precio_kilo) ? 0 : Number(l.precio_kilo),
      }));

    if (items.length === 0) return setErrorVenta('Agregue al menos un producto.');
    if (lineasSinExistencia.length > 0) return setErrorVenta('No hay suficiente producto. Revise las líneas en rojo.');

    if (items.some((i) => i.precio_kilo <= 0)) {
      return setErrorVenta('Falta el precio de algún producto.');
    }

    setGuardandoVenta(true);
    try {
      const respuesta = await ventasApi.venderDesdeSucursal({
        fecha: fechaVenta,
        cliente_nombre: vacio(cliente) ? null : cliente.trim(),
        moneda: monedaVenta,
        metodo_pago: metodoPago || null,
        items,
      });

      // Se arma el detalle con lo que se cobró, no con lo que devuelve el
      // servidor: el vuelto es de esta pantalla y no se guarda.
      setVentaHecha({
        id: respuesta?.data?.id || null,
        fecha: fechaVenta,
        cliente: vacio(cliente) ? null : cliente.trim(),
        moneda: monedaVenta,
        lineas: items.map((i) => ({
          producto: i.producto,
          cantidad: i.kilos,
          unidad: unidadDe(i.producto),
          precio: i.precio_kilo,
          subtotal: Number((i.kilos * i.precio_kilo).toFixed(2)),
        })),
        total: Number(totalVenta.toFixed(2)),
        pagaCon: vacio(pagaCon) ? null : Number(pagaCon),
        vuelto: vacio(pagaCon) ? null : Number((Number(pagaCon) - totalVenta).toFixed(2)),
      });

      setMostrarVenta(false);
      await cargar();
    } catch (err) {
      setErrorVenta(`No se pudo registrar. ${detalleError(err)}`);
    } finally {
      setGuardandoVenta(false);
    }
  };

  const abrirAjuste = (producto = '') => {
    const existente = inventario.productos.find((p) => p.producto === producto);
    setAjuste({
      producto,
      categoria: existente?.categoria && existente.categoria !== 'Sin categoría' ? existente.categoria : '',
      // La unidad de un producto que ya existe no se toca: mezclar kilos
      // y litros del mismo producto haría que la suma no signifique nada.
      unidad_medida: existente?.unidad_medida || 'kg',
      precio_venta: existente?.precio_venta ?? '',
      moneda: existente?.moneda || monedaSucursal,
      codigo_barras: existente?.codigo_barras || '',
      cantidad: '',
      suma: 'true',
      motivo: '',
    });
    setErrorAjuste('');
    setMostrarAjuste(true);
  };

  const guardarAjuste = async (ev) => {
    ev.preventDefault();
    setErrorAjuste('');
    if (!ajuste.producto.trim()) return setErrorAjuste('Escriba qué producto es.');
    if (vacio(ajuste.cantidad) || Number(ajuste.cantidad) <= 0) {
      return setErrorAjuste(`Indique cuántos ${ajuste.unidad_medida}.`);
    }

    setGuardandoAjuste(true);
    try {
      const respuesta = await ventasApi.ajustarInventarioSucursal({
        producto: ajuste.producto.trim(),
        categoria: vacio(ajuste.categoria) ? null : ajuste.categoria.trim(),
        unidad_medida: ajuste.unidad_medida,
        precio_venta: vacio(ajuste.precio_venta) ? null : Number(ajuste.precio_venta),
        moneda: ajuste.moneda || monedaSucursal,
        codigo_barras: vacio(ajuste.codigo_barras) ? null : ajuste.codigo_barras.trim(),
        kilos: Number(ajuste.cantidad),
        suma: ajuste.suma === 'true',
        motivo: vacio(ajuste.motivo) ? null : ajuste.motivo.trim(),
      });
      setMostrarAjuste(false);
      setAviso(respuesta?.message || 'Inventario actualizado.');
      await cargar();
    } catch (err) {
      setErrorAjuste(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardandoAjuste(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando..." />;

  return (
    <div>
      <div className="page-header mb-3">
        <h4 className="mb-1">{usuario?.sucursal?.nombre || 'Mi sucursal'}</h4>
        <p className="text-muted mb-0">
          Lo que llega de la planta y todo lo demás que se vende aquí. Al recibir un despacho, cuente el producto y
          anote lo que contó.
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

      <Nav variant="tabs" activeKey={vista} onSelect={(k) => k && setVista(k)} className="mb-3">
        <Nav.Item>
          <Nav.Link eventKey="recibir">
            Por recibir
            {porRecibir.length > 0 && (
              <Badge bg="danger" className="ms-2">
                {porRecibir.length}
              </Badge>
            )}
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="inventario">Mi inventario</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="ventas">Mis ventas</Nav.Link>
        </Nav.Item>
      </Nav>

      {/* ---------- POR RECIBIR ---------- */}
      {vista === 'recibir' && (
        <Card>
          <Card.Header>
            <strong>Despachos que llegaron</strong>
            <div className="text-muted small">
              Cuente el producto y anote lo que contó. No verá cuánto se despachó hasta terminar: así el conteo sirve
              de verdad.
            </div>
          </Card.Header>
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Qué llegó</th>
                <th className="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              {porRecibir.map((d) => (
                <tr key={d.id}>
                  <td>
                    {formatoCorto(d.fecha)}
                    <div className="text-muted small">Despacho #{d.id}</div>
                  </td>
                  <td>
                    {(d.items || []).map((i) => (
                      <div key={i.id} className="fw-semibold">
                        {i.producto}
                      </div>
                    ))}
                    {d.notas && <div className="text-muted small">{d.notas}</div>}
                  </td>
                  <td className="text-end">
                    <Button size="sm" variant="success" onClick={() => abrirRecepcion(d)}>
                      Contar y confirmar
                    </Button>
                  </td>
                </tr>
              ))}
              {porRecibir.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-4">
                    No hay despachos por recibir.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ---------- INVENTARIO ---------- */}
      {vista === 'inventario' && (
        <Card>
          <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <strong>Lo que hay para vender</strong>
              <div className="text-muted small">
                {inventario.totales.productos} producto(s) con existencia
                {(inventario.totales.por_unidad || []).length > 0 && (
                  <> · {inventario.totales.por_unidad.map((u) => `${u.total} ${u.unidad}`).join(' · ')}</>
                )}
              </div>
            </div>
            <div className="d-flex gap-2">
              <Button variant="outline-success" size="sm" onClick={() => abrirAjuste()}>
                Cargar o corregir
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={abrirVenta}
                disabled={inventario.productos.filter((p) => p.cantidad > 0).length === 0}
              >
                Registrar venta
              </Button>
            </div>
          </Card.Header>
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-end">Cantidad</th>
                <th className="text-end">Precio</th>
                <th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {gruposInventario.map((grupo) => (
                <React.Fragment key={grupo.categoria}>
                  {gruposInventario.length > 1 && (
                    <tr className="table-light">
                      <td colSpan={4} className="fw-semibold small text-uppercase text-muted">
                        {grupo.categoria}
                      </td>
                    </tr>
                  )}
                  {grupo.lista.map((p) => (
                    <tr key={p.producto} className={p.cantidad <= 0 ? 'text-muted' : undefined}>
                      <td className={p.cantidad > 0 ? 'fw-semibold' : undefined}>{p.producto}</td>
                      <td className="text-end fw-semibold">
                        {p.cantidad} <span className="fw-normal text-muted">{p.unidad_medida}</span>
                      </td>
                      <td className="text-end text-muted">
                        {p.precio_venta === null
                          ? '—'
                          : `${dinero(p.precio_venta, p.moneda || monedaSucursal)} / ${p.unidad_medida}`}
                      </td>
                      <td className="text-end">
                        <Button size="sm" variant="outline-secondary" onClick={() => abrirAjuste(p.producto)}>
                          Corregir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {inventario.productos.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-4">
                    No hay producto. Confirme un despacho, o cárguelo a mano con «Cargar o corregir».
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ---------- VENTAS ---------- */}
      {vista === 'ventas' && (
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <strong>Ventas de la sucursal</strong>
            <Button variant="success" size="sm" onClick={abrirVenta} disabled={inventario.productos.filter((p) => p.cantidad > 0).length === 0}>
              Registrar venta
            </Button>
          </Card.Header>
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Productos</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td>{formatoCorto(v.fecha)}</td>
                  <td>{v.cliente_nombre || 'Mostrador'}</td>
                  <td className="small text-muted">
                    {(v.items || v.Items || []).map((i) => (
                      <div key={i.id}>
                        {i.producto}: {i.kilos_enviados ?? i.kilos} kg
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
              {ventas.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-4">
                    Todavía no hay ventas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ---------- Modal: contar el despacho ---------- */}
      <Modal show={Boolean(despacho)} onHide={() => setDespacho(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Despacho #{despacho?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errorConteo && <Alert variant="danger">{errorConteo}</Alert>}

          <Alert variant="light" className="border py-2 small">
            Pese el producto y anote lo que contó. <strong>No se le muestra cuánto se despachó</strong>: de eso se
            trata el control. Si no coincide, el administrador lo revisará con usted.
          </Alert>

          {(despacho?.items || []).map((i) => (
            <div key={i.id} className="mb-3">
              <Form.Label className="fw-semibold">{i.producto}</Form.Label>
              <div className="d-flex gap-2">
                <InputGroup>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.001"
                    value={conteos[i.id]?.kilos || ''}
                    onChange={(e) =>
                      setConteos({ ...conteos, [i.id]: { ...conteos[i.id], kilos: e.target.value } })
                    }
                    placeholder="Kilos que contó"
                  />
                  <InputGroup.Text>kg</InputGroup.Text>
                </InputGroup>
                <Form.Control
                  type="number"
                  min="0"
                  value={conteos[i.id]?.piezas || ''}
                  onChange={(e) => setConteos({ ...conteos, [i.id]: { ...conteos[i.id], piezas: e.target.value } })}
                  placeholder="Piezas"
                  style={{ maxWidth: 120 }}
                />
              </div>
            </div>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setDespacho(null)}>
            Cancelar
          </Button>
          <Button variant="success" onClick={confirmar} disabled={confirmando}>
            {confirmando ? 'Confirmando...' : 'Confirmar recepción'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ---------- Modal: cargar o corregir inventario ---------- */}
      <Modal show={mostrarAjuste} onHide={() => setMostrarAjuste(false)} centered>
        <Form onSubmit={guardarAjuste}>
          <Modal.Header closeButton>
            <Modal.Title>Cargar o corregir inventario</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorAjuste && <Alert variant="danger">{errorAjuste}</Alert>}

            <p className="text-muted small">
              Para el producto que ya tenía antes de usar el sistema, o para cuadrar contra un conteo físico. Queda
              anotado como ajuste, separado de lo que llega por despacho.
            </p>

            <Form.Group className="mb-3">
              <Form.Label>¿Qué se hace?</Form.Label>
              <Form.Select value={ajuste.suma} onChange={(e) => setAjuste({ ...ajuste, suma: e.target.value })}>
                <option value="true">Cargar producto que hay</option>
                <option value="false">Quitar producto que ya no está</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Producto</Form.Label>
              <Form.Control
                autoFocus
                list="productos-sucursal"
                value={ajuste.producto}
                onChange={(e) => setAjuste({ ...ajuste, producto: e.target.value })}
                placeholder="Semiduro, arroz, refresco..."
              />
              <datalist id="productos-sucursal">
                {inventario.productos.map((p) => (
                  <option key={p.producto} value={p.producto} />
                ))}
              </datalist>
              {ajuste.producto && productoExistente && (
                <Form.Text className="text-muted">
                  Ahora hay {productoExistente.cantidad} {productoExistente.unidad_medida}.
                </Form.Text>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Código de barras (opcional)</Form.Label>
              <Form.Control
                value={ajuste.codigo_barras}
                onChange={(e) => setAjuste({ ...ajuste, codigo_barras: e.target.value })}
                placeholder="Pase el lector por el empaque"
              />
              <Form.Text className="text-muted">
                Con código, el lector lo encuentra de una al vender. Sin código, se busca por nombre.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>¿En qué se mide?</Form.Label>
              <Form.Select
                value={ajuste.unidad_medida}
                disabled={Boolean(productoExistente)}
                onChange={(e) => setAjuste({ ...ajuste, unidad_medida: e.target.value })}
              >
                {UNIDADES.map((u) => (
                  <option key={u.valor} value={u.valor}>
                    {u.etiqueta}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {productoExistente
                  ? `${ajuste.producto} ya se lleva en ${ajuste.unidad_medida}. Para cambiarlo, déjelo primero en cero.`
                  : 'La harina va en kilos, el aceite en litros, los refrescos por unidad. Se elige una vez.'}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Precio de venta (opcional)</Form.Label>
              <InputGroup>
                <Form.Select
                  value={ajuste.moneda || monedaSucursal}
                  onChange={(e) => setAjuste({ ...ajuste, moneda: e.target.value })}
                  style={{ maxWidth: 110 }}
                >
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={ajuste.precio_venta}
                  onChange={(e) => setAjuste({ ...ajuste, precio_venta: e.target.value })}
                  placeholder="0.00"
                />
                <InputGroup.Text>por {ajuste.unidad_medida}</InputGroup.Text>
              </InputGroup>
              <Form.Text className="text-muted">
                Cada producto puede tener su moneda: el aceite importado en dólares y la harina en pesos. Viene
                propuesto al vender; si ese día se cobra distinto, se cambia en la venta.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Categoría (opcional)</Form.Label>
              <Form.Control
                list="categorias-sucursal"
                value={ajuste.categoria}
                onChange={(e) => setAjuste({ ...ajuste, categoria: e.target.value })}
                placeholder="Víveres, bebidas..."
              />
              <datalist id="categorias-sucursal">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <Form.Text className="text-muted">Solo sirve para agrupar el inventario.</Form.Text>
            </Form.Group>

            <div className="row g-3">
              <div className="col-sm-6">
                <Form.Label>Cantidad</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.001"
                    value={ajuste.cantidad}
                    onChange={(e) => setAjuste({ ...ajuste, cantidad: e.target.value })}
                  />
                  <InputGroup.Text>{ajuste.unidad_medida}</InputGroup.Text>
                </InputGroup>
              </div>
              <div className="col-12">
                <Form.Label>Motivo</Form.Label>
                <Form.Control
                  value={ajuste.motivo}
                  onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })}
                  placeholder="Conteo físico, producto que ya estaba, se dañó..."
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarAjuste(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoAjuste}>
              {guardandoAjuste ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- Modal: punto de venta ---------- */}
      <Modal show={mostrarVenta} onHide={() => setMostrarVenta(false)} centered size="lg" backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Registrar venta</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errorVenta && <Alert variant="danger">{errorVenta}</Alert>}

          {/* Buscador: es lo primero, con el foco puesto. Un lector de
              código de barras escribe y manda Enter, así que funciona
              solo, sin tocar nada. */}
          <InputGroup size="lg" className="mb-2">
            <InputGroup.Text>🔎</InputGroup.Text>
            <Form.Control
              ref={buscadorRef}
              autoFocus
              value={busquedaVenta}
              onChange={(e) => setBusquedaVenta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  agregarPorBusqueda();
                }
              }}
              placeholder="Pase el lector o escriba el nombre..."
            />
            <Button variant="success" onClick={agregarPorBusqueda} disabled={!busquedaVenta.trim()}>
              Agregar
            </Button>
          </InputGroup>

          {avisoBusqueda && (
            <div className={`small mb-2 ${avisoBusqueda.error ? 'text-danger' : 'text-muted'}`}>
              {avisoBusqueda.texto}
            </div>
          )}

          {/* Sugerencias mientras escribe el nombre */}
          {sugerencias.length > 0 && (
            <div className="border rounded mb-3">
              {sugerencias.map((p) => (
                <button
                  key={p.producto}
                  type="button"
                  className="btn btn-link text-start w-100 text-decoration-none border-0 py-2 px-3"
                  onClick={() => agregarProducto(p)}
                >
                  <div className="d-flex justify-content-between">
                    <span>
                      <strong>{p.producto}</strong>
                      {p.codigo_barras && <span className="text-muted small ms-2">{p.codigo_barras}</span>}
                    </span>
                    <span className="text-muted small">
                      {p.cantidad} {p.unidad_medida}
                      {p.precio_venta !== null && ` · ${dinero(p.precio_venta, p.moneda || monedaVenta)}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ---- Lo que va en la venta ---- */}
          {lineas.length === 0 ? (
            <Alert variant="light" className="border text-muted text-center py-4">
              Todavía no hay nada en esta venta. Busque el producto arriba.
            </Alert>
          ) : (
            <Table size="sm" className="align-middle mb-3">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="text-center" style={{ width: 150 }}>
                    Cantidad
                  </th>
                  <th className="text-end" style={{ width: 130 }}>
                    Precio
                  </th>
                  <th className="text-end" style={{ width: 120 }}>
                    Subtotal
                  </th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => {
                  const disponible = disponibleDe(l.producto);
                  const excede = !vacio(l.kilos) && Number(l.kilos) > disponible;
                  const subtotal = Number(l.kilos || 0) * Number(l.precio_kilo || 0);
                  return (
                    <tr key={l.id}>
                      <td>
                        <div className="fw-semibold">{l.producto}</div>
                        <div className="text-muted small">
                          quedan {disponible} {unidadDe(l.producto)}
                        </div>
                        {excede && (
                          <div className="text-danger small">No alcanza: hay {disponible}.</div>
                        )}
                      </td>
                      <td>
                        <InputGroup size="sm">
                          <Form.Control
                            type="number"
                            min="0"
                            step="0.001"
                            value={l.kilos}
                            isInvalid={excede}
                            onChange={(e) => cambiarLinea(l.id, 'kilos', e.target.value)}
                          />
                          <InputGroup.Text>{unidadDe(l.producto)}</InputGroup.Text>
                        </InputGroup>
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.precio_kilo}
                          onChange={(e) => cambiarLinea(l.id, 'precio_kilo', e.target.value)}
                          className="text-end"
                        />
                      </td>
                      <td className="text-end fw-semibold">{dinero(subtotal, monedaVenta)}</td>
                      <td className="text-end">
                        <Button
                          size="sm"
                          variant="link"
                          className="text-danger p-0"
                          onClick={() => setLineas((prev) => prev.filter((x) => x.id !== l.id))}
                        >
                          ✕
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {enOtraMoneda.length > 0 && (
            <Alert variant="warning" className="py-2 small">
              {enOtraMoneda.map((p) => `${p.producto} está en ${p.moneda}`).join(', ')}. La venta va en{' '}
              {monedaVenta}, así que hay que escribir el precio a mano: el sistema no convierte monedas.
            </Alert>
          )}

          {/* ---- Total y vuelto ---- */}
          <div className="bg-light rounded p-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="fs-5">Total a cobrar</span>
              <span className="fs-3 fw-semibold">{dinero(totalVenta, monedaVenta)}</span>
            </div>

            <div className="row g-3">
              <div className="col-sm-6">
                <Form.Label className="small text-muted mb-1">¿Con cuánto paga? (opcional)</Form.Label>
                <InputGroup>
                  <InputGroup.Text>{monedaVenta}</InputGroup.Text>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.01"
                    value={pagaCon}
                    onChange={(e) => setPagaCon(e.target.value)}
                    placeholder="0.00"
                  />
                </InputGroup>
                {/* Billetes de uso corriente: un toque y listo. */}
                <div className="d-flex flex-wrap gap-1 mt-2">
                  {billetesSugeridos.map((b) => (
                    <Button
                      key={b}
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => setPagaCon(String(b))}
                    >
                      {b.toLocaleString('es-VE')}
                    </Button>
                  ))}
                  {totalVenta > 0 && (
                    <Button size="sm" variant="outline-success" onClick={() => setPagaCon(String(totalVenta))}>
                      Justo
                    </Button>
                  )}
                </div>
              </div>

              <div className="col-sm-6 d-flex align-items-center">
                {vuelto !== null && (
                  <div className={`w-100 text-end ${vuelto < 0 ? 'text-danger' : ''}`}>
                    <div className="small text-muted">{vuelto < 0 ? 'Falta por pagar' : 'Vuelto a entregar'}</div>
                    <div className="fs-2 fw-semibold lh-1">{dinero(Math.abs(vuelto), monedaVenta)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="row g-3 mt-1">
            <div className="col-sm-4">
              <Form.Label className="small text-muted mb-1">Fecha</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                value={fechaVenta}
                onChange={(e) => setFechaVenta(e.target.value)}
              />
            </div>
            <div className="col-sm-4">
              <Form.Label className="small text-muted mb-1">Cliente (opcional)</Form.Label>
              <Form.Control
                size="sm"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Mostrador"
              />
            </div>
            <div className="col-sm-2">
              <Form.Label className="small text-muted mb-1">Paga con</Form.Label>
              <Form.Select size="sm" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                {METODOS_PAGO.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </Form.Select>
            </div>
            <div className="col-sm-2">
              <Form.Label className="small text-muted mb-1">Moneda</Form.Label>
              <Form.Select size="sm" value={monedaVenta} onChange={(e) => setMonedaVenta(e.target.value)}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setMostrarVenta(false)}>
            Cancelar
          </Button>
          <Button variant="success" size="lg" onClick={guardarVenta} disabled={guardandoVenta || lineas.length === 0}>
            {guardandoVenta ? 'Registrando...' : `Cobrar ${dinero(totalVenta, monedaVenta)}`}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ---------- Modal: detalle de la venta hecha ---------- */}
      <Modal show={Boolean(ventaHecha)} onHide={() => setVentaHecha(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Venta registrada</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {ventaHecha && (
            <>
              <div className="text-muted small mb-3">
                {formatoCorto(ventaHecha.fecha)} · {ventaHecha.cliente || 'Mostrador'}
                {ventaHecha.id && ` · Venta #${ventaHecha.id}`}
              </div>

              <Table size="sm" className="mb-3">
                <tbody>
                  {ventaHecha.lineas.map((l, indice) => (
                    <tr key={`${l.producto}-${indice}`}>
                      <td className="ps-0">
                        {l.producto}
                        <div className="text-muted small">
                          {l.cantidad} {l.unidad} × {dinero(l.precio, ventaHecha.moneda)}
                        </div>
                      </td>
                      <td className="pe-0 text-end fw-semibold">{dinero(l.subtotal, ventaHecha.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th className="ps-0">Total</th>
                    <th className="pe-0 text-end fs-5">{dinero(ventaHecha.total, ventaHecha.moneda)}</th>
                  </tr>
                </tfoot>
              </Table>

              {ventaHecha.pagaCon !== null && (
                <div className="bg-light rounded p-3">
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Pagó con</span>
                    <span>{dinero(ventaHecha.pagaCon, ventaHecha.moneda)}</span>
                  </div>
                  <div className="d-flex justify-content-between fs-5 mt-1">
                    <strong>Vuelto</strong>
                    <strong className="text-success">{dinero(ventaHecha.vuelto, ventaHecha.moneda)}</strong>
                  </div>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={imprimirRecibo}>
            Imprimir recibo
          </Button>
          <Button
            variant="success"
            onClick={() => {
              setVentaHecha(null);
              abrirVenta();
            }}
          >
            Otra venta
          </Button>
          <Button variant="light" onClick={() => setVentaHecha(null)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MiSucursal;