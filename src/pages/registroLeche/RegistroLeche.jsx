import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Table, Button, Form, Alert, Badge, InputGroup, Card, Modal } from 'react-bootstrap';
import * as registroApi from '../../api/registroLeche.api';
import * as productoresApi from '../../api/productores.api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useMoneda } from '../../context/MonedaContext';
import { OPCIONES_DIA, aNumero, desempacar, diaSemanaDeFecha, formatoCorto, hoy, largoCiclo, nombreDia, vacio } from '../../utils/fechas';

const LOGO_URL = 'https://coolapar-gestion.vercel.app/coolapar-logo.png';

const OPCIONES_MONEDA = [
  { codigo: 'BS', etiqueta: 'Bs. — Bolívares' },
  { codigo: 'USD', etiqueta: '$ — Dólares' },
  { codigo: 'COP', etiqueta: 'COL$ — Pesos colombianos' },
];

const Punto = ({ color }) => (
  <span
    style={{
      backgroundColor: color || 'transparent',
      border: color ? '1px solid rgba(0,0,0,.15)' : '1px dashed #bbb',
      width: 12,
      height: 12,
      borderRadius: '50%',
      display: 'inline-block',
      flexShrink: 0,
    }}
  />
);

const RegistroLeche = () => {
  const { formatearMontoEnMoneda } = useMoneda();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [productores, setProductores] = useState([]);
  const [productorId, setProductorId] = useState('');

  // El cliente elige la fecha exacta en que arranca la semana; el día que
  // le corresponde (lunes, martes...) se calcula solo. "Termina" sigue
  // siendo por nombre de día.
  const [fechaInicio, setFechaInicio] = useState(hoy());
  const [diaFin, setDiaFin] = useState(0); // domingo
  const [semanaId, setSemanaId] = useState(null); // solo al reabrir una del historial

  const [hoja, setHoja] = useState(null);
  const [dias, setDias] = useState([]);
  const [precioLitro, setPrecioLitro] = useState('');
  // Precio de la leche ácida: opcional. El mismo productor puede traer
  // litros buenos (precio normal) y litros ácidos (precio más bajo) el
  // mismo día; cada quien con su propio precio.
  const [precioAcida, setPrecioAcida] = useState('');
  // Precio de la leche baja en grasa: funciona igual que la ácida, con su
  // propio precio independiente.
  const [precioBajoGrasa, setPrecioBajoGrasa] = useState('');
  const [moneda, setMoneda] = useState('BS');
  const [cargandoHoja, setCargandoHoja] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [historial, setHistorial] = useState([]);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [paginacionHistorial, setPaginacionHistorial] = useState({ total: 0, total_paginas: 1 });
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const productor = useMemo(
    () => productores.find((p) => String(p.id) === String(productorId)) || null,
    [productores, productorId]
  );

  const cargarProductores = async () => {
    setCargando(true);
    setError('');
    try {
      const lista = (desempacar(await productoresApi.listarProductores()) || []).filter((p) => p.activo !== false);
      setProductores(lista);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar los productores.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarProductores();
  }, []);

  // Evita que una respuesta vieja (por ejemplo si el usuario cambió la
  // fecha varias veces seguido) llegue tarde y pise el estado con datos
  // que ya no corresponden a lo que está viendo en pantalla.
  const secuenciaHoja = useRef(0);

  const cargarHoja = useCallback(async () => {
    if (!productorId) {
      setHoja(null);
      setDias([]);
      return;
    }
    const miTurno = ++secuenciaHoja.current;
    setCargandoHoja(true);
    setError('');
    try {
      const params = semanaId
        ? { productor_id: productorId, semana_id: semanaId }
        : { productor_id: productorId, fecha_inicio: fechaInicio, dia_fin: diaFin };

      const datos = desempacar(await registroApi.obtenerHoja(params));
      if (miTurno !== secuenciaHoja.current) return; // llegó tarde, se descarta

      setHoja(datos);
      setDias(
        datos.dias.map((d) => ({
          ...d,
          litros: d.litros === null ? '' : String(d.litros),
          litros_acidos: d.litros_acidos ? String(d.litros_acidos) : '',
          litros_bajo_grasa: d.litros_bajo_grasa ? String(d.litros_bajo_grasa) : '',
        }))
      );
      setPrecioLitro(datos.precio_litro ? String(datos.precio_litro) : '');
      setPrecioAcida(datos.precio_litro_acida ? String(datos.precio_litro_acida) : '');
      setPrecioBajoGrasa(datos.precio_litro_bajo_grasa ? String(datos.precio_litro_bajo_grasa) : '');
      setMoneda(datos.moneda || 'BS');
      if (semanaId && datos.dias.length > 0) {
        setFechaInicio(datos.dias[0].fecha);
        setDiaFin(datos.semana.dia_fin);
      }
    } catch (err) {
      if (miTurno !== secuenciaHoja.current) return;
      setError(err.response?.data?.message || 'No se pudo abrir la semana.');
    } finally {
      if (miTurno === secuenciaHoja.current) setCargandoHoja(false);
    }
  }, [productorId, fechaInicio, diaFin, semanaId]);

  useEffect(() => {
    cargarHoja();
  }, [cargarHoja]);

  const cargarHistorial = useCallback(async () => {
    if (!productorId) {
      setHistorial([]);
      setPaginacionHistorial({ total: 0, total_paginas: 1 });
      return;
    }
    setCargandoHistorial(true);
    try {
      const datos = desempacar(await registroApi.historialProductor(productorId, paginaHistorial, 10));
      setHistorial(datos?.semanas || []);
      setPaginacionHistorial(datos?.paginacion || { total: 0, total_paginas: 1 });
    } catch {
      setHistorial([]);
      setPaginacionHistorial({ total: 0, total_paginas: 1 });
    } finally {
      setCargandoHistorial(false);
    }
  }, [productorId, paginaHistorial]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  // Al cambiar de productor, siempre se vuelve a la primera página.
  useEffect(() => {
    setPaginaHistorial(1);
  }, [productorId]);

  const totales = useMemo(() => {
    const litros = dias.reduce((s, d) => s + aNumero(d.litros, 0), 0);
    const litrosAcidos = dias.reduce((s, d) => s + aNumero(d.litros_acidos, 0), 0);
    const litrosBajoGrasa = dias.reduce((s, d) => s + aNumero(d.litros_bajo_grasa, 0), 0);
    const precio = aNumero(precioLitro, 0);
    const precioAc = aNumero(precioAcida, 0);
    const precioBg = aNumero(precioBajoGrasa, 0);
    const subtotalNormal = Math.round(litros * precio * 100) / 100;
    const subtotalAcida = Math.round(litrosAcidos * precioAc * 100) / 100;
    const subtotalBajoGrasa = Math.round(litrosBajoGrasa * precioBg * 100) / 100;
    return {
      dias: dias.filter(
        (d) => aNumero(d.litros, 0) > 0 || aNumero(d.litros_acidos, 0) > 0 || aNumero(d.litros_bajo_grasa, 0) > 0
      ).length,
      litros: Math.round(litros * 100) / 100,
      litrosAcidos: Math.round(litrosAcidos * 100) / 100,
      litrosBajoGrasa: Math.round(litrosBajoGrasa * 100) / 100,
      subtotalNormal,
      subtotalAcida,
      subtotalBajoGrasa,
      pagar: Math.round((subtotalNormal + subtotalAcida + subtotalBajoGrasa) * 100) / 100,
    };
  }, [dias, precioLitro, precioAcida, precioBajoGrasa]);

  const elegirProductor = (id) => {
    setSemanaId(null);
    setProductorId(id);
    const p = productores.find((x) => String(x.id) === String(id));
    if (p) {
      if (!vacio(p.precio_litro_base)) setPrecioLitro(String(p.precio_litro_base));
      if (!vacio(p.precio_litro_acida)) setPrecioAcida(String(p.precio_litro_acida));
      if (!vacio(p.precio_litro_bajo_grasa)) setPrecioBajoGrasa(String(p.precio_litro_bajo_grasa));
      if (p.moneda) setMoneda(p.moneda);
    }
  };

  const cambiarFechaInicio = (valor) => {
    setSemanaId(null);
    setFechaInicio(valor);
  };

  const cambiarDiaFin = (valor) => {
    setSemanaId(null);
    setDiaFin(Number(valor));
  };

  const cambiarDia = (fecha, campo, valor) => {
    setDias((prev) => prev.map((x) => (x.fecha === fecha ? { ...x, [campo]: valor } : x)));
  };

  // Importante: NO se manda hoja.semana.id aquí. Ese id puede ser el de
  // una semana ya guardada que solo se está previsualizando con un nuevo
  // día de cierre (todavía sin confirmar). Si se fijara ese id, el cambio
  // de "Termina" nunca se guardaría. Solo se fija semana_id cuando el
  // usuario reabrió explícitamente una semana del historial (semanaId).
  // En cualquier otro caso se manda fecha_inicio + dia_fin y el backend
  // decide si crea una semana nueva o actualiza la que ya existía.
  const cuerpoHoja = () => ({
    productor_id: Number(productorId),
    ...(semanaId ? { semana_id: Number(semanaId) } : { fecha_inicio: fechaInicio, dia_fin: diaFin }),
    precio_litro: aNumero(precioLitro, 0),
    precio_litro_acida: aNumero(precioAcida, 0),
    precio_litro_bajo_grasa: aNumero(precioBajoGrasa, 0),
    moneda,
    dias: dias.map((d) => ({
      fecha: d.fecha,
      litros: vacio(d.litros) ? null : aNumero(d.litros, 0),
      litros_acidos: vacio(d.litros_acidos) ? 0 : aNumero(d.litros_acidos, 0),
      litros_bajo_grasa: vacio(d.litros_bajo_grasa) ? 0 : aNumero(d.litros_bajo_grasa, 0),
    })),
  });

  const guardarSemana = async () => {
    if (!hoja) return;
    if (aNumero(precioLitro, 0) <= 0) return setError('Indique a cuánto se le paga el litro esta semana.');
    if (totales.litrosAcidos > 0 && aNumero(precioAcida, 0) <= 0) {
      return setError('Indique el precio de la leche ácida: hay litros ácidos cargados.');
    }
    if (totales.litrosBajoGrasa > 0 && aNumero(precioBajoGrasa, 0) <= 0) {
      return setError('Indique el precio de la leche baja en grasa: hay litros cargados de ese tipo.');
    }

    setGuardando(true);
    setError('');
    try {
      const datos = desempacar(await registroApi.guardarHoja(cuerpoHoja()));
      setHoja(datos);
      setDias(
        datos.dias.map((d) => ({
          ...d,
          litros: d.litros === null ? '' : String(d.litros),
          litros_acidos: d.litros_acidos ? String(d.litros_acidos) : '',
          litros_bajo_grasa: d.litros_bajo_grasa ? String(d.litros_bajo_grasa) : '',
        }))
      );
      const partesAviso = [`${datos.totales.total_litros} litros`];
      if (datos.totales.total_litros_acidos > 0) partesAviso.push(`${datos.totales.total_litros_acidos} ácidos`);
      if (datos.totales.total_litros_bajo_grasa > 0) {
        partesAviso.push(`${datos.totales.total_litros_bajo_grasa} bajos en grasa`);
      }
      setAviso(`Semana guardada: ${partesAviso.join(' + ')}.`);
      await cargarHistorial();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar la semana.');
    } finally {
      setGuardando(false);
    }
  };

  const registrarPago = async () => {
    if (!hoja || (totales.litros <= 0 && totales.litrosAcidos <= 0 && totales.litrosBajoGrasa <= 0)) {
      return setError('Cargue los litros antes de registrar el pago.');
    }
    const partes = [`${totales.litros} litros × ${formatearMontoEnMoneda(aNumero(precioLitro, 0), moneda)}`];
    if (totales.litrosAcidos > 0) {
      partes.push(`${totales.litrosAcidos} ácidos × ${formatearMontoEnMoneda(aNumero(precioAcida, 0), moneda)}`);
    }
    if (totales.litrosBajoGrasa > 0) {
      partes.push(
        `${totales.litrosBajoGrasa} bajos en grasa × ${formatearMontoEnMoneda(aNumero(precioBajoGrasa, 0), moneda)}`
      );
    }
    const resumen = `${partes.join(' + ')} = ${formatearMontoEnMoneda(totales.pagar, moneda)}`;
    if (!window.confirm(`¿Registrar el pago de ${productor?.nombre}?\n${resumen}`)) return;

    setGuardando(true);
    setError('');
    try {
      // Se guarda primero y se usa el id que devuelve el servidor: si la
      // semana era nueva, "hoja.semana.id" todavía estaba en null en este
      // momento, y mandarlo así hacía que el pago fallara en silencio.
      const guardado = desempacar(await registroApi.guardarHoja(cuerpoHoja()));
      await registroApi.registrarPagoSemana({
        productor_id: Number(productorId),
        semana_id: guardado.semana.id,
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

  const cambiarEstadoSemana = async (estado) => {
    if (!hoja) return;
    try {
      await registroApi.cambiarEstadoSemana(hoja.semana.id, estado);
      setAviso(estado === 'cerrada' ? 'Semana cerrada.' : 'Semana reabierta.');
      await cargarHoja();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cambiar el estado de la semana.');
    }
  };

  // Construye el bloque HTML (encabezado propio + tabla) de UN productor,
  // a partir de la hoja que devuelve la API. Se reutiliza tanto si se
  // imprime uno solo como si se imprimen varios juntos en la misma hoja.
  const construirBloqueProductor = (datosHoja) => {
    const p = datosHoja.productor;
    const diasHoja = datosHoja.dias || [];
    const precioNormal = Number(datosHoja.precio_litro || 0);
    const precioAc = Number(datosHoja.precio_litro_acida || 0);
    const precioBg = Number(datosHoja.precio_litro_bajo_grasa || 0);
    const monedaHoja = datosHoja.moneda || 'BS';

    const filas = diasHoja
      .map((d) => {
        const litros = Number(d.litros || 0);
        const litrosAcidos = Number(d.litros_acidos || 0);
        const litrosBajoGrasa = Number(d.litros_bajo_grasa || 0);
        const subtotal = Number(d.subtotal || 0);
        const tieneDatos = litros > 0 || litrosAcidos > 0 || litrosBajoGrasa > 0;
        return `
          <tr>
            <td>${d.dia}</td>
            <td>${formatoCorto(d.fecha)}</td>
            <td class="num">${litros > 0 ? litros : '—'}</td>
            <td class="num">${litrosAcidos > 0 ? litrosAcidos : '—'}</td>
            <td class="num">${litrosBajoGrasa > 0 ? litrosBajoGrasa : '—'}</td>
            <td class="num">${tieneDatos ? formatearMontoEnMoneda(subtotal, monedaHoja) : '—'}</td>
          </tr>`;
      })
      .join('');

    const filaAcidos =
      datosHoja.totales.total_litros_acidos > 0
        ? `<div><strong>Precio leche ácida:</strong> ${formatearMontoEnMoneda(precioAc, monedaHoja)}</div>`
        : '';

    const filaBajoGrasa =
      datosHoja.totales.total_litros_bajo_grasa > 0
        ? `<div><strong>Precio bajo en grasa:</strong> ${formatearMontoEnMoneda(precioBg, monedaHoja)}</div>`
        : '';

    const estadoPago = datosHoja.pago
      ? datosHoja.pago.estado_pago === 'pagado'
        ? `Pagado el ${formatoCorto(datosHoja.pago.fecha_pago)}`
        : 'Pago pendiente'
      : 'Sin pago registrado';

    return `
  <div class="bloque">
    <div class="nombre-productor">${p.nombre}</div>
    <div class="info">
      <div><strong>Semana:</strong> ${formatoCorto(diasHoja[0]?.fecha)} a ${formatoCorto(diasHoja[diasHoja.length - 1]?.fecha)}</div>
      <div><strong>Precio por litro:</strong> ${formatearMontoEnMoneda(precioNormal, monedaHoja)}</div>
      ${filaAcidos}
      ${filaBajoGrasa}
      <div><strong>Estado:</strong> ${estadoPago}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Día</th>
          <th>Fecha</th>
          <th class="num">Litros buenos</th>
          <th class="num">Litros ácidos</th>
          <th class="num">Bajo en grasa</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
      <tfoot>
        <tr>
          <th colspan="2">Total de la semana</th>
          <th class="num">${datosHoja.totales.total_litros} L</th>
          <th class="num">${datosHoja.totales.total_litros_acidos > 0 ? datosHoja.totales.total_litros_acidos + ' L' : '—'}</th>
          <th class="num">${datosHoja.totales.total_litros_bajo_grasa > 0 ? datosHoja.totales.total_litros_bajo_grasa + ' L' : '—'}</th>
          <th class="num">${formatearMontoEnMoneda(datosHoja.totales.total_pagar, monedaHoja)}</th>
        </tr>
      </tfoot>
    </table>
    <div class="subtotales">
      <div>Subtotal normal: <strong>${formatearMontoEnMoneda(datosHoja.totales.total_pagar_normal || 0, monedaHoja)}</strong></div>
      ${datosHoja.totales.total_litros_acidos > 0 ? `<div>Subtotal ácida: <strong>${formatearMontoEnMoneda(datosHoja.totales.total_pagar_acida || 0, monedaHoja)}</strong></div>` : ''}
      ${datosHoja.totales.total_litros_bajo_grasa > 0 ? `<div>Subtotal bajo en grasa: <strong>${formatearMontoEnMoneda(datosHoja.totales.total_pagar_bajo_grasa || 0, monedaHoja)}</strong></div>` : ''}
      <div>Total a pagar: <strong>${formatearMontoEnMoneda(datosHoja.totales.total_pagar, monedaHoja)}</strong></div>
    </div>
    <div class="firmas">
      <div>Firma del productor</div>
      <div>Firma COOLAPAR</div>
    </div>
  </div>`;
  };

  // Envuelve uno o más bloques de productor en el documento completo con
  // el logo arriba, y dispara la impresión con un iframe oculto (para no
  // toparse con el bloqueador de ventanas emergentes del navegador).
  const imprimirDocumento = (bloquesHtml) => {
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Registro diario de leche</title>
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
      <p>Registro diario de leche</p>
    </div>
  </div>

  ${bloquesHtml.join('')}

  <div class="pie">Impreso el ${formatoCorto(hoy())}</div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const limpiar = () => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    };

    iframe.onload = () => {
      // Pequeña espera para que el logo termine de cargar antes de imprimir.
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 300);
    };

    iframe.srcdoc = html;
    setTimeout(limpiar, 8000); // limpieza de respaldo si el navegador no dispara afterprint
  };

  // ---------- Selección de productores para imprimir juntos ----------
  const [mostrarModalImprimir, setMostrarModalImprimir] = useState(false);
  const [seleccionImprimir, setSeleccionImprimir] = useState([]);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [errorImprimir, setErrorImprimir] = useState('');

  const abrirModalImprimir = () => {
    setSeleccionImprimir(productorId ? [productorId] : []);
    setErrorImprimir('');
    setMostrarModalImprimir(true);
  };

  const alternarSeleccion = (id) => {
    setSeleccionImprimir((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const imprimirSeleccionados = async () => {
    if (seleccionImprimir.length === 0) {
      setErrorImprimir('Marque al menos un productor.');
      return;
    }
    setImprimiendo(true);
    setErrorImprimir('');
    try {
      // Todos con la misma fecha de inicio y día de cierre que se ve en
      // pantalla, así comparten hoja y no se desperdicia papel. El productor
      // que ya está abierto en pantalla no se vuelve a pedir al servidor.
      const hojas = await Promise.all(
        seleccionImprimir.map((id) =>
          id === productorId && hoja
            ? Promise.resolve(hoja)
            : registroApi.obtenerHoja({ productor_id: id, fecha_inicio: fechaInicio, dia_fin: diaFin }).then(desempacar)
        )
      );
      const bloques = hojas.map((h) => construirBloqueProductor(h));
      imprimirDocumento(bloques);
      setMostrarModalImprimir(false);
    } catch (err) {
      setErrorImprimir(err.response?.data?.message || 'No se pudo preparar la impresión.');
    } finally {
      setImprimiendo(false);
    }
  };

  if (cargando) return <LoadingSpinner mensaje="Cargando registro de leche..." />;

  const cerrada = hoja?.semana?.estado === 'cerrada';

  return (
    <div>
      <div className="mb-3">
        <h4 className="mb-1">Registro diario de leche</h4>
        <p className="text-muted mb-0">
          Elija el productor y en qué días corre su semana. Cargue los litros buenos y, si trajo, los litros ácidos
          de cada día — cada uno se paga a su propio precio.
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

      <Card className="mb-3">
        <Card.Body className="d-flex flex-wrap gap-3 align-items-end">
          <div style={{ minWidth: 240 }}>
            <Form.Label className="small text-muted mb-1">Productor</Form.Label>
            <Form.Select value={productorId} onChange={(e) => elegirProductor(e.target.value)}>
              <option value="">Seleccione un productor</option>
              {productores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Form.Select>
          </div>

          <div style={{ minWidth: 190 }}>
            <Form.Label className="small text-muted mb-1">Fecha de inicio</Form.Label>
            <Form.Control type="date" value={fechaInicio} onChange={(e) => cambiarFechaInicio(e.target.value)} />
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
            <Form.Text className="text-muted">{largoCiclo(diaSemanaDeFecha(fechaInicio), diaFin)} día(s)</Form.Text>
          </div>

          <div style={{ minWidth: 260 }}>
            <Form.Label className="small text-muted mb-1">Precio por litro (normal)</Form.Label>
            <InputGroup>
              <Form.Select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={{ maxWidth: 150 }}>
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
                value={precioLitro}
                onChange={(e) => setPrecioLitro(e.target.value)}
                placeholder="0.00"
              />
            </InputGroup>
          </div>

          <div style={{ minWidth: 200 }}>
            <Form.Label className="small text-muted mb-1">Precio leche ácida</Form.Label>
            <InputGroup>
              <InputGroup.Text>{moneda}</InputGroup.Text>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                value={precioAcida}
                onChange={(e) => setPrecioAcida(e.target.value)}
                placeholder="0.00"
              />
            </InputGroup>
            <Form.Text className="text-muted">Solo si trae litros ácidos.</Form.Text>
          </div>

          <div style={{ minWidth: 200 }}>
            <Form.Label className="small text-muted mb-1">Precio bajo en grasa</Form.Label>
            <InputGroup>
              <InputGroup.Text>{moneda}</InputGroup.Text>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                value={precioBajoGrasa}
                onChange={(e) => setPrecioBajoGrasa(e.target.value)}
                placeholder="0.00"
              />
            </InputGroup>
            <Form.Text className="text-muted">Solo si trae litros bajos en grasa.</Form.Text>
          </div>
        </Card.Body>
      </Card>

      {!productorId ? (
        <Alert variant="light" className="border text-muted">
          Seleccione un productor para cargar su semana.
        </Alert>
      ) : cargandoHoja ? (
        <LoadingSpinner mensaje="Abriendo la semana..." />
      ) : hoja ? (
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <Punto color={productor?.color_identificativo} />
              <strong>{productor?.nombre}</strong>
              <span className="text-muted small">
                {formatoCorto(fechaInicio)} a {formatoCorto(dias[dias.length - 1]?.fecha)}
              </span>
            </div>
            <div className="d-flex align-items-center gap-2">
              {!hoja.semana.guardada && (
                <Badge bg="secondary">Sin guardar todavía</Badge>
              )}
              {hoja.pago && (
                <Badge bg={hoja.pago.estado_pago === 'pagado' ? 'success' : 'warning'}>
                  {hoja.pago.estado_pago === 'pagado'
                    ? `Pagado el ${formatoCorto(hoja.pago.fecha_pago)}`
                    : 'Pago pendiente'}
                </Badge>
              )}
              {hoja.semana.guardada && (
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => cambiarEstadoSemana(cerrada ? 'abierta' : 'cerrada')}
                >
                  {cerrada ? 'Reabrir semana' : 'Cerrar semana'}
                </Button>
              )}
            </div>
          </Card.Header>

          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Día</th>
                <th style={{ width: 95 }}>Fecha</th>
                <th style={{ width: 130 }}>Litros buenos</th>
                <th style={{ width: 130 }}>Litros ácidos</th>
                <th style={{ width: 140 }}>Litros bajo en grasa</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => {
                const litros = aNumero(d.litros, 0);
                const litrosAcidos = aNumero(d.litros_acidos, 0);
                const litrosBajoGrasa = aNumero(d.litros_bajo_grasa, 0);
                const subtotal =
                  litros * aNumero(precioLitro, 0) +
                  litrosAcidos * aNumero(precioAcida, 0) +
                  litrosBajoGrasa * aNumero(precioBajoGrasa, 0);
                const tieneDatos = litros > 0 || litrosAcidos > 0 || litrosBajoGrasa > 0;
                return (
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
                        value={d.litros_acidos}
                        disabled={cerrada}
                        placeholder="—"
                        onChange={(e) => cambiarDia(d.fecha, 'litros_acidos', e.target.value)}
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        size="sm"
                        value={d.litros_bajo_grasa}
                        disabled={cerrada}
                        placeholder="—"
                        onChange={(e) => cambiarDia(d.fecha, 'litros_bajo_grasa', e.target.value)}
                      />
                    </td>
                    <td className={tieneDatos ? '' : 'text-muted'}>
                      {tieneDatos ? formatearMontoEnMoneda(subtotal, moneda) : 'No trajo'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="table-light">
              <tr>
                <th colSpan={2}>
                  Total de la semana
                  <div className="text-muted fw-normal small">{totales.dias} día(s) con leche</div>
                </th>
                <th>{totales.litros} litros</th>
                <th>{totales.litrosAcidos > 0 ? `${totales.litrosAcidos} ácidos` : '—'}</th>
                <th>{totales.litrosBajoGrasa > 0 ? `${totales.litrosBajoGrasa} bajos en grasa` : '—'}</th>
                <th className="fs-5">{formatearMontoEnMoneda(totales.pagar, moneda)}</th>
              </tr>
            </tfoot>
          </Table>

          <div className="px-3 py-2 border-top bg-light d-flex flex-wrap gap-4 small">
            <div>
              <span className="text-muted">Subtotal normal: </span>
              <strong>{formatearMontoEnMoneda(totales.subtotalNormal, moneda)}</strong>
            </div>
            {totales.litrosAcidos > 0 && (
              <div>
                <span className="text-muted">Subtotal ácida: </span>
                <strong>{formatearMontoEnMoneda(totales.subtotalAcida, moneda)}</strong>
              </div>
            )}
            {totales.litrosBajoGrasa > 0 && (
              <div>
                <span className="text-muted">Subtotal bajo en grasa: </span>
                <strong>{formatearMontoEnMoneda(totales.subtotalBajoGrasa, moneda)}</strong>
              </div>
            )}
            <div className="ms-auto">
              <span className="text-muted">Total a pagar: </span>
              <strong>{formatearMontoEnMoneda(totales.pagar, moneda)}</strong>
            </div>
          </div>

          <Card.Footer className="d-flex justify-content-end gap-2 flex-wrap">
            <Button variant="outline-secondary" onClick={abrirModalImprimir}>
              Imprimir
            </Button>
            <Button
              variant="outline-success"
              onClick={guardarSemana}
              disabled={guardando || cargandoHoja || cerrada}
            >
              {guardando ? 'Guardando...' : 'Guardar semana'}
            </Button>
            <Button
              variant="success"
              onClick={registrarPago}
              disabled={
                guardando ||
                cargandoHoja ||
                (totales.litros <= 0 && totales.litrosAcidos <= 0 && totales.litrosBajoGrasa <= 0)
              }
            >
              Registrar pago
            </Button>
          </Card.Footer>
        </Card>
      ) : null}

      {(historial.length > 0 || cargandoHistorial || paginacionHistorial.total > 0) && (
        <Card className="mt-4">
          <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span>Semanas anteriores de {productor?.nombre}</span>
            {paginacionHistorial.total > 0 && (
              <span className="text-muted small">{paginacionHistorial.total} semana(s) guardadas</span>
            )}
          </Card.Header>

          {cargandoHistorial ? (
            <div className="p-3">
              <LoadingSpinner mensaje="Cargando semanas anteriores..." />
            </div>
          ) : (
            <Table hover responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Fecha inicio</th>
                  <th>Fecha fin</th>
                  <th>Con leche</th>
                  <th>Litros</th>
                  <th>Ácidos</th>
                  <th>Bajo en grasa</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {historial.map((s) => (
                  <tr key={s.id} className={String(s.id) === String(hoja?.semana?.id) ? 'table-active' : ''}>
                    <td className="fw-semibold">
                      {nombreDia(s.dia_inicio)}
                      <div className="text-muted fw-normal small">{formatoCorto(s.fecha_inicio)}</div>
                    </td>
                    <td className="fw-semibold">
                      {nombreDia(s.dia_fin)}
                      <div className="text-muted fw-normal small">{formatoCorto(s.fecha_fin)}</div>
                    </td>
                    <td>{s.dias_con_leche}</td>
                    <td>{s.total_litros}</td>
                    <td>{s.total_litros_acidos > 0 ? s.total_litros_acidos : '—'}</td>
                    <td>{s.total_litros_bajo_grasa > 0 ? s.total_litros_bajo_grasa : '—'}</td>
                    <td>{formatearMontoEnMoneda(s.total_pagar, s.moneda)}</td>
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
                      <Button size="sm" variant="outline-secondary" onClick={() => setSemanaId(s.id)}>
                        Abrir
                      </Button>
                    </td>
                  </tr>
                ))}
                {historial.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-3">
                      Sin semanas guardadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}

          {paginacionHistorial.total_paginas > 1 && (
            <Card.Footer className="d-flex justify-content-between align-items-center">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={paginaHistorial <= 1}
                onClick={() => setPaginaHistorial((p) => Math.max(1, p - 1))}
              >
                ← Anterior
              </Button>
              <span className="text-muted small">
                Página {paginaHistorial} de {paginacionHistorial.total_paginas}
              </span>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={paginaHistorial >= paginacionHistorial.total_paginas}
                onClick={() => setPaginaHistorial((p) => Math.min(paginacionHistorial.total_paginas, p + 1))}
              >
                Siguiente →
              </Button>
            </Card.Footer>
          )}
        </Card>
      )}

      <Modal show={mostrarModalImprimir} onHide={() => setMostrarModalImprimir(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Imprimir registro</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            Marque los productores que quiere incluir en la misma hoja, todos con la semana{' '}
            {formatoCorto(fechaInicio)} a {formatoCorto(dias[dias.length - 1]?.fecha)}.
          </p>

          {errorImprimir && <Alert variant="danger">{errorImprimir}</Alert>}

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {productores.map((p) => (
              <Form.Check
                key={p.id}
                type="checkbox"
                id={`imprimir-${p.id}`}
                className="mb-2"
                label={
                  <span className="d-flex align-items-center gap-2">
                    <Punto color={p.color_identificativo} />
                    {p.nombre}
                  </span>
                }
                checked={seleccionImprimir.includes(String(p.id))}
                onChange={() => alternarSeleccion(String(p.id))}
              />
            ))}
            {productores.length === 0 && <p className="text-muted">No hay productores activos.</p>}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setMostrarModalImprimir(false)}>
            Cancelar
          </Button>
          <Button variant="success" onClick={imprimirSeleccionados} disabled={imprimiendo}>
            {imprimiendo ? 'Preparando...' : `Imprimir (${seleccionImprimir.length})`}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RegistroLeche;