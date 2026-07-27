// -------------------------------------------------------------
// PiscinaLibre - Guías
//
// Cada guía expone `html(ctx)` en vez de un string fijo para poder
// apoyarse en los datos reales del directorio (precios, sedes, distritos).
// Así una guía no se queda desactualizada cuando cambia el Google Sheet.
//
// ctx = { pools, rel, formatPrice, escapeHtml, poolPath, districtPath }
// -------------------------------------------------------------

function poolLinkList(ctx, pools, empty = "Todavía no tenemos sedes registradas para este caso.") {
    if (!pools.length) return `<p>${empty}</p>`;
    return `<ul class="guide-list">${pools.map(p =>
        `<li><a href="${ctx.poolPath(p)}">${ctx.escapeHtml(p.name)}</a> — ${ctx.escapeHtml(p.district)}, ${ctx.formatPrice(p.priceNum)}</li>`
    ).join("")}</ul>`;
}

export const GUIAS = [
    {
        slug: "que-es-el-nado-libre",
        title: "Qué es el nado libre y cómo funciona en Lima",
        description: "Qué significa nado libre, en qué se diferencia de las clases de natación y cómo se reserva un turno en las piscinas de Lima.",
        summary: "La modalidad más barata de entrenar en una piscina de Lima, explicada de principio a fin.",
        html: (ctx) => `
<p><strong>Nado libre</strong> es la modalidad en la que una piscina te vende un turno de agua, sin instructor y sin clase dirigida. Llegas, nadas tus largos y te vas. Está pensada para quien ya sabe nadar y quiere entrenar por su cuenta.</p>

<h2>En qué se diferencia de una clase de natación</h2>
<p>En una clase pagas por la enseñanza: un profesor corrige tu técnica y marca los ejercicios. En nado libre pagas por el uso del carril. Por eso el nado libre es bastante más barato y por eso casi todas las sedes piden que ya sepas nadar: no hay nadie encargado de enseñarte, solo el salvavidas de turno.</p>

<h2>Cómo funciona un turno</h2>
<ul class="guide-list">
    <li><strong>Duración:</strong> lo habitual es entre 45 y 60 minutos de agua. Los cambios de turno suelen ser en punto.</li>
    <li><strong>Carriles:</strong> se comparten. En horas pico puedes acabar con tres o cuatro personas por carril, nadando en círculo.</li>
    <li><strong>Aforo:</strong> las municipales lo limitan, así que en horario de tarde conviene reservar o llegar temprano.</li>
    <li><strong>Evaluación de ingreso:</strong> algunas sedes te piden nadar un largo la primera vez, para confirmar que puedes estar en el carril sin riesgo.</li>
</ul>

<h2>Reserva online o presencial</h2>
<p>En Lima conviven los dos modelos. Unas sedes tienen plataforma web y te venden el turno con días de anticipación; otras solo atienden en boletería el mismo día. Es la diferencia más importante a la hora de planificar, porque una sede presencial puede quedarse sin cupo antes de que llegues.</p>
${(() => {
    const online = ctx.pools.filter(p => p.regType === "online");
    const presencial = ctx.pools.filter(p => p.regType === "presencial");
    return `<p><strong>Con reserva online (${online.length}):</strong></p>${poolLinkList(ctx, online)}
<p><strong>Solo presencial (${presencial.length}):</strong></p>${poolLinkList(ctx, presencial)}`;
})()}

<h2>Antes de ir</h2>
<p>Confirma siempre el horario por teléfono o WhatsApp antes de moverte. Las piscinas municipales cierran por mantenimiento, feriados, campeonatos y actividades del municipio, y esos cambios rara vez se publican con antelación.</p>
`
    },
    {
        slug: "requisitos-piscina-municipal-lima",
        title: "Requisitos para entrar a una piscina municipal en Lima",
        description: "DNI, gorro, certificado médico y demás requisitos que piden las piscinas municipales de Lima para el nado libre.",
        summary: "Lo que te van a pedir en la puerta, y qué hacer si te falta algo.",
        html: (ctx) => `
<p>Los requisitos cambian de una municipalidad a otra, pero hay un mínimo común que se repite en casi todas las sedes de Lima. Llegar sin alguno de estos elementos es el motivo más frecuente por el que a alguien no lo dejan entrar.</p>

<h2>Lo que piden casi siempre</h2>
<ul class="guide-list">
    <li><strong>Documento de identidad.</strong> DNI original o carné de extranjería. En varias sedes lo retienen mientras dura el turno o lo registran a la entrada.</li>
    <li><strong>Gorro de natación.</strong> Silicona o tela. Es obligatorio en prácticamente todas las piscinas públicas, sin importar si tienes el pelo corto.</li>
    <li><strong>Ropa de baño deportiva.</strong> Trusa, jammer o enterizo. Los shorts de playa, las bermudas y la ropa de algodón no se aceptan.</li>
    <li><strong>Sandalias de jebe.</strong> Para circular por el borde y los vestuarios.</li>
</ul>

<h2>El certificado médico</h2>
<p>Es el requisito que más varía. Algunas sedes piden un certificado médico reciente, otras hacen una evaluación rápida en la puerta con un tópico propio, y otras se conforman con una declaración jurada de salud que firmas ahí mismo. Cuando lo piden, suele tener una vigencia de entre uno y tres meses.</p>
<p>Si vas por primera vez a una sede, pregunta por este punto antes de ir. Es el que puede costarte el viaje.</p>

<h2>Lo que suele estar prohibido</h2>
<ul class="guide-list">
    <li>Entrar con bronceador o cremas sin ducharse antes.</li>
    <li>Nadar con joyas, relojes o piercings grandes.</li>
    <li>Usar aletas, palas o snorkel sin autorización, porque estorban en un carril compartido.</li>
    <li>Entrar con heridas abiertas o cuadros de conjuntivitis y hongos.</li>
</ul>

<h2>Requisitos por sede</h2>
<p>Cada ficha del directorio tiene el contacto de la sede para confirmar estos puntos:</p>
${poolLinkList(ctx, ctx.pools)}
`
    },
    {
        slug: "que-llevar-a-la-piscina",
        title: "Qué llevar a la piscina: lista para nado libre",
        description: "Lista de lo que necesitas para un turno de nado libre en Lima: gorro, lentes, sandalias, toalla y los extras que se agradecen.",
        summary: "La lista corta de lo imprescindible y lo que marca la diferencia.",
        html: () => `
<p>Un turno de nado libre dura menos de una hora, así que la mochila puede ser mínima. Esta es la lista que cubre el 100% de las sedes de Lima.</p>

<h2>Imprescindible</h2>
<ul class="guide-list">
    <li><strong>Gorro de natación.</strong> Sin esto no entras. La silicona aísla mejor y dura más; la tela es más cómoda si te aprieta la cabeza.</li>
    <li><strong>Ropa de baño deportiva.</strong> Trusa, jammer o enterizo. Nada de shorts de playa.</li>
    <li><strong>Lentes de natación.</strong> Técnicamente opcionales, pero el cloro de las piscinas públicas es fuerte y sin lentes acabas con los ojos irritados.</li>
    <li><strong>Sandalias de jebe.</strong> El suelo de los vestuarios es la vía rápida a los hongos.</li>
    <li><strong>Toalla.</strong> Casi ninguna sede municipal presta.</li>
    <li><strong>DNI.</strong> Te lo van a pedir en la puerta.</li>
</ul>

<h2>Se agradece llevar</h2>
<ul class="guide-list">
    <li><strong>Bolsa impermeable</strong> para la ropa de baño mojada a la salida.</li>
    <li><strong>Candado pequeño</strong>: muchos casilleros son de argolla y no incluyen candado.</li>
    <li><strong>Botella de agua.</strong> Se deshidrata más de lo que parece dentro del agua.</li>
    <li><strong>Jabón o shampoo</strong> en envase pequeño, para sacarte el cloro antes de salir.</li>
    <li><strong>Efectivo.</strong> Varias boleterías municipales no aceptan tarjeta.</li>
</ul>

<h2>Cuidados después de nadar</h2>
<p>Enjuágate con agua dulce apenas salgas: el cloro reseca la piel y estropea el elástico de la ropa de baño. Enjuaga también gorro y lentes, y sécalos a la sombra. Un par de lentes bien enjuagados dura años; uno guardado húmedo dentro de la mochila dura una temporada.</p>
`
    },
    {
        slug: "piscinas-temperadas-lima",
        title: "Piscinas temperadas en Lima para nadar en invierno",
        description: "Dónde nadar en Lima durante el invierno: piscinas temperadas y techadas con horarios de nado libre.",
        summary: "El invierno limeño no obliga a dejar de nadar, si eliges bien la sede.",
        html: (ctx) => `
<p>El invierno en Lima no trae frío extremo, pero sí humedad alta y semanas enteras sin sol. En una piscina al aire libre sin temperar eso se nota mucho: el agua baja de temperatura y salir del agua se vuelve incómodo. Por eso, entre junio y setiembre, la pregunta deja de ser dónde nadar y pasa a ser dónde nadar con el agua temperada.</p>

<h2>Temperada, techada y climatizada no son lo mismo</h2>
<ul class="guide-list">
    <li><strong>Temperada:</strong> el agua se calienta, normalmente entre 26 y 29 °C. Es lo que de verdad importa para nadar cómodo.</li>
    <li><strong>Techada:</strong> tiene cobertura, así que no le entra garúa ni viento, pero eso solo no garantiza que el agua esté caliente.</li>
    <li><strong>Climatizada:</strong> se climatiza también el ambiente, no solo el agua. Es lo que hace que salir del agua no sea un castigo.</li>
</ul>
<p>Lo ideal en invierno es temperada y techada. Al reservar, pregunta explícitamente por la temperatura del agua: es habitual que una sede se anuncie como techada sin que el agua esté temperada.</p>

<h2>Sedes del directorio</h2>
<p>Estas son todas las piscinas con horarios de nado libre que tenemos registradas. Confirma con la sede si el agua está temperada antes de ir, porque el sistema de calentamiento puede estar fuera de servicio:</p>
${poolLinkList(ctx, ctx.pools)}

<h2>Consejos para nadar en invierno</h2>
<ul class="guide-list">
    <li>Elige turnos de mediodía o primera tarde: el ambiente está menos frío que a las 6 de la mañana o a las 10 de la noche.</li>
    <li>Lleva toalla grande y una casaca con capucha. El problema del invierno no es el agua, es el trayecto del agua al vestuario.</li>
    <li>Sécate el pelo antes de salir a la calle.</li>
    <li>No te saltes el calentamiento fuera del agua: con frío, el músculo tarda más en responder.</li>
</ul>
`
    },
    {
        slug: "cuanto-cuesta-nadar-en-lima",
        title: "Cuánto cuesta nadar en Lima: precios de nado libre",
        description: "Precios reales del turno de nado libre en las piscinas de Lima, de las municipales más económicas a los centros acuáticos.",
        summary: "Lo que cuesta un turno hoy, sede por sede, y cómo bajar el costo por sesión.",
        html: (ctx) => {
            const conPrecio = ctx.pools.filter(p => p.priceNum > 0).sort((a, b) => a.priceNum - b.priceNum);
            const min = conPrecio.length ? conPrecio[0] : null;
            const max = conPrecio.length ? conPrecio[conPrecio.length - 1] : null;
            const media = conPrecio.length
                ? (conPrecio.reduce((s, p) => s + p.priceNum, 0) / conPrecio.length)
                : 0;
            return `
<p>Nadar en Lima es de los deportes más baratos que hay, siempre que vayas a una sede municipal. ${min && max ? `Hoy el directorio registra turnos desde <strong>${ctx.formatPrice(min.priceNum)}</strong> hasta <strong>${ctx.formatPrice(max.priceNum)}</strong>, con un promedio de <strong>${ctx.formatPrice(media)}</strong> por turno.` : ""}</p>

<h2>Precios por sede</h2>
<div class="table-scroll">
<table class="guide-table">
    <thead><tr><th>Piscina</th><th>Distrito</th><th>Precio</th></tr></thead>
    <tbody>
        ${conPrecio.map(p => `<tr>
            <td><a href="${ctx.poolPath(p)}">${ctx.escapeHtml(p.name)}</a></td>
            <td>${ctx.escapeHtml(p.district)}</td>
            <td>${ctx.formatPrice(p.priceNum)}</td>
        </tr>`).join("")}
    </tbody>
</table>
</div>
<p class="guide-note">Precios recogidos del directorio. Pueden cambiar sin aviso: confirma en la sede antes de ir.</p>

<h2>Qué hace que una sede sea más cara</h2>
<ul class="guide-list">
    <li><strong>Agua temperada.</strong> Calentar una piscina cuesta, y ese costo va al turno.</li>
    <li><strong>Piscina de 50 metros.</strong> Las de competencia son más caras de mantener que una de 25.</li>
    <li><strong>Reserva online.</strong> La comodidad de asegurar tu cupo suele venir con recargo de plataforma.</li>
    <li><strong>Carril individual.</strong> Algunas sedes cobran aparte si no quieres compartir carril.</li>
</ul>

<h2>Cómo bajar el costo por sesión</h2>
<ul class="guide-list">
    <li><strong>Compra abonos.</strong> Los paquetes de 8 o 10 turnos suelen salir bastante por debajo del precio suelto.</li>
    <li><strong>Nada en horario valle.</strong> Media mañana y primera tarde son más baratas y están mucho más vacías que la noche.</li>
    <li><strong>Pregunta por la tarifa de vecino.</strong> Varias municipalidades cobran menos a los residentes del distrito que acrediten domicilio con el DNI.</li>
    <li><strong>Consulta descuentos.</strong> Es común que haya tarifa reducida para estudiantes, adultos mayores y personas con discapacidad.</li>
</ul>

<h2>El costo del equipo</h2>
<p>Al gasto del turno hay que sumarle el equipo, pero es una inversión de una sola vez: gorro, lentes y sandalias cubren lo obligatorio y duran temporadas si los enjuagas después de cada sesión. Lo tienes detallado en la guía de <a href="${ctx.rel}guias/que-llevar-a-la-piscina/">qué llevar a la piscina</a>.</p>
`;
        }
    }
];
