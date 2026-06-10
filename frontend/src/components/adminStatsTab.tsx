// components/AdminStatsTab.tsx (базовый)
import React from 'react';
import { Card, Alert } from 'react-bootstrap';

const AdminStatsTab: React.FC = () => {
  return (
    <Card className="shadow">
      <Card.Body className="text-center py-5">
        <i className="bi bi-bar-chart text-success fs-1 mb-3 d-block"></i>
        <h4>Статистика системы</h4>
        <p className="text-muted">
          Раздел находится в разработке. Здесь будет отображаться статистика по системе.
        </p>
        <Alert variant="info">
          <i className="bi bi-info-circle me-2"></i>
          В этом разделе будут графики, отчеты и аналитика по работе платформы.
        </Alert>
      </Card.Body>
    </Card>
  );
};

export default AdminStatsTab;