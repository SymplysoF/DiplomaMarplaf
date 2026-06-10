import React, { useEffect, useState } from 'react';
import { Alert, Card, Col, Row, Spinner } from 'react-bootstrap';
import { BarChart, BoxSeam, Building, CartCheck, Database, People } from 'react-bootstrap-icons';
import { getAdminSummary } from '../../api/adminSystemApi';

const ui = {
  bg: '#f6f3ed',
  text: '#223127',
  muted: '#6f7a71',
  green: '#2f6b3a',
  greenSoft: '#dfeadf',
  shadow: '0 14px 35px rgba(34, 49, 39, 0.08)'
};

const AdminOverviewPanel: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminSummary()
      .then((d) => setSummary(d.summary || {}))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-5"><Spinner animation="border" style={{ color: ui.green }} /></div>;
  if (!summary) return <Alert variant="warning">Не удалось загрузить сводку администратора.</Alert>;

  const cards = [
    { label: 'Пользователи', value: summary.users || 0, icon: <People size={28} /> },
    { label: 'Поставщики', value: summary.suppliers || 0, icon: <Building size={28} /> },
    { label: 'Товары', value: summary.products || 0, icon: <BoxSeam size={28} /> },
    { label: 'Покупки', value: summary.purchases || 0, icon: <CartCheck size={28} /> },
    { label: 'Аукционы', value: summary.auctions || 0, icon: <BarChart size={28} /> },
    { label: 'Сертификаты', value: summary.certificates || 0, icon: <Database size={28} /> }
  ];

  return (
    <div style={{ background: ui.bg, borderRadius: 28, padding: 18 }}>
      <Row className="g-3">
        {cards.map(card => (
          <Col lg={4} md={6} key={card.label}>
            <Card className="border-0 h-100" style={{ borderRadius: 24, boxShadow: ui.shadow }}>
              <Card.Body>
                <div style={{ width: 54, height: 54, borderRadius: 18, background: ui.greenSoft, color: ui.green, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  {card.icon}
                </div>
                <h3 style={{ color: ui.text, fontWeight: 900, marginBottom: 0 }}>{card.value}</h3>
                <div style={{ color: ui.muted }}>{card.label}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default AdminOverviewPanel;
