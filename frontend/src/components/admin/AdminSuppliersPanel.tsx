import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from 'react-bootstrap';
import { Building, Search } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { getAdminSuppliers } from '../../api/adminSystemApi';

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

const AdminSuppliersPanel: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const d = await getAdminSuppliers({ page: 1, limit: 50, search });
      setRows(d.suppliers || d.rows || []);
    } catch (e: any) {
      toast.error(e.message || 'Ошибка загрузки поставщиков');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ background: ui.bg, borderRadius: 28, padding: 18 }}>
      <Card className="border-0" style={{ borderRadius: 24, boxShadow: ui.shadow }}>
        <Card.Body>
          <Row className="align-items-center g-3 mb-3">
            <Col md={5}>
              <h4 style={{ color: ui.text, margin: 0 }}><Building className="me-2" style={{ color: ui.green }} />Поставщики</h4>
              <div style={{ color: ui.muted }}>фермеры, участки и активность</div>
            </Col>
            <Col md={7}>
              <div className="d-flex gap-2 justify-content-md-end">
                <InputGroup style={{ maxWidth: 360 }}>
                  <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}><Search style={{ color: ui.green }} /></InputGroup.Text>
                  <Form.Control value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="Название, логин или email" />
                </InputGroup>
                <Button onClick={load} style={{ background: ui.green, borderColor: ui.green, borderRadius: 14 }}>Найти</Button>
              </div>
            </Col>
          </Row>

          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" style={{ color: ui.green }} /></div>
          ) : rows.length === 0 ? (
            <Alert style={{ background: ui.greenSoft, color: ui.greenDark, borderColor: ui.border }}>Поставщики не найдены</Alert>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle">
                <thead><tr><th>ID</th><th>Название</th><th>Пользователь</th><th>Рейтинг</th><th>Участков</th><th>Товаров</th></tr></thead>
                <tbody>
                  {rows.map(s => (
                    <tr key={s.id}>
                      <td>#{s.id}</td>
                      <td><b>{s.name || `Поставщик #${s.id}`}</b><div style={{ color: ui.muted, fontSize: 13 }}>{s.description || 'Описание не указано'}</div></td>
                      <td>{s.username || '—'}<div style={{ color: ui.muted, fontSize: 13 }}>{s.email || '—'}</div></td>
                      <td><Badge style={{ background: ui.greenSoft, color: ui.greenDark }}>{Number(s.rating || 0).toFixed(1)}</Badge></td>
                      <td>{s.placesCount || 0}</td>
                      <td>{s.productsCount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default AdminSuppliersPanel;
