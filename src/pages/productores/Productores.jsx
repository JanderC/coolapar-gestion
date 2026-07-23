import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup } from 'react-bootstrap';
import * as productoresApi from '../../api/productores.api';
import * as rutasApi from '../../api/rutas.api';
import ColorBadge from '../../components/common/ColorBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';

// Paleta de niveles de precio. Se pueden repetir entre productores:
// el color agrupa a todos los que entregan la leche al mismo precio.
const PALETA_PRECIO = [
  '#E53935', '#FB8C00', '#FDD835', '#43A047', '#00897B',
  '#1E88E5', '#3949AB', '#8E24AA', '#6D4C41', '#546E7A',
];

const COLORES_RUTA = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00897B', '#6D4C41', '#3949AB'];

const OPCIONES_MONEDA = [
  { codigo: 'BS', etiqueta: 'Bs. — Bolívares' },
  { codigo: 'USD', etiqueta: '$ — Dólares' },
  { codigo: 'COP', etiqueta: 'COL$ — Pesos colombianos' },
];

const formVacio = {
  nombre: '',
  ruta_id: '',
  telefono: '',
  direccion: '',
  precio_litro_base: '',
  moneda: 'BS',
  color_identificativo: '',
};

const formRutaVacio = { nombre: '', color_identificativo: COLORES_RUTA[0], procedencia: '', descripcion: '' };

const vacio = (v) => v === undefined || v === null || v === '';

// Postgres rechaza '' en numéricos y en la FK: se envía null.
const construirPayload = (form) => ({
  nombre: form.nombre.trim(),
  ruta_id: vacio(form.ruta_id) ? null : Number(form.ruta_id),
  telefono: vacio(form.telefono) ? null : form.telefono.trim(),
  direccion: vacio(form.direccion) ? null : form.direccion.trim(),
  precio_litro_base: vacio(form.precio_litro_base) ? null : Number(form.precio_litro_base),
  moneda: form.moneda || 'BS',
  color_identificativo: vacio(form.color_identificativo) ? null : form.color_identificativo,
});

const mismoNivel = (p, precio, moneda) =>
  p.precio_litro_base !== null &&
  p.precio_litro_base !== undefined &&
  Number(p.precio_litro_base) === Number(precio) &&
  (p.moneda || 'BS') === moneda;

const Punto = ({ color, size = 14 }) => (
  <span
    style={{
      backgroundColor: color || 'transparent',
      border: color ? '1px solid rgba(0,0,0,.15)' : '1px dashed #bbb',
      width: size,
      height: size,
      borderRadius: '50%',
      display: 'inline-block',
      flexShrink: 0,
    }}
  />
);

