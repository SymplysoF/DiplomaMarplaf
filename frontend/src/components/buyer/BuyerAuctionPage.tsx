import React, { useEffect, useMemo, useState } from 'react';
import {
  Container,
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
  GraphUp,
  Search,
  Filter,
  Clock,
  GeoAlt,
  Trophy,
  Eye,
  BoxSeam,
  PencilSquare,
  Trash,
  PlusLg,
  AlignEnd
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import {
  getBuyerAuctions,
  getBuyerAuctionById,
  getBuyerAuctionBids,
  placeBuyerBid,
  getBuyerMyBids,
  updateBuyerMyBid,
  deleteBuyerMyBid
} from '../../api/buyerAuctionsApi';

interface Auction {
  id: number;
  lotNumber: string;
  title: string;
  description?: string;
  idproduct: number;
  productName: string;
  categoryName: string;
  startprice: number;
  minstep: number;
  buynowprice?: number;
  starttime: string;
  endtime: string;
  createdat?: string;
  status: 'active' | 'ended' | 'cancelled';
  vatincluded: boolean;
  deliveryregion: string;
  placeAddress?: string;
  currentBid?: number;
  currentBidder?: string;
  bidsCount?: number;
}

interface Bid {
  id: number;
  bidamountwhole: number;
  bidamountcopecks: number;
  bidtime: string;
  username: string;
  iswinning: boolean;
}

interface MyBid {
  id: number;
  idauction: number;
  bidamountwhole: number;
  bidamountcopecks: number;
  bidtime: string;
  iswinning: boolean;
  title: string;
  lotnumber: string;
}

const ui = {
  navbarBg: 'rgba(255,255,255,0.88)',
  border: '#e7e2d8',
  text: '#243126',
  muted: '#6d786f',
  green: '#2f6b3a',
  greenDark: '#234f2b',
  greenSoft: '#dceadf',
  purple: '#6c56d9',
  purpleSoft: '#f1ecff',
  gold: '#9a6b00',
  goldSoft: '#fbf1d9',
  blueGray: '#44546a',
  blueGraySoft: '#eef2f7',
  red: '#c04e4e',
  redSoft: '#fdecec',
  shadow: '0 10px 28px rgba(34,49,39,0.08)'
};

const BuyerAuctionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('auctions');

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [dateFilterType, setDateFilterType] = useState<'all' | 'created' | 'start' | 'end'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [sortBy, setSortBy] = useState<
    'newest' | 'endingSoon' | 'priceLowHigh' | 'priceHighLow' | 'bidsHighLow' | 'titleAZ'
  >('newest');

  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);

  const [bids, setBids] = useState<Bid[]>([]);
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<Record<number, string>>({});
  const { t, i18n } = useTranslation();
  const dbt = (value?: string | null) => value ? t(`db.values.${value}`, { defaultValue: value }) : '—';

  const [bidAmount, setBidAmount] = useState<number>(0);

  const [editingBid, setEditingBid] = useState<MyBid | null>(null);
  const [editBidAmount, setEditBidAmount] = useState<number>(0);
  const [showEditBidModal, setShowEditBidModal] = useState(false);

  const [deletingBid, setDeletingBid] = useState<MyBid | null>(null);
  const [showDeleteBidModal, setShowDeleteBidModal] = useState(false);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      const data = await getBuyerAuctions();
      if (data.success) setAuctions(data.auctions || []);
      else toast.error(data.message || t('buyer.auctions.errorLoading'));
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBids = async () => {
    try {
      const data = await getBuyerMyBids();
      if (data.success) setMyBids(data.bids || []);
    } catch {
      toast.error(t('buyer.auctions.myBidsError'));
    }
  };

  useEffect(() => {
    fetchAuctions();
    fetchMyBids();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const next: Record<number, string> = {};

      auctions.forEach((auction) => {
        if (auction.status === 'active') {
          const diff = new Date(auction.endtime).getTime() - Date.now();

          if (diff <= 0) {
            next[auction.id] = t('buyer.auctions.ended');
          } else {
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            next[auction.id] = `${h.toString().padStart(2, '0')}:${m
              .toString()
              .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
          }
        }
      });

      setTimeRemaining(next);
    }, 1000);

    return () => clearInterval(timer);
  }, [auctions]);

  const formatPrice = (whole: number, copecks = 0) =>
    new Intl.NumberFormat(i18n.language || 'ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(whole + copecks / 100);

  const getAuctionStatusById = (auctionId: number) =>
    auctions.find(a => a.id === auctionId)?.status;

  const getAuctionByIdLocal = (auctionId: number) =>
    auctions.find(a => a.id === auctionId);

  const getAuctionDateForFilter = (auction: Auction) => {
    if (dateFilterType === 'created') return auction.createdat;
    if (dateFilterType === 'start') return auction.starttime;
    if (dateFilterType === 'end') return auction.endtime;
    return null;
  };

  const filteredAuctions = useMemo(() => {
    const result = auctions.filter(a => {
      const matchSearch =
        !searchTerm ||
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.lotNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat =
        selectedCategory === 'all' || a.categoryName === selectedCategory;

      let matchDate = true;
      if (dateFilterType !== 'all' && (dateFrom || dateTo)) {
        const sourceDate = getAuctionDateForFilter(a);
        if (!sourceDate) {
          matchDate = false;
        } else {
          const value = new Date(sourceDate).getTime();
          const fromValue = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
          const toValue = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

          if (fromValue !== null && value < fromValue) matchDate = false;
          if (toValue !== null && value > toValue) matchDate = false;
        }
      }

      return matchSearch && matchCat && matchDate;
    });

    switch (sortBy) {
      case 'endingSoon':
        return [...result].sort(
          (a, b) => new Date(a.endtime).getTime() - new Date(b.endtime).getTime()
        );

      case 'priceLowHigh':
        return [...result].sort((a, b) => Number(a.startprice) - Number(b.startprice));

      case 'priceHighLow':
        return [...result].sort((a, b) => Number(b.startprice) - Number(a.startprice));

      case 'bidsHighLow':
        return [...result].sort((a, b) => Number(b.bidsCount || 0) - Number(a.bidsCount || 0));

      case 'titleAZ':
        return [...result].sort((a, b) => a.title.localeCompare(b.title, 'ru'));

      case 'newest':
      default:
        return [...result].sort((a, b) => {
          const aDate = a.createdat ? new Date(a.createdat).getTime() : a.id;
          const bDate = b.createdat ? new Date(b.createdat).getTime() : b.id;
          return bDate - aDate;
        });
    }
  }, [auctions, searchTerm, selectedCategory, dateFilterType, dateFrom, dateTo, sortBy]);

  const categories = Array.from(new Set(auctions.map(a => a.categoryName)));

  const myLatestBids = useMemo(() => {
    const map = new Map<number, MyBid>();

    myBids.forEach((bid) => {
      const current = map.get(bid.idauction);
      if (!current) {
        map.set(bid.idauction, bid);
        return;
      }

      if (new Date(bid.bidtime).getTime() > new Date(current.bidtime).getTime()) {
        map.set(bid.idauction, bid);
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.bidtime).getTime() - new Date(a.bidtime).getTime()
    );
  }, [myBids]);

  const handlePlaceBid = async () => {
    if (!selectedAuction) return;

    try {
      const data = await placeBuyerBid(selectedAuction.id, bidAmount);

      if (data.success) {
        toast.success(t('buyer.auctions.bidAccepted'));
        setShowBidModal(false);
        await Promise.all([fetchAuctions(), fetchMyBids()]);
      } else {
        toast.error(data.message || t('common.error'));
      }
    } catch {
      toast.error(t('common.serverError'));
    }
  };

  const handleViewAuction = async (auction: Auction) => {
    setShowAuctionModal(true);

    try {
      const [auctionData, bidsData] = await Promise.all([
        getBuyerAuctionById(auction.id),
        getBuyerAuctionBids(auction.id)
      ]);

      if (auctionData.success) setSelectedAuction(auctionData.auction);
      else setSelectedAuction(auction);

      if (bidsData.success) setBids(bidsData.bids || []);
      else setBids([]);
    } catch {
      setSelectedAuction(auction);
      setBids([]);
      toast.error(t('buyer.auctions.detailsError'));
    }
  };

  const openPlaceBidModal = (auction: Auction) => {
    setSelectedAuction(auction);
    setBidAmount(
      auction.currentBid
        ? Number(auction.currentBid) + Number(auction.minstep)
        : Number(auction.startprice)
    );
    setShowBidModal(true);
  };

  const openEditBidModal = (bid: MyBid) => {
    const auction = getAuctionByIdLocal(bid.idauction);
    const currentMarketBid = auction?.currentBid ? Number(auction.currentBid) : null;
    const minStep = auction?.minstep ? Number(auction.minstep) : 1;
    const startPrice = auction?.startprice ? Number(auction.startprice) : 1;

    const suggested =
      currentMarketBid !== null ? currentMarketBid + minStep : startPrice;

    setEditingBid(bid);
    setEditBidAmount(suggested);
    setShowEditBidModal(true);
  };

  const handleUpdateBid = async () => {
    if (!editingBid) return;

    try {
      const data = await updateBuyerMyBid(editingBid.id, editBidAmount);

      if (data.success) {
        toast.success(t('buyer.auctions.bidUpdated'));
        setShowEditBidModal(false);
        setEditingBid(null);
        await Promise.all([fetchAuctions(), fetchMyBids()]);
      } else {
        toast.error(data.message || t('buyer.auctions.bidUpdateError'));
      }
    } catch {
      toast.error(t('common.serverError'));
    }
  };

  const handleDeleteBid = async () => {
    if (!deletingBid) return;

    try {
      const data = await deleteBuyerMyBid(deletingBid.id);

      if (data.success) {
        toast.success(t('buyer.auctions.bidDeleted'));
        setShowDeleteBidModal(false);
        setDeletingBid(null);
        await Promise.all([fetchAuctions(), fetchMyBids()]);
      } else {
        toast.error(data.message || t('buyer.auctions.bidDeleteError'));
      }
    } catch {
      toast.error(t('common.serverError'));
    }
  };

  const handleCreateAuction = () => {
    window.location.href = '/buyer/auctions/create';
  };

  const handleEditAuction = (auctionId: number) => {
    window.location.href = `/buyer/auctions/${auctionId}/edit`;
  };

  const tagStyle = (
    background: string,
    color: string
  ): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.32rem 0.65rem',
    borderRadius: 999,
    background,
    color,
    border: `1px solid ${ui.border}`,
    fontSize: '0.76rem',
    fontWeight: 600,
    lineHeight: 1
  });

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" style={{ color: ui.green }} />
      </div>
    );
  }

  return (
    <div style={{ background: '#f7f5f0', borderRadius: 24, padding: 4 }}>
      <Container fluid className="px-0">
        <Row className="mb-4 align-items-center">
          <Col md={7}>
            <h4 className="mb-0" style={{ color: ui.text }}>
              <GraphUp className="me-2" style={{ color: ui.green }} />
              {t('buyer.auctions.title')}
            </h4>
          </Col>

          <Col md={5} className="mt-3 mt-md-0 text-md-end">
            {/* <Button className="auction-main-btn" onClick={handleCreateAuction}>
              <PlusLg className="me-2" />
              {t('buyer.auctions.createAuction')}
            </Button> */}
          </Col>
        </Row>

        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k || 'auctions')}
          className="auction-tabs mb-4"
        >
          <Tab
            eventKey="auctions"
            title={
              <span>
                {t('buyer.auctions.allAuctions')}{' '}
                <span style={tagStyle(ui.greenSoft, ui.greenDark)}>
                  {filteredAuctions.length}
                </span>
              </span>
            }
          >
            <Card
              className="mb-4 border-0"
              style={{ boxShadow: ui.shadow, borderRadius: 20 }}
            >
              <Card.Body>
                <Row className="g-3">
                  <Col lg={4}>
                    <InputGroup>
                      <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                        <Search style={{ color: ui.green }} />
                      </InputGroup.Text>
                      <Form.Control
                        placeholder={t('buyer.auctions.searchPlaceholder')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
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
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        style={{ borderColor: ui.border }}
                      >
                        <option value="all">{t('buyer.market.allCategories')}</option>
                        {categories.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Form.Select>
                    </InputGroup>
                  </Col>

                  <Col lg={2}>
                    <Form.Select
                      value={dateFilterType}
                      onChange={e => setDateFilterType(e.target.value as 'all' | 'created' | 'start' | 'end')}
                      style={{ borderColor: ui.border }}
                    >
                      <option value="all">{t('buyer.auctions.dateAny')}</option>
                      <option value="created">{t('buyer.auctions.createdDate')}</option>
                      <option value="start">{t('buyer.auctions.startDate')}</option>
                      <option value="end">{t('buyer.auctions.endDate')}</option>
                    </Form.Select>
                  </Col>

                  <Col lg={3}>
                    <Form.Select
                      value={sortBy}
                      onChange={e => setSortBy(
                        e.target.value as
                        | 'newest'
                        | 'endingSoon'
                        | 'priceLowHigh'
                        | 'priceHighLow'
                        | 'bidsHighLow'
                        | 'titleAZ'
                      )}
                      style={{ borderColor: ui.border }}
                    >
                      <option value="newest">{t('buyer.auctions.sortNewest')}</option>
                      <option value="endingSoon">{t('buyer.auctions.sortEndingSoon')}</option>
                      <option value="priceLowHigh">{t('buyer.auctions.sortPriceLowHigh')}</option>
                      <option value="priceHighLow">{t('buyer.auctions.sortPriceHighLow')}</option>
                      <option value="bidsHighLow">{t('buyer.auctions.sortBidsHighLow')}</option>
                      <option value="titleAZ">{t('buyer.auctions.sortTitleAZ')}</option>
                    </Form.Select>
                  </Col>

                  {dateFilterType !== 'all' && (
                    <>
                      <Col md={3}>
                        <Form.Control
                          type="date"
                          value={dateFrom}
                          onChange={e => setDateFrom(e.target.value)}
                          style={{ borderColor: ui.border }}
                        />
                      </Col>

                      <Col md={3}>
                        <Form.Control
                          type="date"
                          value={dateTo}
                          onChange={e => setDateTo(e.target.value)}
                          style={{ borderColor: ui.border }}
                        />
                      </Col>

                      <Col md={3}>
                        <Button
                          className="auction-outline-btn w-100"
                          onClick={() => {
                            setDateFilterType('all');
                            setDateFrom('');
                            setDateTo('');
                          }}
                        >
                          {t('buyer.auctions.resetDate')}
                        </Button>
                      </Col>
                    </>
                  )}
                </Row>
              </Card.Body>
            </Card>

            {filteredAuctions.length === 0 ? (
              <Alert
                className="text-center"
                style={{
                  background: ui.blueGraySoft,
                  color: ui.blueGray,
                  border: `1px solid ${ui.border}`
                }}
              >
                {t('buyer.auctions.noAuctions')}
              </Alert>
            ) : (
              <Row className="g-4">
                {filteredAuctions.map(auction => (
                  <Col key={auction.id} xl={6} lg={6} md={12}>
                    <Card
                      className="h-100 border-0"
                      style={{ boxShadow: ui.shadow, borderRadius: 20 }}
                    >
                      <Card.Body className="d-flex flex-column">
                        <div className="d-flex align-items-start gap-2 mb-3">
                          <BoxSeam size={32} style={{ color: ui.green }} className="mt-1" />
                          <div className="flex-grow-1">
                            <h5 className="mb-1" style={{ color: ui.text }}>{auction.title}
                              <span className='ms-3' style={tagStyle(ui.blueGraySoft, ui.blueGray)}>
                                №{auction.lotNumber}
                              </span>

                            </h5>

                            <div className="mb-2 d-flex flex-wrap gap-2">
                              <span style={tagStyle(ui.border, ui.green)}>
                                {dbt(auction.categoryName)}
                              </span>

                              {myLatestBids.some(b => b.idauction === auction.id) && (
                                <span style={tagStyle(ui.greenSoft, ui.greenDark)}>
                                  {t('buyer.auctions.bidPlaced')}
                                </span>
                              )}
                              <span style={tagStyle(ui.redSoft, ui.gold)}>
                                <div className="mt-1 small" style={{ color: ui.muted }}>
                                  <Clock size={14} className="me-1" style={{ color: ui.muted }} />
                                  {auction.status === 'active'
                                    ? `${t('buyer.auctions.untilEnd')}: ${timeRemaining[auction.id] || '--:--:--'}`
                                    : auction.status === 'cancelled'
                                      ? t('buyer.auctions.cancelled')
                                      : t('buyer.auctions.ended')}
                                </div>
                              </span>
                            </div>

                            <div className="small" style={{ color: ui.muted }}>
                              <GeoAlt size={12} className="me-1" style={{ color: ui.green }} />
                              {auction.deliveryregion} • {auction.placeAddress || t('common.noAddress')}
                            </div>

                            {auction.createdat && (
                              <div className="mt-1 small" style={{ color: ui.muted }}>
                                {t('buyer.auctions.created')}: {new Date(auction.createdat).toLocaleDateString(i18n.language || 'ru-RU')}
                              </div>
                            )}

                            {auction.description && (
                              <div className="mt-2 small" style={{ color: ui.muted }}>
                                {auction.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-auto">
                          <Row className="g-2 mb-3">
                            <Col xs={6}>
                              <div className="small" style={{ color: ui.muted }}>{t('buyer.auctions.startPrice')}</div>
                              <div className="fw-semibold" style={{ color: ui.text }}>
                                {formatPrice(auction.startprice)}
                              </div>
                            </Col>

                            <Col xs={6}>
                              <div className="small" style={{ color: ui.muted }}>{t('buyer.auctions.step')}</div>
                              <div className="fw-semibold" style={{ color: ui.text }}>
                                {formatPrice(auction.minstep)}
                              </div>
                            </Col>

                            <Col xs={6}>
                              <div className="small" style={{ color: ui.muted }}>{t('buyer.auctions.currentBid')}</div>
                              <div className="fw-semibold" style={{ color: ui.text }}>
                                {auction.currentBid !== undefined && auction.currentBid !== null
                                  ? formatPrice(Number(auction.currentBid))
                                  : t('buyer.auctions.none')}
                              </div>
                            </Col>

                            <Col xs={6}>
                              <div className="small" style={{ color: ui.muted }}>{t('buyer.auctions.bids')}</div>
                              <div className="fw-semibold" style={{ color: ui.text }}>
                                {auction.bidsCount || 0}
                              </div>
                            </Col>
                          </Row>

                          {auction.buynowprice && (
                            <div className="mb-3">
                              <span style={tagStyle(ui.goldSoft, ui.gold)}>
                                <Trophy className="me-1" />
                                {t('buyer.auctions.buyNow')}: {formatPrice(auction.buynowprice)}
                              </span>
                            </div>
                          )}

                          <div className="d-flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              className="auction-outline-btn"
                              onClick={() => handleViewAuction(auction)}
                            >
                              <Eye size={14} className="me-1" />
                              {t('buyer.auctions.details')}
                            </Button>

                            <Button
                              size="sm"
                              className="auction-outline-btn"
                              onClick={() => handleEditAuction(auction.id)}
                            >
                              <PencilSquare size={14} className="me-1" />
                              {t('common.edit')}
                            </Button>

                            {/* {auction.status === 'active' && (
                              <Button
                                size="sm"
                                className="auction-main-btn"
                                onClick={() => openPlaceBidModal(auction)}
                              >
                                {t('buyer.auctions.placeBid')}
                              </Button>
                            )} */}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Tab>

          <Tab
            eventKey="my-bids"
            title={
              <span>
                {t('buyer.auctions.myBids')}{' '}
                <span style={tagStyle(ui.greenSoft, ui.greenDark)}>
                  {myLatestBids.length}
                </span>
              </span>
            }
          >
            <Card
              className="border-0"
              style={{ boxShadow: ui.shadow, borderRadius: 20 }}
            >
              <Card.Body>
                <Row className="mb-3">
                  <Col md={8}>
                    <h5 className="mb-0" style={{ color: ui.text }}>{t('buyer.auctions.myBids')}</h5>
                  </Col>

                  <Col md={4} className="mt-3 mt-md-0">
                    <div className="d-flex justify-content-md-end gap-2 flex-wrap">
                      <span style={tagStyle(ui.greenSoft, ui.greenDark)}>
                        {t('buyer.auctions.total')}: {myLatestBids.length}
                      </span>

                      <span style={tagStyle(ui.greenSoft, ui.greenDark)}>
                        {t('buyer.auctions.winningBid')}: {myLatestBids.filter(b => b.iswinning).length}
                      </span>
                    </div>
                  </Col>
                </Row>

                {myLatestBids.length === 0 ? (
                  <Alert
                    className="mb-0"
                    style={{
                      background: ui.blueGraySoft,
                      color: ui.blueGray,
                      border: `1px solid ${ui.border}`
                    }}
                  >
                    {t('buyer.auctions.noMyBids')}
                  </Alert>
                ) : (
                  <Table responsive hover className="align-middle mb-0">
                    <thead>
                      <tr>
                        <th>{t('buyer.auctions.lot')}</th>
                        <th>{t('buyer.auctions.myBid')}</th>
                        <th>{t('buyer.auctions.currentPrice')}</th>
                        <th>{t('buyer.auctions.status')}</th>
                        <th>{t('buyer.auctions.time')}</th>
                        <th className="text-end">{t('buyer.auctions.actions')}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {myLatestBids.map((bid) => {
                        const auction = getAuctionByIdLocal(bid.idauction);
                        const auctionStatus = getAuctionStatusById(bid.idauction);
                        const canManage = auctionStatus === 'active';

                        return (
                          <tr key={bid.id}>
                            <td>
                              <div className="fw-semibold" style={{ color: ui.text }}>{dbt(bid.title)}</div>
                              <div className="small" style={{ color: ui.muted }}>№{bid.lotnumber}</div>
                            </td>

                            <td>{formatPrice(bid.bidamountwhole, bid.bidamountcopecks)}</td>

                            <td>
                              {auction?.currentBid !== undefined && auction?.currentBid !== null
                                ? formatPrice(Number(auction.currentBid))
                                : '—'}
                            </td>

                            <td>
                              {bid.iswinning ? (
                                <span style={tagStyle(ui.goldSoft, ui.gold)}>
                                  <Trophy className="me-1" />
                                  {t('buyer.auctions.leading')}
                                </span>
                              ) : (
                                <span style={tagStyle(ui.blueGraySoft, ui.blueGray)}>
                                  {t('buyer.auctions.notLeading')}
                                </span>
                              )}

                              <div className="small mt-1" style={{ color: ui.muted }}>
                                {auctionStatus === 'active'
                                  ? `${t('buyer.auctions.untilEnd')}: ${timeRemaining[bid.idauction] || '--:--:--'}`
                                  : auctionStatus === 'cancelled'
                                    ? t('buyer.auctions.cancelledShort')
                                    : t('buyer.auctions.ended')}
                              </div>
                            </td>

                            <td>{new Date(bid.bidtime).toLocaleString(i18n.language || 'ru-RU')}</td>

                            <td className="text-end">
                              <div className="d-inline-flex gap-2">
                                <Button
                                  size="sm"
                                  className="auction-icon-btn"
                                  onClick={() =>
                                    auction
                                      ? handleViewAuction(auction)
                                      : handleViewAuction({
                                        id: bid.idauction,
                                        lotNumber: bid.lotnumber,
                                        title: bid.title,
                                        description: '',
                                        idproduct: 0,
                                        productName: '',
                                        categoryName: '',
                                        startprice: 0,
                                        minstep: 1,
                                        starttime: '',
                                        endtime: '',
                                        status: 'active',
                                        vatincluded: false,
                                        deliveryregion: '',
                                        currentBid: 0
                                      })
                                  }
                                >
                                  <Eye size={14} />
                                </Button>

                                <Button
                                  size="sm"
                                  className="auction-icon-btn"
                                  disabled={!canManage}
                                  onClick={() => openEditBidModal(bid)}
                                >
                                  <PencilSquare size={14} />
                                </Button>

                                <Button
                                  size="sm"
                                  className="auction-danger-btn"
                                  disabled={!canManage}
                                  onClick={() => {
                                    setDeletingBid(bid);
                                    setShowDeleteBidModal(true);
                                  }}
                                >
                                  <Trash size={14} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>

        <Modal show={showBidModal} onHide={() => setShowBidModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>{t('buyer.auctions.bidModalTitle')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedAuction && (
              <Form>
                <div className="mb-3">
                  <div className="fw-semibold">{selectedAuction.title}</div>
                  <div className="text-muted small">{t('buyer.auctions.lot')} №{selectedAuction.lotNumber}</div>
                </div>

                <Form.Group>
                  <Form.Label>{t('buyer.auctions.yourBidRub')}</Form.Label>
                  <Form.Control
                    type="number"
                    value={bidAmount}
                    onChange={e => setBidAmount(Number(e.target.value))}
                    step={selectedAuction.minstep}
                  />
                  <Form.Text className="text-muted">
                    {t('buyer.auctions.minStep')}: {formatPrice(selectedAuction.minstep)}
                  </Form.Text>
                </Form.Group>
              </Form>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button className="auction-outline-btn" onClick={() => setShowBidModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="auction-main-btn" onClick={handlePlaceBid}>
              {t('buyer.auctions.confirm')}
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal show={showEditBidModal} onHide={() => setShowEditBidModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>{t('buyer.auctions.editBidTitle')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editingBid && (
              <Form>
                <div className="mb-3">
                  <div className="fw-semibold">{editingBid.title}</div>
                  <div className="text-muted small">{t('buyer.auctions.lot')} №{editingBid.lotnumber}</div>
                </div>

                <Form.Group>
                  <Form.Label>{t('buyer.auctions.newBidAmountRub')}</Form.Label>
                  <Form.Control
                    type="number"
                    value={editBidAmount}
                    onChange={e => setEditBidAmount(Number(e.target.value))}
                  />
                  <Form.Text className="text-muted">
                    {t('buyer.auctions.updateBidHint')}
                  </Form.Text>
                </Form.Group>
              </Form>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button className="auction-outline-btn" onClick={() => setShowEditBidModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="auction-main-btn" onClick={handleUpdateBid}>
              {t('common.save')}
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal show={showDeleteBidModal} onHide={() => setShowDeleteBidModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>{t('buyer.auctions.deleteBidTitle')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {deletingBid && (
              <>
                {t('buyer.auctions.deleteBidConfirm')}{' '}
                <strong>{deletingBid.title}</strong>?
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button className="auction-outline-btn" onClick={() => setShowDeleteBidModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="auction-danger-btn" onClick={handleDeleteBid}>
              {t('common.delete')}
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal show={showAuctionModal} onHide={() => setShowAuctionModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>{t('buyer.auctions.detailsTitle')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedAuction && (
              <>
                <h5>{selectedAuction.title}</h5>
                <p className="text-muted mb-2">№{selectedAuction.lotNumber}</p>

                <Row className="g-2">
                  <Col md={6}>
                    <strong>{t('buyer.auctions.product')}:</strong> {selectedAuction.productName || '—'}
                  </Col>
                  <Col md={6}>
                    <strong>{t('buyer.auctions.category')}:</strong> {selectedAuction.categoryName || '—'}
                  </Col>
                </Row>

                <Row className="g-2 mt-1">
                  <Col md={6}>
                    <strong>{t('buyer.auctions.start')}:</strong>{' '}
                    {selectedAuction.starttime
                      ? new Date(selectedAuction.starttime).toLocaleString(i18n.language || 'ru-RU')
                      : '—'}
                  </Col>
                  <Col md={6}>
                    <strong>{t('buyer.auctions.end')}:</strong>{' '}
                    {selectedAuction.endtime
                      ? new Date(selectedAuction.endtime).toLocaleString(i18n.language || 'ru-RU')
                      : '—'}
                  </Col>
                </Row>

                <hr />
                <h6>{t('buyer.auctions.bidHistory')}</h6>

                {bids.length === 0 ? (
                  <Alert
                    className="mb-0"
                    style={{
                      background: ui.blueGraySoft,
                      color: ui.blueGray,
                      border: `1px solid ${ui.border}`
                    }}
                  >
                    {t('buyer.auctions.noBidsYet')}
                  </Alert>
                ) : (
                  <Table striped hover size="sm" responsive>
                    <thead>
                      <tr>
                        <th>{t('buyer.auctions.time')}</th>
                        <th>{t('buyer.auctions.participant')}</th>
                        <th>{t('buyer.auctions.amount')}</th>
                        <th>{t('buyer.auctions.status')}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {bids.map(b => (
                        <tr key={b.id}>
                          <td>{new Date(b.bidtime).toLocaleString(i18n.language || 'ru-RU')}</td>
                          <td>{b.username}</td>
                          <td>{formatPrice(b.bidamountwhole, b.bidamountcopecks)}</td>
                          <td>
                            {b.iswinning ? (
                              <span style={tagStyle(ui.goldSoft, ui.gold)}>
                                {t('buyer.auctions.winning')}
                              </span>
                            ) : (
                              <span style={tagStyle(ui.blueGraySoft, ui.blueGray)}>
                                {t('buyer.auctions.normal')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </>
            )}
          </Modal.Body>
        </Modal>
      </Container>

      <style>{`
        .auction-tabs.nav-tabs {
          border-bottom: none;
          gap: 10px;
          display: flex;
          flex-wrap: wrap;
        }

        .auction-tabs .nav-link {
          border: 1px solid ${ui.border};
          border-radius: 14px !important;
          color: ${ui.text};
          font-weight: 600;
          padding: 0.72rem 1rem;
          background: #fff;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .auction-tabs .nav-link:hover {
          border-color: ${ui.green};
          color: ${ui.greenDark};
          background: #fcfbf8;
        }

        .auction-tabs .nav-link.active {
          background: ${ui.green};
          color: white !important;
          border-color: ${ui.green};
          box-shadow: 0 8px 22px rgba(47, 107, 58, 0.16);
        }

        .auction-main-btn {
          background: ${ui.green} !important;
          border: 1px solid ${ui.green} !important;
          color: #fff !important;
          border-radius: 12px !important;
          font-weight: 600;
        }

        .auction-main-btn:hover,
        .auction-main-btn:focus {
          background: ${ui.greenDark} !important;
          border-color: ${ui.greenDark} !important;
          color: #fff !important;
        }

        .auction-outline-btn {
          background: #fff !important;
          border: 1px solid ${ui.green} !important;
          color: ${ui.green} !important;
          border-radius: 12px !important;
          font-weight: 600;
        }

        .auction-outline-btn:hover,
        .auction-outline-btn:focus {
          background: ${ui.greenSoft} !important;
          color: ${ui.greenDark} !important;
          border-color: ${ui.green} !important;
        }

        .auction-icon-btn {
          background: #fff !important;
          border: 1px solid ${ui.green} !important;
          color: ${ui.green} !important;
          border-radius: 12px !important;
        }

        .auction-icon-btn:hover,
        .auction-icon-btn:focus {
          background: ${ui.greenSoft} !important;
          color: ${ui.greenDark} !important;
          border-color: ${ui.green} !important;
        }

        .auction-danger-btn {
          background: #fff !important;
          border: 1px solid ${ui.red} !important;
          color: ${ui.red} !important;
          border-radius: 12px !important;
        }

        .auction-danger-btn:hover,
        .auction-danger-btn:focus {
          background: ${ui.redSoft} !important;
          color: ${ui.red} !important;
          border-color: ${ui.red} !important;
        }
      `}</style>
    </div>
  );
};

export default BuyerAuctionPage;