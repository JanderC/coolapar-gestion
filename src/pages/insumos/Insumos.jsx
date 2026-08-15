import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card } from 'react-bootstrap';
import * as insumosApi from '../../api/insumos.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';
import { aNumero, desempacar, formatoCorto, hoy, vacio } from '../../utils/fechas';

const OPCIONES_MONEDA = [
  { codigo: 'BS', etiqueta: 'Bs. — Bolívares' },
  { codigo: 'USD', etiqueta: '$ — Dólares' },
  { codigo: 'COP', etiqueta: 'COL$ — Pesos colombianos' },
];

// Lista cerrada, igual que en el backend. Si la gente escribe la unidad a
// mano, el mismo producto termina con "Kg", "kilos" y "KILOS", y entonces
// el inventario ya no se puede sumar ni comparar.
const UNIDADES = [
  { codigo: 'kg', etiqueta: 'kg — kilogramos' },
  { codigo: 'g', etiqueta: 'g — gramos' },
  { codigo: 'L', etiqueta: 'L — litros' },
  { codigo: 'ml', etiqueta: 'ml — mililitros' },
  { codigo: 'unidades', etiqueta: 'unidades — piezas sueltas' },
  { codigo: 'sacos', etiqueta: 'sacos' },
  { codigo: 'cajas', etiqueta: 'cajas' },
  { codigo: 'bolsas', etiqueta: 'bolsas' },
  { codigo: 'rollos', etiqueta: 'rollos' },
  { codigo: 'pares', etiqueta: 'pares' },
  { codigo: 'm', etiqueta: 'm — metros' },
  { codigo: 'cm', etiqueta: 'cm — centímetros' },
];

const formInsumoVacio = {
  nombre: '',
  unidad_medida: '',
  // Lo que ya hay en el depósito al dar de alta el producto. Se carga
  // como ajuste, no como compra: no hay factura que respalde eso.
  cantidad_inicial: '',
  precio_unitario_referencia: '',
  moneda_referencia: 'BS',
  stock_minimo: '',
  proveedor: '',
};

const formMovimientoVacio = {
  tipo: 'entrada',
  // Una entrada puede ser una compra (con factura y precio) o una carga
  // inicial / ajuste (lo que ya estaba en el depósito, sin precio).
  es_ajuste: false,
  cantidad: '',
  precio_unitario: '',
  moneda: 'BS',
  fecha: hoy(),
  descripcion: '',
};

/** Un producto está en alerta cuando su stock ya cayó al mínimo o por
 *  debajo. El mínimo es opcional: sin mínimo, nunca hay alerta. */
const stockBajo = (i) =>
  i.stock_minimo !== null && i.stock_minimo !== undefined && aNumero(i.stock_actual) <= aNumero(i.stock_minimo);

/** Cantidad + unidad, para no repetir la concatenación en toda la pantalla. */
const conUnidad = (cantidad, unidad) => `${aNumero(cantidad, 0)} ${unidad || ''}`.trim();

/** Primer día del mes de la fecha dada. */
const inicioDeMes = (texto) => `${String(texto).slice(0, 7)}-01`;

const detalleError = (err) => {
  if (err?.response) return err.response.data?.message || `El servidor respondió ${err.response.status}.`;
  if (err?.request) return 'El servidor no respondió. Revise la conexión.';
  return err?.message || 'Error desconocido.';
};

/** Tarjeta grande de un número: se usa para los tres tipos de leche. */
const TarjetaLeche = ({ titulo, cantidad, unidad, pie }) => (
  <Card className="flex-grow-1" style={{ minWidth: 200 }}>
    <Card.Body className="py-3">
      <div className="text-muted small text-uppercase">{titulo}</div>
      <div className="fs-3 fw-semibold lh-1 mt-1">
        {aNumero(cantidad, 0)} <span className="fs-6 text-muted fw-normal">{unidad}</span>
      </div>
      {pie && <div className="text-muted small mt-1">{pie}</div>}
    </Card.Body>
  </Card>
);

