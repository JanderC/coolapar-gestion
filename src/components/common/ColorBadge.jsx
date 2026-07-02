import React from 'react';

// Muestra el punto de color asignado a un productor, junto a su nombre.
const ColorBadge = ({ color, texto }) => (
  <span>
    <span className="badge-color-dot" style={{ backgroundColor: color }}></span>
    {texto}
  </span>
);

export default ColorBadge;
