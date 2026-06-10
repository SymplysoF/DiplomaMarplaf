import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Spinner, Modal, Form, InputGroup, Alert, Table } from 'react-bootstrap';
import { Shop, Search, Filter, GeoAlt, Tag, CreditCard, CheckCircle, Clock, BoxSeam, Flower1, Tree, Droplet } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';

interface MarketProduct {
    id: number;
    productName: string;
    objectName: string;
    varietyName: string;
    categoryName: string;
    wholepart: number;
    copecks: number;
    weight: number;
    quantity: number;
    unit: string;
    placeAddress: string;
    supplierName: string;
    supplierId: number;
}

interface Purchase {
    id: number;
    productName: string;
    quantity: number;
    totalprice: number;
    status: string;
    createdat: string;
}

const API_BASE_URL = 'http://localhost:5000';

const BuyerMarketTab: React.FC = () => {
    const [products, setProducts] = useState<MarketProduct[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedProduct, setSelectedProduct] = useState<MarketProduct | null>(null);
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [quantity, setQuantity] = useState(1);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('userToken');
            const [productsRes, purchasesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/buyer/market/products`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/buyer/market/purchases`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            const productsData = await productsRes.json();
            const purchasesData = await purchasesRes.json();
            if (productsData.success) setProducts(productsData.products);
            if (purchasesData.success) setPurchases(purchasesData.purchases);
        } catch (error) {
            toast.error('Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleBuy = async () => {
        if (!selectedProduct) return;
        try {
            const token = localStorage.getItem('userToken');
            const res = await fetch(`${API_BASE_URL}/api/buyer/market/purchase`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: selectedProduct.id, quantity })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Покупка оформлена');
                setShowBuyModal(false);
                fetchData();
            } else {
                toast.error(data.message || 'Ошибка');
            }
        } catch (error) {
            toast.error('Ошибка сервера');
        }
    };

    const formatPrice = (whole: number, copecks: number = 0) => {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(whole + copecks / 100);
    };

    const getCategoryIcon = (cat: string) => {
        const name = cat.toLowerCase();
        if (name.includes('овощ')) return <Flower1 className="text-success" />;
        if (name.includes('фрукт')) return <Tree className="text-danger" />;
        if (name.includes('молоко')) return <Droplet className="text-primary" />;
        return <BoxSeam className="text-secondary" />;
    };

    const filteredProducts = products.filter(p => {
        const matchSearch = !searchTerm || p.productName.toLowerCase().includes(searchTerm.toLowerCase()) || p.categoryName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCat = selectedCategory === 'all' || p.categoryName === selectedCategory;
        return matchSearch && matchCat;
    });

    const categories = Array.from(new Set(products.map(p => p.categoryName)));

    if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;

    return (
        <Container fluid className="px-0">
            <Row className="mb-4"><Col><h4><Shop className="me-2 text-success" />Торговая площадка</h4></Col></Row>
            <Card className="mb-4 shadow-sm"><Card.Body><Row><Col md={6}><InputGroup><InputGroup.Text><Search /></InputGroup.Text><Form.Control placeholder="Поиск" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></InputGroup></Col><Col md={4}><InputGroup><InputGroup.Text><Filter /></InputGroup.Text><Form.Select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}><option value="all">Все категории</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</Form.Select></InputGroup></Col></Row></Card.Body></Card>

            <Row>
                <Col md={8}>
                    <h5>Доступные товары</h5>
                    {filteredProducts.length === 0 ? <Alert variant="info">Товаров не найдено</Alert> : (
                        <Row xs={1} md={2} className="g-4">
                            {filteredProducts.map(p => (
                                <Col key={p.id}>
                                    <Card className="h-100 shadow-sm product-card">
                                        <Card.Body>
                                            <div className="d-flex justify-content-between">
                                                <div>{getCategoryIcon(p.categoryName)} <Badge bg="light" text="dark">{p.categoryName}</Badge></div>
                                                <Badge bg="success">{p.quantity} {p.unit}</Badge>
                                            </div>
                                            <h6 className="mt-2">{p.productName}</h6>
                                            <div className="text-muted small">{p.objectName} {p.varietyName}</div>
                                            <div className="mt-2"><strong>{formatPrice(p.wholepart, p.copecks)}</strong> / {p.unit}</div>
                                            <div className="text-muted small"><GeoAlt size={12} /> {p.placeAddress?.substring(0, 40)}...</div>
                                            <div className="mt-2"><Button variant="success" size="sm" onClick={() => { setSelectedProduct(p); setQuantity(1); setShowBuyModal(true); }}>Купить</Button></div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    )}
                </Col>
                <Col md={4}>
                    <h5>Мои покупки</h5>
                    <Card className="shadow-sm" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <Card.Body>
                            {purchases.length === 0 ? <p className="text-muted text-center">Покупок пока нет</p> : purchases.map(p => (
                                <Card key={p.id} className="mb-2 purchase-card"><Card.Body className="p-2">
                                    <div className="d-flex justify-content-between"><Badge bg={p.status === 'delivered' ? 'success' : 'warning'}>{p.status}</Badge><small>{new Date(p.createdat).toLocaleDateString()}</small></div>
                                    <div><strong>{p.productName}</strong> x{p.quantity}</div>
                                    <div>{formatPrice(p.totalprice)}</div>
                                </Card.Body></Card>
                            ))}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Modal show={showBuyModal} onHide={() => setShowBuyModal(false)}><Modal.Header closeButton><Modal.Title>Покупка</Modal.Title></Modal.Header><Modal.Body>
                {selectedProduct && (<><div>{selectedProduct.productName}</div><div>Цена: {formatPrice(selectedProduct.wholepart, selectedProduct.copecks)}</div><Form.Group><Form.Label>Количество</Form.Label><Form.Control type="number" min="1" max={selectedProduct.quantity} value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></Form.Group><div className="mt-3">Итого: {formatPrice(selectedProduct.wholepart * quantity + selectedProduct.copecks * quantity / 100)}</div></>)}
            </Modal.Body><Modal.Footer><Button variant="secondary" onClick={() => setShowBuyModal(false)}>Отмена</Button><Button variant="success" onClick={handleBuy}>Подтвердить</Button></Modal.Footer></Modal>

            <style>{`.product-card{transition:transform 0.2s}.product-card:hover{transform:translateY(-2px)}`}</style>
        </Container>
    );
};

export default BuyerMarketTab;