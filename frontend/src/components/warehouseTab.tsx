import React, { useEffect, useMemo, useState, useCallback } from 'react';

import {
    Row,
    Col,
    Card,
    Button,
    Spinner,
    Modal,
    Form,
    InputGroup,
    Alert,
    Tabs,
    Tab
} from 'react-bootstrap';
import {
    Search,
    Pencil,
    Trash2,
    Filter,
    Droplet,
    Flower1,
    Tree,
    ThermometerHigh,
    EggFried,
    BoxSeam,
    GeoAlt,
    XCircle,
    ArrowLeftRight,
    GraphUp,
    Shop
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { ui, chip, btnMain, btnSoft, btnDangerSoft, glassCard } from './supplierUI';
import {
    getSupplierWarehouseProducts,
    getSupplierPlaces,
    updateSupplierWarehouseProduct,
    moveSupplierWarehouseProduct,
    deleteSupplierWarehouseProduct
} from '../api/supplierWarehouseApi';

interface ProductCopy {
    id: number;
    idproduct: number;
    discount: number | null;
    copecks: number;
    wholepart: number;
    decsription: string | null;
    isactual: boolean;
    rating: number | null;
    iddimension: number;
    weight: number | null;
    proteines: number | null;
    lipides: number | null;
    glucides: number | null;
    calories: number | null;
    joules: number | null;
    expirationdate: string | null;
    releasedate: string | null;
    packaging: string | null;
    placeoforigin: string | null;
    idlocationproduct: 1 | 2 | 3;
    product: {
        id: number;
        name: string;
        imagePath?: string | null;
        objectName: string;
        varietyName: string;
        categoryName: string;
    };
    place: {
        id: number;
        address: string;
        kadastrNumber: string;
    } | null;
}

interface Place {
    id: number;
    address: string;
    kadastrNumber: string;
}

interface WarehouseTabProps {
    refreshTrigger?: number;
}

const LOCATION_TYPES: Record<number, {
    name: string;
    icon: React.ReactNode;
    bg: string;
    color: string;
}> = {
    1: {
        name: 'Склад',
        icon: <BoxSeam size={12} style={{ color: ui.blueGray }} />,
        bg: ui.blueGraySoft,
        color: ui.blueGray
    },
    2: {
        name: 'Рынок',
        icon: <Shop size={12} style={{ color: ui.greenDark }} />,
        bg: ui.greenSoft,
        color: ui.greenDark
    },
    3: {
        name: 'Аукцион',
        icon: <GraphUp size={12} style={{ color: ui.gold }} />,
        bg: ui.goldSoft,
        color: ui.gold
    }
};

const getLocationMeta = (location: unknown) => {
    const numericLocation = Number(location);

    return (
        LOCATION_TYPES[numericLocation] || {
            name: 'Не указано',
            icon: <BoxSeam size={12} style={{ color: ui.muted }} />,
            bg: ui.blueGraySoft,
            color: ui.blueGray
        }
    );
};

const getCategoryIcon = (categoryName: string, size: number = 20) => {
    if (!categoryName) return <BoxSeam size={size} style={{ color: ui.blueGray }} />;

    const name = categoryName.toLowerCase();

    if (name.includes('молоко') || name.includes('молочн')) {
        return <Droplet size={size} style={{ color: ui.blueGray }} />;
    }
    if (name.includes('овощ')) {
        return <Flower1 size={size} style={{ color: ui.green }} />;
    }
    if (name.includes('фрукт') || name.includes('ягод')) {
        return <Tree size={size} style={{ color: ui.red }} />;
    }
    if (name.includes('мясо') || name.includes('птиц')) {
        return <ThermometerHigh size={size} style={{ color: ui.gold }} />;
    }
    if (name.includes('зерн') || name.includes('злак')) {
        return <EggFried size={size} style={{ color: ui.blueGray }} />;
    }

    return <BoxSeam size={size} style={{ color: ui.blueGray }} />;
};

const formatPrice = (wholepart: number, copecks: number = 0) => {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 2
    }).format(wholepart + copecks / 100);
};

