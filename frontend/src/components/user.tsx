// components/UserDashboard.tsx
import React from 'react';
import { 
  Card, 
  Button, 
  Row, 
  Col,
  Badge,
  Alert,
  ListGroup
} from 'react-bootstrap';
import { 
  PersonCircle,
  Bell,
  Clock,
  Envelope,
  Gear
} from 'react-bootstrap-icons';

interface UserDashboardProps {
  user: {
    userId: number;
    name: string;
    login: string;
    role: string;
    roleId: number;
  };
}

const UserDashboard: React.FC<UserDashboardProps> = ({ user }) => {
  // Данные для обычного пользователя
  const userStats = {
    messages: 3,
    notifications: 5,
    lastLogin: 'Сегодня, 10:30',
    accountAge: '15 дней'
  };

  return (
    <>
      <Card className="mb-4 shadow">
        <Card.Header className="bg-primary text-white">
          <h4 className="mb-0">
            <PersonCircle className="me-2" />
            Личный кабинет
          </h4>
        </Card.Header>
        <Card.Body>
          <Row className="mb-4">
            <Col md={8}>
              <h3>Добро пожаловать, {user.name}!</h3>
              <p className="text-muted">
                Вы вошли как пользователь системы Marplatf. Здесь вы можете управлять своим профилем.
              </p>
            </Col>
            <Col md={4} className="text-end">
              <Badge bg="primary" className="fs-6 p-2">
                Роль: {user.role}
              </Badge>
            </Col>
          </Row>

          {/* Информация о пользователе */}
          <Row className="mb-4">
            <Col md={6}>
              <Card className="h-100">
                <Card.Header>Информация о профиле</Card.Header>
                <Card.Body>
                  <ListGroup variant="flush">
                    <ListGroup.Item className="d-flex justify-content-between">
                      <span>Имя:</span>
                      <strong>{user.name}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex justify-content-between">
                      <span>Логин:</span>
                      <strong>{user.login}</strong>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex justify-content-between">
                      <span>ID пользователя:</span>
                      <Badge bg="secondary">{user.userId}</Badge>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex justify-content-between">
                      <span>Роль:</span>
                      <Badge bg="primary">{user.role}</Badge>
                    </ListGroup.Item>
                  </ListGroup>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card className="h-100">
                <Card.Header>Активность</Card.Header>
                <Card.Body>
                  <ListGroup variant="flush">
                    <ListGroup.Item className="d-flex align-items-center">
                      <Bell className="text-primary me-3" />
                      <div>
                        <div>Уведомления</div>
                        <small className="text-muted">
                          {userStats.notifications} непрочитанных
                        </small>
                      </div>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex align-items-center">
                      <Envelope className="text-success me-3" />
                      <div>
                        <div>Сообщения</div>
                        <small className="text-muted">
                          {userStats.messages} новых
                        </small>
                      </div>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex align-items-center">
                      <Clock className="text-warning me-3" />
                      <div>
                        <div>Последний вход</div>
                        <small className="text-muted">
                          {userStats.lastLogin}
                        </small>
                      </div>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex align-items-center">
                      <i className="bi bi-calendar text-info me-3 fs-5"></i>
                      <div>
                        <div>Аккаунт создан</div>
                        <small className="text-muted">
                          {userStats.accountAge} назад
                        </small>
                      </div>
                    </ListGroup.Item>
                  </ListGroup>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <h5 className="mb-3">Доступные действия</h5>
          <Row className="g-3 mb-4">
            <Col md={4} sm={6}>
              <Button 
                variant="outline-primary" 
                className="w-100 py-3 d-flex flex-column align-items-center"
              >
                <PersonCircle size={32} className="mb-2" />
                Редактировать профиль
              </Button>
            </Col>
            
            <Col md={4} sm={6}>
              <Button 
                variant="outline-success" 
                className="w-100 py-3 d-flex flex-column align-items-center"
              >
                <Bell size={32} className="mb-2" />
                Уведомления
              </Button>
            </Col>
            
            <Col md={4} sm={6}>
              <Button 
                variant="outline-warning" 
                className="w-100 py-3 d-flex flex-column align-items-center"
              >
                <Gear size={32} className="mb-2" />
                Настройки
              </Button>
            </Col>
          </Row>

          <Alert variant="info">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Информация:</strong> Как обычный пользователь вы можете просматривать 
            доступные участки и обращаться к поставщикам. Для добавления собственных участков 
            требуется регистрация в качестве поставщика.
          </Alert>
        </Card.Body>
      </Card>

      {/* Дополнительная информация */}
      <Card className="shadow">
        <Card.Header className="bg-light">
          <h5 className="mb-0">
            <i className="bi bi-newspaper me-2"></i>
            Новости и обновления
          </h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Card className="mb-3">
                <Card.Body>
                  <h6>Обновление системы</h6>
                  <p className="text-muted small">
                    Добавлена возможность просмотра участков на карте. 
                    Теперь доступны подробные характеристики каждого участка.
                  </p>
                  <small className="text-muted">Опубликовано: 15.12.2023</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="mb-3">
                <Card.Body>
                  <h6>Технические работы</h6>
                  <p className="text-muted small">
                    20 декабря с 03:00 до 05:00 планируются технические работы. 
                    Система может быть временно недоступна.
                  </p>
                  <small className="text-muted">Опубликовано: 14.12.2023</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </>
  );
};

export default UserDashboard;