import React, { useState, useMemo } from 'react';
import { Card, Badge, ListGroup, Button, Row, Col, OverlayTrigger, Tooltip, ProgressBar } from 'react-bootstrap';
import { 
  GeoAlt, Star, BoxArrowUp, ArrowDown, ArrowUp, 
  ChevronDown, ChevronRight, Award, Truck, 
  Person, Tag, Heart, GraphUp 
} from 'react-bootstrap-icons';

interface GroupedProduct {
  id: string;
  farmerId: number;
  farmerName: string;
  farmerRating: number;
  fullProductName: string;
  products: any[];
  count: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  bestPrice: any;
  avgDistance: number;
  avgProductRating: number;
  subscriptionScore: number;
  hasAuction: boolean;
  clusterId: number;
  clusterRank: number;
  clusterRankColor: string;
  clusterRankScore: number;
  groupScore: number;
}

interface GroupedProductsListProps {
  products: any[];
  onGroupSelect: (group: GroupedProduct) => void;
  onProductSelect: (product: any) => void;
  selectedGroup: any;
  expandedGroups: Set<string>;
  onToggleExpand: (groupId: string) => void;
}

const GroupedProductsList: React.FC<GroupedProductsListProps> = ({
  products,
  onGroupSelect,
  onProductSelect,
  selectedGroup,
  expandedGroups,
  onToggleExpand
}) => {
  const [sortBy, setSortBy] = useState<'clusterRank' | 'price' | 'distance' | 'farmerRating' | 'productRating'>('clusterRank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Группировка по фермеру (все продукты фермера в одной группе)
  const groups = useMemo(() => {
    const groupsMap = new Map<string, GroupedProduct>();
    
    products.forEach(p => {
      const key = `${p.farmerId}`;
      
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          id: key,
          farmerId: p.farmerId,
          farmerName: p.farmerName,
          farmerRating: p.farmerRating,
          fullProductName: p.farmerName,
          products: [],
          count: 0,
          minPrice: Infinity,
          maxPrice: -Infinity,
          avgPrice: 0,
          bestPrice: null,
          avgDistance: 0,
          avgProductRating: 0,
          subscriptionScore: p.subscriptionScore,
          hasAuction: p.locationType === 2,
          clusterId: p.clusterId,
          clusterRank: p.clusterRank,
          clusterRankColor: p.clusterRankColor,
          clusterRankScore: p.clusterRankScore || 0,
          groupScore: 0
        });
      }
      
      const g = groupsMap.get(key)!;
      g.products.push(p);
      g.count++;
      const price = p.price;
      g.minPrice = Math.min(g.minPrice, price);
      g.maxPrice = Math.max(g.maxPrice, price);
      if (!g.bestPrice || price < (g.bestPrice.price ?? Infinity)) g.bestPrice = p;
      if (p.locationType === 2) g.hasAuction = true;
      if (p.subscriptionScore) g.subscriptionScore = 1;
      // Обновляем рейтинг кластера (берём из первого продукта)
      if (p.clusterRankScore) {
        g.clusterRankScore = p.clusterRankScore;
      }
    });
    
    groupsMap.forEach(g => {
      g.avgPrice = g.products.reduce((s, p) => s + p.price, 0) / g.count;
      g.avgDistance = g.products.reduce((s, p) => s + p.distance, 0) / g.count;
      g.avgProductRating = g.products.reduce((s, p) => s + p.productRating, 0) / g.count;
      g.groupScore = Math.max(...g.products.map(p => p.computedRating || 0));
    });
    
    return Array.from(groupsMap.values());
  }, [products]);

  const getLocationTypeBadge = (locationType: number) => {
    switch (locationType) {
      case 2:
        return { text: 'Аукцион', bg: 'warning', textColor: 'dark', icon: <Award size={14} className="me-1" /> };
      case 1:
        return { text: 'Рынок', bg: 'info', textColor: 'white', icon: <Truck size={14} className="me-1" /> };
      case 3:
        return { text: 'Склад', bg: 'secondary', textColor: 'white', icon: <BoxArrowUp size={14} className="me-1" /> };
      default:
        return { text: 'Неизвестно', bg: 'light', textColor: 'dark', icon: null };
    }
  };

  const formatPrice = (price: number | undefined): string => (price || 0).toFixed(0);
  
  const formatDistance = (distance: number | undefined): string => {
    if (!distance) return '—';
    if (distance < 1) return `${(distance * 1000).toFixed(0)} м`;
    return `${distance.toFixed(1)} км`;
  };

  const formatRating = (rating: number | undefined): string => (rating || 0).toFixed(1);

  const getClusterRankBadge = (rank: number) => {
    const colors = ['success', 'info', 'warning', 'primary', 'secondary'];
    return colors[Math.min(rank - 1, colors.length - 1)] || 'secondary';
  };

  const sortGroups = (groupsToSort: GroupedProduct[]) => {
    return [...groupsToSort].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'clusterRank':
          comparison = (a.clusterRank || 999) - (b.clusterRank || 999);
          break;
        case 'price':
          comparison = (a.minPrice || 0) - (b.minPrice || 0);
          break;
        case 'distance':
          comparison = (a.avgDistance || 0) - (b.avgDistance || 0);
          break;
        case 'farmerRating':
          comparison = (b.farmerRating || 0) - (a.farmerRating || 0);
          break;
        case 'productRating':
          comparison = (b.avgProductRating || 0) - (a.avgProductRating || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const sortedGroups = sortGroups(groups);

  const SortButton = ({ sortKey, label, icon }: { sortKey: any; label: string; icon?: React.ReactNode }) => (
    <OverlayTrigger placement="top" overlay={<Tooltip>Сортировать по {label.toLowerCase()}</Tooltip>}>
      <Button size="sm" variant={sortBy === sortKey ? 'primary' : 'outline-secondary'} onClick={() => {
        if (sortBy === sortKey) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
          setSortBy(sortKey);
          setSortOrder('desc');
        }
      }} className="d-flex align-items-center gap-1">
        {icon} <span>{label}</span>
        {sortBy === sortKey && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
      </Button>
    </OverlayTrigger>
  );

  if (groups.length === 0) {
    return (
      <Card className="shadow-sm h-100">
        <Card.Body className="d-flex flex-column align-items-center justify-content-center p-5">
          <Tag size={48} className="text-muted mb-3" />
          <p className="text-muted mb-0">Нет продуктов для отображения</p>
          <small className="text-muted">Попробуйте изменить параметры фильтрации</small>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm h-100">
      <Card.Header className="bg-light py-2">
        <Row className="align-items-center g-2">
          <Col xs={12} sm={6}>
            <h6 className="mb-0 d-flex align-items-center">
              <Person className="me-2" size={16} />
              Фермеры
              <Badge bg="secondary" className="ms-2">{groups.length}</Badge>
            </h6>
          </Col>
          <Col xs={12} sm={6}>
            <div className="d-flex flex-wrap justify-content-end gap-1">
              <SortButton sortKey="clusterRank" label="Ранг" icon={<Star />} />
              <SortButton sortKey="price" label="Цена" icon={<Tag />} />
              <SortButton sortKey="distance" label="Расст" icon={<GeoAlt />} />
              <SortButton sortKey="farmerRating" label="Фермер" icon={<Person />} />
              <SortButton sortKey="productRating" label="Товар" icon={<GraphUp />} />
            </div>
          </Col>
        </Row>
      </Card.Header>
      
      <Card.Body className="p-0" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <ListGroup variant="flush">
          {sortedGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            const isSelected = selectedGroup?.id === group.id;
            const sortedProducts = [...(group.products || [])].sort((a, b) => (b.computedRating || 0) - (a.computedRating || 0));
            
            return (
              <div key={group.id}>
                <ListGroup.Item
                  className="p-3"
                  style={{ 
                    cursor: 'pointer',
                    borderLeft: `4px solid ${group.clusterRankColor || '#6c757d'}`,
                    backgroundColor: isSelected ? '#f0f7ff' : 'white'
                  }}
                  onClick={() => {
                    onGroupSelect(group);
                    if (!isExpanded) onToggleExpand(group.id);
                  }}
                >
                  <Row className="align-items-center">
                    <Col xs={1} onClick={(e) => e.stopPropagation()}>
                      <Button variant="link" size="sm" className="p-0 text-secondary" onClick={() => onToggleExpand(group.id)}>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </Button>
                    </Col>
                    
                    <Col xs={7}>
                      <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                        <Badge bg={getClusterRankBadge(group.clusterRank)} className="px-2 py-1">
                          Кластер #{group.clusterRank}
                        </Badge>
                        {group.subscriptionScore > 0 && (
                          <Badge bg="danger" className="px-2 py-1">
                            <Heart size={12} className="me-1" /> Подписка
                          </Badge>
                        )}
                        {group.hasAuction && (
                          <Badge bg="warning" text="dark" className="px-2 py-1">
                            <Award size={12} className="me-1" /> Аукцион
                          </Badge>
                        )}
                      </div>
                      <div className="d-flex align-items-center">
                        <strong className="h6 mb-0 me-2">{group.farmerName}</strong>
                        <Badge bg="light" text="dark">{group.count} {getProductWord(group.count)}</Badge>
                      </div>
                      <div className="d-flex align-items-center text-muted small mt-1">
                        <Star size={12} className="me-1 text-warning" />
                        Рейтинг фермера: {formatRating(group.farmerRating)} 
                      </div>
                    </Col>
                    
                    <Col xs={4} className="text-end">
                      <div className="mb-1">
                        <strong className="h5 text-primary">{formatPrice(group.minPrice)} ₽</strong>
                        {group.minPrice !== group.maxPrice && (
                          <small className="text-muted d-block">до {formatPrice(group.maxPrice)} ₽</small>
                        )}
                      </div>
                      <div className="d-flex justify-content-end align-items-center gap-2 mb-1">
                        <Badge 
                          bg={getClusterRankBadge(group.clusterRank)} 
                          className="px-2 py-1"
                          style={{ fontSize: '0.7rem' }}
                        >
                          Score кластера: {group.clusterRankScore?.toFixed(1)}%
                        </Badge>
                      </div>
                      <ProgressBar now={group.groupScore} variant={group.clusterRank === 1 ? 'success' : 'info'} style={{ height: '4px' }} className="mt-2" />
                      <small className="text-muted">Score группы: {group.groupScore.toFixed(1)}%</small>
                    </Col>
                  </Row>
                  
                  <Row className="mt-2 small text-muted">
                    <Col xs={4} className="d-flex align-items-center">
                      <div  className="me-1" /> {formatDistance(group.avgDistance)}
                    </Col>
                    <Col xs={4} className="d-flex align-items-center">
                      <Person size={12} className="me-1 text-warning" /> {formatRating(group.farmerRating)} 
                    </Col>
                    <Col xs={4} className="d-flex align-items-center">
                      <GraphUp size={12} className="me-1 text-info" /> {formatRating(group.avgProductRating)} 
                    </Col>
                  </Row>
                </ListGroup.Item>
                
                {isExpanded && sortedProducts.length > 0 && (
                  <ListGroup variant="flush">
                    {sortedProducts.map((product, idx) => {
                      const locationBadge = getLocationTypeBadge(product.locationType);
                      return (
                        <ListGroup.Item
                          key={`${group.id}_${idx}`}
                          className="p-3 ps-5"
                          style={{ cursor: 'pointer', backgroundColor: '#f8f9fa', borderLeft: `4px solid ${group.clusterRankColor}40` }}
                          onClick={() => onProductSelect(product)}
                        >
                          <Row>
                            <Col xs={8}>
                              <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                                <Badge bg={locationBadge.bg} text={locationBadge.textColor} className="px-2 py-1">
                                  {locationBadge.icon} {locationBadge.text}
                                </Badge>
                                <Badge bg={product.isWholesale ? 'primary' : 'success'} className="px-2 py-1">
                                  {product.isWholesale ? 'Опт' : 'Розница'}
                                </Badge>
                                {product.subscriptionScore > 0 && (
                                  <Badge bg="danger" className="px-2 py-1">
                                    <Heart size={10} className="me-1" /> Подписка
                                  </Badge>
                                )}
                              </div>
                              <div className="mb-1">
                                <strong className="h6">{formatPrice(product.price)} ₽</strong>
                                <small className="text-muted ms-2">{product.quantity} {product.unit}</small>
                              </div>
                              <div className="small text-muted mb-2">{product.fullProductName}</div>
                              <div className="small text-muted mb-2"> {product.placeAddress || 'Адрес не указан'}</div>
                              <Row className="small g-2">
                                <Col xs={6}>
                                  <div className="d-flex align-items-center">
                                    <Person size={12} className="me-1 text-warning" />
                                    Фермер: {formatRating(product.farmerRating)} ⭐
                                  </div>
                                </Col>
                                <Col xs={6}>
                                  <div className="d-flex align-items-center">
                                    <GraphUp size={12} className="me-1 text-info" />
                                    Продукт: {formatRating(product.productRating)} ⭐
                                  </div>
                                </Col>
                              </Row>
                            </Col>
                            <Col xs={4} className="text-end">
                              <div className="mb-2">
                                <Badge bg="secondary" className="px-2 py-1">
                                  В группе: #{idx + 1}
                                </Badge>
                              </div>
                              <ProgressBar now={product.computedRating} variant="success" style={{ height: '4px' }} className="mb-1" />
                              <small className="text-muted">Score: {product.computedRating?.toFixed(1)}%</small>
                              <div className="mt-2">
                                <Badge bg="light" text="dark">
                                  Дистанция: {formatDistance(product.distance)}
                                </Badge>
                              </div>
                            </Col>
                          </Row>
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                )}
              </div>
            );
          })}
        </ListGroup>
      </Card.Body>
    </Card>
  );
};

function getProductWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'товар';
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'товара';
  return 'товаров';
}

export default GroupedProductsList;