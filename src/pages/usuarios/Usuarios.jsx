import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, Card } from 'react-bootstrap';
import * as usuariosApi from '../../api/usuarios.api';
import * as sucursalesApi from '../../api/sucursales.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { vacio } from '../../utils/fechas';

const COLOR_ROL = {
  admin: 'danger',
  contabilidad: 'info',
  operador: 'primary',
  sucursal: 'success',
};

const formVacio = {
  nombre: '',
  email: '',
  password: '',
  rol: 'operador',
  sucursal_id: '',
};

const detalleError = (err) => {
  if (err?.response) return err.response.data?.message || `El servidor respondió ${err.response.status}.`;
  if (err?.request) return 'El servidor no respondió. Revise la conexión.';
  return err?.message || 'Error desconocido.';
};

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [sucursales, setSucursales] = useState([]);
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

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [usuarioPassword, setUsuarioPassword] = useState(null);
  const [passwordNueva, setPasswordNueva] = useState('');
  const [errorPassword, setErrorPassword] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [respUsuarios, respSucursales] = await Promise.all([
        usuariosApi.listarUsuarios(),
        sucursalesApi.listarSucursales({ activo: 'true' }),
      ]);
      setUsuarios(respUsuarios?.data || []);
      setRoles(respUsuarios?.roles || []);
      setSucursales(respSucursales?.data || []);
    } catch (err) {
      setError(`No se pudieron cargar los usuarios. ${detalleError(err)}`);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (!verInactivos && !u.activo) return false;
      if (texto && !u.nombre.toLowerCase().includes(texto) && !u.email.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [usuarios, busqueda, verInactivos]);

  const esSucursal = form.rol === 'sucursal';
  const descripcionRol = roles.find((r) => r.valor === form.rol)?.descripcion;

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(formVacio);
    setErrorForm('');
    setMostrarModal(true);
  };

  const abrirEditar = (u) => {
    setEditandoId(u.id);
    setForm({
      nombre: u.nombre || '',
      email: u.email || '',
      password: '',
      rol: u.rol || 'operador',
      sucursal_id: u.sucursal_id ? String(u.sucursal_id) : '',
    });
    setErrorForm('');
    setMostrarModal(true);
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    setErrorForm('');
    if (!form.nombre.trim()) return setErrorForm('Escriba el nombre.');
    if (!form.email.trim()) return setErrorForm('Escriba el email.');
    if (!editandoId && form.password.length < 6) {
      return setErrorForm('La contraseña debe tener mínimo 6 caracteres.');
    }
    if (esSucursal && !form.sucursal_id) {
      return setErrorForm('Elija a qué sucursal pertenece este usuario.');
    }

    const payload = {
      nombre: form.nombre.trim(),
      email: form.email.trim().toLowerCase(),
      rol: form.rol,
      sucursal_id: esSucursal ? Number(form.sucursal_id) : null,
    };

    setGuardando(true);
    try {
      if (editandoId) {
        await usuariosApi.actualizarUsuario(editandoId, payload);
      } else {
        await usuariosApi.crearUsuario({ ...payload, password: form.password });
      }
      setMostrarModal(false);
      setAviso(editandoId ? 'Usuario actualizado.' : 'Usuario creado.');
      await cargar();
    } catch (err) {
      setErrorForm(`No se pudo guardar. ${detalleError(err)}`);
    } finally {
      setGuardando(false);
    }
  };

  const abrirPassword = (u) => {
    setUsuarioPassword(u);
    setPasswordNueva('');
    setErrorPassword('');
    setMostrarPassword(true);
  };

  const guardarPassword = async (ev) => {
    ev.preventDefault();
    setErrorPassword('');
    if (passwordNueva.length < 6) return setErrorPassword('Mínimo 6 caracteres.');

    try {
      const respuesta = await usuariosApi.cambiarPasswordUsuario(usuarioPassword.id, passwordNueva);
      setMostrarPassword(false);
      setAviso(respuesta?.message || 'Contraseña actualizada.');
    } catch (err) {
      setErrorPassword(detalleError(err));
    }
  };

  const cambiarEstado = async (u) => {
    try {
      if (u.activo) {
        if (!window.confirm(`Eliminar a ${u.nombre}? No podrá volver a entrar.`)) return;
        await usuariosApi.desactivarUsuario(u.id);
        setAviso('Usuario desactivado.');
      } else {
        await usuariosApi.actualizarUsuario(u.id, { activo: true });
        setAviso('Usuario reactivado.');
      }
      await cargar();
    } catch (err) {
      setError(detalleError(err));
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando usuarios..." />;

  return (
    <div>
      <div className="page-header mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Usuarios</h4>
          <p className="text-muted mb-0">
            Quién entra al sistema y hasta dónde llega. Un usuario de sucursal solo ve lo suyo: lo que recibe y lo
            que vende.
          </p>
        </div>
        <Button variant="success" onClick={abrirNuevo}>
          <span className="btn-icon-plus">+</span>Nuevo usuario
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

      <Card>
        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <Form.Control
            type="search"
            size="sm"
            placeholder="Buscar por nombre o email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <Form.Check
            type="switch"
            id="ver-inactivos-usuarios"
            label="Ver desactivados"
            checked={verInactivos}
            onChange={(e) => setVerInactivos(e.target.checked)}
          />
        </Card.Header>

        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Sucursal</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((u) => (
              <tr key={u.id} className={u.activo ? undefined : 'text-muted'}>
                <td>
                  <span className={u.activo ? 'fw-semibold' : ''}>{u.nombre}</span>
                  {!u.activo && (
                    <Badge bg="secondary" className="ms-2">
                      Desactivado
                    </Badge>
                  )}
                </td>
                <td className="text-muted">{u.email}</td>
                <td>
                  <Badge bg={COLOR_ROL[u.rol] || 'secondary'}>{u.rol}</Badge>
                </td>
                <td className="text-muted">{u.Sucursal?.nombre || '—'}</td>
                <td className="text-end">
                  <div className="d-flex gap-2 justify-content-end flex-wrap">
                    <Button size="sm" variant="outline-secondary" onClick={() => abrirEditar(u)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline-primary" onClick={() => abrirPassword(u)}>
                      Contraseña
                    </Button>
                    <Button
                      size="sm"
                      variant={u.activo ? 'outline-danger' : 'outline-success'}
                      onClick={() => cambiarEstado(u)}
                    >
                      {u.activo ? 'Eliminar' : 'Reactivar'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  {busqueda ? `Nadie coincide con «${busqueda}».` : 'No hay usuarios que mostrar.'}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* ---------- Modal usuario ---------- */}
      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardar}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar usuario' : 'Nuevo usuario'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorForm && <Alert variant="danger">{errorForm}</Alert>}

            <div className="row g-3">
              <div className="col-12">
                <Form.Label>Nombre</Form.Label>
                <Form.Control
                  autoFocus
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div className="col-12">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="con el que va a entrar"
                />
              </div>

              {!editandoId && (
                <div className="col-12">
                  <Form.Label>Contraseña</Form.Label>
                  <Form.Control
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <Form.Text className="text-muted">
                    Se muestra en claro a propósito: hay que dictársela a la persona. Después ella no la puede
                    cambiar sola, se le asigna una nueva desde aquí.
                  </Form.Text>
                </div>
              )}

              <div className="col-12">
                <Form.Label>¿Qué va a poder hacer?</Form.Label>
                <Form.Select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value, sucursal_id: '' })}
                >
                  {(roles.length ? roles : [{ valor: 'operador' }]).map((r) => (
                    <option key={r.valor} value={r.valor}>
                      {r.valor}
                    </option>
                  ))}
                </Form.Select>
                {descripcionRol && <Form.Text className="text-muted">{descripcionRol}</Form.Text>}
              </div>

              {esSucursal && (
                <div className="col-12">
                  <Form.Label>¿De cuál sucursal?</Form.Label>
                  <Form.Select
                    value={form.sucursal_id}
                    onChange={(e) => setForm({ ...form, sucursal_id: e.target.value })}
                  >
                    <option value="">Elija la sucursal</option>
                    {sucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </Form.Select>
                  {sucursales.length === 0 ? (
                    <Form.Text className="text-danger">
                      No hay sucursales activas. Cree una primero en «Sucursales».
                    </Form.Text>
                  ) : (
                    <Form.Text className="text-muted">
                      Solo verá los despachos y las ventas de esa sucursal. No podrá ver las de las demás.
                    </Form.Text>
                  )}
                </div>
              )}
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

      {/* ---------- Modal contraseña ---------- */}
      <Modal show={mostrarPassword} onHide={() => setMostrarPassword(false)} centered>
        <Form onSubmit={guardarPassword}>
          <Modal.Header closeButton>
            <Modal.Title>Contraseña de {usuarioPassword?.nombre}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {errorPassword && <Alert variant="danger">{errorPassword}</Alert>}
            <Form.Label>Contraseña nueva</Form.Label>
            <Form.Control
              autoFocus
              type="text"
              value={passwordNueva}
              onChange={(e) => setPasswordNueva(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
            <Form.Text className="text-muted">
              Reemplaza la anterior de inmediato. Anótela antes de guardar: después no se puede volver a ver.
            </Form.Text>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarPassword(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit">
              Cambiar
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Usuarios;
