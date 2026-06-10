import React, { useState, useEffect, useCallback } from 'react';
import {
    Container, Row, Col, Card, Button, Spinner, Form, Badge, Tabs, Tab, Alert
} from 'react-bootstrap';
import { GeoAlt, ArrowRepeat, Map, Grid, StarFill, Leaf, Filter, Award } from 'react-bootstrap-icons';
// import FarmersMapForBuyer from '../components/FarmersMapForBuyer';
import DeliveryAddressModal from '../components/DeliveryAddressModal';
import RankedFarmersList from '../components/RankedFarmersList';
import { toast } from 'react-toastify';
import FarmersMapForBuyer from '../components/FarmersMapForBuyer';

// Стилизованные компоненты с современным дизайном
const styles = {
    gradientHeader: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '15px',
        padding: '2rem',
        marginBottom: '2rem',
        color: 'white'
    },
    statCard: {
        background: 'white',
        borderRadius: '15px',
        padding: '1.5rem',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        cursor: 'pointer',
        border: '1px solid #e0e0e0'
    },
    filterCard: {
        background: 'white',
        borderRadius: '15px',
        padding: '1rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    },
    farmerCard: {
        background: 'white',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '0.75rem',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        border: '1px solid #f0f0f0'
    }
};

interface CustomerPageModernProps {
    user: {
        userId: number;
        name: string;
        login: string;
        role: string;
        roleId: number;
    };
}

interface UserLocation {
    lat: number;
    lng: number;
    address: string;
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
    ecoCertificate?: boolean;
    description?: string;
    avatar?: string;
}

interface RankedPlace {
    placeId: number;
    farmerId: number;
    farmerName: string;
    rating: number;
    distance: number;
    address: string;
    is_subscribed: boolean;
    clusterId: number;
    clusterRank: number;
    clusterRankColor: string;
    individualScore: number;
}

