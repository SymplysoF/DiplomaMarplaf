import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, Button, Badge, Spinner } from 'react-bootstrap';
import {
    ArrowCounterclockwise,
    Flower1,
    GeoAlt as GeoAltIcon,
    Layers,
    Map as MapIcon,
    Star,
    StarFill,
    Signpost,
    ClockHistory,
    Truck,
    ArrowRightCircle
} from 'react-bootstrap-icons';
import Map, {
    NavigationControl,
    GeolocateControl,
    Layer,
    Source,
    Popup,
    MapRef,
    Marker
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import Supercluster from 'supercluster';

const osmRasterStyle: any = {
    version: 8,
    sources: {
        osm: {
            type: 'raster',
            tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 19
        }
    },
    layers: [
        {
            id: 'osm-base',
            type: 'raster',
            source: 'osm'
        }
    ]
};

interface Product {
    id?: number | string;
    name?: string;
    objectName?: string;
    categoryId?: number | null;
    categoryName?: string | null;
    quantity?: number | string | null;
    varietyName?: string | null;
}

interface Place {
    id: number;
    address: string;
    kadastrNumber?: string;
    area?: number;
    boundaries?: any;
    products: Product[];
    distance?: number | null;
    has_eco_certificate?: boolean;
}

interface Farmer {
    id: number;
    name: string;
    rating?: number;
    description?: string;
    contactphone?: string;
    contactemail?: string;
    contactaddress?: string;
    places: Place[];
    bestPlaceAddress?: string | null;
}

interface FarmersMapForBuyerProps {
    refreshTrigger?: number;
    farmers: any[];
    onFarmerSelect?: (farmerId: number) => void;
    onPlaceSelect?: (placeId: number) => void;
    onFarmerClick?: (farmer: any) => void;
    userLocation?: { lat: number; lng: number; address: string } | null;
    showRecommendedPlots?: boolean;
    recommendedFarmers?: any[];
    focusedFarmerId?: number | null;
    focusedPlaceId?: number | null;
}

const theme = {
    green: '#2f6b3a',
    greenDark: '#244f2b',
    greenSoft: '#dfeadf',
    text: '#223127',
    muted: '#6f7a71',
    border: '#e8e2d7',
    white: '#ffffff',
    badgeDark: '#49566a',
    purple: '#7a5af5',
    purpleSoft: '#f1ecff',
    blue: '#4f7cff',
    blueSoft: '#eef3ff',
    orange: '#d97706',
    goldSoft: '#fff4dc',
    red: '#c2410c',
    shadow: '0 18px 45px rgba(34,49,39,0.16)'
};

const chipStyle = (bg: string, color: string): React.CSSProperties => ({
    background: bg,
    color,
    borderRadius: 999,
    padding: '0.42rem 0.72rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6
});

const getPolygonCenter = (boundaries: any): [number, number] | null => {
    if (!boundaries || !boundaries.coordinates || boundaries.coordinates.length === 0) return null;
    const coords = boundaries.coordinates[0];
    if (!coords || coords.length === 0) return null;

    const sumLon = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0);
    const sumLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0);

    return [sumLon / coords.length, sumLat / coords.length];
};

const getColorByCategoriesCount = (count: number): string => {
    if (count >= 3) return theme.red;
    if (count === 2) return theme.orange;
    return theme.green;
};

const getColorByRating = (rating: number | undefined): string => {
    if (!rating) return '#7c8798';
    if (rating >= 4.5) return theme.green;
    if (rating >= 3.5) return theme.orange;
    return theme.red;
};

const formatRouteDuration = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '';
    const totalMinutes = Math.round(seconds / 60);

    if (totalMinutes < 60) return `${totalMinutes} мин`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) return `${hours} ч`;
    return `${hours} ч ${minutes} мин`;
};

const formatDistanceKm = (meters: number | null) => {
    if (meters === null || meters === undefined) return '';
    return `${(meters / 1000).toFixed(1)} км`;
};

