import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from 'react-bootstrap';
import { Download, Search, Table as TableIcon } from 'react-bootstrap-icons';
import { AdminTableKey, getAdminTable } from '../../api/adminSystemApi';
import { downloadCsv } from '../../api/systemHttp';

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

const tables: { key: AdminTableKey; label: string }[] = [
  { key: 'users', label: 'Пользователи' },
  { key: 'roles', label: 'Роли' },
  { key: 'suppliers', label: 'Поставщики' },
  { key: 'products', label: 'Товары' },
  { key: 'productCopies', label: 'Экземпляры' },
  { key: 'purchases', label: 'Покупки' },
  { key: 'auctions', label: 'Аукционы' },
  { key: 'certificates', label: 'Сертификаты' },
  { key: 'logs', label: 'Логи' },
  { key: 'namesObjects', label: 'Культуры' },
  { key: 'freshness', label: 'Спелость' },
  { key: 'dimensions', label: 'Единицы' }
];

const cell = (v: any) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Да' : 'Нет';
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
};

const AdminSystemTables: React.FC = () => {
  const [active, setActive] = useState<AdminTableKey>('users');
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1, limit: 20 });

  const load = async (page = 1) => {
    try {
      setLoading(true);
      const d = await getAdminTable(active, { page, limit: pagination.limit, search });
      setRows(d.rows || []);
      setColumns(d.columns || []);
      setPagination(d.pagination || { page, total: 0, pages: 1, limit: 20 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [active]);

  return (
    <div style={{ background: ui.bg, borderRadius: 28, padding: 18 }}>
      <Row className="g-3">
        <Col lg={3}>
          <Card className="border-0" style={{ borderRadius: 24, boxShadow: ui.shadow }}>
            <Card.Body>
              <h5 style={{ color: ui.text }}>Таблицы</h5>
              <div className="d-grid gap-2">
                {tables.map(t => (
                  <Button
                    key={t.key}
                    onClick={() => setActive(t.key)}
                    style={{
                      textAlign: 'left',
                      borderRadius: 14,
                      borderColor: active === t.key ? ui.green : ui.border,
                      background: active === t.key ? ui.greenSoft : '#fff',
                      color: active === t.key ? ui.greenDark : ui.text,
                      fontWeight: 700
                    }}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={9}>
          <Card className="border-0" style={{ borderRadius: 24, boxShadow: ui.shadow }}>
            <Card.Body>
              <Row className="align-items-center g-3 mb-3">
                <Col md={5}>
                  <h4 style={{ color: ui.text, margin: 0 }}>
                    <TableIcon className="me-2" style={{ color: ui.green }} />
                    {tables.find(t => t.key === active)?.label}
                  </h4>
                  <div style={{ color: ui.muted }}>Всего: {pagination.total}</div>
                </Col>
                <Col md={7}>
                  <div className="d-flex gap-2 justify-content-md-end">
                    <InputGroup style={{ maxWidth: 360 }}>
                      <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                        <Search style={{ color: ui.green }} />
                      </InputGroup.Text>
                      <Form.Control value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(1)} placeholder="Поиск" />
                    </InputGroup>
                    <Button onClick={() => load(1)} style={{ background: ui.green, borderColor: ui.green, borderRadius: 14 }}>Найти</Button>
                    <Button variant="outline-secondary" onClick={() => downloadCsv(`${active}.csv`, rows)} style={{ borderRadius: 14 }}><Download /></Button>
                  </div>
                </Col>
              </Row>

              {loading ? (
                <div className="text-center py-5"><Spinner animation="border" style={{ color: ui.green }} /></div>
              ) : rows.length === 0 ? (
                <Alert style={{ background: ui.greenSoft, color: ui.greenDark, borderColor: ui.border }}>Данных нет или таблица отсутствует в текущей БД.</Alert>
              ) : (
                <div className="table-responsive">
                  <Table hover className="align-middle">
                    <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={row.id || idx}>
                          {columns.map(c => (
                            <td key={c}>
                              {String(c).toLowerCase().includes('status') ? (
                                <Badge style={{ background: ui.greenSoft, color: ui.greenDark }}>{cell(row[c])}</Badge>
                              ) : cell(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              <div className="d-flex justify-content-between">
                <small style={{ color: ui.muted }}>Страница {pagination.page} из {pagination.pages}</small>
                <div className="d-flex gap-2">
                  <Button variant="outline-secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Назад</Button>
                  <Button variant="outline-secondary" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Далее</Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminSystemTables;
