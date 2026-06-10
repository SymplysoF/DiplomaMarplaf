import React from 'react';
import { Card, ListGroup, Badge, Button, OverlayTrigger, Tooltip, ProgressBar, Row, Col } from 'react-bootstrap';
import { 
  Star, StarFill, GeoAlt, Award, Heart, HeartFill, Person, House, BoxArrowUp, 
  Shield, Leaf 
} from 'react-bootstrap-icons';

interface RankedFarmerPlace {
  placeId: number;
  address: string;
  distance: number;
  productCount: number;
  productCategories?: string[];
  individualScore: number;
  clusterId: number;
  clusterRank: number;
}

interface RankedFarmer {
  id: number;
  name: string;
  rating: number;
  distance: number | null;
  is_subscribed: boolean;
  clusterRank: number;
  clusterRankColor: string;
  individualScore: number;
  bestPlaceAddress: string | null;
  placesCount: number;
  places: RankedFarmerPlace[];
  has_eco_certificate?: boolean;
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

interface RankedFarmersListProps {
  farmers: RankedFarmer[];
  allPlaces: RankedPlace[];
  onFarmerSelect: (farmer: RankedFarmer) => void;
  onToggleFavorite: (farmerId: number) => void;
  favorites: Set<number>;
  ecoFilter?: boolean;
}

const RankedFarmersList: React.FC<RankedFarmersListProps> = ({
  farmers,
  allPlaces,
  onFarmerSelect,
  onToggleFavorite,
  favorites,
  ecoFilter = false
}) => {
  // Фильтруем фермеров по наличию Эко-сертификата если включен фильтр
  const filteredFarmers = ecoFilter 
    ? farmers.filter(f => f.has_eco_certificate === true)
    : farmers;

  const getRankBadge = (rank: number, color: string) => {
    if (rank === 1) return <Award className="text-warning me-1" size={16} />;
    return (
      <Badge bg="secondary" style={{ backgroundColor: color, fontSize: '0.7rem' }} className="me-2">
        #{rank}
      </Badge>
    );
  };

  const formatDistance = (km: number | null) => {
    if (km === null) return '—';
    if (km < 1) return `${(km * 1000).toFixed(0)} м`;
    return `${km.toFixed(1)} км`;
  };

  const PlaceholderIcon = () => <House size={20} className="text-secondary" />;

  return (
    <Card className="shadow-lg border-0">
      <Card.Header className="bg-white border-0 pt-3 pb-2">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-success fw-semibold">
            Ранжированный список фермеров
            {ecoFilter && (
              <Badge bg="success" className="ms-2">
                <Leaf className="me-1" size={12} />
                Только Эко
              </Badge>
            )}
          </h5>
          <Badge bg="success" pill>{filteredFarmers.length}</Badge>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        <ListGroup variant="flush">
          {filteredFarmers.map((farmer) => {
            const isFavorite = favorites.has(farmer.id);
            const placesSorted = [...(farmer.places || [])].sort((a, b) => b.individualScore - a.individualScore);
            return (
              <ListGroup.Item
                key={farmer.id}
                className="p-3 border-bottom"
                style={{ cursor: 'pointer', borderLeft: `4px solid ${farmer.clusterRankColor}` }}
                onClick={() => onFarmerSelect(farmer)}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1 me-2">
                    <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                      <Person className="text-success" size={20} />
                      <strong className="fs-5">{farmer.name}</strong>
                      {getRankBadge(farmer.clusterRank, farmer.clusterRankColor)}
                      
                      {/* Бейдж Эко-сертификата */}
                      {farmer.has_eco_certificate && (
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Эко-сертификат (без химических удобрений и пестицидов)</Tooltip>}
                        >
                          <Badge bg="success" pill className="d-flex align-items-center gap-1">
                            <Leaf size={12} />
                            <span style={{ fontSize: '0.7rem' }}>ЭКО</span>
                          </Badge>
                        </OverlayTrigger>
                      )}
                      
                      {farmer.is_subscribed && (
                        <Badge bg="success" pill className="d-flex align-items-center gap-1">
                          <BoxArrowUp size={12} /> Подписка
                        </Badge>
                      )}
                    </div>

                    <div className="small text-muted">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <GeoAlt size={14} />
                        <span>Лучший участок: {formatDistance(farmer.distance)}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <Star size={14} className="text-warning" />
                        <span>Рейтинг: {farmer.rating.toFixed(1)}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <House size={14} />
                        <span>Участков: {farmer.placesCount}</span>
                      </div>
                      {farmer.bestPlaceAddress && (
                        <div className="d-flex align-items-center gap-2 mb-2 text-truncate">
                          <GeoAlt size={14} />
                          <span className="text-truncate">{farmer.bestPlaceAddress}</span>
                        </div>
                      )}
                      <div className="mt-2">
                        <div className="d-flex justify-content-between small mb-1">
                          <span>Score лучшего участка</span>
                          <span>{farmer.individualScore.toFixed(1)}/100</span>
                        </div>
                        <ProgressBar
                          now={Math.min(100, Math.max(0, farmer.individualScore))}
                          variant={farmer.individualScore >= 80 ? 'success' : 'info'}
                          style={{ height: '6px' }}
                        />
                      </div>
                    </div>

                    {placesSorted.length > 0 && (
                      <div className="mt-3">
                        <div className="fw-semibold text-secondary mb-2">Участки по score:</div>
                        <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                          {placesSorted.map((place, idx) => (
                            <div key={place.placeId} className="border rounded p-2 mb-2 bg-light shadow-sm" onClick={(e) => e.stopPropagation()}>
                              <Row className="g-2 align-items-center">
                                <Col xs={2} className="text-center">
                                  <div className="d-flex align-items-center justify-content-center">
                                    <PlaceholderIcon />
                                  </div>
                                </Col>
                                <Col xs={10}>
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span className="fw-semibold">Участок #{idx + 1}</span>
                                    <Badge bg="light" text="dark" pill>score {place.individualScore.toFixed(1)}</Badge>
                                  </div>
                                  <div className="small text-muted text-truncate mt-1">{place.address}</div>
                                  <div className="small text-muted mt-1">
                                    {formatDistance(place.distance)} | Кластер #{place.clusterRank}
                                  </div>
                                  <div className="small text-muted mt-1">
                                    <span>Продуктов: {place.productCount}</span>
                                    {place.productCategories && place.productCategories.length > 0 && (
                                      <span className="ms-2 text-truncate">
                                        ({place.productCategories.slice(0, 3).join(', ')})
                                      </span>
                                    )}
                                  </div>
                                </Col>
                              </Row>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="link"
                    className="p-0"
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(farmer.id); }}
                    style={{ marginTop: '-4px' }}
                  >
                    {isFavorite ? <HeartFill className="text-danger" size={20} /> : <Heart className="text-secondary" size={20} />}
                  </Button>
                </div>
              </ListGroup.Item>
            );
          })}
          {filteredFarmers.length === 0 && (
            <ListGroup.Item className="text-center text-muted p-4">
              {ecoFilter 
                ? "Нет фермеров с Эко-сертификатом" 
                : "Нет фермеров для отображения"
              }
            </ListGroup.Item>
          )}
        </ListGroup>
      </Card.Body>
    </Card>
  );
};

export default RankedFarmersList;