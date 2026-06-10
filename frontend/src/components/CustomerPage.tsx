import React, { useState, useEffect, useCallback } from 'react';
import {
    Container,
    Row,
    Col,
    Card,
    Button,
    Spinner,
    Form,
    Tabs,
    Tab
} from 'react-bootstrap';
import {
    GeoAlt,
    ArrowRepeat,
    Grid,
    Gear,
    Sliders,
    Envelope,
    GraphUp,
    Shop,
    Basket,
    BoxSeam,
    Heart,
    ClipboardData,
    BagCheck
} from 'react-bootstrap-icons';
import DeliveryAddressModal from '../components/DeliveryAddressModal';
import RankedFarmersList from '../components/RankedFarmersList';
import { toast } from 'react-toastify';
import ProductPage from './ProductPage';
import { useTranslation } from 'react-i18next';
import FarmersPlacesBuyerPage from './FarmersPlacesBuyerPage';
import OldFarmersTab from './developMode/oldFarmers';
import ProductsDeveloperPage from './ProductsDeveloperPage';
import BuyerAuctionPage from './buyer/BuyerAuctionPage';
import BuyerMarketPage from './buyer/BuyerMarketPage';
import BuyerMyPurchasesPage from './buyer/BuyerMyPurchasesPage';
import BuyerMySubscriptionsPage from './buyer/BuyerMySubscriptionsPage';
import BuyerRequestsPage from './buyer/BuyerRequestsPage';

interface CustomerPageProps {
    user: {
        userId: number;
        name: string;
        login: string;
        role: string;
        roleId: number;
    };
}

interface Stats {
    farmersCount: number;
    productsCount: number;
    categoriesCount: number;
}

interface UserLocation {
    lat: number;
    lng: number;
    address: string;
}

interface RankedPlace {
    placeId: number;
    farmerId: number;
    farmerName: string;
    rating: number;
    subscriptionScore: number;
    distance: number;
    address: string;
    is_subscribed: boolean;
    clusterId: number;
    clusterRank: number;
    clusterRankColor: string;
    individualScore: number;
}

interface RankedFarmerPlace {
    placeId: number;
    address: string;
    distance: number;
    individualScore: number;
    clusterId: number;
    productCount: number;
    productCategories?: string[];
    clusterRank: number;
}

interface RankedFarmer {
    id: number;
    name: string;
    rating: number;
    distance: number | null;
    is_subscribed: boolean;
    clusterId: number;
    clusterRank: number;
    clusterRankColor: string;
    individualScore: number;
    bestPlaceId: number | null;
    bestPlaceAddress: string | null;
    placesCount: number;
    places: RankedFarmerPlace[];
    ecoCertificate?: boolean;
}

interface ClusterFarmer {
    id: number;
    name: string;
    rating: number;
    distance: number | null;
    individualScore: number;
    is_subscribed: boolean;
    x: number;
    y: number;
    bestPlaceAddress: string | null;
    placeId: number;
}

interface RankedCluster {
    id: number;
    rank: number;
    rankScore: number;
    rankColor: string;
    size: number;
    avgDistance: number;
    avgRating: number;
    subscriptionRate: number;
    farmers: ClusterFarmer[];
}

interface ClustersResponse {
    clusters: RankedCluster[];
    characteristicDistance?: number;
    entropyWeights?: {
        distance: number;
        rating: number;
        subscription: number;
    };
}
type CustomerTabKey =
    | 'farmers'
    | 'products-dev'
    | 'products'
    | 'buyer-requests'
    | 'buyer-market'
    | 'buyer-purchases'
    | 'buyer-subscriptions'
    | 'buyer-auctions'
    | 'favorites'
    | 'statistics';

const CUSTOMER_TAB_KEY = 'customerActiveTab';

const CUSTOMER_TABS: CustomerTabKey[] = [
    'farmers',
    'products-dev',
    'products',
    'buyer-requests',
    'buyer-market',
    'buyer-purchases',
    'buyer-subscriptions',
    'buyer-auctions',
    'favorites',
    'statistics'
];

