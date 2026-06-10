import React, { useEffect, useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Badge,
  Spinner,
  Form,
  InputGroup,
  Modal,
  Alert
} from 'react-bootstrap';
import {
  Search,
  GeoAlt,
  BoxSeam,
  Pencil,
  Trash,
  ClockHistory,
  CheckCircle,
  Truck
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { buyerTheme as theme, softChip } from './buyerTheme';

const API_BASE_URL = 'http://localhost:5000';

interface Purchase {
  id: number;
  idproduct?: number;
  idsupplier?: number;
  idplace?: number;
  quantity: number;
  status: string;
  paymentmethod?: string | null;
  deliveryaddress?: string | null;
  contactphone?: string | null;
  contactemail?: string | null;
  comment?: string | null;
  createdat: string;
  updatedat?: string | null;
  completedat?: string | null;
  productName?: string;
  supplierName?: string;
  placeAddress?: string;
  unitPrice?: number;
  totalPrice?: number;
}

const BuyerMyPurchasesTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    deliveryaddress: '',
    contactphone: '',
    contactemail: '',
    comment: '',
    paymentmethod: ''
  });

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('userToken');

      const res = await fetch(`${API_BASE_URL}/api/buyer/purchases`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        setPurchases(data.purchases || []);
      } else {
        toast.error(data.message || 'Ошибка загрузки покупок');
      }
    } catch (error) {
      toast.error('Ошибка сервера');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return purchases;

    return purchases.filter((p) =>
      String(p.productName || '').toLowerCase().includes(q) ||
      String(p.supplierName || '').toLowerCase().includes(q) ||
      String(p.placeAddress || '').toLowerCase().includes(q) ||
      String(p.status || '').toLowerCase().includes(q)
    );
  }, [purchases, searchTerm]);

  const getStatusBadge = (status: string) => {
    if (status === 'completed' || status === 'delivered') {
      return <Badge bg="success">Доставлено</Badge>;
    }
    if (status === 'pending') {
      return <Badge bg="warning" text="dark">В обработке</Badge>;
    }
    if (status === 'cancelled') {
      return <Badge bg="danger">Отменено</Badge>;
    }
    return <Badge bg="secondary">{status}</Badge>;
  };

  const openEdit = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setFormData({
      deliveryaddress: purchase.deliveryaddress || '',
      contactphone: purchase.contactphone || '',
      contactemail: purchase.contactemail || '',
      comment: purchase.comment || '',
      paymentmethod: purchase.paymentmethod || ''
    });
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!selectedPurchase) return;

    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/api/buyer/purchases/${selectedPurchase.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Покупка обновлена');
        setShowEditModal(false);
        fetchPurchases();
      } else {
        toast.error(data.message || 'Ошибка');
      }
    } catch {
      toast.error('Ошибка сервера');
    }
  };

  const handleDelete = async (purchaseId: number) => {
    if (!window.confirm('Отменить покупку?')) return;

    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`${API_BASE_URL}/api/buyer/purchases/${purchaseId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Покупка отменена');
        fetchPurchases();
      } else {
        toast.error(data.message || 'Ошибка');
      }
    } catch {
      toast.error('Ошибка сервера');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <p className="mt-2">Загрузка покупок...</p>
      </div>
    );
  }

  return (
    <div style={{ background: theme.bg, borderRadius: 24, padding: 4 }}>
      <Card className="border-0 mb-4" style={{ borderRadius: 22, boxShadow: theme.shadow }}>
        <Card.Body className="p-4">
          <h5 className="mb-3" style={{ color: theme.text }}>
            Мои покупки
          </h5>

          <Row className="g-3 align-items-center">
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                  <Search size={14} />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Поиск по товару, фермеру, статусу..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>

            <Col md={8}>
              <div className="text-muted small">
                Всего покупок: {filtered.length}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row className="g-4">
        {filtered.map((purchase) => (
          <Col md={6} xl={4} key={purchase.id}>
            <Card
              className="h-100 border-0"
              style={{
                borderRadius: 22,
                boxShadow: theme.shadow,
                background: theme.card
              }}
            >
              <Card.Body className="p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <h5 className="mb-1" style={{ color: theme.text, fontWeight: 700 }}>
                      {purchase.productName || 'Покупка'}
                    </h5>
                    <div className="text-muted" style={{ fontSize: '0.96rem' }}>
                      Фермер: {purchase.supplierName || '—'}
                    </div>
                  </div>

                  {getStatusBadge(purchase.status)}
                </div>

                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span style={softChip('#eef2f7', '#44546a')}>
                    <ClockHistory size={12} className="me-1" />
                    {new Date(purchase.createdat).toLocaleString()}
                  </span>

                  <span style={softChip('#f5efe7', '#8a5d1f')}>
                    <BoxSeam size={12} className="me-1" />
                    {purchase.quantity} шт.
                  </span>
                </div>

                <div className="mb-3 text-muted" style={{ fontSize: '0.95rem' }}>
                  <div>
                    <GeoAlt size={12} className="me-1" />
                    {purchase.placeAddress || purchase.deliveryaddress || 'Адрес не указан'}
                  </div>
                  <div className="mt-2">
                    Сумма: <strong>{Number(purchase.totalPrice || 0).toFixed(0)} ₽</strong>
                  </div>
                </div>

                <div className="mt-auto d-flex gap-2 justify-content-end">
                  {purchase.status === 'pending' && (
                    <>
                      <Button
                        onClick={() => openEdit(purchase)}
                        style={{
                          borderRadius: 12,
                          border: `1px solid ${theme.border}`,
                          background: '#f7f5f0',
                          color: theme.text
                        }}
                      >
                        <Pencil size={14} className="me-2" />
                        Изменить
                      </Button>

                      <Button
                        onClick={() => handleDelete(purchase.id)}
                        style={{
                          borderRadius: 12,
                          background: '#fceaea',
                          color: '#b54747',
                          border: '1px solid #f2d0d0'
                        }}
                      >
                        <Trash size={14} className="me-2" />
                        Отменить
                      </Button>
                    </>
                  )}

                  {purchase.status !== 'pending' && (
                    <Button
                      disabled
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${theme.border}`,
                        background: '#fafafa',
                        color: theme.muted
                      }}
                    >
                      <Truck size={14} className="me-2" />
                      Без действий
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}

        {filtered.length === 0 && (
          <Col md={12}>
            <div className="text-center py-5 text-muted">
              <BoxSeam size={48} className="mb-3" />
              <p>Покупки не найдены</p>
            </div>
          </Col>
        )}
      </Row>

      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Редактирование покупки</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Адрес доставки</Form.Label>
              <Form.Control
                value={formData.deliveryaddress}
                onChange={(e) => setFormData({ ...formData, deliveryaddress: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Телефон</Form.Label>
              <Form.Control
                value={formData.contactphone}
                onChange={(e) => setFormData({ ...formData, contactphone: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                value={formData.contactemail}
                onChange={(e) => setFormData({ ...formData, contactemail: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Способ оплаты</Form.Label>
              <Form.Select
                value={formData.paymentmethod}
                onChange={(e) => setFormData({ ...formData, paymentmethod: e.target.value })}
              >
                <option value="">Не выбрано</option>
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
                <option value="transfer">Перевод</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-0">
              <Form.Label>Комментарий</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowEditModal(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            style={{ background: theme.green, borderColor: theme.green }}
          >
            Сохранить
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default BuyerMyPurchasesTab;