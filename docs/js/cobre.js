// ==========================================================================
// BioSalud ECOMARCAL — la cuenta del cobre
//
// El Anexo III de la Resolución 374/2016 de SENASA admite los compuestos de
// cobre hasta 6 kg de cobre por hectárea y por año, y el protocolo del SPG
// Ecomarcal pide que el Consejo de Garantía lleve ese acumulado por chacra y
// por temporada. La app ya sabe qué se va a aplicar, en qué sectores y cada
// cuántos días, así que puede llevar la cuenta sola en vez de pedirle al
// productor que la haga con papel.
//
// QUÉ SE CUENTA, Y POR QUÉ NO SE MIRA LA DOSIS
//
// El cobre entra una sola vez: con el sulfato, al preparar la tanda. Diluir
// después reparte ese mismo cobre en más agua, no agrega ni saca un gramo. Por
// eso la cuenta no mira la dosis —que además se escribe a mano y de mil
// maneras— sino los LITROS DE CALDO que se preparan por aplicación. Es el
// único dato nuevo que hay que pedir, y es un dato que el productor sabe
// seguro, porque es el tamaño del tambor que llena.
//
// POR QUÉ ES POR SECTOR Y NO POR CHACRA
//
// El tope es por hectárea. Trescientos gramos de cobre en un sector de 200 m²
// son 15 kg por hectárea, y en media hectárea son 600 gramos: el mismo número
// de un lado y un problema del otro. Además el cobre se acumula en el suelo
// donde cae, no en el promedio de la chacra.
//
// DE DÓNDE SALEN LAS APLICACIONES
//
// Hoy salen del plan de la temporada, que es lo que hay cargado: de la regla
// de cada renglón se calculan sus fechas y se multiplican por los sectores
// marcados. Cuando esté la fase 3 va a poder alimentarse de lo aplicado de
// verdad, y para eso `porSector` recibe una lista plana de aplicaciones: lo
// único que hay que cambiar es de dónde sale esa lista.
// ==========================================================================

window.Cobre = (function () {
  const LIMITE = 6;     // kg de cobre por hectárea y por año
  const CERCA = 0.7;    // a partir del 70 % del tope conviene avisar

  // Una ficha "lleva cobre" si los datos lo dicen, no si el nombre suena a
  // cobre: así sumar mañana otro preparado con cobre es cargar su dato y nada
  // más.
  const lleva = (f) => !!(f && f.cobre && Number(f.cobre.gramos_por_litro) > 0);

  const limite = (bio) =>
    Number(bio && bio.cobre && bio.cobre.limite_kg_ha_anio) || LIMITE;

  // Gramos de cobre metálico de una tanda de tantos litros.
  function gramosDeUnaTanda(ficha, litros) {
    if (!lleva(ficha)) return 0;
    const l = Number(litros);
    if (!(l > 0)) return 0;
    return l * Number(ficha.cobre.gramos_por_litro);
  }

  // Un renglón del plan vale por muchas aplicaciones: una por cada fecha de su
  // recurrencia, en cada sector marcado. Esto lo desarma en la lista plana que
  // necesita la cuenta.
  function aplicacionesDelPlan(renglones, cuantasVeces) {
    const lista = [];
    (renglones || []).forEach((r) => {
      const veces = Number(cuantasVeces(r)) || 0;
      if (!veces) return;
      (r.sectores || []).forEach((sector) => {
        lista.push({
          producto_id: r.producto_id,
          producto: r.producto,
          sector: sector,
          litros: Number(r.litros_por_aplicacion) || 0,
          veces: veces,
        });
      });
    });
    return lista;
  }

  // Un renglón por cada sector que recibe cobre, del más cargado al menos.
  //
  // `buscarFicha` se recibe en vez de los datos enteros para que esto no
  // dependa de cómo está armado biopreparados.json.
  function porSector(aplicaciones, sectores, buscarFicha, tope) {
    const limiteReal = Number(tope) > 0 ? Number(tope) : LIMITE;
    const acumulado = new Map();

    (aplicaciones || []).forEach((a) => {
      const gramos = gramosDeUnaTanda(buscarFicha(a.producto_id), a.litros)
                   * (Number(a.veces) || 0);
      if (!gramos) return;

      if (!acumulado.has(a.sector)) {
        acumulado.set(a.sector, { gramos: 0, productos: new Map() });
      }
      const fila = acumulado.get(a.sector);
      fila.gramos += gramos;
      fila.productos.set(a.producto, (fila.productos.get(a.producto) || 0) + gramos);
    });

    const filas = [];
    acumulado.forEach((fila, id) => {
      const sector = (sectores || []).find((s) => s.id === id);
      const m2 = Number(sector && sector.superficie) || 0;
      const ha = m2 / 10000;

      // Sin superficie cargada no hay kg/ha que calcular. Se informa el total
      // igual y se avisa, en vez de inventar un número o callarse.
      const kgPorHa = ha > 0 ? (fila.gramos / 1000) / ha : null;

      filas.push({
        sector: id,
        nombre: sector ? sector.nombre : "Sector que ya no está",
        superficie: m2,
        gramos: fila.gramos,
        kg_por_ha: kgPorHa,
        porcentaje: kgPorHa === null ? null : (kgPorHa / limiteReal) * 100,
        estado: kgPorHa === null ? "sin-superficie"
              : kgPorHa > limiteReal ? "pasado"
              : kgPorHa >= limiteReal * CERCA ? "cerca"
              : "ok",
        productos: Array.from(fila.productos.entries())
          .map((e) => ({ nombre: e[0], gramos: e[1] }))
          .sort((a, b) => b.gramos - a.gramos),
      });
    });

    return filas.sort((a, b) => (b.kg_por_ha || 0) - (a.kg_por_ha || 0));
  }

  // El peor de todos, que es el que define si hay que avisar. Entre dos con el
  // mismo estado queda el de más kg/ha, porque `porSector` ya los ordenó así y
  // este orden respeta los empates.
  function peor(filas) {
    const orden = { pasado: 3, cerca: 2, "sin-superficie": 1, ok: 0 };
    return (filas || []).slice()
      .sort((a, b) => orden[b.estado] - orden[a.estado])[0] || null;
  }

  return {
    lleva, limite, gramosDeUnaTanda, aplicacionesDelPlan, porSector, peor,
    LIMITE, CERCA,
  };
})();
