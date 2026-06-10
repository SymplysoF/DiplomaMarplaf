import React, { useState, useEffect } from 'react';
import {
    Container,
    Row,
    Col,
    Card,
    Button,
    Spinner,
    Modal,
    Form,
    Alert,
    Table,
    InputGroup
} from 'react-bootstrap';
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    Clock,
    CheckCircle,
    XCircle,
    Envelope,
    Person,
    BoxSeam,
    ChatDots
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';

interface BuyerRequest {
    id: number;
    product_name: string;
    object_id: number;
    object_name: string;
    quantity_needed: number;
    max_price_whole: number;
    max_price_copecks: number;
    expires_at: string;
    status: 'active' | 'fulfilled' | 'expired';
    created_at: string;
}

interface FarmerResponse {
    id: number;
    supplier_id: number;
    supplier_name: string;
    offered_price_whole: number;
    offered_price_copecks: number;
    estimated_quantity: number;
    delivery_days: number;
    response_text: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}

const API_BASE_URL = 'http://localhost:5000';

const ui = {
    text: '#243126',
    muted: '#6d786f',
    border: '#e8e1d5',
    green: '#2f6b3a',
    greenSoft: '#e7f5ea',
    gold: '#9a6b00',
    goldSoft: '#fbf1d9',
    blueGray: '#44546a',
    blueGraySoft: '#eef2f7',
    purple: '#6c56d9',
    purpleSoft: '#f1ecff',
    red: '#b54747',
    redSoft: '#fceaea',
    white: '#ffffff'
};

const chip = (bg: string, color: string): React.CSSProperties => ({
    background: bg,
    color,
    borderRadius: 999,
    padding: '0.42rem 0.72rem',
    fontSize: '0.84rem',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6
});