const WarehouseTab: React.FC<WarehouseTabProps> = ({ refreshTrigger }) => {
    const [products, setProducts] = useState<ProductCopy[]>([]);
    const [places, setPlaces] = useState<Place[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlace, setSelectedPlace] = useState<number | 'all'>('all');
    const [selectedLocation, setSelectedLocation] = useState<number | 'all'>('all');
    const [activeTab, setActiveTab] = useState<string>('all');

    const [selectedProduct, setSelectedProduct] = useState<ProductCopy | null>(null);

    const [showEditModal, setShowEditModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const [editData, setEditData] = useState({
        wholepart: 0,
        copecks: 0,
        discount: 0
    });

    const [moveData, setMoveData] = useState({
        newLocation: 1 as 1 | 2 | 3
    });

    const fetchData = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true);

            const [productsData, placesData] = await Promise.all([
                getSupplierWarehouseProducts(),
                getSupplierPlaces()
            ]);
            console.log('warehouse products:', productsData.products);
            if (productsData.success) {
                setProducts(productsData.products || []);
            }

            if (placesData.success) {
                setPlaces(placesData.places || []);
            }
        } catch {
            toast.error('Ошибка загрузки склада');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData, refreshTrigger]);
    useEffect(() => {
        const token = localStorage.getItem('userToken');

        if (!token) return;

        const events = new EventSource(
            `http://localhost:5000/api/supplier/warehouse/events?token=${encodeURIComponent(token)}`
        );

        events.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'warehouse-updated') {
                    console.log('warehouse updated event:', data);
                    fetchData(true);
                }
            } catch (error) {
                console.error('warehouse event parse error:', error);
            }
        };

        events.onerror = (error) => {
            console.error('warehouse events connection error:', error);
            events.close();
        };

        return () => {
            events.close();
        };
    }, [fetchData]);
    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const matchesSearch =
                !searchTerm ||
                product.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.product.objectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.product.categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (product.place?.address || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesPlace =
                selectedPlace === 'all' || product.place?.id === selectedPlace;

            const matchesLocation =
                selectedLocation === 'all' || product.idlocationproduct === selectedLocation;

            const matchesTab =
                activeTab === 'all' || product.idlocationproduct === Number(activeTab);

            return matchesSearch && matchesPlace && matchesLocation && matchesTab;
        });
    }, [products, searchTerm, selectedPlace, selectedLocation, activeTab]);

    const locationStats = {
        1: products.filter((p) => p.idlocationproduct === 1).length,
        2: products.filter((p) => p.idlocationproduct === 2).length,
        3: products.filter((p) => p.idlocationproduct === 3).length
    };

    const categoryStats = useMemo(() => {
        return filteredProducts.reduce((acc, product) => {
            const key = product.product.categoryName?.trim() || 'Без категории';

            if (!acc[key]) {
                acc[key] = {
                    count: 0,
                    totalValue: 0,
                    icon: getCategoryIcon(key, 18)
                };
            }

            acc[key].count += 1;
            acc[key].totalValue += product.wholepart + product.copecks / 100;

            return acc;
        }, {} as Record<string, { count: number; totalValue: number; icon: React.ReactNode }>);
    }, [filteredProducts]);
    const handleEditClick = (product: ProductCopy) => {
        setSelectedProduct(product);
        setEditData({
            wholepart: product.wholepart,
            copecks: product.copecks,
            discount: product.discount || 0
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedProduct) return;

        try {
            const data = await updateSupplierWarehouseProduct(selectedProduct.id, {
                wholepart: editData.wholepart,
                copecks: editData.copecks,
                discount: editData.discount
            });

            if (data.success) {
                toast.success('Товар обновлён');
                setShowEditModal(false);
                fetchData();
            } else {
                toast.error(data.message || 'Ошибка обновления');
            }
        } catch {
            toast.error('Ошибка сервера');
        }
    };

    const handleMoveClick = (product: ProductCopy) => {
        setSelectedProduct(product);
        setMoveData({
            newLocation: product.idlocationproduct
        });
        setShowMoveModal(true);
    };

    const handleMoveProduct = async () => {
        if (!selectedProduct) return;

        try {
            const data = await moveSupplierWarehouseProduct(selectedProduct.id, {
                newLocation: moveData.newLocation
            });

            if (data.success) {
                toast.success(`Товар перемещён: ${getLocationMeta(moveData.newLocation).name}`);
                setShowMoveModal(false);
                fetchData();
            } else {
                toast.error(data.message || 'Ошибка перемещения');
            }
        } catch {
            toast.error('Ошибка сервера');
        }
    };

    const handleDeleteClick = (product: ProductCopy) => {
        setSelectedProduct(product);
        setShowDeleteModal(true);
    };

    const handleDeleteProduct = async () => {
        if (!selectedProduct) return;

        try {
            const data = await deleteSupplierWarehouseProduct(selectedProduct.id);

            if (data.success) {
                toast.success('Товар удалён');
                setShowDeleteModal(false);
                fetchData();
            } else {
                toast.error(data.message || 'Ошибка удаления');
            }
        } catch {
            toast.error('Ошибка сервера');
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" style={{ color: ui.green }} />
                <p className="mt-3" style={{ color: ui.muted }}>Загрузка склада...</p>
            </div>
        );
    }

    return (
        <>
            <Card className="border-0 mb-4" style={{ ...glassCard(), overflow: 'hidden' }}>
                <Card.Body style={{ padding: '1.35rem' }}>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                        <div>
                            <h4 className="mb-1" style={{ color: ui.text }}>
                                {/* <BoxSeam className="me-2" style={{ color: ui.green }} /> */}
                                Склад
                            </h4>
                            <div style={{ color: ui.muted }}>
                                Управление товарами поставщика: цены, скидки, перемещение и удаление
                            </div>
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                            <span style={chip(ui.blueGraySoft, ui.blueGray)}>На складе: {locationStats[1]}</span>
                            <span style={chip(ui.greenSoft, ui.greenDark)}>На рынке: {locationStats[2]}</span>
                            <span style={chip(ui.goldSoft, ui.gold)}>На аукционе: {locationStats[3]}</span>
                        </div>
                    </div>
                </Card.Body>
            </Card>

            <Row className="g-4 mb-4">
                {Object.entries(categoryStats).map(([category, stats]) => (
                    <Col key={category} md={4} xl={3}>
                        <Card className="border-0 h-100" style={{ borderRadius: 22, boxShadow: ui.shadowSoft }}>
                            <Card.Body className="d-flex align-items-center gap-3">
                                {/* <div
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 14,
                                        background: ui.greenSoft,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {stats.icon}
                                </div> */}
                                <div>
                                    <div style={{ color: ui.text, fontWeight: 700 }}>{category}</div>
                                    <div className="d-flex flex-wrap gap-2 mt-1">
                                        <span style={chip(ui.shadowSoft, ui.blueGray)}>{stats.count} шт.</span>
                                        <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                                            {new Intl.NumberFormat('ru-RU', {
                                                style: 'currency',
                                                currency: 'RUB',
                                                maximumFractionDigits: 0
                                            }).format(stats.totalValue)}
                                        </span>
                                    </div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Card className="border-0 mb-4" style={{ borderRadius: 24, boxShadow: ui.shadowSoft }}>
                <Card.Body>
                    <Tabs
                        activeKey={activeTab}
                        onSelect={(k) => setActiveTab(k || 'all')}
                        className="supplier-subtabs"
                    >
                        <Tab eventKey="all" title="Все товары" />
                        <Tab eventKey="1" title={`Склад (${locationStats[1]})`} />
                        <Tab eventKey="2" title={`Рынок (${locationStats[2]})`} />
                        <Tab eventKey="3" title={`Аукцион (${locationStats[3]})`} />
                    </Tabs>
                </Card.Body>
            </Card>

            <Card className="border-0 mb-4" style={{ borderRadius: 24, boxShadow: ui.shadowSoft }}>
                <Card.Body>
                    <Row className="g-3">
                        <Col lg={5}>
                            <InputGroup>
                                <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                                    <Search style={{ color: ui.green }} />
                                </InputGroup.Text>
                                <Form.Control
                                    placeholder="Поиск по названию, категории или участку"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ borderColor: ui.border }}
                                />
                                {searchTerm && (
                                    <Button style={btnSoft()} onClick={() => setSearchTerm('')}>
                                        <XCircle />
                                    </Button>
                                )}
                            </InputGroup>
                        </Col>

                        <Col lg={4}>
                            <InputGroup>
                                <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                                    <Filter style={{ color: ui.green }} />
                                </InputGroup.Text>
                                <Form.Select
                                    value={selectedPlace}
                                    onChange={(e) => setSelectedPlace(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                    style={{ borderColor: ui.border }}
                                >
                                    <option value="all">Все участки</option>
                                    {places
                                        .filter((place): place is Place => !!place)
                                        .map((place) => (
                                            <option key={place.id} value={place.id}>
                                                {place.address}
                                            </option>
                                        ))}
                                </Form.Select>
                            </InputGroup>
                        </Col>

                        <Col lg={3}>
                            <InputGroup>
                                <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                                    <Filter style={{ color: ui.green }} />
                                </InputGroup.Text>
                                <Form.Select
                                    value={selectedLocation}
                                    onChange={(e) => setSelectedLocation(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                    style={{ borderColor: ui.border }}
                                >
                                    <option value="all">Все местоположения</option>
                                    <option value="1">Склад</option>
                                    <option value="2">Рынок</option>
                                    <option value="3">Аукцион</option>
                                </Form.Select>
                            </InputGroup>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {filteredProducts.length === 0 ? (
                <Alert
                    className="text-center py-5"
                    style={{
                        background: ui.blueGraySoft,
                        color: ui.blueGray,
                        border: `1px solid ${ui.border}`
                    }}
                >
                    <BoxSeam size={42} className="mb-3" />
                    <h5>Товары не найдены</h5>
                    <p className="mb-0">
                        Измените фильтры или добавьте товары в складской учет
                    </p>
                </Alert>
            ) : (
                <Row className="g-4">
                    {filteredProducts.map((product) => (
                        <Col key={product.id} xl={4} md={6}>
                            <Card className="border-0 h-100" style={{ borderRadius: 22, boxShadow: ui.shadowSoft }}>
                                <Card.Body className="d-flex flex-column">
                                    <div className="d-flex align-items-start gap-3 mb-3">
                                        <div
                                            style={{
                                                width: 180,
                                                height: 180,
                                                borderRadius: 18,
                                                overflow: 'hidden',
                                                border: `1px solid ${ui.border}`,
                                                background: '#fff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}
                                        >
                                            {(product as any).imagePath ? (
                                                <img
                                                    src={`http://localhost:5000${(product as any).imagePath}`}
                                                    alt={product.product.name}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover'
                                                    }}
                                                    onError={(e) => {
                                                        console.log('image failed:', product.product.imagePath);
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                getCategoryIcon(product.product.categoryName, 24)
                                            )}
                                        </div>

                                        <div>
                                            <div style={{ color: ui.text, fontWeight: 700 }}>
                                                {product.product.name}
                                            </div>

                                            <div className="small" style={{ color: ui.muted }}>
                                                {product.product.objectName}
                                                {product.product.varietyName ? ` • ${product.product.varietyName}` : ''}
                                            </div>

                                            <div className="small mt-1" style={{ color: ui.muted }}>
                                                {product.product.categoryName || 'Без категории'}
                                            </div>

                                            <div className="small mt-1" style={{ color: ui.blueGray }}>
                                                {'Спелый'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                        <span style={chip(ui.greenSoft, ui.green)}>{product.product.categoryName || 'Без категории'}</span>
                                        {(() => {
                                            const locationMeta = getLocationMeta(product.idlocationproduct);

                                            return (
                                                <span style={chip(locationMeta.bg, locationMeta.color)}>
                                                    {locationMeta.icon}
                                                    {locationMeta.name}
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    <div className="small mb-3" style={{ color: ui.muted }}>
                                        <GeoAlt className="me-1" style={{ color: ui.green }} />
                                        {product.place?.address || 'Участок не указан'}
                                    </div>

                                    <Row className="g-2 mb-3">
                                        <Col xs={6}>
                                            <div className="small" style={{ color: ui.muted }}>Цена</div>
                                            <div style={{ color: ui.text, fontWeight: 700 }}>
                                                {formatPrice(product.wholepart, product.copecks)}
                                            </div>
                                        </Col>

                                        <Col xs={6}>
                                            <div className="small" style={{ color: ui.muted }}>Скидка</div>
                                            <div style={{ color: ui.text, fontWeight: 700 }}>
                                                {product.discount || 0}%
                                            </div>
                                        </Col>
                                    </Row>

                                    <div className="mt-auto d-flex gap-2 flex-wrap">
                                        <Button style={btnSoft()} onClick={() => handleEditClick(product)}>
                                            <Pencil className="me-1" />
                                            Редактировать
                                        </Button>

                                        <Button style={btnSoft()} onClick={() => handleMoveClick(product)}>
                                            <ArrowLeftRight className="me-1" />
                                            Переместить
                                        </Button>

                                        <Button style={btnDangerSoft()} onClick={() => handleDeleteClick(product)}>
                                            <Trash2 className="me-1" />
                                            Удалить
                                        </Button>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}

            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Редактировать товар</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedProduct && (
                        <Form>
                            <div className="mb-3">
                                <div style={{ fontWeight: 700, color: ui.text }}>{selectedProduct.product.name}</div>
                                <div className="small" style={{ color: ui.muted }}>
                                    {selectedProduct.place?.address || 'Участок не указан'}
                                </div>
                            </div>

                            <Row className="g-3">
                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label>Рубли</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={editData.wholepart}
                                            onChange={(e) =>
                                                setEditData((prev) => ({ ...prev, wholepart: Number(e.target.value) }))
                                            }
                                        />
                                    </Form.Group>
                                </Col>

                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label>Копейки</Form.Label>
                                        <Form.Control
                                            type="number"
                                            min={0}
                                            max={99}
                                            value={editData.copecks}
                                            onChange={(e) =>
                                                setEditData((prev) => ({ ...prev, copecks: Number(e.target.value) }))
                                            }
                                        />
                                    </Form.Group>
                                </Col>

                                <Col md={4}>
                                    <Form.Group>
                                        <Form.Label>Скидка %</Form.Label>
                                        <Form.Control
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={editData.discount}
                                            onChange={(e) =>
                                                setEditData((prev) => ({ ...prev, discount: Number(e.target.value) }))
                                            }
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                        </Form>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button style={btnSoft()} onClick={() => setShowEditModal(false)}>
                        Отмена
                    </Button>
                    <Button style={btnMain()} onClick={handleSaveEdit}>
                        Сохранить
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showMoveModal} onHide={() => setShowMoveModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Переместить товар</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedProduct && (
                        <Form.Group>
                            <Form.Label>Новое местоположение</Form.Label>
                            <Form.Select
                                value={moveData.newLocation}
                                onChange={(e) =>
                                    setMoveData({ newLocation: Number(e.target.value) as 1 | 2 | 3 })
                                }
                            >
                                <option value={1}>Склад</option>
                                <option value={2}>Рынок</option>
                                <option value={3}>Аукцион</option>
                            </Form.Select>
                        </Form.Group>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button style={btnSoft()} onClick={() => setShowMoveModal(false)}>
                        Отмена
                    </Button>
                    <Button style={btnMain()} onClick={handleMoveProduct}>
                        Переместить
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Удалить товар</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedProduct && (
                        <Alert
                            style={{
                                background: ui.redSoft,
                                color: ui.red,
                                border: `1px solid ${ui.border}`
                            }}
                        >
                            Товар <strong>{selectedProduct.product.name}</strong> будет удалён полностью.
                        </Alert>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button style={btnSoft()} onClick={() => setShowDeleteModal(false)}>
                        Отмена
                    </Button>
                    <Button style={btnDangerSoft()} onClick={handleDeleteProduct}>
                        Удалить
                    </Button>
                </Modal.Footer>
            </Modal>

            <style>{`
        .supplier-subtabs.nav-tabs {
          border-bottom: none;
          gap: 10px;
          display: flex;
          flex-wrap: wrap;
        }

        .supplier-subtabs .nav-link {
          border: 1px solid ${ui.border};
          border-radius: 14px !important;
          color: ${ui.text};
          font-weight: 600;
          padding: 0.72rem 1rem;
          background: #fff;
        }

        .supplier-subtabs .nav-link.active {
          background: ${ui.green};
          color: white !important;
          border-color: ${ui.green};
          box-shadow: 0 8px 22px rgba(47, 107, 58, 0.16);
        }
      `}</style>
        </>
    );
};

export default WarehouseTab;