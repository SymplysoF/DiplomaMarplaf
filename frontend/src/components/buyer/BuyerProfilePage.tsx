import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Badge, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { Person, Envelope, Telephone, GeoAlt, CheckCircle, Pencil } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getBuyerProfile, updateBuyerProfile, BuyerProfile } from '../../api/buyerProfileApi';
import { buyerTheme as theme } from './buyerTheme';

const BuyerProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ deliveryaddress: '', contactphone: '' });
  const { t, i18n } = useTranslation();

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await getBuyerProfile();
      if (data.success) {
        setProfile(data.profile);
        setFormData({
          deliveryaddress: data.profile.deliveryaddress || '',
          contactphone: data.profile.contactphone || ''
        });
      } else {
        toast.error(data.message || t('buyer.profile.errorLoading'));
      }
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const data = await updateBuyerProfile(formData);
      if (data.success) {
        toast.success(t('buyer.profile.updated'));
        setEditing(false);
        fetchProfile();
      } else {
        toast.error(data.message || t('common.error'));
      }
    } catch {
      toast.error(t('common.serverError'));
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (!profile) return <Alert variant="danger">{t('buyer.profile.notFound')}</Alert>;

  return (
    <div style={{ background: theme.bg, borderRadius: 24, padding: 4 }}>
      <Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}>
        <Card.Body className="p-4">
          <Row className="g-4 align-items-start">
            <Col md={4} className="text-center">
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: '#f1f3f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}
              >
                <Person size={64} className="text-secondary" />
              </div>

              <h4 style={{ color: theme.text }}>{profile.username}</h4>

              <Badge bg="success" className="mt-2">
                <CheckCircle className="me-1" />
                {t('buyer.profile.active')}
              </Badge>
            </Col>

            <Col md={8}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0" style={{ color: theme.text }}>{t('buyer.profile.contactData')}</h5>
                {!editing && (
                  <Button
                    onClick={() => setEditing(true)}
                    style={{ borderRadius: 12, background: theme.green, borderColor: theme.green }}
                  >
                    <Pencil className="me-2" />
                    {t('common.edit')}
                  </Button>
                )}
              </div>

              {!editing ? (
                <div className="d-flex flex-column gap-3">
                  <div><Envelope className="me-2" /> {profile.email}</div>
                  <div><Telephone className="me-2" /> {profile.contactphone || t('common.notSpecified')}</div>
                  <div><GeoAlt className="me-2" /> {profile.deliveryaddress || t('common.notSpecified')}</div>
                </div>
              ) : (
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('buyer.profile.phone')}</Form.Label>
                    <Form.Control
                      value={formData.contactphone}
                      onChange={(e) => setFormData({ ...formData, contactphone: e.target.value })}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>{t('buyer.profile.deliveryAddress')}</Form.Label>
                    <Form.Control
                      value={formData.deliveryaddress}
                      onChange={(e) => setFormData({ ...formData, deliveryaddress: e.target.value })}
                    />
                  </Form.Group>

                  <div className="d-flex gap-2">
                    <Button onClick={handleSave} style={{ background: theme.green, borderColor: theme.green }}>
                      {t('common.save')}
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </Form>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default BuyerProfilePage;