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
  Modal
} from 'react-bootstrap';
import {
  Search,
  GeoAlt,
  BoxSeam,
  Pencil,
  Trash,
  ClockHistory,
  Truck
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getBuyerPurchases, updateBuyerPurchase, deleteBuyerPurchase } from '../../api/buyerPurchasesApi';
import { buyerTheme as theme, softChip } from './buyerTheme';

interface Purchase {
  id: number;
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
  totalPrice?: number;
}

const BuyerMyPurchasesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { t, i18n } = useTranslation();
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
      const data = await getBuyerPurchases();
      if (data.success) setPurchases(data.purchases || []);
      else toast.error(data.message || t('buyer.purchases.errorLoading'));
    } catch {
      toast.error(t('common.serverError'));
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
    if (status === 'completed' || status === 'delivered') return <Badge bg="success">{t('buyer.purchases.status.delivered')}</Badge>;
    if (status === 'pending') return <Badge bg="warning" text="dark">{t('buyer.purchases.status.pending')}</Badge>;
    if (status === 'cancelled') return <Badge bg="danger">{t('buyer.purchases.status.cancelled')}</Badge>;
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
      const data = await updateBuyerPurchase(selectedPurchase.id, formData);
      if (data.success) {
        toast.success(t('buyer.purchases.updated'));
        setShowEditModal(false);
        fetchPurchases();
      } else {
        toast.error(data.message || t('common.error'));
      }
    } catch {
      toast.error(t('common.serverError'));
    }
  };

  const handleDelete = async (purchaseId: number) => {
    if (!window.confirm(t('buyer.purchases.cancelConfirm'))) return;

    try {
      const data = await deleteBuyerPurchase(purchaseId);
      if (data.success) {
        toast.success(t('buyer.purchases.cancelled'));
        fetchPurchases();
      } else {
        toast.error(data.message || t('common.error'));
      }
    } catch {
      toast.error(t('common.serverError'));
    }
  };

  if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;

  return (
    <div style={{ background: theme.bg, borderRadius: 24, padding: 4 }}>
      <Card className="border-0 mb-4" style={{ borderRadius: 22, boxShadow: theme.shadow }}>
        <Card.Body className="p-4">
          <h5 className="mb-3" style={{ color: theme.text }}>{t('buyer.purchases.title')}</h5>

          <Row className="g-3 align-items-center">
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                  <Search size={14} />
                </InputGroup.Text>
                <Form.Control
                  placeholder={t('buyer.purchases.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>

            <Col md={8}>
              {/* <div className="text-muted small">Всего покупок: {filtered.length}</div> */}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row className="g-4">
        {filtered.map((purchase) => (
          <Col md={6} xl={4} key={purchase.id}>
            <Card className="h-100 border-0" style={{ borderRadius: 22, boxShadow: theme.shadow, background: theme.card }}>
              <Card.Body className="p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <h5 className="mb-1" style={{ color: theme.text, fontWeight: 700 }}>
                      {purchase.productName || t('buyer.purchases.purchase')}
                    </h5>
                    <div className="text-muted" style={{ fontSize: '0.96rem' }}>
                      {t('buyer.purchases.farmer')}: {purchase.supplierName || '—'}
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
                    {purchase.quantity} {t('buyer.requests.units.piece')}
                  </span>
                </div>

                <div className="mb-3 text-muted" style={{ fontSize: '0.95rem' }}>
                  <div>
                    <GeoAlt size={12} className="me-1" />
                    {purchase.placeAddress || purchase.deliveryaddress || t('common.noAddress')}
                  </div>
                  <div className="mt-2">
                    {t('buyer.purchases.total')}: <strong>{Number(purchase.totalPrice || 0).toFixed(0)} ₽</strong>
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
                        {t('common.edit')}
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
                        {t('buyer.purchases.cancel')}
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
                      {t('buyer.purchases.noActions')}
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
              <p>{t('buyer.purchases.empty')}</p>
            </div>
          </Col>
        )}
      </Row>

      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('buyer.purchases.editTitle')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>{t('buyer.profile.deliveryAddress')}</Form.Label>
              <Form.Control
                value={formData.deliveryaddress}
                onChange={(e) => setFormData({ ...formData, deliveryaddress: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t('buyer.profile.phone')}</Form.Label>
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
              <Form.Label>{t('buyer.purchases.paymentMethod')}</Form.Label>
              <Form.Select
                value={formData.paymentmethod}
                onChange={(e) => setFormData({ ...formData, paymentmethod: e.target.value })}
              >
                <option value="">{t('buyer.purchases.payment.none')}</option>
                <option value="cash">{t('buyer.purchases.payment.cash')}</option>
                <option value="card">{t('buyer.purchases.payment.card')}</option>
                <option value="transfer">{t('buyer.purchases.payment.transfer')}</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-0">
              <Form.Label>{t('buyer.requests.comment')}</Form.Label>
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
          <Button variant="light" onClick={() => setShowEditModal(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} style={{ background: theme.green, borderColor: theme.green }}>
            {t('common.save')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default BuyerMyPurchasesPage;