const Productores = () => {
  const { formatearMontoEnMoneda } = useMoneda();

  const [productores, setProductores] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [filtroRuta, setFiltroRuta] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  // Modal rápido para crear una ruta/zona sin salir de esta pantalla
  const [mostrarModalRuta, setMostrarModalRuta] = useState(false);
  const [formRuta, setFormRuta] = useState(formRutaVacio);
  const [guardandoRuta, setGuardandoRuta] = useState(false);
  const [errorRuta, setErrorRuta] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const [resProductores, resRutas] = await Promise.all([
        productoresApi.listarProductores(),
        rutasApi.listarRutas(),
      ]);
      setProductores(resProductores.data?.data ?? resProductores.data ?? []);
      setRutas(resRutas.data?.data ?? resRutas.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los productores. Reintente en unos segundos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // Niveles de precio: cada combinación precio + moneda y el color que la representa.
  const niveles = useMemo(() => {
    const mapa = new Map();
    productores.forEach((p) => {
      if (vacio(p.precio_litro_base)) return;
      const clave = `${p.moneda || 'BS'}|${Number(p.precio_litro_base)}`;
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          clave,
          moneda: p.moneda || 'BS',
          precio: Number(p.precio_litro_base),
          color: p.color_identificativo || null,
          cantidad: 0,
        });
      }
      const nivel = mapa.get(clave);
      nivel.cantidad += 1;
      if (!nivel.color && p.color_identificativo) nivel.color = p.color_identificativo;
    });
    return [...mapa.values()].sort((a, b) => a.moneda.localeCompare(b.moneda) || a.precio - b.precio);
  }, [productores]);

  // Color ya usado por otros productores con ese mismo precio.
  const colorDelNivel = (precio, moneda) => {
    if (vacio(precio)) return null;
    const nivel = niveles.find((n) => n.precio === Number(precio) && n.moneda === moneda);
    return nivel?.color || null;
  };

  // Primer color de la paleta que aún no representa ningún nivel de precio.
  const colorLibre = () => {
    const usados = new Set(niveles.map((n) => n.color).filter(Boolean));
    return PALETA_PRECIO.find((c) => !usados.has(c)) || PALETA_PRECIO[niveles.length % PALETA_PRECIO.length];
  };

  const productoresVisibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return productores.filter((p) => {
      if (!verInactivos && !p.activo) return false;
      if (filtroRuta && String(p.ruta_id) !== String(filtroRuta)) return false;
      if (texto && !p.nombre.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [productores, busqueda, filtroRuta, verInactivos]);

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(formVacio);
    setErrorForm('');
    setMostrarModal(true);
  };

  const abrirEditar = (productor) => {
    setEditandoId(productor.id);
    setForm({
      nombre: productor.nombre || '',
      ruta_id: productor.ruta_id || '',
      telefono: productor.telefono || '',
      direccion: productor.direccion || '',
      precio_litro_base: productor.precio_litro_base ?? '',
      moneda: productor.moneda || 'BS',
      color_identificativo: productor.color_identificativo || '',
    });
    setErrorForm('');
    setMostrarModal(true);
  };

  // Al cambiar precio o moneda, el color sigue al nivel de precio:
  // si ya existe ese precio, reutiliza su color; si es nuevo, toma uno libre.
  const cambiarPrecio = (valor) => {
    setForm((prev) => {
      const existente = colorDelNivel(valor, prev.moneda);
      return { ...prev, precio_litro_base: valor, color_identificativo: existente || prev.color_identificativo };
    });
  };

  const cambiarMoneda = (valor) => {
    setForm((prev) => {
      const existente = colorDelNivel(prev.precio_litro_base, valor);
      return { ...prev, moneda: valor, color_identificativo: existente || prev.color_identificativo };
    });
  };

  const guardar = async (e) => {
    e.preventDefault();
    setErrorForm('');

    const payload = construirPayload(form);
    if (!payload.nombre) return setErrorForm('Escriba el nombre del productor.');
    if (!payload.ruta_id) return setErrorForm('Seleccione la ruta o zona de procedencia.');

    setGuardando(true);
    try {
      if (editandoId) {
        await productoresApi.actualizarProductor(editandoId, payload);
      } else {
        await productoresApi.crearProductor(payload);
      }
      setMostrarModal(false);
      setAviso(editandoId ? 'Productor actualizado.' : 'Productor registrado.');
      await cargar();
    } catch (err) {
      setErrorForm(err.response?.data?.message || 'No se pudo guardar el productor. Revise los datos e intente de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (productor) => {
    const desactivando = productor.activo;
    const pregunta = desactivando
      ? `¿Desactivar a ${productor.nombre}? Dejará de aparecer en los registros diarios.`
      : `¿Reactivar a ${productor.nombre}?`;
    if (!window.confirm(pregunta)) return;

    setError('');
    try {
      if (desactivando) {
        await productoresApi.eliminarProductor(productor.id);
      } else {
        await productoresApi.actualizarProductor(productor.id, { activo: true });
      }
      setAviso(desactivando ? 'Productor desactivado.' : 'Productor reactivado.');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cambiar el estado del productor.');
    }
  };

  const abrirNuevaRuta = () => {
    setFormRuta(formRutaVacio);
    setErrorRuta('');
    setMostrarModalRuta(true);
  };

  const guardarRuta = async (e) => {
    e.preventDefault();
    setGuardandoRuta(true);
    setErrorRuta('');
    try {
      const respuesta = await rutasApi.crearRuta(formRuta);
      const nuevaRuta = respuesta.data?.data ?? respuesta.data;
      const { data: resRutas } = await rutasApi.listarRutas();
      setRutas(resRutas?.data ?? resRutas ?? []);
      setForm((prev) => ({ ...prev, ruta_id: nuevaRuta.id }));
      setMostrarModalRuta(false);
    } catch (err) {
      setErrorRuta(err.response?.data?.message || 'No se pudo crear la ruta.');
    } finally {
      setGuardandoRuta(false);
    }
  };

  const rutaSeleccionada = rutas.find((r) => String(r.id) === String(form.ruta_id));
  const mismoPrecioOtros = vacio(form.precio_litro_base)
    ? []
    : productores.filter((p) => p.id !== editandoId && mismoNivel(p, form.precio_litro_base, form.moneda));

  if (cargando) return <LoadingSpinner mensaje="Cargando productores..." />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-3 gap-3 flex-wrap">
        <div>
          <h4 className="mb-1">Productores</h4>
          <p className="text-muted mb-0">
            La ruta indica de dónde viene la leche. El color del productor indica a qué precio por litro se le paga:
            todos los que cobran lo mismo llevan el mismo color.
          </p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          + Nuevo productor
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

      {niveles.length > 0 && (
        <div className="bg-white border rounded p-3 mb-3">
          <div className="text-muted small mb-2">Niveles de precio</div>
          <div className="d-flex flex-wrap gap-3">
            {niveles.map((n) => (
              <div key={n.clave} className="d-flex align-items-center gap-2">
                <Punto color={n.color} size={16} />
                <span className="fw-semibold">{formatearMontoEnMoneda(n.precio, n.moneda)}</span>
                <span className="text-muted small">
                  {n.cantidad} {n.cantidad === 1 ? 'productor' : 'productores'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <Form.Control
          style={{ maxWidth: 260 }}
          placeholder="Buscar por nombre"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Form.Select style={{ maxWidth: 260 }} value={filtroRuta} onChange={(e) => setFiltroRuta(e.target.value)}>
          <option value="">Todas las rutas</option>
          {rutas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </Form.Select>
        <Form.Check
          type="switch"
          id="ver-inactivos"
          label="Ver inactivos"
          checked={verInactivos}
          onChange={(e) => setVerInactivos(e.target.checked)}
        />
        <span className="text-muted small ms-auto">{productoresVisibles.length} en pantalla</span>
      </div>

      <Table hover responsive bordered className="bg-white align-middle">
        <thead>
          <tr>
            <th>Productor</th>
            <th>Ruta / Procedencia</th>
            <th>Teléfono</th>
            <th>Dirección</th>
            <th>Precio por litro</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {productoresVisibles.map((p) => (
            <tr key={p.id}>
              <td className="fw-semibold">{p.nombre}</td>
              <td>
                {p.Ruta ? (
                  <div>
                    <ColorBadge color={p.Ruta.color_identificativo} texto={p.Ruta.nombre} />
                    {p.Ruta.procedencia && <div className="text-muted small mt-1">{p.Ruta.procedencia}</div>}
                  </div>
                ) : (
                  <span className="text-muted">Sin ruta asignada</span>
                )}
              </td>
              <td>{p.telefono || '—'}</td>
              <td>{p.direccion || '—'}</td>
              <td>
                {vacio(p.precio_litro_base) ? (
                  <span className="text-muted">Sin precio</span>
                ) : (
                  <div className="d-flex align-items-center gap-2">
                    <Punto color={p.color_identificativo} />
                    <span>{formatearMontoEnMoneda(p.precio_litro_base, p.moneda)}</span>
                  </div>
                )}
              </td>
              <td>
                <Badge bg={p.activo ? 'success' : 'secondary'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
              </td>
              <td className="text-end text-nowrap">
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirEditar(p)}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant={p.activo ? 'outline-danger' : 'outline-success'}
                  onClick={() => cambiarEstado(p)}
                >
                  {p.activo ? 'Desactivar' : 'Reactivar'}
                </Button>
              </td>
            </tr>
          ))}
          {productoresVisibles.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-muted py-4">
                {productores.length === 0
                  ? 'Todavía no hay productores. Registre el primero para empezar a cargar litros.'
                  : 'Ningún productor coincide con el filtro.'}
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* ---------- Modal productor ---------- */}
      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar productor' : 'Nuevo productor'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorForm && <Alert variant="danger">{errorForm}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>Nombre</Form.Label>
              <Form.Control
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Ruta / Zona</Form.Label>
              <div className="d-flex align-items-center gap-2">
                <Form.Select
                  value={form.ruta_id}
                  onChange={(e) => setForm({ ...form, ruta_id: e.target.value })}
                  required
                >
                  <option value="">Selecciona una ruta</option>
                  {rutas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} {r.procedencia ? `— ${r.procedencia}` : ''}
                    </option>
                  ))}
                </Form.Select>
                <Button size="sm" variant="outline-primary" className="text-nowrap" onClick={abrirNuevaRuta}>
                  + Ruta
                </Button>
              </div>
              {rutaSeleccionada && (
                <div className="mt-2">
                  <ColorBadge
                    color={rutaSeleccionada.color_identificativo || '#ccc'}
                    texto={rutaSeleccionada.nombre}
                  />
                </div>
              )}
            </Form.Group>

            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <Form.Label>Teléfono</Form.Label>
                <Form.Control
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className="col-sm-6">
                <Form.Label>Dirección</Form.Label>
                <Form.Control
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                />
              </div>
            </div>

            <Form.Group className="mb-2">
              <Form.Label>Precio por litro</Form.Label>
              <InputGroup>
                <Form.Select
                  value={form.moneda}
                  onChange={(e) => cambiarMoneda(e.target.value)}
                  style={{ maxWidth: 190 }}
                >
                  {OPCIONES_MONEDA.map((op) => (
                    <option key={op.codigo} value={op.codigo}>
                      {op.etiqueta}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_litro_base}
                  onChange={(e) => cambiarPrecio(e.target.value)}
                  placeholder="0.00"
                />
              </InputGroup>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="d-flex align-items-center gap-2">
                Color del precio
                <Punto color={form.color_identificativo} size={16} />
              </Form.Label>
              <div className="d-flex gap-2 flex-wrap">
                {PALETA_PRECIO.map((c) => (
                  <span
                    key={c}
                    role="button"
                    tabIndex={0}
                    aria-label={`Usar color ${c}`}
                    onClick={() => setForm({ ...form, color_identificativo: c })}
                    onKeyDown={(e) => e.key === 'Enter' && setForm({ ...form, color_identificativo: c })}
                    style={{
                      backgroundColor: c,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'inline-block',
                      border: form.color_identificativo === c ? '3px solid #333' : '2px solid #ddd',
                    }}
                  />
                ))}
                {form.color_identificativo && (
                  <Button
                    size="sm"
                    variant="link"
                    className="text-muted p-0 ms-1"
                    onClick={() => setForm({ ...form, color_identificativo: '' })}
                  >
                    Quitar color
                  </Button>
                )}
              </div>
              <Form.Text className="text-muted">
                {mismoPrecioOtros.length > 0
                  ? `Otros ${mismoPrecioOtros.length} productor(es) cobran este mismo precio: se sugiere su color para agruparlos.`
                  : 'Precio nuevo: elija un color libre. Puede repetir el color de otro productor cuando compartan precio.'}
              </Form.Text>
              {!form.color_identificativo && !vacio(form.precio_litro_base) && (
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setForm({ ...form, color_identificativo: colorLibre() })}
                  >
                    Sugerir color
                  </Button>
                </div>
              )}
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

      {/* ---------- Modal ruta ---------- */}
      <Modal show={mostrarModalRuta} onHide={() => setMostrarModalRuta(false)} centered>
        <Form onSubmit={guardarRuta}>
          <Modal.Header closeButton>
            <Modal.Title>Nueva ruta / zona</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorRuta && <Alert variant="danger">{errorRuta}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>Nombre de la ruta</Form.Label>
              <Form.Control
                value={formRuta.nombre}
                onChange={(e) => setFormRuta({ ...formRuta, nombre: e.target.value })}
                placeholder="Ej: Ruta Tarazona"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Color de la ruta</Form.Label>
              <div className="d-flex gap-2 flex-wrap">
                {COLORES_RUTA.map((c) => (
                  <span
                    key={c}
                    role="button"
                    tabIndex={0}
                    aria-label={`Usar color ${c}`}
                    onClick={() => setFormRuta({ ...formRuta, color_identificativo: c })}
                    onKeyDown={(e) => e.key === 'Enter' && setFormRuta({ ...formRuta, color_identificativo: c })}
                    style={{
                      backgroundColor: c,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'inline-block',
                      border: formRuta.color_identificativo === c ? '3px solid #333' : '2px solid #ddd',
                    }}
                  />
                ))}
              </div>
              <Form.Text className="text-muted">
                El color de la ruta sí es único: identifica la zona, no al productor.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Procedencia (de dónde vienen)</Form.Label>
              <Form.Control
                value={formRuta.procedencia}
                onChange={(e) => setFormRuta({ ...formRuta, procedencia: e.target.value })}
                placeholder="Ej: Zona norte, comunidad El Rosario"
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Descripción (opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formRuta.descripcion}
                onChange={(e) => setFormRuta({ ...formRuta, descripcion: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModalRuta(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoRuta}>
              {guardandoRuta ? 'Guardando...' : 'Guardar ruta'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Productores;