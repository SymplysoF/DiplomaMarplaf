import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table, Tab, Tabs } from 'react-bootstrap';
import { ClockHistory, ExclamationTriangle, FileEarmarkCheck, People, Search } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import {
  getManagerAppeals,
  getManagerCard,
  getManagerCards,
  getManagerCertificates,
  getManagerHistory,
  getManagerOverview,
  getManagerUsers,
  saveManagerCardDecision,
  saveManagerUserDecision,
  updateManagerAppeal
} from '../../api/managerApi';

interface Props {
  user: {
    userId: number;
    name: string;
    login: string;
    role: string;
    roleId: number;
  };
}

const ui = {
  bg: '#f6f3ed',
  border: '#ebe4d8',
  text: '#223127',
  muted: '#6f7a71',
  green: '#2f6b3a',
  greenDark: '#244f2b',
  greenSoft: '#dfeadf',
  orange: '#d97706',
  red: '#c2410c',
  badgeDark: '#49566a',
  shadow: '0 14px 35px rgba(34, 49, 39, 0.08)'
};

const statusText = (s?: string) => {
  if (s === 'approved') return 'Принято';
  if (s === 'rejected') return 'Отклонено';
  if (s === 'revision') return 'На исправлении';
  if (s === 'verified') return 'Верифицирован';
  if (s === 'closed') return 'Закрыто';
  if (s === 'in_progress') return 'В работе';
  return 'Ожидает';
};

const greenButton: React.CSSProperties = {
  background: ui.green,
  borderColor: ui.green,
  color: '#fff',
  borderRadius: 12,
  fontWeight: 700
};

const greenSoftButton: React.CSSProperties = {
  background: ui.greenSoft,
  borderColor: '#cfe0d1',
  color: ui.greenDark,
  borderRadius: 12,
  fontWeight: 700
};


