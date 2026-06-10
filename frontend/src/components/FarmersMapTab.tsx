import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Spinner,
  InputGroup,
  Form,
  Alert,
  Modal,
  Table
} from 'react-bootstrap';
import {
  Grid,
  Search,
  GeoAlt,
  InfoCircle,
  ArrowClockwise,
  PlusLg,
  PencilSquare,
  Trash,
  Layers,
  BoxSeam,
  Droplet,
  Flower1,
  Tree,
  ThermometerHigh,
  EggFried,
  ChevronRight
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import Map, {
  Source,
  Layer,
  NavigationControl,
  GeolocateControl,
  Popup,
  MapRef,
  ViewStateChangeEvent
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import Supercluster from 'supercluster';
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

interface ProductInPlace {
  id: number;
  name: string;
  objectName: string;
  categoryId: number | null;
  categoryName: string | null;
}

interface Place {
  id: number;
  address: string;
  kadastrNumber: string;
  area: number;
  boundaries: any;
  created_at?: string;
  products: ProductInPlace[];
}

interface CategoryGroup {
  categoryId: number;
  categoryName: string;
  products: ProductInPlace[];
  productCount: number;
  totalItems: number;
  icon: React.ReactNode;
}

interface ClusterProperties {
  id?: number;
  address?: string;
  kadastrNumber?: string;
  area?: number;
  productsCount?: number;
  categoriesCount?: number;
  color?: string;
  productNames?: string;
  cluster?: boolean;
  cluster_id?: number;
  point_count?: number;
  point_count_abbreviated?: number;
}

interface MapWithCategoriesTabProps {
  refreshTrigger?: number;
  onOpenAddPlace?: () => void;
  onOpenMyPlaces?: () => void;
}

const ZOOM_THRESHOLD = 12;

const getCategoryIcon = (categoryName?: string | null, size: number = 16) => {
  if (!categoryName) {
    return <BoxSeam size={size} style={{ color: ui.blueGray }} />;
  }

  const name = categoryName.toLowerCase();

  if (name.includes('молоко') || name.includes('молоч')) {
    return <Droplet size={size} style={{ color: ui.blueGray }} />;
  }
  if (name.includes('овощ')) {
    return <Flower1 size={size} style={{ color: ui.green }} />;
  }
  if (name.includes('фрукт') || name.includes('ягод')) {
    return <Tree size={size} style={{ color: ui.red }} />;
  }
  if (name.includes('мясо') || name.includes('птиц')) {
    return <ThermometerHigh size={size} style={{ color: ui.gold }} />;
  }
  if (name.includes('зерн') || name.includes('злак')) {
    return <EggFried size={size} style={{ color: ui.purple }} />;
  }

  return <BoxSeam size={size} style={{ color: ui.blueGray }} />;
};

const getColorByCategoriesCount = (count: number) => {
  if (count >= 3) return ui.red;
  if (count === 2) return ui.gold;
  return ui.green;
};

const getFillColorByCategoriesCount = (count: number) => {
  if (count >= 3) return '#f3d7d0';
  if (count === 2) return '#fbf1d9';
  return '#dceadf';
};

const formatArea = (area: number) => {
  if (!area || Number.isNaN(area)) return '0 м²';
  if (area >= 10000) return `${(area / 10000).toFixed(2)} га`;
  return `${area.toLocaleString('ru-RU')} м²`;
};

const getPolygonCenter = (geometry: any): [number, number] | null => {
  if (!geometry || geometry.type !== 'Polygon' || !geometry.coordinates?.[0]?.length) {
    return null;
  }

  const coords = geometry.coordinates[0];
  const sumLon = coords.reduce((sum: number, c: number[]) => sum + c[0], 0);
  const sumLat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0);

  return [sumLon / coords.length, sumLat / coords.length];
};

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

const MapWithCategoriesTab: React.FC<MapWithCategoriesTabProps> = ({
  refreshTrigger,
  onOpenAddPlace,
  onOpenMyPlaces
}) => {
  const [viewState, setViewState] = useState({
    longitude: 37.6173,
    latitude: 55.7558,
    zoom: 10
  });

  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<number | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [currentZoom, setCurrentZoom] = useState(viewState.zoom);

  const [clusters, setClusters] = useState<any[]>([]);
  const [clusterPoints, setClusterPoints] = useState<any[]>([]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [placeToDelete, setPlaceToDelete] = useState<Place | null>(null);
  const [deleting, setDeleting] = useState(false);

  const mapRef = useRef<MapRef | null>(null);
  const superclusterRef = useRef<Supercluster<ClusterProperties> | null>(null);

  const fetchPlacesWithProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('userToken');

      const response = await fetch('http://localhost:5000/api/supplier/places-with-products', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        const nextPlaces: Place[] = data.places || [];
        setPlaces(nextPlaces);

        if (nextPlaces.length > 0 && nextPlaces[0].boundaries) {
          const center = getPolygonCenter(nextPlaces[0].boundaries);
          if (center) {
            setViewState({
              longitude: center[0],
              latitude: center[1],
              zoom: 14
            });
          }
        }
      } else {
        toast.error(data.message || 'Ошибка загрузки данных');
      }
    } catch (error) {
      console.error('Error fetching places with products:', error);
      toast.error('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlacesWithProducts();
  }, [refreshTrigger]);

  useEffect(() => {
    if (places.length === 0) return;

    const points = places
      .filter((place) => place.boundaries)
      .map((place) => {
        const center = getPolygonCenter(place.boundaries);
        if (!center) return null;

        const categoriesCount = new Set(place.products.map((p) => p.categoryId)).size;

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [center[0], center[1]]
          },
          properties: {
            id: place.id,
            address: place.address,
            kadastrNumber: place.kadastrNumber,
            area: place.area,
            productsCount: place.products.length,
            categoriesCount,
            color: getColorByCategoriesCount(categoriesCount),
            productNames: place.products.map((p) => p.name).join(', ')
          }
        };
      })
      .filter(Boolean) as GeoJSON.Feature<GeoJSON.Point, ClusterProperties>[];

    setClusterPoints(points);

    const supercluster = new Supercluster<ClusterProperties>({
      radius: 60,
      maxZoom: 20
    });

    supercluster.load(points);
    superclusterRef.current = supercluster;

    const bbox: [number, number, number, number] = [
      -180,
      -85,
      180,
      85
    ];
    const newClusters = supercluster.getClusters(bbox, Math.floor(currentZoom));
    setClusters(newClusters);
  }, [places, currentZoom]);

  const handleMapMove = (evt: ViewStateChangeEvent) => {
    setViewState({
      longitude: evt.viewState.longitude,
      latitude: evt.viewState.latitude,
      zoom: evt.viewState.zoom
    });

    setCurrentZoom(evt.viewState.zoom);

    if (superclusterRef.current && mapRef.current) {
      const bounds = mapRef.current.getBounds();
      if (!bounds) return;

      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ];

      const newClusters = superclusterRef.current.getClusters(
        bbox,
        Math.floor(evt.viewState.zoom)
      );
      setClusters(newClusters);
    }
  };

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      if (!searchTerm) return true;

      const searchLower = searchTerm.toLowerCase();

      const matchesPlace =
        place.address.toLowerCase().includes(searchLower) ||
        place.kadastrNumber.toLowerCase().includes(searchLower);

      const matchesProduct = place.products.some((p) =>
        p.name.toLowerCase().includes(searchLower) ||
        (p.categoryName || '').toLowerCase().includes(searchLower) ||
        p.objectName.toLowerCase().includes(searchLower)
      );

      return matchesPlace || matchesProduct;
    });
  }, [places, searchTerm]);

  const getCategoryGroups = (place: Place): CategoryGroup[] => {
    const groups: { [key: number]: CategoryGroup } = {};

    place.products.forEach((product) => {
      if (!product.categoryId) return;

      if (!groups[product.categoryId]) {
        groups[product.categoryId] = {
          categoryId: product.categoryId,
          categoryName: product.categoryName || 'Без категории',
          products: [],
          productCount: 0,
          totalItems: 0,
          icon: getCategoryIcon(product.categoryName)
        };
      }

      groups[product.categoryId].products.push(product);
    });

    Object.values(groups).forEach((group) => {
      const uniqueProducts = new Set(group.products.map((p) => p.id));
      group.productCount = uniqueProducts.size;
      group.totalItems = group.products.length;
    });

    return Object.values(groups);
  };

  const toggleCategory = (categoryId: number) => {
    const next = new Set(expandedCategories);

    if (next.has(categoryId)) next.delete(categoryId);
    else next.add(categoryId);

    setExpandedCategories(next);
  };

  const centerOnPlace = (place: Place) => {
    if (!place.boundaries) return;

    const center = getPolygonCenter(place.boundaries);
    if (center) {
      setViewState({
        longitude: center[0],
        latitude: center[1],
        zoom: 16
      });
    }

    setSelectedPlace(place);
    setShowPopup(true);
  };

  const handleDeleteClick = (place: Place) => {
    setPlaceToDelete(place);
    setShowDeleteModal(true);
  };

  const handleDeletePlace = async () => {
    if (!placeToDelete) return;

    try {
      setDeleting(true);
      const token = localStorage.getItem('userToken');

      const response = await fetch(`http://localhost:5000/api/supplier/places/${placeToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Участок удалён');
        setShowDeleteModal(false);
        setPlaceToDelete(null);
        setShowPopup(false);
        setSelectedPlace(null);
        fetchPlacesWithProducts();
      } else {
        toast.error(data.message || 'Ошибка удаления');
      }
    } catch {
      toast.error('Ошибка сервера');
    } finally {
      setDeleting(false);
    }
  };

  const totalProducts = filteredPlaces.reduce((sum, place) => sum + place.products.length, 0);
  const totalCategories = new Set(
    filteredPlaces.flatMap((place) =>
      place.products
        .map((p) => p.categoryName)
        .filter((cat): cat is string => !!cat)
    )
  ).size;

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" style={{ color: ui.green }} />
        <p className="mt-3 mb-0" style={{ color: ui.muted }}>
          Загрузка карты участков...
        </p>
      </div>
    );
  }

  return (
    <>
      <Card className="border-0 mb-4" style={{ ...glassCard(), overflow: 'hidden' }}>
        <Card.Body style={{ padding: '1.35rem' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <h4 className="mb-1" style={{ color: ui.text }}>
                {/* <Grid className="me-2" style={{ color: ui.green }} /> */}
                Карта участков и категорий
              </h4>
              <div style={{ color: ui.muted }}>
                Просмотр участков поставщика, категорий товаров и управление участками
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <span style={chip(ui.greenSoft, ui.greenDark)}>
                Участков: {filteredPlaces.length}
              </span>
              <span style={chip(ui.blueGraySoft, ui.purple)}>
                Категорий: {totalCategories}
              </span>
              <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                Товаров: {totalProducts}
              </span>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Row className="g-4">
        <Col lg={4}>
          <Card className="border-0 h-100" style={{ borderRadius: 24, boxShadow: ui.shadowSoft }}>
            <Card.Body style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 700 }}>
              <div
                style={{
                  padding: '1rem 1rem 0.9rem',
                  borderBottom: `1px solid ${ui.border}`
                }}
              >
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <div style={{ color: ui.text, fontWeight: 700 }}>Список участков</div>

                  <div className="d-flex gap-2 flex-wrap">
                    {onOpenAddPlace ? (
                      <Button style={btnMain()} size="sm" onClick={onOpenAddPlace}>
                        <PlusLg className="me-1" />
                        Добавить участок
                      </Button>
                    ) : null}

                    <Button style={btnSoft()} size="sm" onClick={fetchPlacesWithProducts}>
                      <ArrowClockwise className="me-1" />
                      Обновить
                    </Button>
                  </div>
                </div>

                <InputGroup>
                  <InputGroup.Text style={{ background: '#fff', borderColor: ui.border }}>
                    <Search style={{ color: ui.green }} />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Поиск по участкам и товарам"
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
              </div>

              <div style={{ overflowY: 'auto', padding: '0.75rem', flex: 1 }}>
                {filteredPlaces.length === 0 ? (
                  <div className="text-center py-5" style={{ color: ui.muted }}>
                    <Grid size={32} className="mb-3" />
                    <div style={{ fontWeight: 600 }}>Участки не найдены</div>
                    <div className="small">Попробуйте изменить поиск</div>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {filteredPlaces.map((place) => {
                      const categoriesCount = new Set(place.products.map((p) => p.categoryId)).size;
                      const groups = getCategoryGroups(place);

                      return (
                        <div
                          key={place.id}
                          onMouseEnter={() => setHoveredPlaceId(place.id)}
                          onMouseLeave={() => setHoveredPlaceId(null)}
                          style={{
                            borderRadius: 18,
                            border: `1px solid ${selectedPlace?.id === place.id
                                ? ui.green
                                : hoveredPlaceId === place.id
                                  ? ui.greenSoft
                                  : ui.border
                              }`,
                            background:
                              selectedPlace?.id === place.id
                                ? '#fcfbf8'
                                : '#fff',
                            padding: '0.9rem',
                            cursor: 'pointer',
                            boxShadow:
                              selectedPlace?.id === place.id
                                ? '0 8px 18px rgba(47,107,58,0.10)'
                                : 'none'
                          }}
                          onClick={() => centerOnPlace(place)}
                        >
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <div className="flex-grow-1">
                              <div style={{ color: ui.text, fontWeight: 700 }}>
                                {place.address.length > 55
                                  ? `${place.address.substring(0, 55)}...`
                                  : place.address}
                              </div>
                              <div className="small mt-1" style={{ color: ui.muted }}>
                                {place.kadastrNumber}
                              </div>
                            </div>

                            {/* <span
                              style={chip(
                                getFillColorByCategoriesCount(categoriesCount),
                                getColorByCategoriesCount(categoriesCount)
                              )}
                            >
                              {categoriesCount} кат.
                            </span> */}
                          </div>

                          <div className="d-flex flex-wrap gap-2 mb-3">
                            <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                              {formatArea(place.area)}
                            </span>
                            <span style={chip(ui.greenSoft, ui.greenDark)}>
                              {place.products.length} позиций
                            </span>
                          </div>

                          <div className="d-flex flex-wrap gap-2 mb-3">
                            {groups.slice(0, 2).map((group) => (
                              <span key={group.categoryId} style={chip(ui.blueGraySoft, ui.muted)}>
                                {/* {group.icon} */}
                                {group.categoryName}: {group.productCount}
                              </span>
                            ))}

                            {groups.length > 2 && (
                              <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                                +{groups.length - 2}
                              </span>
                            )}
                          </div>

                          <div className="d-flex gap-2 justify-content-end">
                            <Button
                              style={btnSoft()}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                centerOnPlace(place);
                              }}
                            >
                              Показать на карте
                            </Button>

                            {onOpenMyPlaces && (
                              <Button
                                style={btnSoft()}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenMyPlaces();
                                }}
                              >
                                <PencilSquare className="me-1" />
                                Управлять
                              </Button>
                            )}

                            <Button
                              style={btnDangerSoft()}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(place);
                              }}
                            >
                              <Trash className="me-1" />
                              Удалить
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                style={{
                  borderTop: `1px solid ${ui.border}`,
                  padding: '0.8rem 1rem',
                  color: ui.muted,
                  fontSize: '0.86rem'
                }}
              >
                <InfoCircle size={12} className="me-1" />
                Цвет маркера показывает количество категорий на участке
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          <Card className="border-0" style={{ borderRadius: 24, boxShadow: ui.shadowSoft }}>
            <Card.Body style={{ padding: '0.75rem' }}>
              <div
                style={{
                  height: 700,
                  borderRadius: 18,
                  overflow: 'hidden',
                  border: `1px solid ${ui.border}`
                }}
              >
                <Map
                  ref={mapRef}
                  {...viewState}
                  onMove={handleMapMove}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle={osmRasterStyle}
                  interactiveLayerIds={[
                    ...(currentZoom >= ZOOM_THRESHOLD ? filteredPlaces.map((p) => `place-fill-${p.id}`) : []),
                    'clusters',
                    'cluster-count',
                    'unclustered-point'
                  ]}
                  onClick={(e) => {
                    if (!e.features || e.features.length === 0) return;

                    const feature = e.features[0];

                    if (feature.layer.id === 'clusters') {
                      const clusterId = feature.properties?.cluster_id;

                      if (
                        superclusterRef.current &&
                        clusterId &&
                        mapRef.current &&
                        feature.geometry.type === 'Point'
                      ) {
                        const expansionZoom =
                          superclusterRef.current.getClusterExpansionZoom(clusterId);
                        const coordinates = feature.geometry.coordinates as [number, number];

                        setViewState({
                          ...viewState,
                          longitude: coordinates[0],
                          latitude: coordinates[1],
                          zoom: expansionZoom
                        });
                      }
                    }

                    if (feature.layer.id === 'unclustered-point') {
                      const placeId = feature.properties?.id;
                      const place = places.find((p) => p.id === placeId);

                      if (place) {
                        setSelectedPlace(place);
                        setShowPopup(true);

                        const center = getPolygonCenter(place.boundaries);
                        if (center) {
                          setViewState({
                            ...viewState,
                            longitude: center[0],
                            latitude: center[1],
                            zoom: 16
                          });
                        }
                      }
                    }

                    if (feature.layer.id.startsWith('place-fill-')) {
                      const layerId = feature.layer.id;
                      const placeId = parseInt(layerId.replace('place-fill-', ''), 10);
                      const place = places.find((p) => p.id === placeId);

                      if (place) {
                        setSelectedPlace(place);
                        setShowPopup(true);
                      }
                    }
                  }}
                >
                  <NavigationControl position="top-right" />
                  <GeolocateControl position="top-left" />

                  {currentZoom >= ZOOM_THRESHOLD &&
                    filteredPlaces
                      .filter((p) => p.boundaries)
                      .map((place) => {
                        const geoJsonData = convertToMapCoordinates(place.boundaries);
                        if (!geoJsonData) return null;

                        const categoriesCount = new Set(place.products.map((p) => p.categoryId)).size;
                        const fillColor = getFillColorByCategoriesCount(categoriesCount);
                        const lineColor = getColorByCategoriesCount(categoriesCount);

                        return (
                          <Source
                            key={place.id}
                            id={`place-${place.id}`}
                            type="geojson"
                            data={geoJsonData}
                          >
                            <Layer
                              id={`place-fill-${place.id}`}
                              type="fill"
                              source={`place-${place.id}`}
                              paint={{
                                'fill-color': selectedPlace?.id === place.id ? ui.goldSoft : fillColor,
                                'fill-opacity': selectedPlace?.id === place.id ? 0.72 : 0.45
                              }}
                            />
                            <Layer
                              id={`place-border-${place.id}`}
                              type="line"
                              source={`place-${place.id}`}
                              paint={{
                                'line-color': selectedPlace?.id === place.id ? ui.gold : lineColor,
                                'line-width': selectedPlace?.id === place.id ? 4 : 2
                              }}
                            />
                          </Source>
                        );
                      })}

                  {clusterPoints.length > 0 && (
                    <Source
                      id="places-points"
                      type="geojson"
                      data={{
                        type: 'FeatureCollection',
                        features: clusters
                      }}
                    >
                      <Layer
                        id="clusters"
                        type="circle"
                        source="places-points"
                        filter={['has', 'point_count']}
                        paint={{
                          'circle-color': [
                            'step',
                            ['get', 'point_count'],
                            ui.blueGray,
                            10,
                            ui.gold,
                            30,
                            ui.red
                          ],
                          'circle-radius': [
                            'step',
                            ['get', 'point_count'],
                            18,
                            10,
                            26,
                            30,
                            34
                          ],
                          'circle-stroke-width': 2,
                          'circle-stroke-color': '#ffffff'
                        }}
                      />

                      <Layer
                        id="cluster-count"
                        type="symbol"
                        source="places-points"
                        filter={['has', 'point_count']}
                        layout={{
                          'text-field': '{point_count_abbreviated}',
                          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                          'text-size': 12
                        }}
                        paint={{
                          'text-color': '#ffffff'
                        }}
                      />

                      <Layer
                        id="unclustered-point"
                        type="circle"
                        source="places-points"
                        filter={['!', ['has', 'point_count']]}
                        paint={{
                          'circle-color': [
                            'match',
                            ['get', 'categoriesCount'],
                            1, ui.green,
                            2, ui.gold,
                            3, ui.red,
                            ui.green
                          ],
                          'circle-radius': 10,
                          'circle-stroke-width': 2,
                          'circle-stroke-color': '#ffffff'
                        }}
                      />

                      <Layer
                        id="unclustered-point-label"
                        type="symbol"
                        source="places-points"
                        minzoom={12}
                        filter={['!', ['has', 'point_count']]}
                        layout={{
                          'text-field': '{productsCount}',
                          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                          'text-size': 10,
                          'text-offset': [0, 1.5]
                        }}
                        paint={{
                          'text-color': '#ffffff',
                          'text-halo-color': '#000000',
                          'text-halo-width': 1
                        }}
                      />
                    </Source>
                  )}

                  {showPopup && selectedPlace && (
                    <Popup
                      longitude={getPolygonCenter(selectedPlace.boundaries)?.[0] || viewState.longitude}
                      latitude={getPolygonCenter(selectedPlace.boundaries)?.[1] || viewState.latitude}
                      onClose={() => setShowPopup(false)}
                      closeButton
                      closeOnClick={false}
                      anchor="bottom"
                      offset={20}
                      maxWidth="420px"
                    >
                      <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                          <div>
                            <div style={{ color: ui.text, fontWeight: 700 }}>
                              {selectedPlace.address}
                            </div>
                            <div className="small" style={{ color: ui.muted }}>
                              {selectedPlace.kadastrNumber}
                            </div>
                          </div>

                          <span style={chip(ui.greenSoft, ui.greenDark)}>
                            ID: {selectedPlace.id}
                          </span>
                        </div>

                        <div className="d-flex flex-wrap gap-2 mb-3">
                          <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                            {formatArea(selectedPlace.area)}
                          </span>
                          <span style={chip(ui.purpleSoft, ui.purple)}>
                            {selectedPlace.products.length} позиций
                          </span>
                        </div>

                        <Table responsive size="sm" className="mb-3">
                          <tbody>
                            <tr>
                              <td className="text-muted">Участок</td>
                              <td className="text-end">{selectedPlace.address}</td>
                            </tr>
                            <tr>
                              <td className="text-muted">Кадастр</td>
                              <td className="text-end">{selectedPlace.kadastrNumber}</td>
                            </tr>
                            <tr>
                              <td className="text-muted">Площадь</td>
                              <td className="text-end">{formatArea(selectedPlace.area)}</td>
                            </tr>
                            <tr>
                              <td className="text-muted">Товаров</td>
                              <td className="text-end">{selectedPlace.products.length}</td>
                            </tr>
                          </tbody>
                        </Table>

                        {getCategoryGroups(selectedPlace).length > 0 ? (
                          <div className="d-flex flex-column gap-2 mb-3">
                            {getCategoryGroups(selectedPlace).map((group) => {
                              const isExpanded = expandedCategories.has(group.categoryId);

                              return (
                                <div
                                  key={group.categoryId}
                                  style={{
                                    border: `1px solid ${ui.border}`,
                                    borderRadius: 14,
                                    padding: '0.7rem 0.8rem',
                                    background: '#faf9f7'
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleCategory(group.categoryId)}
                                    style={{
                                      width: '100%',
                                      border: 'none',
                                      background: 'transparent',
                                      padding: 0,
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      color: ui.text
                                    }}
                                  >
                                    <div className="d-flex align-items-center gap-2">
                                      {/* {group.icon} */}
                                      <span style={{ fontWeight: 700 }}>{group.categoryName}</span>
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                      <span style={chip(ui.purpleSoft, ui.purple)}>
                                        {group.productCount}
                                      </span>
                                      <ChevronRight
                                        size={14}
                                        style={{
                                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                          transition: '0.2s ease',
                                          color: ui.muted
                                        }}
                                      />
                                    </div>
                                  </button>

                                  {isExpanded && (
                                    <div className="mt-2 d-flex flex-column gap-2">
                                      {group.products.map((product) => (
                                        <div
                                          key={`${group.categoryId}-${product.id}-${product.name}`}
                                          style={{
                                            borderRadius: 12,
                                            background: '#fff',
                                            border: `1px solid ${ui.border}`,
                                            padding: '0.55rem 0.7rem'
                                          }}
                                        >
                                          <div style={{ color: ui.text, fontWeight: 600 }}>
                                            {product.name}
                                          </div>
                                          <div className="small" style={{ color: ui.muted }}>
                                            {product.objectName}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <Alert
                            style={{
                              background: ui.blueGraySoft,
                              color: ui.blueGray,
                              border: `1px solid ${ui.border}`
                            }}
                          >
                            На участке пока нет категорий товаров
                          </Alert>
                        )}

                        <div className="d-flex gap-2 flex-wrap">
                          {onOpenMyPlaces ? (
                            <Button style={btnSoft()} size="sm" onClick={onOpenMyPlaces}>
                              <PencilSquare className="me-1" />
                              Управлять
                            </Button>
                          ) : null}

                          {onOpenAddPlace ? (
                            <Button style={btnSoft()} size="sm" onClick={onOpenAddPlace}>
                              <PlusLg className="me-1" />
                              Добавить участок
                            </Button>
                          ) : null}

                          <Button
                            style={btnDangerSoft()}
                            size="sm"
                            onClick={() => handleDeleteClick(selectedPlace)}
                          >
                            <Trash className="me-1" />
                            Удалить
                          </Button>
                        </div>
                      </div>
                    </Popup>
                  )}
                </Map>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Удалить участок</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {placeToDelete && (
            <Alert
              style={{
                background: ui.redSoft,
                color: ui.red,
                border: `1px solid ${ui.border}`
              }}
            >
              Участок <strong>{placeToDelete.address}</strong> будет удалён из профиля поставщика.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowDeleteModal(false)}>
            Отмена
          </Button>
          <Button style={btnDangerSoft()} onClick={handleDeletePlace} disabled={deleting}>
            {deleting ? 'Удаление...' : 'Удалить'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default MapWithCategoriesTab;