const Insumos = () => {
  const { formatearMontoEnMoneda } = useMoneda();

  const [insumos, setInsumos] = useState([]);
  const [leche, setLeche] = useState(null);
  const [avisoLeche, setAvisoLeche] = useState('');

  // ===== SOLO PRUEBAS — quitar al arrancar en producción =====
  const [mostrarDescuento, setMostrarDescuento] = useState(false);
  const [litrosQuitar, setLitrosQuitar] = useState('');
  const [tipoQuitar, setTipoQuitar] = useState('todos');
  const [ajustando, setAjustando] = useState(false);
  // ===== fin bloque de pruebas =====
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // Rango de la leche: por defecto, el mes en curso.
  const [desde, setDesde] = useState(() => inicioDeMes(hoy()));
  const [hasta, setHasta] = useState(() => hoy());

  // ---------- Catálogo de productos ----------
  const [busqueda, setBusqueda] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [mostrarModalInsumo, setMostrarModalInsumo] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formInsumo, setFormInsumo] = useState(formInsumoVacio);
  const [guardandoInsumo, setGuardandoInsumo] = useState(false);
  const [errorFormInsumo, setErrorFormInsumo] = useState('');

  // ---------- Entradas y salidas del producto elegido ----------
  const [insumoId, setInsumoId] = useState('');
  const [movimientos, setMovimientos] = useState([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [mostrarModalMovimiento, setMostrarModalMovimiento] = useState(false);
  const [formMovimiento, setFormMovimiento] = useState(formMovimientoVacio);
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);
  const [errorFormMovimiento, setErrorFormMovimiento] = useState('');
  const [anulando, setAnulando] = useState(false);

  const insumo = useMemo(() => insumos.find((i) => String(i.id) === String(insumoId)) || null, [insumos, insumoId]);

  const cargarTodo = useCallback(
    async (rangoDesde = desde, rangoHasta = hasta) => {
      setError('');
      try {
        // El endpoint nuevo trae leche + productos de una sola vez. Si
        // todavía no está en el archivo de api, se cae al listado de
        // siempre para que la pantalla siga sirviendo.
        if (typeof insumosApi.resumenInventario === 'function') {
          const datos = desempacar(
            await insumosApi.resumenInventario({ fecha_inicio: rangoDesde, fecha_fin: rangoHasta })
          );
          setInsumos(datos.insumos || []);
          setLeche(datos.leche || null);
          setAvisoLeche('');
        } else {
          setInsumos(desempacar(await insumosApi.listarInsumos()) || []);
          setLeche(null);
          setAvisoLeche(
            "Falta agregar resumenInventario() en src/api/insumos.api.js: export const resumenInventario = (params) => axiosClient.get('/insumos/resumen', { params }).then((r) => r.data);"
          );
        }
      } catch (err) {
        setError(`No se pudo cargar el inventario. ${detalleError(err)}`);
      } finally {
        setCargando(false);
      }
    },
    [desde, hasta]
  );

  useEffect(() => {
    cargarTodo();
    // Solo en la primera carga: después se refresca a mano o al guardar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarMovimientos = useCallback(async () => {
    if (!insumoId) {
      setMovimientos([]);
      return;
    }
    setCargandoMovimientos(true);
    setError('');
    try {
      setMovimientos(desempacar(await insumosApi.listarMovimientos(insumoId)) || []);
    } catch (err) {
      setError(`No se pudieron cargar las entradas y salidas. ${detalleError(err)}`);
    } finally {
      setCargandoMovimientos(false);
    }
  }, [insumoId]);

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  const insumosVisibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return insumos.filter((i) => {
      if (!verInactivos && !i.activo) return false;
      if (texto && !i.nombre.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [insumos, busqueda, verInactivos]);

  const enAlerta = useMemo(() => insumos.filter((i) => i.activo && stockBajo(i)), [insumos]);

  // ---------- Alta y edición de productos ----------
  const abrirNuevoInsumo = () => {
    setEditandoId(null);
    setFormInsumo(formInsumoVacio);
    setErrorFormInsumo('');
    setMostrarModalInsumo(true);
  };

  const abrirEditarInsumo = (i) => {
    setEditandoId(i.id);
    setFormInsumo({
      nombre: i.nombre || '',
      unidad_medida: i.unidad_medida || '',
      cantidad_inicial: '',
      precio_unitario_referencia: i.precio_unitario_referencia ?? '',
      moneda_referencia: i.moneda_referencia || 'BS',
      stock_minimo: i.stock_minimo ?? '',
      proveedor: i.proveedor || '',
    });
    setErrorFormInsumo('');
    setMostrarModalInsumo(true);
  };

  const guardarInsumo = async (e) => {
    e.preventDefault();
    setErrorFormInsumo('');
    if (!formInsumo.nombre.trim()) return setErrorFormInsumo('Escriba el nombre del producto.');
    if (!formInsumo.unidad_medida) return setErrorFormInsumo('Elija en qué se mide este producto.');

    const payload = {
      nombre: formInsumo.nombre.trim(),
      unidad_medida: formInsumo.unidad_medida,
      precio_unitario_referencia: vacio(formInsumo.precio_unitario_referencia)
        ? null
        : Number(formInsumo.precio_unitario_referencia),
      moneda_referencia: formInsumo.moneda_referencia,
      stock_minimo: vacio(formInsumo.stock_minimo) ? null : Number(formInsumo.stock_minimo),
      proveedor: vacio(formInsumo.proveedor) ? null : formInsumo.proveedor.trim(),
    };

    const cantidadInicial = vacio(formInsumo.cantidad_inicial) ? 0 : Number(formInsumo.cantidad_inicial);
    if (!editandoId && cantidadInicial < 0) return setErrorFormInsumo('La cantidad no puede ser negativa.');

    setGuardandoInsumo(true);
    try {
      let creado = null;
      if (editandoId) {
        await insumosApi.actualizarInsumo(editandoId, payload);
      } else {
        creado = desempacar(await insumosApi.crearInsumo(payload));

        // El producto nace en 0 y la existencia entra como movimiento:
        // así el stock siempre tiene un historial detrás que lo explica.
        if (cantidadInicial > 0) {
          await insumosApi.registrarMovimiento(creado.id, {
            tipo: 'entrada',
            es_ajuste: true,
            cantidad: cantidadInicial,
            fecha: hoy(),
            descripcion: 'Existencia inicial',
          });
        }
      }

      setMostrarModalInsumo(false);
      setAviso(
        editandoId
          ? 'Producto actualizado.'
          : cantidadInicial > 0
          ? `Producto creado con ${cantidadInicial} ${payload.unidad_medida} de existencia.`
          : 'Producto creado. Empieza en 0: use «Cargar existencia» o «Compra» cuando corresponda.'
      );
      await cargarTodo();

      if (creado) setInsumoId(String(creado.id));
    } catch (err) {
      setErrorFormInsumo(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardandoInsumo(false);
    }
  };

  const cambiarEstadoInsumo = async (i) => {
    const desactivando = i.activo;
    const pregunta = desactivando
      ? `¿Archivar ${i.nombre}? Deja de aparecer en la lista, pero su historial se conserva.`
      : `¿Volver a usar ${i.nombre}?`;
    if (!window.confirm(pregunta)) return;

    setError('');
    try {
      if (desactivando) await insumosApi.eliminarInsumo(i.id);
      else await insumosApi.actualizarInsumo(i.id, { activo: true });
      setAviso(desactivando ? 'Producto archivado.' : 'Producto reactivado.');
      await cargarTodo();
    } catch (err) {
      setError(`No se pudo cambiar el estado. ${detalleError(err)}`);
    }
  };

  // ---------- Entradas y salidas ----------
  const abrirMovimiento = (i, tipo, esAjuste = false) => {
    setInsumoId(String(i.id));
    setFormMovimiento({
      ...formMovimientoVacio,
      tipo,
      es_ajuste: esAjuste,
      fecha: hoy(),
      moneda: i.moneda_referencia || 'BS',
    });
    setErrorFormMovimiento('');
    setMostrarModalMovimiento(true);
  };

  const guardarMovimiento = async (e) => {
    e.preventDefault();
    setErrorFormMovimiento('');

    // Solo una entrada CON precio cuenta como compra; el ajuste no.
    const esCompra = formMovimiento.tipo === 'entrada' && !formMovimiento.es_ajuste;

    const cantidad = Number(formMovimiento.cantidad);
    if (!formMovimiento.cantidad || Number.isNaN(cantidad) || cantidad <= 0) {
      return setErrorFormMovimiento('Indique una cantidad mayor a 0.');
    }
    if (esCompra && (vacio(formMovimiento.precio_unitario) || !formMovimiento.moneda)) {
      return setErrorFormMovimiento(
        'Para una compra hace falta el precio por unidad y la moneda. Si es una carga inicial, cámbielo arriba.'
      );
    }
    if (formMovimiento.tipo === 'salida' && insumo && cantidad > aNumero(insumo.stock_actual)) {
      return setErrorFormMovimiento(
        `No alcanza: quedan ${conUnidad(insumo.stock_actual, insumo.unidad_medida)} en existencia.`
      );
    }

    const payload = {
      tipo: formMovimiento.tipo,
      es_ajuste: formMovimiento.es_ajuste,
      cantidad,
      precio_unitario: esCompra && !vacio(formMovimiento.precio_unitario) ? Number(formMovimiento.precio_unitario) : null,
      moneda: esCompra ? formMovimiento.moneda : null,
      fecha: formMovimiento.fecha,
      descripcion: vacio(formMovimiento.descripcion) ? null : formMovimiento.descripcion.trim(),
    };

    setGuardandoMovimiento(true);
    try {
      await insumosApi.registrarMovimiento(insumoId, payload);
      setMostrarModalMovimiento(false);
      setAviso(
        formMovimiento.tipo === 'salida'
          ? 'Consumo registrado.'
          : esCompra
          ? 'Compra registrada.'
          : 'Existencia cargada.'
      );
      await Promise.all([cargarTodo(), cargarMovimientos()]);
    } catch (err) {
      setErrorFormMovimiento(`No se pudo registrar. ${detalleError(err)}`);
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  const anularUltimoMovimiento = async () => {
    if (movimientos.length === 0) return;
    const m = movimientos[0];
    const texto = m.tipo === 'entrada' ? 'compra' : 'consumo';
    if (!window.confirm(`¿Deshacer la última ${texto} (${conUnidad(m.cantidad, insumo?.unidad_medida)})?`)) return;

    setAnulando(true);
    setError('');
    try {
      await insumosApi.anularMovimiento(m.id);
      setAviso('Movimiento deshecho. La existencia volvió como estaba.');
      await Promise.all([cargarTodo(), cargarMovimientos()]);
    } catch (err) {
      setError(`No se pudo deshacer. ${detalleError(err)}`);
    } finally {
      setAnulando(false);
    }
  };

  // ===== SOLO PRUEBAS — quitar al arrancar en producción =====
  const descontarLeche = async (cuerpo) => {
    setAjustando(true);
    setError('');
    try {
      const respuesta = await insumosApi.descontarLeche(cuerpo);
      setAviso(respuesta?.message || 'Litros descontados.');
      setLitrosQuitar('');
      await cargarTodo();
    } catch (err) {
      setError(`No se pudo descontar. ${detalleError(err)}`);
    } finally {
      setAjustando(false);
    }
  };

  const quitarLitros = () => {
    const cantidad = Number(litrosQuitar);
    if (vacio(litrosQuitar) || cantidad <= 0) return setError('Indique cuántos litros quitar.');
    descontarLeche({ litros: cantidad, tipo: tipoQuitar });
  };

  const dejarEnCero = () => {
    if (!window.confirm('¿Dejar la leche en cero? El registro diario no se toca.')) return;
    descontarLeche({ dejar_en_cero: true });
  };

  const restaurarLeche = async () => {
    if (!window.confirm('¿Deshacer todos los descuentos y volver a lo realmente cargado?')) return;
    setAjustando(true);
    setError('');
    try {
      const respuesta = await insumosApi.restaurarLeche();
      setAviso(respuesta?.message || 'Descuentos deshechos.');
      await cargarTodo();
    } catch (err) {
      setError(`No se pudo restaurar. ${detalleError(err)}`);
    } finally {
      setAjustando(false);
    }
  };
  // ===== fin bloque de pruebas =====

  if (cargando) return <LoadingSpinner mensaje="Cargando inventario..." />;

  const tipoEsEntrada = formMovimiento.tipo === 'entrada';
  const unidadForm = insumo?.unidad_medida || '';

  return (
    <div>
      <div className="page-header mb-3">
        <h4 className="mb-1">Inventario</h4>
        <p className="text-muted mb-0">
          Arriba, la leche que entra por el registro diario de los productores: se suma sola, no hay que cargarla
          aquí. Abajo, los demás productos de la planta, donde cada compra suma existencia y cada consumo la resta.
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
      {avisoLeche && <Alert variant="warning">{avisoLeche}</Alert>}

      {/* ---------------- LECHE ---------------- */}
      <Card className="mb-4 border-success">
        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>Leche recibida de los productores</strong>
            <div className="text-muted small">
              Se mide en litros y aparece sola en cuanto se cargan los litros en «Registro diario de leche».
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-end gap-2">
            <div>
              <Form.Label className="small text-muted mb-1">Desde</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div>
              <Form.Label className="small text-muted mb-1">Hasta</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
            <Button size="sm" variant="outline-success" onClick={() => cargarTodo()}>
              Ver
            </Button>
          </div>
        </Card.Header>

        <Card.Body>
          {!leche ? (
            <p className="text-muted mb-0">Todavía no hay datos de leche que mostrar.</p>
          ) : (
            <>
              <div className="d-flex flex-wrap gap-3">
                {leche.tipos.map((t) => (
                  <TarjetaLeche
                    key={t.clave}
                    titulo={t.nombre.replace('Leche — ', '')}
                    cantidad={t.recibido_rango ?? t.recibido_total}
                    unidad={t.unidad_medida}
                    pie={`${aNumero(t.recibido_total, 0)} ${t.unidad_medida} en total histórico`}
                  />
                ))}
              </div>

              <div className="d-flex flex-wrap gap-4 mt-3 pt-3 border-top small">
                <div>
                  <span className="text-muted">Recibido en el rango: </span>
                  <strong>{conUnidad(leche.recibido_rango ?? leche.recibido_total, leche.unidad_medida)}</strong>
                </div>
                <div>
                  <span className="text-muted">Usado en producción (histórico): </span>
                  <strong>{conUnidad(leche.usada_produccion_total, leche.unidad_medida)}</strong>
                </div>
                <div>
                  <span className="text-muted">Queda disponible: </span>
                  <strong>{conUnidad(leche.disponible_total, leche.unidad_medida)}</strong>
                </div>
                {leche.ultima_carga && (
                  <div className="ms-auto text-muted">Última carga: {formatoCorto(leche.ultima_carga)}</div>
                )}
              </div>

              <div className="text-muted small mt-2">
                Los lotes de producción anotan los litros que usaron sin separar si eran buenos, ácidos o bajos en
                grasa. Por eso lo disponible se calcula sobre el total, no sobre cada tipo por separado.
              </div>

              {/* ===== SOLO PRUEBAS — quitar al arrancar en producción ===== */}
              <div className="border border-warning rounded p-2 mt-3 bg-warning-subtle">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="small">
                    <strong>Ajuste de pruebas</strong>
                    {leche.litros_descontados > 0 && (
                      <span className="ms-2">
                        Hay {leche.litros_descontados} L descontados a mano.
                      </span>
                    )}
                    <div className="text-muted">
                      Baja el número de esta pantalla. El registro diario de los productores no se toca.
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    {leche.litros_descontados > 0 && (
                      <Button size="sm" variant="outline-secondary" onClick={restaurarLeche} disabled={ajustando}>
                        Deshacer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline-warning"
                      onClick={() => setMostrarDescuento((v) => !v)}
                    >
                      {mostrarDescuento ? 'Ocultar' : 'Quitar litros'}
                    </Button>
                  </div>
                </div>

                {mostrarDescuento && (
                  <div className="d-flex flex-wrap align-items-end gap-2 mt-3">
                    <div>
                      <Form.Label className="small text-muted mb-1">Litros a quitar</Form.Label>
                      <InputGroup size="sm" style={{ width: 190 }}>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.01"
                          value={litrosQuitar}
                          onChange={(e) => setLitrosQuitar(e.target.value)}
                          placeholder="0"
                        />
                        <InputGroup.Text>L</InputGroup.Text>
                      </InputGroup>
                    </div>
                    <div>
                      <Form.Label className="small text-muted mb-1">¿De cuáles?</Form.Label>
                      <Form.Select
                        size="sm"
                        value={tipoQuitar}
                        onChange={(e) => setTipoQuitar(e.target.value)}
                        style={{ width: 190 }}
                      >
                        <option value="todos">De todos (primero los buenos)</option>
                        <option value="buenos">Solo litros buenos</option>
                        <option value="acidos">Solo litros ácidos</option>
                        <option value="bajo_grasa">Solo bajos en grasa</option>
                      </Form.Select>
                    </div>
                    <Button size="sm" variant="warning" onClick={quitarLitros} disabled={ajustando}>
                      {ajustando ? 'Aplicando...' : 'Quitar'}
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={dejarEnCero} disabled={ajustando}>
                      Dejar en 0
                    </Button>
                  </div>
                )}
              </div>
              {/* ===== fin bloque de pruebas ===== */}
            </>
          )}
        </Card.Body>
      </Card>

      {/* ---------------- ALERTAS ---------------- */}
      {enAlerta.length > 0 && (
        <Alert variant="warning" className="d-flex flex-wrap gap-3 align-items-center">
          <strong>Hay que reponer:</strong>
          {enAlerta.map((i) => (
            <span key={i.id}>
              {i.nombre} — quedan {conUnidad(i.stock_actual, i.unidad_medida)}
            </span>
          ))}
        </Alert>
      )}

      {/* ---------------- PRODUCTOS ---------------- */}
      <Card>
        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>Productos de la planta</strong>
            <div className="text-muted small">Sal, cuajo, empaques, materiales y todo lo que se compra.</div>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <Form.Control
              type="search"
              size="sm"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <Form.Check
              type="switch"
              id="ver-archivados"
              label="Ver archivados"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
            />
            <Button variant="success" size="sm" onClick={abrirNuevoInsumo}>
              Nuevo producto
            </Button>
          </div>
        </Card.Header>

        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Se mide en</th>
              <th className="text-end">Existencia</th>
              <th className="text-end">Avisar cuando baje de</th>
              <th>Precio de referencia</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {insumosVisibles.map((i) => {
              const bajo = stockBajo(i);
              const elegido = String(i.id) === String(insumoId);
              return (
                <tr
                  key={i.id}
                  className={elegido ? 'table-active' : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setInsumoId(elegido ? '' : String(i.id))}
                >
                  <td>
                    <span className="fw-semibold">{i.nombre}</span>
                    {!i.activo && (
                      <Badge bg="secondary" className="ms-2">
                        Archivado
                      </Badge>
                    )}
                    {i.proveedor && <div className="text-muted small">{i.proveedor}</div>}
                  </td>
                  <td>{i.unidad_medida}</td>
                  <td className={`text-end fw-semibold ${bajo ? 'text-danger' : ''}`}>
                    {aNumero(i.stock_actual, 0)}
                    {bajo && (
                      <Badge bg="danger" className="ms-2">
                        Bajo
                      </Badge>
                    )}
                  </td>
                  <td className="text-end text-muted">
                    {i.stock_minimo === null || i.stock_minimo === undefined ? 'Sin aviso' : aNumero(i.stock_minimo, 0)}
                  </td>
                  <td className="text-muted">
                    {i.precio_unitario_referencia === null || i.precio_unitario_referencia === undefined
                      ? '—'
                      : `${formatearMontoEnMoneda(i.precio_unitario_referencia, i.moneda_referencia || 'BS')} / ${i.unidad_medida}`}
                  </td>
                  <td className="text-end" onClick={(e) => e.stopPropagation()}>
                    <div className="d-flex gap-2 justify-content-end flex-wrap">
                      <Button size="sm" variant="outline-success" onClick={() => abrirMovimiento(i, 'entrada')}>
                        Compra
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-info"
                        title="Cargar lo que ya hay en el depósito, sin precio"
                        onClick={() => abrirMovimiento(i, 'entrada', true)}
                      >
                        Cargar existencia
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => abrirMovimiento(i, 'salida')}
                        disabled={aNumero(i.stock_actual) <= 0}
                      >
                        Consumo
                      </Button>
                      <Button size="sm" variant="outline-secondary" onClick={() => abrirEditarInsumo(i)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => cambiarEstadoInsumo(i)}>
                        {i.activo ? 'Archivar' : 'Reactivar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {insumosVisibles.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  {busqueda
                    ? `Ningún producto coincide con «${busqueda}».`
                    : 'Todavía no hay productos cargados. Empiece con «Nuevo producto».'}
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        {insumosVisibles.length > 0 && (
          <Card.Footer className="text-muted small">
            Toque un producto para ver sus entradas y salidas.
          </Card.Footer>
        )}
      </Card>

      {/* ---------------- MOVIMIENTOS DEL PRODUCTO ELEGIDO ---------------- */}
      {insumo && (
        <Card className="mt-4">
          <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <strong>Entradas y salidas de {insumo.nombre}</strong>
              <div className="text-muted small">
                Existencia actual: {conUnidad(insumo.stock_actual, insumo.unidad_medida)}
              </div>
            </div>
            <div className="d-flex gap-2">
              {movimientos.length > 0 && (
                <Button size="sm" variant="outline-danger" onClick={anularUltimoMovimiento} disabled={anulando}>
                  {anulando ? 'Deshaciendo...' : 'Deshacer el último'}
                </Button>
              )}
              <Button size="sm" variant="link" className="p-0" onClick={() => setInsumoId('')}>
                Cerrar
              </Button>
            </div>
          </Card.Header>

          {cargandoMovimientos ? (
            <div className="p-3">
              <LoadingSpinner mensaje="Cargando movimientos..." />
            </div>
          ) : (
            <Table responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Qué pasó</th>
                  <th className="text-end">Cantidad</th>
                  <th className="text-end">Precio por {insumo.unidad_medida}</th>
                  <th className="text-end">Costo total</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const entrada = m.tipo === 'entrada';
                  const precio = m.precio_unitario;
                  return (
                    <tr key={m.id}>
                      <td className="text-muted">{formatoCorto(m.fecha)}</td>
                      <td>
                        <Badge bg={entrada ? 'success' : 'primary'}>{entrada ? 'Compra' : 'Consumo'}</Badge>
                      </td>
                      <td className={`text-end fw-semibold ${entrada ? 'text-success' : 'text-primary'}`}>
                        {entrada ? '+' : '−'}
                        {conUnidad(m.cantidad, insumo.unidad_medida)}
                      </td>
                      <td className="text-end text-muted">
                        {precio === null || precio === undefined
                          ? '—'
                          : formatearMontoEnMoneda(precio, m.moneda || 'BS')}
                      </td>
                      <td className="text-end">
                        {precio === null || precio === undefined
                          ? '—'
                          : formatearMontoEnMoneda(aNumero(precio) * aNumero(m.cantidad), m.moneda || 'BS')}
                      </td>
                      <td className="text-muted small">{m.descripcion || '—'}</td>
                    </tr>
                  );
                })}
                {movimientos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      Este producto todavía no tiene movimientos. Registre la primera compra para cargarle existencia.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* ---------------- MODAL: producto ---------------- */}
      <Modal show={mostrarModalInsumo} onHide={() => setMostrarModalInsumo(false)} centered>
        <Form onSubmit={guardarInsumo}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar producto' : 'Nuevo producto'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorFormInsumo && <Alert variant="danger">{errorFormInsumo}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                autoFocus
                value={formInsumo.nombre}
                onChange={(e) => setFormInsumo({ ...formInsumo, nombre: e.target.value })}
                placeholder="Sal, cuajo, bolsas de empaque..."
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>¿En qué se mide?</Form.Label>
              <Form.Select
                value={formInsumo.unidad_medida}
                onChange={(e) => setFormInsumo({ ...formInsumo, unidad_medida: e.target.value })}
              >
                <option value="">Elija la unidad</option>
                {UNIDADES.map((u) => (
                  <option key={u.codigo} value={u.codigo}>
                    {u.etiqueta}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Elija bien desde el principio: todas las compras y consumos de este producto se van a contar en esta
                unidad. Cambiarla después no convierte lo que ya está cargado.
              </Form.Text>
            </Form.Group>

            {!editandoId && (
              <Form.Group className="mb-3">
                <Form.Label>¿Cuánto hay ahora? (opcional)</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.01"
                    value={formInsumo.cantidad_inicial}
                    onChange={(e) => setFormInsumo({ ...formInsumo, cantidad_inicial: e.target.value })}
                    placeholder="0"
                  />
                  <InputGroup.Text>{formInsumo.unidad_medida || 'unidad'}</InputGroup.Text>
                </InputGroup>
                <Form.Text className="text-muted">
                  Lo que ya está en el depósito. Entra como existencia inicial, sin precio: no cuenta como una
                  compra del mes. Déjelo vacío si el producto arranca en cero.
                </Form.Text>
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Precio de referencia (opcional)</Form.Label>
              <InputGroup>
                <Form.Select
                  value={formInsumo.moneda_referencia}
                  onChange={(e) => setFormInsumo({ ...formInsumo, moneda_referencia: e.target.value })}
                  style={{ maxWidth: 130 }}
                >
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
                  value={formInsumo.precio_unitario_referencia}
                  onChange={(e) => setFormInsumo({ ...formInsumo, precio_unitario_referencia: e.target.value })}
                  placeholder="0.00"
                />
                <InputGroup.Text>por {formInsumo.unidad_medida || 'unidad'}</InputGroup.Text>
              </InputGroup>
              <Form.Text className="text-muted">
                Solo para tener una idea del costo. El precio real de cada compra se anota en su propio movimiento.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Avisar cuando baje de (opcional)</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={formInsumo.stock_minimo}
                  onChange={(e) => setFormInsumo({ ...formInsumo, stock_minimo: e.target.value })}
                  placeholder="0"
                />
                <InputGroup.Text>{formInsumo.unidad_medida || 'unidad'}</InputGroup.Text>
              </InputGroup>
              <Form.Text className="text-muted">Al llegar a esta cantidad, el producto sale marcado en rojo.</Form.Text>
            </Form.Group>

            <Form.Group>
              <Form.Label>Proveedor (opcional)</Form.Label>
              <Form.Control
                value={formInsumo.proveedor}
                onChange={(e) => setFormInsumo({ ...formInsumo, proveedor: e.target.value })}
                placeholder="A quién se le compra"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalInsumo(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoInsumo}>
              {guardandoInsumo ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------------- MODAL: compra / consumo ---------------- */}
      <Modal show={mostrarModalMovimiento} onHide={() => setMostrarModalMovimiento(false)} centered>
        <Form onSubmit={guardarMovimiento}>
          <Modal.Header closeButton>
            <Modal.Title>
              {!tipoEsEntrada
                ? 'Registrar consumo'
                : formMovimiento.es_ajuste
                ? 'Cargar existencia'
                : 'Registrar compra'}
              {insumo ? ` — ${insumo.nombre}` : ''}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorFormMovimiento && <Alert variant="danger">{errorFormMovimiento}</Alert>}

            {tipoEsEntrada && (
              <Form.Group className="mb-3">
                <Form.Label>¿De dónde viene?</Form.Label>
                <Form.Select
                  value={formMovimiento.es_ajuste ? 'ajuste' : 'compra'}
                  onChange={(e) =>
                    setFormMovimiento({ ...formMovimiento, es_ajuste: e.target.value === 'ajuste' })
                  }
                >
                  <option value="compra">Compra — llegó y se pagó</option>
                  <option value="ajuste">Carga inicial o ajuste — ya estaba, sin factura</option>
                </Form.Select>
              </Form.Group>
            )}

            <p className="text-muted small">
              {!tipoEsEntrada
                ? 'Un consumo resta existencia: lo que se usó en producción, se dañó o se perdió.'
                : formMovimiento.es_ajuste
                ? 'Suma existencia sin precio. Úselo para cargar lo que ya está en el depósito o para cuadrar contra un conteo físico. No cuenta como compra en la contabilidad.'
                : 'Una compra suma existencia. Anote lo que llegó y lo que se pagó por unidad.'}
              {insumo && ` Ahora hay ${conUnidad(insumo.stock_actual, insumo.unidad_medida)}.`}
            </p>

            <Form.Group className="mb-3">
              <Form.Label>Cantidad</Form.Label>
              <InputGroup>
                <Form.Control
                  autoFocus
                  type="number"
                  min="0"
                  step="0.01"
                  value={formMovimiento.cantidad}
                  onChange={(e) => setFormMovimiento({ ...formMovimiento, cantidad: e.target.value })}
                  placeholder="0"
                />
                <InputGroup.Text>{unidadForm || 'unidad'}</InputGroup.Text>
              </InputGroup>
            </Form.Group>

            {tipoEsEntrada && !formMovimiento.es_ajuste && (
              <Form.Group className="mb-3">
                <Form.Label>Precio por {unidadForm || 'unidad'}</Form.Label>
                <InputGroup>
                  <Form.Select
                    value={formMovimiento.moneda}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, moneda: e.target.value })}
                    style={{ maxWidth: 130 }}
                  >
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
                    value={formMovimiento.precio_unitario}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, precio_unitario: e.target.value })}
                    placeholder="0.00"
                  />
                </InputGroup>
                {!vacio(formMovimiento.cantidad) && !vacio(formMovimiento.precio_unitario) && (
                  <Form.Text className="text-muted">
                    Costo total:{' '}
                    {formatearMontoEnMoneda(
                      aNumero(formMovimiento.cantidad) * aNumero(formMovimiento.precio_unitario),
                      formMovimiento.moneda
                    )}
                  </Form.Text>
                )}
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Fecha</Form.Label>
              <Form.Control
                type="date"
                value={formMovimiento.fecha}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, fecha: e.target.value })}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Nota (opcional)</Form.Label>
              <Form.Control
                value={formMovimiento.descripcion}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, descripcion: e.target.value })}
                placeholder={
                  !tipoEsEntrada
                    ? 'Para qué se usó'
                    : formMovimiento.es_ajuste
                    ? 'Conteo del depósito, saldo anterior...'
                    : 'Número de factura, proveedor...'
                }
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalMovimiento(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoMovimiento}>
              {guardandoMovimiento
                ? 'Guardando...'
                : !tipoEsEntrada
                ? 'Registrar consumo'
                : formMovimiento.es_ajuste
                ? 'Cargar existencia'
                : 'Registrar compra'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Insumos;