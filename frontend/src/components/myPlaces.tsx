import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Alert,
  Spinner,
  Row,
  Col,
  InputGroup,
  Form
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import Map, { NavigationControl, GeolocateControl, Layer, Source, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Search,
  Eye,
  Trash2,
  Map as MapIcon,
  ChevronRight,
  List as ListIcon,
  GeoAlt
} from 'react-bootstrap-icons';
import { ui, chip, btnMain, btnSoft, btnDangerSoft, glassCard } from './supplierUI';


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


interface Place {
  id: number;
  address: string;
  kadastrnumber: string;
  area: number;
  boundaries?: any;
  created_at?: string;
}

interface MyPlacesTabProps {
  refreshTrigger?: number;
}

const convertToMapCoordinates = (boundaries: any) => {
  if (!boundaries || !boundaries.coordinates || boundaries.coordinates.length === 0) {
    return null;
  }

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: boundaries.coordinates
        },
        properties: {}
      }
    ]
  };
};

const getPolygonCenter = (boundaries: any): [number, number] | null => {
  if (!boundaries || !boundaries.coordinates || boundaries.coordinates.length === 0) {
    return null;
  }

  const coords = boundaries.coordinates[0];
  if (!coords.length) return null;

  const sumLon = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0);
  const sumLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0);

  return [sumLon / coords.length, sumLat / coords.length];
};

