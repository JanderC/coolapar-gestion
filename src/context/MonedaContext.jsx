import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as configuracionApi from '../api/configuracion.api';

const MonedaContext = createContext(null);

// Simbolos de respaldo (por si el backend aun no responde al montar la app)
const SIMBOLOS_RESPALDO = { BOB: 'Bs.', USD: '$', COP: 'COL$' };

export const MonedaProvider = ({ children }) => {
  const [moneda, setMoneda] = useState('BOB');
  const [monedasDisponibles, setMonedasDisponibles] = useState({});
  const [cargando, setCargando] = useState(true);

  const cargarConfiguracion = useCallback(async () => {
    try {
      const { data } = await configuracionApi.obtenerConfiguracion();
      setMoneda(data.moneda_actual);
      setMonedasDisponibles(data.monedas_disponibles || {});
    } catch (err) {
      // Si falla (ej. no autenticado todavia), se queda con BOB por defecto.
      console.error('No se pudo cargar la configuracion de moneda:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarConfiguracion();
  }, [cargarConfiguracion]);

  const cambiarMoneda = async (nuevaMoneda) => {
    await configuracionApi.actualizarMonedaSistema(nuevaMoneda);
    setMoneda(nuevaMoneda);
  };

  const simbolo = monedasDisponibles[moneda]?.simbolo || SIMBOLOS_RESPALDO[moneda] || 'Bs.';

  // Formatea usando la moneda GLOBAL del sistema
  const formatearMonto = (monto) => {
    const numero = Number(monto || 0);
    const formateado = numero.toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${simbolo} ${formateado}`;
  };

  // Formatea un monto usando una moneda ESPECIFICA (ej. la moneda propia de un
  // productor), independiente de la moneda global del sistema.
  const formatearMontoEnMoneda = (monto, codigoMoneda) => {
    const simboloEspecifico = monedasDisponibles[codigoMoneda]?.simbolo || SIMBOLOS_RESPALDO[codigoMoneda] || 'Bs.';
    const numero = Number(monto || 0);
    const formateado = numero.toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${simboloEspecifico} ${formateado}`;
  };

  return (
    <MonedaContext.Provider
      value={{
        moneda,
        simbolo,
        monedasDisponibles,
        cargando,
        formatearMonto,
        formatearMontoEnMoneda,
        cambiarMoneda,
        recargar: cargarConfiguracion,
      }}
    >
      {children}
    </MonedaContext.Provider>
  );
};

export const useMoneda = () => {
  const contexto = useContext(MonedaContext);
  if (!contexto) {
    throw new Error('useMoneda debe usarse dentro de un <MonedaProvider>.');
  }
  return contexto;
};