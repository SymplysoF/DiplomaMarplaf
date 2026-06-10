// components/AdminUsersTab.tsx (базовый)
import React from 'react';
import { Card, Alert } from 'react-bootstrap';

const AdminUsersTab: React.FC = () => {
  return (
    <Card className="shadow">
      <Card.Body className="text-center py-5">
        <i className="bi bi-people text-primary fs-1 mb-3 d-block"></i>
        <h4>Управление пользователями</h4>
        <p className="text-muted">
          Раздел находится в разработке. Здесь будет управление всеми пользователями системы.
        </p>
        <Alert variant="info">
          <i className="bi bi-info-circle me-2"></i>
          В этом разделе можно будет просматривать, редактировать и блокировать пользователей.
        </Alert>
      </Card.Body>
    </Card>
  );
};

export default AdminUsersTab;