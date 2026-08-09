interface GeoJsonPointGeometry {
    type: "Point";
    coordinates: [number, number];
}

interface GeoJsonFeature {
    type: "Feature";
    geometry: GeoJsonPointGeometry;
    properties: Record<string, unknown>;
}

interface GeoJsonFeatureCollection {
    type: "FeatureCollection";
    metadata: Record<string, unknown>;
    features: GeoJsonFeature[];
}

function siteToFeature(item: Site): GeoJsonFeature {
    const references = Object.entries(item.refs).map(([refId, value]) => {
        const meta = window.references[refId];
        return {
            ref_id: refId,
            label: meta.label,
            value,
            institution: meta.institution,
            period: meta.period,
            citation: meta.citation
        };
    });

    return {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [item.long, item.lat]
        },
        properties: {
            id: item.id,
            title: item.title,
            type: item.type || null,
            type_label: typeConfigFor(item.type).label,
            datacao_c14: item.datacao ?? null,
            lat: item.lat,
            long: item.long,
            reference_count: references.length,
            references
        }
    };
}

function buildFeatureCollection(items: Site[], context: Record<string, unknown> = {}): GeoJsonFeatureCollection {
    return {
        type: "FeatureCollection",
        metadata: {
            project: "ARQ-MAP",
            generated_at: new Date().toISOString(),
            crs: "EPSG:4326 (WGS84)",
            feature_count: items.length,
            ...context
        },
        features: items.map(siteToFeature)
    };
}

function downloadGeoJson(featureCollection: GeoJsonFeatureCollection, filename: string): void {
    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