const MyPlacesTab: React.FC<MyPlacesTabProps> = ({ refreshTrigger }) => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [placeToDelete, setPlaceToDelete] = useState<Place | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [mapViewState, setMapViewState] = useState({
    longitude: 37.6173,
    latitude: 55.7558,
    zoom: 10
  });
  const [hoveredPlaceId, setHoveredPlaceId] = useState<number | null>(null);
  const [selectedPlaceForPopup, setSelectedPlaceForPopup] = useState<Place | null>(null);

  const fetchPlaces = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('userToken');
      const response = await fetch('http://localhost:5000/api/supplier/places', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setPlaces(data.places);
      } else {
        toast.error(data.message || 'Ошибка загрузки участков');
        setPlaces([]);
      }
    } catch (error) {
      console.error('Error fetching places:', error);
      toast.error('Ошибка соединения с сервером');
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaces();
  }, [refreshTrigger]);

  const filteredPlaces = places.filter(place => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      (place.address && place.address.toLowerCase().includes(searchLower)) ||
      (place.kadastrnumber && place.kadastrnumber.toLowerCase().includes(searchLower)) ||
      (place.area && place.area.toString().includes(searchTerm))
    );
  });

  const handleViewDetails = (place: Place) => {
    setSelectedPlace(place);
    setShowDetailsModal(true);
  };

  const handleDeleteClick = (place: Place) => {
    setPlaceToDelete(place);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!placeToDelete) return;

    try {
      setDeletingId(placeToDelete.id);
      const token = localStorage.getItem('userToken');
      const response = await fetch(`http://localhost:5000/api/supplier/places/${placeToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Участок удален из вашего профиля');
        fetchPlaces();
      } else {
        toast.error(data.message || 'Ошибка удаления');
      }
    } catch (error) {
      console.error('Error deleting place:', error);
      toast.error('Ошибка сервера');
    } finally {
      setDeletingId(null);
      setShowDeleteModal(false);
      setPlaceToDelete(null);
    }
  };

  const formatArea = (area: number) => {
    if (!area || isNaN(area)) return '0 м²';
    if (area >= 10000) {
      return `${(area / 10000).toFixed(2)} га`;
    }
    return `${area.toLocaleString('ru-RU')} м²`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Неизвестно';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const hasBoundaries = (place: Place) => {
    return place.boundaries &&
      place.boundaries.coordinates &&
      place.boundaries.coordinates.length > 0;
  };

  const handlePlaceClick = (place: Place) => {
    setSelectedPlaceForPopup(place);
    if (place.boundaries) {
      const center = getPolygonCenter(place.boundaries);
      if (center) {
        setMapViewState({
          ...mapViewState,
          longitude: center[0],
          latitude: center[1],
          zoom: 16
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" style={{ color: ui.green }} />
        <p className="mt-2" style={{ color: ui.muted }}>Загрузка ваших участков...</p>
      </div>
    );
  }

  const totalArea = places.reduce((sum, place) => sum + (place.area || 0), 0);

  return (
    <div className="my-places-tab">
      <Card className="border-0 mb-4" style={{ ...glassCard(), overflow: 'hidden' }}>
        <Card.Body style={{ padding: '1.25rem 1.35rem' }}>
          <Row className="align-items-center g-3">
            <Col md={6}>
              <h4 className="mb-1" style={{ color: ui.text }}>
                {/* <MapIcon className="me-2" style={{ color: ui.green }} /> */}
                Мои участки
              </h4>
              <div className="d-flex flex-wrap gap-2 mt-2">
                <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                  Общая площадь: {formatArea(totalArea)}
                </span>
                <span style={chip(ui.greenSoft, ui.greenDark)}>Количество: {places.length}</span>
              </div>
              <p style={{ color: ui.muted }} className="mb-0 mt-2">
                Управляйте вашими земельными участками
              </p>
            </Col>

            <Col md={6} className="text-md-end">
              <Button
                style={btnSoft()}
                onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              >
                {viewMode === 'list' ? (
                  <>
                    <MapIcon className="me-1" /> Показать на карте
                  </>
                ) : (
                  <>
                    <ListIcon className="me-1" /> Показать списком
                  </>
                )}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="border-0 mb-4" style={{ borderRadius: 24, boxShadow: ui.shadowSoft }}>
        <Card.Body>
          <Row className="g-3">
            <Col md={7}>
              <InputGroup>
                <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                  <Search style={{ color: ui.green }} />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Поиск по адресу, кадастровому номеру или площади..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ borderColor: ui.border }}
                />
                {searchTerm && (
                  <Button style={btnSoft()} onClick={() => setSearchTerm('')}>
                    Очистить
                  </Button>
                )}
              </InputGroup>
            </Col>

            <Col md={5} className="text-md-end">
              <Button style={btnMain()} onClick={fetchPlaces} disabled={loading}>
                {loading ? (
                  <Spinner animation="border" size="sm" className="me-2" />
                ) : null}
                Обновить список
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {viewMode === 'list' ? (
        <>
          {filteredPlaces.length === 0 ? (
            <Alert
              className="text-center py-5"
              style={{
                background: searchTerm ? ui.goldSoft : ui.blueGraySoft,
                color: searchTerm ? ui.gold : ui.blueGray,
                border: `1px solid ${ui.border}`
              }}
            >
              <MapIcon size={42} className="mb-3" />
              <h4>
                {searchTerm ? 'Участки не найдены' : 'У вас пока нет добавленных участков'}
              </h4>
              <p className="mb-0">
                {searchTerm
                  ? 'Попробуйте изменить параметры поиска'
                  : 'Добавьте ваш первый участок через вкладку "Добавить участок"'}
              </p>
            </Alert>
          ) : (
            <Card className="border-0" style={{ borderRadius: 24, boxShadow: ui.shadowSoft }}>
              <Card.Body>
                <div className="table-responsive">
                  <Table hover className="align-middle mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>#</th>
                        <th>Кадастровый номер</th>
                        <th>Адрес</th>
                        <th style={{ width: '150px' }}>Площадь</th>
                        <th style={{ width: '150px' }}>Границы</th>
                        <th style={{ width: '180px' }}>Действия</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredPlaces.map((place, index) => (
                        <tr
                          key={place.id}
                          onMouseEnter={() => setHoveredPlaceId(place.id)}
                          onMouseLeave={() => setHoveredPlaceId(null)}
                          style={{
                            backgroundColor: hoveredPlaceId === place.id ? '#faf9f7' : 'inherit',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleViewDetails(place)}
                        >
                          <td style={{ color: ui.muted }}>{index + 1}</td>
                          <td>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                                {place.kadastrnumber || 'Не указан'}
                              </span>
                              <ChevronRight size={12} style={{ color: ui.muted }} />
                            </div>
                          </td>

                          <td>
                            <div style={{ color: ui.text, fontWeight: 600 }}>
                              {place.address || 'Адрес не указан'}
                            </div>
                            {place.created_at && (
                              <div className="small" style={{ color: ui.muted }}>
                                Добавлен: {formatDate(place.created_at)}
                              </div>
                            )}
                          </td>

                          <td>
                            <span style={chip(ui.greenSoft, ui.greenDark)}>
                              {formatArea(place.area)}
                            </span>
                          </td>

                          <td>
                            {hasBoundaries(place) ? (
                              <span style={chip(ui.blueGray, ui.border)}>Есть границы</span>
                            ) : (
                              <span style={chip(ui.goldSoft, ui.gold)}>Нет контура</span>
                            )}
                          </td>

                          <td>
                            <div className="d-flex gap-2 flex-wrap">
                              <Button
                                style={btnSoft()}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(place);
                                }}
                              >
                                <Eye className="me-1" />
                                Детали
                              </Button>

                              <Button
                                style={btnDangerSoft()}
                                size="sm"
                                disabled={deletingId === place.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(place);
                                }}
                              >
                                <Trash2 className="me-1" />
                                Удалить
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          )}
        </>
      ) : (
        <Card className="border-0" style={{ borderRadius: 24, boxShadow: ui.shadowSoft }}>
          <Card.Body style={{ padding: '0.75rem' }}>
            <div
              style={{
                height: 620,
                borderRadius: 18,
                overflow: 'hidden',
                border: `1px solid ${ui.border}`
              }}
            >
              <Map
                mapStyle={osmRasterStyle}
                {...mapViewState}
                onMove={(evt) => setMapViewState(evt.viewState)}
              >
                <NavigationControl position="top-right" />
                <GeolocateControl position="top-right" />

                {filteredPlaces.map((place) => {
                  const geojson = convertToMapCoordinates(place.boundaries);
                  if (!geojson) return null;

                  return (
                    <Source key={place.id} id={`place-${place.id}`} type="geojson" data={geojson}>
                      <Layer
                        id={`fill-${place.id}`}
                        type="fill"
                        paint={{
                          'fill-color': hoveredPlaceId === place.id ? ui.green : ui.purple,
                          'fill-opacity': hoveredPlaceId === place.id ? 0.3 : 0.18
                        }}
                      />
                      <Layer
                        id={`line-${place.id}`}
                        type="line"
                        paint={{
                          'line-color': hoveredPlaceId === place.id ? ui.greenDark : ui.blueGray,
                          'line-width': hoveredPlaceId === place.id ? 2.5 : 1.6
                        }}
                      />
                    </Source>
                  );
                })}

                {selectedPlaceForPopup?.boundaries && getPolygonCenter(selectedPlaceForPopup.boundaries) && (
                  <Popup
                    longitude={getPolygonCenter(selectedPlaceForPopup.boundaries)![0]}
                    latitude={getPolygonCenter(selectedPlaceForPopup.boundaries)![1]}
                    closeOnClick={false}
                    onClose={() => setSelectedPlaceForPopup(null)}
                  >
                    <div style={{ minWidth: 220 }}>
                      <div style={{ fontWeight: 700, color: ui.text }}>
                        {selectedPlaceForPopup.address || 'Без адреса'}
                      </div>
                      <div className="small" style={{ color: ui.muted }}>
                        {selectedPlaceForPopup.kadastrnumber}
                      </div>
                      <div className="mt-2">
                        <span style={chip(ui.greenSoft, ui.greenDark)}>
                          {formatArea(selectedPlaceForPopup.area)}
                        </span>
                      </div>
                    </div>
                  </Popup>
                )}
              </Map>
            </div>

            <div className="d-flex flex-wrap gap-2 mt-3">
              {filteredPlaces.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => handlePlaceClick(place)}
                  onMouseEnter={() => setHoveredPlaceId(place.id)}
                  onMouseLeave={() => setHoveredPlaceId(null)}
                  style={{
                    border: `1px solid ${hoveredPlaceId === place.id ? ui.green : ui.border}`,
                    background: hoveredPlaceId === place.id ? ui.greenSoft : '#fff',
                    color: hoveredPlaceId === place.id ? ui.greenDark : ui.text,
                    borderRadius: 14,
                    padding: '0.65rem 0.85rem',
                    fontWeight: 600
                  }}
                >
                  <GeoAlt className="me-1" />
                  {place.kadastrnumber}
                </button>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Детали участка</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {selectedPlace && (
            <Row className="g-4">
              <Col md={6}>
                <div className="d-flex flex-column gap-3">
                  <div>
                    <div className="small" style={{ color: ui.muted }}>Кадастровый номер</div>
                    <div style={{ color: ui.text, fontWeight: 700 }}>
                      {selectedPlace.kadastrnumber || 'Не указан'}
                    </div>
                  </div>

                  <div>
                    <div className="small" style={{ color: ui.muted }}>Адрес</div>
                    <div style={{ color: ui.text, fontWeight: 700 }}>
                      {selectedPlace.address || 'Адрес не указан'}
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2">
                    <span style={chip(ui.greenSoft, ui.greenDark)}>
                      Площадь: {formatArea(selectedPlace.area)}
                    </span>

                    <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                      Добавлен: {formatDate(selectedPlace.created_at)}
                    </span>
                  </div>
                </div>
              </Col>

              <Col md={6}>
                {hasBoundaries(selectedPlace) ? (
                  <div
                    style={{
                      height: 280,
                      borderRadius: 18,
                      overflow: 'hidden',
                      border: `1px solid ${ui.border}`
                    }}
                  >
                    <Map
                      mapStyle={osmRasterStyle}
                      initialViewState={{
                        longitude: getPolygonCenter(selectedPlace.boundaries)?.[0] || 37.6173,
                        latitude: getPolygonCenter(selectedPlace.boundaries)?.[1] || 55.7558,
                        zoom: 15
                      }}
                    >
                      <NavigationControl position="top-right" />
                      {convertToMapCoordinates(selectedPlace.boundaries) && (
                        <Source
                          id="selected-place"
                          type="geojson"
                          data={convertToMapCoordinates(selectedPlace.boundaries)!}
                        >
                          <Layer
                            id="selected-place-fill"
                            type="fill"
                            paint={{
                              'fill-color': ui.green,
                              'fill-opacity': 0.22
                            }}
                          />
                          <Layer
                            id="selected-place-line"
                            type="line"
                            paint={{
                              'line-color': ui.greenDark,
                              'line-width': 2
                            }}
                          />
                        </Source>
                      )}
                    </Map>
                  </div>
                ) : (
                  <Alert
                    style={{
                      background: ui.goldSoft,
                      color: ui.gold,
                      border: `1px solid ${ui.border}`
                    }}
                  >
                    Границы участка недоступны
                  </Alert>
                )}
              </Col>
            </Row>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowDetailsModal(false)}>
            Закрыть
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Подтверждение удаления</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {placeToDelete && (
            <>
              <Alert
                style={{
                  background: ui.redSoft,
                  color: ui.red,
                  border: `1px solid ${ui.border}`
                }}
              >
                Вы уверены, что хотите удалить этот участок из профиля?
              </Alert>

              <div
                style={{
                  borderRadius: 18,
                  border: `1px solid ${ui.border}`,
                  padding: '1rem',
                  background: '#faf9f7'
                }}
              >
                <div style={{ fontWeight: 700, color: ui.text }}>{placeToDelete.address}</div>
                <div className="small mt-1" style={{ color: ui.muted }}>
                  {placeToDelete.kadastrnumber}
                </div>
              </div>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowDeleteModal(false)}>
            Отмена
          </Button>

          <Button
            style={btnDangerSoft()}
            onClick={handleConfirmDelete}
            disabled={deletingId !== null}
          >
            {deletingId !== null ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Удаление...
              </>
            ) : (
              'Удалить'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MyPlacesTab;