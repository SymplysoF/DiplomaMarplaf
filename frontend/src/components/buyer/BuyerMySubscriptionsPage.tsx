import React, { useEffect, useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Badge,
  Spinner,
  Form,
  InputGroup
} from 'react-bootstrap';
import {
  Search,
  PersonCircle,
  Leaf,
  StarFill,
  GeoAlt,
  Heartbreak
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getBuyerSubscriptions, deleteBuyerSubscription } from '../../api/buyerSubscriptionsApi';
import { buyerTheme as theme, softChip } from './buyerTheme';

interface SubscriptionItem {
  id: number;
  created_at: string;
  supplierId: number;
  supplierUserId?: number;
  supplierName: string;
  rating?: number;
  description?: string;
  hasEcoCertificate?: boolean;
  placesCount?: number;
}

const BuyerMySubscriptionsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { t, i18n } = useTranslation();

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await getBuyerSubscriptions();
      if (data.success) {
        setSubscriptions(data.subscriptions || []);
      } else {
        toast.error(data.message || t('buyer.subscriptions.errorLoading'));
      }
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return subscriptions;

    return subscriptions.filter((s) =>
      String(s.supplierName || '').toLowerCase().includes(q) ||
      String(s.description || '').toLowerCase().includes(q)
    );
  }, [subscriptions, searchTerm]);

  const handleUnsubscribe = async (supplierId: number) => {
    if (!window.confirm(t('buyer.subscriptions.unsubscribeConfirm'))) return;

    try {
      const data = await deleteBuyerSubscription(supplierId);
      if (data.success) {
        toast.success(t('buyer.subscriptions.unsubscribed'));
        fetchSubscriptions();
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
          <h5 className="mb-3" style={{ color: theme.text }}>
            {t('buyer.subscriptions.title')}
          </h5>

          <Row className="g-3 align-items-center">
            <Col md={4}>
              <InputGroup>
                <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                  <Search size={14} />
                </InputGroup.Text>
                <Form.Control
                  placeholder={t('buyer.subscriptions.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>

            <Col md={8}>
              <div className="text-muted small">{t('buyer.subscriptions.count')}: {filtered.length}</div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row className="g-4">
        {filtered.map((item) => (
          <Col md={6} xl={4} key={item.id}>
            <Card className="h-100 border-0" style={{ borderRadius: 22, boxShadow: theme.shadow, background: theme.card }}>
              <Card.Body className="p-4 d-flex flex-column">
                <div className="d-flex align-items-start gap-3 mb-3">
                  <PersonCircle size={46} className="text-secondary" />

                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <h4 className="mb-1" style={{ color: theme.text, fontWeight: 700 }}>
                          {item.supplierName}
                        </h4>

                        <div className="text-muted" style={{ fontSize: '0.96rem' }}>
                          {t('buyer.subscriptions.since')} {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      {item.rating !== undefined && (
                        <Badge bg="warning" text="dark" pill>
                          <StarFill size={11} className="me-1" />
                          {Number(item.rating || 0).toFixed(1)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2 mb-3">
                  {item.hasEcoCertificate && (
                    <span style={softChip('#e7f5ea', theme.green)}>
                      <Leaf size={13} className="me-1" />
                      Eco certificate
                    </span>
                  )}

                  <span style={softChip('#eef2f7', '#44546a')}>
                    <GeoAlt size={12} className="me-1" />
                    {t('buyer.subscriptions.places')}: {item.placesCount || 0}
                  </span>
                </div>

                <div className="mb-3 text-muted" style={{ fontSize: '0.95rem' }}>
                  {item.description || t('buyer.subscriptions.noDescription')}
                </div>

                <div className="mt-auto d-flex justify-content-end">
                  <Button
                    onClick={() => handleUnsubscribe(item.supplierId)}
                    style={{
                      borderRadius: 12,
                      background: '#fceaea',
                      color: '#b54747',
                      border: '1px solid #f2d0d0'
                    }}
                  >
                    <Heartbreak size={14} className="me-2" />
                    {t('buyer.subscriptions.unsubscribe')}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}

        {filtered.length === 0 && (
          <Col md={12}>
            <div className="text-center py-5 text-muted">
              <PersonCircle size={48} className="mb-3" />
              <p>{t('buyer.subscriptions.empty')}</p>
            </div>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default BuyerMySubscriptionsPage;