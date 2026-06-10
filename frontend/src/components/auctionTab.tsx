import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  PlusLg,
  Search,
  PencilSquare,
  Trash,
  Filter,
  Clock,
  GeoAlt,
  Eye,
  Trophy,
  GraphUp,
  BoxSeam
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { ui, chip, btnMain, btnSoft, btnDangerSoft, glassCard } from './supplierUI';
import {
  getSupplierAuctions,
  getSupplierAuctionBids,
  getSupplierAuctionProducts,
  createSupplierAuction,
  updateSupplierAuction,
  updateSupplierAuctionStatus,
  deleteSupplierAuction
} from '../api/supplierAuctionsApi';

// Интерфейсы остаются без изменений
interface ProductCopy {
  id: number;
  productId: number;
  productName: string;
  categoryName: string;
  objectName: string;
  varietyName: string;
  wholepart: number;
  copecks: number;
  quantity: number;
  unit: string;
  characteristics: any;
  auctionProduct: boolean;
}

interface Auction {
  id: number;
  lotNumber: string;
  title: string;
  description?: string;
  idproduct: number;
  productName: string;
  categoryName: string;
  objectName: string;
  varietyName: string;
  startprice: number;
  minstep: number;
  buynowprice?: number;
  starttime: string;
  endtime: string;
  createdat?: string;
  status: 'draft' | 'active' | 'ended' | 'cancelled';
  vatincluded: boolean;
  deliveryregion: string;
  idplace: number;
  placeAddress?: string;
  characteristics: any;
  bidsCount?: number;
  currentBid?: number;
}

interface Place {
  id: number;
  address: string;
  kadastrNumber: string;
}

interface Bid {
  id: number;
  bidamountwhole: number;
  bidamountcopecks: number;
  bidtime: string;
  username: string;
  iswinning?: boolean;
}

interface AuctionTabProps {
  refreshTrigger?: number;
}

const formatPrice = (wholepart: number, copecks: number = 0) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2
  }).format(wholepart + copecks / 100);
};

