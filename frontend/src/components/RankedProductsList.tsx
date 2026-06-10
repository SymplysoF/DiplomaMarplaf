import React, { useMemo } from 'react';
import { Badge, Card, ProgressBar, Table } from 'react-bootstrap';
import { Award, BoxArrowUp, GeoAlt, Leaf, Person, Star, Tag } from 'react-bootstrap-icons';

interface RankedProductsListProps {
    products: any[];
    onProductSelect: (product: any) => void;
    selectedProduct: any;
}

const theme = {
    card: '#ffffff',
    border: '#ebe4d8',
    text: '#223127',
    muted: '#6f7a71',
    green: '#2f6b3a',
    greenDark: '#244f2b',
    greenSoft: '#dfeadf',
    greenPale: '#eef5ec',
    orange: '#d97706',
    shadow: '0 14px 35px rgba(34, 49, 39, 0.08)'
};

function getProductId(product: any, index: number) {
    return product.id ?? product.productCopyId ?? product.product_copy_id ?? `${product.farmerId || 'farmer'}-${index}`;
}

function getProductName(product: any) {
    return product.productName || product.fullProductName || product.name || product.objectName || 'Продукт';
}

function getScore(product: any) {
    return Number(
        product.individualScore ??
        product.computedRating ??
        product.scoreFinal ??
        product.finalScore ??
        product.score ??
        0
    );
}

