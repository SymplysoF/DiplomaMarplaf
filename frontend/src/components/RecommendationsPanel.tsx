import React, { useState, useEffect } from 'react';
import {
  Card,
  ListGroup,
  Badge,
  Button,
  Form,
  Row,
  Col,
  Spinner,
  Alert,
  OverlayTrigger,
  Tooltip,
  Accordion
} from 'react-bootstrap';
import {
  Star,
  StarFill,
  GeoAlt,
  ArrowUp,
  ArrowDown,
  InfoCircle,
  Filter,
  SortDown,
  SortUp,
  Person,
  Grid,
  Droplet,
  ThermometerHigh,
  Flower1,
  Tree,
  Shield,
  Leaf,
  CheckSquare,
  Square
} from 'react-bootstrap-icons';

interface RecommendationProps {
  userLocation: { lat: number; lng: number } | null;
  filters: {
    categoryId: number | null;
    minRating: number;
    maxDistance: number;
    includeUnripe: boolean;
    sortBy: string;
    subscribedOnly: boolean;
    ecoOnly: boolean;
  };
  onFilterChange: (filters: any) => void;
  onFarmerSelect: (farmerId: number) => void;
}

interface Farmer {
  id: number;
  name: string;
  rating: number;
  distance_km: number;
  distance_zone: string;
  recommendation_score: number;
  products_count: number;
  unique_categories: number;
  places: any[];
  has_eco_certificate?: boolean;
  recommendation_details: {
    distance_score: number;
    rating_score: number;
    ripeness_score: number;
    subscription_score: number;
    total_score: number;
  };
}

