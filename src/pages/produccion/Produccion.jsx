import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Tabs, Tab } from 'react-bootstrap';
import * as produccionApi from '../../api/produccion.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { desempacar, formatoCorto, hoy, vacio } from '../../utils/fechas';

const PRODUCTOS_SUGERIDOS = ['Semiduro', 'Queso blanco', 'Queso duro', 'Requesón', 'Mantequilla', 'Suero'];

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

  useEffect(() => {
    cargarLotes();
    cargarResumen();
  }, [cargarResumen]);

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

  // ---------- Filas dinámicas ----------
  const agregarAporte = () => setAportesLitros((prev) => [...prev, { id: nuevoId(), origen: '', litros: '' }]);
  const quitarAporte = (id) => setAportesLitros((prev) => prev.filter((a) => a.id !== id));
  const cambiarAporte = (id, campo, valor) =>
    setAportesLitros((prev) => prev.map((a) => (a.id === id ? { ...a, [campo]: valor } : a)));

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
      setAportesLitros(l.detalle_litros.map((d) => ({ id: nuevoId(), origen: d.origen || '', litros: d.litros ?? '' })));
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

    setErrorForm('');
    setMostrarModal(true);
  };

  const guardarLote = async (e) => {
    e.preventDefault();
    setErrorForm('');

    if (!form.producto.trim()) return setErrorForm('Indique el producto que se elaboró.');
    if (litrosTotal <= 0) return setErrorForm('Indique los litros recibidos (directo o por aporte).');
    if (kilosTotal <= 0) return setErrorForm('Indique los kilos obtenidos (directo o por pieza).');

    const payload = {
      fecha: form.fecha,
      producto: form.producto.trim(),
      notas: vacio(form.notas) ? null : form.notas.trim(),
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
      await Promise.all([cargarLotes(), cargarResumen()]);
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
                  <div key={a.id} className="d-flex gap-2 mb-2">
                    <Form.Control
                      placeholder="Origen (ej: Yoar, Raul - parada 1)"
                      value={a.origen}
                      onChange={(e) => cambiarAporte(a.id, 'origen', e.target.value)}
                    />
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
