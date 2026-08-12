// Impresión de hojas de registro de leche.
//
// Estas dos funciones vivían dentro de RegistroLeche.jsx. Se sacaron aquí
// para que la pantalla de resumen semanal imprima exactamente el mismo
// formato, sin copiar el HTML en dos sitios.
//
// Ubicación sugerida: src/utils/impresionLeche.js

import { formatoCorto, hoy } from './fechas';

const LOGO_URL = 'https://coolapar-gestion.vercel.app/coolapar-logo.png';

/**
 * Bloque HTML (encabezado + tabla) de UN productor, a partir de la hoja
 * que devuelve GET /api/registros-leche/hoja.
 *
 * @param datosHoja        respuesta de la API para ese productor
 * @param formatearMonto   (monto, moneda) => string; viene de useMoneda()
 */
export const construirBloqueProductor = (datosHoja, formatearMonto) => {
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
            <td class="num">${tieneDatos ? formatearMonto(subtotal, monedaHoja) : '—'}</td>
          </tr>`;
    })
    .join('');

  const filaAcidos =
    datosHoja.totales.total_litros_acidos > 0
      ? `<div><strong>Precio leche ácida:</strong> ${formatearMonto(precioAc, monedaHoja)}</div>`
      : '';

  const filaBajoGrasa =
    datosHoja.totales.total_litros_bajo_grasa > 0
      ? `<div><strong>Precio bajo en grasa:</strong> ${formatearMonto(precioBg, monedaHoja)}</div>`
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
      <div><strong>Precio por litro:</strong> ${formatearMonto(precioNormal, monedaHoja)}</div>
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
          <th class="num">${formatearMonto(datosHoja.totales.total_pagar, monedaHoja)}</th>
        </tr>
      </tfoot>
    </table>
    <div class="subtotales">
      <div>Subtotal normal: <strong>${formatearMonto(datosHoja.totales.total_pagar_normal || 0, monedaHoja)}</strong></div>
      ${datosHoja.totales.total_litros_acidos > 0 ? `<div>Subtotal ácida: <strong>${formatearMonto(datosHoja.totales.total_pagar_acida || 0, monedaHoja)}</strong></div>` : ''}
      ${datosHoja.totales.total_litros_bajo_grasa > 0 ? `<div>Subtotal bajo en grasa: <strong>${formatearMonto(datosHoja.totales.total_pagar_bajo_grasa || 0, monedaHoja)}</strong></div>` : ''}
      <div>Total a pagar: <strong>${formatearMonto(datosHoja.totales.total_pagar, monedaHoja)}</strong></div>
    </div>
    <div class="firmas">
      <div>Firma del productor</div>
      <div>Firma COOLAPAR</div>
    </div>
  </div>`;
};

/**
 * Resumen final con el total de todos los productores impresos, separado
 * por moneda. Se agrega como último bloque cuando se imprime la semana
 * completa; si se imprime un solo productor no aporta nada.
 */
export const construirBloqueTotales = (totalesPorMoneda, formatearMonto) => {
  if (!totalesPorMoneda || totalesPorMoneda.length === 0) return '';

  const filas = totalesPorMoneda
    .map(
      (t) => `
        <tr>
          <td>${t.moneda}</td>
          <td class="num">${t.productores}</td>
          <td class="num">${t.total_litros} L</td>
          <td class="num">${formatearMonto(t.total_pagar, t.moneda)}</td>
        </tr>`
    )
    .join('');

  return `
  <div class="bloque resumen-final">
    <div class="nombre-productor">Total de la semana</div>
    <table>
      <thead>
        <tr>
          <th>Moneda</th>
          <th class="num">Productores</th>
          <th class="num">Litros</th>
          <th class="num">Total a pagar</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  </div>`;
};

/**
 * Envuelve uno o más bloques en el documento completo con el logo arriba
 * y dispara la impresión desde un iframe oculto (así no lo bloquea el
 * bloqueador de ventanas emergentes del navegador).
 */
export const imprimirDocumento = (bloquesHtml, subtitulo) => {
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
  .resumen-final { border-top: 2px solid #198754; padding-top: 14px; }
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
      <p>Registro diario de leche${subtitulo ? ` — ${subtitulo}` : ''}</p>
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
