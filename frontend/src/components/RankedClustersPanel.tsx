import React, { useMemo } from 'react';
import { Badge, Card, Table } from 'react-bootstrap';
import { GeoAlt, Leaf, Star, Trophy } from 'react-bootstrap-icons';

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
    has_eco_certificate?: boolean;
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

interface RankedClustersPanelProps {
    clusters: {
        clusters: RankedCluster[];
        entropyWeights?: {
            distance: number;
            rating: number;
            subscription: number;
        };
    };
    onFarmerSelect: (farmer: any) => void;
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

function formatDistance(km: number | null | undefined) {
    if (km === null || km === undefined || Number.isNaN(Number(km))) return '—';
    const value = Number(km);
    return value < 1 ? `${Math.round(value * 1000)} м` : `${value.toFixed(1)} км`;
}

function scoreColor(score: number) {
    if (score >= 80) return theme.green;
    if (score >= 60) return '#7da05c';
    if (score >= 40) return theme.orange;
    return '#8b8f8a';
}

const RankedClustersPanel: React.FC<RankedClustersPanelProps> = ({ clusters, onFarmerSelect }) => {
    const data = useMemo(() => {
        const source = clusters?.clusters || [];
        const sortedClusters = [...source].sort((a, b) => a.rank - b.rank);
        const rowsMap = new Map<number, any>();

        sortedClusters.forEach((cluster) => {
            cluster.farmers.forEach((farmer) => {
                const current = rowsMap.get(farmer.id);

                const row = {
                    ...farmer,
                    clusterId: cluster.id,
                    clusterRank: cluster.rank,
                    clusterRankScore: cluster.rankScore,
                    clusterRankColor: cluster.rankColor,
                    clusterSize: cluster.size,
                    placesCount: 1,
                    bestScore: Number(farmer.individualScore || 0)
                };

                if (!current) {
                    rowsMap.set(farmer.id, row);
                    return;
                }

                current.placesCount += 1;

                if (Number(farmer.individualScore || 0) > Number(current.bestScore || 0)) {
                    rowsMap.set(farmer.id, {
                        ...row,
                        placesCount: current.placesCount
                    });
                } else {
                    rowsMap.set(farmer.id, current);
                }
            });
        });

        const rows = Array.from(rowsMap.values()).sort((a, b) => {
            if (a.clusterRank !== b.clusterRank) return a.clusterRank - b.clusterRank;
            return Number(b.bestScore || 0) - Number(a.bestScore || 0);
        });

        const allFarmers = Array.from(rowsMap.values());
        const totalFarmers = allFarmers.length;
        const totalClusters = sortedClusters.length;
        const avgDistance = totalFarmers
            ? allFarmers.reduce((sum, f) => sum + Number(f.distance || 0), 0) / totalFarmers
            : 0;
        const avgRating = totalFarmers
            ? allFarmers.reduce((sum, f) => sum + Number(f.rating || 0), 0) / totalFarmers
            : 0;
        const ecoCount = allFarmers.filter((f) => f.has_eco_certificate).length;

        return {
            rows,
            totalFarmers,
            totalClusters,
            avgDistance,
            avgRating,
            ecoCount
        };
    }, [clusters]);

    const weights = clusters?.entropyWeights || { distance: 0.34, rating: 0.33, subscription: 0.33 };

    if (!clusters || !clusters.clusters || clusters.clusters.length === 0) {
        return (
            <Card className="border-0 h-100" style={{ borderRadius: 26, boxShadow: theme.shadow }}>
                <Card.Body className="d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: 420 }}>
                    <div
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 20,
                            background: theme.greenSoft,
                            color: theme.green,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 14
                        }}
                    >
                        <Trophy size={26} />
                    </div>
                    <h5 style={{ color: theme.text, fontWeight: 900 }}>Нет данных о кластерах</h5>
                    <div style={{ color: theme.muted }}>Укажите адрес доставки и обновите расчет.</div>
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
                            Фермеры отсортированы по кластеру и лучшей оценке участка
                        </div>
                    </div>

                    {/* <Badge
                        style={{
                            background: theme.greenSoft,
                            color: theme.greenDark,
                            borderRadius: 999,
                            padding: '0.52rem 0.75rem',
                            fontWeight: 850,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {data.totalFarmers} фермеров
                    </Badge> */}
                </div>

                <div
                    className="d-grid mb-3"
                    style={{
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 8
                    }}
                >
                    {/* <div style={{ background: theme.greenPale, borderRadius: 18, padding: '0.75rem' }}>
                        <div style={{ color: theme.greenDark, fontWeight: 950 }}>{data.totalClusters}</div>
                        <div style={{ color: theme.muted, fontSize: '0.78rem' }}>кластеров</div>
                    </div>
                    <div style={{ background: theme.greenPale, borderRadius: 18, padding: '0.75rem' }}>
                        <div style={{ color: theme.greenDark, fontWeight: 950 }}>{formatDistance(data.avgDistance)}</div>
                        <div style={{ color: theme.muted, fontSize: '0.78rem' }}>ср. расстояние</div>
                    </div>
                    <div style={{ background: theme.greenPale, borderRadius: 18, padding: '0.75rem' }}>
                        <div style={{ color: theme.greenDark, fontWeight: 950 }}>{data.avgRating.toFixed(1)}</div>
                        <div style={{ color: theme.muted, fontSize: '0.78rem' }}>ср. рейтинг</div>
                    </div> */}
                </div>

                <div className="table-responsive" style={{ maxHeight: 470, overflowY: 'auto', borderRadius: 20 }}>
                    <Table hover className="align-middle mb-0" style={{ fontSize: '0.88rem' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: theme.card }}>
                            <tr>
                                <th style={{ color: theme.muted, borderColor: theme.border, width: 42 }}>#</th>
                                <th style={{ color: theme.muted, borderColor: theme.border }}>Фермер</th>
                                <th style={{ color: theme.muted, borderColor: theme.border, whiteSpace: 'nowrap' }}>Дистанция</th>
                                <th style={{ color: theme.muted, borderColor: theme.border }}>Рейтинг</th>
                                <th style={{ color: theme.muted, borderColor: theme.border }}>Оценка</th>
                            </tr>
                        </thead>

                        <tbody>
                            {data.rows.map((farmer, index) => {
                                const score = Number(farmer.bestScore || farmer.individualScore || 0);
                                const color = scoreColor(score);

                                return (
                                    <tr
                                        key={`${farmer.clusterId}-${farmer.id}`}
                                        onClick={() => onFarmerSelect(farmer)}
                                        style={{
                                            cursor: 'pointer',
                                            borderLeft: `4px solid ${farmer.clusterRankColor || theme.green}`,
                                            background: index < 3 ? 'rgba(223, 234, 223, 0.35)' : theme.card
                                        }}
                                    >
                                        <td style={{ borderColor: theme.border }}>
                                            <span
                                                style={{
                                                    background: index < 3 ? theme.green : theme.greenPale,
                                                    color: index < 3 ? '#fff' : theme.greenDark,
                                                    borderRadius: 999
                                                }}
                                            >
                                                {index + 1}
                                            </span>
                                        </td>

                                        <td style={{ borderColor: theme.border, minWidth: 180 }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <div style={{ minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            color: theme.text,
                                                            fontWeight: 900,
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            maxWidth: 190
                                                        }}
                                                    >
                                                        {farmer.name}
                                                    </div>

                                                    <div
                                                        style={{
                                                            color: theme.muted,
                                                            fontSize: '0.76rem',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            maxWidth: 210
                                                        }}
                                                    >
                                                        Кластер #{farmer.clusterRank}
                                                        {' · '}
                                                        {farmer.placesCount} уч.
                                                        {farmer.has_eco_certificate && (
                                                            <>
                                                                {' · '}
                                                                <Leaf size={12} style={{ color: theme.green }} />
                                                                {' эко'}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {farmer.bestPlaceAddress && (
                                                <div
                                                    style={{
                                                        color: theme.muted,
                                                        fontSize: '0.74rem',
                                                        maxWidth: 250,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                >
                                                    {farmer.bestPlaceAddress}
                                                </div>
                                            )}
                                        </td>

                                        <td style={{ borderColor: theme.border, whiteSpace: 'nowrap' }}>
                                            <strong style={{ color: theme.greenDark, fontSize: '0.98rem' }}>
                                                <GeoAlt size={13} className="me-1" />
                                                {formatDistance(farmer.distance)}
                                            </strong>
                                        </td>

                                        <td style={{ borderColor: theme.border }}>
                                            <span
                                                style={{
                                                    background: '#fff3d7',
                                                    color: '#77520d',
                                                    borderRadius: 999,
                                                    padding: '0.42rem 0.55rem'
                                                }}
                                            >
                                                <Star size={12} className="me-1" />
                                                {Number(farmer.rating || 0).toFixed(1)}
                                            </span>
                                        </td>

                                        <td style={{ borderColor: theme.border, minWidth: 96 }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <b style={{ color }}>{score.toFixed(1)}</b>
                                                <div
                                                    style={{
                                                        flex: 1,
                                                        minWidth: 44,
                                                        height: 7,
                                                        borderRadius: 999,
                                                        background: '#edf2ee',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: `${Math.min(100, Math.max(0, score))}%`,
                                                            height: '100%',
                                                            borderRadius: 999,
                                                            background: color
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>

                <div
                    className="mt-3"
                    style={{
                        background: theme.greenPale,
                        borderRadius: 18,
                        padding: '0.8rem 0.9rem'
                    }}
                >
                    <div className="d-flex justify-content-between mb-1" style={{ color: theme.muted, fontSize: '0.8rem' }}>
                        <span>Энтропийные веса</span>
                        <span>
                            расстояние {(weights.distance * 100).toFixed(0)}% · рейтинг {(weights.rating * 100).toFixed(0)}% · подписка {(weights.subscription * 100).toFixed(0)}%
                        </span>
                    </div>

                    <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: '#edf2ee' }}>
                        <div style={{ width: `${weights.distance * 100}%`, background: theme.green }} />
                        <div style={{ width: `${weights.rating * 100}%`, background: '#d6a83a' }} />
                        <div style={{ width: `${weights.subscription * 100}%`, background: '#637083' }} />
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
};

export default RankedClustersPanel;