function formatDistance(value: any) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    const km = Number(value);
    return km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`;
}

function formatRating(value: any) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return Number(value).toFixed(1);
}

function formatPrice(product: any) {
    const raw = product.price;

    if (typeof raw === 'number') return `${raw.toFixed(0)} руб`;

    if (raw && typeof raw === 'object') {
        const whole = raw.whole ?? raw.wholepart ?? 0;
        const copecks = raw.copecks ?? 0;
        return copecks ? `${whole} руб ${copecks} коп` : `${whole} руб`;
    }

    if (product.wholepart !== undefined) {
        const whole = product.wholepart ?? 0;
        const copecks = product.copecks ?? 0;
        return copecks ? `${whole} руб ${copecks} коп` : `${whole} руб`;
    }

    return '—';
}

function getSaleTypeBadge(product: any) {
    const locationType = Number(product.locationType ?? product.idlocationproduct ?? product.locationTypeId ?? 0);

    if (locationType === 2 || product.auctionId || product.auction_id) {
        return { text: 'Аукцион', bg: 'warning', color: '#5f4100', icon: <Award size={13} /> };
    }

    if (locationType === 3) {
        return { text: 'Склад', bg: 'secondary', color: '#ffffff', icon: <BoxArrowUp size={13} /> };
    }

    return { text: 'Рынок', bg: 'success', color: '#ffffff', icon: <Tag size={13} /> };
}

function scoreColor(score: number) {
    if (score >= 80) return theme.green;
    if (score >= 60) return '#7da05c';
    if (score >= 40) return theme.orange;
    return '#8b8f8a';
}

const RankedProductsList: React.FC<RankedProductsListProps> = ({
    products,
    onProductSelect,
    selectedProduct
}) => {
    const sortedProducts = useMemo(() => {
        return [...(products || [])].sort((a, b) => {
            const aCluster = Number(a.clusterRank ?? 999);
            const bCluster = Number(b.clusterRank ?? 999);
            if (aCluster !== bCluster) return aCluster - bCluster;
            return getScore(b) - getScore(a);
        });
    }, [products]);

    if (!sortedProducts.length) {
        return (
            <Card className="border-0 h-100" style={{ borderRadius: 26, boxShadow: theme.shadow }}>
                <Card.Body className="d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 420 }}>
                    <Tag size={42} color={theme.green} className="mb-3" />
                    <h5 style={{ color: theme.text, fontWeight: 900 }}>Нет продукции</h5>
                    <div style={{ color: theme.muted }}>Измените параметры поиска и обновите расчёт.</div>
                </Card.Body>
            </Card>
        );
    }

    return (
        <Card className="border-0 h-100" style={{ borderRadius: 26, boxShadow: theme.shadow, overflow: 'hidden' }}>
            <Card.Body className="p-3">
                <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                    <div>
                        <h5 style={{ color: theme.text, fontWeight: 950, marginBottom: 2 }}>
                            Ранжированный список
                        </h5>
                        <div style={{ color: theme.muted, fontSize: '0.9rem' }}>
                            Продукция отсортирована по кластеру и итоговой оценке
                        </div>
                    </div>
                    <span
                        style={{
                            background: theme.greenSoft,
                            color: theme.greenDark,
                            borderRadius: 999,
                            padding: '0.52rem 0.75rem',
                            fontWeight: 850,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {sortedProducts.length} товаров
                    </span>
                </div>

                <div className="table-responsive" style={{ maxHeight: 520, overflowY: 'auto', borderRadius: 20 }}>
                    <Table hover className="align-middle mb-0" style={{ fontSize: '0.88rem' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: theme.card }}>
                            <tr>
                                <th style={{ color: theme.muted, borderColor: theme.border, width: 42 }}>#</th>
                                <th style={{ color: theme.muted, borderColor: theme.border }}>Товар</th>
                                <th style={{ color: theme.muted, borderColor: theme.border, whiteSpace: 'nowrap' }}>Дистанция</th>
                                <th style={{ color: theme.muted, borderColor: theme.border }}>Цена</th>
                                <th style={{ color: theme.muted, borderColor: theme.border }}>Оценка</th>
                            </tr>
                        </thead>

                        <tbody>
                            {sortedProducts.map((product, index) => {
                                const score = getScore(product);
                                const color = scoreColor(score);
                                const saleType = getSaleTypeBadge(product);
                                const productId = getProductId(product, index);
                                const isSelected = selectedProduct && getProductId(selectedProduct, index) === productId;

                                return (
                                    <tr
                                        key={productId}
                                        onClick={() => onProductSelect(product)}
                                        style={{
                                            cursor: 'pointer',
                                            borderLeft: `4px solid ${product.clusterRankColor || theme.green}`,
                                            background: isSelected
                                                ? 'rgba(47, 107, 58, 0.10)'
                                                : index < 3
                                                    ? 'rgba(223, 234, 223, 0.35)'
                                                    : theme.card
                                        }}
                                    >
                                        <td style={{ borderColor: theme.border }}>
                                            <span
                                                style={{
                                                    minWidth: 26,
                                                    height: 26,
                                                    padding: '0 8px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: index < 3 ? theme.green : theme.greenPale,
                                                    color: index < 3 ? '#fff' : theme.greenDark,
                                                    borderRadius: 999,
                                                    fontWeight: 900
                                                }}
                                            >
                                                {index + 1}
                                            </span>
                                        </td>

                                        <td style={{ borderColor: theme.border, minWidth: 210 }}>
                                            <div style={{ color: theme.text, fontWeight: 900 }}>
                                                {getProductName(product)}
                                            </div>
                                            <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
                                                <span
                                                    style={{
                                                        background: product.clusterRankColor || theme.greenSoft,
                                                        color: '#fff',
                                                        borderRadius: 999
                                                    }}
                                                >
                                                    Кластер #{product.clusterRank ?? '—'}
                                                </span>
                                                <span style={{ color: 'ActiveBorder', borderRadius: 999 }}>
                                                    <span className="d-inline-flex align-items-center gap-1">
                                                       {saleType.text}
                                                    </span>
                                                </span>
                                                {(product.has_eco_certificate || product.ecoCertificate) && (
                                                    <span style={{ background: theme.greenSoft, color: theme.greenDark, borderRadius: 999 }}>
                                                        <Leaf size={12} className="me-1" /> Эко
                                                    </span>
                                                )}
                                            </div>
                                            <div className="d-flex align-items-center gap-2 mt-1" style={{ color: theme.muted, fontSize: '0.82rem' }}>
                                                <Person size={13} />
                                                <span>{product.farmerName || 'Фермер'}</span>
                                            </div>
                                        </td>

                                        <td style={{ borderColor: theme.border, whiteSpace: 'nowrap', color: theme.text }}>
                                            <GeoAlt size={14} className="me-1" color={theme.green} />
                                            {formatDistance(product.distance)}
                                        </td>

                                        <td style={{ borderColor: theme.border, whiteSpace: 'nowrap', color: theme.text, fontWeight: 850 }}>
                                            {formatPrice(product)}
                                              <div style={{ color: theme.muted, fontSize: '0.78rem', fontWeight: 500 }}>
                                                  рейтинг:
                                            </div>
                                            <div style={{ color: theme.muted, fontSize: '0.78rem', fontWeight: 500 }}>
                                                  фермер: {formatRating(product.farmerRating)} / продукция: {formatRating(product.productRating)}
                                            </div>
                                        </td>

                                        <td style={{ borderColor: theme.border, minWidth: 120 }}>
                                            <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                                <span style={{ color, fontWeight: 950 }}>{score.toFixed(1)}</span>
                                                <span style={{ color: theme.greenDark, fontSize: '0.78rem' }}>из 100</span>
                                            </div>
                                            <ProgressBar now={score} variant="success" style={{ height: 6 }} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
};

export default RankedProductsList;


// import React from 'react';
// import { Card, Badge, ListGroup } from 'react-bootstrap';
// import { GeoAlt, Star } from 'react-bootstrap-icons';

// interface RankedProductsListProps {
//   products: any[];
//   onProductSelect: (product: any) => void;
//   selectedProduct: any;
// }

// const RankedProductsList: React.FC<RankedProductsListProps> = ({
//   products,
//   onProductSelect,
//   selectedProduct
// }) => {
//   const getRipenessBadge = (score: number) => {
//     if (score >= 2.5) return { text: 'Спелый', color: 'success' };
//     if (score >= 1.5) return { text: 'Средний', color: 'warning' };
//     return { text: 'Неспелый', color: 'danger' };
//   };

//   return (
//     <Card className="shadow-sm h-100">
//       <Card.Header className="bg-light py-2 d-flex justify-content-between align-items-center">
//         <h6 className="mb-0">Ранжированные продукты</h6>
//         <Badge bg="info">{products.length}</Badge>
//       </Card.Header>
//       <Card.Body className="p-0" style={{ maxHeight: '500px', overflowY: 'auto' }}>
//         <ListGroup variant="flush">
//           {products.map((product, index) => {
//             const ripeness = getRipenessBadge(product.ripenessScore);
            
//             return (
//               <ListGroup.Item
//                 key={product.id}
//                 className="p-2"
//                 style={{ 
//                   cursor: 'pointer',
//                   borderLeft: `4px solid ${product.clusterRankColor}`,
//                   backgroundColor: selectedProduct?.id === product.id ? '#e7f1ff' : 'white'
//                 }}
//                 onClick={() => onProductSelect(product)}
//               >
//                 <div className="d-flex justify-content-between">
//                   <div>
//                     <strong>{product.productName}</strong>
//                     <Badge bg="secondary" className="ms-2">#{product.clusterRank}</Badge>
//                   </div>
//                   <Badge bg={ripeness.color}>{ripeness.text}</Badge>
//                 </div>
                
//                 <div className="small text-muted">
//                   <div>Фермер: {product.farmerName}</div>
//                   <div className="d-flex align-items-center">
//                     <GeoAlt size={12} className="me-1" />
//                     {product.distance ? `${product.distance.toFixed(1)} км` : 'Расстояние не указано'}
//                   </div>
//                   <div className="d-flex align-items-center mt-1">
//                     <Star size={12} className="me-1 text-warning" />
//                     <span className="me-2">Фермер: {product.farmerRating?.toFixed(1) || 'Н/Д'}</span>
//                     <Star size={12} className="me-1 text-warning" />
//                     <span>Продукт: {product.productRating?.toFixed(1) || 'Н/Д'}</span>
//                   </div>
//                   <div className="mt-1">
//                     <strong>{product.price?.whole || 0} руб {product.price?.copecks || 0} коп</strong>
//                   </div>
//                 </div>
                
//                 <div className="mt-2">
//                   <div className="progress" style={{ height: '3px' }}>
//                     <div
//                       className="progress-bar"
//                       style={{ 
//                         width: `${product.individualScore}%`,
//                         backgroundColor: product.clusterRankColor
//                       }}
//                     />
//                   </div>
//                   <small className="text-muted">Рейтинг: {product.individualScore?.toFixed(1)}/100</small>
//                 </div>
//               </ListGroup.Item>
//             );
//           })}
          
//           {products.length === 0 && (
//             <ListGroup.Item className="text-center text-muted p-4">
//               Нет продуктов для отображения
//             </ListGroup.Item>
//           )}
//         </ListGroup>
//       </Card.Body>
//     </Card>
//   );
// };

// export default RankedProductsList;