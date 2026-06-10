import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    Row,
    Col,
    Card,
    Button,
    Badge,
    Form,
    Spinner,
    InputGroup,
    Alert
} from 'react-bootstrap';
import {
    Search,
    GeoAlt,
    Leaf,
    StarFill,
    BoxSeam,
    Funnel,
    ArrowUp,
    ArrowDown,
    SortNumericDown,
    Map as MapIcon,
    ChevronLeft,
    ChevronRight
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import ProductsMapForBuyer from './ProductsMapForBuyer';
import type { ProductItem } from '../types/product';

const API_BASE_URL = 'http://localhost:5000';

interface ProductPageProps {
    userLocation: { lat: number; lng: number; address: string } | null;
    filters: {
        minRating: number;
        maxDistance: number;
        calculateDistance: boolean;
        ecoOnly: boolean;
    };
    onFarmerSelect?: (farmer: any) => void;
    onFilterChange?: (filters: any) => void;
}

interface DietTable {
    id: number;
    name: string;
    description?: string;
}

interface TableObject {
    objectId: number;
    objectName: string;
    varietyId?: number;
    varietyName?: string;
    fullName: string;
}

type SortField = 'distance' | 'price' | 'rating';

const theme = {
    bg: '#f6f3ed',
    card: '#ffffff',
    border: '#ebe4d8',
    text: '#223127',
    muted: '#6f7a71',
    green: '#2f6b3a',
    greenSoft: '#dfeadf',
    purple: '#7a5af5',
    badgeDark: '#49566a',
    shadow: '0 14px 35px rgba(34, 49, 39, 0.08)',
    shadowHover: '0 20px 45px rgba(34, 49, 39, 0.14)'
};

const softChip = (bg: string, color: string) => ({
    background: bg,
    color,
    border: '1px solid transparent',
    padding: '0.48rem 0.78rem',
    borderRadius: 999,
    fontSize: '0.88rem',
    fontWeight: 600
});

const ProductsDeveloperPage: React.FC<ProductPageProps> = ({
    userLocation,
    filters: parentFilters,
    onFarmerSelect,
    onFilterChange
}) => {
    const [loading, setLoading] = useState(false);
    const [allProducts, setAllProducts] = useState<ProductItem[]>([]);
    const [stats, setStats] = useState<any>(null);

    const [dietTables, setDietTables] = useState<DietTable[]>([]);
    const [tableObjects, setTableObjects] = useState<TableObject[]>([]);
    const [loadingTables, setLoadingTables] = useState(false);

    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
    const [selectedObjectIds, setSelectedObjectIds] = useState<number[]>([]);
    const [objectSearch, setObjectSearch] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [recommendedQuery, setRecommendedQuery] = useState('');
    const [generalMinRating, setGeneralMinRating] = useState<number>(parentFilters?.minRating || 0);
    const [generalEcoOnly, setGeneralEcoOnly] = useState<boolean>(parentFilters?.ecoOnly || false);
    const [maxDistanceFilter, setMaxDistanceFilter] = useState<number | 'all'>(parentFilters?.maxDistance || 1000);
    const [sortBy, setSortBy] = useState<SortField>('distance');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const [focusedProduct, setFocusedProduct] = useState<ProductItem | null>(null);
    const [carouselIndex, setCarouselIndex] = useState(0);

    const itemsPerPage = 6;

    const fetchDietTables = useCallback(async () => {
        try {
            setLoadingTables(true);
            const token = localStorage.getItem('userToken');

            const response = await fetch(`${API_BASE_URL}/api/diet-tables`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                setDietTables(data.tables || []);
            } else {
                toast.error(data.message || 'Ошибка загрузки столов питания');
            }
        } catch (error) {
            console.error(error);
            toast.error('Ошибка загрузки столов питания');
        } finally {
            setLoadingTables(false);
        }
    }, []);

    const fetchTableProducts = useCallback(async (tableId: number) => {
        try {
            setLoadingTables(true);
            const token = localStorage.getItem('userToken');

            const response = await fetch(`${API_BASE_URL}/api/diet-tables/${tableId}/objects`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                setTableObjects(data.objects || []);
            } else {
                setTableObjects([]);
                toast.error(data.message || 'Ошибка загрузки продуктов стола');
            }
        } catch (error) {
            console.error(error);
            setTableObjects([]);
            toast.error('Ошибка загрузки продуктов стола');
        } finally {
            setLoadingTables(false);
        }
    }, []);

    useEffect(() => {
        fetchDietTables();
    }, [fetchDietTables]);

    const fetchProducts = useCallback(async () => {
        if (!userLocation) {
            toast.warning('Укажите адрес доставки');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('userToken');

            const hasProductFilters = selectedObjectIds.length > 0;

            const response = await fetch(`${API_BASE_URL}/api/buyer/clustered-products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    filters: {
                        objectIds: selectedObjectIds,
                        testMode: !hasProductFilters,
                        calculateDistance: parentFilters?.calculateDistance !== false,
                        maxDistance: parentFilters?.maxDistance || 10000,
                        minRating: parentFilters?.minRating || 0,
                        ecoOnly: parentFilters?.ecoOnly || false,
                        ripenessCategories: [3]
                    }
                })
            });

            const data = await response.json();

            if (data.success) {
                setAllProducts(data.allProducts || []);
                setStats(data.stats || null);

                if (hasProductFilters && (!data.allProducts || data.allProducts.length === 0)) {
                    toast.info('По выбранным продуктам ничего не найдено');
                }
            } else {
                toast.error(data.message || 'Ошибка загрузки продуктов');
            }
        } catch (error) {
            console.error(error);
            toast.error('Ошибка загрузки продуктов');
        } finally {
            setLoading(false);
        }
    }, [userLocation, parentFilters, selectedObjectIds]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    useEffect(() => {
        setGeneralEcoOnly(parentFilters?.ecoOnly || false);
        setGeneralMinRating(parentFilters?.minRating || 0);
        setMaxDistanceFilter(parentFilters?.maxDistance || 1000);
    }, [parentFilters]);

    const filteredTableObjects = useMemo(() => {
        if (!objectSearch.trim()) return tableObjects;

        const q = objectSearch.toLowerCase();

        return tableObjects.filter((obj) =>
            obj.fullName?.toLowerCase().includes(q) ||
            obj.objectName?.toLowerCase().includes(q) ||
            obj.varietyName?.toLowerCase().includes(q)
        );
    }, [tableObjects, objectSearch]);

    const filteredRecommended = useMemo(() => {
        let items = [...allProducts];

        if (recommendedQuery.trim()) {
            const q = recommendedQuery.toLowerCase();
            items = items.filter((p) =>
                p.fullProductName?.toLowerCase().includes(q) ||
                p.farmerName?.toLowerCase().includes(q) ||
                p.placeAddress?.toLowerCase().includes(q)
            );
        }

        items = items
            .sort((a, b) => {
                const ar = a.clusterRank ?? 999;
                const br = b.clusterRank ?? 999;
                if (ar !== br) return ar - br;
                return (b.computedRating || 0) - (a.computedRating || 0);
            })
            .slice(0, 24);

        return items;
    }, [allProducts, recommendedQuery]);

    const filteredGeneral = useMemo(() => {
        let items = [...allProducts];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter((p) =>
                p.fullProductName?.toLowerCase().includes(q) ||
                p.farmerName?.toLowerCase().includes(q) ||
                p.placeAddress?.toLowerCase().includes(q)
            );
        }

        items = items.filter((p) => (p.farmerRating || 0) >= generalMinRating);

        if (generalEcoOnly) {
            items = items.filter((p) => p.has_eco_certificate === true);
        }

        if (maxDistanceFilter !== 'all') {
            items = items.filter((p) => Number(p.distance) <= maxDistanceFilter);
        }

        items.sort((a, b) => {
            let result = 0;

            if (sortBy === 'distance') {
                result = Number(a.distance || 999999) - Number(b.distance || 999999);
            } else if (sortBy === 'price') {
                result = Number(a.price || 0) - Number(b.price || 0);
            } else {
                result = Number(a.farmerRating || 0) - Number(b.farmerRating || 0);
            }

            return sortDirection === 'asc' ? result : -result;
        });

        return items;
    }, [allProducts, searchQuery, generalMinRating, generalEcoOnly, maxDistanceFilter, sortBy, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(filteredRecommended.length / itemsPerPage));
    const currentRecommended = filteredRecommended.slice(
        carouselIndex * itemsPerPage,
        (carouselIndex + 1) * itemsPerPage
    );

    useEffect(() => {
        if (carouselIndex > totalPages - 1) {
            setCarouselIndex(0);
        }
    }, [carouselIndex, totalPages]);

    const openOnMap = useCallback((product: ProductItem) => {
        setFocusedProduct(product);
        if (onFarmerSelect) {
            onFarmerSelect({ id: product.farmerId, name: product.farmerName });
        }
    }, [onFarmerSelect]);

    const handleTableChange = async (value: string) => {
        const tableId = value ? Number(value) : null;
        setSelectedTableId(tableId);
        setSelectedObjectIds([]);
        setObjectSearch('');
        setTableObjects([]);

        if (tableId) {
            await fetchTableProducts(tableId);
        }
    };

    const toggleObjectSelection = (objectId: number) => {
        setSelectedObjectIds((prev) =>
            prev.includes(objectId)
                ? prev.filter((id) => id !== objectId)
                : [...prev, objectId]
        );
    };

    const clearProductFilters = () => {
        setSelectedTableId(null);
        setSelectedObjectIds([]);
        setObjectSearch('');
        setTableObjects([]);
    };

    if (!userLocation) {
        return (
            <Card className="text-center p-5">
                <h5>Укажите адрес доставки для просмотра продуктов</h5>
                <p className="text-muted">Адрес нужен для расчета расстояния до фермеров и точек продажи</p>
            </Card>
        );
    }

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2">Загрузка продуктов...</p>
            </div>
        );
    }

    return (
        <div style={{ background: theme.bg, borderRadius: 24, padding: 4 }}>
            <Row className="mb-4">
                <Col md={12}>
                    <Card className="border-0" style={{ borderRadius: 24, overflow: 'hidden', boxShadow: theme.shadow }}>
                        <Card.Header className="border-0 bg-white py-3 px-4">
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                                <div>
                                    <h5 className="mb-1" style={{ color: theme.text }}>Карта продуктов</h5>
                                    {/* <div className="small text-muted">Точки строятся по placeId / coordinates из clustered-products</div> */}
                                </div>

                                <div className="d-flex flex-wrap gap-2 align-items-center">
                                    <InputGroup style={{ width: 260 }}>
                                        <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                                            <Search size={14} />
                                        </InputGroup.Text>
                                        <Form.Control
                                            placeholder="Поиск в рекомендациях..."
                                            value={recommendedQuery}
                                            onChange={(e) => setRecommendedQuery(e.target.value)}
                                        />
                                    </InputGroup>

                                    <Button
                                        variant="outline-secondary"
                                        onClick={fetchProducts}
                                        style={{ borderRadius: 12 }}
                                    >
                                        Обновить
                                    </Button>
                                </div>
                            </div>
                        </Card.Header>

                        <Card.Body className="p-0" style={{ height: 620 }}>
                            <ProductsMapForBuyer
                                products={filteredGeneral}
                                userLocation={userLocation}
                                focusedProduct={focusedProduct}
                                onProductClick={openOnMap}
                            />
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {filteredRecommended.length > 0 && (
                <Row className="mb-4">
                    <Col md={12}>
                        <Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}>
                            <Card.Header className="bg-white border-0 pt-4 pb-2 px-4">
                                <h6 className="mb-0 text-center" style={{ color: theme.text }}>
                                    Рекомендуемые продукты
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
                                                onClick={() => setCarouselIndex((prev) => Math.max(prev - 1, 0))}
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
                                                onClick={() => setCarouselIndex((prev) => Math.min(prev + 1, totalPages - 1))}
                                                disabled={carouselIndex === totalPages - 1}
                                            >
                                                <ChevronRight />
                                            </Button>
                                        </>
                                    )}

                                    <Row className="g-3 flex-nowrap justify-content-center" style={{ overflowX: 'hidden' }}>
                                        {currentRecommended.map((product) => (
                                            <Col key={`${product.productId}-${product.placeId}-${product.farmerId}`} xl={2} lg={3} md={4} sm={6}>
                                                <Card
                                                    className="h-100 border-0"
                                                    style={{
                                                        cursor: 'pointer',
                                                        transition: 'all 0.25s ease',
                                                        borderRadius: 20,
                                                        overflow: 'hidden',
                                                        boxShadow: theme.shadow
                                                    }}
                                                    onClick={() => openOnMap(product)}
                                                >
                                                    {product.imagePath ? (
                                                        <img
                                                            src={`${API_BASE_URL}/uploads${product.imagePath}`}
                                                            alt={product.fullProductName}
                                                            style={{ width: '100%', height: 200, objectFit: 'cover' }}
                                                            onError={(e) => {
                                                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div
                                                            style={{ height: 200, background: '#f8f6f1' }}
                                                            className="d-flex align-items-center justify-content-center"
                                                        >
                                                            <BoxSeam size={34} color={theme.green} />
                                                        </div>
                                                    )}

                                                    <Card.Body>
                                                        <h6 className="mb-2">{product.fullProductName}</h6>

                                                        <div className="small text-muted">
                                                            <GeoAlt size={12} className="me-1" />
                                                            {product.placeAddress}
                                                        </div>

                                                        <div className="small text-muted mt-1">
                                                            Фермер: {product.farmerName}
                                                        </div>

                                                        <div className="mt-2 d-flex flex-wrap gap-2">
                                                            <span style={{ background: product.clusterRankColor || theme.purple }}>
                                                                #{product.clusterRank || '-'}
                                                            </span>

                                                            <span >
                                                                {Number(product.farmerRating || 0).toFixed(1)}
                                                            </span>

                                                            {product.has_eco_certificate && (
                                                                <span style={{ background: theme.greenSoft }}>
                                                                    <Leaf className="me-1" size={12} />
                                                                    Eco
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="mt-3 d-flex justify-content-between align-items-center">
                                                            <strong>{Number(product.price || 0).toFixed(0)} ₽</strong>
                                                            <span className="small text-muted">
                                                                {Number(product.distance || 0).toFixed(1)} км
                                                            </span>
                                                        </div>
                                                    </Card.Body>
                                                </Card>
                                            </Col>
                                        ))}
                                    </Row>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            <Card className="border-0 mb-4" style={{ borderRadius: 22, boxShadow: theme.shadow }}>
                <Card.Body className="p-4">
                    <h6 className="mb-3" style={{ color: theme.text }}>Фильтры продуктов</h6>

                    <Row className="g-3 align-items-start mb-4">
                        <Col md={3}>
                            <Form.Label className="small text-muted">Диетический стол</Form.Label>
                            <Form.Select
                                value={selectedTableId || ''}
                                onChange={(e) => handleTableChange(e.target.value)}
                                disabled={loadingTables}
                            >
                                <option value="">Все продукты</option>
                                {dietTables.map((table) => (
                                    <option key={table.id} value={table.id}>
                                        {table.name}
                                    </option>
                                ))}
                            </Form.Select>
                        </Col>

                        <Col md={5}>
                            <Form.Label className="small text-muted">Продукты из выбранного стола</Form.Label>
                            <InputGroup className="mb-2">
                                <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                                    <Search size={14} />
                                </InputGroup.Text>
                                <Form.Control
                                    type="text"
                                    placeholder="Поиск по продуктам стола..."
                                    value={objectSearch}
                                    onChange={(e) => setObjectSearch(e.target.value)}
                                    disabled={!selectedTableId || loadingTables}
                                />
                            </InputGroup>

                            <div
                                style={{
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: 14,
                                    background: '#fff',
                                    maxHeight: 220,
                                    overflowY: 'auto',
                                    padding: '0.5rem'
                                }}
                            >
                                {!selectedTableId && (
                                    <div className="text-muted small px-2 py-2">
                                        Сначала выберите диетический стол
                                    </div>
                                )}

                                {selectedTableId && loadingTables && (
                                    <div className="text-center py-3">
                                        <Spinner size="sm" />
                                    </div>
                                )}

                                {selectedTableId && !loadingTables && filteredTableObjects.length === 0 && (
                                    <div className="text-muted small px-2 py-2">
                                        Продукты не найдены
                                    </div>
                                )}

                                {selectedTableId && !loadingTables && filteredTableObjects.map((obj) => (
                                    <Form.Check
                                        key={`${obj.objectId}-${obj.varietyId || 'no-variety'}`}
                                        type="checkbox"
                                        id={`obj-${obj.objectId}-${obj.varietyId || 'x'}`}
                                        label={obj.fullName}
                                        checked={selectedObjectIds.includes(obj.objectId)}
                                        onChange={() => toggleObjectSelection(obj.objectId)}
                                        className="px-2 py-1"
                                    />
                                ))}
                            </div>
                        </Col>

                        <Col md={4}>
                            <Form.Label className="small text-muted">Выбрано</Form.Label>

                            <div
                                style={{
                                    minHeight: 120,
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: 14,
                                    background: '#fff',
                                    padding: '0.75rem'
                                }}
                            >
                                {selectedObjectIds.length === 0 ? (
                                    <div className="text-muted small">
                                        Ничего не выбрано. Тогда показываются все спелые продукты.
                                    </div>
                                ) : (
                                    <div className="d-flex flex-wrap gap-2">
                                        {tableObjects
                                            .filter((obj) => selectedObjectIds.includes(obj.objectId))
                                            .map((obj) => (
                                                <span
                                                    key={`selected-${obj.objectId}`}
                                                    style={softChip('#eef2f7', '#44546a')}
                                                >
                                                    {obj.fullName}
                                                </span>
                                            ))}
                                    </div>
                                )}
                            </div>

                            <div className="d-flex gap-2 mt-2">
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={clearProductFilters}
                                    style={{ borderRadius: 12 }}
                                >
                                    Сбросить
                                </Button>

                                <Button
                                    size="sm"
                                    onClick={fetchProducts}
                                    style={{
                                        borderRadius: 12,
                                        background: theme.green,
                                        borderColor: theme.green
                                    }}
                                >
                                    Применить
                                </Button>
                            </div>
                        </Col>
                    </Row>

                    <h6 className="mb-3" style={{ color: theme.text }}>Общий список продуктов</h6>

                    <Row className="g-3 align-items-center">
                        <Col md={3}>
                            <InputGroup>
                                <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                                    <Search size={14} />
                                </InputGroup.Text>
                                <Form.Control
                                    type="text"
                                    placeholder="Поиск по продукту, фермеру, адресу..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
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
                                >
                                    <option value="all">Все расстояния</option>
                                    <option value="50">До 50 км</option>
                                    <option value="100">До 100 км</option>
                                    <option value="200">До 200 км</option>
                                    <option value="500">До 500 км</option>
                                    <option value="1000">До 1000 км</option>
                                </Form.Select>
                            </InputGroup>
                        </Col>

                        <Col md={2}>
                            <InputGroup>
                                <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                                    <SortNumericDown size={14} />
                                </InputGroup.Text>
                                <Form.Select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortField)}
                                >
                                    <option value="distance">По расстоянию</option>
                                    <option value="price">По цене</option>
                                    <option value="rating">По рейтингу</option>
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
                                    onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                                >
                                    <option value="asc">По возрастанию</option>
                                    <option value="desc">По убыванию</option>
                                </Form.Select>
                            </InputGroup>
                        </Col>

                        <Col md={2}>
                            <Form.Select
                                value={generalMinRating}
                                onChange={(e) => setGeneralMinRating(Number(e.target.value))}
                            >
                                <option value="0">Любой рейтинг</option>
                                <option value="3">От 3.0</option>
                                <option value="4">От 4.0</option>
                                <option value="4.5">От 4.5</option>
                            </Form.Select>
                        </Col>

                        <Col md={1}>
                            <Form.Check
                                type="checkbox"
                                label={<><Leaf className="me-1" /> Eco</>}
                                checked={generalEcoOnly}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setGeneralEcoOnly(checked);
                                    onFilterChange?.({ ...parentFilters, ecoOnly: checked });
                                }}
                            />
                        </Col>

                        <Col md={12}>
                            <div className="text-muted small mt-2">
                                Найдено продуктов: {filteredGeneral.length}
                                {stats?.avgPrice ? ` · Средняя цена: ${Number(stats.avgPrice).toFixed(0)} ₽` : ''}
                                {selectedObjectIds.length > 0 ? ` · Фильтр по продуктам: ${selectedObjectIds.length}` : ''}
                            </div>
                        </Col>
                    </Row>

                    {generalEcoOnly && (
                        <Alert variant="success" className="py-2 px-3 mt-3 mb-0">
                            <Leaf className="me-2" size={14} />
                            Показываются только продукты от фермеров с Эко-сертификатом
                        </Alert>
                    )}
                </Card.Body>
            </Card>

            <Row className="g-4">
                {filteredGeneral.map((product, index) => (
                    <Col key={`product-${product.productId}-${product.placeId}-${index}`} xl={4} lg={4} md={6}>
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
                            onClick={() => openOnMap(product)}
                        >
                            {product.imagePath ? (
                                <img
                                    src={`${API_BASE_URL}/uploads${product.imagePath}`}
                                    alt={product.fullProductName}
                                    style={{ width: '100%', height: 200, objectFit: 'cover' }}
                                    onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div
                                    style={{ height: 200, background: '#f8f6f1' }}
                                    className="d-flex align-items-center justify-content-center"
                                >
                                    <BoxSeam size={48} color={theme.green} />
                                </div>
                            )}

                            <Card.Body className="p-4 d-flex flex-column">
                                <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                                    <div>
                                        <h4 className="mb-1" style={{ color: theme.text, fontWeight: 700 }}>
                                            {product.fullProductName}
                                        </h4>

                                        <div className="text-muted" style={{ fontSize: '0.96rem' }}>
                                            <GeoAlt size={12} className="me-1" />
                                            {product.placeAddress}
                                        </div>

                                        <div className="text-muted mt-1" style={{ fontSize: '0.96rem' }}>
                                            Фермер: {product.farmerName}
                                        </div>
                                    </div>

                                    <span style={{ background: product.clusterRankColor || theme.purple }}>
                                        #{product.clusterRank || '-'}
                                    </span>
                                </div>

                                <div className="d-flex flex-wrap gap-2 mb-3">
                                    {product.has_eco_certificate && (
                                        <span style={softChip('#e7f5ea', theme.green)}>
                                            <Leaf size={13} className="me-1" />
                                            Eco certificate
                                        </span>
                                    )}

                                    <span style={softChip('#eef2f7', '#44546a')}>
                                        <GeoAlt size={12} className="me-1" />
                                        {Number(product.distance || 0).toFixed(1)} км
                                    </span>

                                    <span style={softChip('#fff5db', '#8a6116')}>
                                        <StarFill size={12} className="me-1" />
                                        {Number(product.farmerRating || 0).toFixed(1)}
                                    </span>
                                </div>

                                <div className="mb-3 text-muted" style={{ fontSize: '0.92rem' }}>
                                    Тип: {product.locationType === 1 ? 'Рынок' : product.locationType === 2 ? 'Аукцион' : 'Склад'}
                                    <br />
                                    Количество: {product.quantity} {product.unit}
                                </div>

                                <div className="mt-auto d-flex align-items-center justify-content-between">
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1.2rem', color: theme.text }}>
                                            {Number(product.price || 0).toFixed(0)} ₽
                                        </div>
                                        {product.computedRating !== undefined && (
                                            <div className="small text-muted">
                                                Score: {Number(product.computedRating).toFixed(1)}
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        style={{
                                            background: '#e7f5ea',
                                            color: theme.green,
                                            border: '1px solid #d3e8d7',
                                            borderRadius: 12
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openOnMap(product);
                                        }}
                                    >
                                        <MapIcon size={14} className="me-2" />
                                        На карте
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}

                {filteredGeneral.length === 0 && (
                    <Col md={12}>
                        <div className="text-center py-5 text-muted">
                            <BoxSeam size={48} className="mb-3" />
                            <p>Продукты не найдены</p>
                        </div>
                    </Col>
                )}
            </Row>
        </div>
    );
};

export default ProductsDeveloperPage;