// components/buyer/DeliveryAddressModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { GeoAlt, Map } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';

interface DeliveryAddressModalProps {
  show: boolean;
  onHide: () => void;
  onAddressSaved: (address: string, lat: number, lng: number) => void;
}

const DeliveryAddressModal: React.FC<DeliveryAddressModalProps> = ({ 
  show, 
  onHide, 
  onAddressSaved 
}) => {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState('');

  // Загружаем сохраненный адрес при открытии
  useEffect(() => {
    if (show) {
      fetchSavedAddress();
    }
  }, [show]);

  const fetchSavedAddress = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const response = await fetch('http://localhost:5000/api/buyer/delivery-address', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.address) {
        setAddress(data.address.delivery_address || '');
      }
    } catch (error) {
      console.error('Error fetching address:', error);
    }
  };

  const getCurrentLocation = () => {
    setGettingLocation(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Геолокация не поддерживается вашим браузером');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Здесь можно использовать reverse geocoding
          // Например, через OpenStreetMap Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
          );
          const data = await response.json();
          setAddress(data.display_name || 'Адрес определен');
          setGettingLocation(false);
        } catch (error) {
          setError('Не удалось определить адрес по координатам');
          setGettingLocation(false);
        }
      },
      (error) => {
        setError('Ошибка получения геолокации: ' + error.message);
        setGettingLocation(false);
      }
    );
  };

  const handleSave = async () => {
    if (!address.trim()) {
      setError('Введите адрес');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Получаем координаты адреса через геокодинг
      const geoResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const geoData = await geoResponse.json();
      
      if (geoData.length === 0) {
        setError('Не удалось определить координаты адреса');
        setLoading(false);
        return;
      }

      const lat = parseFloat(geoData[0].lat);
      const lng = parseFloat(geoData[0].lon);

      // Сохраняем на сервере
      const token = localStorage.getItem('userToken');
      const response = await fetch('http://localhost:5000/api/buyer/delivery-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ address, lat, lng })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Адрес доставки сохранен');
        onAddressSaved(address, lat, lng);
        onHide();
      } else {
        setError(data.message || 'Ошибка сохранения');
      }
    } catch (error) {
      setError('Ошибка сохранения адреса');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <GeoAlt className="me-2 text-primary" />
          Адрес доставки
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-3">
          Укажите адрес доставки для расчета расстояния до фермерских хозяйств
        </p>

        {error && <Alert variant="danger">{error}</Alert>}

        <Form.Group className="mb-3">
          <Form.Label>Адрес</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Введите ваш адрес"
          />
        </Form.Group>

        <div className="d-grid gap-2">
          <Button
            variant="outline-primary"
            onClick={getCurrentLocation}
            disabled={gettingLocation}
          >
            {gettingLocation ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Определение...
              </>
            ) : (
              <>
                <Map className="me-2" />
                Определить по геолокации
              </>
            )}
          </Button>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Отмена
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Сохранение...' : 'Сохранить адрес'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeliveryAddressModal;