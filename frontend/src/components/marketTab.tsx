import React, { useEffect, useMemo, useState } from 'react';
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
  Table,
  Tabs,
  Tab
} from 'react-bootstrap';
import {
  Search,
  Droplet,
  Flower1,
  Tree,
  ThermometerHigh,
  EggFried,
  BoxSeam,
  GeoAlt,
  XCircle,
  Shop,
  People,
  CheckCircle,
  Clock,
  Truck,
  CreditCard,
  PlusLg,
  Trash,
  ArrowLeftRight
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { ui, chip, btnMain, btnSoft, btnDangerSoft, glassCard } from './supplierUI';
import {
  getSupplierMarketProducts,
  getSupplierMarketPurchases,
  createSupplierMarketPurchase,
  updateSupplierMarketPurchaseStatus
} from '../api/supplierMarketApi';
import {
  getSupplierWarehouseProducts,
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

interface Purchase {
  id: number;
  idproductcopy: number;
  idsupplier: number;
  idcustomer: number;
  idplace: number | null;
  quantity: number;
  totalprice: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  paymentmethod: string | null;
  deliveryaddress: string | null;
  contactphone: string | null;
  contactemail: string | null;
  comment: string | null;
  createdat: string;
  completedat: string | null;
  customer: {
    id: number;
    username: string;
    email: string;
  } | null;
  place: {
    id: number;
    address: string;
  } | null;
}

interface MarketTabProps {
  refreshTrigger?: number;
}

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
    return <EggFried size={size} style={{ color: ui.purple }} />;
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

const formatTotalPrice = (amount: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2
  }).format(amount);
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Не указана';
  return new Date(dateString).toLocaleString('ru-RU');
};

const renderPurchaseStatus = (status: Purchase['status']) => {
  if (status === 'pending') {
    return <span style={chip(ui.goldSoft, ui.gold)}><Clock size={12} /> Ожидает оплаты</span>;
  }
  if (status === 'paid') {
    return <span style={chip(ui.blueGraySoft, ui.blueGray)}><CreditCard size={12} /> Оплачен</span>;
  }
  if (status === 'shipped') {
    return <span style={chip(ui.purpleSoft, ui.purple)}><Truck size={12} /> Отгружен</span>;
  }
  if (status === 'delivered') {
    return <span style={chip(ui.greenSoft, ui.greenDark)}><CheckCircle size={12} /> Доставлен</span>;
  }
  return <span style={chip(ui.redSoft, ui.red)}><XCircle size={12} /> Отменен</span>;
};

const MarketTab: React.FC<MarketTabProps> = ({ refreshTrigger }) => {
  const [marketProducts, setMarketProducts] = useState<ProductCopy[]>([]);
  const [myProducts, setMyProducts] = useState<ProductCopy[]>([]);
  const [warehouseProducts, setWarehouseProducts] = useState<ProductCopy[]>([]);
  const [sales, setSales] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('buy');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlace, setSelectedPlace] = useState<number | 'all'>('all');

  const [selectedProduct, setSelectedProduct] = useState<ProductCopy | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const [selectedSale, setSelectedSale] = useState<Purchase | null>(null);
  const [showSaleDetailsModal, setShowSaleDetailsModal] = useState(false);

  const [showAddToMarketModal, setShowAddToMarketModal] = useState(false);
  const [showRemoveFromMarketModal, setShowRemoveFromMarketModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<ProductCopy | null>(null);

  const [purchaseForm, setPurchaseForm] = useState({
    quantity: 1,
    paymentmethod: 'card',
    deliveryaddress: '',
    contactphone: '',
    contactemail: '',
    comment: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      const [marketData, salesData, warehouseData] = await Promise.all([
        getSupplierMarketProducts(),
        getSupplierMarketPurchases(),
        getSupplierWarehouseProducts()
      ]);

      if (marketData.success) {
        setMarketProducts(marketData.products || []);
      }

      if (salesData.success) {
        setSales(salesData.purchases || []);
      }

      if (warehouseData.success) {
        const allOwnProducts: ProductCopy[] = warehouseData.products || [];
        setMyProducts(allOwnProducts.filter((p) => p.idlocationproduct === 2));
        setWarehouseProducts(allOwnProducts.filter((p) => p.idlocationproduct === 1));
      }
    } catch {
      toast.error('Ошибка загрузки данных рынка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const categories = Array.from(new Set(marketProducts.map((p) => p.product.categoryName)));
  const places = Array.from(
    new Map(
      marketProducts
        .map((p) => p.place)
        .filter((place): place is NonNullable<ProductCopy['place']> => place !== null)
        .map((place) => [place.id, place])
    ).values()
  );

  const filteredMarketProducts = useMemo(() => {
    return marketProducts.filter((product) => {
      const matchesSearch =
        !searchTerm ||
        product.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.product.objectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.product.categoryName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' || product.product.categoryName === selectedCategory;

      const matchesPlace =
        selectedPlace === 'all' || product.place?.id === selectedPlace;

      return matchesSearch && matchesCategory && matchesPlace;
    });
  }, [marketProducts, searchTerm, selectedCategory, selectedPlace]);

  const handleOpenPurchase = (product: ProductCopy) => {
    setSelectedProduct(product);
    setPurchaseForm({
      quantity: 1,
      paymentmethod: 'card',
      deliveryaddress: '',
      contactphone: '',
      contactemail: '',
      comment: ''
    });
    setShowPurchaseModal(true);
  };

  const handleCreatePurchase = async () => {
    if (!selectedProduct) return;

    try {
      const data = await createSupplierMarketPurchase({
        idproductcopy: selectedProduct.id,
        quantity: purchaseForm.quantity,
        paymentmethod: purchaseForm.paymentmethod,
        deliveryaddress: purchaseForm.deliveryaddress,
        contactphone: purchaseForm.contactphone,
        contactemail: purchaseForm.contactemail,
        comment: purchaseForm.comment
      });

      if (data.success) {
        toast.success('Покупка оформлена');
        setShowPurchaseModal(false);
        fetchData();
      } else {
        toast.error(data.message || 'Ошибка оформления покупки');
      }
    } catch {
      toast.error('Ошибка сервера');
    }
  };

  const handleStatusChange = async (
    purchase: Purchase,
    status: Purchase['status']
  ) => {
    try {
      const data = await updateSupplierMarketPurchaseStatus(purchase.id, { status });

      if (data.success) {
        toast.success('Статус продажи обновлен');
        fetchData();
      } else {
        toast.error(data.message || 'Ошибка обновления статуса');
      }
    } catch {
      toast.error('Ошибка сервера');
    }
  };

  const handleAddToMarket = async () => {
    if (!pendingProduct) return;

    try {
      const data = await moveSupplierWarehouseProduct(pendingProduct.id, { newLocation: 2 });
      if (data.success) {
        toast.success('Товар перемещён на рынок');
        setShowAddToMarketModal(false);
        setPendingProduct(null);
        fetchData();
      } else {
        toast.error(data.message || 'Ошибка перемещения товара');
      }
    } catch {
      toast.error('Ошибка сервера');
    }
  };

  const handleRemoveFromMarket = async () => {
    if (!pendingProduct) return;

    try {
      const data = await moveSupplierWarehouseProduct(pendingProduct.id, { newLocation: 1 });
      if (data.success) {
        toast.success('Товар убран с рынка и возвращён на склад');
        setShowRemoveFromMarketModal(false);
        setPendingProduct(null);
        fetchData();
      } else {
        toast.error(data.message || 'Ошибка возврата товара');
      }
    } catch {
      toast.error('Ошибка сервера');
    }
  };

  const handleDeleteMyProduct = async () => {
    if (!pendingProduct) return;

    try {
      const data = await deleteSupplierWarehouseProduct(pendingProduct.id);
      if (data.success) {
        toast.success('Товар удалён');
        setShowDeleteModal(false);
        setPendingProduct(null);
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
        <p className="mt-3" style={{ color: ui.muted }}>Загрузка данных рынка...</p>
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
                <Shop className="me-2" style={{ color: ui.green }} />
                Рынок
              </h4>
              <div style={{ color: ui.muted }}>
                Покупки на рынке, мои товары на рынке и продажи покупателям
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <span style={chip(ui.greenSoft, ui.greenDark)}>
                Купить: {marketProducts.length}
              </span>
              <span style={chip(ui.border, ui.green)}>
                Активные: {myProducts.length}
              </span>
              <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                Продаж: {sales.length}
              </span>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="border-0" style={{ borderRadius: 24, boxShadow: ui.shadowSoft }}>
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k || 'buy')}
            className="supplier-subtabs mb-4"
          >
            <Tab eventKey="buy" title="Купить">
              <div className="pt-2">
                <Row className="g-3 mb-4">
                  <Col lg={5}>
                    <InputGroup>
                      <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                        <Search style={{ color: ui.green }} />
                      </InputGroup.Text>
                      <Form.Control
                        placeholder="Поиск товара"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ borderColor: ui.border }}
                      />
                    </InputGroup>
                  </Col>

                  <Col lg={3}>
                    <Form.Select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      style={{ borderColor: ui.border }}
                    >
                      <option value="all">Все категории</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Form.Select>
                  </Col>

                  <Col lg={3}>
                    <Form.Select
                      value={selectedPlace}
                      onChange={(e) => setSelectedPlace(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      style={{ borderColor: ui.border }}
                    >
                      <option value="all">Все участки</option>
                      {places
                        .filter((place): place is NonNullable<ProductCopy['place']> => !!place)
                        .map((place) => (
                          <option key={place.id} value={place.id}>
                            {place.address}
                          </option>
                        ))}
                    </Form.Select>
                  </Col>

                  <Col lg={1}>
                    <Button style={btnMain()} className="w-100" onClick={fetchData}>
                      OK
                    </Button>
                  </Col>
                </Row>

                {filteredMarketProducts.length === 0 ? (
                  <Alert
                    style={{
                      background: ui.blueGraySoft,
                      color: ui.blueGray,
                      border: `1px solid ${ui.border}`
                    }}
                  >
                    Товары не найдены
                  </Alert>
                ) : (
                  <Row className="g-4">
                    {filteredMarketProducts.map((product) => (
                      <Col xl={4} md={6} key={product.id}>
                        <Card className="border-0 h-100" style={{ borderRadius: 22, boxShadow: ui.shadowSoft }}>
                          <Card.Body className="d-flex flex-column">
                            <div className="d-flex align-items-start gap-3 mb-3">
                              <div
                                style={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 16,
                                  background: ui.greenSoft,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                {getCategoryIcon(product.product.categoryName, 22)}
                              </div>

                              <div className="flex-grow-1">
                                <div style={{ color: ui.text, fontWeight: 700 }}>
                                  {product.product.name}
                                </div>
                                <div className="small" style={{ color: ui.muted }}>
                                  {product.product.objectName}
                                  {product.product.varietyName ? ` • ${product.product.varietyName}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="d-flex flex-wrap gap-2 mb-3">
                              <span style={chip(ui.greenSoft, ui.green)}>
                                {product.product.categoryName}
                              </span>
                              <span style={chip(ui.greenSoft, ui.greenDark)}>
                                На рынке
                              </span>
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

                            <div className="mt-auto">
                              <Button style={btnMain()} onClick={() => handleOpenPurchase(product)}>
                                <People className="me-1" />
                                Оформить покупку
                              </Button>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            </Tab>

            <Tab eventKey="activity" title="Моя активность">
              <div className="pt-2">
                <div className="d-flex justify-content-end mb-4">
                  <Button style={btnMain()} onClick={() => setShowAddToMarketModal(true)}>
                    <PlusLg className="me-2" />
                    Добавить товар
                  </Button>
                </div>

                {myProducts.length === 0 ? (
                  <Alert
                    style={{
                      background: ui.blueGraySoft,
                      color: ui.blueGray,
                      border: `1px solid ${ui.border}`
                    }}
                  >
                    У вас пока нет товаров на рынке
                  </Alert>
                ) : (
                  <Row className="g-4">
                    {myProducts.map((product) => (
                      <Col xl={4} md={6} key={product.id}>
                        <Card className="border-0 h-100" style={{ borderRadius: 22, boxShadow: ui.shadowSoft }}>
                          <Card.Body className="d-flex flex-column">
                            <div className="d-flex align-items-start gap-3 mb-3">
                              <div
                                style={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: 16,
                                  background: ui.greenSoft,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                {getCategoryIcon(product.product.categoryName, 22)}
                              </div>

                              <div className="flex-grow-1">
                                <div style={{ color: ui.text, fontWeight: 700 }}>
                                  {product.product.name}
                                </div>
                                <div className="small" style={{ color: ui.muted }}>
                                  {product.product.objectName}
                                </div>
                              </div>
                            </div>

                            <div className="d-flex flex-wrap gap-2 mb-3">
                              <span style={chip(ui.greenSoft, ui.greenDark)}>Мой товар</span>
                              <span style={chip(ui.green, ui.green)}>{product.product.categoryName}</span>
                            </div>

                            <div className="small mb-3" style={{ color: ui.muted }}>
                              <GeoAlt className="me-1" style={{ color: ui.green }} />
                              {product.place?.address || 'Участок не указан'}
                            </div>

                            <div className="mb-3" style={{ color: ui.text, fontWeight: 700 }}>
                              {formatPrice(product.wholepart, product.copecks)}
                            </div>

                            <div className="mt-auto d-flex gap-2 flex-wrap">
                              <Button
                                style={btnSoft()}
                                onClick={() => {
                                  setPendingProduct(product);
                                  setShowRemoveFromMarketModal(true);
                                }}
                              >
                                <ArrowLeftRight className="me-1" />
                                Убрать с рынка
                              </Button>

                              <Button
                                style={btnDangerSoft()}
                                onClick={() => {
                                  setPendingProduct(product);
                                  setShowDeleteModal(true);
                                }}
                              >
                                <Trash className="me-1" />
                                Удалить
                              </Button>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            </Tab>

            <Tab eventKey="sales" title="Мои продажи">
              <div className="pt-2">
                {sales.length === 0 ? (
                  <Alert
                    style={{
                      background: ui.blueGraySoft,
                      color: ui.blueGray,
                      border: `1px solid ${ui.border}`
                    }}
                  >
                    Продаж пока нет
                  </Alert>
                ) : (
                  <Table responsive hover className="align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Покупатель</th>
                        <th>Количество</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                        <th>Дата</th>
                        <th className="text-end">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((sale) => (
                        <tr key={sale.id}>
                          <td>
                            <div style={{ fontWeight: 700, color: ui.text }}>
                              {sale.customer?.username || 'Неизвестно'}
                            </div>
                            <div className="small" style={{ color: ui.muted }}>
                              {sale.customer?.email || '—'}
                            </div>
                          </td>
                          <td>{sale.quantity}</td>
                          <td>{formatTotalPrice(sale.totalprice)}</td>
                          <td>{renderPurchaseStatus(sale.status)}</td>
                          <td>{formatDate(sale.createdat)}</td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-2 flex-wrap">
                              <Button
                                style={btnSoft()}
                                size="sm"
                                onClick={() => {
                                  setSelectedSale(sale);
                                  setShowSaleDetailsModal(true);
                                }}
                              >
                                Детали
                              </Button>

                              {sale.status === 'pending' && (
                                <Button
                                  style={btnSoft()}
                                  size="sm"
                                  onClick={() => handleStatusChange(sale, 'paid')}
                                >
                                  Подтвердить оплату
                                </Button>
                              )}

                              {sale.status === 'paid' && (
                                <Button
                                  style={btnSoft()}
                                  size="sm"
                                  onClick={() => handleStatusChange(sale, 'shipped')}
                                >
                                  Отгрузить
                                </Button>
                              )}

                              {sale.status === 'shipped' && (
                                <Button
                                  style={btnMain()}
                                  size="sm"
                                  onClick={() => handleStatusChange(sale, 'delivered')}
                                >
                                  Доставлено
                                </Button>
                              )}

                              {sale.status !== 'delivered' && sale.status !== 'cancelled' && (
                                <Button
                                  style={btnDangerSoft()}
                                  size="sm"
                                  onClick={() => handleStatusChange(sale, 'cancelled')}
                                >
                                  Отменить
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      <Modal show={showPurchaseModal} onHide={() => setShowPurchaseModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Оформить покупку</Modal.Title>
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
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Количество</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={purchaseForm.quantity}
                      onChange={(e) =>
                        setPurchaseForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))
                      }
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Оплата</Form.Label>
                    <Form.Select
                      value={purchaseForm.paymentmethod}
                      onChange={(e) =>
                        setPurchaseForm((prev) => ({ ...prev, paymentmethod: e.target.value }))
                      }
                    >
                      <option value="card">Карта</option>
                      <option value="cash">Наличные</option>
                      <option value="transfer">Перевод</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Адрес доставки</Form.Label>
                    <Form.Control
                      value={purchaseForm.deliveryaddress}
                      onChange={(e) =>
                        setPurchaseForm((prev) => ({ ...prev, deliveryaddress: e.target.value }))
                      }
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Телефон</Form.Label>
                    <Form.Control
                      value={purchaseForm.contactphone}
                      onChange={(e) =>
                        setPurchaseForm((prev) => ({ ...prev, contactphone: e.target.value }))
                      }
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      value={purchaseForm.contactemail}
                      onChange={(e) =>
                        setPurchaseForm((prev) => ({ ...prev, contactemail: e.target.value }))
                      }
                    />
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Комментарий</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={purchaseForm.comment}
                      onChange={(e) =>
                        setPurchaseForm((prev) => ({ ...prev, comment: e.target.value }))
                      }
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowPurchaseModal(false)}>
            Отмена
          </Button>
          <Button style={btnMain()} onClick={handleCreatePurchase}>
            Подтвердить
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showAddToMarketModal} onHide={() => setShowAddToMarketModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Добавить товар на рынок</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {warehouseProducts.length === 0 ? (
            <Alert
              style={{
                background: ui.blueGraySoft,
                color: ui.blueGray,
                border: `1px solid ${ui.border}`
              }}
            >
              На складе нет товаров для перемещения на рынок
            </Alert>
          ) : (
            <div className="d-flex flex-column gap-2">
              {warehouseProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setPendingProduct(product)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 16,
                    padding: '0.9rem 1rem',
                    border: `1px solid ${pendingProduct?.id === product.id ? ui.green : ui.border}`,
                    background: pendingProduct?.id === product.id ? ui.greenSoft : '#fff',
                    color: ui.text
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{product.product.name}</div>
                  <div className="small" style={{ color: ui.muted }}>
                    {product.place?.address || 'Участок не указан'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowAddToMarketModal(false)}>
            Отмена
          </Button>
          <Button
            style={btnMain()}
            onClick={handleAddToMarket}
            disabled={!pendingProduct}
          >
            Добавить
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showRemoveFromMarketModal} onHide={() => setShowRemoveFromMarketModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Убрать товар с рынка</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pendingProduct && (
            <Alert
              style={{
                background: ui.goldSoft,
                color: ui.gold,
                border: `1px solid ${ui.border}`
              }}
            >
              Товар <strong>{pendingProduct.product.name}</strong> будет возвращён на склад.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowRemoveFromMarketModal(false)}>
            Отмена
          </Button>
          <Button style={btnMain()} onClick={handleRemoveFromMarket}>
            Подтвердить
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Удалить товар</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pendingProduct && (
            <Alert
              style={{
                background: ui.redSoft,
                color: ui.red,
                border: `1px solid ${ui.border}`
              }}
            >
              Товар <strong>{pendingProduct.product.name}</strong> будет удалён полностью.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowDeleteModal(false)}>
            Отмена
          </Button>
          <Button style={btnDangerSoft()} onClick={handleDeleteMyProduct}>
            Удалить
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSaleDetailsModal} onHide={() => setShowSaleDetailsModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Детали продажи</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSale && (
            <Table responsive className="mb-0">
              <tbody>
                <tr>
                  <td className="text-muted">Покупатель</td>
                  <td className="text-end">{selectedSale.customer?.username || 'Неизвестно'}</td>
                </tr>
                <tr>
                  <td className="text-muted">Email</td>
                  <td className="text-end">{selectedSale.customer?.email || 'Не указан'}</td>
                </tr>
                <tr>
                  <td className="text-muted">Количество</td>
                  <td className="text-end">{selectedSale.quantity} шт.</td>
                </tr>
                <tr>
                  <td className="text-muted">Сумма</td>
                  <td className="text-end">{formatTotalPrice(selectedSale.totalprice)}</td>
                </tr>
                <tr>
                  <td className="text-muted">Способ оплаты</td>
                  <td className="text-end">{selectedSale.paymentmethod || 'Не указан'}</td>
                </tr>
                <tr>
                  <td className="text-muted">Дата покупки</td>
                  <td className="text-end">{formatDate(selectedSale.createdat)}</td>
                </tr>
                {selectedSale.deliveryaddress ? (
                  <tr>
                    <td className="text-muted">Адрес доставки</td>
                    <td className="text-end">{selectedSale.deliveryaddress}</td>
                  </tr>
                ) : null}
                {selectedSale.contactphone ? (
                  <tr>
                    <td className="text-muted">Телефон</td>
                    <td className="text-end">{selectedSale.contactphone}</td>
                  </tr>
                ) : null}
                {selectedSale.comment ? (
                  <tr>
                    <td className="text-muted">Комментарий</td>
                    <td className="text-end">{selectedSale.comment}</td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowSaleDetailsModal(false)}>
            Закрыть
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

export default MarketTab;