const AuctionTab: React.FC<AuctionTabProps> = ({ refreshTrigger }) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<string>('auctions');
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [products, setProducts] = useState<ProductCopy[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'endingSoon' | 'priceLowHigh' | 'priceHighLow'>('newest');

  const [timeRemaining, setTimeRemaining] = useState<Record<number, string>>({});

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    idproduct: 0,
    startprice: '',
    minstep: '',
    buynowprice: '',
    starttime: '',
    endtime: '',
    vatincluded: false,
    deliveryregion: '',
    idplace: 0,
    description: ''
  });

  const regions = [
    'Центральный',
    'Северо-Западный',
    'Южный',
    'Северо-Кавказский',
    'Приволжский',
    'Уральский',
    'Сибирский',
    'Дальневосточный'
  ];

  const fetchData = async () => {
    try {
      setLoading(true);

      const [auctionsData, productsData] = await Promise.all([
        getSupplierAuctions(),
        getSupplierAuctionProducts()
      ]);

      if (auctionsData.success) {
        setAuctions(auctionsData.auctions || []);
        setPlaces(auctionsData.places || []);
      } else {
        toast.error(auctionsData.message || t('supplier.auctionsTab.messages.errorLoadingAuctions'));
      }

      if (productsData.success) {
        setProducts(productsData.products || []);
      }
    } catch {
      toast.error(t('supplier.auctionsTab.messages.errorLoadingData'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  useEffect(() => {
    const timer = setInterval(() => {
      const next: Record<number, string> = {};

      auctions.forEach((auction) => {
        if (auction.status === 'active') {
          const diff = new Date(auction.endtime).getTime() - Date.now();
          if (diff <= 0) {
            next[auction.id] = t('supplier.auctionsTab.status.ended');
          } else {
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            next[auction.id] =
              `${h.toString().padStart(2, '0')}:` +
              `${m.toString().padStart(2, '0')}:` +
              `${s.toString().padStart(2, '0')}`;
          }
        }
      });

      setTimeRemaining(next);
    }, 1000);

    return () => clearInterval(timer);
  }, [auctions, t]);

  const categories = Array.from(new Set(auctions.map(a => a.categoryName)));

  const filteredAuctions = useMemo(() => {
    const result = auctions.filter(auction => {
      const matchesSearch =
        !searchTerm ||
        auction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        auction.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        auction.productName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        selectedStatus === 'all' || auction.status === selectedStatus;

      const matchesCategory =
        selectedCategory === 'all' || auction.categoryName === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });

    switch (sortBy) {
      case 'endingSoon':
        return [...result].sort((a, b) => new Date(a.endtime).getTime() - new Date(b.endtime).getTime());
      case 'priceLowHigh':
        return [...result].sort((a, b) => Number(a.startprice) - Number(b.startprice));
      case 'priceHighLow':
        return [...result].sort((a, b) => Number(b.startprice) - Number(a.startprice));
      case 'newest':
      default:
        return [...result].sort((a, b) => {
          const aValue = a.createdat ? new Date(a.createdat).getTime() : a.id;
          const bValue = b.createdat ? new Date(b.createdat).getTime() : b.id;
          return bValue - aValue;
        });
    }
  }, [auctions, searchTerm, selectedStatus, selectedCategory, sortBy]);

  const openCreateModal = () => {
    setEditingAuction(null);
    setFormData({
      title: '',
      idproduct: 0,
      startprice: '',
      minstep: '',
      buynowprice: '',
      starttime: '',
      endtime: '',
      vatincluded: false,
      deliveryregion: '',
      idplace: 0,
      description: ''
    });
    setShowCreateModal(true);
  };

  const openEditModal = (auction: Auction) => {
    setEditingAuction(auction);
    setFormData({
      title: auction.title,
      idproduct: auction.idproduct,
      startprice: String(auction.startprice),
      minstep: String(auction.minstep),
      buynowprice: auction.buynowprice ? String(auction.buynowprice) : '',
      starttime: auction.starttime.slice(0, 16),
      endtime: auction.endtime.slice(0, 16),
      vatincluded: auction.vatincluded,
      deliveryregion: auction.deliveryregion,
      idplace: auction.idplace,
      description: auction.description || ''
    });
    setShowCreateModal(true);
  };

  const handleViewAuction = async (auction: Auction) => {
    try {
      const data = await getSupplierAuctionBids(auction.id);

      if (data.success) {
        setBids(data.bids || []);
        setSelectedAuction(auction);
        setShowViewModal(true);
      } else {
        toast.error(data.message || t('supplier.auctionsTab.messages.errorLoadingBids'));
      }
    } catch {
      toast.error(t('supplier.auctionsTab.messages.errorLoadingBids'));
    }
  };

  const handleSaveAuction = async () => {
    if (
      !formData.title ||
      !formData.idproduct ||
      !formData.startprice ||
      !formData.minstep ||
      !formData.starttime ||
      !formData.endtime ||
      !formData.deliveryregion ||
      !formData.idplace
    ) {
      toast.error(t('supplier.auctionsTab.messages.requiredFields'));
      return;
    }

    const payload = {
      title: formData.title,
      startprice: parseFloat(formData.startprice),
      minstep: parseFloat(formData.minstep),
      buynowprice: formData.buynowprice ? parseFloat(formData.buynowprice) : null,
      starttime: formData.starttime,
      endtime: formData.endtime,
      vatincluded: formData.vatincluded,
      deliveryregion: formData.deliveryregion,
      idplace: Number(formData.idplace),
      description: formData.description,
      idproduct: Number(formData.idproduct)
    };

    try {
      const data = editingAuction
        ? await updateSupplierAuction(editingAuction.id, payload)
        : await createSupplierAuction(payload);

      if (data.success) {
        toast.success(editingAuction ? t('supplier.auctionsTab.messages.updated') : t('supplier.auctionsTab.messages.created'));
        setShowCreateModal(false);
        fetchData();
      } else {
        toast.error(data.message || t('supplier.auctionsTab.messages.saveError'));
      }
    } catch {
      toast.error(t('supplier.auctionsTab.messages.saveError'));
    }
  };

  const handleDeleteClick = (auction: Auction) => {
    setSelectedAuction(auction);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedAuction) return;

    try {
      const data = await deleteSupplierAuction(selectedAuction.id);

      if (data.success) {
        toast.success(t('supplier.auctionsTab.messages.deleted'));
        fetchData();
      } else {
        toast.error(data.message || t('supplier.auctionsTab.messages.deleteError'));
      }
    } catch {
      toast.error(t('supplier.auctionsTab.messages.deleteError'));
    } finally {
      setShowDeleteModal(false);
      setSelectedAuction(null);
    }
  };

  const handleStatusChange = async (auction: Auction, newStatus: 'draft' | 'active' | 'cancelled') => {
    try {
      const data = await updateSupplierAuctionStatus(auction.id, { status: newStatus });

      if (data.success) {
        toast.success(t('supplier.auctionsTab.messages.statusChanged'));
        fetchData();
      } else {
        toast.error(data.message || t('supplier.auctionsTab.messages.statusChangeError'));
      }
    } catch {
      toast.error(t('supplier.auctionsTab.messages.statusChangeError'));
    }
  };

  const renderAuctionStatus = (auction: Auction) => {
    if (auction.status === 'draft') {
      return <span style={chip(ui.blueGraySoft, ui.blueGray)}>{t('supplier.auctionsTab.status.draft')}</span>;
    }
    if (auction.status === 'cancelled') {
      return <span style={chip(ui.redSoft, ui.red)}>{t('supplier.auctionsTab.status.cancelled')}</span>;
    }
    if (auction.status === 'ended') {
      return <span style={chip(ui.goldSoft, ui.gold)}>{t('supplier.auctionsTab.status.ended')}</span>;
    }
    return <span style={chip(ui.greenSoft, ui.greenDark)}>{t('supplier.auctionsTab.status.active')}</span>;
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" style={{ color: ui.green }} />
        <p className="mt-3" style={{ color: ui.muted }}>{t('supplier.auctionsTab.loading')}</p>
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
                {/* <GraphUp className="me-2" style={{ color: ui.green }} /> */}
                {t('supplier.auctionsTab.myAuctions')}
              </h4>
              <div style={{ color: ui.muted }}>
                {t('supplier.auctionsTab.subtitle')}
              </div>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <span style={chip(ui.greenSoft, ui.greenDark)}>
                {t('supplier.auctionsTab.total', { count: auctions.length })}
              </span>
              <Button style={btnMain()} onClick={openCreateModal}>
                <PlusLg className="me-1" />
                {t('supplier.auctionsTab.createLot')}
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="border-0" style={{ borderRadius: 24, boxShadow: ui.shadowSoft }}>
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k || 'auctions')}
            className="supplier-subtabs mb-4"
          >
            <Tab eventKey="auctions" title={t('supplier.auctionsTab.tabAllAuctions')}>
              <div className="pt-2">
                <Row className="g-3 mb-4">
                  <Col lg={4}>
                    <InputGroup>
                      <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                        <Search style={{ color: ui.green }} />
                      </InputGroup.Text>
                      <Form.Control
                        placeholder={t('supplier.auctionsTab.searchPlaceholderFull')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ borderColor: ui.border }}
                      />
                    </InputGroup>
                  </Col>

                  <Col lg={3}>
                    <InputGroup>
                      <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                        <Filter style={{ color: ui.green }} />
                      </InputGroup.Text>
                      <Form.Select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        style={{ borderColor: ui.border }}
                      >
                        <option value="all">{t('supplier.auctionsTab.status.all')}</option>
                        <option value="draft">{t('supplier.auctionsTab.status.draftPlural')}</option>
                        <option value="active">{t('supplier.auctionsTab.status.activePlural')}</option>
                        <option value="ended">{t('supplier.auctionsTab.status.endedPlural')}</option>
                        <option value="cancelled">{t('supplier.auctionsTab.status.cancelledPlural')}</option>
                      </Form.Select>
                    </InputGroup>
                  </Col>

                  <Col lg={3}>
                    <Form.Select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      style={{ borderColor: ui.border }}
                    >
                      <option value="all">{t('supplier.auctionsTab.allCategories')}</option>
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Form.Select>
                  </Col>

                  <Col lg={2}>
                    <Form.Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      style={{ borderColor: ui.border }}
                    >
                      <option value="newest">{t('supplier.auctionsTab.sort.newest')}</option>
                      <option value="endingSoon">{t('supplier.auctionsTab.sort.endingSoon')}</option>
                      <option value="priceLowHigh">{t('supplier.auctionsTab.sort.priceLowHigh')}</option>
                      <option value="priceHighLow">{t('supplier.auctionsTab.sort.priceHighLow')}</option>
                    </Form.Select>
                  </Col>
                </Row>

                {filteredAuctions.length === 0 ? (
                  <Alert
                    style={{
                      background: ui.blueGraySoft,
                      color: ui.blueGray,
                      border: `1px solid ${ui.border}`
                    }}
                  >
                    {t('supplier.auctionsTab.noAuctions')} {t('supplier.auctionsTab.tryChangeFilters')}
                  </Alert>
                ) : (
                  <Row className="g-4">
                    {filteredAuctions.map(auction => (
                      <Col xl={6} key={auction.id}>
                        <Card className="border-0 h-100" style={{ borderRadius: 22, boxShadow: ui.shadowSoft }}>
                          <Card.Body className="d-flex flex-column">
                            <div className="d-flex align-items-start gap-3 mb-3">
                              {/* <div
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
                                <BoxSeam size={22} style={{ color: ui.greenDark }} />
                              </div> */}

                              <div className="flex-grow-1">
                                <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                                  <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                                    {t('supplier.auctionsTab.lotNumber', { number: auction.lotNumber })}
                                  </span>
                                  <span style={chip(ui.border, ui.green)}>
                                    {auction.categoryName}
                                  </span>
                                  {renderAuctionStatus(auction)}
                                  <span
                                    style={{
                                      ...chip(ui.redSoft, ui.gold),
                                      marginLeft: 'auto',
                                      fontSize: '0.95rem',
                                      padding: '0.45rem 0.8rem'
                                    }}
                                  >
                                    <Clock
                                      size={16}
                                      className="me-1"
                                      style={{ color: ui.greenDark, verticalAlign: 'middle' }}
                                    />
                                    {auction.status === 'active'
                                      ? t('supplier.auctionsTab.untilEnd', { time: timeRemaining[auction.id] || '--:--:--' })
                                      : auction.status === 'cancelled'
                                      ? t('supplier.auctionsTab.status.cancelled')
                                      : auction.status === 'ended'
                                      ? t('supplier.auctionsTab.status.ended')
                                      : t('supplier.auctionsTab.status.draft')}
                                  </span>
                                </div>

                                <div style={{ color: ui.text, fontWeight: 700 }}>
                                  {auction.title}
                                </div>
                                <div className="small" style={{ color: ui.muted }}>
                                  {auction.productName}
                                </div>
                              </div>
                            </div>

                            <div className="small mb-3" style={{ color: ui.muted }}>
                              <GeoAlt className="me-1" style={{ color: ui.green }} />
                              {t(`supplier.auctionsTab.regions.${auction.deliveryregion}`, { defaultValue: auction.deliveryregion })} • {auction.placeAddress || t('supplier.auctionsTab.placeNotSpecified')}
                            </div>

                            {auction.description && (
                              <div className="small mb-3" style={{ color: ui.muted }}>
                                {auction.description}
                              </div>
                            )}

                            <Row className="g-2 mb-3">
                              <Col xs={6}>
                                <div className="small" style={{ color: ui.muted }}>{t('supplier.auctionsTab.startPrice')}</div>
                                <div style={{ color: ui.text, fontWeight: 700 }}>
                                  {formatPrice(auction.startprice)}
                                </div>
                              </Col>
                              <Col xs={6}>
                                <div className="small" style={{ color: ui.muted }}>{t('supplier.auctionsTab.minStep')}</div>
                                <div style={{ color: ui.text, fontWeight: 700 }}>
                                  {formatPrice(auction.minstep)}
                                </div>
                              </Col>
                              <Col xs={6}>
                                <div className="small" style={{ color: ui.muted }}>{t('supplier.auctionsTab.currentBid')}</div>
                                <div style={{ color: ui.text, fontWeight: 700 }}>
                                  {auction.currentBid ? formatPrice(auction.currentBid) : t('supplier.auctionsTab.none')}
                                </div>
                              </Col>
                              <Col xs={6}>
                                <div className="small" style={{ color: ui.muted }}>{t('supplier.auctionsTab.bidsCount')}</div>
                                <div style={{ color: ui.text, fontWeight: 700 }}>
                                  {t('supplier.auctionsTab.bidsCount', { count: auction.bidsCount || 0 })}
                                </div>
                              </Col>
                            </Row>

                            {auction.buynowprice && (
                              <div className="mb-3">
                                <span style={chip(ui.goldSoft, ui.gold)}>
                                  <Trophy className="me-1" />
                                  {t('supplier.auctionsTab.buyNowPrice')}: {formatPrice(auction.buynowprice)}
                                </span>
                              </div>
                            )}

                            <div className="mt-auto d-flex gap-2 flex-wrap">
                              <Button style={btnSoft()} onClick={() => handleViewAuction(auction)}>
                                <Eye className="me-1" />
                                {t('supplier.auctionsTab.details')}
                              </Button>

                              <Button style={btnSoft()} onClick={() => openEditModal(auction)}>
                                <PencilSquare className="me-1" />
                                {t('supplier.auctionsTab.editAuction')}
                              </Button>

                              {auction.status === 'draft' && (
                                <Button style={btnMain()} onClick={() => handleStatusChange(auction, 'active')}>
                                  {t('supplier.auctionsTab.startAuction')}
                                </Button>
                              )}

                              {auction.status === 'active' && (
                                <Button
                                  style={{ ...btnSoft(), color: ui.red, borderColor: ui.red }}
                                  onClick={() => handleStatusChange(auction, 'cancelled')}
                                >
                                  {t('supplier.auctionsTab.cancelAuction')}
                                </Button>
                              )}

                              <Button style={btnDangerSoft()} onClick={() => handleDeleteClick(auction)}>
                                <Trash className="me-1" />
                                {t('supplier.auctionsTab.delete')}
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
              <Tab eventKey="" title={t('Archive')}></Tab>
          </Tabs>
        </Card.Body>
      </Card>

      {/* Модальное окно создания/редактирования */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingAuction ? t('supplier.auctionsTab.editAuction') : t('supplier.auctionsTab.createAuction')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row className="g-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label>{t('supplier.auctionsTab.lotTitle')} *</Form.Label>
                  <Form.Control
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t('supplier.auctionsTab.lotTitlePlaceholder')}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>{t('supplier.auctionsTab.product')} *</Form.Label>
                  <Form.Select
                    value={formData.idproduct}
                    onChange={(e) => setFormData({ ...formData, idproduct: Number(e.target.value) })}
                    disabled={!!editingAuction}
                  >
                    <option value={0}>{t('supplier.auctionsTab.selectProduct')}</option>
                    {products.map(product => (
                      <option key={product.id} value={product.productId}>
                        {product.productName} — {product.categoryName}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>{t('supplier.auctionsTab.place')} *</Form.Label>
                  <Form.Select
                    value={formData.idplace}
                    onChange={(e) => setFormData({ ...formData, idplace: Number(e.target.value) })}
                  >
                    <option value={0}>{t('supplier.auctionsTab.selectPlace')}</option>
                    {places.map(place => (
                      <option key={place.id} value={place.id}>
                        {place.address}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label>{t('supplier.auctionsTab.startPriceRub')} *</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.startprice}
                    onChange={(e) => setFormData({ ...formData, startprice: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label>{t('supplier.auctionsTab.minStepRub')} *</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.minstep}
                    onChange={(e) => setFormData({ ...formData, minstep: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label>{t('supplier.auctionsTab.buyNowPriceRub')} ({t('supplier.auctionsTab.optional')})</Form.Label>
                  <Form.Control
                    type="number"
                    value={formData.buynowprice}
                    onChange={(e) => setFormData({ ...formData, buynowprice: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>{t('supplier.auctionsTab.startDateTime')} *</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={formData.starttime}
                    onChange={(e) => setFormData({ ...formData, starttime: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>{t('supplier.auctionsTab.endDateTime')} *</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={formData.endtime}
                    onChange={(e) => setFormData({ ...formData, endtime: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>{t('supplier.auctionsTab.deliveryRegion')} *</Form.Label>
                  <Form.Select
                    value={formData.deliveryregion}
                    onChange={(e) => setFormData({ ...formData, deliveryregion: e.target.value })}
                  >
                    <option value="">{t('supplier.auctionsTab.selectRegion')}</option>
                    {regions.map(region => (
                      <option key={region} value={region}>
                        {t(`supplier.auctionsTab.regions.${region}`, { defaultValue: region })}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6} className="d-flex align-items-end">
                <Form.Check
                  type="checkbox"
                  id="vatincluded"
                  label={t('supplier.auctionsTab.withVat')}
                  checked={formData.vatincluded}
                  onChange={(e) => setFormData({ ...formData, vatincluded: e.target.checked })}
                />
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label>{t('supplier.auctionsTab.description')}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowCreateModal(false)}>
            {t('supplier.auctionsTab.cancel')}
          </Button>
          <Button style={btnMain()} onClick={handleSaveAuction}>
            {editingAuction ? t('supplier.auctionsTab.saveChanges') : t('supplier.auctionsTab.create')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Модальное окно просмотра деталей */}
      <Modal show={showViewModal} onHide={() => setShowViewModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('supplier.auctionsTab.detailsTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedAuction && (
            <>
              <Card className="border-0 mb-4" style={{ borderRadius: 18, boxShadow: ui.shadowSoft }}>
                <Card.Body>
                  <h5 style={{ color: ui.text }}>{selectedAuction.title}</h5>
                  <p className="text-muted">{t('supplier.auctionsTab.lotNumber', { number: selectedAuction.lotNumber })}</p>

                  <Row className="g-2">
                    <Col md={6}><strong>{t('supplier.auctionsTab.product')}:</strong> {selectedAuction.productName}</Col>
                    <Col md={6}><strong>{t('supplier.auctionsTab.category')}:</strong> {selectedAuction.categoryName}</Col>
                    <Col md={6}><strong>{t('supplier.auctionsTab.startLabel')}:</strong> {new Date(selectedAuction.starttime).toLocaleString('ru-RU')}</Col>
                    <Col md={6}><strong>{t('supplier.auctionsTab.endLabel')}:</strong> {new Date(selectedAuction.endtime).toLocaleString('ru-RU')}</Col>
                    <Col md={6}><strong>{t('supplier.auctionsTab.startPrice')}:</strong> {formatPrice(selectedAuction.startprice)}</Col>
                    <Col md={6}><strong>{t('supplier.auctionsTab.minStep')}:</strong> {formatPrice(selectedAuction.minstep)}</Col>
                  </Row>

                  {selectedAuction.buynowprice && (
                    <div className="mt-3">
                      <span style={chip(ui.goldSoft, ui.gold)}>
                        {t('supplier.auctionsTab.buyNowPrice')}: {formatPrice(selectedAuction.buynowprice)}
                      </span>
                    </div>
                  )}
                </Card.Body>
              </Card>

              <h6 style={{ color: ui.text }}>{t('supplier.auctionsTab.bidHistory')}</h6>
              {bids.length === 0 ? (
                <Alert
                  style={{
                    background: ui.blueGraySoft,
                    color: ui.blueGray,
                    border: `1px solid ${ui.border}`
                  }}
                >
                  {t('supplier.auctionsTab.noBidsYet')}
                </Alert>
              ) : (
                <Table striped hover size="sm" responsive>
                  <thead>
                    <tr>
                      <th>{t('supplier.auctionsTab.dateTime')}</th>
                      <th>{t('supplier.auctionsTab.participant')}</th>
                      <th className="text-end">{t('supplier.auctionsTab.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map(bid => (
                      <tr key={bid.id}>
                        <td>{new Date(bid.bidtime).toLocaleString('ru-RU')}</td>
                        <td>{bid.username}</td>
                        <td className="text-end">
                          {formatPrice(bid.bidamountwhole, bid.bidamountcopecks)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowViewModal(false)}>
            {t('supplier.auctionsTab.close')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Модальное окно удаления */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{t('supplier.auctionsTab.deleteConfirmTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedAuction && (
            <>
              <Alert
                style={{
                  background: ui.redSoft,
                  color: ui.red,
                  border: `1px solid ${ui.border}`
                }}
              >
                {t('supplier.auctionsTab.deleteConfirm')}
              </Alert>

              <div
                style={{
                  borderRadius: 16,
                  border: `1px solid ${ui.border}`,
                  background: '#faf9f7',
                  padding: '0.95rem'
                }}
              >
                <div style={{ color: ui.text, fontWeight: 700 }}>
                  {selectedAuction.title}
                </div>
                <div className="small" style={{ color: ui.muted }}>
                  {t('supplier.auctionsTab.lotNumber', { number: selectedAuction.lotNumber })}
                </div>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowDeleteModal(false)}>
            {t('supplier.auctionsTab.cancel')}
          </Button>
          <Button style={btnDangerSoft()} onClick={handleConfirmDelete}>
            {t('supplier.auctionsTab.delete')}
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

export default AuctionTab;