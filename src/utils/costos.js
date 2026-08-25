
export const redondear2 = (numero) => Math.round((Number(numero) + Number.EPSILON) * 100) / 100;

export const costoPorKiloPorMoneda = (costosPorMoneda, kilosObtenidos) => {
  const kilos = Number(kilosObtenidos) || 0;
  if (kilos <= 0) return [];
  return (costosPorMoneda || [])
    .filter((c) => Number(c.monto) > 0)
    .map((c) => ({ moneda: c.moneda, monto: redondear2(Number(c.monto) / kilos) }));
};
