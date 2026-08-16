import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, Card } from 'react-bootstrap';
import * as sucursalesApi from '../../api/sucursales.api';
import * as ventasApi from '../../api/ventas.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { vacio } from '../../utils/fechas';

const MONEDAS = ['BS', 'USD', 'COP'];

const formVacio = {
  nombre: '',
  encargado: '',
  telefono: '',
  direccion: '',
  moneda: 'BS',
  notas: '',
};

const detalleError = (err) => {
  if (err?.response) return err.response.data?.message || `El servidor respondió ${err.response.status}.`;
  if (err?.request) return 'El servidor no respondió. Revise la conexión.';
  return err?.message || 'Error desconocido.';
};

const Sucursales = () => {
  const [sucursales, setSucursales] = useState([]);
  const [usuariosVinculados, setUsuariosVinculados] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [inventarios, setInventarios] = useState([]);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      // La respuesta trae la lista en data y un aviso al lado, así que no
      // se puede desempacar y ya.
      const respuesta = await sucursalesApi.listarSucursales();
      setSucursales(respuesta?.data || []);
      setUsuariosVinculados(respuesta?.usuarios_vinculados !== false);

      // El inventario de cada sucursal se pide aparte: si esa consulta
      // falla, la pantalla de sucursales igual sirve.
      try {
        const respInv = await ventasApi.inventariosDeSucursales();
        setInventarios(respInv?.data || []);
      } catch {
        setInventarios([]);
      }
    } catch (err) {
      setError(`No se pudieron cargar las sucursales. ${detalleError(err)}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(
    () => sucursales.filter((s) => verArchivadas || s.activo),
    [sucursales, verArchivadas]
  );

  const abrirNueva = () => {
    setEditandoId(null);
    setForm(formVacio);
    setErrorForm('');
    setMostrarModal(true);
  };

  const abrirEditar = (s) => {
    setEditandoId(s.id);
    setForm({
      nombre: s.nombre || '',
      encargado: s.encargado || '',
      telefono: s.telefono || '',
      direccion: s.direccion || '',
      moneda: s.moneda || 'BS',
      notas: s.notas || '',
    });
    setErrorForm('');
    setMostrarModal(true);
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    setErrorForm('');
    if (!form.nombre.trim()) return setErrorForm('Escriba el nombre de la sucursal.');

    const payload = {
      nombre: form.nombre.trim(),
      encargado: vacio(form.encargado) ? null : form.encargado.trim(),
      telefono: vacio(form.telefono) ? null : form.telefono.trim(),
      direccion: vacio(form.direccion) ? null : form.direccion.trim(),
      moneda: form.moneda,
      notas: vacio(form.notas) ? null : form.notas.trim(),
    };

    setGuardando(true);
    try {
      if (editandoId) await sucursalesApi.actualizarSucursal(editandoId, payload);
      else await sucursalesApi.crearSucursal(payload);
      setMostrarModal(false);
      setAviso(editandoId ? 'Sucursal actualizada.' : 'Sucursal creada.');
      await cargar();
    } catch (err) {
      setErrorForm(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (s) => {
    try {
      if (s.activo) {
        if (!window.confirm(`¿Archivar ${s.nombre}? Sus ventas y despachos se conservan.`)) return;
        await sucursalesApi.archivarSucursal(s.id);
        setAviso('Sucursal archivada.');
      } else {
        await sucursalesApi.actualizarSucursal(s.id, { activo: true });
        setAviso('Sucursal reactivada.');
      }
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando sucursales..." />;

  return (
    <div>
      <div className="page-header mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Sucursales</h4>
          <p className="text-muted mb-0">
            Los puntos a los que se les despacha producto. Cada una tendrá su usuario, que solo verá lo suyo: lo que
            recibe y lo que vende.
          </p>
        </div>
        <Button variant="success" onClick={abrirNueva}>
          <span className="btn-icon-plus">+</span>Nueva sucursal
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

      {!usuariosVinculados && (
        <Alert variant="warning">
          Falta ejecutar la migración: la tabla de usuarios todavía no tiene la columna <code>sucursal_id</code>.
          Hasta que se agregue, no se pueden crear usuarios de sucursal.
        </Alert>
      )}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span className="text-muted small">
            {visibles.filter((s) => s.activo).length} sucursal(es) activa(s)
          </span>
          <Form.Check
            type="switch"
            id="ver-archivadas-sucursales"
            label="Ver archivadas"
            checked={verArchivadas}
            onChange={(e) => setVerArchivadas(e.target.checked)}
          />
        </Card.Header>

        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Sucursal</th>
              <th>Encargado</th>
              <th>Contacto</th>
              <th>Se le factura en</th>
              <th>Usuarios con acceso</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((s) => (
              <tr key={s.id} className={s.activo ? undefined : 'text-muted'}>
                <td>
                  <span className={s.activo ? 'fw-semibold' : ''}>{s.nombre}</span>
                  {!s.activo && (
                    <Badge bg="secondary" className="ms-2">
                      Archivada
                    </Badge>
                  )}
                  {s.direccion && <div className="text-muted small">{s.direccion}</div>}
                </td>
                <td className="text-muted">{s.encargado || '—'}</td>
                <td className="text-muted">{s.telefono || '—'}</td>
                <td>
                  <Badge bg="light" text="dark">
                    {s.moneda}
                  </Badge>
                </td>
                <td>
                  {(s.Usuarios || []).length === 0 ? (
                    <span className="text-warning-emphasis small">Sin usuario todavía</span>
                  ) : (
                    <div className="d-flex flex-wrap gap-1">
                      {s.Usuarios.map((u) => (
                        <Badge key={u.id} bg={u.activo ? 'success' : 'secondary'}>
                          {u.nombre || u.email}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
                <td className="text-end">
                  <div className="d-flex gap-2 justify-content-end">
                    <Button size="sm" variant="outline-secondary" onClick={() => abrirEditar(s)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={s.activo ? 'outline-danger' : 'outline-success'}
                      onClick={() => cambiarEstado(s)}
                    >
                      {s.activo ? 'Archivar' : 'Reactivar'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  Todavía no hay sucursales. Cree la primera con «Nueva sucursal».
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Qué tiene cada sucursal ---------- */}
      {inventarios.length > 0 && (
        <Card className="mt-4">
          <Card.Header>
            <strong>Inventario de las sucursales</strong>
            <div className="text-muted small">
              Lo que cada una tiene ahora: lo que confirmó al recibir, más lo que cargó a mano —víveres y demás
              productos propios incluidos—, menos lo que ya vendió.
            </div>
          </Card.Header>
          <Card.Body className="d-flex flex-wrap gap-3">
            {inventarios.map((inv) => (
              <Card key={inv.sucursal.id} className="flex-grow-1" style={{ minWidth: 260 }}>
                <Card.Body className="py-3">
                  <div className="d-flex justify-content-between align-items-baseline">
                    <strong>{inv.sucursal.nombre}</strong>
                    <span className="text-muted small">{inv.totales.kilos} kg</span>
                  </div>

                  {inv.productos.length === 0 ? (
                    <div className="text-muted small mt-2">Sin producto en este momento.</div>
                  ) : (
                    <Table size="sm" className="mt-2 mb-0">
                      <tbody>
                        {inv.productos.map((p) => (
                          <tr key={p.producto}>
                            <td className="border-0 ps-0">
                              {p.producto}
                              {p.categoria && p.categoria !== 'Sin categoría' && (
                                <div className="text-muted small">{p.categoria}</div>
                              )}
                            </td>
                            <td className="border-0 pe-0 text-end fw-semibold">{p.kilos} kg</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card.Body>
              </Card>
            ))}
          </Card.Body>
        </Card>
      )}

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar sucursal' : 'Nueva sucursal'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorForm && <Alert variant="danger">{errorForm}</Alert>}

            <div className="row g-3">
              <div className="col-sm-8">
                <Form.Label>Nombre</Form.Label>
                <Form.Control
                  autoFocus
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Sucursal San Cristóbal"
                />
              </div>
              <div className="col-sm-4">
                <Form.Label>Se le factura en</Form.Label>
                <Form.Select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                  {MONEDAS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-sm-7">
                <Form.Label>Encargado (opcional)</Form.Label>
                <Form.Control
                  value={form.encargado}
                  onChange={(e) => setForm({ ...form, encargado: e.target.value })}
                  placeholder="Quién responde por la sucursal"
                />
              </div>
              <div className="col-sm-5">
                <Form.Label>Teléfono (opcional)</Form.Label>
                <Form.Control
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className="col-12">
                <Form.Label>Dirección (opcional)</Form.Label>
                <Form.Control
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                />
              </div>
              <div className="col-12">
                <Form.Label>Nota (opcional)</Form.Label>
                <Form.Control value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
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

export default Sucursales;