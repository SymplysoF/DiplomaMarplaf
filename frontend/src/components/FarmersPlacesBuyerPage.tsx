import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Row,
    Col,
    Card,
    Button,
    Badge,
    Form,
    Spinner,
    Modal,
    InputGroup
} from 'react-bootstrap';
import {
    GeoAlt,
    StarFill,
    Leaf,
    Filter,
    Grid,
    ChevronLeft,
    ChevronRight,
    Flower1,
    PersonCircle,
    BoxSeam,
    Search,
    Funnel,
    ArrowUp,
    ArrowDown,
    SortAlphaDown,
    SortNumericDown,
    Map as MapIcon,
    Balloon
} from 'react-bootstrap-icons';
import FarmersMapForBuyer from './FarmersMapForBuyer';

const API_BASE_URL = 'http://localhost:5000';

interface ProductItem {
    id?: number | string;
    name?: string;
    objectName?: string;
    categoryName?: string;
    category?: string;
    quantity?: string | number | null;
    unit?: string | null;
}

interface PlaceItem {
    id?: number;
    placeId?: number;
    address?: string;
    image_url?: string;
    image_place_url?: string;
    distance?: number | null;
    individualScore?: number;
    area?: string | number;
    productCount?: number;
    productCategories?: string[];
    products?: ProductItem[];
    has_eco_certificate?: boolean;
    boundaries?: any;
}

interface FarmerItem {
    id: number;
    userId?: number;
    name?: string;
    rating?: number;
    distance?: number | null;
    individualScore?: number;
    bestPlaceAddress?: string | null;
    placesCount?: number;
    totalProducts?: number;
    ecoCertificate?: boolean;
    has_eco_certificate?: boolean;
    description?: string;
    contactPhone?: string;
    contactEmail?: string;
    contactaddress?: string;
    places?: PlaceItem[];
}

interface FarmersPlacesBuyerPageProps {
    userLocation: { lat: number; lng: number; address: string } | null;
    allFarmers: FarmerItem[];
    mapFarmersSource?: any[];
    favorites: Set<number>;
    onFarmerSelect: (farmer: FarmerItem) => void;
    onToggleFavorite: (farmerId: number) => void;
    loading?: boolean;
}

type SortField = 'distance' | 'rating' | 'name';
type SortDirection = 'asc' | 'desc';