const FarmersMapForBuyer: React.FC<FarmersMapForBuyerProps> = ({
    farmers: farmersProp = [],
    onFarmerSelect,
    onPlaceSelect,
    onFarmerClick,
    userLocation,
    showRecommendedPlots = false,
    recommendedFarmers = [],
    focusedFarmerId,
    focusedPlaceId
}) => {
    const [viewState, setViewState] = useState({
        longitude: 37.6173,
        latitude: 55.7558,
        zoom: 5.4
    });

    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [showPopup, setShowPopup] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(viewState.zoom);
    const [clusters, setClusters] = useState<any[]>([]);
    const [colorMode, setColorMode] = useState<'categories' | 'rating'>('categories');
    const [isMounted, setIsMounted] = useState(false);

    const [routeGeometry, setRouteGeometry] = useState<any | null>(null);
    const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
    const [routeDurationSeconds, setRouteDurationSeconds] = useState<number | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const [showRoutePanel, setShowRoutePanel] = useState(false);

    const [favoriteFarmers, setFavoriteFarmers] = useState<Set<number>>(() => {
        const saved = localStorage.getItem('favoriteFarmers');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    const mapRef = useRef<MapRef>(null);
    const superclusterRef = useRef<any>(null);
    const lastFocusedRef = useRef<string>('');
    const ZOOM_THRESHOLD = 11.5;

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        localStorage.setItem('favoriteFarmers', JSON.stringify(Array.from(favoriteFarmers)));
    }, [favoriteFarmers]);

    const farmers = useMemo<Farmer[]>(() => {
        return Array.isArray(farmersProp)
            ? farmersProp.map((farmer: any) => ({
                  ...farmer,
                  places: Array.isArray(farmer?.places)
                      ? farmer.places.map((place: any) => ({
                            ...place,
                            products: Array.isArray(place?.products) ? place.products : []
                        }))
                      : []
              }))
            : [];
    }, [farmersProp]);

    const recommendedIds = useMemo(
        () => new Set((recommendedFarmers || []).map((f: any) => f.id)),
        [recommendedFarmers]
    );

    const allPlaces = useMemo(() => {
        return farmers.flatMap((farmer) =>
            (farmer.places || []).map((place) => ({
                ...place,
                farmerId: farmer.id,
                farmerName: farmer.name,
                farmerRating: farmer.rating,
                isRecommended: showRecommendedPlots && recommendedIds.has(farmer.id)
            }))
        );
    }, [farmers, recommendedIds, showRecommendedPlots]);

    const fetchRoute = useCallback(async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
        try {
            setRouteLoading(true);
            setShowRoutePanel(true);

            const token = localStorage.getItem('userToken');
            const response = await fetch('http://localhost:5000/api/logistics/route', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ from, to })
            });

            const data = await response.json();

            if (!response.ok || !data?.success) {
                console.error('[FarmersMapForBuyer] route error:', data);
                setRouteGeometry(null);
                setRouteDistanceMeters(null);
                setRouteDurationSeconds(null);
                return;
            }

            setRouteGeometry(data.geometry || null);
            setRouteDistanceMeters(
                typeof data.distanceMeters === 'number' ? data.distanceMeters : null
            );
            setRouteDurationSeconds(
                typeof data.durationSeconds === 'number' ? data.durationSeconds : null
            );
        } catch (error) {
            console.error('[FarmersMapForBuyer] fetchRoute failed:', error);
            setRouteGeometry(null);
            setRouteDistanceMeters(null);
            setRouteDurationSeconds(null);
        } finally {
            setRouteLoading(false);
        }
    }, []);

    const centerOnPlace = useCallback(
        (place: Place, farmer: Farmer) => {
            const center = place.boundaries ? getPolygonCenter(place.boundaries) : null;

            if (!center) {
                console.warn('[FarmersMapForBuyer] No boundaries for place:', place.id, place.address);
                return;
            }

            setSelectedFarmer(farmer);
            setSelectedPlace(place);
            setShowPopup(true);
            setShowRoutePanel(true);

            setViewState((prev) => ({
                ...prev,
                longitude: center[0],
                latitude: center[1],
                zoom: 15
            }));

            if (userLocation) {
                fetchRoute(
                    { lat: userLocation.lat, lng: userLocation.lng },
                    { lat: center[1], lng: center[0] }
                );
            }

            onPlaceSelect?.(place.id);
            onFarmerSelect?.(farmer.id);
            onFarmerClick?.(farmer);
        },
        [onFarmerSelect, onPlaceSelect, onFarmerClick, userLocation, fetchRoute]
    );

    useEffect(() => {
        const focusKey = `${focusedFarmerId ?? 'none'}-${focusedPlaceId ?? 'none'}`;

        if (!focusedFarmerId && !focusedPlaceId) {
            lastFocusedRef.current = '';
            return;
        }

        if (focusKey === lastFocusedRef.current) return;

        if (focusedPlaceId != null) {
            for (const farmer of farmers) {
                const place = farmer.places.find((p) => p.id === focusedPlaceId);
                if (place && place.boundaries) {
                    lastFocusedRef.current = focusKey;
                    centerOnPlace(place, farmer);
                    return;
                }
            }
        }

        if (focusedFarmerId != null) {
            const farmer = farmers.find((f) => f.id === focusedFarmerId);
            const validPlace = farmer?.places?.find((p) => p.boundaries);
            if (farmer && validPlace) {
                lastFocusedRef.current = focusKey;
                centerOnPlace(validPlace, farmer);
            }
        }
    }, [focusedFarmerId, focusedPlaceId, farmers, centerOnPlace]);

    const toggleFavorite = (farmerId: number, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setFavoriteFarmers((prev) => {
            const next = new Set(prev);
            if (next.has(farmerId)) next.delete(farmerId);
            else next.add(farmerId);
            return next;
        });
    };

    useEffect(() => {
        if (!mapRef.current?.getMap()) return;

        if (allPlaces.length === 0) {
            setClusters([]);
            return;
        }

        const points = allPlaces
            .filter((place: any) => !!place.boundaries && !!getPolygonCenter(place.boundaries))
            .map((place: any) => {
                const center = getPolygonCenter(place.boundaries)!;
                const categoriesCount = new Set(
                    (place.products || []).map((p: Product) => p.categoryId).filter(Boolean)
                ).size;

                const color =
                    colorMode === 'categories'
                        ? getColorByCategoriesCount(categoriesCount)
                        : getColorByRating(place.farmerRating);

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [center[0], center[1]]
                    },
                    properties: {
                        id: place.id,
                        farmerId: place.farmerId,
                        farmerName: place.farmerName,
                        address: place.address,
                        productsCount: place.products.length,
                        categoriesCount,
                        color,
                        rating: place.farmerRating,
                        isFavorite: favoriteFarmers.has(place.farmerId),
                        isRecommended: !!place.isRecommended
                    }
                };
            });

        const supercluster = new (Supercluster as any)({
            radius: 65,
            maxZoom: 16,
            minZoom: 0,
            extent: 512,
            nodeSize: 64
        });

        supercluster.load(points);
        superclusterRef.current = supercluster;

        const map = mapRef.current.getMap();
        const bounds = map.getBounds();
        const bbox: [number, number, number, number] = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ];

        setClusters(supercluster.getClusters(bbox, Math.floor(viewState.zoom)));
    }, [allPlaces, colorMode, favoriteFarmers, viewState.zoom]);

    const handleMapMove = (evt: any) => {
        setViewState(evt.viewState);
        setCurrentZoom(evt.viewState.zoom);

        if (!superclusterRef.current || !mapRef.current?.getMap()) return;

        const map = mapRef.current.getMap();
        const bounds = map.getBounds();
        const bbox: [number, number, number, number] = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ];

        setClusters(superclusterRef.current.getClusters(bbox, Math.floor(evt.viewState.zoom)));
    };

    const createPlacesGeoJSON = useCallback((): GeoJSON.FeatureCollection => {
        return {
            type: 'FeatureCollection',
            features: allPlaces
                .filter((place: any) => !!place.boundaries)
                .map((place: any) => {
                    const categoriesCount = new Set(
                        (place.products || []).map((p: Product) => p.categoryId).filter(Boolean)
                    ).size;

                    const color =
                        colorMode === 'categories'
                            ? getColorByCategoriesCount(categoriesCount)
                            : getColorByRating(place.farmerRating);

                    return {
                        type: 'Feature',
                        geometry: place.boundaries,
                        properties: {
                            id: place.id,
                            farmerId: place.farmerId,
                            farmerName: place.farmerName,
                            address: place.address,
                            color,
                            isFavorite: favoriteFarmers.has(place.farmerId),
                            isRecommended: !!place.isRecommended
                        }
                    };
                })
        };
    }, [allPlaces, colorMode, favoriteFarmers]);

    if (!isMounted) {
        return (
            <div className="d-flex align-items-center justify-content-center h-100">
                <Spinner animation="border" />
            </div>
        );
    }

    return (
        <Card
            className="border-0"
            style={{ height: '100%', borderRadius: 22, overflow: 'hidden', boxShadow: '0 12px 30px rgba(34,49,39,0.08)' }}
        >
            <Card.Header className="border-0" style={{ background: theme.white, padding: '1rem 1.1rem' }}>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <MapIcon size={18} color={theme.green} />
                       
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <Button
                            size="sm"
                            onClick={() =>
                                setColorMode((prev) => (prev === 'categories' ? 'rating' : 'categories'))
                            }
                            style={{
                                background: '#fff',
                                color: theme.text,
                                border: `1px solid ${theme.border}`,
                                borderRadius: 12
                            }}
                        >
                            <Layers size={12} className="me-1" />
                            {colorMode === 'categories' ? 'By categories' : 'By rating'}
                        </Button>
                    </div>
                </div>
            </Card.Header>

            <Card.Body style={{ padding: 0 }}>
                <div style={{ height: 620, position: 'relative', overflow: 'hidden' }}>
                    <Map
                        ref={mapRef}
                        {...viewState}
                        onMove={handleMapMove}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle={osmRasterStyle}
                        interactiveLayerIds={['clusters', 'unclustered-point', 'places-fill']}
                        onClick={(e) => {
                            if (!e.features?.length) return;
                            const feature = e.features[0];

                            if (feature.layer.id === 'clusters') {
                                const clusterId = feature.properties?.cluster_id;
                                if (superclusterRef.current && clusterId && mapRef.current) {
                                    const expansionZoom =
                                        superclusterRef.current.getClusterExpansionZoom(clusterId);

                                    if (feature.geometry.type === 'Point') {
                                        const coordinates = feature.geometry.coordinates as [number, number];
                                        setViewState((prev) => ({
                                            ...prev,
                                            longitude: coordinates[0],
                                            latitude: coordinates[1],
                                            zoom: expansionZoom
                                        }));
                                    }
                                }
                                return;
                            }

                            if (feature.layer.id === 'unclustered-point' || feature.layer.id === 'places-fill') {
                                const placeId = feature.properties?.id as number;
                                const farmerId = feature.properties?.farmerId as number;
                                const farmer = farmers.find((f) => f.id === farmerId);
                                const place = farmer?.places.find((p) => p.id === placeId);

                                if (farmer && place) {
                                    centerOnPlace(place, farmer);
                                }
                            }
                        }}
                    >
                        <NavigationControl position="top-right" />
                        <GeolocateControl position="top-right" />

                        {userLocation && (
                            <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
                                <div
                                    style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: '50%',
                                        background: theme.blue,
                                        border: '3px solid #fff',
                                        boxShadow: '0 0 0 6px rgba(79,124,255,0.18)'
                                    }}
                                />
                            </Marker>
                        )}

                        {currentZoom >= ZOOM_THRESHOLD && (
                            <Source id="places-polygons" type="geojson" data={createPlacesGeoJSON()}>
                                <Layer
                                    id="places-fill"
                                    type="fill"
                                    paint={{
                                        'fill-color': ['get', 'color'],
                                        'fill-opacity': [
                                            'case',
                                            ['==', ['get', 'id'], selectedPlace?.id || ''],
                                            0.46,
                                            ['==', ['get', 'isRecommended'], true],
                                            0.34,
                                            0.18
                                        ]
                                    }}
                                />
                                <Layer
                                    id="places-border"
                                    type="line"
                                    paint={{
                                        'line-color': [
                                            'case',
                                            ['==', ['get', 'id'], selectedPlace?.id || ''],
                                            theme.purple,
                                            ['==', ['get', 'isRecommended'], true],
                                            theme.greenDark,
                                            ['get', 'color']
                                        ],
                                        'line-width': [
                                            'case',
                                            ['==', ['get', 'id'], selectedPlace?.id || ''],
                                            4,
                                            ['==', ['get', 'isRecommended'], true],
                                            3,
                                            2
                                        ]
                                    }}
                                />
                            </Source>
                        )}

                        {routeGeometry && (
                            <Source
                                id="customer-route-line"
                                type="geojson"
                                data={{
                                    type: 'FeatureCollection',
                                    features: [
                                        {
                                            type: 'Feature',
                                            geometry: routeGeometry,
                                            properties: {}
                                        }
                                    ]
                                }}
                            >
                                <Layer
                                    id="customer-route-line-layer"
                                    type="line"
                                    paint={{
                                        'line-color': theme.purple,
                                        'line-width': 4,
                                        'line-opacity': 0.95,
                                        'line-dasharray': [2, 2]
                                    }}
                                />
                            </Source>
                        )}

                        {clusters.length > 0 && (
                            <Source
                                id="places-points"
                                type="geojson"
                                data={{
                                    type: 'FeatureCollection',
                                    features: clusters
                                }}
                            >
                                <Layer
                                    id="clusters"
                                    type="circle"
                                    source="places-points"
                                    filter={['has', 'point_count']}
                                    paint={{
                                        'circle-color': [
                                            'step',
                                            ['get', 'point_count'],
                                            '#2f6b3a',
                                            10,
                                            '#7a5af5',
                                            30,
                                            '#d97706'
                                        ],
                                        'circle-radius': [
                                            'step',
                                            ['get', 'point_count'],
                                            20,
                                            10,
                                            28,
                                            30,
                                            36
                                        ],
                                        'circle-stroke-width': 4,
                                        'circle-stroke-color': '#ffffff'
                                    }}
                                />

                                <Layer
                                    id="cluster-count"
                                    type="symbol"
                                    source="places-points"
                                    filter={['has', 'point_count']}
                                    layout={{
                                        'text-field': '{point_count_abbreviated}',
                                        'text-size': 13
                                    }}
                                    paint={{
                                        'text-color': '#ffffff'
                                    }}
                                />

                                <Layer
                                    id="unclustered-point"
                                    type="circle"
                                    source="places-points"
                                    filter={['!', ['has', 'point_count']]}
                                    paint={{
                                        'circle-color': [
                                            'case',
                                            ['==', ['get', 'isRecommended'], true],
                                            theme.purple,
                                            ['get', 'color']
                                        ],
                                        'circle-radius': [
                                            'case',
                                            ['==', ['get', 'isRecommended'], true],
                                            14,
                                            ['==', ['get', 'isFavorite'], true],
                                            13,
                                            10
                                        ],
                                        'circle-stroke-width': 4,
                                        'circle-stroke-color': '#ffffff'
                                    }}
                                />
                            </Source>
                        )}

                        {showPopup && selectedPlace && selectedFarmer && (
                            <Popup
                                longitude={getPolygonCenter(selectedPlace.boundaries)?.[0] || viewState.longitude}
                                latitude={getPolygonCenter(selectedPlace.boundaries)?.[1] || viewState.latitude}
                                onClose={() => setShowPopup(false)}
                                closeButton
                                closeOnClick={false}
                                anchor="bottom"
                                offset={22}
                                maxWidth="380px"
                            >
                                <PlacePopup
                                    place={selectedPlace}
                                    farmer={selectedFarmer}
                                    onToggleFavorite={toggleFavorite}
                                    isFavorite={favoriteFarmers.has(selectedFarmer.id)}
                                />
                            </Popup>
                        )}
                    </Map>

                    <div
                        style={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                            zIndex: 10,
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap'
                        }}
                    >
                        <Button
                            size="sm"
                            onClick={() => {
                                setSelectedFarmer(null);
                                setSelectedPlace(null);
                                setShowPopup(false);
                                setShowRoutePanel(false);
                                setRouteGeometry(null);
                                setRouteDistanceMeters(null);
                                setRouteDurationSeconds(null);
                                lastFocusedRef.current = '';
                                setViewState({
                                    longitude: 37.6173,
                                    latitude: 55.7558,
                                    zoom: 5.4
                                });
                            }}
                            style={{
                                background: '#fff',
                                color: theme.text,
                                border: `1px solid ${theme.border}`,
                                borderRadius: 12
                            }}
                        >
                            <ArrowCounterclockwise className="me-1" />
                            Reset
                        </Button>

                    </div>

                    <div
                        style={{
                            position: 'absolute',
                            top: 18,
                            right: 18,
                            width: 320,
                            maxWidth: 'calc(100% - 36px)',
                            zIndex: 12,
                            transform: showRoutePanel ? 'translateX(0)' : 'translateX(115%)',
                            transition: 'transform 0.28s ease',
                            pointerEvents: showRoutePanel ? 'auto' : 'none'
                        }}
                    >
                        <Card
                            className="border-0"
                            style={{
                                borderRadius: 22,
                                overflow: 'hidden',
                                boxShadow: theme.shadow,
                                background: '#ffffff'
                            }}
                        >
                            <Card.Header
                                className="border-0"
                                style={{
                                    background: 'linear-gradient(135deg, #ffffff 0%, #faf8f3 100%)',
                                    padding: '1rem 1rem 0.85rem'
                                }}
                            >
                                <div className="d-flex justify-content-between align-items-start gap-2">
                                    <div>
                                        <div
                                            className="d-flex align-items-center gap-2 mb-2"
                                            style={{ color: theme.text, fontWeight: 800, fontSize: '1rem' }}
                                        >
                                            <Truck size={18} color={theme.green} />
                                            Маршрут доставки
                                        </div>

                                        <div style={{ color: theme.muted, fontSize: '0.88rem' }}>
                                            {selectedPlace?.address || 'Выберите участок на карте'}
                                        </div>
                                    </div>

                                    <Button
                                        size="sm"
                                        onClick={() => setShowRoutePanel(false)}
                                        style={{
                                            background: '#fff',
                                            color: theme.text,
                                            border: `1px solid ${theme.border}`,
                                            borderRadius: 12,
                                            minWidth: 38
                                        }}
                                    >
                                        ×
                                    </Button>
                                </div>
                            </Card.Header>

                            <Card.Body style={{ padding: '1rem' }}>
                                {routeLoading ? (
                                    <div className="d-flex align-items-center justify-content-center py-4">
                                        <Spinner animation="border" size="sm" className="me-2" />
                                        <span style={{ color: theme.muted }}>Строим маршрут...</span>
                                    </div>
                                ) : routeDistanceMeters !== null && routeDurationSeconds !== null ? (
                                    <>
                                        <div className="d-flex flex-column gap-3">
                                            <div
                                                style={{
                                                    background: theme.purpleSoft,
                                                    borderRadius: 18,
                                                    padding: '0.9rem 1rem'
                                                }}
                                            >
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <Signpost size={16} color={theme.purple} />
                                                    <span style={{ color: theme.muted, fontSize: '0.86rem', fontWeight: 700 }}>
                                                        Расстояние по дороге
                                                    </span>
                                                </div>
                                                <div style={{ color: theme.text, fontSize: '1.28rem', fontWeight: 800 }}>
                                                    {formatDistanceKm(routeDistanceMeters)}
                                                </div>
                                            </div>

                                            <div
                                                style={{
                                                    background: theme.greenSoft,
                                                    borderRadius: 18,
                                                    padding: '0.9rem 1rem'
                                                }}
                                            >
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <ClockHistory size={16} color={theme.green} />
                                                    <span style={{ color: theme.muted, fontSize: '0.86rem', fontWeight: 700 }}>
                                                        Примерное время в пути
                                                    </span>
                                                </div>
                                                <div style={{ color: theme.text, fontSize: '1.28rem', fontWeight: 800 }}>
                                                    {formatRouteDuration(routeDurationSeconds)}
                                                </div>
                                            </div>

                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr auto 1fr',
                                                    gap: 10,
                                                    alignItems: 'center',
                                                    background: '#faf8f3',
                                                    border: `1px solid ${theme.border}`,
                                                    borderRadius: 18,
                                                    padding: '0.9rem'
                                                }}
                                            >
                                                <div>
                                                    <div style={{ ...chipStyle(theme.blueSoft, theme.blue), marginBottom: 8 }}>
                                                        <GeoAltIcon size={12} />
                                                        Вы
                                                    </div>
                                                    <div style={{ color: theme.muted, fontSize: '0.82rem', lineHeight: 1.35 }}>
                                                        {userLocation?.address || 'Адрес покупателя'}
                                                    </div>
                                                </div>

                                                <ArrowRightCircle size={20} color={theme.purple} />

                                                <div>
                                                    <div style={{ ...chipStyle(theme.goldSoft, theme.orange), marginBottom: 8 }}>
                                                        <MapIcon size={12} />
                                                        Участок
                                                    </div>
                                                    <div style={{ color: theme.muted, fontSize: '0.82rem', lineHeight: 1.35 }}>
                                                        {selectedPlace?.address || 'Адрес участка'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ color: theme.muted, fontSize: '0.82rem', lineHeight: 1.45 }}>
                                                Маршрут строится по дорогам через OpenRouteService. Это ориентировочное время для доставки на автомобиле без учета загрузки, ожидания и погрузки.
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ color: theme.muted, fontSize: '0.9rem', lineHeight: 1.5 }}>
                                        Нажмите на участок или карточку фермера, чтобы увидеть маршрут, расстояние и примерное время доставки.
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
};