const ManagerModerationDashboard: React.FC<Props> = ({ user }) => {
  const [active, setActive] = useState('cards');
  const [overview, setOverview] = useState<any>({});
  const [cards, setCards] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState<any>('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);
  const [decisionModal, setDecisionModal] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'revision'>('approved');
  const [comment, setComment] = useState('');

  const loadOverview = () => getManagerOverview().then(d => setOverview(d.summary || {})).catch(() => undefined);

  const loadCards = async () => {
    try {
      setLoading(true);
      const d = await getManagerCards({ status, page: 1, limit: 24, search });
      setCards(d.cards || []);
    } catch (e: any) {
      toast.error(e.message || 'Ошибка карточек');
    } finally {
      setLoading(false);
    }
  };

  const loadOther = async () => {
    try {
      const [u, c, a, h] = await Promise.all([
        getManagerUsers({ status: 'all', page: 1, limit: 50 }),
        getManagerCertificates({ page: 1, limit: 50 }),
        getManagerAppeals({ status: 'all', page: 1, limit: 50 }),
        getManagerHistory({ page: 1, limit: 50 })
      ]);
      setUsers(u.users || []);
      setCertificates(c.certificates || []);
      setAppeals(a.appeals || []);
      setHistory(h.history || []);
    } catch {
      // пилотный режим: не падаем, если один из разделов пустой
    }
  };

  const loadAll = () => {
    loadOverview();
    loadCards();
    loadOther();
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadCards(); }, [status]);

  const openCard = async (card: any) => {
    try {
      const d = await getManagerCard(card.id);
      setSelectedCard(d.card || card);
    } catch {
      setSelectedCard(card);
    }
  };

  const submitDecision = async () => {
    if (!selectedCard) return;

    try {
      await saveManagerCardDecision(selectedCard.id, { decision, comment });
      toast.success('Решение сохранено');
      setDecisionModal(false);
      setSelectedCard(null);
      setComment('');
      loadAll();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка решения');
    }
  };

  const quickUserDecision = async (row: any, next: 'verified' | 'rejected' | 'revision') => {
    try {
      await saveManagerUserDecision(row.id, {
        decision: next,
        comment: next === 'verified' ? 'Пользователь проверен' : 'Требуется исправление данных'
      });
      toast.success('Решение по пользователю сохранено');
      loadOther();
      loadOverview();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка проверки пользователя');
    }
  };

  const closeAppeal = async (appeal: any) => {
    try {
      await updateManagerAppeal(appeal.id, { status: 'closed', answer: 'Обращение рассмотрено менеджером.' });
      toast.success('Обращение закрыто');
      loadOther();
      loadOverview();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка обращения');
    }
  };

  const statCards = [
    { label: 'Карточек ожидает', value: overview.pendingCards || 0, icon: <ClockHistory /> },
    { label: 'Пользователи', value: overview.pendingUsers || 0, icon: <People /> },
    { label: 'Сертификаты', value: overview.certificates || 0, icon: <FileEarmarkCheck /> },
    { label: 'Обращения', value: overview.openAppeals || 0, icon: <ExclamationTriangle /> }
  ];

  return (
    <div style={{ background: ui.bg, borderRadius: 32, padding: 18 }}>
     

      <Card className="border-0" style={{ borderRadius: 28, boxShadow: ui.shadow }}>
        <Card.Body>
          <Tabs activeKey={active} onSelect={k => k && setActive(k)} className="mb-4">
            <Tab eventKey="cards" title="Карточки" />
            <Tab eventKey="users" title="Пользователи" />
            <Tab eventKey="certificates" title="Сертификаты" />
            <Tab eventKey="appeals" title="Обращения" />
            <Tab eventKey="history" title="История" />
          </Tabs>

          {active === 'cards' && (
            <>
              <Row className="g-2 mb-3">
                <Col md={3}>
                  <Form.Select value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="pending">Ожидает</option>
                    <option value="revision">На исправлении</option>
                    <option value="approved">Принято</option>
                    <option value="rejected">Отклонено</option>
                    <option value="all">Все</option>
                  </Form.Select>
                </Col>
                <Col md={6}>
                  <InputGroup>
                    <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}><Search style={{ color: ui.green }} /></InputGroup.Text>
                    <Form.Control value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadCards()} placeholder="Товар, фермер, культура" />
                  </InputGroup>
                </Col>
                <Col md={3}>
                  <Button className="w-100" onClick={loadCards} style={greenButton}>Найти</Button>
                </Col>
              </Row>

              {loading ? (
                <div className="text-center py-5"><Spinner animation="border" style={{ color: ui.green }} /></div>
              ) : cards.length === 0 ? (
                <Alert style={{ background: ui.greenSoft, borderColor: ui.border, color: ui.greenDark }}>Очередь пуста</Alert>
              ) : (
                <Row className="g-3">
                  {cards.map(card => (
                    <Col xl={4} md={6} key={card.id}>
                      <Card className="border-0 h-100" style={{ borderRadius: 24, boxShadow: ui.shadow }}>
                        {card.imageUrl && <div style={{ height: 180, background: '#eef2ef', borderRadius: '24px 24px 0 0', overflow: 'hidden' }}><img src={card.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
                        <Card.Body>
                          <div className="d-flex justify-content-between gap-2">
                            <h5 style={{ color: ui.text }}>{card.productName || `Товар #${card.productId}`}</h5>
                            <span>{statusText(card.status)}</span>
                          </div>
                          <div style={{ color: ui.muted, fontSize: 13 }}>{card.cultureName || 'Культура не указана'} • {card.freshnessName || 'спелость не указана'}</div>
                          <div className="mt-2">Фермер: <b>{card.supplierName || '—'}</b></div>
                          <div className="mt-2">Цена: <b>{Number(card.price || 0).toFixed(2)} ₽</b></div>
                          <div className="d-flex gap-2 mt-3 flex-wrap">
                            <Button size="sm" onClick={() => openCard(card)} style={greenSoftButton}>Смотреть</Button>
                            <Button size="sm" onClick={() => { setSelectedCard(card); setDecision('approved'); setDecisionModal(true); }} style={greenButton}>Принять</Button>
                            <Button size="sm" onClick={() => { setSelectedCard(card); setDecision('revision'); setDecisionModal(true); }} style={greenSoftButton}>Исправить</Button>
                            <Button size="sm" onClick={() => { setSelectedCard(card); setDecision('rejected'); setDecisionModal(true); }} style={greenSoftButton}>Отклонить</Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </>
          )}

          {active === 'users' && <TableBlock rows={users} type="users" onUserDecision={quickUserDecision} />}
          {active === 'certificates' && <TableBlock rows={certificates} type="certificates" />}
          {active === 'appeals' && <TableBlock rows={appeals} type="appeals" onAppealClose={closeAppeal} />}
          {active === 'history' && <TableBlock rows={history} type="history" />}
        </Card.Body>
      </Card>

      <Modal show={!!selectedCard && !decisionModal} onHide={() => setSelectedCard(null)} centered size="lg">
        <Modal.Header closeButton><Modal.Title>{selectedCard?.productName || 'Карточка товара'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedCard && (
            <Row className="g-3">
              {selectedCard.imageUrl && <Col md={5}><img src={selectedCard.imageUrl} alt="" style={{ width: '100%', borderRadius: 18 }} /></Col>}
              <Col md={selectedCard.imageUrl ? 7 : 12}>
                <h5>Сведения</h5>
                <div>Культура: <b>{selectedCard.cultureName || '—'}</b></div>
                <div>Спелость: <b>{selectedCard.freshnessName || '—'}</b></div>
                <div>Фермер: <b>{selectedCard.supplierName || '—'}</b></div>
                <div>Цена: <b>{Number(selectedCard.price || 0).toFixed(2)} ₽</b></div>
                <hr />
                <h6>Документы</h6>
                {(selectedCard.documents || []).length === 0 ? <div style={{ color: ui.muted }}>Документы не приложены</div> : selectedCard.documents.map((d: any) => <div key={d.id}><a href={d.fileUrl || '#'}>{d.title}</a></div>)}
              </Col>
            </Row>
          )}
        </Modal.Body>
      </Modal>

      <Modal show={decisionModal} onHide={() => setDecisionModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Решение по карточке</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Решение</Form.Label>
            <Form.Select value={decision} onChange={e => setDecision(e.target.value as any)}>
              <option value="approved">Принять</option>
              <option value="revision">Вернуть на исправление</option>
              <option value="rejected">Отклонить</option>
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Комментарий</Form.Label>
            <Form.Control as="textarea" rows={4} value={comment} onChange={e => setComment(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setDecisionModal(false)} style={greenSoftButton}>Отмена</Button>
          <Button onClick={submitDecision} style={greenButton}>Сохранить</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

const TableBlock: React.FC<any> = ({ rows, type, onUserDecision, onAppealClose }) => {
  if (!rows?.length) return <Alert>Данных пока нет</Alert>;

  if (type === 'users') {
    return (
      <Table responsive hover className="align-middle">
        <thead><tr><th>ID</th><th>Пользователь</th><th>Роль</th><th>Статус</th><th className="text-end">Действия</th></tr></thead>
        <tbody>{rows.map((u: any) => <tr key={u.id}><td>#{u.id}</td><td><b>{u.username}</b><div style={{ color: ui.muted }}>{u.email}</div></td><td>{u.roleName}</td><td><span>{statusText(u.reviewStatus)}</span></td><td className="text-end"><Button size="sm" className="me-2" style={greenSoftButton} onClick={() => onUserDecision(u, 'verified')}>Верифицировать</Button><Button size="sm" style={greenSoftButton} onClick={() => onUserDecision(u, 'revision')}>Исправить</Button></td></tr>)}</tbody>
      </Table>
    );
  }

  if (type === 'certificates') {
    return <Table responsive hover className="align-middle"><thead><tr><th>ID</th><th>Сертификат</th><th>Поставщик</th><th>Статус</th><th>Файл</th></tr></thead><tbody>{rows.map((c: any) => <tr key={c.id}><td>#{c.id}</td><td><b>{c.title}</b><div style={{ color: ui.muted }}>{c.description}</div></td><td>{c.supplierName || '—'}</td><td><span>{statusText(c.status)}</span></td><td>{c.fileUrl ? <a href={c.fileUrl} target="_blank" rel="noreferrer">Открыть</a> : '—'}</td></tr>)}</tbody></Table>;
  }

  if (type === 'appeals') {
    return <Table responsive hover className="align-middle"><thead><tr><th>ID</th><th>Тема</th><th>Пользователь</th><th>Статус</th><th className="text-end">Действия</th></tr></thead><tbody>{rows.map((a: any) => <tr key={a.id}><td>#{a.id}</td><td><b>{a.subject}</b><div style={{ color: ui.muted }}>{a.message}</div></td><td>{a.username || '—'}</td><td><span>{statusText(a.status)}</span></td><td className="text-end"><Button size="sm" style={greenSoftButton} onClick={() => onAppealClose(a)}>Закрыть</Button></td></tr>)}</tbody></Table>;
  }

  return <Table responsive hover className="align-middle"><thead><tr><th>Дата</th><th>Товар</th><th>Решение</th><th>Менеджер</th><th>Комментарий</th></tr></thead><tbody>{rows.map((h: any) => <tr key={h.id}><td>{h.createdAt ? new Date(h.createdAt).toLocaleString('ru-RU') : '—'}</td><td>{h.productName || `#${h.productId}`}</td><td><span>{statusText(h.decision)}</span></td><td>{h.moderatorName || '—'}</td><td>{h.comment || '—'}</td></tr>)}</tbody></Table>;
};

export default ManagerModerationDashboard;