const FarmersPlacesBuyerPage: React.FC<FarmersPlacesBuyerPageProps> = ({
    userLocation,
    allFarmers = [],
    mapFarmersSource = [],
    favorites,
    onFarmerSelect,
    onToggleFavorite,
    loading = false
}) => {
    const { t: i18nT } = useTranslation();

    const t = useCallback(
        (key: string, options?: Record<string, unknown>) => i18nT(`customer.farmersPlaces.${key}`, options),
        [i18nT]
    );

    const [showRecommendedOnMap, setShowRecommendedOnMap] = useState(true);
    const [carouselIndex, setCarouselIndex] = useState(0);

    const [selectedPlace, setSelectedPlace] = useState<PlaceItem | null>(null);
    const [modalMode, setModalMode] = useState<'farmer' | 'place'>('farmer');
    const [selectedFarmer, setSelectedFarmer] = useState<FarmerItem | null>(null);
    const [showFarmerModal, setShowFarmerModal] = useState(false);

    const [recommendedSearchQuery, setRecommendedSearchQuery] = useState('');
    const [recommendedMinRating, setRecommendedMinRating] = useState(0);
    const [recommendedEcoOnly, setRecommendedEcoOnly] = useState(false);

    const [generalSearchQuery, setGeneralSearchQuery] = useState('');
    const [generalMinRating, setGeneralMinRating] = useState(0);
    const [generalEcoOnly, setGeneralEcoOnly] = useState(false);
    const [maxDistanceFilter, setMaxDistanceFilter] = useState<number | 'all'>(1000);
    const [sortBy, setSortBy] = useState<SortField>('distance');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const [focusedFarmerId, setFocusedFarmerId] = useState<number | null>(null);
    const [focusedPlaceId, setFocusedPlaceId] = useState<number | null>(null);

    const itemsPerPage = 12;

    const [avatarCache, setAvatarCache] = useState<Record<number, string>>({});
    const [loadingAvatars, setLoadingAvatars] = useState<Record<number, boolean>>({});
    const [failedAvatars, setFailedAvatars] = useState<Record<number, boolean>>({});
    const softChip = (bg: string, color: string) => ({
        background: bg,
        color,
        border: '1px solid transparent',
        padding: '0.48rem 0.78rem',
        borderRadius: 999,
        fontSize: '0.88rem',
        fontWeight: 600
    });
    const geometryFarmers = useMemo(() => {
        return Array.isArray(mapFarmersSource) ? mapFarmersSource : [];
    }, [mapFarmersSource]);

    const mergePlaceWithGeometry = useCallback(
        (farmerId: number, place: PlaceItem): PlaceItem => {
            const sourceFarmer = geometryFarmers.find((f: any) => Number(f.id) === Number(farmerId));
            const sourcePlaces = Array.isArray(sourceFarmer?.places) ? sourceFarmer.places : [];

            const matched =
                sourcePlaces.find((p: any) => Number(p.id) === Number(place?.id ?? place?.placeId)) ||
                sourcePlaces.find((p: any) => (p.address || '').trim() === (place.address || '').trim());

            if (!matched) return place;

            return {
                ...matched,
                ...place,
                id: place?.id ?? matched?.id ?? place?.placeId,
                address: place?.address ?? matched?.address,
                boundaries: place?.boundaries ?? matched?.boundaries ?? null,
                products:
                    Array.isArray(place?.products) && place.products.length > 0
                        ? place.products
                        : Array.isArray(matched?.products)
                            ? matched.products
                            : [],
                productCategories:
                    Array.isArray(place?.productCategories) && place.productCategories.length > 0
                        ? place.productCategories
                        : Array.isArray(matched?.products)
                            ? Array.from(
                                new Set(
                                    matched.products
                                        .map((p: any) => p?.categoryName)
                                        .filter(Boolean)
                                )
                            )
                            : [],
                kadastrNumber: (matched as any)?.kadastrNumber ?? (place as any)?.kadastrNumber
            };
        },
        [geometryFarmers]
    );
    const theme = {
        bg: '#f6f3ed',
        card: '#ffffff',
        border: '#ebe4d8',
        text: '#223127',
        muted: '#6f7a71',
        green: '#2f6b3a',
        greenDark: '#244f2b',
        greenSoft: '#dfeadf',
        shadow: '0 14px 35px rgba(34, 49, 39, 0.08)',
        shadowHover: '0 20px 45px rgba(34, 49, 39, 0.14)',
        badgeDark: '#49566a',
        purple: '#7a5af5',
        blue: '#4f7cff',
        orange: '#d97706',
        red: '#c2410c',
        categoryColors: ['#4f7cff', '#7a5af5', '#d97706', '#c2410c']
    };
    const mutedButtonStyle: React.CSSProperties = {
        borderRadius: 12,
        border: `1px solid ${theme.border}`,
        background: '#fff',
        color: theme.text
    };

   const safeFarmers: FarmerItem[] = useMemo(() => {
    return Array.isArray(allFarmers)
        ? allFarmers.map((farmer: any) => ({
              ...farmer,
              userId: farmer.userId ?? farmer.userid ?? null,
          }))
        : [];
}, [allFarmers]);

    const loadAvatar = useCallback(
        async (farmerId: number, userId: number) => {
            if (!userId) return null;
            if (avatarCache[farmerId]) return avatarCache[farmerId];
            if (loadingAvatars[farmerId]) return null;
            if (failedAvatars[farmerId]) return null;

            setLoadingAvatars((prev) => ({ ...prev, [farmerId]: true }));

            try {
                const token = localStorage.getItem('userToken');
                const response = await fetch(`${API_BASE_URL}/api/supplier/avatar/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });

                    setAvatarCache((prev) => ({ ...prev, [farmerId]: dataUrl }));
                    setLoadingAvatars((prev) => ({ ...prev, [farmerId]: false }));
                    return dataUrl;
                }

                setFailedAvatars((prev) => ({ ...prev, [farmerId]: true }));
                setLoadingAvatars((prev) => ({ ...prev, [farmerId]: false }));
                return null;
            } catch {
                setFailedAvatars((prev) => ({ ...prev, [farmerId]: true }));
                setLoadingAvatars((prev) => ({ ...prev, [farmerId]: false }));
                return null;
            }
        },
        [avatarCache, loadingAvatars, failedAvatars]
    );

    useEffect(() => {
        safeFarmers.forEach((farmer) => {
            const userId = farmer.userId
            if (
                userId &&
                !avatarCache[farmer.id] &&
                !loadingAvatars[farmer.id] &&
                !failedAvatars[farmer.id]
            ) {
                loadAvatar(farmer.id, userId);
            }
        });
    }, [safeFarmers, loadAvatar, avatarCache, loadingAvatars, failedAvatars]);

    const getPlaceCategories = useCallback((place: PlaceItem): string[] => {
        const fromPlaceCategories = Array.isArray(place?.productCategories)
            ? place.productCategories.filter(
                (cat): cat is string => typeof cat === 'string' && cat.trim().length > 0
            )
            : [];

        return Array.from(new Set(fromPlaceCategories)).slice(0, 4);
    }, []);

    const getPlaceProducts = useCallback((place: PlaceItem): ProductItem[] => {
        if (Array.isArray(place?.products) && place.products.length > 0) {
            return place.products.filter(
                (p) =>
                    typeof (p?.objectName || p?.name) === 'string' &&
                    String(p?.objectName || p?.name).trim().length > 0
            );
        }
        return [];
    }, []);

    const categoryBadgeStyle = (index: number) => ({
        background: theme.categoryColors[index % theme.categoryColors.length],
        color: '#ffffff',
        border: 'none',
        padding: '0.45rem 0.75rem',
        borderRadius: 999,
        fontSize: '0.88rem',
        fontWeight: 500
    });

    const filteredRecommendedFarmers = useMemo(() => {
        let filtered = [...safeFarmers];

        if (recommendedSearchQuery.trim()) {
            const query = recommendedSearchQuery.toLowerCase();
            filtered = filtered.filter(
                (f) =>
                    f?.name?.toLowerCase?.().includes(query) ||
                    f?.bestPlaceAddress?.toLowerCase?.().includes(query) ||
                    (Array.isArray(f?.places) &&
                        f.places.some((p) => p?.address?.toLowerCase?.().includes(query)))
            );
        }

        filtered = filtered.filter((f) => (f?.rating || 0) >= recommendedMinRating);

        if (recommendedEcoOnly) {
            filtered = filtered.filter(
                (f) =>
                    Array.isArray(f?.places) &&
                    f.places.some((p: any) => p?.has_eco_certificate === true)
            );
        }

        return filtered;
    }, [safeFarmers, recommendedSearchQuery, recommendedMinRating, recommendedEcoOnly]);

    const recommendedFarmers = useMemo(() => {
        return [...filteredRecommendedFarmers]
            .sort((a, b) => (b?.individualScore || 0) - (a?.individualScore || 0))
            .slice(0, 48);
    }, [filteredRecommendedFarmers]);

    const generalPlaceCards = useMemo(() => {
        let cards = safeFarmers.flatMap((farmer) => {
            const places = Array.isArray(farmer?.places) ? farmer.places : [];
            return places.map((place) => ({
                farmer,
                place
            }));
        });

        const seen: Record<string, boolean> = {};
        cards = cards.filter(({ farmer, place }) => {
            const key = `${farmer.id}-${place?.id ?? place?.placeId ?? 'no-place'}`;
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });

        if (generalSearchQuery.trim()) {
            const query = generalSearchQuery.toLowerCase();

            cards = cards.filter(({ farmer, place }) => {
                const categories = getPlaceCategories(place);
                const products = getPlaceProducts(place);

                return (
                    farmer?.name?.toLowerCase?.().includes(query) ||
                    place?.address?.toLowerCase?.().includes(query) ||
                    categories.some((cat) => cat.toLowerCase().includes(query)) ||
                    products.some((product) =>
                        String(product?.objectName || product?.name || '')
                            .toLowerCase()
                            .includes(query)
                    )
                );
            });
        }

        cards = cards.filter(({ farmer }) => (farmer?.rating || 0) >= generalMinRating);

        if (generalEcoOnly) {
            cards = cards.filter(({ place }) => (place as any)?.has_eco_certificate === true);
        }

        if (maxDistanceFilter !== 'all') {
            cards = cards.filter(({ place }) => {
                const distance = Number(place?.distance);
                return !Number.isNaN(distance) && distance <= maxDistanceFilter;
            });
        }

        cards.sort((a, b) => {
            let result = 0;

            if (sortBy === 'distance') {
                const da = Number(a.place?.distance ?? Number.MAX_SAFE_INTEGER);
                const db = Number(b.place?.distance ?? Number.MAX_SAFE_INTEGER);
                result = da - db;
            } else if (sortBy === 'rating') {
                result = Number(a.farmer?.rating || 0) - Number(b.farmer?.rating || 0);
            } else {
                result = String(a.farmer?.name || '').localeCompare(String(b.farmer?.name || ''));
            }

            return sortDirection === 'asc' ? result : -result;
        });

        return cards;
    }, [
        safeFarmers,
        generalSearchQuery,
        generalMinRating,
        generalEcoOnly,
        maxDistanceFilter,
        sortBy,
        sortDirection,
        getPlaceCategories,
        getPlaceProducts
    ]);

    const mapFarmers = useMemo(() => {
        const grouped: Record<number, FarmerItem> = {};

        generalPlaceCards.forEach(({ farmer, place }) => {
            const mergedPlace = mergePlaceWithGeometry(farmer.id, place);

            if (!grouped[farmer.id]) {
                const geometryFarmer = geometryFarmers.find((f: any) => Number(f.id) === Number(farmer.id));

                grouped[farmer.id] = {
                    ...geometryFarmer,
                    ...farmer,
                    places: [mergedPlace]
                };
            } else {
                grouped[farmer.id].places = [...(grouped[farmer.id].places || []), mergedPlace];
            }
        });

        return Object.values(grouped);
    }, [generalPlaceCards, mergePlaceWithGeometry, geometryFarmers]);

    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(recommendedFarmers.length / itemsPerPage));
        if (carouselIndex > totalPages - 1) setCarouselIndex(0);
    }, [recommendedFarmers, carouselIndex]);

    const totalPages = Math.ceil(recommendedFarmers.length / itemsPerPage);
    const currentFarmers = recommendedFarmers.slice(
        carouselIndex * itemsPerPage,
        (carouselIndex + 1) * itemsPerPage
    );

    const nextSlide = () => {
        if (carouselIndex < totalPages - 1) setCarouselIndex(carouselIndex + 1);
    };

    const prevSlide = () => {
        if (carouselIndex > 0) setCarouselIndex(carouselIndex - 1);
    };

    const getRatingColor = (rating: number) => {
        if (rating >= 4.5) return 'success';
        if (rating >= 3.5) return 'warning';
        return 'danger';
    };

    const getBestDisplayPlace = (farmer: FarmerItem) => {
        const places = Array.isArray(farmer?.places) ? farmer.places : [];
        if (places.length === 0) return null;
        const withImageUrl = places.find((p) => !!p?.image_url);
        return withImageUrl || places[0];
    };

    const openFarmerModal = (farmer: FarmerItem) => {
        setSelectedFarmer(farmer);
        setSelectedPlace(null);
        setModalMode('farmer');
        setShowFarmerModal(true);
        onFarmerSelect(farmer);
    };

    const openPlaceModal = (farmer: FarmerItem, place: PlaceItem) => {
        setSelectedFarmer(farmer);
        setSelectedPlace(place);
        setModalMode('place');
        setShowFarmerModal(true);
        onFarmerSelect(farmer);
    };

    const showPlaceOnMap = (farmer: FarmerItem, place: PlaceItem) => {
        setFocusedFarmerId(farmer.id);
        setFocusedPlaceId(place.id ?? place.placeId ?? null);
    };

    const showSelectedPlaceOnMap = () => {
        if (!selectedFarmer || !selectedPlace) return;
        showPlaceOnMap(selectedFarmer, mergePlaceWithGeometry(selectedFarmer.id, selectedPlace));
        setShowFarmerModal(false);
    };

    const handleRecommendedCardClick = (farmer: FarmerItem) => {
        setFocusedFarmerId(farmer.id);
        setFocusedPlaceId(farmer?.places?.[0]?.id ?? farmer?.places?.[0]?.placeId ?? null);
        openFarmerModal(farmer);
    };

    const FarmerAvatar = ({ farmer, size = 40 }: { farmer: FarmerItem; size?: number }) => {
        const [imageData, setImageData] = useState<string | null>(avatarCache[farmer.id] || null);
        const [isLoading, setIsLoading] = useState(false);
        const [hasError, setHasError] = useState(failedAvatars[farmer.id] || false);

        useEffect(() => {
            const load = async () => {
                if (avatarCache[farmer.id]) {
                    setImageData(avatarCache[farmer.id]);
                    return;
                }
                if (failedAvatars[farmer.id]) {
                    setHasError(true);
                    return;
                }
                if (loadingAvatars[farmer.id]) return;
                if (!farmer?.userId) {
                    setHasError(true);
                    return;
                }

                setIsLoading(true);
                const data = await loadAvatar(farmer.id, farmer.userId);
                if (data) setImageData(data);
                else setHasError(true);
                setIsLoading(false);
            };

            load();
        }, [farmer]);

        if (isLoading) return <Spinner animation="border" size="sm" />;
        if (hasError || !imageData) return <PersonCircle size={size} className="text-secondary" />;

        return (
            <img
                src={imageData}
                alt={farmer?.name || 'Farmer'}
                style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
            />
        );
    };

    const PlaceCover = ({
        place,
        name,
        height = 160
    }: {
        place: PlaceItem;
        name: string;
        height?: number;
    }) => {
        const [fallbackError, setFallbackError] = useState(false);

        const directImageUrl = place?.id ? `${API_BASE_URL}/api/places/image/${place.id}` : null;

        if (!directImageUrl || fallbackError) {
            return (
                <div
                    style={{ height, backgroundColor: '#f8f9fa' }}
                    className="d-flex align-items-center justify-content-center text-muted"
                >
                    <Grid size={32} />
                </div>
            );
        }

        return (
            <img
                src={directImageUrl}
                alt={name}
                style={{ width: '100%', height, objectFit: 'cover' }}
                onError={() => setFallbackError(true)}
            />
        );
    };

    const FarmerDetailsModal = () => {
        if (!selectedFarmer) return null;
        const places = Array.isArray(selectedFarmer?.places) ? selectedFarmer.places : [];

        return (
            <Modal show={showFarmerModal} onHide={() => setShowFarmerModal(false)} centered size="lg" contentClassName="border-0">
                <Modal.Header closeButton style={{ background: theme.bg, borderBottom: `1px solid ${theme.border}` }}>
                    <div className="d-flex align-items-center gap-3">
                        <FarmerAvatar farmer={selectedFarmer} size={52} />
                        <div>
                            <h4 className="mb-1" style={{ color: theme.text, fontWeight: 700 }}>
                                {selectedFarmer?.name || t('noName')}
                            </h4>
                            <div className="d-flex flex-wrap gap-2">
                                {(selectedFarmer?.rating || 0) > 0 && (
                                    <Badge bg={getRatingColor(Number(selectedFarmer.rating))} style={{ fontSize: '0.95rem' }}>
                                        {Number(selectedFarmer.rating).toFixed(1)}
                                    </Badge>
                                )}
                                {modalMode === 'farmer' && (
                                    <Badge style={{ background: theme.badgeDark, color: '#fff', fontSize: '0.95rem' }}>
                                        {t('placesCount', { count: places.length })}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal.Header>

                <Modal.Body style={{ background: '#fff' }}>
                    {modalMode === 'farmer' ? (
                        <div className="d-flex flex-column gap-3">
                            {places.map((place, idx) => {
                                const products = getPlaceProducts(place);
                                const categories = getPlaceCategories(place);

                                return (
                                    <Card
                                        key={`${selectedFarmer.id}-${place?.id ?? place?.placeId ?? idx}`}
                                        className="border-0"
                                        style={{
                                            borderRadius: 18,
                                            overflow: 'hidden',
                                            boxShadow: '0 12px 28px rgba(34, 49, 39, 0.08)'
                                        }}
                                    >
                                        <Row className="g-0">
                                            <Col md={4}>
                                                <PlaceCover place={place} name={place?.address || selectedFarmer?.name || t('place')} height={180} />
                                            </Col>

                                            <Col md={8}>
                                                <Card.Body>
                                                    <div className="fw-semibold mb-1" style={{ fontSize: '1.1rem' }}>
                                                        {t('placeNumber', { number: idx + 1 })}
                                                    </div>

                                                    <div className="text-muted" style={{ fontSize: '0.98rem' }}>
                                                        <GeoAlt size={13} className="me-1" />
                                                        {place?.address || t('addressNotSpecified')}
                                                    </div>

                                                    {place?.distance !== null && place?.distance !== undefined && (
                                                        <div className="text-muted mt-2" style={{ fontSize: '0.95rem' }}>
                                                            {t('distanceToYou', { distance: Number(place.distance).toFixed(1) })}
                                                        </div>
                                                    )}

                                                    <div className="d-flex flex-wrap gap-2 mt-3">
                                                        {(place as any)?.has_eco_certificate === true && (
                                                            <Badge style={{ background: theme.green, color: '#fff' }}>
                                                                <Flower1 size={12} className="me-1" />
                                                                {t('ecoCertificate')}
                                                            </Badge>
                                                        )}

                                                        <Button
                                                            onClick={() => showPlaceOnMap(selectedFarmer, mergePlaceWithGeometry(selectedFarmer.id, place))}
                                                            style={{
                                                                background: theme.greenSoft,
                                                                borderColor: theme.green,
                                                                color: '#fff',
                                                                borderRadius: 12
                                                            }}
                                                        >
                                                            <MapIcon size={14} className="me-2" />
                                                            {t('showOnMap')}
                                                        </Button>
                                                    </div>

                                                    <div className="mt-3">
                                                        <div className="text-muted mb-2" style={{ fontSize: '0.95rem' }}>
                                                            {t('categories')}
                                                        </div>
                                                        {categories.length > 0 ? (
                                                            <div className="d-flex flex-wrap gap-2">
                                                                {categories.map((cat, catIdx) => (
                                                                    <Badge key={`${selectedFarmer.id}-${place?.id}-${catIdx}`} style={categoryBadgeStyle(catIdx)}>
                                                                        {cat}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-muted" style={{ fontSize: '0.95rem' }}>
                                                                {t('categoriesNotSpecified')}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="mt-3">
                                                        <div className="text-muted mb-2" style={{ fontSize: '0.95rem' }}>
                                                            {t('products')}
                                                        </div>
                                                        {products.length > 0 ? (
                                                            <div className="d-flex flex-wrap gap-2">
                                                                {products.map((product, pIdx) => (
                                                                    <Badge
                                                                        key={`${selectedFarmer.id}-${place?.id}-${product?.id ?? 'prod'}-${pIdx}`}
                                                                        style={{
                                                                            background: theme.badgeDark,
                                                                            color: '#ffffff',
                                                                            padding: '0.5rem 0.75rem',
                                                                            borderRadius: 12,
                                                                            fontSize: '0.92rem'
                                                                        }}
                                                                    >
                                                                        <BoxSeam size={12} className="me-1" />
                                                                        {product?.objectName || product?.name || t('product')}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-muted" style={{ fontSize: '0.95rem' }}>
                                                                {t('noProductsList')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card.Body>
                                            </Col>
                                        </Row>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        selectedPlace && (
                            <Card
                                className="border-0"
                                style={{
                                    borderRadius: 18,
                                    overflow: 'hidden',
                                    boxShadow: '0 12px 28px rgba(34, 49, 39, 0.08)'
                                }}
                            >
                                <Row className="g-0">
                                    <Col md={5}>
                                        <PlaceCover place={selectedPlace} name={selectedPlace?.address || selectedFarmer?.name || t('place')} height={260} />
                                    </Col>

                                    <Col md={7}>
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                                                <h4 className="mb-0" style={{ color: theme.text, fontWeight: 700 }}>
                                                    {t('place')}
                                                </h4>

                                                <Button
                                                    onClick={showSelectedPlaceOnMap}
                                                    style={{
                                                        background: theme.greenDark,
                                                        borderColor: theme.border,
                                                        color: '#fff',
                                                        borderRadius: 12
                                                    }}
                                                >
                                                    <MapIcon size={14} className="me-2" />
                                                    {t('showOnMap')}
                                                </Button>
                                            </div>

                                            <div className="text-muted mb-2" style={{ fontSize: '1rem' }}>
                                                <GeoAlt size={13} className="me-1" />
                                                {selectedPlace?.address || t('addressNotSpecified')}
                                            </div>

                                            {selectedPlace?.distance !== null && selectedPlace?.distance !== undefined && (
                                                <div className="text-muted mb-3" style={{ fontSize: '0.95rem' }}>
                                                    {t('distanceToYou', { distance: Number(selectedPlace.distance).toFixed(1) })}
                                                </div>
                                            )}

                                            {(selectedPlace as any)?.has_eco_certificate === true && (
                                                <div className="mb-3">
                                                    <Badge style={{ background: theme.green, color: '#fff' }}>
                                                        <Flower1 size={12} className="me-1" />
                                                        {t('ecoCertificate')}
                                                    </Badge>
                                                </div>
                                            )}

                                            <div className="mb-3">
                                                <div className="text-muted mb-2" style={{ fontSize: '0.95rem' }}>
                                                    {t('categories')}
                                                </div>
                                                {getPlaceCategories(selectedPlace).length > 0 ? (
                                                    <div className="d-flex flex-wrap gap-2">
                                                        {getPlaceCategories(selectedPlace).map((cat, idx) => (
                                                            <Badge key={`${selectedFarmer.id}-${selectedPlace.id}-${idx}`} style={categoryBadgeStyle(idx)}>
                                                                {cat}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-muted" style={{ fontSize: '0.95rem' }}>
                                                        {t('categoriesNotSpecified')}
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <div className="text-muted mb-2" style={{ fontSize: '0.95rem' }}>
                                                    {t('products')}
                                                </div>
                                                {getPlaceProducts(selectedPlace).length > 0 ? (
                                                    <div className="d-flex flex-wrap gap-2">
                                                        {getPlaceProducts(selectedPlace).map((product, idx) => (
                                                            <Badge
                                                                key={`${selectedFarmer.id}-${selectedPlace.id}-${product?.id ?? 'p'}-${idx}`}
                                                                style={{
                                                                    background: theme.badgeDark,
                                                                    color: '#ffffff',
                                                                    padding: '0.5rem 0.75rem',
                                                                    borderRadius: 12,
                                                                    fontSize: '0.92rem'
                                                                }}
                                                            >
                                                                <BoxSeam size={12} className="me-1" />
                                                                {product?.objectName || product?.name || t('product')}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-muted" style={{ fontSize: '0.95rem' }}>
                                                        {t('noProductsList')}
                                                    </div>
                                                )}
                                            </div>
                                        </Card.Body>
                                    </Col>
                                </Row>
                            </Card>
                        )
                    )}
                </Modal.Body>
            </Modal>
        );
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">{t('loadingFarms')}</p>
            </div>
        );
    }

    return (
        <div style={{ background: theme.bg, borderRadius: 24, padding: 4 }}>
            <Row className="mb-4">
                <Col md={12}>
                    <Card className="border-0" style={{ borderRadius: 24, overflow: 'hidden', boxShadow: theme.shadow }}>
                        <Card.Header className="border-0" style={{ background: '#fff', paddingTop: 18, paddingBottom: 18 }}>
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                                <div>
                                    <h5 className="mb-1" style={{ color: theme.text }}>
                                        {t('farmersMap')}
                                    </h5>
                                    <div className="small text-muted">
                                        {t('mapSyncText')}
                                    </div>
                                </div>

                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    <InputGroup style={{ width: 260 }}>
                                        <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                                            <Search size={14} />
                                        </InputGroup.Text>
                                        <Form.Control
                                            type="text"
                                            placeholder={t('searchRecommendations')}
                                            value={recommendedSearchQuery}
                                            onChange={(e) => setRecommendedSearchQuery(e.target.value)}
                                            style={{ borderColor: theme.border }}
                                        />
                                    </InputGroup>

                                    <Form.Select
                                        value={recommendedMinRating}
                                        onChange={(e) => setRecommendedMinRating(Number(e.target.value))}
                                        style={{ borderRadius: 12, minWidth: 160 }}
                                    >
                                        <option value="0">{t('anyRating')}</option>
                                        <option value="3">{t('ratingFrom3')}</option>
                                        <option value="4">{t('ratingFrom4')}</option>
                                        <option value="4.5">{t('ratingFrom45')}</option>
                                    </Form.Select>

                                    <Form.Check
                                        type="checkbox"
                                        label={<><Leaf className="me-1" /> {t('ecoOnly')}</>}
                                        checked={recommendedEcoOnly}
                                        onChange={(e) => setRecommendedEcoOnly(e.target.checked)}
                                    />

                                    <Form.Check
                                        type="checkbox"
                                        label={t('showRecommendedOnMap')}
                                        checked={showRecommendedOnMap}
                                        onChange={(e) => setShowRecommendedOnMap(e.target.checked)}
                                    />
                                </div>
                            </div>
                        </Card.Header>

                        <Card.Body className="p-0" style={{ height: '620px' }}>
                            <FarmersMapForBuyer
                                farmers={mapFarmers}
                                userLocation={userLocation}
                                onFarmerClick={(farmer) => {
                                    setFocusedFarmerId(farmer.id);
                                    openFarmerModal(farmer);
                                }}
                                onFarmerSelect={(farmerId) => setFocusedFarmerId(farmerId)}
                                onPlaceSelect={(placeId) => setFocusedPlaceId(placeId)}
                                showRecommendedPlots={showRecommendedOnMap}
                                recommendedFarmers={showRecommendedOnMap ? recommendedFarmers : []}
                                focusedFarmerId={focusedFarmerId}
                                focusedPlaceId={focusedPlaceId}
                            />
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {recommendedFarmers.length > 0 && (
                <Row className="mb-4">
                    <Col md={12}>
                        <Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}>
                            <Card.Header className="bg-white border-0 pt-4 pb-2 px-4">
                                <h6 className="mb-0 text-center" style={{ color: theme.text }}>
                                    {t('recommendedFarmers')}
                                </h6>
                            </Card.Header>

                            <Card.Body className="px-4 pb-4 d-flex justify-content-center">
                                <div className="position-relative w-100" style={{ maxWidth: '1600px' }}>
                                    {totalPages > 1 && (
                                        <>
                                            <Button
                                                size="sm"
                                                className="position-absolute start-0 top-50 translate-middle-y rounded-circle"
                                                style={{
                                                    zIndex: 10,
                                                    marginLeft: '-12px',
                                                    boxShadow: theme.shadow,
                                                    background: '#fff',
                                                    color: theme.text,
                                                    border: `1px solid ${theme.border}`
                                                }}
                                                onClick={prevSlide}
                                                disabled={carouselIndex === 0}
                                            >
                                                <ChevronLeft />
                                            </Button>

                                            <Button
                                                size="sm"
                                                className="position-absolute end-0 top-50 translate-middle-y rounded-circle"
                                                style={{
                                                    zIndex: 10,
                                                    marginRight: '-12px',
                                                    boxShadow: theme.shadow,
                                                    background: '#fff',
                                                    color: theme.text,
                                                    border: `1px solid ${theme.border}`
                                                }}
                                                onClick={nextSlide}
                                                disabled={carouselIndex === totalPages - 1}
                                            >
                                                <ChevronRight />
                                            </Button>
                                        </>
                                    )}

                                    <Row className="g-3 flex-nowrap justify-content-center" style={{ overflowX: 'hidden' }}>
                                        {currentFarmers.map((farmer) => {
                                            const displayPlace = getBestDisplayPlace(farmer);

                                            return (
                                                <Col key={`recommended-${farmer.id}`} xl={2} lg={3} md={4} sm={6}>
                                                    <Card
                                                        className="h-100 border-0"
                                                        style={{
                                                            cursor: 'pointer',
                                                            transition: 'all 0.25s ease',
                                                            borderRadius: 20,
                                                            overflow: 'hidden',
                                                            boxShadow: theme.shadow
                                                        }}
                                                        onClick={() => handleRecommendedCardClick(farmer)}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.transform = 'translateY(-4px)';
                                                            e.currentTarget.style.boxShadow = theme.shadowHover;
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.transform = 'translateY(0)';
                                                            e.currentTarget.style.boxShadow = theme.shadow;
                                                        }}
                                                    >
                                                        {displayPlace ? (
                                                            <PlaceCover place={displayPlace} name={farmer?.name || t('farmer')} height={120} />
                                                        ) : (
                                                            <div style={{ height: 120, background: '#f8f9fa' }} className="d-flex align-items-center justify-content-center text-muted">
                                                                <Grid size={28} />
                                                            </div>
                                                        )}

                                                        <Card.Body>
                                                            <div className="d-flex justify-content-between align-items-start">
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <FarmerAvatar farmer={farmer} size={34} />
                                                                    <h6 className="mb-0">{farmer?.name || t('noName')}</h6>
                                                                </div>

                                                                <Button
                                                                    variant="link"
                                                                    className="p-0 text-warning"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onToggleFavorite(farmer.id);
                                                                    }}
                                                                >
                                                                    {favorites.has(farmer.id) ? <StarFill size={16} /> : <StarFill size={16} color="#ddd" />}
                                                                </Button>
                                                            </div>

                                                            {(farmer?.rating || 0) > 0 && (
                                                                <Badge bg={getRatingColor(Number(farmer.rating))} className="mt-2">
                                                                    {Number(farmer.rating).toFixed(1)}
                                                                </Badge>
                                                            )}

                                                            <div className="small text-muted mt-2">
                                                                <GeoAlt size={12} className="me-1" />
                                                                {farmer?.bestPlaceAddress?.substring?.(0, 50) || displayPlace?.address || t('addressNotSpecified')}
                                                            </div>

                                                            <div className="mt-3 d-flex flex-wrap gap-2">
                                                                {/* <Badge style={{ background: theme.purple, color: '#fff' }}>
                                                                    {t('recommended')}
                                                                </Badge> */}
                                                            </div>
                                                        </Card.Body>
                                                    </Card>
                                                </Col>
                                            );
                                        })}
                                    </Row>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            <Card className="border-0 mb-4" style={{ borderRadius: 22, boxShadow: theme.shadow }}>
                <Card.Body className="p-4">
                    <h6 className="mb-3" style={{ color: theme.text }}>
                        {t('generalPlacesList')}
                    </h6>

                    <Row className="g-3 align-items-center">
                        <Col md={3}>
                            <InputGroup>
                                <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                                    <Search size={14} />
                                </InputGroup.Text>
                                <Form.Control
                                    type="text"
                                    placeholder={t('searchGeneral')}
                                    value={generalSearchQuery}
                                    onChange={(e) => setGeneralSearchQuery(e.target.value)}
                                    style={{ borderColor: theme.border }}
                                />
                            </InputGroup>
                        </Col>

                        <Col md={2}>
                            <InputGroup>
                                <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                                    <Funnel size={14} />
                                </InputGroup.Text>
                                <Form.Select
                                    value={maxDistanceFilter}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setMaxDistanceFilter(value === 'all' ? 'all' : Number(value));
                                    }}
                                    style={{ borderColor: theme.border }}
                                >
                                    <option value="all">{t('allDistances')}</option>
                                    <option value="100">{t('upTo100km')}</option>
                                    <option value="200">{t('upTo200km')}</option>
                                    <option value="300">{t('upTo300km')}</option>
                                    <option value="500">{t('upTo500km')}</option>
                                    <option value="1000">{t('upTo1000km')}</option>
                                </Form.Select>
                            </InputGroup>
                        </Col>

                        <Col md={2}>
                            <InputGroup>
                                <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                                    {sortBy === 'name' ? <SortAlphaDown size={14} /> : <SortNumericDown size={14} />}
                                </InputGroup.Text>
                                <Form.Select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortField)}
                                    style={{ borderColor: theme.border }}
                                >
                                    <option value="distance">{t('sortByDistance')}</option>
                                    <option value="rating">{t('sortByRating')}</option>
                                    <option value="name">{t('sortByName')}</option>
                                </Form.Select>
                            </InputGroup>
                        </Col>

                        <Col md={2}>
                            <InputGroup>
                                <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                                    {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                                </InputGroup.Text>
                                <Form.Select
                                    value={sortDirection}
                                    onChange={(e) => setSortDirection(e.target.value as SortDirection)}
                                    style={{ borderColor: theme.border }}
                                >
                                    <option value="asc">{t('ascending')}</option>
                                    <option value="desc">{t('descending')}</option>
                                </Form.Select>
                            </InputGroup>
                        </Col>

                        <Col md={2}>
                            <Form.Select
                                value={generalMinRating}
                                onChange={(e) => setGeneralMinRating(Number(e.target.value))}
                                style={{ borderColor: theme.border }}
                            >
                                <option value="0">{t('anyRating')}</option>
                                <option value="3">{t('ratingFrom3')}</option>
                                <option value="4">{t('ratingFrom4')}</option>
                                <option value="4.5">{t('ratingFrom45')}</option>
                            </Form.Select>
                        </Col>

                        <Col md={1}>
                            <Form.Check
                                type="checkbox"
                                label={<><Leaf className="me-1" /> {t('ecoOnly')}</>}
                                checked={generalEcoOnly}
                                onChange={(e) => setGeneralEcoOnly(e.target.checked)}
                            />
                        </Col>

                        <Col md={12}>
                            <div className="text-muted small mt-2" style={{ fontSize: '0.95rem' }}>
                                {t('foundPlaces', { count: generalPlaceCards.length })}
                            </div>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <Row className="g-4">
                {generalPlaceCards.map(({ farmer, place }, index) => {
                    const categories = getPlaceCategories(place);

                    return (
                        <Col key={`general-${farmer.id}-${place.id ?? place.placeId ?? index}`} xl={4} lg={4} md={6}>
                            <Card
                                className="h-100 border-0"
                                style={{
                                    cursor: 'pointer',
                                    transition: 'all 0.25s ease',
                                    borderRadius: 22,
                                    overflow: 'hidden',
                                    boxShadow: theme.shadow,
                                    background: theme.card
                                }}
                                onClick={() => openPlaceModal(farmer, place)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = theme.shadowHover;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = theme.shadow;
                                }}
                            >
                                <PlaceCover place={place} name={farmer?.name || t('farmer')} height={200} />

                                <Card.Body className="p-4 d-flex flex-column">
                                    <div className="d-flex align-items-start gap-3 mb-3">
                                        <FarmerAvatar farmer={farmer} size={46} />

                                        <div className="flex-grow-1">
                                            <div className="d-flex justify-content-between align-items-start gap-2">
                                                <div>
                                                    <h4 className="mb-1" style={{ color: theme.text, fontWeight: 700 }}>
                                                        {farmer?.name || t('noName')}
                                                    </h4>

                                                    <div className="text-muted" style={{ fontSize: '0.96rem' }}>
                                                        <GeoAlt size={12} className="me-1" />
                                                        {place?.address || t('addressNotSpecified')}
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="light"
                                                    className="p-1 rounded-circle border-0"
                                                    style={{
                                                        width: 36,
                                                        height: 36,
                                                        boxShadow: '0 8px 18px rgba(0,0,0,0.08)'
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleFavorite(farmer.id);
                                                    }}
                                                >
                                                    {favorites.has(farmer.id)
                                                        ? <StarFill size={16} color="#ffc107" />
                                                        : <StarFill size={16} color="#adb5bd" />}
                                                </Button>
                                            </div>

                                            {(farmer?.rating || 0) > 0 && (
                                                <Badge bg={getRatingColor(Number(farmer.rating))} pill className="mt-2" style={{ fontSize: '0.92rem' }}>
                                                    {Number(farmer.rating).toFixed(1)}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                        {(place as any)?.has_eco_certificate === true && (
                                            <span style={softChip('#e7f5ea', theme.green)}>
                                                <Flower1 size={13} className="me-1" />
                                                {t('ecoCertificate')}
                                            </span>
                                        )}

                                        {place?.distance !== null && place?.distance !== undefined && (
                                            <span style={softChip('#eef2f7', '#44546a')}>
                                                <GeoAlt size={12} className="me-1" />
                                                {t('distanceToYou', { distance: Number(place.distance).toFixed(1) })}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        {categories.length > 0 ? (
                                            <>
                                                <small className="text-muted d-block mb-2" style={{ fontSize: '0.92rem' }}>
                                                    {t('categories')}:
                                                </small>
                                                <div className="d-flex flex-wrap gap-2">
                                                    {categories.map((cat, idx) => (
                                                        <span
                                                            key={`category-${farmer.id}-${place.id}-${idx}`}
                                                            style={{
                                                                ...categoryBadgeStyle(idx),
                                                                opacity: 0.88
                                                            }}
                                                        >
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-muted" style={{ fontSize: '0.92rem' }}>
                                                {t('categoriesNotSpecified')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-auto d-flex gap-2 justify-content-end">
                                        <Button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openPlaceModal(farmer, place);
                                            }}
                                            style={{
                                                ...mutedButtonStyle,
                                                background: '#f7f5f0'
                                            }}
                                        >
                                            {t('details')}
                                        </Button>

                                        <Button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const mergedPlace = mergePlaceWithGeometry(farmer.id, place);
                                                showPlaceOnMap(farmer, mergedPlace);
                                            }}
                                            style={{
                                                ...mutedButtonStyle,
                                                background: '#e7f5ea',
                                                color: theme.green,
                                                border: '1px solid #d3e8d7'
                                            }}
                                        >
                                            <MapIcon size={14} className="me-2" />
                                            {t('showOnMap')}
                                        </Button>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    );
                })}

                {generalPlaceCards.length === 0 && (
                    <Col md={12}>
                        <div className="text-center py-5 text-muted">
                            <Filter size={48} className="mb-3" />
                            <p>{t('placesNotFound')}</p>
                        </div>
                    </Col>
                )}
            </Row>

            <FarmerDetailsModal />
        </div>
    );
};

export default FarmersPlacesBuyerPage;