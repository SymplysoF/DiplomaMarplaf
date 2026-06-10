import React, { useEffect, useMemo, useState } from 'react';
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
  InputGroup,
  Tabs,
  Tab
} from 'react-bootstrap';
import {
  Envelope,
  Search,
  ChatDots,
  Clock,
  CheckCircle,
  XCircle,
  Person,
  BoxSeam,
  Send,
  Pencil,
  CurrencyDollar,
  CalendarEvent,
  Truck,
  GeoAlt
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

interface SupplierCustomerRequestsTabProps {
  refreshTrigger?: number;
}

interface CustomerRequest {
  id: number;
  buyer_id: number;
  buyer_name?: string;
  product_name: string;
  object_id?: number | null;
  object_name?: string | null;
  quantity_needed: number;
  dimension_id?: number;
  dimension_name?: string;
  max_price_whole: number;
  max_price_copecks: number;
  delivery_date?: string | null;
  expires_at: string;
  comment?: string | null;
  status: 'active' | 'fulfilled' | 'expired';
  created_at: string;
}

interface SupplierResponse {
  id: number;
  request_id: number;
  supplier_id: number;
  supplier_name?: string;
  offered_price_whole: number;
  offered_price_copecks: number;
  estimated_quantity: number;
  delivery_days: number;
  response_text?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

const SupplierCustomerRequestsTab: React.FC<SupplierCustomerRequestsTabProps> = ({
  refreshTrigger
}) => {
  const { t } = useTranslation();

  const theme = {
    bg: '#f7f5f0',
    card: '#ffffff',
    border: '#e8e1d5',
    text: '#243126',
    muted: '#6d786f',
    green: '#2f6b3a',
    greenDark: '#234f2b',
    greenSoft: '#dceadf',
    purple: '#6c56d9',
    purpleSoft: '#f0ebff',
    gold: '#9a6b00',
    goldSoft: '#f8edd6',
    blue: '#44546a',
    blueSoft: '#eef2f7',
    red: '#c2410c',
    redSoft: '#fde7df',
    shadow: '0 14px 36px rgba(34,49,39,0.08)',
    shadowSoft: '0 8px 22px rgba(34,49,39,0.06)'
  };

  const softChip = (bg: string, color: string): React.CSSProperties => ({
    background: bg,
    color,
    borderRadius: 999,
    padding: '0.4rem 0.72rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${theme.border}`
  });

  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [myResponses, setMyResponses] = useState<SupplierResponse[]>([]);
  const [responsesForRequest, setResponsesForRequest] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'fulfilled' | 'expired'>('all');

  const [showRespondModal, setShowRespondModal] = useState(false);
  const [showResponsesModal, setShowResponsesModal] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState<CustomerRequest | null>(null);
  const [editingResponse, setEditingResponse] = useState<SupplierResponse | null>(null);

  const [offeredPriceWhole, setOfferedPriceWhole] = useState<number>(0);
  const [offeredPriceCopecks, setOfferedPriceCopecks] = useState<number>(0);
  const [estimatedQuantity, setEstimatedQuantity] = useState<number>(1);
  const [deliveryDays, setDeliveryDays] = useState<number>(1);
  const [responseText, setResponseText] = useState<string>('');

  const formatPrice = (whole: number, copecks = 0) =>
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(whole + copecks / 100);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch('http://localhost:5000/api/supplier/customer-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        setRequests(data.requests || []);
      } else {
        toast.error(data.message || t('supplier.requests.errorLoading'));
      }
    } catch (error) {
      console.error(error);
      toast.error(t('supplier.requests.errorLoading'));
    }
  };

  const fetchMyResponses = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch('http://localhost:5000/api/supplier/customer-requests/my-responses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        setMyResponses(data.responses || []);
      } else {
        toast.error(data.message || t('supplier.requests.errorLoadingMyResponses'));
      }
    } catch (error) {
      console.error(error);
      toast.error(t('supplier.requests.errorLoadingMyResponses'));
    }
  };

  const fetchResponsesForRequest = async (requestId: number) => {
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch(`http://localhost:5000/api/supplier/customer-requests/${requestId}/responses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        setResponsesForRequest(data.responses || []);
      } else {
        setResponsesForRequest([]);
        toast.error(data.message || t('supplier.requests.errorLoadingResponses'));
      }
    } catch (error) {
      console.error(error);
      setResponsesForRequest([]);
      toast.error(t('supplier.requests.errorLoadingResponses'));
    }
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchRequests(), fetchMyResponses()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [refreshTrigger]);

  const myResponseMap = useMemo(() => {
    const map = new Map<number, SupplierResponse>();
    for (const response of myResponses) {
      map.set(response.request_id, response);
    }
    return map;
  }, [myResponses]);

  const filteredRequests = useMemo(() => {
    const q = searchTerm.toLowerCase();

    return requests.filter((request) => {
      const matchesSearch =
        !searchTerm ||
        request.product_name?.toLowerCase().includes(q) ||
        request.object_name?.toLowerCase().includes(q) ||
        request.buyer_name?.toLowerCase().includes(q) ||
        request.comment?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const handleOpenRespond = (request: CustomerRequest) => {
    setSelectedRequest(request);

    const existingResponse = myResponseMap.get(request.id) || null;
    setEditingResponse(existingResponse);

    if (existingResponse) {
      setOfferedPriceWhole(existingResponse.offered_price_whole);
      setOfferedPriceCopecks(existingResponse.offered_price_copecks);
      setEstimatedQuantity(existingResponse.estimated_quantity);
      setDeliveryDays(existingResponse.delivery_days);
      setResponseText(existingResponse.response_text || '');
    } else {
      setOfferedPriceWhole(0);
      setOfferedPriceCopecks(0);
      setEstimatedQuantity(request.quantity_needed || 1);
      setDeliveryDays(1);
      setResponseText('');
    }

    setShowRespondModal(true);
  };

  const handleViewResponses = async (request: CustomerRequest) => {
    setSelectedRequest(request);
    setShowResponsesModal(true);
    await fetchResponsesForRequest(request.id);
  };

  const handleSaveResponse = async () => {
    if (!selectedRequest) return;

    if (estimatedQuantity <= 0) {
      toast.error(t('supplier.requests.invalidQuantity'));
      return;
    }

    if (deliveryDays < 0) {
      toast.error(t('supplier.requests.invalidDeliveryDays'));
      return;
    }

    const payload = {
      offered_price_whole: offeredPriceWhole,
      offered_price_copecks: offeredPriceCopecks,
      estimated_quantity: estimatedQuantity,
      delivery_days: deliveryDays,
      response_text: responseText
    };

    try {
      const token = localStorage.getItem('userToken');

      const url = editingResponse
        ? `http://localhost:5000/api/supplier/customer-requests/responses/${editingResponse.id}`
        : `http://localhost:5000/api/supplier/customer-requests/${selectedRequest.id}/respond`;

      const method = editingResponse ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingResponse ? t('supplier.requests.responseUpdated') : t('supplier.requests.responseSent'));
        setShowRespondModal(false);
        await fetchAll();
      } else {
        toast.error(data.message || t('supplier.requests.responseSaveError'));
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.serverError'));
    }
  };

  if (loading) {
    return (
      <Container fluid className="px-0">
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ minHeight: '50vh' }}
        >
          <div className="text-center">
            <Spinner animation="border" style={{ color: theme.green }} />
            <p className="mt-3 mb-0" style={{ color: theme.muted }}>
              {t('supplier.requests.loading')}
            </p>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <div style={{ background: theme.bg, borderRadius: 24, padding: 4 }}>
      <Container fluid className="px-0">
        <Row className="mb-4 align-items-center">
          <Col>
            <h4 style={{ color: theme.text, fontWeight: 800 }}>
              {/* <Envelope className="me-2" /> */}
              {t('supplier.requests.title')}
            </h4>
            <div style={{ color: theme.muted }}>
              {t('supplier.requests.subtitle')}
            </div>
          </Col>
        </Row>

        <Card
          className="border-0 mb-4"
          style={{ borderRadius: 20, boxShadow: theme.shadowSoft }}
        >
          <Card.Body>
            <Row className="g-3">
              <Col lg={8}>
                <InputGroup>
                  <InputGroup.Text
                    style={{ background: '#fff', borderColor: theme.border }}
                  >
                    <Search />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder={t('supplier.requests.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ borderColor: theme.border }}
                  />
                </InputGroup>
              </Col>
              <Col lg={4}>
                <Form.Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  style={{ borderColor: theme.border, borderRadius: 12 }}
                >
                  <option value="all">{t('supplier.requests.status.all')}</option>
                  <option value="active">{t('supplier.requests.status.active')}</option>
                  <option value="fulfilled">{t('supplier.requests.status.fulfilled')}</option>
                  <option value="expired">{t('supplier.requests.status.expired')}</option>
                </Form.Select>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Tabs
          defaultActiveKey="all-requests"
          id="supplier-requests-inner-tabs"
          className="supplier-requests-inner-tabs mb-4"
        >
          <Tab eventKey="all-requests" title={t('supplier.requests.tabs.allRequests')}>
            <div className="pt-2">
              {filteredRequests.length === 0 ? (
                <Alert
                  variant="light"
                  className="border text-center py-5"
                  style={{ borderRadius: 20 }}
                >
                  <BoxSeam size={42} className="mb-3" />
                  <h5>{t('supplier.requests.noRequests')}</h5>
                </Alert>
              ) : (
                <Row className="g-4">
                  {filteredRequests.map((request) => {
                    const myResponse = myResponseMap.get(request.id);

                    return (
                      <Col lg={6} key={request.id}>
                        <Card
                          className="border-0 h-100"
                          style={{
                            borderRadius: 20,
                            boxShadow: theme.shadowSoft
                          }}
                        >
                          <Card.Body>
                            <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                              <div>
                                <h5
                                  className="mb-1"
                                  style={{ color: theme.text, fontWeight: 800 }}
                                >
                                  {request.product_name}
                                </h5>
                                <div style={{ color: theme.muted }}>
                                  {request.object_name || t('supplier.requests.productWithoutObject')}
                                </div>
                                {request.buyer_name && (
                                  <div
                                    style={{
                                      color: theme.muted,
                                      fontSize: '0.92rem',
                                      marginTop: 6
                                    }}
                                  >
                                    <Person className="me-1" />
                                    {t('supplier.requests.buyer')}: {request.buyer_name}
                                  </div>
                                )}
                              </div>

                              <div className="d-flex flex-column gap-2 align-items-end">
                                {request.status === 'active' && (
                                  <span style={softChip(theme.greenSoft, theme.green)}>
                                    <Clock size={12} /> {t('supplier.requests.status.active')}
                                  </span>
                                )}
                                {request.status === 'fulfilled' && (
                                  <span style={softChip(theme.blueSoft, theme.blue)}>
                                    <CheckCircle size={12} /> {t('supplier.requests.status.fulfilled')}
                                  </span>
                                )}
                                {request.status === 'expired' && (
                                  <span style={softChip(theme.redSoft, theme.red)}>
                                    <XCircle size={12} /> {t('supplier.requests.status.expired')}
                                  </span>
                                )}
                                {myResponse && (
                                  <span style={softChip(theme.purpleSoft, theme.purple)}>
                                    <ChatDots size={12} /> {t('supplier.requests.hasMyResponse')}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mb-2" style={{ color: theme.muted }}>
                              {t('supplier.requests.quantityNeeded')}:{' '}
                              <strong>
                                {request.quantity_needed} {request.dimension_name || t('supplier.requests.units.piece')}
                              </strong>
                            </div>

                            <div className="mb-2" style={{ color: theme.muted }}>
                              {t('supplier.requests.maxPrice')}:{' '}
                              <strong>
                                {formatPrice(request.max_price_whole, request.max_price_copecks)}
                              </strong>
                            </div>

                            {request.delivery_date && (
                              <div className="mb-2" style={{ color: theme.muted }}>
                                <CalendarEvent className="me-2" />
                                {t('supplier.requests.desiredDate')}:{' '}
                                <strong>
                                  {new Date(request.delivery_date).toLocaleString('ru-RU')}
                                </strong>
                              </div>
                            )}

                            <div className="mb-2" style={{ color: theme.muted }}>
                              {t('supplier.requests.validUntil')}:{' '}
                              <strong>
                                {new Date(request.expires_at).toLocaleString('ru-RU')}
                              </strong>
                            </div>

                            {request.comment && (
                              <div
                                className="mb-3"
                                style={{
                                  color: theme.muted,
                                  background: theme.bg,
                                  border: `1px solid ${theme.border}`,
                                  borderRadius: 14,
                                  padding: '0.8rem'
                                }}
                              >
                                {request.comment}
                              </div>
                            )}

                            {myResponse && (
                              <div
                                className="mb-3"
                                style={{
                                  background: '#faf8ff',
                                  border: `1px solid ${theme.border}`,
                                  borderRadius: 14,
                                  padding: '0.8rem'
                                }}
                              >
                                <div
                                  className="fw-bold mb-2"
                                  style={{ color: theme.purple }}
                                >
                                  {t('supplier.requests.yourResponse')}
                                </div>
                                <div style={{ color: theme.muted, fontSize: '0.94rem' }}>
                                  {t('supplier.requests.price')}:{' '}
                                  <strong>
                                    {formatPrice(
                                      myResponse.offered_price_whole,
                                      myResponse.offered_price_copecks
                                    )}
                                  </strong>
                                </div>
                                <div style={{ color: theme.muted, fontSize: '0.94rem' }}>
                                  {t('supplier.requests.quantity')}:{' '}
                                  <strong>{myResponse.estimated_quantity}</strong>
                                </div>
                                <div style={{ color: theme.muted, fontSize: '0.94rem' }}>
                                  {t('supplier.requests.deliveryDays')}:{' '}
                                  <strong>{myResponse.delivery_days} {t('supplier.requests.daysShort')}</strong>
                                </div>
                              </div>
                            )}

                            <div className="d-flex flex-wrap gap-2">
                              <Button
                                variant="light"
                                onClick={() => handleViewResponses(request)}
                                style={{ borderRadius: 12 }}
                              >
                                <ChatDots className="me-2" />
                                {t('supplier.requests.allResponses')}
                              </Button>

                              <Button
                                onClick={() => handleOpenRespond(request)}
                                style={{
                                  background: theme.green,
                                  borderColor: theme.green,
                                  borderRadius: 12
                                }}
                              >
                                {myResponse ? (
                                  <>
                                    <Pencil className="me-2" />
                                    {t('supplier.requests.editResponse')}
                                  </>
                                ) : (
                                  <>
                                    <Send className="me-2" />
                                    {t('supplier.requests.respond')}
                                  </>
                                )}
                              </Button>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </div>
          </Tab>

          <Tab eventKey="my-responses" title={`${t('supplier.requests.tabs.myResponses')} (${myResponses.length})`}>
            <div className="pt-2">
              {myResponses.length === 0 ? (
                <Alert
                  variant="light"
                  className="border text-center py-5"
                  style={{ borderRadius: 20 }}
                >
                  <ChatDots size={42} className="mb-3" />
                  <h5>{t('supplier.requests.noMyResponses')}</h5>
                </Alert>
              ) : (
                <Row className="g-4">
                  {myResponses.map((response) => {
                    const request = requests.find((r) => r.id === response.request_id);

                    return (
                      <Col lg={6} key={response.id}>
                        <Card
                          className="border-0 h-100"
                          style={{ borderRadius: 20, boxShadow: theme.shadowSoft }}
                        >
                          <Card.Body>
                            <div className="d-flex justify-content-between align-items-start mb-3">
                              <div>
                                <h5
                                  className="mb-1"
                                  style={{ color: theme.text, fontWeight: 800 }}
                                >
                                  {request?.product_name || `${t('supplier.requests.request')} #${response.request_id}`}
                                </h5>
                                <div style={{ color: theme.muted }}>
                                  {t('supplier.requests.buyer')}: {request?.buyer_name || '—'}
                                </div>
                              </div>

                              <div>
                                {response.status === 'pending' && (
                                  <span style={softChip(theme.goldSoft, theme.gold)}>
                                    <Clock size={12} /> {t('supplier.requests.responseStatus.pending')}
                                  </span>
                                )}
                                {response.status === 'accepted' && (
                                  <span style={softChip(theme.greenSoft, theme.green)}>
                                    <CheckCircle size={12} /> {t('supplier.requests.responseStatus.accepted')}
                                  </span>
                                )}
                                {response.status === 'rejected' && (
                                  <span style={softChip(theme.redSoft, theme.red)}>
                                    <XCircle size={12} /> {t('supplier.requests.responseStatus.rejected')}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mb-2" style={{ color: theme.muted }}>
                              <CurrencyDollar className="me-2" />
                              {t('supplier.requests.price')}:{' '}
                              <strong>
                                {formatPrice(
                                  response.offered_price_whole,
                                  response.offered_price_copecks
                                )}
                              </strong>
                            </div>

                            <div className="mb-2" style={{ color: theme.muted }}>
                              {t('supplier.requests.quantity')}: <strong>{response.estimated_quantity}</strong>
                            </div>

                            <div className="mb-2" style={{ color: theme.muted }}>
                              <Truck className="me-2" />
                              {t('supplier.requests.deliveryDays')}: <strong>{response.delivery_days} {t('supplier.requests.daysShort')}</strong>
                            </div>

                            {response.response_text && (
                              <div
                                className="mb-3"
                                style={{
                                  background: theme.bg,
                                  border: `1px solid ${theme.border}`,
                                  borderRadius: 14,
                                  padding: '0.8rem',
                                  color: theme.muted
                                }}
                              >
                                {response.response_text}
                              </div>
                            )}

                            <div className="d-flex gap-2 flex-wrap">
                              {request && (
                                <>
                                  <Button
                                    variant="light"
                                    onClick={() => handleViewResponses(request)}
                                    style={{ borderRadius: 12 }}
                                  >
                                    <ChatDots className="me-2" />
                                    {t('supplier.requests.allResponses')}
                                  </Button>
                                  <Button
                                    onClick={() => handleOpenRespond(request)}
                                    style={{
                                      background: theme.green,
                                      borderColor: theme.green,
                                      borderRadius: 12
                                    }}
                                  >
                                    <Pencil className="me-2" />
                                    {t('common.edit')}
                                  </Button>
                                </>
                              )}
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </div>
          </Tab>
        </Tabs>

        <Modal show={showRespondModal} onHide={() => setShowRespondModal(false)} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {editingResponse ? t('supplier.requests.editResponse') : t('supplier.requests.respond')}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedRequest && (
              <div
                className="mb-3"
                style={{
                  background: theme.bg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 16,
                  padding: '1rem'
                }}
              >
                <div className="fw-bold" style={{ color: theme.text }}>
                  {selectedRequest.product_name}
                </div>
                <div style={{ color: theme.muted }}>
                  {t('supplier.requests.buyer')}: {selectedRequest.buyer_name || '—'}
                </div>
                <div style={{ color: theme.muted }}>
                  {t('supplier.requests.needed')}: {selectedRequest.quantity_needed} {selectedRequest.dimension_name || t('supplier.requests.units.piece')}
                </div>
              </div>
            )}

            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('supplier.requests.priceRub')}</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      value={offeredPriceWhole}
                      onChange={(e) => setOfferedPriceWhole(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('supplier.requests.kopecks')}</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      max={99}
                      value={offeredPriceCopecks}
                      onChange={(e) => setOfferedPriceCopecks(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('supplier.requests.availableQuantity')}</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      value={estimatedQuantity}
                      onChange={(e) => setEstimatedQuantity(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>{t('supplier.requests.deliveryDaysLabel')}</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      value={deliveryDays}
                      onChange={(e) => setDeliveryDays(Number(e.target.value))}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-0">
                <Form.Label>{t('supplier.requests.comment')}</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder={t('supplier.requests.commentPlaceholder')}
                />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowRespondModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSaveResponse}
              style={{ background: theme.green, borderColor: theme.green }}
            >
              {editingResponse ? t('common.save') : t('supplier.requests.sendResponse')}
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal show={showResponsesModal} onHide={() => setShowResponsesModal(false)} centered size="xl">
          <Modal.Header closeButton>
            <Modal.Title>
              {t('supplier.requests.responsesFor')}: {selectedRequest?.product_name}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {responsesForRequest.length === 0 ? (
              <Alert variant="light" className="mb-0">
                {t('supplier.requests.noResponsesYet')}
              </Alert>
            ) : (
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>{t('supplier.requests.farmer')}</th>
                    <th>{t('supplier.requests.price')}</th>
                    <th>{t('supplier.requests.quantity')}</th>
                    <th>{t('supplier.requests.delivery')}</th>
                    <th>{t('supplier.requests.comment')}</th>
                    <th>{t('supplier.requests.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {responsesForRequest.map((response) => (
                    <tr key={response.id}>
                      <td>
                        <Person className="me-2" />
                        {response.supplier_name || `${t('supplier.requests.farmer')} #${response.supplier_id}`}
                      </td>
                      <td>
                        {formatPrice(
                          response.offered_price_whole,
                          response.offered_price_copecks
                        )}
                      </td>
                      <td>{response.estimated_quantity}</td>
                      <td>{response.delivery_days} {t('supplier.requests.daysShort')}</td>
                      <td>{response.response_text || '—'}</td>
                      <td>
                        {response.status === 'pending' && t('supplier.requests.responseStatus.pending')}
                        {response.status === 'accepted' && t('supplier.requests.responseStatus.accepted')}
                        {response.status === 'rejected' && t('supplier.requests.responseStatus.rejected')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Modal.Body>
        </Modal>

        <style>{`
          .supplier-requests-inner-tabs.nav-tabs {
            border-bottom: none;
            gap: 10px;
            display: flex;
            flex-wrap: wrap;
          }

          .supplier-requests-inner-tabs .nav-link {
            border: 1px solid ${theme.border};
            border-radius: 14px !important;
            color: ${theme.text};
            font-weight: 600;
            padding: 0.72rem 1rem;
            background: #fff;
          }

          .supplier-requests-inner-tabs .nav-link.active {
            background: ${theme.green};
            color: white !important;
            border-color: ${theme.green};
            box-shadow: 0 8px 22px rgba(47, 107, 58, 0.16);
          }
        `}</style>
      </Container>
    </div>
  );
};

export default SupplierCustomerRequestsTab;