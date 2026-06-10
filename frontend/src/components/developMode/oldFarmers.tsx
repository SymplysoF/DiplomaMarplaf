import React from 'react';
import { Row, Col, Card, Button, Spinner, Form, Badge } from 'react-bootstrap';
import { ArrowRepeat, GeoAlt, Leaf, Map, People, Star } from 'react-bootstrap-icons';
import FarmersMapForBuyer from '../FarmersMapForBuyer';
import RankedClustersPanel from '../RankedClustersPanel';
import ClusterChart from '../ClusterChart';

interface OldFarmersTabProps {
    userLocation: { lat: number; lng: number; address: string } | null;
    farmersFilters: {
        categoryId: number | null;
        minRating: number;
        maxDistance: number;
        includeUnripe: boolean;
        calculateDistance: boolean;
        ecoOnly: boolean;
    };
    setFarmersFilters: (filters: any) => void;
    clusters: any;
    clustersLoading: boolean;
    allFarmers: any[];
    allPlaces: any[];
    visibleFarmers: any[];
    selectedFarmer: any;
    onFarmerSelect: (farmer: any) => void;
    onToggleFavorite: (farmerId: number) => void;
    favorites: Set<number>;
    onRefreshClusters: () => void;
}

const theme = {
    bg: '#f6f3ed',
    card: '#ffffff',
    border: '#ebe4d8',
    text: '#223127',
    muted: '#6f7a71',
    green: '#2f6b3a',
    greenDark: '#244f2b',
    greenSoft: '#dfeadf',
    greenPale: '#eef5ec',
    orange: '#d97706',
    shadow: '0 14px 35px rgba(34, 49, 39, 0.08)',
    shadowHover: '0 20px 45px rgba(34, 49, 39, 0.14)'
};

const metricCard = (icon: React.ReactNode, label: string, value: string | number, hint?: string) => (
    <Card className="border-0 h-100" style={{ borderRadius: 22, boxShadow: theme.shadow, background: theme.card }}>
        <Card.Body className="p-3">
            <div className="d-flex align-items-center gap-3">
                <div
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 16,
                        background: theme.greenSoft,
                        color: theme.green,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}
                >
                    {icon}
                </div>
                <div>
                    <div style={{ color: theme.text, fontWeight: 900, fontSize: '1.22rem', lineHeight: 1 }}>
                        {value}
                    </div>
                    <div style={{ color: theme.text, fontWeight: 800, fontSize: '0.9rem' }}>{label}</div>
                    {hint && <div style={{ color: theme.muted, fontSize: '0.78rem' }}>{hint}</div>}
                </div>
            </div>
        </Card.Body>
    </Card>
);

