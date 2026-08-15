import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card } from 'react-bootstrap';
import * as equiposApi from '../../api/equipos.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { desempacar, vacio } from '../../utils/fechas';

const ESTADOS = [
  { valor: 'bueno', etiqueta: 'Bueno', color: 'success' },
  { valor: 'regular', etiqueta: 'Regular', color: 'warning' },
  { valor: 'dañado', etiqueta: 'Dañado', color: 'danger' },
];

const formVacio = {
  nombre: '',
  categoria: '',
  cantidad: '',
  estado: 'bueno',
  ubicacion: '',
  notas: '',
};

const detalleError = (err) => {
  if (err?.response) return err.response.data?.message || `El servidor respondió ${err.response.status}.`;
  if (err?.request) return 'El servidor no respondió. Revise la conexión.';
  return err?.message || 'Error desconocido.';
};

const colorEstado = (estado) => ESTADOS.find((e) => e.valor === estado)?.color || 'secondary';

const Equipos = () => {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [verArchivados, setVerArchivados] = useState(false);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  // Ids con un ajuste en curso: evita el doble clic en + y −.
  const [ajustando, setAjustando] = useState([]);

  const cargar = useCallback(async () => {
    setError('');
    try {
      setDatos(desempacar(await equiposApi.listarEquipos()) || null);
    } catch (err) {
      setError(`No se pudo cargar el inventario. ${detalleError(err)}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const equipos = datos?.equipos || [];

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return equipos.filter((e) => {
      if (!verArchivados && !e.activo) return false;
      if (filtroCategoria && (e.categoria || 'Sin categoría') !== filtroCategoria) return false;
      if (texto) {
        const enNombre = e.nombre.toLowerCase().includes(texto);
        const enUbicacion = (e.ubicacion || '').toLowerCase().includes(texto);
        if (!enNombre && !enUbicacion) return false;
      }
      return true;
    });
  }, [equipos, busqueda, filtroCategoria, verArchivados]);

  // Se agrupa por categoría para que el conteo físico siga el recorrido
  // natural: todos los envases juntos, después el mobiliario, etc.
  const grupos = useMemo(() => {
    const mapa = new Map();
    visibles.forEach((e) => {
      const clave = e.categoria || 'Sin categoría';
      const lista = mapa.get(clave) || [];
      lista.push(e);
      mapa.set(clave, lista);
    });
    return [...mapa.entries()]
      .map(([categoria, lista]) => ({
        categoria,
        lista,
        piezas: lista.filter((e) => e.activo).reduce((s, e) => s + (Number(e.cantidad) || 0), 0),
      }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria, 'es'));
  }, [visibles]);

  const opcionesCategoria = useMemo(() => {
    const usadas = datos?.categorias || [];
    const sugeridas = datos?.categorias_sugeridas || [];
    return [...new Set([...usadas, ...sugeridas])].sort((a, b) => a.localeCompare(b, 'es'));
  }, [datos]);

  // ---------- Alta y edición ----------
  const abrirNuevo = () => {
    setEditandoId(null);
    setForm({ ...formVacio, categoria: filtroCategoria === 'Sin categoría' ? '' : filtroCategoria });
    setErrorForm('');
    setMostrarModal(true);
  };

  const abrirEditar = (e) => {
    setEditandoId(e.id);
    setForm({
      nombre: e.nombre || '',
      categoria: e.categoria || '',
      cantidad: e.cantidad ?? '',
      estado: e.estado || 'bueno',
      ubicacion: e.ubicacion || '',
      notas: e.notas || '',
    });
    setErrorForm('');
    setMostrarModal(true);
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    setErrorForm('');
    if (!form.nombre.trim()) return setErrorForm('Escriba qué es.');

    const payload = {
      nombre: form.nombre.trim(),
      categoria: vacio(form.categoria) ? null : form.categoria.trim(),
      cantidad: vacio(form.cantidad) ? 0 : Number(form.cantidad),
      estado: form.estado,
      ubicacion: vacio(form.ubicacion) ? null : form.ubicacion.trim(),
      notas: vacio(form.notas) ? null : form.notas.trim(),
    };

    setGuardando(true);
    try {
      if (editandoId) await equiposApi.actualizarEquipo(editandoId, payload);
      else await equiposApi.crearEquipo(payload);
      setMostrarModal(false);
      setAviso(editandoId ? 'Equipo actualizado.' : 'Equipo agregado.');
      await cargar();
    } catch (err) {
      setErrorForm(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardando(false);
    }
  };

  /** Suma o resta de a uno mientras se cuenta, sin abrir el formulario. */
  const ajustar = async (equipo, cambio) => {
    if (ajustando.includes(equipo.id)) return;
    setAjustando((prev) => [...prev, equipo.id]);
    setError('');
    try {
      await equiposApi.ajustarCantidadEquipo(equipo.id, { cambio });
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    } finally {
      setAjustando((prev) => prev.filter((id) => id !== equipo.id));
    }
  };

  const cambiarEstado = async (equipo) => {
    if (equipo.activo) {
      if (!window.confirm(`¿Archivar ${equipo.nombre}? Deja de aparecer, pero no se borra.`)) return;
      try {
        await equiposApi.archivarEquipo(equipo.id);
        setAviso('Equipo archivado.');
        await cargar();
      } catch (err) {
        setError(detalleError(err));
      }
    } else {
      try {
        await equiposApi.actualizarEquipo(equipo.id, { activo: true });
        setAviso('Equipo reactivado.');
        await cargar();
      } catch (err) {
        setError(detalleError(err));
      }
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando equipos..." />;

  const totales = datos?.totales || { renglones: 0, piezas: 0, en_mal_estado: 0, por_categoria: [] };

  return (
    <div>
      <div className="page-header mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Equipos y mobiliario</h4>
          <p className="text-muted mb-0">
            Qué hay en la planta y cuánto: pimpinas, potes, mesas, tazas. Es solo para saber con qué se cuenta — no
            se descuenta al producir ni entra en la contabilidad.
          </p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          <span className="btn-icon-plus">+</span>Agregar
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

      {/* ---------- Resumen ---------- */}
      <Card className="mb-3">
        <Card.Body className="d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
          <div>
            <div className="fs-4 lh-1">
              <strong>{totales.piezas}</strong> <span className="fs-6 text-muted">piezas en total</span>
            </div>
            <div className="text-muted small mt-1">
              {totales.renglones} tipo(s) distinto(s)
              {totales.en_mal_estado > 0 && (
                <>
                  {' · '}
                  <span className="text-danger">{totales.en_mal_estado} marcado(s) como dañado</span>
                </>
              )}
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 justify-content-end">
            {(totales.por_categoria || []).map((c) => (
              <Badge
                key={c.categoria}
                bg={filtroCategoria === c.categoria ? 'success' : 'light'}
                text={filtroCategoria === c.categoria ? undefined : 'dark'}
                className="border"
                style={{ cursor: 'pointer', fontWeight: 'normal' }}
                onClick={() => setFiltroCategoria(filtroCategoria === c.categoria ? '' : c.categoria)}
              >
                {c.categoria}: <strong>{c.piezas}</strong>
              </Badge>
            ))}
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <Form.Control
              type="search"
              size="sm"
              placeholder="Buscar por nombre o lugar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ maxWidth: 240 }}
            />
            <Form.Select
              size="sm"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              style={{ maxWidth: 190 }}
            >
              <option value="">Todas las categorías</option>
              {(totales.por_categoria || []).map((c) => (
                <option key={c.categoria} value={c.categoria}>
                  {c.categoria}
                </option>
              ))}
            </Form.Select>
          </div>
          <Form.Check
            type="switch"
            id="ver-archivados-equipos"
            label="Ver archivados"
            checked={verArchivados}
            onChange={(e) => setVerArchivados(e.target.checked)}
          />
        </Card.Header>

        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Qué es</th>
              <th>Dónde está</th>
              <th>Estado</th>
              <th className="text-center" style={{ width: 190 }}>
                Cuántos hay
              </th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => (
              <React.Fragment key={grupo.categoria}>
                {grupos.length > 1 && (
                  <tr className="table-light">
                    <td colSpan={5} className="fw-semibold small text-uppercase text-muted">
                      {grupo.categoria} · {grupo.piezas} piezas
                    </td>
                  </tr>
                )}
                {grupo.lista.map((e) => {
                  const ocupado = ajustando.includes(e.id);
                  return (
                    <tr key={e.id} className={e.activo ? undefined : 'text-muted'}>
                      <td>
                        <span className={e.activo ? 'fw-semibold' : ''}>{e.nombre}</span>
                        {!e.activo && (
                          <Badge bg="secondary" className="ms-2">
                            Archivado
                          </Badge>
                        )}
                        {e.notas && <div className="text-muted small">{e.notas}</div>}
                      </td>
                      <td className="text-muted">{e.ubicacion || '—'}</td>
                      <td>
                        <Badge bg={colorEstado(e.estado)}>
                          {ESTADOS.find((x) => x.valor === e.estado)?.etiqueta || e.estado}
                        </Badge>
                      </td>
                      <td>
                        {/* Los botones de a uno son para ir contando en
                            sitio, sin abrir el formulario cada vez. */}
                        <div className="d-flex align-items-center justify-content-center gap-2">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => ajustar(e, -1)}
                            disabled={ocupado || !e.activo || Number(e.cantidad) <= 0}
                            aria-label={`Quitar uno de ${e.nombre}`}
                          >
                            −
                          </Button>
                          <span className="fs-5 fw-semibold" style={{ minWidth: 44, textAlign: 'center' }}>
                            {e.cantidad}
                          </span>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => ajustar(e, 1)}
                            disabled={ocupado || !e.activo}
                            aria-label={`Agregar uno de ${e.nombre}`}
                          >
                            +
                          </Button>
                        </div>
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-2 justify-content-end">
                          <Button size="sm" variant="outline-secondary" onClick={() => abrirEditar(e)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant={e.activo ? 'outline-danger' : 'outline-success'}
                            onClick={() => cambiarEstado(e)}
                          >
                            {e.activo ? 'Archivar' : 'Reactivar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}

            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  {busqueda || filtroCategoria
                    ? 'Nada coincide con lo que buscó.'
                    : 'Todavía no hay nada cargado. Empiece con «Agregar».'}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Modal ---------- */}
      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar equipo' : 'Agregar al inventario'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorForm && <Alert variant="danger">{errorForm}</Alert>}

            <div className="row g-3">
              <div className="col-sm-7">
                <Form.Label>¿Qué es?</Form.Label>
                <Form.Control
                  autoFocus
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Pimpinas, potes, tazas, mesas..."
                />
              </div>
              <div className="col-sm-5">
                <Form.Label>¿Cuántos hay?</Form.Label>
                <Form.Control
                  type="number"
                  min="0"
                  step="1"
                  value={form.cantidad}
                  onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="col-sm-7">
                <Form.Label>Categoría (opcional)</Form.Label>
                <Form.Control
                  list="categorias-equipos"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Envases, mobiliario..."
                />
                <datalist id="categorias-equipos">
                  {opcionesCategoria.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <Form.Text className="text-muted">Solo sirve para agrupar. Puede escribir una nueva.</Form.Text>
              </div>
              <div className="col-sm-5">
                <Form.Label>Estado</Form.Label>
                <Form.Select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  {ESTADOS.map((e) => (
                    <option key={e.valor} value={e.valor}>
                      {e.etiqueta}
                    </option>
                  ))}
                </Form.Select>
              </div>

              <div className="col-12">
                <Form.Label>¿Dónde está? (opcional)</Form.Label>
                <Form.Control
                  value={form.ubicacion}
                  onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                  placeholder="Sala de proceso, cava, oficina..."
                />
              </div>

              <div className="col-12">
                <Form.Label>Nota (opcional)</Form.Label>
                <Form.Control
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Dos están rotas, se prestaron tres..."
                />
              </div>
            </div>
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

export default Equipos;
