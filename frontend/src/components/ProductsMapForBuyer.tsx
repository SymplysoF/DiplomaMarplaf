import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Card, Badge, Button, Spinner } from 'react-bootstrap';
import {
    Map as MapIcon,
    GeoAlt,
    Leaf,
    Signpost,
    ClockHistory,
    Truck,
    ArrowRightCircle,
    ArrowCounterclockwise,
    BoxSeam
} from 'react-bootstrap-icons';
import Map, {
    NavigationControl,
    GeolocateControl,
    Marker,
    Popup,
    Source,
    Layer
} from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { ProductItem } from '../types/product';

const API_BASE_URL = 'http://localhost:5000';

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
    layers: [{ id: 'osm-base', type: 'raster', source: 'osm' }]
};

interface Props {
    products: ProductItem[];
    userLocation?: { lat: number; lng: number; address: string } | null;
    focusedProduct?: ProductItem | null;
    onProductClick?: (product: ProductItem) => void;
}

const theme = {
    green: '#2f6b3a',
    greenSoft: '#dfeadf',
    text: '#223127',
    white: '#ffffff',
    border: '#e8e2d7',
    purple: '#7a5af5',
    purpleSoft: '#f1ecff',
    blue: '#4f7cff',
    blueSoft: '#eef3ff',
    orange: '#d97706',
    goldSoft: '#fff4dc',
    shadow: '0 18px 45px rgba(34,49,39,0.16)',
    badgeDark: '#49566a',
    muted: '#6f7a71'
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

const formatProductDistance = (km?: number | null) => {
    if (km === null || km === undefined || Number.isNaN(Number(km))) return '—';
    return `${Number(km).toFixed(1)} км`;
};

const getProductRouteKey = (
    userLocation: { lat: number; lng: number } | null | undefined,
    product: ProductItem | null | undefined
) => {
    if (!userLocation || !product?.coordinates) return '';
    return `${userLocation.lat}:${userLocation.lng}:${product.productId}:${product.placeId}:${product.coordinates.lat}:${product.coordinates.lng}`;
};

const ProductsMapForBuyer: React.FC<Props> = ({
    products = [],
    userLocation,
    focusedProduct,
    onProductClick
}) => {
    const mapRef = useRef<MapRef>(null);
    const lastRouteKeyRef = useRef<string>('');
    const lastFocusedKeyRef = useRef<string>('');

    const [selected, setSelected] = useState<ProductItem | null>(null);
    const [routeGeometry, setRouteGeometry] = useState<any | null>(null);
    const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
    const [routeDurationSeconds, setRouteDurationSeconds] = useState<number | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const [showRoutePanel, setShowRoutePanel] = useState(false);

    const [viewState, setViewState] = useState({
        longitude: userLocation?.lng || 37.6173,
        latitude: userLocation?.lat || 55.7558,
        zoom: userLocation ? 9 : 5.4
    });

    const points = useMemo(() => {
        return products.filter(
            (p) =>
                p.coordinates &&
                !Number.isNaN(Number(p.coordinates.lat)) &&
                !Number.isNaN(Number(p.coordinates.lng))
        );
    }, [products]);

    const fetchRoute = useCallback(
        async (product: ProductItem) => {
            if (!userLocation || !product?.coordinates) return;

            const routeKey = getProductRouteKey(userLocation, product);

            if (routeKey && routeKey === lastRouteKeyRef.current) {
                return;
            }

            lastRouteKeyRef.current = routeKey;

            try {
                setRouteLoading(true);
                setShowRoutePanel(true);

                const token = localStorage.getItem('userToken');
                const response = await fetch(`${API_BASE_URL}/api/logistics/route`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        from: { lat: userLocation.lat, lng: userLocation.lng },
                        to: { lat: product.coordinates.lat, lng: product.coordinates.lng }
                    })
                });

                const data = await response.json();

                if (!response.ok || !data?.success) {
                    console.error('[ProductsMapForBuyer] route error:', data);
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
                console.error('[ProductsMapForBuyer] fetchRoute failed:', error);
                setRouteGeometry(null);
                setRouteDistanceMeters(null);
                setRouteDurationSeconds(null);
            } finally {
                setRouteLoading(false);
            }
        },
        [userLocation]
    );

    const applySelection = useCallback(
        async (product: ProductItem, notifyParent: boolean) => {
            if (!product?.coordinates) return;

            setSelected(product);
            setShowRoutePanel(true);

            setViewState((prev) => ({
                ...prev,
                longitude: product.coordinates!.lng,
                latitude: product.coordinates!.lat,
                zoom: 13
            }));

            if (notifyParent) {
                onProductClick?.(product);
            }

            if (userLocation) {
                await fetchRoute(product);
            } else {
                setRouteGeometry(null);
                setRouteDistanceMeters(null);
                setRouteDurationSeconds(null);
            }
        },
        [fetchRoute, onProductClick, userLocation]
    );

    const handleMarkerClick = useCallback(
        async (product: ProductItem) => {
            await applySelection(product, true);
        },
        [applySelection]
    );

    const focusProductFromOutside = useCallback(
        async (product: ProductItem) => {
            await applySelection(product, false);
        },
        [applySelection]
    );

    useEffect(() => {
        if (!focusedProduct?.coordinates) return;

        const focusKey = `${focusedProduct.productId}-${focusedProduct.placeId}-${focusedProduct.coordinates.lat}-${focusedProduct.coordinates.lng}`;

        if (focusKey === lastFocusedKeyRef.current) return;

        lastFocusedKeyRef.current = focusKey;
        focusProductFromOutside(focusedProduct);
    }, [focusedProduct, focusProductFromOutside]);

    return (
        <Card className="border-0 h-100" style={{ borderRadius: 22, overflow: 'hidden' }}>
            <Card.Header className="border-0 bg-white">
                <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                        <MapIcon size={18} color={theme.green} />
                        <h6 className="mb-0" style={{ color: theme.text }}>
                            Карта продуктов
                        </h6>
                    </div>

                    <div className="d-flex gap-2">
                       
                    </div>
                </div>
            </Card.Header>

            <Card.Body style={{ padding: 0 }}>
                <div style={{ height: 620, position: 'relative', overflow: 'hidden' }}>
                    <Map
                        ref={mapRef}
                        {...viewState}
                        onMove={(evt) => setViewState(evt.viewState)}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle={osmRasterStyle}
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
                                        background: '#4f7cff',
                                        border: '3px solid #fff',
                                        boxShadow: '0 0 0 6px rgba(79,124,255,0.18)'
                                    }}
                                />
                            </Marker>
                        )}

                        {routeGeometry && (
                            <Source
                                id="product-route-line"
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
                                    id="product-route-line-layer"
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

                        {points.map((product) => (
                            <Marker
                                key={`${product.productId}-${product.placeId}-${product.farmerId}`}
                                longitude={product.coordinates!.lng}
                                latitude={product.coordinates!.lat}
                            >
                                <button
                                    onClick={() => handleMarkerClick(product)}
                                    style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: '50%',
                                        border: '3px solid #fff',
                                        background: product.clusterRankColor || theme.purple,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                                        cursor: 'pointer'
                                    }}
                                />
                            </Marker>
                        ))}

                        {selected?.coordinates && (
                            <Popup
                                longitude={selected.coordinates.lng}
                                latitude={selected.coordinates.lat}
                                onClose={() => setSelected(null)}
                                closeOnClick={false}
                                anchor="bottom"
                            >
                                <div style={{ minWidth: 260 }}>
                                    <div style={{ fontWeight: 700 }}>{selected.fullProductName}</div>

                                    <div className="small text-muted mt-1">
                                        <GeoAlt size={12} className="me-1" />
                                        {selected.placeAddress}
                                    </div>

                                    <div className="small mt-1">Фермер: {selected.farmerName}</div>
                                    <div className="small mt-1">
                                        Цена: {Number(selected.price).toFixed(0)} ₽
                                    </div>
                                    <div className="small mt-1">
                                        Расстояние: {formatProductDistance(selected.distance)}
                                    </div>

                                    {selected.has_eco_certificate && (
                                        <div className="small mt-1 text-success">
                                            <Leaf size={12} className="me-1" />
                                            Eco certificate
                                        </div>
                                    )}
                                </div>
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
                                setSelected(null);
                                setShowRoutePanel(false);
                                setRouteGeometry(null);
                                setRouteDistanceMeters(null);
                                setRouteDurationSeconds(null);
                                lastRouteKeyRef.current = '';
                                lastFocusedKeyRef.current = '';
                                setViewState({
                                    longitude: userLocation?.lng || 37.6173,
                                    latitude: userLocation?.lat || 55.7558,
                                    zoom: userLocation ? 9 : 5.4
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
                            Сбросить
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
                                            {selected?.fullProductName || 'Выберите продукт на карте'}
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
                                                <span
                                                    style={{
                                                        color: theme.muted,
                                                        fontSize: '0.86rem',
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    Расстояние по дороге
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    color: theme.text,
                                                    fontSize: '1.28rem',
                                                    fontWeight: 800
                                                }}
                                            >
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
                                                <span
                                                    style={{
                                                        color: theme.muted,
                                                        fontSize: '0.86rem',
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    Примерное время в пути
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    color: theme.text,
                                                    fontSize: '1.28rem',
                                                    fontWeight: 800
                                                }}
                                            >
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
                                                <div
                                                    style={{
                                                        ...chipStyle(theme.blueSoft, theme.blue),
                                                        marginBottom: 8
                                                    }}
                                                >
                                                    <GeoAlt size={12} />
                                                    Вы
                                                </div>
                                                <div
                                                    style={{
                                                        color: theme.muted,
                                                        fontSize: '0.82rem',
                                                        lineHeight: 1.35
                                                    }}
                                                >
                                                    {userLocation?.address || 'Адрес покупателя'}
                                                </div>
                                            </div>

                                            <ArrowRightCircle size={20} color={theme.purple} />

                                            <div>
                                                <div
                                                    style={{
                                                        ...chipStyle(theme.goldSoft, theme.orange),
                                                        marginBottom: 8
                                                    }}
                                                >
                                                    <BoxSeam size={12} />
                                                    Продукт
                                                </div>
                                                <div
                                                    style={{
                                                        color: theme.muted,
                                                        fontSize: '0.82rem',
                                                        lineHeight: 1.35
                                                    }}
                                                >
                                                    {selected?.placeAddress || 'Точка продажи'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ color: theme.muted, fontSize: '0.82rem', lineHeight: 1.45 }}>
                                            Маршрут строится по дорогам через OpenRouteService. Это ориентировочное
                                            время для доставки на автомобиле без учета загрузки, ожидания и
                                            погрузки.
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: theme.muted, fontSize: '0.9rem', lineHeight: 1.5 }}>
                                        Нажмите на точку продукта на карте или на карточку продукта, чтобы увидеть
                                        маршрут, расстояние и примерное время доставки.
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

export default ProductsMapForBuyer;