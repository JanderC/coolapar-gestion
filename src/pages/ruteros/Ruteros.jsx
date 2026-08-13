import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Alert, Badge, InputGroup, Card, Tabs, Tab } from 'react-bootstrap';
import * as ruterosApi from '../../api/ruteros.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';
import { OPCIONES_DIA, aNumero, desempacar, diaSemanaDeFecha, formatoCorto, hoy, largoCiclo, nombreDia, vacio } from '../../utils/fechas';

const OPCIONES_MONEDA = [
  { codigo: 'COP', etiqueta: 'COL$ — Pesos colombianos' },
  { codigo: 'BS', etiqueta: 'Bs. — Bolívares' },
  { codigo: 'USD', etiqueta: '$ — Dólares' },
];

/** Suma (o resta) días a una fecha yyyy-mm-dd, sin líos de zona horaria. */
const sumarDiasTexto = (texto, dias) => {
  const [anio, mes, dia] = String(texto).split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

/** Lunes de la semana a la que pertenece la fecha dada. */
const lunesDe = (texto) => {
  const [anio, mes, dia] = String(texto).split('-').map(Number);
  const diaSemanaNumero = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay(); // 0 = domingo
  return sumarDiasTexto(texto, diaSemanaNumero === 0 ? -6 : 1 - diaSemanaNumero);
};

const LOGO_URL = 'https://coolapar-gestion.vercel.app/coolapar-logo.png';

const formVacio = { nombre: '', telefono: '', precio_litro: '', moneda: 'COP' };

const Ruteros = () => {
  const { formatearMontoEnMoneda } = useMoneda();

  const [pestana, setPestana] = useState('hoja');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [ruteros, setRuteros] = useState([]);
  const [ruteroId, setRuteroId] = useState('');

  // El cliente elige la fecha exacta en que arranca la semana; el día
  // (lunes, martes...) se calcula solo. "Termina" sigue siendo por nombre de día.
  const [fechaInicio, setFechaInicio] = useState(hoy());
  const [diaFin, setDiaFin] = useState(0); // domingo
  const [semanaId, setSemanaId] = useState(null); // solo al reabrir del historial

  const [hoja, setHoja] = useState(null);
  const [dias, setDias] = useState([]);
  const [precioLitro, setPrecioLitro] = useState('');
  const [moneda, setMoneda] = useState('COP');
  const [historial, setHistorial] = useState([]);
  const [resumenHistorial, setResumenHistorial] = useState(null);
  const [filtroPago, setFiltroPago] = useState('');
  const [semanasMarcadas, setSemanasMarcadas] = useState([]);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [cargandoHoja, setCargandoHoja] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [errorForm, setErrorForm] = useState('');
  const [guardandoRutero, setGuardandoRutero] = useState(false);
  const [verInactivos, setVerInactivos] = useState(false);

  const rutero = useMemo(
    () => ruteros.find((r) => String(r.id) === String(ruteroId)) || null,
    [ruteros, ruteroId]
  );
  const cerrada = hoja?.semana?.estado === 'cerrada';

  const cargarRuteros = async () => {
    setCargando(true);
    setError('');
    try {
      setRuteros(desempacar(await ruterosApi.listarRuteros()) || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los ruteros.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarRuteros();
  }, []);

  const cargarHoja = useCallback(async () => {
    if (!ruteroId) {
      setHoja(null);
      setDias([]);
      return;
    }
    setCargandoHoja(true);
    setError('');
    try {
      const params = semanaId
        ? { rutero_id: ruteroId, semana_id: semanaId }
        : { rutero_id: ruteroId, fecha_inicio: fechaInicio, dia_fin: diaFin };

      const datos = desempacar(await ruterosApi.obtenerHojaRutero(params));
      setHoja(datos);
      setDias(
        datos.dias.map((d) => ({
          ...d,
          litros: d.litros === null ? '' : String(d.litros),
          sobrante: d.sobrante ? String(d.sobrante) : '',
          faltante: d.faltante ? String(d.faltante) : '',
          descripcion: d.descripcion || '',
        }))
      );
      setPrecioLitro(datos.precio_litro ? String(datos.precio_litro) : '');
      setMoneda(datos.moneda || 'COP');
      if (semanaId && datos.dias.length > 0) {
        setFechaInicio(datos.dias[0].fecha);
        setDiaFin(datos.semana.dia_fin);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo abrir la semana.');
    } finally {
      setCargandoHoja(false);
    }
  }, [ruteroId, fechaInicio, diaFin, semanaId]);

  useEffect(() => {
    cargarHoja();
  }, [cargarHoja]);

  const cargarHistorial = useCallback(async () => {
    if (!ruteroId) {
      setHistorial([]);
      setResumenHistorial(null);
      return;
    }
    try {
      // La respuesta trae el arreglo en data y el resumen al lado, así
      // que no se puede desempacar y ya.
      const respuesta = await ruterosApi.historialRutero(ruteroId, filtroPago ? { estado_pago: filtroPago } : {});
      setHistorial(respuesta?.data || []);
      setResumenHistorial(respuesta?.resumen || null);
      setSemanasMarcadas([]);
    } catch {
      setHistorial([]);
      setResumenHistorial(null);
    }
  }, [ruteroId, filtroPago]);

  const alternarSemana = (id) =>
    setSemanasMarcadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const todasMarcadas = historial.length > 0 && historial.every((s) => semanasMarcadas.includes(s.id));

  const alternarTodasSemanas = () =>
    setSemanasMarcadas(todasMarcadas ? [] : historial.map((s) => s.id));

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  const totales = useMemo(() => {
    const litros = dias.reduce((s, d) => s + aNumero(d.litros, 0), 0);
    const precio = aNumero(precioLitro, 0);
    return {
      litros: Math.round(litros * 100) / 100,
      sobrante: Math.round(dias.reduce((s, d) => s + aNumero(d.sobrante, 0), 0) * 100) / 100,
      faltante: Math.round(dias.reduce((s, d) => s + aNumero(d.faltante, 0), 0) * 100) / 100,
      pagar: Math.round(litros * precio * 100) / 100,
    };
  }, [dias, precioLitro]);

  const cambiarDia = (fecha, campo, valor) => {
    setDias((prev) => prev.map((d) => (d.fecha === fecha ? { ...d, [campo]: valor } : d)));
  };

  const cambiarFechaInicio = (valor) => {
    setSemanaId(null);
    setFechaInicio(valor);
  };

  const cambiarDiaFin = (valor) => {
    setSemanaId(null);
    setDiaFin(Number(valor));
  };

  const elegirRutero = (id) => {
    setSemanaId(null);
    setRuteroId(id);
    const r = ruteros.find((x) => String(x.id) === String(id));
    if (r) {
      if (aNumero(r.precio_litro, 0) > 0) setPrecioLitro(String(r.precio_litro));
      if (r.moneda) setMoneda(r.moneda);
    }
  };

  const cuerpoHoja = () => ({
    rutero_id: Number(ruteroId),
    semana_id: hoja.semana.id,
    precio_litro: aNumero(precioLitro, 0),
    moneda,
    dias: dias.map((d) => ({
      fecha: d.fecha,
      litros: vacio(d.litros) ? null : aNumero(d.litros, 0),
      sobrante: aNumero(d.sobrante, 0),
      faltante: aNumero(d.faltante, 0),
      descripcion: d.descripcion || null,
    })),
  });

  const guardarHoja = async () => {
    if (!hoja) return;
    if (aNumero(precioLitro, 0) <= 0) return setError('Indique cuánto se le paga al rutero por litro.');

    setGuardando(true);
    setError('');
    try {
      const datos = desempacar(await ruterosApi.guardarHojaRutero(cuerpoHoja()));
      setHoja(datos);
      setAviso(`Semana guardada: ${datos.totales.total_litros} litros.`);
      await cargarHistorial();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar la semana.');
    } finally {
      setGuardando(false);
    }
  };

  const registrarPago = async () => {
    if (!hoja || totales.litros <= 0) return setError('Cargue los litros antes de registrar el pago.');
    const resumen = `${totales.litros} litros × ${formatearMontoEnMoneda(aNumero(precioLitro, 0), moneda)} = ${formatearMontoEnMoneda(totales.pagar, moneda)}`;
    if (!window.confirm(`¿Registrar el pago de ${rutero?.nombre}?\n${resumen}`)) return;

    setGuardando(true);
    setError('');
    try {
      await ruterosApi.guardarHojaRutero(cuerpoHoja());
      await ruterosApi.registrarPagoRutero({
        rutero_id: Number(ruteroId),
        semana_id: hoja.semana.id,
        marcar_pagado: true,
      });
      setAviso('Pago registrado.');
      await cargarHoja();
      await cargarHistorial();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar el pago.');
    } finally {
      setGuardando(false);
    }
  };

  // ---------- Impresión ----------
  // Mismo formato y mismo logo que el registro diario de leche, para que
  // las hojas que se archivan se vean iguales vengan de donde vengan.

  const construirBloqueRutero = (datosHoja) => {
    const r = datosHoja.rutero;
    const diasHoja = datosHoja.dias || [];
    const precio = Number(datosHoja.precio_litro || 0);
    const monedaHoja = datosHoja.moneda || 'COP';

    const filas = diasHoja
      .map((d) => {
        const litros = d.litros === null || d.litros === undefined ? null : Number(d.litros);
        const sobrante = Number(d.sobrante || 0);
        const faltante = Number(d.faltante || 0);
        return `
          <tr>
            <td>${d.dia}</td>
            <td>${formatoCorto(d.fecha)}</td>
            <td class="num">${litros !== null ? litros : '—'}</td>
            <td class="num">${sobrante > 0 ? sobrante : '—'}</td>
            <td class="num">${faltante > 0 ? faltante : '—'}</td>
            <td class="num">${litros !== null ? formatearMontoEnMoneda(litros * precio, monedaHoja) : '—'}</td>
            <td>${d.descripcion || ''}</td>
          </tr>`;
      })
      .join('');

    const rango =
      diasHoja.length > 0
        ? `${formatoCorto(diasHoja[0].fecha)} a ${formatoCorto(diasHoja[diasHoja.length - 1].fecha)}`
        : '—';

    const estadoPago = datosHoja.pago
      ? datosHoja.pago.estado_pago === 'pagado'
        ? `Pagado el ${formatoCorto(datosHoja.pago.fecha_pago)}`
        : 'Pago pendiente'
      : 'Sin pago registrado';

    return `
  <div class="bloque">
    <div class="nombre-productor">${r.nombre}</div>
    <div class="info">
      <div><strong>Semana:</strong> ${rango}</div>
      <div><strong>Precio por litro:</strong> ${formatearMontoEnMoneda(precio, monedaHoja)}</div>
      ${r.telefono ? `<div><strong>Teléfono:</strong> ${r.telefono}</div>` : ''}
      <div><strong>Estado:</strong> ${estadoPago}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Día</th>
          <th>Fecha</th>
          <th class="num">Litros</th>
          <th class="num">Sobrante</th>
          <th class="num">Faltante</th>
          <th class="num">Subtotal</th>
          <th>Observación</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
      <tfoot>
        <tr>
          <th colspan="2">Total de la semana</th>
          <th class="num">${datosHoja.totales.total_litros} L</th>
          <th class="num">${datosHoja.totales.total_sobrante > 0 ? datosHoja.totales.total_sobrante : '—'}</th>
          <th class="num">${datosHoja.totales.total_faltante > 0 ? datosHoja.totales.total_faltante : '—'}</th>
          <th class="num">${formatearMontoEnMoneda(datosHoja.totales.total_pagar, monedaHoja)}</th>
          <th></th>
        </tr>
      </tfoot>
    </table>
    <div class="subtotales">
      <div>Días con leche: <strong>${datosHoja.totales.dias_con_leche}</strong></div>
      <div>Total a pagar: <strong>${formatearMontoEnMoneda(datosHoja.totales.total_pagar, monedaHoja)}</strong></div>
    </div>
    <div class="firmas">
      <div>Firma del rutero</div>
      <div>Firma COOLAPAR</div>
    </div>
  </div>`;
  };

  const imprimirDocumento = (bloquesHtml, subtitulo) => {
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Hoja del rutero</title>
<style>
  @page { size: letter portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #212529; margin: 0; }
  .encabezado { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #198754; padding-bottom: 12px; margin-bottom: 18px; }
  .encabezado img { height: 64px; width: auto; }
  .encabezado h1 { font-size: 20px; margin: 0; color: #198754; }
  .encabezado p { margin: 2px 0 0; color: #6c757d; font-size: 13px; }
  .bloque { margin-bottom: 28px; padding-bottom: 18px; border-bottom: 1px dashed #ced4da; break-inside: avoid; }
  .bloque:last-child { border-bottom: none; }
  .nombre-productor { font-size: 16px; font-weight: bold; margin-bottom: 6px; }
  .info { display: flex; flex-wrap: wrap; gap: 4px 24px; font-size: 12px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #dee2e6; padding: 5px 7px; text-align: left; }
  thead th { background: #f1f3f5; }
  td.num, th.num { text-align: right; }
  tfoot th { background: #f1f3f5; }
  .subtotales { display: flex; flex-wrap: wrap; gap: 4px 20px; font-size: 12px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #dee2e6; }
  .firmas { display: flex; justify-content: space-between; margin-top: 28px; font-size: 12px; }
  .firmas div { width: 45%; text-align: center; border-top: 1px solid #212529; padding-top: 5px; }
  .pie { margin-top: 12px; font-size: 11px; color: #6c757d; text-align: right; }
</style>
</head>
<body>
  <div class="encabezado">
    <img src="${LOGO_URL}" alt="Coolapar" />
    <div>
      <h1>COOLAPAR</h1>
      <p>Recolección de leche — ruteros${subtitulo ? ` — ${subtitulo}` : ''}</p>
    </div>
  </div>

  ${bloquesHtml.join('')}

  <div class="pie">Impreso el ${formatoCorto(hoy())}</div>
</body>
</html>`;

    // Se imprime desde un iframe oculto para que no lo bloquee el
    // bloqueador de ventanas emergentes del navegador.
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    iframe.onload = () => {
      // Pequeña espera para que el logo termine de cargar.
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 300);
    };

    iframe.srcdoc = html;
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 8000);
  };

  /** Imprime la semana que está abierta en pantalla. */
  const imprimirHojaActual = async () => {
    if (!hoja) return;
    setImprimiendo(true);
    setError('');
    try {
      // Se relee por hoja-consulta para imprimir lo que está guardado,
      // no lo que se esté tecleando sin guardar.
      const datos = hoja.semana?.id
        ? desempacar(await ruterosApi.hojaConsultaRutero({ rutero_id: ruteroId, semana_id: hoja.semana.id }))
        : hoja;
      imprimirDocumento([construirBloqueRutero(datos)], rutero?.nombre);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo preparar la impresión.');
    } finally {
      setImprimiendo(false);
    }
  };

  /** Imprime una o varias semanas del historial. */
  const imprimirSemanas = async (ids) => {
    if (!ids || ids.length === 0) return;
    setImprimiendo(true);
    setError('');
    try {
      // Se respeta el orden del historial, no el orden en que se marcaron.
      const ordenados = historial.map((s) => s.id).filter((id) => ids.includes(id));

      const hojas = await Promise.all(
        ordenados.map((id) =>
          ruterosApi.hojaConsultaRutero({ rutero_id: ruteroId, semana_id: id }).then(desempacar)
        )
      );

      imprimirDocumento(
        hojas.map((h) => construirBloqueRutero(h)),
        `${rutero?.nombre} — ${ordenados.length} semana(s)`
      );
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo preparar la impresión.');
    } finally {
      setImprimiendo(false);
    }
  };

  // ---------- Consultar semana: todos los ruteros del rango ----------
  // Va al revés que la hoja: en lugar de partir de un rutero y ver su
  // semana, parte de la semana y trae a todos los que trajeron leche.

  const [mostrarSemana, setMostrarSemana] = useState(false);
  const [semanaDesde, setSemanaDesde] = useState(() => lunesDe(hoy()));
  const [semanaHasta, setSemanaHasta] = useState(() => sumarDiasTexto(lunesDe(hoy()), 6));
  const [resumen, setResumen] = useState(null);
  const [rangoResumen, setRangoResumen] = useState(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState('');
  const [seleccionResumen, setSeleccionResumen] = useState([]);
  const [imprimiendoResumen, setImprimiendoResumen] = useState(false);

  const consultarSemana = async (desde = semanaDesde, hasta = semanaHasta) => {
    if (!desde || !hasta) return setErrorResumen('Indique la fecha de inicio y la de cierre.');
    if (desde > hasta) return setErrorResumen('La fecha de inicio debe ser anterior a la de cierre.');
    if (typeof ruterosApi.resumenSemanaRuteros !== 'function') {
      return setErrorResumen(
        "Falta agregar resumenSemanaRuteros() en src/api/ruteros.api.js: export const resumenSemanaRuteros = (params) => axiosClient.get(`${BASE}/resumen-semana`, { params }).then((r) => r.data);"
      );
    }

    setCargandoResumen(true);
    setErrorResumen('');
    try {
      const datos = desempacar(await ruterosApi.resumenSemanaRuteros({ fecha_inicio: desde, fecha_fin: hasta }));
      setResumen(datos);
      setRangoResumen({ inicio: desde, fin: hasta });
      setSeleccionResumen([]);
    } catch (err) {
      setResumen(null);
      setErrorResumen(err.response?.data?.message || 'No se pudo cargar la semana.');
    } finally {
      setCargandoResumen(false);
    }
  };

  const abrirConsultaSemana = () => {
    const abriendo = !mostrarSemana;
    setMostrarSemana(abriendo);
    if (abriendo && !resumen && !cargandoResumen) consultarSemana();
  };

  const moverSemana = (pasos) => {
    const nuevoDesde = sumarDiasTexto(semanaDesde, pasos * 7);
    const nuevoHasta = sumarDiasTexto(nuevoDesde, 6);
    setSemanaDesde(nuevoDesde);
    setSemanaHasta(nuevoHasta);
    consultarSemana(nuevoDesde, nuevoHasta);
  };

  const alternarResumen = (id) => {
    const clave = String(id);
    setSeleccionResumen((prev) => (prev.includes(clave) ? prev.filter((x) => x !== clave) : [...prev, clave]));
  };

  const filasResumen = resumen?.ruteros || [];
  const todosResumenMarcados =
    filasResumen.length > 0 && filasResumen.every((t) => seleccionResumen.includes(String(t.rutero_id)));

  const alternarTodosResumen = () =>
    setSeleccionResumen(todosResumenMarcados ? [] : filasResumen.map((t) => String(t.rutero_id)));

  /** Imprime la hoja de cada rutero marcado, con el rango en pantalla. */
  const imprimirResumen = async () => {
    if (seleccionResumen.length === 0 || !rangoResumen) return;
    setImprimiendoResumen(true);
    setErrorResumen('');
    try {
      const ids = filasResumen.map((t) => String(t.rutero_id)).filter((id) => seleccionResumen.includes(id));

      const hojas = await Promise.all(
        ids.map((id) =>
          ruterosApi
            .hojaConsultaRutero({ rutero_id: id, fecha_inicio: rangoResumen.inicio, fecha_fin: rangoResumen.fin })
            .then(desempacar)
        )
      );

      imprimirDocumento(
        hojas.map((h) => construirBloqueRutero(h)),
        `Semana del ${formatoCorto(rangoResumen.inicio)} al ${formatoCorto(rangoResumen.fin)}`
      );
    } catch (err) {
      setErrorResumen(err.response?.data?.message || 'No se pudo preparar la impresión.');
    } finally {
      setImprimiendoResumen(false);
    }
  };

  // ---------- CRUD de ruteros ----------
  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(formVacio);
    setErrorForm('');
    setMostrarModal(true);
  };

  const abrirEditar = (r) => {
    setEditandoId(r.id);
    setForm({
      nombre: r.nombre || '',
      telefono: r.telefono || '',
      precio_litro: r.precio_litro ?? '',
      moneda: r.moneda || 'COP',
    });
    setErrorForm('');
    setMostrarModal(true);
  };

  const guardarRutero = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: form.nombre.trim(),
      telefono: vacio(form.telefono) ? null : form.telefono.trim(),
      precio_litro: vacio(form.precio_litro) ? 0 : aNumero(form.precio_litro, 0),
      moneda: form.moneda,
    };
    if (!payload.nombre) return setErrorForm('Escriba el nombre del rutero.');

    setGuardandoRutero(true);
    setErrorForm('');
    try {
      if (editandoId) {
        await ruterosApi.actualizarRutero(editandoId, payload);
      } else {
        await ruterosApi.crearRutero(payload);
      }
      setMostrarModal(false);
      setAviso(editandoId ? 'Rutero actualizado.' : 'Rutero registrado.');
      await cargarRuteros();
    } catch (err) {
      setErrorForm(err.response?.data?.message || 'No se pudo guardar el rutero.');
    } finally {
      setGuardandoRutero(false);
    }
  };

  const cambiarEstado = async (r) => {
    const desactivando = r.activo;
    if (!window.confirm(desactivando ? `¿Desactivar a ${r.nombre}?` : `¿Reactivar a ${r.nombre}?`)) return;
    setError('');
    try {
      if (desactivando) {
        await ruterosApi.eliminarRutero(r.id);
      } else {
        await ruterosApi.actualizarRutero(r.id, { activo: true });
      }
      await cargarRuteros();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cambiar el estado del rutero.');
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando ruteros..." />;

  const ruterosVisibles = ruteros.filter((r) => verInactivos || r.activo);

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-start mb-3 gap-3 flex-wrap">
        <div>
          <h4 className="mb-1">Ruteros</h4>
          <p className="text-muted mb-0">
            Cada rutero acumula los litros que trae durante su semana. El total se multiplica por el precio por litro
            que se le cancela.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant={mostrarSemana ? 'success' : 'outline-success'} onClick={abrirConsultaSemana}>
            {mostrarSemana ? 'Ocultar semana' : 'Consultar semana'}
          </Button>
          <Button variant="success" onClick={abrirNuevo}>
            <span className="btn-icon-plus">+</span>Nuevo rutero
          </Button>
        </div>
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

      {mostrarSemana && (
        <Card className="mb-4 border-success">
          <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <strong>Consultar semana</strong>
              <div className="text-muted small">
                Todos los ruteros que trajeron leche en el rango, día por día.
              </div>
            </div>
            <Button size="sm" variant="link" className="p-0" onClick={() => setMostrarSemana(false)}>
              Ocultar
            </Button>
          </Card.Header>

          <Card.Body className="d-flex flex-wrap gap-3 align-items-end">
            <div style={{ minWidth: 170 }}>
              <Form.Label className="small text-muted mb-1">Desde</Form.Label>
              <Form.Control
                type="date"
                value={semanaDesde}
                max={semanaHasta || undefined}
                onChange={(e) => setSemanaDesde(e.target.value)}
              />
            </div>
            <div style={{ minWidth: 170 }}>
              <Form.Label className="small text-muted mb-1">Hasta</Form.Label>
              <Form.Control
                type="date"
                value={semanaHasta}
                min={semanaDesde || undefined}
                onChange={(e) => setSemanaHasta(e.target.value)}
              />
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button variant="success" onClick={() => consultarSemana()} disabled={cargandoResumen}>
                {cargandoResumen ? 'Consultando...' : 'Consultar'}
              </Button>
              <Button variant="outline-secondary" onClick={() => moverSemana(-1)} disabled={cargandoResumen}>
                ← Semana anterior
              </Button>
              <Button variant="outline-secondary" onClick={() => moverSemana(1)} disabled={cargandoResumen}>
                Semana siguiente →
              </Button>
            </div>
          </Card.Body>

          {errorResumen && (
            <Alert variant="danger" className="mx-3 mb-3" onClose={() => setErrorResumen('')} dismissible>
              {errorResumen}
            </Alert>
          )}

          {cargandoResumen ? (
            <div className="p-3">
              <LoadingSpinner mensaje="Cargando la semana..." />
            </div>
          ) : resumen && filasResumen.length === 0 ? (
            <Alert variant="light" className="border mx-3 mb-3 text-muted">
              Ningún rutero trajo leche entre el {formatoCorto(resumen.rango.fecha_inicio)} y el{' '}
              {formatoCorto(resumen.rango.fecha_fin)}.
            </Alert>
          ) : resumen ? (
            <>
              <div className="px-3 pb-2 d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div>
                  <div className="text-muted small">
                    Semana del {formatoCorto(resumen.rango.fecha_inicio)} al {formatoCorto(resumen.rango.fecha_fin)}
                  </div>
                  <div className="fs-5">
                    <strong>{resumen.totales.ruteros}</strong> ruteros ·{' '}
                    <strong>{resumen.totales.total_litros}</strong> litros
                    {resumen.totales.total_faltante > 0 && (
                      <span className="text-danger fs-6"> · {resumen.totales.total_faltante} L de faltante</span>
                    )}
                  </div>
                </div>
                <div className="text-end">
                  {(resumen.totales_por_moneda || []).map((t) => (
                    <div key={t.moneda} className="fs-5">
                      <span className="text-muted small me-2">Total {t.moneda}</span>
                      <strong>{formatearMontoEnMoneda(t.total_pagar, t.moneda)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-3 pb-2 text-end">
                <Button
                  variant="success"
                  size="sm"
                  onClick={imprimirResumen}
                  disabled={seleccionResumen.length === 0 || imprimiendoResumen}
                >
                  {imprimiendoResumen ? 'Preparando...' : `Imprimir seleccionados (${seleccionResumen.length})`}
                </Button>
              </div>

              <Table hover responsive className="mb-0 align-middle small">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <Form.Check
                        type="checkbox"
                        checked={todosResumenMarcados}
                        onChange={alternarTodosResumen}
                        aria-label="Marcar todos"
                      />
                    </th>
                    <th style={{ minWidth: 150 }}>Rutero</th>
                    {(resumen.rango.columnas || []).map((c) => (
                      <th key={c.fecha} className="text-end">
                        {c.dia}
                        <div className="text-muted fw-normal">{formatoCorto(c.fecha)}</div>
                      </th>
                    ))}
                    <th className="text-end">Total litros</th>
                    <th className="text-end">Precio/L</th>
                    <th className="text-end">Total a pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {filasResumen.map((t) => {
                    const marcado = seleccionResumen.includes(String(t.rutero_id));
                    return (
                      <tr
                        key={t.rutero_id}
                        className={marcado ? 'table-success' : undefined}
                        style={{ cursor: 'pointer' }}
                        onClick={() => alternarResumen(t.rutero_id)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <Form.Check
                            type="checkbox"
                            checked={marcado}
                            onChange={() => alternarResumen(t.rutero_id)}
                            aria-label={`Marcar a ${t.nombre}`}
                          />
                        </td>
                        <td className="fw-semibold">{t.nombre}</td>
                        {t.dias.map((d) => (
                          <td key={d.fecha} className="text-end">
                            {d.litros > 0 ? d.litros : <span className="text-muted">—</span>}
                            {(d.sobrante > 0 || d.faltante > 0) && (
                              <div style={{ fontSize: '.7rem' }}>
                                {d.sobrante > 0 && <span className="text-success">+{d.sobrante}</span>}
                                {d.sobrante > 0 && d.faltante > 0 && ' '}
                                {d.faltante > 0 && <span className="text-danger">−{d.faltante}</span>}
                              </div>
                            )}
                          </td>
                        ))}
                        <td className="text-end fw-semibold">{t.total_litros}</td>
                        <td className="text-end">{formatearMontoEnMoneda(t.precio_litro, t.moneda)}</td>
                        <td className="text-end fw-semibold">
                          {formatearMontoEnMoneda(t.total_pagar, t.moneda)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <th />
                    <th>Litros por día</th>
                    {(resumen.totales_por_dia || []).map((t) => (
                      <th key={t.fecha} className="text-end">
                        {t.total_litros > 0 ? t.total_litros : '—'}
                      </th>
                    ))}
                    <th className="text-end">{resumen.totales.total_litros}</th>
                    <th />
                    <th className="text-end">
                      {(resumen.totales_por_moneda || []).map((t) => (
                        <div key={t.moneda}>{formatearMontoEnMoneda(t.total_pagar, t.moneda)}</div>
                      ))}
                    </th>
                  </tr>
                </tfoot>
              </Table>
            </>
          ) : null}
        </Card>
      )}

      <Tabs activeKey={pestana} onSelect={(k) => setPestana(k || 'hoja')} className="mb-3">
        <Tab eventKey="hoja" title="Hoja semanal">
          <Card className="mb-3">
            <Card.Body className="d-flex flex-wrap gap-3 align-items-end">
              <div style={{ minWidth: 220 }}>
                <Form.Label className="small text-muted mb-1">Rutero</Form.Label>
                <Form.Select value={ruteroId} onChange={(e) => elegirRutero(e.target.value)}>
                  <option value="">Seleccione un rutero</option>
                  {ruteros
                    .filter((r) => r.activo)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                </Form.Select>
              </div>

              <div style={{ minWidth: 190 }}>
                <Form.Label className="small text-muted mb-1">Fecha de inicio</Form.Label>
                <Form.Control
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => cambiarFechaInicio(e.target.value)}
                />
                <Form.Text className="text-muted">{nombreDia(diaSemanaDeFecha(fechaInicio))}</Form.Text>
              </div>

              <div style={{ minWidth: 150 }}>
                <Form.Label className="small text-muted mb-1">Termina</Form.Label>
                <Form.Select value={diaFin} onChange={(e) => cambiarDiaFin(e.target.value)}>
                  {OPCIONES_DIA.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.nombre}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  {largoCiclo(diaSemanaDeFecha(fechaInicio), diaFin)} día(s)
                </Form.Text>
              </div>

              <div style={{ minWidth: 300 }}>
                <Form.Label className="small text-muted mb-1">Se le paga por litro</Form.Label>
                <InputGroup>
                  <Form.Select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={{ maxWidth: 180 }}>
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
                    value={precioLitro}
                    onChange={(e) => setPrecioLitro(e.target.value)}
                    placeholder="0.00"
                  />
                </InputGroup>
              </div>
            </Card.Body>
          </Card>

          {!ruteroId ? (
            <Alert variant="light" className="border text-muted">
              Seleccione un rutero para cargar su libreta.
            </Alert>
          ) : cargandoHoja ? (
            <LoadingSpinner mensaje="Abriendo la semana..." />
          ) : hoja ? (
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <strong>{rutero?.nombre}</strong>{' '}
                  <span className="text-muted small">
                    {formatoCorto(fechaInicio)} a {formatoCorto(dias[dias.length - 1]?.fecha)}
                  </span>
                </div>
                {hoja.pago && (
                  <Badge bg={hoja.pago.estado_pago === 'pagado' ? 'success' : 'warning'}>
                    {hoja.pago.estado_pago === 'pagado'
                      ? `Pagado el ${formatoCorto(hoja.pago.fecha_pago)}`
                      : 'Pago pendiente'}
                  </Badge>
                )}
              </Card.Header>

              <Table hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Día</th>
                    <th style={{ width: 100 }}>Fecha</th>
                    <th style={{ width: 130 }}>Litros</th>
                    <th style={{ width: 120 }}>Sobrante</th>
                    <th style={{ width: 120 }}>Faltante</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d) => (
                    <tr key={d.fecha}>
                      <td className="fw-semibold">{d.dia}</td>
                      <td className="text-muted">{formatoCorto(d.fecha)}</td>
                      <td>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.01"
                          size="sm"
                          value={d.litros}
                          disabled={cerrada}
                          placeholder="—"
                          onChange={(e) => cambiarDia(d.fecha, 'litros', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.01"
                          size="sm"
                          value={d.sobrante}
                          disabled={cerrada}
                          placeholder="0"
                          onChange={(e) => cambiarDia(d.fecha, 'sobrante', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.01"
                          size="sm"
                          value={d.faltante}
                          disabled={cerrada}
                          placeholder="0"
                          onChange={(e) => cambiarDia(d.fecha, 'faltante', e.target.value)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          size="sm"
                          value={d.descripcion}
                          disabled={cerrada}
                          placeholder="Nota del día"
                          onChange={(e) => cambiarDia(d.fecha, 'descripcion', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <th colSpan={2}>Totales</th>
                    <th>{totales.litros} litros</th>
                    <th>{totales.sobrante}</th>
                    <th>{totales.faltante}</th>
                    <th className="fs-5">
                      {formatearMontoEnMoneda(totales.pagar, moneda)}
                      <div className="text-muted fw-normal small">
                        {totales.litros} × {formatearMontoEnMoneda(aNumero(precioLitro, 0), moneda)}
                      </div>
                    </th>
                  </tr>
                </tfoot>
              </Table>

              <Card.Footer className="d-flex justify-content-end gap-2 flex-wrap">
                <Button variant="outline-success" onClick={guardarHoja} disabled={guardando || cerrada}>
                  {guardando ? 'Guardando...' : 'Guardar semana'}
                </Button>
                <Button variant="success" onClick={registrarPago} disabled={guardando || totales.litros <= 0}>
                  Registrar pago
                </Button>
                <Button
                  variant="outline-success"
                  onClick={imprimirHojaActual}
                  disabled={imprimiendo || totales.litros <= 0}
                >
                  {imprimiendo ? 'Preparando...' : 'Imprimir hoja'}
                </Button>
              </Card.Footer>
            </Card>
          ) : null}

          <Card className="mt-4">
            <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <strong>Semanas de {rutero?.nombre}</strong>
                {resumenHistorial && (
                  <div className="text-muted small">
                    {resumenHistorial.semanas_pagadas} de {resumenHistorial.semanas} pagadas
                    {resumenHistorial.pagado_por_moneda?.length > 0 && (
                      <>
                        {' · '}
                        {resumenHistorial.pagado_por_moneda
                          .map((t) => `${formatearMontoEnMoneda(t.total_pagar, t.moneda)} pagados`)
                          .join(' · ')}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <Form.Select
                  size="sm"
                  value={filtroPago}
                  onChange={(e) => setFiltroPago(e.target.value)}
                  style={{ maxWidth: 190 }}
                >
                  <option value="">Todas las semanas</option>
                  <option value="pagado">Solo las pagadas</option>
                  <option value="pendiente">Solo las pendientes</option>
                </Form.Select>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => imprimirSemanas(semanasMarcadas)}
                  disabled={semanasMarcadas.length === 0 || imprimiendo}
                >
                  {imprimiendo ? 'Preparando...' : `Imprimir (${semanasMarcadas.length})`}
                </Button>
              </div>
            </Card.Header>

            <Table hover responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <Form.Check
                      type="checkbox"
                      checked={todasMarcadas}
                      onChange={alternarTodasSemanas}
                      aria-label="Marcar todas las semanas"
                    />
                  </th>
                  <th>Semana</th>
                  <th>Días</th>
                  <th className="text-end">Litros</th>
                  <th className="text-end">Total</th>
                  <th>Pago</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((s) => {
                  const marcada = semanasMarcadas.includes(s.id);
                  return (
                    <tr
                      key={s.id}
                      className={
                        String(s.id) === String(hoja?.semana?.id)
                          ? 'table-active'
                          : marcada
                          ? 'table-success'
                          : ''
                      }
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <Form.Check
                          type="checkbox"
                          checked={marcada}
                          onChange={() => alternarSemana(s.id)}
                          aria-label={`Marcar la semana del ${s.fecha_inicio}`}
                        />
                      </td>
                      <td>
                        {/* Las fechas son lo que distingue una semana de
                            otra: "lunes a domingo" solo, no dice cuál. */}
                        <span className="fw-semibold">
                          {formatoCorto(s.fecha_inicio)} — {formatoCorto(s.fecha_fin)}
                        </span>
                        {s.fecha_pago && (
                          <div className="text-muted small">Pagada el {formatoCorto(s.fecha_pago)}</div>
                        )}
                      </td>
                      <td className="text-muted small">{s.etiqueta}</td>
                      <td className="text-end">{s.total_litros}</td>
                      <td className="text-end">{formatearMontoEnMoneda(s.total_pagar, s.moneda)}</td>
                      <td>
                        {s.estado_pago === 'pagado' ? (
                          <Badge bg="success">Pagado</Badge>
                        ) : s.estado_pago ? (
                          <Badge bg="warning">Pendiente</Badge>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-2 justify-content-end">
                          <Button
                            size="sm"
                            variant="outline-success"
                            onClick={() => imprimirSemanas([s.id])}
                            disabled={imprimiendo}
                          >
                            Imprimir
                          </Button>
                          <Button size="sm" variant="outline-secondary" onClick={() => setSemanaId(s.id)}>
                            Abrir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {historial.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      {filtroPago === 'pagado'
                        ? 'Todavía no hay semanas pagadas a este rutero.'
                        : filtroPago === 'pendiente'
                        ? 'No hay semanas pendientes de pago.'
                        : 'Este rutero no tiene semanas registradas.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>

        </Tab>

        <Tab eventKey="lista" title="Ruteros registrados">
          <div className="d-flex align-items-center mb-2">
            <Form.Check
              type="switch"
              id="ver-ruteros-inactivos"
              label="Ver inactivos"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
            />
          </div>

          <Table hover responsive bordered className="bg-white align-middle">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Se le paga por litro</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ruterosVisibles.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.nombre}</td>
                  <td>{r.telefono || '—'}</td>
                  <td>{formatearMontoEnMoneda(r.precio_litro || 0, r.moneda)}</td>
                  <td>
                    <Badge bg={r.activo ? 'success' : 'secondary'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => abrirEditar(r)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={r.activo ? 'outline-danger' : 'outline-success'}
                      onClick={() => cambiarEstado(r)}
                    >
                      {r.activo ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  </td>
                </tr>
              ))}
              {ruterosVisibles.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Todavía no hay ruteros. Registre el primero para llevar su libreta semanal.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Tab>
      </Tabs>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Form onSubmit={guardarRutero}>
          <Modal.Header closeButton>
            <Modal.Title>{editandoId ? 'Editar rutero' : 'Nuevo rutero'}</Modal.Title>
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
              <Form.Label>Teléfono</Form.Label>
              <Form.Control
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Precio por litro que se le cancela</Form.Label>
              <InputGroup>
                <Form.Select
                  value={form.moneda}
                  onChange={(e) => setForm({ ...form, moneda: e.target.value })}
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
                  value={form.precio_litro}
                  onChange={(e) => setForm({ ...form, precio_litro: e.target.value })}
                  placeholder="0.00"
                />
              </InputGroup>
              <Form.Text className="text-muted">
                Es el valor por defecto. En cada semana se puede cambiar sin tocar la ficha.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setMostrarModal(false)}>
              Cancelar
            </Button>
            <Button variant="success" type="submit" disabled={guardandoRutero}>
              {guardandoRutero ? 'Guardando...' : 'Guardar'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default Ruteros;