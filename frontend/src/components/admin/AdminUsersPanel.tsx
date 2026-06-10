import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { PersonPlus, Search, ShieldCheck } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { createAdminUser, getAdminTable, updateAdminUserStatus } from '../../api/adminSystemApi';

const ui = {
  bg: '#f6f3ed',
  border: '#ebe4d8',
  text: '#223127',
  muted: '#6f7a71',
  green: '#2f6b3a',
  greenDark: '#244f2b',
  greenSoft: '#dfeadf',
  shadow: '0 14px 35px rgba(34, 49, 39, 0.08)'
};

const AdminUsersPanel: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', roleId: 4 });

  const load = async (page = 1) => {
    try {
      setLoading(true);
      const data = await getAdminTable('users', { page, limit: 20, search });
      setRows(data.rows || []);
      setPagination(data.pagination || { page, total: 0, pages: 1 });
    } catch (e: any) {
      toast.error(e.message || 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const createUser = async () => {
    try {
      const d = await createAdminUser(form);
      if (d.success) {
        toast.success('Пользователь создан');
        setShowCreate(false);
        setForm({ username: '', email: '', password: '', roleId: 4 });
        load(1);
      }
    } catch (e: any) {
      toast.error(e.message || 'Ошибка создания пользователя');
    }
  };

  const toggle = async (row: any) => {
    try {
      await updateAdminUserStatus(row.id, { isActive: !(row.isActive ?? true) });
      load(pagination.page);
    } catch (e: any) {
      toast.error(e.message || 'Ошибка статуса');
    }
  };

  return (
    <div style={{ background: ui.bg, borderRadius: 28, padding: 18 }}>
      <Card className="border-0" style={{ borderRadius: 24, boxShadow: ui.shadow }}>
        <Card.Body>
          <Row className="align-items-center g-3 mb-3">
            <Col md={5}>
              <h4 style={{ color: ui.text, margin: 0 }}>
                <ShieldCheck className="me-2" style={{ color: ui.green }} />
                Пользователи
              </h4>
              <div style={{ color: ui.muted }}>управление системными пользователями и ролями</div>
            </Col>
            <Col md={7}>
              <div className="d-flex gap-2 justify-content-md-end">
                <InputGroup style={{ maxWidth: 360 }}>
                  <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                    <Search style={{ color: ui.green }} />
                  </InputGroup.Text>
                  <Form.Control value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(1)} placeholder="Логин или email" />
                </InputGroup>
                <Button onClick={() => load(1)} style={{ background: ui.green, borderColor: ui.green, borderRadius: 14 }}>Найти</Button>
                <Button onClick={() => setShowCreate(true)} style={{ background: ui.greenDark, borderColor: ui.greenDark, borderRadius: 14 }}>
                  <PersonPlus className="me-1" /> Создать
                </Button>
              </div>
            </Col>
          </Row>

          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" style={{ color: ui.green }} /></div>
          ) : rows.length === 0 ? (
            <Alert style={{ background: ui.greenSoft, borderColor: ui.border, color: ui.greenDark }}>Пользователи не найдены</Alert>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle">
                <thead>
                  <tr><th>ID</th><th>Логин</th><th>Email</th><th>Роль</th><th>Статус</th><th className="text-end">Действия</th></tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id}>
                      <td>#{row.id}</td>
                      <td><b>{row.username}</b></td>
                      <td>{row.email || '—'}</td>
                      <td><Badge style={{ background: ui.greenSoft, color: ui.greenDark }}>{row.roleName || row.roleId}</Badge></td>
                      <td>{row.isActive ? <Badge bg="success">Активен</Badge> : <Badge bg="secondary">Заблокирован</Badge>}</td>
                      <td className="text-end"><Button size="sm" variant="outline-secondary" onClick={() => toggle(row)}>{row.isActive ? 'Заблокировать' : 'Активировать'}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered>
        <Modal.Header closeButton><Modal.Title>Создать пользователя</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3"><Form.Label>Логин</Form.Label><Form.Control value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} /></Form.Group>
          <Form.Group className="mb-3"><Form.Label>Email</Form.Label><Form.Control value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Form.Group>
          <Form.Group className="mb-3"><Form.Label>Пароль</Form.Label><Form.Control type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></Form.Group>
          <Form.Group>
            <Form.Label>Роль</Form.Label>
            <Form.Select value={form.roleId} onChange={e => setForm(p => ({ ...p, roleId: Number(e.target.value) }))}>
              <option value={1}>Администратор</option>
              <option value={4}>Модератор</option>
              <option value={5}>Регулятор</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Отмена</Button>
          <Button onClick={createUser} style={{ background: ui.green, borderColor: ui.green }}>Создать</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminUsersPanel;
