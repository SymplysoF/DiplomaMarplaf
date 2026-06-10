import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Form,
  Spinner,
  Alert,
  Modal,
  Row,
  Col,
  InputGroup
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import Map, { NavigationControl, GeolocateControl, Layer, Source } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeoAlt, Search, CheckCircle, ShieldCheck } from 'react-bootstrap-icons';
import { ui, chip, btnMain, btnSoft, glassCard } from './supplierUI';

const osmRasterStyle: any = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19
    }
  },
  layers: [
    {
      id: 'osm-base',
      type: 'raster',
      source: 'osm'
    }
  ]
};


interface ApiResponse {
  success: boolean;
  data?: any;
  isMock?: boolean;
  message?: string;
}

interface AddPlaceTabProps {
  onPlaceAdded?: () => void;
}

interface CadastralData {
  address: string;
  area: number;
  category: string;
  kadastrNumber: string;
  coordinates: [number, number][];
  cadastralValue?: number;
  registrationDate?: string;
}

const AddPlaceTab: React.FC<AddPlaceTabProps> = ({ onPlaceAdded }) => {
  const [kadastrNumber, setKadastrNumber] = useState('');
  const [checking, setChecking] = useState(false);
  const [placeData, setPlaceData] = useState<CadastralData | null>(null);
  const [adding, setAdding] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: 37.6173,
    latitude: 55.7558,
    zoom: 10
  });

  const convertCoordinates = (coords3857: [number, number][]): [number, number][] => {
    return coords3857.map(coord => {
      const lon = (coord[0] * 180) / 20037508.34;
      const lat = (Math.atan(Math.exp((coord[1] / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;
      return [lat, lon];
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Не указана';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'Не указана';
    return value.toLocaleString('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    });
  };

  const coordinatesToGeoJSON = (coords: [number, number][]) => {
    const lngLatCoords = coords.map(([lat, lon]) => [lon, lat]);
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [lngLatCoords]
      },
      properties: {}
    };
  };

  const parseCadastralData = (apiResponse: any): CadastralData | null => {
    try {
      if (apiResponse.isMock) {
        const mockData = apiResponse.data;
        return {
          address: mockData.address || 'Адрес не указан',
          area: parseFloat(mockData.area) || 0,
          category: mockData.category || 'Не указана',
          kadastrNumber,
          coordinates: mockData.coordinates?.[0] || []
        };
      }

      const responseData = apiResponse.data?.data;
      if (!responseData?.features?.length) return null;

      const feature = responseData.features[0];
      if (!feature.geometry || !feature.properties) return null;

      const geometry = feature.geometry;
      const properties = feature.properties;

      let coordinates: [number, number][] = [];
      if (
        geometry.type === 'Polygon' &&
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length > 0 &&
        Array.isArray(geometry.coordinates[0])
      ) {
        const coords3857 = geometry.coordinates[0] as [number, number][];
        coordinates = convertCoordinates(coords3857);
      } else {
        return null;
      }

      const areaStr = properties.options?.specified_area;
      const costStr = properties.options?.cost_value;

      return {
        address: properties.options?.readable_address || 'Адрес не указан',
        area: areaStr ? parseFloat(String(areaStr)) : 0,
        category: properties.options?.land_record_category_type || 'Не указана',
        kadastrNumber: properties.label || kadastrNumber,
        coordinates,
        cadastralValue: costStr ? parseFloat(String(costStr)) : undefined,
        registrationDate: properties.options?.land_record_reg_date
      };
    } catch (error) {
      console.error('Error parsing cadastral data:', error);
      return null;
    }
  };

  useEffect(() => {
    if (placeData?.coordinates?.length) {
      const isValid = placeData.coordinates.some(([lat, lon]) => lat !== 0 && lon !== 0);
      if (!isValid) return;

      const sumLat = placeData.coordinates.reduce((sum, [lat]) => sum + lat, 0);
      const sumLon = placeData.coordinates.reduce((sum, [, lon]) => sum + lon, 0);

      setViewState(vs => ({
        ...vs,
        longitude: sumLon / placeData.coordinates.length,
        latitude: sumLat / placeData.coordinates.length,
        zoom: 16
      }));
    }
  }, [placeData]);

  const handleCheckKadastr = async () => {
    if (!kadastrNumber.trim()) {
      toast.error('Введите кадастровый номер');
      return;
    }

    const kadastrRegex = /^\d{2}:\d{2}:\d{6,7}:\d+$/;
    if (!kadastrRegex.test(kadastrNumber)) {
      toast.error('Неверный формат. Пример: 77:01:0001001:123');
      return;
    }

    try {
      setChecking(true);
      const token = localStorage.getItem('userToken');

      const response = await fetch('http://localhost:5000/api/check-cadastr', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ kadastrNumber })
      });

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      if (result.success && result.data) {
        const parsedData = parseCadastralData(result);

        if (parsedData) {
          setPlaceData(parsedData);
          if (result.isMock) {
            toast.warning('Используются тестовые данные (API временно недоступно)');
          } else {
            toast.success('Данные участка получены из Росреестра');
          }
        } else {
          toast.error('Не удалось обработать данные участка');
        }
      } else {
        toast.error(result.message || 'Участок не найден');
      }
    } catch (error) {
      console.error('Error checking cadastral number:', error);
      toast.error('Ошибка при проверке кадастрового номера');
    } finally {
      setChecking(false);
    }
  };

  const handleAddPlace = async () => {
    if (!placeData) return;

    try {
      setAdding(true);
      const token = localStorage.getItem('userToken');

      const response = await fetch('http://localhost:5000/api/supplier/places', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kadastrNumber: placeData.kadastrNumber,
          address: placeData.address,
          area: placeData.area,
          category: placeData.category,
          boundaries: coordinatesToGeoJSON(placeData.coordinates),
          cadastralValue: placeData.cadastralValue,
          registrationDate: placeData.registrationDate
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Участок успешно добавлен');
        setShowConfirmation(false);
        setPlaceData(null);
        setKadastrNumber('');
        onPlaceAdded?.();
      } else {
        toast.error(data.message || 'Ошибка добавления участка');
      }
    } catch (error) {
      console.error('Error adding place:', error);
      toast.error('Ошибка сервера');
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Card className="border-0" style={{ ...glassCard(), overflow: 'hidden' }}>
        <Card.Body style={{ padding: '1.35rem' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
            <div>
              <h4 className="mb-1" style={{ color: ui.text }}>
                {/* <GeoAlt className="me-2" style={{ color: ui.green }} /> */}
                Добавить участок
              </h4>
              <div style={{ color: ui.muted }}>
                Проверьте кадастровый номер и добавьте участок в профиль поставщика
              </div>
            </div>

            <span style={chip(ui.greenSoft, ui.greenDark)}>Росреестр / кадастр</span>
          </div>

          <Row className="g-4">
            <Col xl={5}>
              <Card className="border-0" style={{ borderRadius: 20, boxShadow: ui.shadowSoft }}>
                <Card.Body>
                  <Form.Label style={{ color: ui.text, fontWeight: 600 }}>
                    Кадастровый номер
                  </Form.Label>

                  <InputGroup className="mb-3">
                    <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                      <Search style={{ color: ui.green }} />
                    </InputGroup.Text>
                    <Form.Control
                      value={kadastrNumber}
                      onChange={(e) => setKadastrNumber(e.target.value)}
                      placeholder="Например: 77:01:0001001:123"
                      style={{ borderColor: ui.border }}
                    />
                  </InputGroup>

                  <div className="d-flex gap-2 flex-wrap">
                    <Button style={btnMain()} onClick={handleCheckKadastr} disabled={checking}>
                      {checking ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Проверка...
                        </>
                      ) : (
                        'Проверить участок'
                      )}
                    </Button>

                    <Button
                      style={btnSoft()}
                      onClick={() => {
                        setKadastrNumber('');
                        setPlaceData(null);
                      }}
                    >
                      Очистить
                    </Button>
                  </div>

                  <div
                    className="mt-3"
                    style={{
                      borderRadius: 16,
                      border: `1px solid ${ui.border}`,
                      background: '#faf9f7',
                      padding: '0.9rem',
                      color: ui.muted
                    }}
                  >
                    Поддерживаемый формат: <strong>XX:XX:XXXXXXX:X</strong>
                  </div>
                </Card.Body>
              </Card>

              {placeData && (
                <Card className="border-0 mt-4" style={{ borderRadius: 20, boxShadow: ui.shadowSoft }}>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                      <h5 className="mb-0" style={{ color: ui.text }}>
                        Результат проверки
                      </h5>
                      <span style={chip(ui.greenSoft, ui.greenDark)}>
                        <CheckCircle size={14} />
                        Данные найдены
                      </span>
                    </div>

                    <div className="d-flex flex-column gap-3">
                      <div>
                        <div style={{ color: ui.muted, fontSize: '0.88rem' }}>Кадастровый номер</div>
                        <div style={{ color: ui.text, fontWeight: 600 }}>{placeData.kadastrNumber}</div>
                      </div>

                      <div>
                        <div style={{ color: ui.muted, fontSize: '0.88rem' }}>Адрес</div>
                        <div style={{ color: ui.text, fontWeight: 600 }}>{placeData.address}</div>
                      </div>

                      <div className="d-flex flex-wrap gap-2">
                        <span style={chip(ui.greenSoft, ui.greenDark)}>
                          Площадь: {placeData.area.toLocaleString('ru-RU')} м²
                        </span>
                        <span>
                          Категория: {placeData.category}
                        </span>
                      </div>

                      <div className="d-flex flex-wrap gap-2">
                        <span>
                          Кадастровая стоимость: {formatCurrency(placeData.cadastralValue)}
                        </span>
                        <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                          Регистрация: {formatDate(placeData.registrationDate)}
                        </span>
                      </div>

                      <Button style={btnMain()} onClick={() => setShowConfirmation(true)}>
                        Добавить участок в профиль
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              )}
            </Col>

            <Col xl={7}>
              <Card className="border-0" style={{ borderRadius: 20, boxShadow: ui.shadowSoft }}>
                <Card.Body style={{ padding: '0.75rem' }}>
                  <div
                    style={{
                      height: 520,
                      borderRadius: 18,
                      overflow: 'hidden',
                      border: `1px solid ${ui.border}`
                    }}
                  >
                    <Map
                      mapStyle={osmRasterStyle}
                      {...viewState}
                      onMove={(evt) => setViewState(evt.viewState)}
                    >
                      <NavigationControl position="top-right" />
                      <GeolocateControl position="top-right" />

                      {placeData?.coordinates?.length ? (
                        <Source id="cadastral-polygon" type="geojson" data={coordinatesToGeoJSON(placeData.coordinates)}>
                          <Layer
                            id="polygon-fill"
                            type="fill"
                            paint={{
                              'fill-color': ui.green,
                              'fill-opacity': 0.22
                            }}
                          />
                          <Layer
                            id="polygon-line"
                            type="line"
                            paint={{
                              'line-color': ui.greenDark,
                              'line-width': 2
                            }}
                          />
                        </Source>
                      ) : null}
                    </Map>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {!placeData && (
            <Alert
              className="mt-4 mb-0"
              style={{
                background: ui.blueGraySoft,
                color: ui.blueGray,
                border: `1px solid ${ui.border}`
              }}
            >
              Сначала проверьте кадастровый номер, затем система покажет данные участка и границы на карте.
            </Alert>
          )}
        </Card.Body>
      </Card>

      <Modal show={showConfirmation} onHide={() => setShowConfirmation(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Подтверждение добавления</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Alert
            style={{
              background: ui.goldSoft,
              color: ui.gold,
              border: `1px solid ${ui.border}`
            }}
          >
            Вы уверены, что хотите добавить этот участок в свой профиль поставщика?
          </Alert>

          {placeData && (
            <div
              style={{
                borderRadius: 18,
                border: `1px solid ${ui.border}`,
                padding: '1rem',
                background: '#faf9f7'
              }}
            >
              <div className="d-flex flex-wrap gap-2 mb-3">
                <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                  {placeData.kadastrNumber}
                </span>

                <span style={chip(ui.greenSoft, ui.greenDark)}>
                  {placeData.area.toLocaleString('ru-RU')} м²
                </span>
              </div>

              <p className="mb-2"><strong>Адрес:</strong> {placeData.address}</p>
              <p className="mb-2"><strong>Категория:</strong> {placeData.category}</p>
              <p className="mb-0"><strong>Стоимость:</strong> {formatCurrency(placeData.cadastralValue)}</p>

              <div
                className="mt-3"
                style={{
                  background: ui.greenSoft,
                  color: ui.greenDark,
                  border: `1px solid ${ui.border}`,
                  borderRadius: 14,
                  padding: '0.8rem 0.9rem'
                }}
              >
                <ShieldCheck className="me-2" />
                Данные получены из официального источника Росреестра
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowConfirmation(false)} disabled={adding}>
            Отмена
          </Button>
          <Button style={btnMain()} onClick={handleAddPlace} disabled={adding}>
            {adding ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Добавление...
              </>
            ) : (
              'Подтвердить добавление'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AddPlaceTab;