const PlacePopup: React.FC<{
    place: Place;
    farmer: Farmer;
    onToggleFavorite: (id: number, e?: React.MouseEvent) => void;
    isFavorite: boolean;
}> = ({ place, farmer, onToggleFavorite, isFavorite }) => {
    const productNames = (place.products || [])
        .slice(0, 6)
        .map((p) => p.objectName || p.name)
        .filter(Boolean)
        .join(', ');

    return (
        <div style={{ minWidth: 290, paddingTop: 2 }}>
            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                <div>
                    <div style={{ fontWeight: 700, color: theme.text, fontSize: '0.98rem' }}>
                        {farmer.name}
                    </div>
                    <div style={{ color: theme.muted, fontSize: '0.85rem', marginTop: 2 }}>
                        <GeoAltIcon size={11} className="me-1" />
                        {place.address}
                    </div>
                </div>

                <Button
                    variant="link"
                    className="p-0"
                    onClick={(e) => onToggleFavorite(farmer.id, e)}
                    style={{ color: '#d4a017' }}
                >
                    {isFavorite ? <StarFill size={15} /> : <Star size={15} />}
                </Button>
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
                {farmer.rating ? (
                    <Badge style={{ background: '#eef2f7', color: '#44546a' }}>
                        Rating {Number(farmer.rating).toFixed(1)}
                    </Badge>
                ) : null}

                {place.distance !== null && place.distance !== undefined ? (
                    <Badge style={{ background: '#e7f5ea', color: theme.green }}>
                        {Number(place.distance).toFixed(1)} km
                    </Badge>
                ) : null}

                {place.has_eco_certificate ? (
                    <Badge style={{ background: '#f1ecff', color: theme.purple }}>
                        <Flower1 size={11} className="me-1" />
                        Eco
                    </Badge>
                ) : null}
            </div>

            {productNames ? (
                <div style={{ fontSize: '0.86rem', color: theme.text, lineHeight: 1.45 }}>
                    <strong>Products:</strong> {productNames}
                </div>
            ) : (
                <div style={{ fontSize: '0.86rem', color: theme.muted }}>
                    No products list
                </div>
            )}
        </div>
    );
};

export default FarmersMapForBuyer;
