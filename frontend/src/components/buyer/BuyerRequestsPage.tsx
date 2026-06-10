import React, { useEffect, useMemo, useState } from 'react';
import {
  Container, Row, Col, Card, Button, Spinner, Modal, Form, Alert, Table, InputGroup
} from 'react-bootstrap';
import {
  Plus, Pencil, Trash2, Search, Clock, CheckCircle, XCircle, Envelope, Person, BoxSeam, ChatDots,
  PlusCircleFill, ArrowReturnLeft
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import {
  getBuyerRequests,
  createBuyerRequest,
  updateBuyerRequest,
  deleteBuyerRequest,
  getBuyerRequestResponses
} from '../../api/buyerRequestsApi';
import { buyerTheme as theme, softChip } from './buyerTheme';

// ----- Интерфейсы -----
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
  dimension_id?: number;
  dimension_name?: string;
  delivery_date?: string;
  comment?: string;
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

interface NamesObject {
  id: number;
  name: string;
}

interface ProductDimension {
  id: number;
  name: string;
}

// ----- Основной компонент -----
const BuyerRequestsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dbt = (value?: string | null) => value ? t(`db.values.${value}`, { defaultValue: value }) : '—';

  const [requests, setRequests] = useState<BuyerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<BuyerRequest | null>(null);

  // Справочники
  const [objects, setObjects] = useState<NamesObject[]>([]);
  const [dimensions, setDimensions] = useState<ProductDimension[]>([]);
  const [loadingDictionaries, setLoadingDictionaries] = useState(false);

  // Состояние формы
  const [selectedObjectId, setSelectedObjectId] = useState<number>(0);
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [customProductName, setCustomProductName] = useState('');
  const [quantityNeeded, setQuantityNeeded] = useState(1);
  const [maxPriceWhole, setMaxPriceWhole] = useState(0);
  const [maxPriceCopecks, setMaxPriceCopecks] = useState(0);
  const [expiresAt, setExpiresAt] = useState('');
  const [dimensionId, setDimensionId] = useState<number>(3); // по умолчанию 'шт'

  const [deliveryDate, setDeliveryDate] = useState('');
  const [comment, setComment] = useState('');

  // Для просмотра откликов
  const [showResponsesModal, setShowResponsesModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BuyerRequest | null>(null);
  const [responses, setResponses] = useState<FarmerResponse[]>([]);

  // Загрузка запросов и справочников
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getBuyerRequests();
      if (data.success) setRequests(data.requests || []);
      else toast.error(data.message || t('buyer.requests.errorLoading'));
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchObjects = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch('http://localhost:5000/api/objects/names', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        let objectsData = data.data || data.objects || [];
        // Если пришёл массив строк, преобразуем в объекты с id=0, name=строка
        if (Array.isArray(objectsData) && objectsData.length > 0 && typeof objectsData[0] === 'string') {
          objectsData = objectsData.map((name, idx) => ({ id: idx + 1, name }));
        }
        setObjects(objectsData);
      }
    } catch (error) {
      console.error('Ошибка загрузки объектов', error);
    }
  };

  const fetchDimensions = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch('http://localhost:5000/api/dimensions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const dims = data.data || [];
        setDimensions(dims);
      }
    } catch (error) {
      console.error('Ошибка загрузки единиц измерения', error);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchObjects();
    fetchDimensions();
  }, []);

  // Открыть модалку на создание
  const handleOpenCreate = () => {
    setDeliveryDate('');
    setComment('');
    setEditingRequest(null);
    setSelectedObjectId(0);
    setIsCustomProduct(false);
    setCustomProductName('');
    setQuantityNeeded(1);
    setMaxPriceWhole(0);
    setMaxPriceCopecks(0);
    setExpiresAt('');
    setDimensionId(3);
    setShowModal(true);
  };

  // Открыть модалку на редактирование
  const handleOpenEdit = (request: BuyerRequest) => {
    setEditingRequest(request);
    setDeliveryDate(request.delivery_date?.slice(0, 16) || '');
    setComment(request.comment || '');

    const isFromCatalog = request.object_id && request.object_id > 0;
    setIsCustomProduct(!isFromCatalog);
    if (isFromCatalog) {
      setSelectedObjectId(request.object_id);
      setCustomProductName('');
    } else {
      setSelectedObjectId(0);
      setCustomProductName(request.product_name);
    }
    setQuantityNeeded(request.quantity_needed);
    setMaxPriceWhole(request.max_price_whole);
    setMaxPriceCopecks(request.max_price_copecks);
    setExpiresAt(request.expires_at?.slice(0, 16) || '');
    setDimensionId(request.dimension_id || 3);
    setShowModal(true);
  };

  // Сохранение (создание или обновление)
  const handleSave = async () => {
    let finalProductName = '';
    let finalObjectId = 0;
    if (!isCustomProduct && selectedObjectId) {
      const selectedObj = objects.find(o => o.id === selectedObjectId);
      if (!selectedObj) {
        toast.error(t('buyer.requests.selectProductError'));
        return;
      }
      finalProductName = selectedObj.name;
      finalObjectId = selectedObjectId;
    } else {
      if (!customProductName.trim()) {
        toast.error(t('buyer.requests.enterProductNameError'));
        return;
      }
      finalProductName = customProductName.trim();
      finalObjectId = 0;
    }

    if (!quantityNeeded || quantityNeeded <= 0) {
      toast.error(t('buyer.requests.quantityError'));
      return;
    }
    if (!expiresAt) {
      toast.error(t('buyer.requests.expiresAtError'));
      return;
    }
    if (!dimensionId) {
      toast.error(t('buyer.requests.unitError'));
      return;
    }

    const payload = {
      product_name: finalProductName,
      object_id: finalObjectId === 0 ? null : finalObjectId,
      quantity_needed: quantityNeeded,
      max_price_whole: maxPriceWhole,
      delivery_date: deliveryDate || null,
      comment: comment || null,
      max_price_copecks: maxPriceCopecks,
      expires_at: expiresAt,
      dimension_id: dimensionId
    };

    try {
      let data;
      if (editingRequest) {
        data = await updateBuyerRequest(editingRequest.id, payload);
      } else {
        data = await createBuyerRequest(payload);
      }
      if (data.success) {
        toast.success(editingRequest ? t('buyer.requests.updated') : t('buyer.requests.created'));
        setShowModal(false);
        fetchRequests();
      } else {
        toast.error(data.message || t('buyer.requests.saveError'));
      }
    } catch (error) {
      toast.error(t('common.serverError'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('buyer.requests.deleteConfirm'))) return;
    try {
      const data = await deleteBuyerRequest(id);
      if (data.success) {
        toast.success(t('buyer.requests.deleted'));
        fetchRequests();
      } else {
        toast.error(data.message || t('common.error'));
      }
    } catch {
      toast.error(t('common.serverError'));
    }
  };

  const handleViewResponses = async (request: BuyerRequest) => {
    setSelectedRequest(request);
    setShowResponsesModal(true);
    try {
      const data = await getBuyerRequestResponses(request.id);
      if (data.success) setResponses(data.responses || []);
      else setResponses([]);
    } catch {
      toast.error(t('buyer.requests.responsesError'));
    }
  };

  const formatPrice = (whole: number, copecks = 0) =>
    new Intl.NumberFormat(i18n.language || 'ru-RU', { style: 'currency', currency: 'RUB' }).format(whole + copecks / 100);

  const filteredRequests = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return requests.filter((r) =>
      !searchTerm ||
      r.product_name.toLowerCase().includes(q) ||
      r.object_name?.toLowerCase().includes(q)
    );
  }, [requests, searchTerm]);

  if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;

  return (
    <div style={{ background: theme.bg, borderRadius: 24, padding: 4 }}>
      <Container fluid className="px-0">
        <Row className="mb-4 align-items-center">
          <Col>
            <h4 style={{ color: theme.text }}>
              <Envelope className="me-2" />
              {t('buyer.requests.title')}
            </h4>
          </Col>
          <Col className="text-end">
            <Button onClick={handleOpenCreate} style={{ background: theme.green, borderColor: theme.green, borderRadius: 12 }}>
              <PlusCircleFill className="me-2" />
              {t('buyer.requests.newRequest')}
            </Button>
          </Col>
        </Row>

        <Card className="border-0 mb-4" style={{ borderRadius: 20, boxShadow: theme.shadow }}>
          <Card.Body>
            <InputGroup>
              <InputGroup.Text style={{ background: '#fff', borderColor: theme.border }}>
                <Search />
              </InputGroup.Text>
              <Form.Control
                placeholder={t('buyer.requests.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ borderColor: theme.border }}
              />
            </InputGroup>
          </Card.Body>
        </Card>

        {filteredRequests.length === 0 ? (
          <Alert variant="light" className="border text-center py-5">
            <BoxSeam size={42} className="mb-3" />
            <h5>{t('buyer.requests.noRequests')}</h5>
          </Alert>
        ) : (
          <Row className="g-4">
            {filteredRequests.map((request) => (
              <Col lg={6} key={request.id}>
                <Card className="border-0 h-100" style={{ borderRadius: 20, boxShadow: theme.shadow }}>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                      <div>
                        <h5 className="mb-1" style={{ color: theme.text }}>{dbt(request.product_name)}</h5>
                        <div style={{ color: theme.muted }}>{dbt(request.object_name)}</div>
                      </div>
                      <div>
                        {request.status === 'active' && (
                          <span style={softChip(theme.greenSoft, theme.green)}>
                            <Clock size={12} /> {t('buyer.requests.status.active')}
                          </span>
                        )}
                        {request.status === 'fulfilled' && (
                          <span style={softChip(theme.blue, theme.blue)}>
                            <CheckCircle size={12} /> {t('buyer.requests.status.fulfilled')}
                          </span>
                        )}
                        {request.status === 'expired' && (
                          <span style={softChip(theme.red, theme.red)}>
                            <XCircle size={12} /> {t('buyer.requests.status.expired')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-2" style={{ color: theme.muted }}>
                      {t('buyer.requests.quantityNeeded')}: <strong>{request.quantity_needed}</strong>
                    </div>
                    <div className="mb-2" style={{ color: theme.muted }}>
                      {t('buyer.requests.maxPrice')}: <strong>{formatPrice(request.max_price_whole, request.max_price_copecks)}</strong>
                    </div>
                    <div className="mb-2" style={{ color: theme.muted }}>
                      {t('buyer.requests.unit')}: <strong>{request.dimension_name ? dbt(request.dimension_name) : t('buyer.requests.units.piece')}</strong>
                    </div>
                    {request.delivery_date && (
                      <div className="mb-2" style={{ color: theme.muted }}>
                        {t('buyer.requests.desiredDate')}: <strong>{new Date(request.delivery_date).toLocaleString(i18n.language || 'ru-RU')}</strong>
                      </div>
                    )}
                    {request.comment && (
                      <div className="mb-2" style={{ color: theme.muted }}>
                        {t('buyer.requests.comment')}: <strong>{request.comment}</strong>
                      </div>
                    )}
                    <div className="mb-3" style={{ color: theme.muted }}>
                      {t('buyer.requests.validUntil')}: <strong>{new Date(request.expires_at).toLocaleString(i18n.language || 'ru-RU')}</strong>
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                      <Button variant="light" onClick={() => handleViewResponses(request)} style={{ borderRadius: 12 }}>
                        <ChatDots className="me-2" />
                        {t('buyer.requests.responses')}
                      </Button>
                      <Button variant="light" onClick={() => handleOpenEdit(request)} style={{ borderRadius: 12 }}>
                        <Pencil className="me-2" />
                        {t('common.edit')}
                      </Button>
                      <Button variant="light" onClick={() => handleDelete(request.id)} style={{ borderRadius: 12, color: theme.red }}>
                        <Trash2 className="me-2" />
                        {t('common.delete')}
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Модальное окно создания/редактирования */}
        <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
          <Modal.Header closeButton>
            <Modal.Title>{editingRequest ? t('buyer.requests.editRequest') : t('buyer.requests.newRequest')}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>{t('buyer.requests.desiredDate')}</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('buyer.requests.commentLabel')}</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('buyer.requests.commentPlaceholder')}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{t('buyer.requests.product')}</Form.Label>
                {!isCustomProduct ? (
                  <>
                    <Form.Select
                      value={selectedObjectId}
                      onChange={(e) => setSelectedObjectId(Number(e.target.value))}
                    >
                      <option value={0}>-- {t('buyer.requests.selectProduct')} --</option>
                      {objects.map(obj => (
                        <option key={obj.id} value={obj.id}>{dbt(obj.name)}</option>
                      ))}
                    </Form.Select>
                    <div className="mt-2 text-end">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setIsCustomProduct(true)}
                        style={{ color: theme.green }}
                      >
                        <PlusCircleFill className="me-1" size={14} />
                        {t('buyer.requests.addManually')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Form.Control
                      type="text"
                      placeholder={t('buyer.requests.enterProductName')}
                      value={customProductName}
                      onChange={(e) => setCustomProductName(e.target.value)}
                    />
                    <div className="mt-2 text-end">
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setIsCustomProduct(false)}
                        style={{ color: theme.green }}
                      >
                        <ArrowReturnLeft className="me-1" size={14} />
                        {t('buyer.requests.selectFromList')}
                      </Button>
                    </div>
                  </>
                )}
              </Form.Group>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('buyer.requests.quantity')}</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={quantityNeeded}
                      onChange={(e) => setQuantityNeeded(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('buyer.requests.unit')}</Form.Label>
                    <Form.Select
                      value={dimensionId}
                      onChange={(e) => setDimensionId(Number(e.target.value))}
                    >
                      {dimensions.map(dim => (
                        <option key={dim.id} value={dim.id}>{dbt(dim.name)}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('buyer.requests.maxPriceRub')}</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      value={maxPriceWhole}
                      onChange={(e) => setMaxPriceWhole(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('buyer.requests.kopecks')}</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      max={99}
                      value={maxPriceCopecks}
                      onChange={(e) => setMaxPriceCopecks(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>{t('buyer.requests.validUntil')}</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowModal(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} style={{ background: theme.green, borderColor: theme.green }}>
              {t('common.save')}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Модалка откликов */}
        <Modal show={showResponsesModal} onHide={() => setShowResponsesModal(false)} size="lg" centered>
          <Modal.Header closeButton>
            <Modal.Title>{t('buyer.requests.responsesFor')}: {dbt(selectedRequest?.product_name)}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {responses.length === 0 ? (
              <Alert variant="light">{t('buyer.requests.noResponses')}</Alert>
            ) : (
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('buyer.requests.farmer')}</th>
                    <th>{t('buyer.requests.price')}</th>
                    <th>{t('buyer.requests.quantity')}</th>
                    <th>{t('buyer.requests.delivery')}</th>
                    <th>{t('buyer.requests.comment')}</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response) => (
                    <tr key={response.id}>
                      <td><Person className="me-2" />{response.supplier_name}</td>
                      <td>{formatPrice(response.offered_price_whole, response.offered_price_copecks)}</td>
                      <td>{response.estimated_quantity}</td>
                      <td>{response.delivery_days} {t('buyer.requests.days')}</td>
                      <td>{response.response_text || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Modal.Body>
        </Modal>
      </Container>
    </div>
  );
};

export default BuyerRequestsPage;