const FarmersPlacesBuyerPage: React.FC<CustomerPageModernProps> = () => {
    const [loading, setLoading] = useState<boolean>(true);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [allFarmers, setAllFarmers] = useState<RankedFarmer[]>([]);
    const [allPlaces, setAllPlaces] = useState<RankedPlace[]>([]);
    const [filteredFarmers, setFilteredFarmers] = useState<RankedFarmer[]>([]);
    const [favorites, setFavorites] = useState<Set<number>>(new Set());
    const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
    const [showRecommendedPlots, setShowRecommendedPlots] = useState(false);
    const [activeTab, setActiveTab] = useState<'ranked' | 'unranked'>('ranked');
    const [stats, setStats] = useState({
        farmersCount: 0,
        productsCount: 0,
        categoriesCount: 0,
        avgRating: 0
    });

    // Фильтры
    const [filters, setFilters] = useState({
        categoryId: null as number | null,
        minRating: 0,
        maxDistance: 10000,
        ecoOnly: false,
        searchQuery: ''
    });

    // Загрузка данных
    const fetchData = useCallback(async () => {
        if (!userLocation) return;
        
        try {
            setLoading(true);
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
                    filters: {
                        minRating: filters.minRating,
                        maxDistance: filters.maxDistance,
                        calculateDistance: true,
                        ecoOnly: filters.ecoOnly
                    }
                })
            });
            
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Ошибка загрузки');
            
            setAllFarmers(data.allFarmers || []);
            setAllPlaces(data.allPlaces || []);
            applyFilters(data.allFarmers || [], data.allPlaces || []);
        } catch (error: any) {
            console.error('[FarmersPlacesBuyerPage] fetch error:', error);
            toast.error(error.message || 'Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    }, [userLocation, filters.minRating, filters.maxDistance, filters.ecoOnly]);

    // Применение фильтров
    const applyFilters = (farmers: RankedFarmer[], places: RankedPlace[]) => {
        let filtered = [...farmers];
        
        // Поиск
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            filtered = filtered.filter(f => 
                f.name.toLowerCase().includes(query) ||
                f.bestPlaceAddress?.toLowerCase().includes(query)
            );
        }
        
        // Рейтинг
        filtered = filtered.filter(f => f.rating >= filters.minRating);
        
        // Эко-сертификат
        if (filters.ecoOnly) {
            filtered = filtered.filter(f => f.ecoCertificate);
        }
        
        setFilteredFarmers(filtered);
    };

    // Загрузка статистики
    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('userToken');
            const response = await fetch('http://localhost:5000/api/buyer/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
                // Рассчитываем средний рейтинг
                const avg = allFarmers.reduce((sum, f) => sum + (f.rating || 0), 0) / (allFarmers.length || 1);
                setStats(prev => ({ ...prev, avgRating: avg }));
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    // Загрузка адреса
    const fetchAddress = async () => {
        try {
            const token = localStorage.getItem('userToken');
            const response = await fetch('http://localhost:5000/api/buyer/delivery-address', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();
            const addressStr = typeof data.address === 'string'
                ? data.address
                : data.address?.deliveryaddress ?? null;
                
            if (data.success && addressStr) {
                let lat = 55.7558, lng = 37.6173;
                if (addressStr.includes(',')) {
                    const parts = addressStr.split(',').map((s: string) => parseFloat(s.trim()));
                    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                        lat = parts[0];
                        lng = parts[1];
                    }
                }
                setUserLocation({ address: addressStr, lat, lng });
            }
        } catch (error) {
            console.error('Error fetching address:', error);
        }
    };

    // Загрузка избранного
    const loadFavorites = () => {
        const saved = localStorage.getItem('favoriteFarmers');
        if (saved) setFavorites(new Set(JSON.parse(saved)));
    };

    useEffect(() => {
        const init = async () => {
            await fetchAddress();
            await fetchStats();
            loadFavorites();
        };
        init();
    }, []);

    useEffect(() => {
        if (userLocation) {
            fetchData();
        }
    }, [userLocation, fetchData]);

    useEffect(() => {
        applyFilters(allFarmers, allPlaces);
    }, [filters.searchQuery, filters.minRating, filters.ecoOnly, allFarmers]);

    const handleAddressSaved = async (address: string, lat: number, lng: number) => {
        setUserLocation({ address, lat, lng });
        setShowAddressModal(false);
        toast.success('Адрес доставки сохранен');
    };

    const toggleFavorite = (farmerId: number, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setFavorites(prev => {
            const newSet = new Set(prev);
            if (newSet.has(farmerId)) {
                newSet.delete(farmerId);
                toast.info('Фермер удален из избранного');
            } else {
                newSet.add(farmerId);
                toast.success('Фермер добавлен в избранное');
            }
            localStorage.setItem('favoriteFarmers', JSON.stringify(Array.from(newSet)));
            return newSet;
        });
    };

    const handleRefresh = () => {
        fetchData();
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return '#28a745';
        if (score >= 60) return '#ffc107';
        if (score >= 40) return '#fd7e14';
        return '#dc3545';
    };

    if (loading && !allFarmers.length) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
                <Spinner animation="border" variant="primary" />
            </div>
        );
    }

    return (
        <div style={{ background: '#f8f9fa', minHeight: '100vh' }}>
            <DeliveryAddressModal 
                show={showAddressModal} 
                onHide={() => setShowAddressModal(false)} 
                onAddressSaved={handleAddressSaved} 
            />

            <Container fluid className="px-4 py-4">
                {/* Hero секция с градиентом */}
                <div style={styles.gradientHeader}>
                    <Row className="align-items-center">
                        <Col md={8}>
                            <h1 className="mb-2" style={{ fontWeight: '700' }}>
                            </h1>
                            <p className="mb-0 opacity-90">
                                Откройте для себя лучшие фермерские хозяйства рядом с вами
                            </p>
                        </Col>
                        <Col md={4} className="text-md-end mt-3 mt-md-0">
                            <Button 
                                variant="light" 
                                onClick={() => setShowAddressModal(true)}
                                className="rounded-pill px-4"
                            >
                                <GeoAlt className="me-2" />
                                {userLocation ? 'Изменить адрес' : 'Указать адрес'}
                            </Button>
                        </Col>
                    </Row>
                </div>

                {/* Статистика */}
                <Row className="mb-4">
                    <Col md={3} sm={6} className="mb-3">
                        <div style={styles.statCard}>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">Фермеров</h6>
                                    <h3 className="mb-0" style={{ fontWeight: '700', color: '#667eea' }}>
                                        {stats.farmersCount}
                                    </h3>
                                </div>
                                <div className="rounded-circle bg-primary bg-opacity-10 p-3">
                                    <Grid size={24} color="#667eea" />
                                </div>
                            </div>
                        </div>
                    </Col>
                    <Col md={3} sm={6} className="mb-3">
                        <div style={styles.statCard}>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">Продуктов</h6>
                                    <h3 className="mb-0" style={{ fontWeight: '700', color: '#764ba2' }}>
                                        {stats.productsCount}
                                    </h3>
                                </div>
                                <div className="rounded-circle" style={{ background: '#764ba220', padding: '12px' }}>
                                    <Leaf size={24} color="#764ba2" />
                                </div>
                            </div>
                        </div>
                    </Col>
                    <Col md={3} sm={6} className="mb-3">
                        <div style={styles.statCard}>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">Средний рейтинг</h6>
                                    <h3 className="mb-0" style={{ fontWeight: '700', color: '#f59e0b' }}>
                                        {stats.avgRating.toFixed(1)} ★
                                    </h3>
                                </div>
                                <div className="rounded-circle" style={{ background: '#f59e0b20', padding: '12px' }}>
                                </div>
                            </div>
                        </div>
                    </Col>
                    <Col md={3} sm={6} className="mb-3">
                        <div style={styles.statCard}>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">Категорий</h6>
                                    <h3 className="mb-0" style={{ fontWeight: '700', color: '#10b981' }}>
                                        {stats.categoriesCount}
                                    </h3>
                                </div>
                                <div className="rounded-circle" style={{ background: '#10b98120', padding: '12px' }}>
                                    <Award size={24} color="#10b981" />
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>

                {/* Фильтры */}
                <div style={styles.filterCard}>
                    <Row className="align-items-end g-3">
                        <Col md={3}>
                            <Form.Label className="text-muted small mb-1">Поиск</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Название фермера или адрес..."
                                value={filters.searchQuery}
                                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                                className="rounded-pill"
                            />
                        </Col>
                        <Col md={2}>
                            <Form.Label className="text-muted small mb-1">Мин. рейтинг</Form.Label>
                            <Form.Select
                                value={filters.minRating}
                                onChange={(e) => setFilters({ ...filters, minRating: Number(e.target.value) })}
                                className="rounded-pill"
                            >
                                <option value="0">Любой</option>
                                <option value="3">От 3.0 ★</option>
                                <option value="4">От 4.0 ★</option>
                                <option value="4.5">От 4.5 ★</option>
                            </Form.Select>
                        </Col>
                        <Col md={2}>
                            <Form.Label className="text-muted small mb-1">Расстояние</Form.Label>
                            <Form.Select
                                value={filters.maxDistance}
                                onChange={(e) => setFilters({ ...filters, maxDistance: Number(e.target.value) })}
                                className="rounded-pill"
                            >
                                <option value="25">До 25 км</option>
                                <option value="50">До 50 км</option>
                                <option value="100">До 100 км</option>
                                <option value="200">До 200 км</option>
                                <option value="500">До 500 км</option>
                                <option value="10000">Все</option>
                            </Form.Select>
                        </Col>
                        <Col md={2}>
                            <Form.Check
                                type="checkbox"
                                id="eco-only"
                                label={
                                    <span className="d-flex align-items-center gap-2">
                                        <Leaf className="text-success" size={16} />
                                        Только Эко
                                    </span>
                                }
                                checked={filters.ecoOnly}
                                onChange={(e) => setFilters({ ...filters, ecoOnly: e.target.checked })}
                            />
                        </Col>
                        <Col md={2}>
                            <Form.Check
                                type="checkbox"
                                id="show-recommended"
                                label="Показать рекомендованные участки на карте"
                                checked={showRecommendedPlots}
                                onChange={(e) => setShowRecommendedPlots(e.target.checked)}
                            />
                        </Col>
                        <Col md={1}>
                            <Button 
                                variant="outline-primary" 
                                onClick={handleRefresh}
                                className="rounded-pill w-100"
                                disabled={loading}
                            >
                                <ArrowRepeat className={loading ? 'spin' : ''} />
                            </Button>
                        </Col>
                    </Row>
                </div>

                {/* Переключатель режимов списка */}
                <div className="mb-3">
                    <div className="btn-group w-100" role="group">
                        <Button
                            variant={activeTab === 'ranked' ? 'primary' : 'outline-primary'}
                            onClick={() => setActiveTab('ranked')}
                            className="rounded-start-pill"
                        >
                            <Award className="me-2" />
                            Ранжированный список
                        </Button>
                        <Button
                            variant={activeTab === 'unranked' ? 'primary' : 'outline-primary'}
                            onClick={() => setActiveTab('unranked')}
                            className="rounded-end-pill"
                        >
                            <Grid className="me-2" />
                            Весь список
                        </Button>
                    </div>
                </div>

                {/* Основной контент */}
                <Row>
                    <Col lg={5} xl={4}>
                        <Card className="border-0 shadow-sm rounded-4 mb-4">
                            <Card.Header className="bg-white border-0 pt-4 pb-2 rounded-4">
                                <h5 className="mb-0">
                                    {activeTab === 'ranked' ? '🏆 Рейтинг фермеров' : '📋 Все фермеры'}
                                    <Badge bg="primary" className="ms-2 rounded-pill">
                                        {filteredFarmers.length}
                                    </Badge>
                                </h5>
                                {activeTab === 'ranked' && (
                                    <small className="text-muted">
                                        Отсортировано по комплексной оценке
                                    </small>
                                )}
                            </Card.Header>
                            <Card.Body className="p-3" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                {(activeTab === 'ranked' ? 
                                    [...filteredFarmers].sort((a, b) => b.individualScore - a.individualScore) :
                                    filteredFarmers
                                ).map((farmer, index) => (
                                    <div
                                        key={farmer.id}
                                        style={{
                                            ...styles.farmerCard,
                                            transform: selectedFarmer?.id === farmer.id ? 'translateX(5px)' : 'none',
                                            borderLeft: selectedFarmer?.id === farmer.id ? `4px solid ${getScoreColor(farmer.individualScore)}` : '1px solid #f0f0f0'
                                        }}
                                        onClick={() => setSelectedFarmer(farmer)}
                                    >
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <div className="flex-grow-1">
                                                <div className="d-flex align-items-center gap-2">
                                                    {activeTab === 'ranked' && (
                                                        <div 
                                                            className="rounded-circle d-flex align-items-center justify-content-center"
                                                            style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                background: getScoreColor(farmer.individualScore),
                                                                color: 'white',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            {index + 1}
                                                        </div>
                                                    )}
                                                    <h6 className="mb-0" style={{ fontWeight: '600' }}>
                                                        {farmer.name}
                                                    </h6>
                                                    {farmer.ecoCertificate && (
                                                        <Leaf size={14} className="text-success" />
                                                    )}
                                                </div>
                                                {farmer.bestPlaceAddress && (
                                                    <small className="text-muted d-block mt-1">
                                                        <GeoAlt size={12} className="me-1" />
                                                        {farmer.bestPlaceAddress.length > 40 ? 
                                                            farmer.bestPlaceAddress.substring(0, 40) + '...' : 
                                                            farmer.bestPlaceAddress}
                                                    </small>
                                                )}
                                            </div>
                                            <Button
                                                variant="link"
                                                className="p-0 text-warning text-decoration-none"
                                                onClick={(e) => toggleFavorite(farmer.id, e)}
                                            >
                                                {favorites.has(farmer.id) ? 
                                                    <StarFill size={18} /> : 
                                                    <StarFill size={18} color="#ddd" />
                                                }
                                            </Button>
                                        </div>
                                        
                                        <div className="d-flex gap-2 mt-2">
                                            {farmer.rating > 0 && (
                                                <Badge bg="warning" text="dark" className="rounded-pill">
                                                    ★ {farmer.rating.toFixed(1)}
                                                </Badge>
                                            )}
                                            {farmer.distance && (
                                                <Badge bg="info" className="rounded-pill">
                                                    📍 {farmer.distance.toFixed(1)} км
                                                </Badge>
                                            )}
                                            <Badge bg="secondary" className="rounded-pill">
                                                📦 {farmer.placesCount} участков
                                            </Badge>
                                        </div>
                                        
                                        {activeTab === 'ranked' && farmer.individualScore > 0 && (
                                            <div className="mt-2">
                                                <div className="d-flex justify-content-between small mb-1">
                                                    <span className="text-muted">Рейтинг фермера</span>
                                                    <span style={{ color: getScoreColor(farmer.individualScore), fontWeight: '600' }}>
                                                        {Math.round(farmer.individualScore)}%
                                                    </span>
                                                </div>
                                                <div className="progress" style={{ height: '4px', borderRadius: '2px' }}>
                                                    <div 
                                                        className="progress-bar" 
                                                        style={{
                                                            width: `${farmer.individualScore}%`,
                                                            background: getScoreColor(farmer.individualScore),
                                                            borderRadius: '2px'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                
                                {filteredFarmers.length === 0 && (
                                    <div className="text-center py-5">
                                        <Filter size={48} className="text-muted mb-3" />
                                        <p className="text-muted">Фермеры не найдены</p>
                                        <Button 
                                            variant="link" 
                                            onClick={() => setFilters({ ...filters, searchQuery: '', minRating: 0, ecoOnly: false })}
                                        >
                                            Сбросить фильтры
                                        </Button>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                    
                    <Col lg={7} xl={8}>
                        <Card className="border-0 shadow-sm rounded-4" style={{ height: 'calc(100vh - 350px)' }}>
                            <Card.Body className="p-0 rounded-4" style={{ overflow: 'hidden' }}>
                                <FarmersMapForBuyer 
                                    farmers={filteredFarmers}
                                    userLocation={userLocation}
                                    onFarmerClick={setSelectedFarmer}
                                    showRecommendedPlots={showRecommendedPlots}
                                    recommendedFarmers={showRecommendedPlots ? 
                                        filteredFarmers.filter(f => f.individualScore > 70) : 
                                        undefined}
                                />
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>

            <style>{`
                .spin {
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                .rounded-pill {
                    border-radius: 50px !important;
                }
                
                .rounded-4 {
                    border-radius: 20px !important;
                }
                
                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                }
                
                .btn-primary:hover {
                    background: linear-gradient(135deg, #5a67d8 0%, #6b46a0 100%);
                    transform: translateY(-1px);
                }
                
                .btn-outline-primary {
                    color: #667eea;
                    border-color: #667eea;
                }
                
                .btn-outline-primary:hover {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-color: transparent;
                }
                
                .progress {
                    background-color: #e9ecef;
                }
                
                ::-webkit-scrollbar {
                    width: 6px;
                }
                
                ::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                
                ::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 10px;
                }
                
                ::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
            `}</style>
        </div>
    );
};

export default FarmersPlacesBuyerPage;