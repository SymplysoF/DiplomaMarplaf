// components/AdminSuppliersTab.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Spinner,
  Alert,
  Badge,
  InputGroup,
  Pagination,
  Row,
  Col
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import {
  Search,
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  PersonCheck,
  Ubuntu,
  Building
} from 'react-bootstrap-icons';

interface Supplier {
  id: number;
  name: string;
  user_id: number;
  username: string;
  email: string;
  rating: number;
  description: string;
  places_count: number;
  created_at: string;
  is_active?: boolean;
}

const AdminSuppliersTab: React.FC = () => {
  // Состояния
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Пагинация
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSuppliers, setTotalSuppliers] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Форма добавления
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [addingSupplier, setAddingSupplier] = useState(false);

  // Форма редактирования
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    rating: '5.0',
    email: '',
    isActive: true
  });
  const [updatingSupplier, setUpdatingSupplier] = useState(false);

  // Загрузка поставщиков
  const fetchSuppliers = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const token = localStorage.getItem('userToken');
      const response = await fetch(
        `http://localhost:5000/api/admin/suppliers?page=${page}&limit=20&search=${encodeURIComponent(search)}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const data = await response.json();
      if (data.success) {
        setSuppliers(data.suppliers);
        setTotalPages(data.pagination.pages);
        setTotalSuppliers(data.pagination.total);
      } else {
        toast.error(data.message || 'Ошибка загрузки поставщиков');
      }
    } catch (error) {
      toast.error('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers(currentPage, searchTerm);
  }, [currentPage, searchTerm]);

  // Добавление нового поставщика
  const handleAddSupplier = async () => {
    // Валидация
    if (!formData.name || !formData.username || !formData.email || !formData.password) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      return;
    }

    try {
      setAddingSupplier(true);
      const token = localStorage.getItem('userToken');
      const response = await fetch('http://localhost:5000/api/admin/suppliers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          username: formData.username,
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Поставщик успешно создан!');
        setShowAddModal(false);
        resetForm();
        fetchSuppliers(currentPage, searchTerm); // Обновляем список
      } else {
        toast.error(data.message || 'Ошибка создания поставщика');
      }
    } catch (error) {
      toast.error('Ошибка сервера');
    } finally {
      setAddingSupplier(false);
    }
  };

  // Обновление поставщика
  const handleUpdateSupplier = async () => {
    if (!selectedSupplier) return;

    try {
      setUpdatingSupplier(true);
      const token = localStorage.getItem('userToken');
      const response = await fetch(
        `http://localhost:5000/api/admin/suppliers/${selectedSupplier.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: editData.name,
            description: editData.description,
            rating: parseFloat(editData.rating),
            email: editData.email
          })
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Данные поставщика обновлены');
        setShowEditModal(false);
        fetchSuppliers(currentPage, searchTerm); // Обновляем список
      } else {
        toast.error(data.message || 'Ошибка обновления');
      }
    } catch (error) {
      toast.error('Ошибка сервера');
    } finally {
      setUpdatingSupplier(false);
    }
  };

  // Изменение статуса (активация/деактивация)
  const handleToggleStatus = async (supplier: Supplier, isActive: boolean) => {
    if (!window.confirm(`Вы уверены, что хотите ${isActive ? 'активировать' : 'деактивировать'} этого поставщика?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('userToken');
      const response = await fetch(
        `http://localhost:5000/api/admin/suppliers/${supplier.id}/toggle-status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ isActive })
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success(`Поставщик успешно ${isActive ? 'активирован' : 'деактивирован'}`);
        fetchSuppliers(currentPage, searchTerm); // Обновляем список
      } else {
        toast.error(data.message || 'Ошибка изменения статуса');
      }
    } catch (error) {
      toast.error('Ошибка сервера');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
  };

  const handleEditClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setEditData({
      name: supplier.name,
      description: supplier.description || '',
      rating: supplier.rating?.toString() || '5.0',
      email: supplier.email,
      isActive: supplier.is_active !== false
    });
    setShowEditModal(true);
  };

  const handleDetailsClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDetailsModal(true);
  };

  // Форматирование даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="mt-4">
      <Card className="shadow">
        <Card.Header className="bg-dark text-white d-flex justify-content-between align-items-center">
          <h4 className="mb-0">
            <Building className="me-2" />
            Управление поставщиками
          </h4>
          <Button
            variant="success"
            size="sm"
            onClick={() => setShowAddModal(true)}
          >
            <PlusCircle className="me-1" />
            Добавить поставщика
          </Button>
        </Card.Header>

        <Card.Body>
          {/* Поиск и статистика */}
          <Row className="mb-4">
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text>
                  <Search />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Поиск по названию, email или логину..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Сбрасываем на первую страницу при поиске
                  }}
                />
                {searchTerm && (
                  <Button
                    variant="outline-secondary"
                    onClick={() => setSearchTerm('')}
                  >
                    Очистить
                  </Button>
                )}
              </InputGroup>
            </Col>
            <Col md={4} className="text-end">
              <Badge bg="info" className="p-2">
                Всего поставщиков: {totalSuppliers}
              </Badge>
            </Col>
          </Row>

          {/* Таблица поставщиков */}
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Загрузка поставщиков...</p>
            </div>
          ) : suppliers.length === 0 ? (
            <Alert variant="info" className="text-center py-4">
              <Building size={48} className="mb-3" />
              <h5>Поставщики не найдены</h5>
              <p>{searchTerm ? 'Попробуйте изменить параметры поиска' : 'Добавьте первого поставщика'}</p>
            </Alert>
          ) : (
            <>
              <div className="table-responsive">
                <Table hover striped>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Название компании</th>
                      <th>Логин / Email</th>
                      <th>Рейтинг</th>
                      <th>Участков</th>
                      <th>Дата регистрации</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td>
                          <Badge bg="secondary">#{supplier.id}</Badge>
                        </td>
                        <td>
                          <strong>{supplier.name}</strong>
                          {supplier.description && (
                            <div className="text-muted small">
                              {supplier.description.length > 50
                                ? `${supplier.description.substring(0, 50)}...`
                                : supplier.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <div>{supplier.username}</div>
                          <div className="text-muted small">{supplier.email}</div>
                        </td>
                        <td>
                          <Badge bg={supplier.rating >= 4 ? 'success' : supplier.rating >= 3 ? 'warning' : 'danger'}>
                            {supplier.rating?.toFixed(1) || 'Нет'}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg="info">
                            {supplier.places_count || 0}
                          </Badge>
                        </td>
                        <td>
                          <small>{formatDate(supplier.created_at)}</small>
                        </td>
                        <td>
                          {supplier.is_active === false ? (
                            <Badge bg="danger">Неактивен</Badge>
                          ) : (
                            <Badge bg="success">Активен</Badge>
                          )}
                        </td>
                        <td>
                          <Button
                            variant="outline-info"
                            size="sm"
                            className="me-1 mb-1"
                            title="Просмотр"
                            onClick={() => handleDetailsClick(supplier)}
                          >
                            <Eye />
                          </Button>

                          <Button
                            variant="outline-warning"
                            size="sm"
                            className="me-1 mb-1"
                            title="Редактировать"
                            onClick={() => handleEditClick(supplier)}
                          >
                            <Pencil />
                          </Button>

                          {supplier.is_active === false ? (
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="me-1 mb-1"
                              title="Активировать"
                              onClick={() => handleToggleStatus(supplier, true)}
                            >
                              <PersonCheck />
                            </Button>
                          ) : (
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="me-1 mb-1"
                              title="Деактивировать"
                              onClick={() => handleToggleStatus(supplier, false)}
                            >
                              <Ubuntu />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Пагинация */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-center mt-4">
                  <Pagination>
                    <Pagination.Prev
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    />

                   // Замените блок пагинации (строки 450-469):
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number; // Явно указываем тип
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Pagination.Item
                          key={pageNum}
                          active={pageNum === currentPage}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Pagination.Item>
                      );
                    })}

                    <Pagination.Next
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Модальное окно добавления поставщика */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <PlusCircle className="me-2" />
            Добавление нового поставщика
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Название компании *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="ООО 'Ромашка'"
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Описание деятельности</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Сфера деятельности компании"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Логин *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="romashka_company"
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Email *</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="info@romashka.ru"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Пароль *</Form.Label>
                  <Form.Control
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Минимум 6 символов"
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Подтверждение пароля *</Form.Label>
                  <Form.Control
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Повторите пароль"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Alert variant="info">
              <Building className="me-2" />
              Поставщику будет автоматически присвоена роль "Поставщик" (roleId=2).
              Он сможет добавлять земельные участки после входа в систему.
            </Alert>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowAddModal(false);
              resetForm();
            }}
            disabled={addingSupplier}
          >
            Отмена
          </Button>
          <Button
            variant="success"
            onClick={handleAddSupplier}
            disabled={addingSupplier}
          >
            {addingSupplier ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Создание...
              </>
            ) : (
              'Создать поставщика'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Модальное окно редактирования поставщика */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <Pencil className="me-2" />
            Редактирование поставщика
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {selectedSupplier && (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Название компании *</Form.Label>
                <Form.Control
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Описание</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editData.description}
                  onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Рейтинг (1.0 - 5.0)</Form.Label>
                <Form.Select
                  value={editData.rating}
                  onChange={(e) => setEditData(prev => ({ ...prev, rating: e.target.value }))}
                >
                  <option value="1.0">1.0</option>
                  <option value="2.0">2.0</option>
                  <option value="3.0">3.0</option>
                  <option value="4.0">4.0</option>
                  <option value="5.0">5.0</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Email *</Form.Label>
                <Form.Control
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                />
              </Form.Group>

              <Alert variant="warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Изменение email может потребовать повторной активации аккаунта у поставщика.
              </Alert>
            </Form>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowEditModal(false)}
            disabled={updatingSupplier}
          >
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdateSupplier}
            disabled={updatingSupplier}
          >
            {updatingSupplier ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Сохранение...
              </>
            ) : (
              'Сохранить изменения'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Модальное окно деталей поставщика */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <Building className="me-2" />
            Детальная информация о поставщике
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {selectedSupplier && (
            <div>
              <Row className="mb-4">
                <Col md={8}>
                  <h4>{selectedSupplier.name}</h4>
                  <p className="text-muted">{selectedSupplier.description || 'Нет описания'}</p>
                </Col>
                <Col md={4} className="text-end">
                  <Badge bg={selectedSupplier.is_active === false ? 'danger' : 'success'} className="fs-6">
                    {selectedSupplier.is_active === false ? 'Неактивен' : 'Активен'}
                  </Badge>
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={6}>
                  <Card className="h-100">
                    <Card.Header>Контактная информация</Card.Header>
                    <Card.Body>
                      <p><strong>Логин:</strong> {selectedSupplier.username}</p>
                      <p><strong>Email:</strong> {selectedSupplier.email}</p>
                      <p><strong>ID пользователя:</strong> {selectedSupplier.user_id}</p>
                      <p><strong>ID поставщика:</strong> {selectedSupplier.id}</p>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6}>
                  <Card className="h-100">
                    <Card.Header>Статистика</Card.Header>
                    <Card.Body>
                      <p>
                        <strong>Рейтинг:</strong>
                        <Badge bg={selectedSupplier.rating >= 4 ? 'success' : selectedSupplier.rating >= 3 ? 'warning' : 'danger'} className="ms-2">
                          {selectedSupplier.rating?.toFixed(1) || 'Нет'}
                        </Badge>
                      </p>
                      <p>
                        <strong>Количество участков:</strong>
                        <Badge bg="info" className="ms-2">
                          {selectedSupplier.places_count || 0}
                        </Badge>
                      </p>
                      <p><strong>Дата регистрации:</strong> {formatDate(selectedSupplier.created_at)}</p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              <Alert variant="info">
                <i className="bi bi-info-circle me-2"></i>
                Для просмотра участков поставщика перейдите в раздел управления участками.
              </Alert>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Закрыть
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminSuppliersTab;