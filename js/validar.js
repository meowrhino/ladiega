/* ============================================================
   validar.js — leer un JSON y revisarlo con su esquema (schema/).
   Lo que VS Code subraya en rojo, el build lo para y la vista previa
   lo enseña. De JAMstack (quienNoCorre). No toca el disco.
   ============================================================ */

/** Lee un JSON y, si está mal, dice en qué línea: "position 1432" no le dice nada a nadie. */
export function leerJSON(texto, rel) {
  try {
    return JSON.parse(texto);
  } catch (e) {
    /* Node no siempre dice la línea (una coma de más da "Unexpected token ']'"):
       entonces se busca una coma antes de ] o }, o una que falta (un valor y, en la
       línea siguiente, otro). Como en semillaEcommerceJSON. */
    const busca = (re) => { const m = re.exec(texto); return m ? texto.slice(0, m.index).split("\n").length : 0; };
    const pos = Number(/position (\d+)/.exec(e.message)?.[1]);
    let linea = Number(/line (\d+)/.exec(e.message)?.[1])
      || (Number.isFinite(pos) ? texto.slice(0, pos).split("\n").length : 0)
      || busca(/,\s*[\]}]/) || busca(/[\d"\]}]\s*\n\s*["{[]/);
    // "Expected ','": Node se da cuenta en la línea siguiente; la coma falta al final de la anterior
    if (/Expected ','/.test(e.message) && linea > 1 && !/,\s*$/.test(texto.split("\n")[linea - 2])) linea--;
    const err = new Error(`${rel} no es un JSON válido${linea ? `, línea ${linea}:\n    ${texto.split("\n")[linea - 1]?.trim()}` : ""}\n`
      + `  Casi siempre es una coma: que falta entre dos cosas, o que sobra después de la última. O unas comillas sin cerrar.`);
    err.json = true;
    throw err;
  }
}

/** Lo que dice schema/<tipo>.json, comprobado también aquí (de oriol, con
    patternProperties de almarbra): lo que VS Code subraya en rojo, el build lo
    para y la vista previa lo enseña. Solo lo que usan esos esquemas (type, enum,
    pattern, required, properties, additionalProperties, items, maxItems, minimum,
    anyOf y $ref a sus $defs). Devuelve los errores, en castellano, o [] si está bien. */
export function validar(dato, esquema, fichero) {
  const TIPO = { string: 'un texto entre comillas', number: 'un número', boolean: 'true o false',
                 array: 'una lista [ … ]', object: 'un bloque { … }', null: 'null' };
  const tipo = v => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  // un $ref lleva a su $defs; lo de al lado (la description) manda
  const def = s => (s.$ref ? { ...esquema.$defs[s.$ref.split('/').pop()], ...s, $ref: undefined } : s);
  const tipoOk = (v, s) => !s.type || [].concat(s.type).includes(tipo(v));
  function mirar(v, s, camino) {
    s = def(s);
    const donde = camino.length ? `"${camino.join(' → ')}"` : 'el fichero';
    const pista = s.description ? ` (${s.description})` : '';
    if (s.anyOf) {
      const opciones = s.anyOf.map(def);
      if (opciones.some(o => !mirar(v, o, camino).length)) return [];
      const suya = opciones.find(o => tipoOk(v, o));
      return suya ? mirar(v, suya, camino) : [`${donde} no vale así${pista}`];
    }
    if (!tipoOk(v, s)) return [`${donde} tiene que ser ${[].concat(s.type).map(t => TIPO[t]).join(' o ')}${pista}`];
    const e = [];
    if (s.enum && !s.enum.includes(v)) e.push(`${donde}: "${v}" no vale; tiene que ser ${s.enum.map(x => `"${x}"`).join(', ')}`);
    if (s.pattern && typeof v === 'string' && !new RegExp(s.pattern).test(v)) e.push(`${donde}: "${v}" no tiene la forma que toca${pista}`);
    if (s.minimum != null && typeof v === 'number' && v < s.minimum) e.push(`${donde} tiene que ser ${s.minimum} o más`);
    if (Array.isArray(v)) {
      if (s.maxItems != null && v.length > s.maxItems) e.push(`${donde}: como mucho ${s.maxItems}`);
      if (s.items) v.forEach((x, i) => e.push(...mirar(x, s.items, [...camino, String(i + 1)])));
    } else if (tipo(v) === 'object') {
      for (const r of s.required || []) if (!(r in v)) e.push(`falta "${r}"${camino.length ? ` en ${donde}` : ''}${s.properties?.[r]?.description ? ` (${s.properties[r].description})` : ''}`);
      for (const [k, x] of Object.entries(v)) {
        const patron = Object.entries(s.patternProperties || {}).find(([p]) => new RegExp(p).test(k));
        if (s.properties?.[k]) e.push(...mirar(x, s.properties[k], [...camino, k]));
        else if (patron) e.push(...mirar(x, patron[1], [...camino, k]));
        else if (typeof s.additionalProperties === 'object') e.push(...mirar(x, s.additionalProperties, [...camino, k]));
        else if (s.additionalProperties === false) {
          const hay = Object.keys(s.properties || {}).filter(p => p !== '$schema' && p !== '_');
          e.push(`"${[...camino, k].join(' → ')}" no es un campo de aquí (¿mal escrito?). Los que hay: ${hay.join(', ')}`);
        }
      }
    }
    return e;
  }
  return mirar(dato, esquema, []).map(m => `${fichero}: ${m}`);
}