const BuyerRequestsTab: React.FC = () => {
    const [requests, setRequests] = useState<BuyerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingRequest, setEditingRequest] = useState<BuyerRequest | null>(null);
    const [formData, setFormData] = useState({
        product_name: '',
        object_id: 0,
        quantity_needed: 1,
        max_price_whole: 0,
        max_price_copecks: 0,
        expires_at: ''
    });
    const [showResponsesModal, setShowResponsesModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<BuyerRequest | null>(null);
    const [responses, setResponses] = useState<FarmerResponse[]>([]);

    const fetchRequests = async () => {
        try {
            const token = localStorage.getItem('userToken');
            const res = await fetch(`${API_BASE_URL}/api/buyer/requests`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setRequests(data.requests);
        } catch {
            toast.error('Ошибка загрузки запросов');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleOpenCreate = () => {
        setEditingRequest(null);
        setFormData({
            product_name: '',
            object_id: 0,
            quantity_needed: 1,
            max_price_whole: 0,
            max_price_copecks: 0,
            expires_at: ''
        });
        setShowModal(true);
    };

    const handleOpenEdit = (request: BuyerRequest) => {
        setEditingRequest(request);
        setFormData({
            product_name: request.product_name,
            object_id: request.object_id,
            quantity_needed: request.quantity_needed,
            max_price_whole: request.max_price_whole,
            max_price_copecks: request.max_price_copecks,
            expires_at: request.expires_at?.slice(0, 16) || ''
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.product_name || !formData.object_id || !formData.quantity_needed || !formData.max_price_whole || !formData.expires_at) {
            toast.error('Заполните все обязательные поля');
            return;
        }

        try {
            const token = localStorage.getItem('userToken');
            const url = editingRequest
                ? `${API_BASE_URL}/api/buyer/requests/${editingRequest.id}`
                : `${API_BASE_URL}/api/buyer/requests`;

            const method = editingRequest ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (data.success) {
                toast.success(editingRequest ? 'Запрос обновлён' : 'Запрос создан');
                setShowModal(false);
                fetchRequests();
            } else {
                toast.error(data.message || 'Ошибка');
            }
        } catch {
            toast.error('Ошибка сервера');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Удалить запрос?')) return;

        try {
            const token = localStorage.getItem('userToken');
            const res = await fetch(`${API_BASE_URL}/api/buyer/requests/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Запрос удалён');
                fetchRequests();
            } else {
                toast.error(data.message || 'Ошибка');
            }
        } catch {
            toast.error('Ошибка сервера');
        }
    };

    const handleViewResponses = async (request: BuyerRequest) => {
        setSelectedRequest(request);
        setShowResponsesModal(true);

        try {
            const token = localStorage.getItem('userToken');
            const res = await fetch(`${API_BASE_URL}/api/buyer/requests/${request.id}/responses`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setResponses(data.responses);
        } catch (error) {
            console.error(error);
        }
    };

    const formatPrice = (whole: number, copecks: number = 0) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB'
        }).format(whole + copecks / 100);
    };

    const filteredRequests = requests.filter((r) => {
        const q = searchTerm.toLowerCase();
        return (
            !searchTerm ||
            r.product_name.toLowerCase().includes(q) ||
            r.object_name.toLowerCase().includes(q)
        );
    });

    if (loading) {
        return <div className="text-center py-5"><Spinner animation="border" /></div>;
    }

    return (
        <Container fluid className="px-0">
            <Row className="mb-4 align-items-center">
                <Col>
                    <h4 style={{ color: ui.text }}>
                        <Envelope className="me-2" />
                        Мои запросы
                    </h4>
                </Col>
                <Col className="text-end">
                    <Button
                        onClick={handleOpenCreate}
                        style={{ background: ui.green, borderColor: ui.green, borderRadius: 12 }}
                    >
                        <Plus className="me-2" />
                        Новый запрос
                    </Button>
                </Col>
            </Row>

            <Card className="border-0 shadow-sm mb-4" style={{ borderRadius: 20 }}>
                <Card.Body>
                    <InputGroup>
                        <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                            <Search />
                        </InputGroup.Text>
                        <Form.Control
                            placeholder="Поиск по продукту или объекту..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ borderColor: ui.border }}
                        />
                    </InputGroup>
                </Card.Body>
            </Card>

            {filteredRequests.length === 0 ? (
                <Alert variant="light" className="border text-center py-5">
                    <BoxSeam size={42} className="mb-3" />
                    <h5>Запросы не найдены</h5>
                </Alert>
            ) : (
                <Row className="g-4">
                    {filteredRequests.map((request) => (
                        <Col lg={6} key={request.id}>
                            <Card className="border-0 shadow-sm h-100" style={{ borderRadius: 20 }}>
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                                        <div>
                                            <h5 className="mb-1" style={{ color: ui.text }}>
                                                {request.product_name}
                                            </h5>
                                            <div style={{ color: ui.muted }}>{request.object_name}</div>
                                        </div>

                                        <div>
                                            {request.status === 'active' && (
                                                <span style={chip(ui.greenSoft, ui.green)}>
                                                    <Clock size={12} />
                                                    Активен
                                                </span>
                                            )}
                                            {request.status === 'fulfilled' && (
                                                <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                                                    <CheckCircle size={12} />
                                                    Закрыт
                                                </span>
                                            )}
                                            {request.status === 'expired' && (
                                                <span style={chip(ui.redSoft, ui.red)}>
                                                    <XCircle size={12} />
                                                    Истёк
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-2" style={{ color: ui.muted }}>
                                        Нужное количество: <strong>{request.quantity_needed}</strong>
                                    </div>
                                    <div className="mb-2" style={{ color: ui.muted }}>
                                        Макс. цена: <strong>{formatPrice(request.max_price_whole, request.max_price_copecks)}</strong>
                                    </div>
                                    <div className="mb-3" style={{ color: ui.muted }}>
                                        Действует до: <strong>{new Date(request.expires_at).toLocaleString('ru-RU')}</strong>
                                    </div>

                                    <div className="d-flex flex-wrap gap-2">
                                        <Button
                                            variant="light"
                                            onClick={() => handleViewResponses(request)}
                                            style={{ borderRadius: 12 }}
                                        >
                                            <ChatDots className="me-2" />
                                            Отклики
                                        </Button>

                                        <Button
                                            variant="light"
                                            onClick={() => handleOpenEdit(request)}
                                            style={{ borderRadius: 12 }}
                                        >
                                            <Pencil className="me-2" />
                                            Изменить
                                        </Button>

                                        <Button
                                            variant="light"
                                            onClick={() => handleDelete(request.id)}
                                            style={{ borderRadius: 12, color: ui.red }}
                                        >
                                            <Trash2 className="me-2" />
                                            Удалить
                                        </Button>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}

            <Modal show={showModal} onHide={() => setShowModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{editingRequest ? 'Редактировать запрос' : 'Новый запрос'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Название продукта</Form.Label>
                            <Form.Control
                                value={formData.product_name}
                                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Object ID</Form.Label>
                            <Form.Control
                                type="number"
                                value={formData.object_id}
                                onChange={(e) => setFormData({ ...formData, object_id: Number(e.target.value) })}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Количество</Form.Label>
                            <Form.Control
                                type="number"
                                min={1}
                                value={formData.quantity_needed}
                                onChange={(e) => setFormData({ ...formData, quantity_needed: Number(e.target.value) })}
                            />
                        </Form.Group>

                        <Row>
                            <Col>
                                <Form.Group className="mb-3">
                                    <Form.Label>Цена (руб.)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={formData.max_price_whole}
                                        onChange={(e) => setFormData({ ...formData, max_price_whole: Number(e.target.value) })}
                                    />
                                </Form.Group>
                            </Col>
                            <Col>
                                <Form.Group className="mb-3">
                                    <Form.Label>Копейки</Form.Label>
                                    <Form.Control
                                        type="number"
                                        min={0}
                                        max={99}
                                        value={formData.max_price_copecks}
                                        onChange={(e) => setFormData({ ...formData, max_price_copecks: Number(e.target.value) })}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Form.Group>
                            <Form.Label>Действует до</Form.Label>
                            <Form.Control
                                type="datetime-local"
                                value={formData.expires_at}
                                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setShowModal(false)}>Отмена</Button>
                    <Button
                        onClick={handleSave}
                        style={{ background: ui.green, borderColor: ui.green }}
                    >
                        Сохранить
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showResponsesModal} onHide={() => setShowResponsesModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        Отклики на запрос: {selectedRequest?.product_name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {responses.length === 0 ? (
                        <Alert variant="light">Пока нет откликов</Alert>
                    ) : (
                        <Table responsive hover>
                            <thead>
                                <tr>
                                    <th>Фермер</th>
                                    <th>Цена</th>
                                    <th>Кол-во</th>
                                    <th>Доставка</th>
                                    <th>Комментарий</th>
                                </tr>
                            </thead>
                            <tbody>
                                {responses.map((response) => (
                                    <tr key={response.id}>
                                        <td>
                                            <Person className="me-2" />
                                            {response.supplier_name}
                                        </td>
                                        <td>{formatPrice(response.offered_price_whole, response.offered_price_copecks)}</td>
                                        <td>{response.estimated_quantity}</td>
                                        <td>{response.delivery_days} дн.</td>
                                        <td>{response.response_text || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Modal.Body>
            </Modal>
        </Container>
    );
};

export default BuyerRequestsTab;