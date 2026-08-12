import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Tabs, Tab } from 'react-bootstrap';
import * as produccionApi from '../../api/produccion.api';
import * as productoresApi from '../../api/productores.api';
import * as ruterosApi from '../../api/ruteros.api';
import * as insumosApi from '../../api/insumos.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { desempacar, formatoCorto, hoy, vacio } from '../../utils/fechas';

const PRODUCTOS_SUGERIDOS = ['Semiduro', 'Queso blanco', 'Queso duro', 'Requesón', 'Mantequilla', 'Suero'];

const OTRO = '__otro__';

const MONEDAS_LOTE = ['BS', 'USD', 'COP'];

const formVacio = { fecha: hoy(), producto: '', notas: '', cantidad_unidades: '' };

const Produccion = () => {
  const [pestana, setPestana] = useState('lotes');
  const [lotes, setLotes] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);

  // Para poblar el selector de "origen" de cada aporte de litros.
  const [productores, setProductores] = useState([]);
  const [ruteros, setRuteros] = useState([]);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  // Detalle opcional: aportes de litros (productores/rutero) y piezas pesadas.
  // Si hay al menos una fila cargada, el total se calcula solo sumando y el
  // campo "manual" queda de lado — igual que hace el backend.
  const [aportesLitros, setAportesLitros] = useState([]);
  const [litrosManual, setLitrosManual] = useState('');
  const [pesosPiezas, setPesosPiezas] = useState([]);
  const [kilosManual, setKilosManual] = useState('');

  // ---------- Insumos gastados en el lote ----------
  // La leche va aparte: no es un insumo del inventario, entra por el
  // registro diario de los productores. Aquí solo se le pone precio.
  const [insumosDisponibles, setInsumosDisponibles] = useState([]);
  const [lineasInsumos, setLineasInsumos] = useState([]);
  const [precioLeche, setPrecioLeche] = useState('');
  const [monedaLeche, setMonedaLeche] = useState('BS');
  const [formulaSugerida, setFormulaSugerida] = useState(null);

  const idRef = useRef(0);
  const nuevoId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  const cargarLotes = async () => {
    setCargando(true);
    setError('');
    try {
      setLotes(desempacar(await produccionApi.listarLotes()) || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los lotes de producción.');
    } finally {
      setCargando(false);
    }
  };

  const cargarResumen = useCallback(async () => {
    try {
      setResumen(desempacar(await produccionApi.obtenerResumenPorProducto()) || []);
    } catch {
      setResumen([]);
    }
  }, []);

  // Lista de productores/ruteros para el selector de "origen" de cada
  // aporte. Si alguna de las dos llamadas falla, la otra igual se usa —
  // no bloquea el formulario, simplemente ese grupo queda vacío.
  // Catalogo de insumos, para el selector de "que se gasto".
  const cargarInsumos = useCallback(async () => {
    try {
      setInsumosDisponibles(desempacar(await insumosApi.listarInsumos()) || []);
    } catch {
      setInsumosDisponibles([]);
    }
  }, []);

  const cargarOrigenes = useCallback(async () => {
    try {
      setProductores(desempacar(await productoresApi.listarProductores()) || []);
    } catch {
      setProductores([]);
    }
    try {
      setRuteros(desempacar(await ruterosApi.listarRuteros()) || []);
    } catch {
      setRuteros([]);
    }
  }, []);

  useEffect(() => {
    cargarLotes();
    cargarResumen();
    cargarOrigenes();
    cargarInsumos();
  }, [cargarResumen, cargarOrigenes, cargarInsumos]);

  const lotesVisibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return lotes.filter((l) => {
      if (!verInactivos && !l.activo) return false;
      if (texto && !l.producto.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [lotes, busqueda, verInactivos]);

  // ---------- Cálculo en vivo (espejo del que hace el backend) ----------
  const litrosTotal = useMemo(() => {
    if (aportesLitros.length > 0) return aportesLitros.reduce((s, a) => s + (Number(a.litros) || 0), 0);
    return Number(litrosManual) || 0;
  }, [aportesLitros, litrosManual]);

  const kilosTotal = useMemo(() => {
    if (pesosPiezas.length > 0) return pesosPiezas.reduce((s, p) => s + (Number(p.peso) || 0), 0);
    return Number(kilosManual) || 0;
  }, [pesosPiezas, kilosManual]);

  const porcentajePreview = kilosTotal > 0 ? litrosTotal / kilosTotal : null;

  const productoresActivos = useMemo(() => productores.filter((p) => p.activo), [productores]);
  const ruterosActivos = useMemo(() => ruteros.filter((r) => r.activo), [ruteros]);
  const etiquetaRutero = (r) => `${r.nombre} (rutero)`;

  // Si el origen guardado coincide exactamente con un productor o rutero
  // activo, la fila se muestra en modo "lista". Si no coincide con nada
  // (o quedó vacío), se muestra en modo "escribir".
  const coincideConLista = (origen) => {
    if (vacio(origen)) return false;
    return (
      productoresActivos.some((p) => p.nombre === origen) || ruterosActivos.some((r) => etiquetaRutero(r) === origen)
    );
  };

  // ---------- Insumos gastados ----------
  const insumosActivos = useMemo(
    () => insumosDisponibles.filter((i) => i.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [insumosDisponibles]
  );

  const buscarInsumo = useCallback(
    (id) => insumosDisponibles.find((i) => String(i.id) === String(id)) || null,
    [insumosDisponibles]
  );

  const agregarLineaInsumo = () =>
    setLineasInsumos((prev) => [...prev, { id: nuevoId(), insumo_id: '', cantidad: '' }]);

  const quitarLineaInsumo = (id) => setLineasInsumos((prev) => prev.filter((l) => l.id !== id));

  const cambiarLineaInsumo = (id, campo, valor) =>
    setLineasInsumos((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));

  /**
   * Lo ya consumido por este mismo lote no cuenta como faltante: al
   * corregirlo, el backend primero devuelve todo al inventario y después
   * vuelve a descontar. Sin esto, editar un lote sin cambiar nada daría
   * "no hay existencia" en cuanto el stock quedara justo.
   */
  const yaConsumidoPorEsteLote = useCallback(
    (insumoId) => {
      if (!editandoId) return 0;
      const lote = lotes.find((l) => String(l.id) === String(editandoId));
      const guardada = Array.isArray(lote?.insumos_usados) ? lote.insumos_usados : [];
      const linea = guardada.find((g) => String(g.insumo_id) === String(insumoId));
      return linea ? Number(linea.cantidad) || 0 : 0;
    },
    [editandoId, lotes]
  );

  const disponibleDe = useCallback(
    (insumoId) => {
      const insumo = buscarInsumo(insumoId);
      if (!insumo) return 0;
      return Number(insumo.stock_actual || 0) + yaConsumidoPorEsteLote(insumoId);
    },
    [buscarInsumo, yaConsumidoPorEsteLote]
  );

  /** Líneas que piden más de lo que hay. El backend también lo bloquea. */
  const lineasSinExistencia = useMemo(
    () =>
      lineasInsumos.filter((l) => {
        if (vacio(l.insumo_id) || vacio(l.cantidad)) return false;
        return Number(l.cantidad) > disponibleDe(l.insumo_id);
      }),
    [lineasInsumos, disponibleDe]
  );

  /** Costo estimado, con los precios de referencia del inventario. */
  const costoEstimado = useMemo(() => {
    const porMoneda = new Map();
    const sumarA = (moneda, monto) => {
      if (!monto) return;
      porMoneda.set(moneda, (porMoneda.get(moneda) || 0) + monto);
    };

    if (!vacio(precioLeche) && litrosTotal > 0) {
      sumarA(monedaLeche, Number(precioLeche) * litrosTotal);
    }

    lineasInsumos.forEach((l) => {
      const insumo = buscarInsumo(l.insumo_id);
      if (!insumo || vacio(l.cantidad)) return;
      const precio = insumo.precio_unitario_referencia;
      if (precio === null || precio === undefined) return;
      sumarA(insumo.moneda_referencia || 'BS', Number(precio) * Number(l.cantidad));
    });

    return [...porMoneda.entries()].map(([moneda, monto]) => ({ moneda, monto }));
  }, [precioLeche, monedaLeche, litrosTotal, lineasInsumos, buscarInsumo]);

  /** Carga la fórmula del último lote de ese producto, si existe. */
  const buscarFormulaAnterior = useCallback(async (producto) => {
    setFormulaSugerida(null);
    if (vacio(producto) || typeof produccionApi.obtenerUltimaFormula !== 'function') return;
    try {
      const datos = desempacar(await produccionApi.obtenerUltimaFormula(producto));
      if (datos && Array.isArray(datos.insumos_usados) && datos.insumos_usados.length > 0) {
        setFormulaSugerida(datos);
      }
    } catch {
      setFormulaSugerida(null);
    }
  }, []);

  const aplicarFormulaSugerida = () => {
    if (!formulaSugerida) return;
    setLineasInsumos(
      formulaSugerida.insumos_usados.map((i) => ({
        id: nuevoId(),
        insumo_id: String(i.insumo_id),
        cantidad: String(i.cantidad),
      }))
    );
    if (!vacio(formulaSugerida.precio_litro_leche)) {
      setPrecioLeche(String(formulaSugerida.precio_litro_leche));
      setMonedaLeche(formulaSugerida.moneda_leche || 'BS');
    }
    setFormulaSugerida(null);
  };

  // ---------- Filas dinámicas ----------
  const agregarAporte = () =>
    setAportesLitros((prev) => [...prev, { id: nuevoId(), origen: '', litros: '', personalizado: false }]);
  const quitarAporte = (id) => setAportesLitros((prev) => prev.filter((a) => a.id !== id));
  const cambiarAporte = (id, campo, valor) =>
    setAportesLitros((prev) => prev.map((a) => (a.id === id ? { ...a, [campo]: valor } : a)));

  // Al elegir del select: si escogen "Otro", la fila pasa a modo texto
  // libre (y se limpia el origen para que lo escriban). Si escogen un
  // nombre real, ese nombre queda como origen directamente.
  const elegirOrigenAporte = (id, valor) => {
    if (valor === OTRO) {
      cambiarAporte(id, 'personalizado', true);
      cambiarAporte(id, 'origen', '');
    } else {
      cambiarAporte(id, 'origen', valor);
    }
  };

  const volverALista = (id) => {
    cambiarAporte(id, 'personalizado', false);
    cambiarAporte(id, 'origen', '');
  };

  const agregarPieza = () => setPesosPiezas((prev) => [...prev, { id: nuevoId(), peso: '' }]);
  const quitarPieza = (id) => setPesosPiezas((prev) => prev.filter((p) => p.id !== id));
  const cambiarPieza = (id, valor) =>
    setPesosPiezas((prev) => prev.map((p) => (p.id === id ? { ...p, peso: valor } : p)));

  // ---------- CRUD ----------
  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(formVacio);
    setAportesLitros([]);
    setPesosPiezas([]);
    setLitrosManual('');
    setKilosManual('');
    setLineasInsumos([]);
    setPrecioLeche('');
    setMonedaLeche('BS');
    setFormulaSugerida(null);
    setErrorForm('');
    setMostrarModal(true);
  };

  const abrirEditar = (l) => {
    setEditandoId(l.id);
    setForm({
      fecha: l.fecha,
      producto: l.producto || '',
      notas: l.notas || '',
      cantidad_unidades: l.cantidad_unidades ?? '',
    });

    if (Array.isArray(l.detalle_litros) && l.detalle_litros.length > 0) {
      setAportesLitros(
        l.detalle_litros.map((d) => ({
          id: nuevoId(),
          origen: d.origen || '',
          litros: d.litros ?? '',
          personalizado: !coincideConLista(d.origen),
        }))
      );
      setLitrosManual('');
    } else {
      setAportesLitros([]);
      setLitrosManual(l.litros_utilizados ?? '');
    }

    if (Array.isArray(l.detalle_pesos) && l.detalle_pesos.length > 0) {
      setPesosPiezas(l.detalle_pesos.map((p) => ({ id: nuevoId(), peso: p ?? '' })));
      setKilosManual('');
    } else {
      setPesosPiezas([]);
      setKilosManual(l.kilos_obtenidos ?? '');
    }

    // La formula guardada del lote vuelve al formulario tal cual: el
    // backend devuelve al inventario y vuelve a descontar segun quede.
    const guardadas = Array.isArray(l.insumos_usados) ? l.insumos_usados : [];
    setLineasInsumos(
      guardadas.map((i) => ({ id: nuevoId(), insumo_id: String(i.insumo_id), cantidad: String(i.cantidad) }))
    );
    setPrecioLeche(l.precio_litro_leche ?? '');
    setMonedaLeche(l.moneda_leche || 'BS');
    setFormulaSugerida(null);

    setErrorForm('');
    setMostrarModal(true);
  };

  const guardarLote = async (e) => {
    e.preventDefault();
    setErrorForm('');

    if (!form.producto.trim()) return setErrorForm('Indique el producto que se elaboró.');
    if (litrosTotal <= 0) return setErrorForm('Indique los litros recibidos (directo o por aporte).');
    if (kilosTotal <= 0) return setErrorForm('Indique los kilos obtenidos (directo o por pieza).');

    const sinInsumo = lineasInsumos.filter((l) => !vacio(l.cantidad) && vacio(l.insumo_id));
    if (sinInsumo.length > 0) return setErrorForm('Hay una cantidad cargada sin elegir el insumo.');
    if (lineasSinExistencia.length > 0) {
      return setErrorForm('No hay existencia suficiente de un insumo. Revise las líneas marcadas en rojo.');
    }

    const payload = {
      fecha: form.fecha,
      producto: form.producto.trim(),
      notas: vacio(form.notas) ? null : form.notas.trim(),
      // Siempre se manda la lista, aunque vaya vacia: es lo que le dice al
      // backend que tiene que rehacer el consumo de este lote.
      insumos_usados: lineasInsumos
        .filter((l) => !vacio(l.insumo_id) && !vacio(l.cantidad) && Number(l.cantidad) > 0)
        .map((l) => ({ insumo_id: Number(l.insumo_id), cantidad: Number(l.cantidad) })),
      precio_litro_leche: vacio(precioLeche) ? null : Number(precioLeche),
      moneda_leche: vacio(precioLeche) ? null : monedaLeche,
    };

    if (aportesLitros.length > 0) {
      payload.detalle_litros = aportesLitros
        .filter((a) => !vacio(a.litros))
        .map((a) => ({ origen: vacio(a.origen) ? null : a.origen.trim(), litros: Number(a.litros) }));
    } else {
      payload.litros_utilizados = litrosTotal;
    }

    if (pesosPiezas.length > 0) {
      payload.detalle_pesos = pesosPiezas.filter((p) => !vacio(p.peso)).map((p) => Number(p.peso));
    } else {
      payload.kilos_obtenidos = kilosTotal;
      if (!vacio(form.cantidad_unidades)) payload.cantidad_unidades = Number(form.cantidad_unidades);
    }

    setGuardando(true);
    try {
      if (editandoId) {
        await produccionApi.actualizarLote(editandoId, payload);
      } else {
        await produccionApi.crearLote(payload);
      }
      setMostrarModal(false);
      setAviso(editandoId ? 'Lote actualizado.' : 'Lote registrado.');
      await Promise.all([cargarLotes(), cargarResumen(), cargarInsumos()]);
    } catch (err) {
      setErrorForm(err.response?.data?.message || 'No se pudo guardar el lote.');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (l) => {
    const desactivando = l.activo;
    if (!window.confirm(desactivando ? `¿Desactivar el lote de ${l.producto} del ${formatoCorto(l.fecha)}?` : `¿Reactivar este lote?`)) {
      return;
    }
    setError('');
    try {
      if (desactivando) {
        await produccionApi.eliminarLote(l.id);
      } else {
        await produccionApi.actualizarLote(l.id, { activo: true });
      }
      setAviso(desactivando ? 'Lote desactivado.' : 'Lote reactivado.');
      await Promise.all([cargarLotes(), cargarResumen()]);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cambiar el estado del lote.');
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando producción..." />;

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-start mb-3 gap-3 flex-wrap">
        <div>
          <h4 className="mb-1">Creación de producto</h4>
          <p className="text-muted mb-0">
            Litros recibidos ÷ kilos obtenidos = rendimiento por kilo. Se toma el litraje recibido (lo medido al
            llegar), no lo cargado en ruta.
          </p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          <span className="btn-icon-plus">+</span>Nuevo lote
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

      <Tabs activeKey={pestana} onSelect={(k) => setPestana(k || 'lotes')} className="mb-3">
        <Tab eventKey="lotes" title="Lotes">
          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
            <Form.Control
              style={{ maxWidth: 280 }}
              placeholder="Buscar por producto"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <Form.Check
              type="switch"
              id="ver-lotes-inactivos"
              label="Ver inactivos"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
            />
            <span className="text-muted small ms-auto">{lotesVisibles.length} en pantalla</span>
          </div>

          <Table hover responsive bordered className="bg-white align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th className="text-end">Litros</th>
                <th className="text-end">Kilos</th>
                <th className="text-end">Litro/Kilo</th>
                <th className="text-end">Unidades</th>
                <th>Notas</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lotesVisibles.map((l) => (
                <tr key={l.id}>
                  <td className="text-muted">{formatoCorto(l.fecha)}</td>
                  <td className="fw-semibold">{l.producto}</td>
                  <td className="text-end">{l.litros_utilizados}</td>
                  <td className="text-end">{l.kilos_obtenidos}</td>
                  <td className="text-end fw-semibold">{Number(l.porcentaje_litro_kilo).toFixed(4)}</td>
                  <td className="text-end">{l.cantidad_unidades ?? '—'}</td>
                  <td className="text-muted">{l.notas || '—'}</td>
                  <td>
                    <Badge bg={l.activo ? 'success' : 'secondary'}>{l.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirEditar(l)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={l.activo ? 'outline-danger' : 'outline-success'}
                      onClick={() => cambiarEstado(l)}
                    >
                      {l.activo ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  </td>
                </tr>
              ))}
              {lotesVisibles.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-4">
                    {lotes.length === 0
                      ? 'Todavía no hay lotes registrados. Cree el primero para empezar a medir el rendimiento.'
                      : 'Ningún lote coincide con el filtro.'}
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Tab>

        <Tab eventKey="resumen" title="Resumen por producto">
          <Table hover responsive bordered className="bg-white align-middle">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-end">Lotes</th>
                <th className="text-end">Litros totales</th>
                <th className="text-end">Kilos totales</th>
                <th className="text-end">% promedio</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={r.producto}>
                  <td className="fw-semibold">{r.producto}</td>
                  <td className="text-end">{r.lotes}</td>
                  <td className="text-end">{r.litros}</td>
                  <td className="text-end">{r.kilos}</td>
                  <td className="text-end fw-semibold">{r.porcentaje_promedio}</td>
                </tr>
              ))}
              {resumen.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Todavía no hay lotes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Tab>
      </Tabs>

      {/* ---------- Modal: nuevo/editar lote ---------- */}
      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered size="lg">
        <Form onSubmit={guardarLote}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar lote' : 'Nuevo lote de producción'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorForm && <Alert variant="danger">{errorForm}</Alert>}

            <div className="row g-3 mb-3">
              <div className="col-sm-8">
                <Form.Label>Producto</Form.Label>
                <Form.Control
                  value={form.producto}
                  onChange={(e) => setForm({ ...form, producto: e.target.value })}
                  // Al salir del campo se busca que se gasto la ultima vez
                  // que se hizo este producto, para poder repetir la formula.
                  onBlur={(e) => !editandoId && buscarFormulaAnterior(e.target.value.trim())}
                  placeholder="Semiduro, Queso blanco, Requesón..."
                  list="productos-sugeridos"
                  required
                />
                <datalist id="productos-sugeridos">
                  {PRODUCTOS_SUGERIDOS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div className="col-sm-4">
                <Form.Label>Fecha</Form.Label>
                <Form.Control type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
            </div>

            <hr />

            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="mb-0">Litros recibidos</Form.Label>
              <Button size="sm" variant="outline-secondary" onClick={agregarAporte}>
                <span className="btn-icon-plus">+</span>Aporte
              </Button>
            </div>

            {aportesLitros.length === 0 ? (
              <InputGroup className="mb-3">
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={litrosManual}
                  onChange={(e) => setLitrosManual(e.target.value)}
                  placeholder="Total de litros recibidos"
                />
                <InputGroup.Text>L</InputGroup.Text>
              </InputGroup>
            ) : (
              <div className="mb-3">
                {aportesLitros.map((a) => (
                  <div key={a.id} className="d-flex gap-2 mb-2 align-items-start">
                    {a.personalizado ? (
                      <div className="flex-grow-1">
                        <Form.Control
                          placeholder="Nombre de quien trajo la leche"
                          value={a.origen}
                          onChange={(e) => cambiarAporte(a.id, 'origen', e.target.value)}
                          autoFocus
                        />
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 mt-1"
                          onClick={() => volverALista(a.id)}
                        >
                          Elegir de la lista
                        </Button>
                      </div>
                    ) : (
                      <Form.Select
                        className="flex-grow-1"
                        value={a.origen}
                        onChange={(e) => elegirOrigenAporte(a.id, e.target.value)}
                      >
                        <option value="">Seleccione productor o rutero</option>
                        {productoresActivos.length > 0 && (
                          <optgroup label="Productores">
                            {productoresActivos.map((p) => (
                              <option key={`p-${p.id}`} value={p.nombre}>
                                {p.nombre}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {ruterosActivos.length > 0 && (
                          <optgroup label="Ruteros">
                            {ruterosActivos.map((r) => (
                              <option key={`r-${r.id}`} value={etiquetaRutero(r)}>
                                {etiquetaRutero(r)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <option value={OTRO}>Otro (escribir)...</option>
                      </Form.Select>
                    )}
                    <InputGroup style={{ maxWidth: 150 }}>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        value={a.litros}
                        onChange={(e) => cambiarAporte(a.id, 'litros', e.target.value)}
                        placeholder="Litros"
                      />
                      <InputGroup.Text>L</InputGroup.Text>
                    </InputGroup>
                    <Button variant="outline-danger" size="sm" onClick={() => quitarAporte(a.id)}>
                      ✕
                    </Button>
                  </div>
                ))}
                <div className="text-end text-muted small">
                  Total: <strong>{litrosTotal.toFixed(2)} L</strong>
                </div>
              </div>
            )}

            <hr />

            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="mb-0">Kilos obtenidos</Form.Label>
              <Button size="sm" variant="outline-secondary" onClick={agregarPieza}>
                <span className="btn-icon-plus">+</span>Pieza
              </Button>
            </div>

            {pesosPiezas.length === 0 ? (
              <>
                <InputGroup className="mb-2">
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.001"
                    value={kilosManual}
                    onChange={(e) => setKilosManual(e.target.value)}
                    placeholder="Total de kilos obtenidos"
                  />
                  <InputGroup.Text>kg</InputGroup.Text>
                </InputGroup>
                <Form.Group className="mb-3">
                  <Form.Label className="small text-muted">Cantidad de unidades (opcional)</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="1"
                    value={form.cantidad_unidades}
                    onChange={(e) => setForm({ ...form, cantidad_unidades: e.target.value })}
                  />
                </Form.Group>
              </>
            ) : (
              <div className="mb-3">
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {pesosPiezas.map((p, idx) => (
                    <InputGroup key={p.id} style={{ maxWidth: 150 }}>
                      <InputGroup.Text>#{idx + 1}</InputGroup.Text>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.001"
                        value={p.peso}
                        onChange={(e) => cambiarPieza(p.id, e.target.value)}
                        placeholder="kg"
                      />
                      <Button variant="outline-danger" onClick={() => quitarPieza(p.id)}>
                        ✕
                      </Button>
                    </InputGroup>
                  ))}
                </div>
                <div className="text-end text-muted small">
                  {pesosPiezas.length} pieza(s) — Total: <strong>{kilosTotal.toFixed(3)} kg</strong>
                </div>
              </div>
            )}

            {porcentajePreview !== null && (
              <Alert variant="light" className="border text-center py-2 mb-3">
                Rendimiento: <strong className="fs-5">{porcentajePreview.toFixed(4)}</strong> litros por kilo
              </Alert>
            )}

            {/* ---------- Insumos gastados ---------- */}
            <div className="border rounded p-3 mb-3">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <div>
                  <strong>¿Qué se gastó para hacerlo?</strong>
                  <div className="text-muted small">
                    Lo que cargue aquí se descuenta del inventario en cuanto guarde el lote.
                  </div>
                </div>
                <Button size="sm" variant="outline-success" onClick={agregarLineaInsumo}>
                  + Agregar insumo
                </Button>
              </div>

              {formulaSugerida && lineasInsumos.length === 0 && (
                <Alert variant="light" className="border py-2 d-flex flex-wrap align-items-center gap-2">
                  <span className="small">
                    El último {formulaSugerida.producto} ({formatoCorto(formulaSugerida.fecha)}) gastó{' '}
                    {formulaSugerida.insumos_usados
                      .map((i) => `${i.cantidad} ${i.unidad_medida} de ${i.nombre}`)
                      .join(', ')}
                    .
                  </span>
                  <Button size="sm" variant="success" className="ms-auto" onClick={aplicarFormulaSugerida}>
                    Usar esa fórmula
                  </Button>
                </Alert>
              )}

              {/* Leche: no sale del inventario, pero sí lleva precio. */}
              <div className="mb-3">
                <Form.Label className="small text-muted mb-1">
                  Precio de la leche — {litrosTotal > 0 ? `${litrosTotal} litros en este lote` : 'cargue los litros arriba'}
                </Form.Label>
                <InputGroup>
                  <Form.Select value={monedaLeche} onChange={(e) => setMonedaLeche(e.target.value)} style={{ maxWidth: 120 }}>
                    {MONEDAS_LOTE.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control
                    type="number"
                    min="0"
                    step="0.01"
                    value={precioLeche}
                    onChange={(e) => setPrecioLeche(e.target.value)}
                    placeholder="0.00"
                  />
                  <InputGroup.Text>por litro</InputGroup.Text>
                </InputGroup>
                <Form.Text className="text-muted">
                  La leche no se descuenta del inventario de productos: entra por el registro diario de los
                  productores. El precio se anota aquí para saber cuánto costó este lote.
                </Form.Text>
              </div>

              {lineasInsumos.length === 0 ? (
                <p className="text-muted small mb-0">
                  Sin insumos cargados todavía. Agregue la sal, el cuajo, los empaques y todo lo que se haya usado.
                </p>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {lineasInsumos.map((linea) => {
                    const insumo = buscarInsumo(linea.insumo_id);
                    const disponible = linea.insumo_id ? disponibleDe(linea.insumo_id) : null;
                    const excede = insumo && !vacio(linea.cantidad) && Number(linea.cantidad) > disponible;
                    return (
                      <div key={linea.id}>
                        <InputGroup>
                          <Form.Select
                            value={linea.insumo_id}
                            onChange={(e) => cambiarLineaInsumo(linea.id, 'insumo_id', e.target.value)}
                          >
                            <option value="">Elija el insumo</option>
                            {insumosActivos.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.nombre} ({Number(i.stock_actual)} {i.unidad_medida} disponibles)
                              </option>
                            ))}
                          </Form.Select>
                          <Form.Control
                            type="number"
                            min="0"
                            step="0.01"
                            value={linea.cantidad}
                            isInvalid={excede}
                            onChange={(e) => cambiarLineaInsumo(linea.id, 'cantidad', e.target.value)}
                            placeholder="Cantidad"
                            style={{ maxWidth: 140 }}
                          />
                          <InputGroup.Text>{insumo?.unidad_medida || '—'}</InputGroup.Text>
                          <Button variant="outline-danger" onClick={() => quitarLineaInsumo(linea.id)}>
                            ✕
                          </Button>
                        </InputGroup>
                        {excede && (
                          <div className="text-danger small mt-1">
                            Solo hay {disponible} {insumo.unidad_medida} de {insumo.nombre}.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {costoEstimado.length > 0 && (
                <div className="text-end text-muted small mt-3 pt-2 border-top">
                  Costo estimado del lote:{' '}
                  {costoEstimado.map((c) => (
                    <strong key={c.moneda} className="ms-2">
                      {c.monto.toFixed(2)} {c.moneda}
                    </strong>
                  ))}
                  <div>Con los precios de referencia del inventario y el precio de leche que puso arriba.</div>
                </div>
              )}
            </div>

            <Form.Group>
              <Form.Label>Notas (opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModal(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Produccion;