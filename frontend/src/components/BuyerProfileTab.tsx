import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { Person, Envelope, Telephone, GeoAlt, CheckCircle } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';

interface Profile {
    id: number;
    username: string;
    email: string;
    deliveryaddress: string;
    contactphone: string;
}

const API_BASE_URL = 'http://localhost:5000';

const BuyerProfileTab: React.FC = () => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({ deliveryaddress: '', contactphone: '' });

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('userToken');
            const res = await fetch(`${API_BASE_URL}/api/buyer/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setProfile(data.profile);
                setFormData({ deliveryaddress: data.profile.deliveryaddress || '', contactphone: data.profile.contactphone || '' });
            }
        } catch (error) {
            toast.error('Ошибка загрузки профиля');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('userToken');
            const res = await fetch(`${API_BASE_URL}/api/buyer/profile`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Профиль обновлён');
                setEditing(false);
                fetchProfile();
            } else {
                toast.error(data.message || 'Ошибка');
            }
        } catch (error) {
            toast.error('Ошибка сервера');
        }
    };

    useEffect(() => { fetchProfile(); }, []);

    if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
    if (!profile) return <Alert variant="danger">Профиль не найден</Alert>;

    return (
        <Card className="shadow-sm border-0">
            <Card.Body>
                <Row>
                    <Col md={4} className="text-center">
                        <Person size={80} className="text-secondary mb-3" />
                        <h4>{profile.username}</h4>
                        <Badge bg="success" className="mt-2"><CheckCircle /> Активен</Badge>
                    </Col>
                    <Col md={8}>
                        <h5>Контактные данные</h5>
                        {!editing ? (
                            <>
                                <div><Envelope className="me-2" /> {profile.email}</div>
                                <div><Telephone className="me-2" /> {profile.contactphone || 'Не указан'}</div>
                                <div><GeoAlt className="me-2" /> {profile.deliveryaddress || 'Не указан'}</div>
                                <Button variant="outline-primary" className="mt-3" onClick={() => setEditing(true)}>Редактировать</Button>
                            </>
                        ) : (
                            <Form>
                                <Form.Group className="mb-2"><Form.Label>Телефон</Form.Label><Form.Control type="tel" value={formData.contactphone} onChange={e => setFormData({...formData, contactphone: e.target.value})} /></Form.Group>
                                <Form.Group className="mb-2"><Form.Label>Адрес доставки</Form.Label><Form.Control type="text" value={formData.deliveryaddress} onChange={e => setFormData({...formData, deliveryaddress: e.target.value})} /></Form.Group>
                                <div className="mt-3"><Button variant="success" onClick={handleSave}>Сохранить</Button><Button variant="secondary" className="ms-2" onClick={() => setEditing(false)}>Отмена</Button></div>
                            </Form>
                        )}
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

export default BuyerProfileTab;