import React, { useState, useEffect } from 'react';
import {
    Container, Row, Col, Card, Button, Badge, Spinner, Modal,
    Form, InputGroup, Alert, Table
} from 'react-bootstrap';
import {
    GraphUp, Search, Filter, Clock, GeoAlt, Tag, Trophy,
    People, Eye, CreditCard, CheckCircle, XCircle, BoxSeam
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';

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

const API_BASE_URL = 'http://localhost:5000';

const BuyerAuctionTab: React.FC = () => {
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
    const [showBidModal, setShowBidModal] = useState(false);
    const [bidAmount, setBidAmount] = useState<number>(0);
    const [showAuctionModal, setShowAuctionModal] = useState(false);
    const [bids, setBids] = useState<Bid[]>([]);
    const [myBids, setMyBids] = useState<any[]>([]);
    const [timeRemaining, setTimeRemaining] = useState<Record<number, string>>({});

    const fetchAuctions = async () => {
        try {
            const token = localStorage.getItem('userToken');
            const res = await fetch(`${API_BASE_URL}/api/buyer/auctions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setAuctions(data.auctions);
        } catch (error) {
            toast.error('Ошибка загрузки аукционов');
        } finally {
            setLoading(false);
        }
    };

    const fetchMyBids = async () => {
        try {
            const token = localStorage.getItem('userToken');
            const res = await fetch(`${API_BASE_URL}/api/buyer/my-bids`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setMyBids(data.bids);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchAuctions();
        fetchMyBids();
    }, []);

    // Таймер обратного отсчёта
    useEffect(() => {
        const timer = setInterval(() => {
            const newTimes: Record<number, string> = {};
            auctions.forEach(auction => {
                if (auction.status === 'active') {
                    const end = new Date(auction.endtime).getTime();
                    const now = Date.now();
                    const diff = end - now;
                    if (diff <= 0) newTimes[auction.id] = 'Завершён';
                    else {
                        const h = Math.floor(diff / 3600000);
                        const m = Math.floor((diff % 3600000) / 60000);
                        const s = Math.floor((diff % 60000) / 1000);
                        newTimes[auction.id] = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    }
                }
            });
            setTimeRemaining(newTimes);
        }, 1000);
        return () => clearInterval(timer);
    }, [auctions]);

    const handlePlaceBid = async () => {
        if (!selectedAuction) return;
        try {
            const token = localStorage.getItem('userToken');
            const res = await fetch(`${API_BASE_URL}/api/buyer/auctions/${selectedAuction.id}/bid`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount: bidAmount })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Ставка принята');
                setShowBidModal(false);
                fetchAuctions();
                fetchMyBids();
            } else {
                toast.error(data.message || 'Ошибка');
            }
        } catch (error) {
            toast.error('Ошибка сервера');
        }
    };

    const handleViewAuction = async (auction: Auction) => {
        setSelectedAuction(auction);
        setShowAuctionModal(true);
        try {
            const token = localStorage.getItem('userToken');
            const res = await fetch(`${API_BASE_URL}/api/buyer/auctions/${auction.id}/bids`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setBids(data.bids);
        } catch (error) {
            console.error(error);
        }
    };

    const formatPrice = (whole: number, copecks: number = 0) => {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(whole + copecks / 100);
    };

    const filteredAuctions = auctions.filter(a => {
        const matchSearch = !searchTerm || a.title.toLowerCase().includes(searchTerm.toLowerCase()) || a.lotNumber.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCat = selectedCategory === 'all' || a.categoryName === selectedCategory;
        return matchSearch && matchCat;
    });

    const categories = Array.from(new Set(auctions.map(a => a.categoryName)));

    if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;

    return (
        <Container fluid className="px-0">
            <Row className="mb-4">
                <Col><h4><GraphUp className="me-2 text-primary" />Аукционы</h4></Col>
            </Row>
            <Card className="mb-4 shadow-sm">
                <Card.Body>
                    <Row>
                        <Col md={6}>
                            <InputGroup>
                                <InputGroup.Text><Search /></InputGroup.Text>
                                <Form.Control placeholder="Поиск по названию или лоту" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </InputGroup>
                        </Col>
                        <Col md={4}>
                            <InputGroup>
                                <InputGroup.Text><Filter /></InputGroup.Text>
                                <Form.Select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                                    <option value="all">Все категории</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </Form.Select>
                            </InputGroup>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {filteredAuctions.length === 0 ? (
                <Alert variant="info" className="text-center">Активных аукционов нет</Alert>
            ) : (
                filteredAuctions.map(auction => (
                    <Card key={auction.id} className="mb-3 shadow-sm auction-card">
                        <Card.Body>
                            <Row>
                                <Col md={8}>
                                    <div className="d-flex align-items-start gap-2">
                                        <BoxSeam size={24} className="text-primary" />
                                        <div>
                                            <h5 className="mb-1">{auction.title}</h5>
                                            <Badge bg="light" text="dark" className="me-2">№{auction.lotNumber}</Badge>
                                            <Badge bg="info">{auction.categoryName}</Badge>
                                            <div className="mt-2 text-muted small">
                                                <GeoAlt size={12} className="me-1" />{auction.deliveryregion} • {auction.placeAddress || 'Адрес не указан'}
                                            </div>
                                            <div className="mt-1 text-muted small">
                                                <Clock size={12} className="me-1" />
                                                {auction.status === 'active' ? `До завершения: ${timeRemaining[auction.id] || '--:--:--'}` : 'Аукцион завершён'}
                                            </div>
                                        </div>
                                    </div>
                                </Col>
                                <Col md={4} className="text-end">
                                    <div><strong>Стартовая цена</strong><br />{formatPrice(auction.startprice)}</div>
                                    {auction.currentBid && (
                                        <div className="mt-1"><Badge bg="warning" text="dark"><Trophy className="me-1" />Текущая ставка: {formatPrice(auction.currentBid)}</Badge></div>
                                    )}
                                    <div className="mt-2"><small>Шаг: {formatPrice(auction.minstep)}</small></div>
                                    {auction.buynowprice && <div><small>Выкуп: {formatPrice(auction.buynowprice)}</small></div>}
                                    <div className="mt-2 d-flex justify-content-end gap-2">
                                        <Button variant="outline-info" size="sm" onClick={() => handleViewAuction(auction)}><Eye size={14} /></Button>
                                        {auction.status === 'active' && (
                                            <Button variant="success" size="sm" onClick={() => { setSelectedAuction(auction); setBidAmount(auction.currentBid ? auction.currentBid + auction.minstep : auction.startprice); setShowBidModal(true); }}>Сделать ставку</Button>
                                        )}
                                    </div>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                ))
            )}

            <Modal show={showBidModal} onHide={() => setShowBidModal(false)}>
                <Modal.Header closeButton><Modal.Title>Ставка на аукцион</Modal.Title></Modal.Header>
                <Modal.Body>
                    {selectedAuction && (
                        <Form>
                            <Form.Group>
                                <Form.Label>Ваша ставка (₽)</Form.Label>
                                <Form.Control type="number" value={bidAmount} onChange={e => setBidAmount(Number(e.target.value))} step={selectedAuction.minstep} />
                                <Form.Text className="text-muted">Минимальный шаг: {formatPrice(selectedAuction.minstep)}</Form.Text>
                            </Form.Group>
                        </Form>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowBidModal(false)}>Отмена</Button>
                    <Button variant="success" onClick={handlePlaceBid}>Подтвердить</Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showAuctionModal} onHide={() => setShowAuctionModal(false)} size="lg">
                <Modal.Header closeButton><Modal.Title>Детали аукциона</Modal.Title></Modal.Header>
                <Modal.Body>
                    {selectedAuction && (
                        <>
                            <h5>{selectedAuction.title}</h5>
                            <p className="text-muted">№{selectedAuction.lotNumber}</p>
                            <Row><Col><strong>Товар:</strong> {selectedAuction.productName}</Col><Col><strong>Категория:</strong> {selectedAuction.categoryName}</Col></Row>
                            <Row className="mt-2"><Col><strong>Старт:</strong> {new Date(selectedAuction.starttime).toLocaleString()}</Col><Col><strong>Окончание:</strong> {new Date(selectedAuction.endtime).toLocaleString()}</Col></Row>
                            <hr />
                            <h6>История ставок</h6>
                            {bids.length === 0 ? <Alert variant="info">Ставок пока нет</Alert> : (
                                <Table striped hover size="sm">
                                    <thead><tr><th>Время</th><th>Участник</th><th>Сумма</th></tr></thead>
                                    <tbody>{bids.map(b => <tr key={b.id}><td>{new Date(b.bidtime).toLocaleString()}</td><td>{b.username}</td><td>{formatPrice(b.bidamountwhole, b.bidamountcopecks)}</td></tr>)}</tbody>
                                </Table>
                            )}
                        </>
                    )}
                </Modal.Body>
            </Modal>

            <style>{`.auction-card{transition:transform 0.2s}.auction-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.12)!important}`}</style>
        </Container>
    );
};

export default BuyerAuctionTab;