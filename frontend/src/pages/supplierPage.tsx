import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Form,
  Spinner,
  Row,
  Col,
  Alert
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { PersonBadge, PencilSquare, StarFill, Building, CardText } from 'react-bootstrap-icons';
import { ui, chip, btnMain, btnSoft, glassCard } from '../components/supplierUI';
import { getSupplierProfile, updateSupplierProfile } from '../api/supplierProfileApi';

interface SupplierProfileProps {
  userId: number;
}

interface SupplierData {
  id: number;
  name: string;
  rating?: number;
  description?: string;
  isNew?: boolean;
}

const SupplierProfile: React.FC<SupplierProfileProps> = () => {
  const [supplier, setSupplier] = useState<SupplierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState('5.0');

  const fetchSupplierProfile = async () => {
    try {
      setLoading(true);
      const data = await getSupplierProfile();

      if (data.success) {
        setSupplier(data.supplier);
        setName(data.supplier.name || '');
        setDescription(data.supplier.description || '');
        setRating(data.supplier.rating?.toString() || '5.0');

        if (data.isNew) {
          toast.info('Создан новый профиль поставщика');
        }
      } else {
        toast.error(data.message || 'Ошибка загрузки профиля');
      }
    } catch {
      toast.error('Ошибка загрузки профиля');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplierProfile();
  }, []);

  const handleSaveProfile = async () => {
    try {
      setSaving(true);

      const data = await updateSupplierProfile({
        name,
        description,
        rating: parseFloat(rating)
      });

      if (data.success) {
        toast.success('Профиль обновлен');
        setEditing(false);
        fetchSupplierProfile();
      } else {
        toast.error(data.message || 'Ошибка сохранения');
      }
    } catch {
      toast.error('Ошибка сервера');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" style={{ color: ui.green }} />
        <p className="mt-3 mb-0" style={{ color: ui.muted }}>
          Загрузка профиля поставщика...
        </p>
      </div>
    );
  }

  return (
    <Card className="border-0" style={{ ...glassCard(), overflow: 'hidden' }}>
      <Card.Body style={{ padding: '1.35rem' }}>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
          <div>
            <h4 className="mb-1" style={{ color: ui.text }}>
              <PersonBadge className="me-2" style={{ color: ui.green }} />
              Профиль поставщика
            </h4>
            <div style={{ color: ui.muted }}>
              Основная информация о компании и публичное описание
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <span style={chip(ui.blueGraySoft, ui.blueGray)}>ID: {supplier?.id}</span>
            {supplier?.rating ? (
              <span style={chip(ui.goldSoft, ui.gold)}>
                <StarFill size={12} />
                {supplier.rating}/5.0
              </span>
            ) : null}
          </div>
        </div>

        {editing ? (
          <Card className="border-0" style={{ borderRadius: 22, boxShadow: ui.shadowSoft }}>
            <Card.Body>
              <Row className="g-4">
                <Col lg={6}>
                  <Form.Group className="mb-3">
                    <Form.Label style={{ color: ui.text, fontWeight: 600 }}>
                      Название компании
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Введите название компании"
                      style={{ borderColor: ui.border }}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label style={{ color: ui.text, fontWeight: 600 }}>
                      Рейтинг
                    </Form.Label>
                    <Form.Select
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      style={{ borderColor: ui.border }}
                    >
                      <option value="1.0">1.0 - Плохо</option>
                      <option value="2.0">2.0 - Удовлетворительно</option>
                      <option value="3.0">3.0 - Хорошо</option>
                      <option value="4.0">4.0 - Очень хорошо</option>
                      <option value="5.0">5.0 - Отлично</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col lg={6}>
                  <Form.Group>
                    <Form.Label style={{ color: ui.text, fontWeight: 600 }}>
                      Описание
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={7}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Опишите вашу компанию, продукцию и особенности работы"
                      style={{ borderColor: ui.border }}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <Button
                  style={btnSoft()}
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Отмена
                </Button>
                <Button
                  style={btnMain()}
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Сохранение...
                    </>
                  ) : (
                    'Сохранить'
                  )}
                </Button>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <Row className="g-4">
            <Col lg={8}>
              <Card className="border-0 h-100" style={{ borderRadius: 22, boxShadow: ui.shadowSoft }}>
                <Card.Body>
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 18,
                        background: ui.greenSoft,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Building size={24} style={{ color: ui.greenDark }} />
                    </div>

                    <div>
                      <div style={{ color: ui.text, fontSize: '1.2rem', fontWeight: 700 }}>
                        {supplier?.name || 'Название не указано'}
                      </div>
                      <div style={{ color: ui.muted }}>
                        Профиль поставщика на платформе
                      </div>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mb-4">
                    {supplier?.rating ? (
                      <span style={chip(ui.goldSoft, ui.gold)}>
                        <StarFill size={12} />
                        Рейтинг: {supplier.rating}/5.0
                      </span>
                    ) : null}

                    {supplier?.isNew ? (
                      <span style={chip(ui.greenSoft, ui.greenDark)}>
                        Новый профиль
                      </span>
                    ) : null}
                  </div>

                  {supplier?.description ? (
                    <div>
                      <div className="mb-2" style={{ color: ui.text, fontWeight: 700 }}>
                        <CardText className="me-2" style={{ color: ui.green }} />
                        Описание
                      </div>
                      <p className="mb-0" style={{ color: ui.muted, lineHeight: 1.7 }}>
                        {supplier.description}
                      </p>
                    </div>
                  ) : (
                    <Alert
                      className="mb-0"
                      style={{
                        background: ui.blueGraySoft,
                        color: ui.blueGray,
                        border: `1px solid ${ui.border}`
                      }}
                    >
                      Добавьте описание компании, чтобы покупатели лучше понимали ваш профиль.
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col lg={4}>
              <Card className="border-0 h-100" style={{ borderRadius: 22, boxShadow: ui.shadowSoft }}>
                <Card.Body className="d-flex flex-column">
                  <div className="mb-3" style={{ color: ui.text, fontWeight: 700 }}>
                    Действия
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <Button style={btnMain()} onClick={() => setEditing(true)}>
                      <PencilSquare className="me-2" />
                      Редактировать профиль
                    </Button>
                  </div>

                  <div
                    className="mt-4"
                    style={{
                      borderRadius: 16,
                      border: `1px solid ${ui.border}`,
                      background: '#faf9f7',
                      padding: '0.95rem'
                    }}
                  >
                    <div style={{ color: ui.muted, fontSize: '0.92rem' }}>
                      Совет: заполненный профиль и описание повышают доверие покупателей.
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Card.Body>
    </Card>
  );
};

export default SupplierProfile;