const isCustomerTab = (value: string | null): value is CustomerTabKey => {
    return !!value && CUSTOMER_TABS.includes(value as CustomerTabKey);
};
const CustomerPage: React.FC<CustomerPageProps> = ({ user }) => {
    const { t } = useTranslation();

    const [loading, setLoading] = useState<boolean>(true);
    const [clustersLoading, setClustersLoading] = useState<boolean>(false);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [farmers, setFarmers] = useState<any[]>([]);
    const [clusters, setClusters] = useState<ClustersResponse>({ clusters: [] });
    const [allFarmers, setAllFarmers] = useState<RankedFarmer[]>([]);
    const [allPlaces, setAllPlaces] = useState<RankedPlace[]>([]);
    const [favorites, setFavorites] = useState<Set<number>>(new Set());
    const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
    const [stats, setStats] = useState<Stats>({
        farmersCount: 0,
        productsCount: 0,
        categoriesCount: 0
    });
    const [developerMode, setDeveloperMode] = useState(false);
    const [activeTab, setActiveTabState] = useState<CustomerTabKey>(() => {
        const saved = sessionStorage.getItem(CUSTOMER_TAB_KEY);

        if (isCustomerTab(saved)) {
            return saved;
        }

        return 'farmers';
    });

    const setActiveTab = (tab: string | null) => {
        if (!isCustomerTab(tab)) return;

        sessionStorage.setItem(CUSTOMER_TAB_KEY, tab);
        setActiveTabState(tab);
    };
    const theme = {
        pageBg: '#f7f5f0',
        card: '#ffffff',
        border: '#e8e1d5',
        text: '#243126',
        muted: '#6d786f',
        green: '#2f6b3a',
        greenDark: '#234f2b',
        greenSoft: '#dceadf',
        purple: '#6c56d9',
        purpleSoft: '#f0ebff',
        gold: '#9a6b00',
        goldSoft: '#f8edd6',
        blueGray: '#44546a',
        blueGraySoft: '#eef2f7',
        shadow: '0 14px 36px rgba(34,49,39,0.08)',
        shadowSoft: '0 8px 22px rgba(34,49,39,0.06)'
    };

    const toggleDeveloperMode = () => {
        setDeveloperMode((prev) => !prev);
        toast.info(
            developerMode
                ? t('customer.developerModeDisabled')
                : t('customer.developerModeEnabled')
        );
    };

    const [farmersFilters, setFarmersFilters] = useState({
        categoryId: null as number | null,
        minRating: 0,
        maxDistance: 10000,
        includeUnripe: false,
        calculateDistance: true,
        ecoOnly: false
    });

    const [productsFilters, setProductsFilters] = useState({
        minRating: 0,
        maxDistance: 10000,
        calculateDistance: true,
        ecoOnly: false
    });

    const fetchClusters = useCallback(async () => {
        if (!userLocation || !farmersFilters.calculateDistance) return;

        try {
            setClustersLoading(true);
            const token = localStorage.getItem('userToken');

            const response = await fetch('http://localhost:5000/api/buyer/clustered-farmers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    filters: farmersFilters
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || t('customer.clusterLoadingError'));
            }

            setClusters(data.clusters || { clusters: [] });
            setAllFarmers(data.allFarmers || []);
            setAllPlaces(data.allPlaces || []);
        } catch (error: any) {
            console.error('[CustomerPage] fetchClusters error:', error);
            toast.error(error.message || t('customer.clusterLoadingError'));
            setClusters({ clusters: [] });
            setAllFarmers([]);
            setAllPlaces([]);
        } finally {
            setClustersLoading(false);
        }
    }, [userLocation, farmersFilters, t]);

    useEffect(() => {
        const handleToggle = () => {
            setDeveloperMode((prev) => !prev);
        };

        window.addEventListener('toggle-developer-mode', handleToggle);
        return () => window.removeEventListener('toggle-developer-mode', handleToggle);
    }, []);
    useEffect(() => {
        if (!developerMode && activeTab === 'products-dev') {
            setActiveTab('farmers');
        }
    }, [developerMode, activeTab]);
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('userToken');

                const statsResponse = await fetch('http://localhost:5000/api/buyer/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const statsData = await statsResponse.json();
                if (statsData.success) setStats(statsData.stats);

                const addressResponse = await fetch('http://localhost:5000/api/buyer/delivery-address', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const addressData = await addressResponse.json();

                const addressStr =
                    typeof addressData.address === 'string'
                        ? addressData.address
                        : addressData.address?.deliveryaddress ?? null;

                if (addressData.success && addressStr) {
                    let lat = 55.7558;
                    let lng = 37.6173;

                    if (addressStr.includes(',')) {
                        const parts = addressStr
                            .split(',')
                            .map((s: string) => parseFloat(s.trim()));

                        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                            lat = parts[0];
                            lng = parts[1];
                        }
                    }

                    setUserLocation({ address: addressStr, lat, lng });
                }

                const farmersResponse = await fetch('http://localhost:5000/api/buyer/farmers-map', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const farmersData = await farmersResponse.json();
                if (farmersData.success) setFarmers(farmersData.farmers || []);

                const savedFavorites = localStorage.getItem('favoriteFarmers');
                if (savedFavorites) setFavorites(new Set(JSON.parse(savedFavorites)));
            } catch (error) {
                console.error('[CustomerPage] initial fetch error:', error);
                toast.error(t('customer.dataLoadingError'));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [t]);

    useEffect(() => {
        if (!loading && userLocation && farmersFilters.calculateDistance) {
            fetchClusters();
        }
    }, [loading, userLocation, farmersFilters.calculateDistance, fetchClusters]);

    useEffect(() => {
        if (!loading && userLocation && farmersFilters.calculateDistance) {
            fetchClusters();
        }
    }, [
        farmersFilters.maxDistance,
        farmersFilters.minRating,
        farmersFilters.includeUnripe,
        farmersFilters.ecoOnly,
        loading,
        userLocation,
        farmersFilters.calculateDistance,
        fetchClusters
    ]);

    const handleAddressSaved = async (address: string, lat: number, lng: number) => {
        setUserLocation({ address, lat, lng });
        setShowAddressModal(false);
        toast.success(t('customer.deliveryAddressSaved'));
    };

    const handleFarmerSelect = (farmer: any) => setSelectedFarmer(farmer);

    const toggleFavorite = (farmerId: number) => {
        setFavorites((prev) => {
            const newSet = new Set(prev);

            if (newSet.has(farmerId)) {
                newSet.delete(farmerId);
                toast.info(t('customer.farmerRemovedFromFavorites'));
            } else {
                newSet.add(farmerId);
                toast.success(t('customer.farmerAddedToFavorites'));
            }

            localStorage.setItem('favoriteFarmers', JSON.stringify(Array.from(newSet)));
            return newSet;
        });
    };

    const handleRefreshClusters = () => {
        setClusters({ clusters: [] });
        setAllFarmers([]);
        setAllPlaces([]);
        fetchClusters();
    };

    if (loading) {
        return (
            <Container
                fluid
                className="d-flex justify-content-center align-items-center"
                style={{ minHeight: '70vh' }}
            >
                <Spinner animation="border" variant="primary" />
            </Container>
        );
    }

    const visibleFarmers = allFarmers.length > 0 ? allFarmers : farmers;

    const isCoordinateAddress = (address?: string) => {
        if (!address) return false;
        return /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(address);
    };

    const displayAddress = userLocation
        ? isCoordinateAddress(userLocation.address)
            ? t('customer.locationSet')
            : userLocation.address
        : '';

    const statCards = [
        { label: t('customer.stats.farmers'), value: stats.farmersCount, icon: '👨‍🌾', tone: theme.greenSoft },
        { label: t('customer.stats.products'), value: stats.productsCount, icon: '🥕', tone: theme.goldSoft },
        { label: t('customer.stats.categories'), value: stats.categoriesCount, icon: '📁', tone: theme.purpleSoft }
    ];

    return (
        <div style={{ background: theme.pageBg, minHeight: '100vh', paddingBottom: 24, overflowX: 'hidden' }}>
            <Container fluid className="px-4 px-lg-5">
                <div className="text-end mb-3">
                    <Button
                        variant={developerMode ? 'success' : 'outline-secondary'}
                        size="sm"
                        onClick={toggleDeveloperMode}
                        className="d-inline-flex align-items-center gap-2"
                        style={{ borderRadius: 12 }}
                    >
                        <Gear />
                        {developerMode
                            ? t('customer.developerModeNew')
                            : t('customer.developerMode')}
                    </Button>
                </div>

                <DeliveryAddressModal
                    show={showAddressModal}
                    onHide={() => setShowAddressModal(false)}
                    onAddressSaved={handleAddressSaved}
                />

                {!developerMode && (
                    <Card
                        className="border-0 mb-4"
                        style={{
                            borderRadius: 24,
                            boxShadow: theme.shadowSoft,
                            overflow: 'hidden'
                        }}
                    >
                        <Card.Body style={{ background: '#fff', padding: '1rem 1.15rem' }}>
                            <div className="d-flex align-items-center gap-2 mb-3">
                                <Sliders color={theme.green} />
                                <h6 className="mb-0" style={{ color: theme.text }}>
                                    {t('customer.searchSettings')}
                                </h6>
                            </div>

                            <Row className="align-items-center g-3">
                                <Col xl={2} md={4}>
                                    <Form.Check
                                        type="checkbox"
                                        id="calculate-distance"
                                        label={t('customer.calculateDistance')}
                                        checked={farmersFilters.calculateDistance}
                                        onChange={(e) =>
                                            setFarmersFilters({
                                                ...farmersFilters,
                                                calculateDistance: e.target.checked
                                            })
                                        }
                                    />
                                </Col>

                                <Col xl={2} md={4}>
                                    <Form.Select
                                        value={farmersFilters.maxDistance}
                                        onChange={(e) =>
                                            setFarmersFilters({
                                                ...farmersFilters,
                                                maxDistance: Number(e.target.value)
                                            })
                                        }
                                        style={{ borderRadius: 14 }}
                                    >
                                        <option value="25">{t('customer.distance.upTo25')}</option>
                                        <option value="50">{t('customer.distance.upTo50')}</option>
                                        <option value="100">{t('customer.distance.upTo100')}</option>
                                        <option value="200">{t('customer.distance.upTo200')}</option>
                                        <option value="500">{t('customer.distance.upTo500')}</option>
                                        <option value="10000">{t('customer.distance.all')}</option>
                                    </Form.Select>
                                </Col>

                                <Col xl={2} md={4}>
                                    <Form.Select
                                        value={farmersFilters.minRating}
                                        onChange={(e) =>
                                            setFarmersFilters({
                                                ...farmersFilters,
                                                minRating: Number(e.target.value)
                                            })
                                        }
                                        style={{ borderRadius: 14 }}
                                    >
                                        <option value="0">{t('customer.rating.any')}</option>
                                        <option value="3">{t('customer.rating.from3')}</option>
                                        <option value="4">{t('customer.rating.from4')}</option>
                                        <option value="4.5">{t('customer.rating.from45')}</option>
                                    </Form.Select>
                                </Col>

                                <Col xl={2} md={4}>
                                    <Form.Check
                                        type="checkbox"
                                        id="include-unripe"
                                        label={t('customer.includeUnripe')}
                                        checked={farmersFilters.includeUnripe}
                                        onChange={(e) =>
                                            setFarmersFilters({
                                                ...farmersFilters,
                                                includeUnripe: e.target.checked
                                            })
                                        }
                                    />
                                </Col>

                                <Col xl={2} md={4}>
                                    <Form.Check
                                        type="checkbox"
                                        id="ecoOnly"
                                        label={t('customer.ecoOnly')}
                                        checked={farmersFilters.ecoOnly}
                                        onChange={(e) =>
                                            setFarmersFilters({
                                                ...farmersFilters,
                                                ecoOnly: e.target.checked
                                            })
                                        }
                                    />
                                </Col>

                                <Col xl={2} md={12}>
                                    <div className="d-flex justify-content-xl-end gap-2">
                                        <Button
                                            variant="outline-secondary"
                                            onClick={() => setShowAddressModal(true)}
                                            style={{ borderRadius: 12 }}
                                        >
                                            {userLocation ? t('customer.changeAddress') : t('customer.setAddress')}
                                        </Button>

                                        <Button
                                            variant="outline-primary"
                                            onClick={handleRefreshClusters}
                                            disabled={clustersLoading || !userLocation}
                                            style={{ borderRadius: 12 }}
                                        >
                                            <ArrowRepeat className={clustersLoading ? 'spin' : ''} />
                                        </Button>
                                    </div>
                                </Col>
                            </Row>

                            {userLocation && (
                                <div
                                    className="mt-3"
                                    style={{
                                        background: theme.pageBg,
                                        border: `1px solid ${theme.border}`,
                                        borderRadius: 16,
                                        padding: '0.8rem 0.95rem',
                                        color: theme.muted,
                                        fontSize: '0.95rem'
                                    }}
                                >
                                    <GeoAlt className="me-2" />
                                    {displayAddress}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                )}

                <Tabs
                    activeKey={activeTab}
                    onSelect={(key) => setActiveTab(key)}
                    id="customer-tabs"
                    className="customer-tabs mb-4"
                    mountOnEnter
                    unmountOnExit
                >
                    <Tab eventKey="farmers" title={<><Grid className="me-1" /> {t('customer.tabs.farmers')}</>}>
                        <div className="pt-2">
                            {developerMode ? (
                                <FarmersPlacesBuyerPage
                                    userLocation={userLocation}
                                    allFarmers={allFarmers}
                                    mapFarmersSource={farmers}
                                    favorites={favorites}
                                    onFarmerSelect={handleFarmerSelect}
                                    onToggleFavorite={toggleFavorite}
                                    loading={clustersLoading}
                                />
                            ) : (
                                <OldFarmersTab
                                    userLocation={userLocation}
                                    farmersFilters={farmersFilters}
                                    setFarmersFilters={setFarmersFilters}
                                    clusters={clusters}
                                    clustersLoading={clustersLoading}
                                    allFarmers={allFarmers}
                                    allPlaces={allPlaces}
                                    visibleFarmers={visibleFarmers}
                                    selectedFarmer={selectedFarmer}
                                    onFarmerSelect={handleFarmerSelect}
                                    onToggleFavorite={toggleFavorite}
                                    favorites={favorites}
                                    onRefreshClusters={handleRefreshClusters}
                                />
                            )}
                        </div>
                    </Tab>

                    {developerMode && (
                        <Tab eventKey="products-dev" title={<><BoxSeam className="me-1" /> {t('customer.tabs.productsDev')}</>}>
                            <div className="pt-2">
                                <ProductsDeveloperPage
                                    userLocation={userLocation}
                                    filters={productsFilters}
                                    onFarmerSelect={handleFarmerSelect}
                                    onFilterChange={setProductsFilters}
                                />
                            </div>
                        </Tab>
                    )}

                    <Tab eventKey="products" title={<><Basket className="me-1" /> {t('customer.tabs.products')}</>}>
                        <div className="pt-2">
                            <ProductPage
                                userLocation={userLocation}
                                filters={productsFilters}
                                onFarmerSelect={handleFarmerSelect}
                                onFilterChange={setProductsFilters}
                            />
                        </div>
                    </Tab>

                    <Tab eventKey="buyer-requests" title={<><Envelope className="me-1" /> {t('customer.tabs.requests')}</>}>
                        <BuyerRequestsPage />
                    </Tab>

                    <Tab eventKey="buyer-market" title={<><Shop className="me-1" /> {t('customer.tabs.market')}</>}>
                        <BuyerMarketPage />
                    </Tab>

                    <Tab eventKey="buyer-purchases" title={<><BagCheck className="me-1" /> {t('customer.tabs.purchases')}</>}>
                        <BuyerMyPurchasesPage />
                    </Tab>

                    <Tab eventKey="buyer-subscriptions" title={<><GeoAlt className="me-1" /> {t('customer.tabs.subscriptions')}</>}>
                        <BuyerMySubscriptionsPage />
                    </Tab>

                    <Tab eventKey="buyer-auctions" title={<><GraphUp className="me-1" /> {t('customer.tabs.auctions')}</>}>
                        <BuyerAuctionPage />
                    </Tab>

                    <Tab eventKey="favorites" title={<><Heart className="me-1" /> {t('customer.tabs.favorites')}</>}>
                        <div className="pt-2">
                            <Card
                                className="border-0"
                                style={{ borderRadius: 24, boxShadow: theme.shadowSoft }}
                            >
                                <Card.Header
                                    className="border-0"
                                    style={{
                                        background: '#fff',
                                        borderTopLeftRadius: 24,
                                        borderTopRightRadius: 24,
                                        paddingTop: '1rem',
                                        paddingBottom: '0.8rem'
                                    }}
                                >
                                    <h6 className="mb-0" style={{ color: theme.green }}>
                                        {t('customer.favoriteFarmers')}
                                    </h6>
                                </Card.Header>

                                <Card.Body>
                                    <RankedFarmersList
                                        farmers={allFarmers.filter((f) => favorites.has(f.id))}
                                        allPlaces={allPlaces.filter((p) => favorites.has(p.farmerId))}
                                        onFarmerSelect={handleFarmerSelect}
                                        onToggleFavorite={toggleFavorite}
                                        favorites={favorites}
                                        ecoFilter={farmersFilters.ecoOnly}
                                    />
                                </Card.Body>
                            </Card>
                        </div>
                    </Tab>

                    <Tab eventKey="statistics" title={<><ClipboardData className="me-1" /> {t('customer.tabs.statistics')}</>}>
                        <div className="pt-2">
                            <Row className="g-4">
                                {statCards.map((stat) => (
                                    <Col md={4} key={stat.label}>
                                        <Card
                                            className="border-0 h-100"
                                            style={{
                                                borderRadius: 24,
                                                boxShadow: theme.shadowSoft
                                            }}
                                        >
                                            <Card.Body
                                                className="text-center"
                                                style={{
                                                    background: '#fff',
                                                    borderRadius: 24,
                                                    padding: '1.35rem'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: 58,
                                                        height: 58,
                                                        margin: '0 auto 14px',
                                                        borderRadius: 18,
                                                        background: stat.tone,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: 26
                                                    }}
                                                >
                                                    {stat.icon}
                                                </div>

                                                <h2
                                                    className="mb-1"
                                                    style={{ color: theme.green, fontWeight: 800 }}
                                                >
                                                    {stat.value}
                                                </h2>
                                                <p className="mb-0" style={{ color: theme.muted }}>
                                                    {stat.label}
                                                </p>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    </Tab>
                </Tabs>
            </Container>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .customer-tabs.nav-tabs {
                    border-bottom: none;
                    gap: 10px;
                    display:flex;
                    flex-wrap:wrap
                }

                .customer-tabs .nav-item {
                    margin-bottom: 0;
                }

                .customer-tabs .nav-link {
                    border: 1px solid ${theme.border};
                    border-radius: 14px !important;
                    color: ${theme.text};
                    font-weight: 600;
                    padding: 0.72rem 1rem;
                    background: #fff;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .customer-tabs .nav-link svg {
                    color: ${theme.green};
                }

                .customer-tabs .nav-link:hover {
                    border-color: ${theme.green};
                    color: ${theme.greenDark};
                    background: #fcfbf8;
                }

                .customer-tabs .nav-link.active {
                    background: ${theme.green};
                    color: white !important;
                    border-color: ${theme.green};
                    box-shadow: 0 8px 22px rgba(47, 107, 58, 0.16);
                }

                .customer-tabs .nav-link.active svg {
                    color: white !important;
                }

                .text-success {
                    color: ${theme.green} !important;
                }

                .btn-outline-primary {
                    border-color: ${theme.green};
                    color: ${theme.green};
                }

                .btn-outline-primary:hover {
                    background-color: ${theme.green};
                    border-color: ${theme.green};
                }
            `}</style>
        </div>
    );
};

export default CustomerPage;