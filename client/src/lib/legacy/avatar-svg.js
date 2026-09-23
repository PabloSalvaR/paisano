// RESPALDO, no se usa: los avatares dibujados a mano en SVG que hubo hasta sept 2026 (8 personajes con piel, pelo, sombrero o
// pañuelo y bigote, y el poncho del color del asiento). Los reemplazaron los retratos de `public/personajes/`
// (ver `characters.ts`). Ningún archivo importa esto: queda por si hace falta volver a un avatar dibujado con código.
// Los datos de los 8 personajes están abajo (`OLD_CHARACTERS`) y cada uno quedó también como imagen en `avatares/<id>.svg`
// (con el poncho rojo del primer asiento), para verlos sin correr nada.

/**
 * Dibuja un personaje (cara, pelo, sombrero o pañuelo, bigote) con el poncho del color `i.css`. `i` trae los campos de
 * `Character` (`skin`, `hair`, `hat`, `mustache`, `headscarf`) más `css` (color del poncho). Se usa en la mesa
 * (`avatarSVG`, con el color del asiento) y en el selector de personaje del menú (con el color del asiento 0).
 */
export function characterSVG(i) {
  var hair = i.headscarf ? '' : '<path d="M11.5 17 Q12 8 20 8 Q28 8 28.5 17 Q24 12 20 12 Q16 12 11.5 17Z" fill="' + i.hair + '"/>';
  var topgear = i.hat
    ? '<ellipse cx="20" cy="10.5" rx="13" ry="3" fill="#2b2118"/><path d="M13 10.5 Q13 3 20 3 Q27 3 27 10.5Z" fill="#2b2118"/>'
    : i.headscarf
    ? '<path d="M9.5 15 Q9 5 20 5 Q31 5 30.5 15 Q25 10.5 20 10.5 Q15 10.5 9.5 15Z" fill="#d9a441" stroke="#8a5a1e" stroke-width="1.2"/><circle cx="29.5" cy="13.5" r="2.4" fill="#d9a441" stroke="#8a5a1e" stroke-width="1"/>'
    : '';
  var mustache = i.mustache ? '<path d="M16 21.6 Q20 24 24 21.6" stroke="' + i.hair + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>' : '';
  return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#e7dfcc"/>' +
    '<path d="M5 40 Q8 28 20 28 Q32 28 35 40Z" fill="' + i.css + '" stroke="#3b2a18" stroke-width="1.5"/>' +
    '<circle cx="20" cy="18" r="8" fill="' + i.skin + '" stroke="#3b2a18" stroke-width="1.5"/>' +
    hair + topgear +
    '<circle cx="17" cy="19" r="1" fill="#2b2118"/><circle cx="23" cy="19" r="1" fill="#2b2118"/>' + mustache + '</svg>';
}

/** Los 8 personajes de entonces, tal como estaban en `characters.ts` (los nombres eran solo del selector y de la mesa local). */
export const OLD_CHARACTERS = [
  { id: 'tomas', label: 'Tomás', skin: '#f1c9a5', hair: '#5a3a22', woman: false, hat: true },
  { id: 'lucia', label: 'Lucía', skin: '#c98f66', hair: '#2b2118', woman: true, hat: false },
  { id: 'mateo', label: 'Mateo', skin: '#8d5a3b', hair: '#2b2118', woman: false, hat: true },
  { id: 'sofia', label: 'Sofía', skin: '#f4d3b5', hair: '#a3402b', woman: true, hat: false },
  { id: 'facundo', label: 'Facundo', skin: '#6b4226', hair: '#7a766e', woman: false, hat: true, mustache: true },
  { id: 'ramon', label: 'Ramón', skin: '#e0ad7c', hair: '#7a4a20', woman: false, hat: true, mustache: true },
  { id: 'rosario', label: 'Rosario', skin: '#a9714a', hair: '#241c12', woman: true, hat: false, headscarf: true },
  { id: 'milagros', label: 'Milagros', skin: '#b97a4f', hair: '#3d2410', woman: true, hat: false },
];