const OldFarmersTab: React.FC<OldFarmersTabProps> = (props) => {
    const {
        userLocation,
        farmersFilters,
        setFarmersFilters,
        clusters,
        clustersLoading,
        allFarmers,
        allPlaces,
        visibleFarmers,
        onFarmerSelect,
        favorites,
        onRefreshClusters
    } = props;

    const clusterCount = clusters?.clusters?.length || 0;
    const bestRating = visibleFarmers.length
        ? Math.max(...visibleFarmers.map((farmer: any) => Number(farmer.rating || 0))).toFixed(1)
        : '0.0';

    return (
        <div style={{ background: theme.bg, borderRadius: 28, padding: 16 }}>
            <Card className="border-0 mb-3" style={{ borderRadius: 26, boxShadow: theme.shadow }}>
                <Card.Body className="p-3 p-md-4">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div>
                            <h4 className="mt-3 mb-1" style={{ color: theme.text, fontWeight: 950 }}>
                                ранжирование фермерских участков
                            </h4>
                            <div style={{ color: theme.muted, maxWidth: 740 }}>
                                Слева показана диаграмма кластеров, справа — ранжированный список фермеров с расстоянием, рейтингом и итоговым коэффициентов.
                            </div>
                        </div>

                        <div className="d-flex flex-wrap align-items-center gap-2">
                            <Form.Check
                                type="switch"
                                id="eco-certificate-filter-farmers"
                                label={
                                    <span className="d-flex align-items-center gap-1" style={{ color: theme.greenDark, fontWeight: 800 }}>
                                        <Leaf size={15} />
                                        Эко-сертификат
                                    </span>
                                }
                                checked={farmersFilters.ecoOnly}
                                onChange={(e) => setFarmersFilters({ ...farmersFilters, ecoOnly: e.target.checked })}
                                style={{
                                    background: theme.greenPale,
                                    borderRadius: 999,
                                    padding: '0.52rem 0.85rem 0.52rem 2.6rem'
                                }}
                            />

                            <Button
                                onClick={onRefreshClusters}
                                disabled={clustersLoading}
                                style={{
                                    background: theme.green,
                                    borderColor: theme.green,
                                    borderRadius: 16,
                                    fontWeight: 800,
                                    padding: '0.58rem 0.9rem'
                                }}
                            >
                                {clustersLoading ? (
                                    <Spinner animation="border" size="sm" className="me-2" />
                                ) : (
                                    <ArrowRepeat className="me-2" />
                                )}
                                Обновить
                            </Button>
                        </div>
                    </div>
                </Card.Body>
            </Card>

            {/* <Row className="g-3 mb-3">
                <Col xl={3} sm={6}>
                    {metricCard(<People size={22} />, 'Фермеров', visibleFarmers.length, `всего в базе: ${allFarmers.length}`)}
                </Col>
                <Col xl={3} sm={6}>
                    {metricCard(<GeoAlt size={22} />, 'Участков', allPlaces.length, userLocation ? 'расстояние рассчитано' : 'укажите адрес')}
                </Col>
                <Col xl={3} sm={6}>
                    {metricCard(<Star size={22} />, 'Лучший рейтинг', bestRating, 'среди видимых фермеров')}
                </Col>
                <Col xl={3} sm={6}>
                    {metricCard(<Leaf size={22} />, 'Кластеров', clusterCount, `избранных: ${favorites.size}`)}
                </Col>
            </Row> */}

            <Row className="g-3">
                <Col xl={7} lg={7}>
                    <Card className="border-0 h-100" style={{ borderRadius: 26, boxShadow: theme.shadow, overflow: 'hidden' }}>
                        <Card.Body className="p-3">
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <div>
                                    <h5 style={{ color: theme.text, fontWeight: 950, marginBottom: 2 }}>
                                        Диаграмма кластеров
                                    </h5>
                                    <div style={{ color: theme.muted, fontSize: '0.9rem' }}>
                                        Визуальное распределение фермеров по группам
                                    </div>
                                </div>
                                {/* <Badge
                                    style={{
                                        background: theme.greenPale,
                                        color: theme.greenDark,
                                        borderRadius: 999,
                                        padding: '0.5rem 0.7rem'
                                    }}
                                >
                                    {clusterCount} кластеров
                                </Badge> */}
                            </div>

                            {clustersLoading ? (
                                <div
                                    className="d-flex align-items-center justify-content-center"
                                    style={{ minHeight: 420, background: theme.greenPale, borderRadius: 22 }}
                                >
                                    <Spinner animation="border" style={{ color: theme.green }} />
                                </div>
                            ) : (
                                <div style={{ minHeight: 420 }}>
                                    <ClusterChart clusters={clusters} onFarmerSelect={onFarmerSelect} />
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                <Col xl={5} lg={5}>
                    {clustersLoading ? (
                        <Card className="border-0 h-100" style={{ borderRadius: 26, boxShadow: theme.shadow }}>
                            <Card.Body className="d-flex align-items-center justify-content-center" style={{ minHeight: 420 }}>
                                <Spinner animation="border" style={{ color: theme.green }} />
                            </Card.Body>
                        </Card>
                    ) : (
                        <RankedClustersPanel clusters={clusters} onFarmerSelect={onFarmerSelect} />
                    )}
                </Col>
            </Row>

          
        </div>
    );
};

export default OldFarmersTab;