const RecommendationsPanel: React.FC<RecommendationProps> = ({
  userLocation,
  filters,
  onFilterChange,
  onFarmerSelect
}) => {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Загружаем рекомендации при изменении фильтров или локации
  useEffect(() => {
    if (userLocation) {
      fetchRecommendations();
    }
  }, [userLocation, filters]);

  const fetchRecommendations = async () => {
    if (!userLocation) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const response = await fetch('http://localhost:5000/api/buyer/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lat: userLocation.lat,
          lng: userLocation.lng,
          filters
        })
      });

      const data = await response.json();
      if (data.success) {
        setFarmers(data.farmers);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDetails = (farmerId: number) => {
    const newSet = new Set(expandedDetails);
    if (newSet.has(farmerId)) {
      newSet.delete(farmerId);
    } else {
      newSet.add(farmerId);
    }
    setExpandedDetails(newSet);
  };

  const getDistanceColor = (distance: number) => {
    if (distance <= 25) return 'success';
    if (distance <= 50) return 'info';
    if (distance <= 100) return 'warning';
    return 'danger';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'info';
    if (score >= 40) return 'warning';
    return 'danger';
  };

  const toggleEcoFilter = () => {
    onFilterChange({ ...filters, ecoOnly: !filters.ecoOnly });
  };

  const ecoFarmersCount = farmers.filter(f => f.has_eco_certificate).length;

  if (!userLocation) {
    return (
      <Card className="shadow-sm">
        <Card.Body className="text-center py-4">
          <GeoAlt size={48} className="text-muted mb-3" />
          <h5>Укажите адрес доставки</h5>
          <p className="text-muted">
            Чтобы получить рекомендации, укажите адрес доставки
          </p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <Card.Header className="bg-light">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="mb-0">
            <Star className="me-2 text-warning" />
            Рекомендации ({farmers.length})
          </h6>
          <Button
            variant="link"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-decoration-none"
          >
            <Filter className="me-1" size={14} />
            Фильтры
          </Button>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className="mt-3 pt-2 border-top">
            <Row className="g-2">
              <Col xs={12}>
                <Form.Check
                  type="checkbox"
                  id="eco-certificate-filter"
                  checked={filters.ecoOnly}
                  onChange={toggleEcoFilter}
                  label={
                    <span className="d-flex align-items-center gap-2">
                      {filters.ecoOnly ? (
                        <CheckSquare className="text-success" size={16} />
                      ) : (
                        <Square className="text-secondary" size={16} />
                      )}
                      <Leaf className="text-success" size={16} />
                      <span>Только фермеры с Эко-сертификатом</span>
                      {ecoFarmersCount > 0 && !filters.ecoOnly && (
                        <Badge bg="success" pill className="ms-1">
                          {ecoFarmersCount}
                        </Badge>
                      )}
                      {filters.ecoOnly && (
                        <Badge bg="success" pill className="ms-1">
                          фильтр активен
                        </Badge>
                      )}
                    </span>
                  }
                />
              </Col>
            </Row>
          </div>
        )}
      </Card.Header>

      <Card.Body style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">Загрузка рекомендаций...</p>
          </div>
        ) : farmers.length === 0 ? (
          <Alert variant="info">
            {filters.ecoOnly 
              ? "Нет фермеров с Эко-сертификатом, соответствующих выбранным фильтрам"
              : "Нет фермеров, соответствующих выбранным фильтрам"
            }
          </Alert>
        ) : (
          <ListGroup variant="flush">
            {farmers.map((farmer, index) => (
              <ListGroup.Item
                key={farmer.id}
                action
                onClick={() => onFarmerSelect(farmer.id)}
                className="position-relative"
              >
                {/* Бейдж Эко-сертификата */}
                {farmer.has_eco_certificate && (
                  <OverlayTrigger
                    placement="top"
                    overlay={<Tooltip>Эко-сертификат</Tooltip>}
                  >
                    <div className="position-absolute top-0 end-0 m-2">
                      <Badge bg="success" pill className="d-flex align-items-center gap-1">
                        <Leaf size={10} />
                        <span style={{ fontSize: '0.65rem' }}>ЭКО</span>
                      </Badge>
                    </div>
                  </OverlayTrigger>
                )}

                {/* Ранг */}
                <Badge
                  bg={index < 3 ? 'warning' : 'secondary'}
                  className="position-absolute top-0 start-0 rounded-0 rounded-top rounded-end"
                  style={{ fontSize: '0.7rem' }}
                >
                  #{index + 1}
                </Badge>

                <div className="ms-3">
                  {/* Заголовок */}
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <strong>{farmer.name}</strong>
                      {farmer.rating && (
                        <Badge bg="warning" text="dark" className="ms-2">
                          <StarFill size={10} className="me-1" />
                          {farmer.rating}
                        </Badge>
                      )}
                    </div>
                    <Badge bg={getScoreColor(farmer.recommendation_score)}>
                      {Math.round(farmer.recommendation_score)}%
                    </Badge>
                  </div>

                  {/* Расстояние */}
                  <div className="d-flex align-items-center mt-1">
                    <GeoAlt size={12} className="me-1 text-danger" />
                    <span className="small">
                      {farmer.distance_km} км
                    </span>
                    <Badge 
                      bg={getDistanceColor(farmer.distance_km)} 
                      className="ms-2"
                      style={{ fontSize: '0.6rem' }}
                    >
                      {farmer.distance_zone}
                    </Badge>
                  </div>

                  {/* Статистика */}
                  <div className="d-flex gap-2 mt-1">
                    <Badge bg="info" style={{ fontSize: '0.65rem' }}>
                      {farmer.products_count} прод.
                    </Badge>
                    <Badge bg="secondary" style={{ fontSize: '0.65rem' }}>
                      {farmer.unique_categories} кат.
                    </Badge>
                  </div>

                  {/* Кнопка деталей */}
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 mt-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDetails(farmer.id);
                    }}
                  >
                    {expandedDetails.has(farmer.id) ? (
                      <>Скрыть детали <ArrowUp size={12} /></>
                    ) : (
                      <>Показать детали <ArrowDown size={12} /></>
                    )}
                  </Button>

                  {/* Детали рекомендации */}
                  {expandedDetails.has(farmer.id) && (
                    <div className="mt-2 p-2 bg-light rounded small">
                      {farmer.has_eco_certificate && (
                        <div className="d-flex justify-content-between mb-1 text-success">
                          <span>
                            <Leaf size={12} className="me-1" />
                            Эко-сертификат:
                          </span>
                          <span className="fw-bold">Имеется</span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between">
                        <span>Расстояние:</span>
                        <span className="fw-bold">{farmer.recommendation_details.distance_score}%</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>Рейтинг:</span>
                        <span className="fw-bold">{farmer.recommendation_details.rating_score}%</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>Спелость:</span>
                        <span className="fw-bold">{Math.round(farmer.recommendation_details.ripeness_score)}%</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span>Подписка:</span>
                        <span className="fw-bold">{farmer.recommendation_details.subscription_score}%</span>
                      </div>
                      <hr className="my-1" />
                      <div className="d-flex justify-content-between fw-bold text-primary">
                        <span>Итого:</span>
                        <span>{Math.round(farmer.recommendation_score)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
};

export default RecommendationsPanel;