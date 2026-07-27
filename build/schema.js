// -------------------------------------------------------------
// PiscinaLibre - JSON-LD
//
// Todo el structured data se deriva de data/pools.json. Antes vivía
// escrito a mano en index.html y ya había empezado a divergir de los
// datos reales; generándolo no puede volver a pasar.
// -------------------------------------------------------------

import {
    parseSchedule, formatHour24, DAY_SCHEMA, scheduleSummary
} from "../lib/pools-core.js";
import { SITE, absolute } from "./templates.js";

export function poolUrl(pool) {
    return absolute(`piscina/${pool.id}/`);
}

export function districtUrl(slug) {
    return absolute(`piscinas/${slug}/`);
}

// Convierte los bloques de horario en openingHoursSpecification.
// Las horas sueltas ("21") se expresan como el rango 21:00–22:00, que es
// lo que ya asume parseHoursPart.
function openingHours(pool) {
    const parsed = pool.parsed || parseSchedule(pool.schedule);
    if (!parsed.parseable) return [];
    const specs = [];
    for (const block of parsed.blocks) {
        for (const [start, end] of block.ranges) {
            specs.push({
                "@type": "OpeningHoursSpecification",
                dayOfWeek: block.days.map(d => DAY_SCHEMA[d]),
                opens: formatHour24(start),
                closes: formatHour24(end)
            });
        }
    }
    return specs;
}

export function poolSchema(pool, { withId = true } = {}) {
    const parsed = pool.parsed || parseSchedule(pool.schedule);
    const node = {
        "@type": "SportsActivityLocation",
        name: pool.name,
        description: `Piscina con horarios de nado libre en ${pool.district}, Lima. ${scheduleSummary(parsed, pool.schedule)}`,
        address: {
            "@type": "PostalAddress",
            streetAddress: pool.address,
            addressLocality: pool.district,
            addressRegion: "Lima",
            addressCountry: "PE"
        },
        geo: {
            "@type": "GeoCoordinates",
            latitude: pool.lat,
            longitude: pool.lng
        },
        url: poolUrl(pool),
        sport: "Natación",
        isAccessibleForFree: false
    };
    if (withId) node["@id"] = poolUrl(pool) + "#place";
    if (pool.image) node.image = pool.image;
    if (pool.whatsapp) node.telephone = "+" + pool.whatsapp.replace(/\D/g, "");

    if (pool.priceNum > 0) {
        node.priceRange = `S/. ${pool.priceNum.toFixed(2)}`;
        node.makesOffer = [{
            "@type": "Offer",
            name: "Turno de nado libre",
            price: pool.priceNum.toFixed(2),
            priceCurrency: "PEN",
            availability: "https://schema.org/InStock",
            url: pool.regType === "online" && pool.register.startsWith("http") ? pool.register : poolUrl(pool)
        }];
    }

    const hours = openingHours(pool);
    if (hours.length) node.openingHoursSpecification = hours;

    return node;
}

export function websiteSchema() {
    return {
        "@type": "WebSite",
        "@id": SITE.url + "#website",
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: "es-PE",
        publisher: { "@id": SITE.url + "#person" }
    };
}

export function personSchema() {
    return {
        "@type": "Person",
        "@id": SITE.url + "#person",
        name: SITE.author,
        email: SITE.email,
        url: SITE.url
    };
}

export function itemListSchema(pools, name) {
    return {
        "@type": "ItemList",
        name,
        numberOfItems: pools.length,
        itemListElement: pools.map((pool, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: poolUrl(pool),
            name: pool.name
        }))
    };
}

export function faqSchema(items) {
    return {
        "@type": "FAQPage",
        mainEntity: items.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a }
        }))
    };
}

export function articleSchema({ title, description, path, builtAt }) {
    return {
        "@type": "Article",
        headline: title,
        description,
        inLanguage: "es-PE",
        mainEntityOfPage: absolute(path),
        datePublished: builtAt.iso,
        dateModified: builtAt.iso,
        author: { "@id": SITE.url + "#person" },
        publisher: { "@id": SITE.url + "#person" }
    };
}
