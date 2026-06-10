import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Badge, Alert } from 'react-bootstrap';
import { ArrowRepeat, Basket, GeoAlt, GraphUp, Leaf } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import ProductClusterChart from './ProductClusterChart';
import RankedProductsList from './RankedProductsList';

interface ProductPageProps {
    userLocation: { lat: number; lng: number; address: string } | null;
    filters: {
        minRating: number;
        maxDistance: number;
        calculateDistance: boolean;
        ecoOnly: boolean;
    };
    onFarmerSelect?: (farmer: any) => void;
    onFilterChange?: (filters: any) => void;
    testMode?: boolean;
}

const theme = {
    card: '#ffffff',
    border: '#ebe4d8',
    text: '#223127',
    muted: '#6f7a71',
    green: '#2f6b3a',
    greenDark: '#244f2b',
    greenSoft: '#dfeadf',
    greenPale: '#eef5ec',
    goldSoft: '#f8edd6',
    shadow: '0 14px 35px rgba(34, 49, 39, 0.08)',
    shadowSoft: '0 8px 22px rgba(34, 49, 39, 0.06)'
};

const ProductPage: React.FC<ProductPageProps> = ({
    userLocation,
    filters,
    onFarmerSelect,
    testMode = true
}) => {
    const [loading, setLoading] = useState(false);
    const [clusters, setClusters] = useState<any>({ clusters: [] });
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);

    const flattenProductsFromClusters = useCallback((clustersData: any): any[] => {
        if (!clustersData?.clusters || !Array.isArray(clustersData.clusters)) return [];

        return clustersData.clusters.flatMap((cluster: any) => {
            const products = Array.isArray(cluster.products) ? cluster.products : [];
            return products.map((product: any) => ({
                ...product,
                clusterId: product.clusterId ?? cluster.id,
                clusterRank: product.clusterRank ?? cluster.rank,
                clusterRankColor: product.clusterRankColor ?? cluster.rankColor,
                clusterRankScore: product.clusterRankScore ?? cluster.rankScore
            }));
        });
    }, []);

    const fetchProductClusters = useCallback(async () => {
        if (!userLocation) return;

        try {
            setLoading(true);
            const token = localStorage.getItem('userToken');

            const response = await fetch('http://localhost:5000/api/buyer/clustered-products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    filters: {
                        objectIds: [],
                        testMode,
                        maxDistance: filters?.maxDistance ?? 10000,
                        calculateDistance: filters?.calculateDistance !== false,
                        minRating: filters?.minRating ?? 0,
                        saleType: 'all',
                        locationType: 'all',
                        minQuantity: 0,
                        ripenessCategories: [3],
                        ecoOnly: filters?.ecoOnly ?? false
                    }
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Ошибка загрузки ранжированных продуктов');
            }

            const clustersData = data.clusters || { clusters: [] };
            const products = Array.isArray(data.allProducts) && data.allProducts.length > 0
                ? data.allProducts
                : flattenProductsFromClusters(clustersData);

            setClusters(clustersData);
            setAllProducts(products);
            setStats(data.stats || null);
            setSelectedProduct(null);

            if (data.noProducts) {
                toast.info(data.message || 'Продукты по заданным параметрам не найдены');
            }
        } catch (error: any) {
            console.error('[ProductPage] fetchProductClusters error:', error);
            toast.error(error.message || 'Ошибка загрузки продуктов');
            setClusters({ clusters: [] });
            setAllProducts([]);
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, [userLocation, filters, testMode, flattenProductsFromClusters]);

    useEffect(() => {
        if (userLocation) {
            fetchProductClusters();
        }
    }, [userLocation, fetchProductClusters]);

    const productsForList = useMemo(() => {
        const source = allProducts.length > 0 ? allProducts : flattenProductsFromClusters(clusters);

        return [...source].sort((a, b) => {
            const aCluster = Number(a.clusterRank ?? 999);
            const bCluster = Number(b.clusterRank ?? 999);
            if (aCluster !== bCluster) return aCluster - bCluster;

            const aScore = Number(a.individualScore ?? a.computedRating ?? a.scoreFinal ?? a.finalScore ?? 0);
            const bScore = Number(b.individualScore ?? b.computedRating ?? b.scoreFinal ?? b.finalScore ?? 0);
            return bScore - aScore;
        });
    }, [allProducts, clusters, flattenProductsFromClusters]);

    const handleProductSelect = (product: any) => {
        setSelectedProduct(product);

        if (onFarmerSelect && product?.farmerId) {
            onFarmerSelect({
                id: product.farmerId,
                name: product.farmerName
            });
        }
    };

    if (!userLocation) {
        return (
            <Card className="border-0 text-center p-5" style={{ borderRadius: 26, boxShadow: theme.shadow }}>
                <Card.Body>
                    <GeoAlt size={40} color={theme.green} className="mb-3" />
                    <h5 style={{ color: theme.text, fontWeight: 900 }}>Укажите адрес доставки</h5>
                    <p className="mb-0" style={{ color: theme.muted }}>
                        Адрес используется для расчёта расстояния и ранжирования фермерской продукции.
                    </p>
                </Card.Body>
            </Card>
        );
    }

    return (
        <Container fluid className="px-0">
            <Card className="border-0 mb-4" style={{ borderRadius: 26, boxShadow: theme.shadowSoft }}>
                <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-3" style={{ padding: '1rem 1.15rem' }}>
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <Basket color={theme.green} />
                            <h5 className="mb-0" style={{ color: theme.text, fontWeight: 950 }}>
                                Ранжирование продукции
                            </h5>
                            <span style={{ background: theme.greenSoft, color: theme.greenDark, borderRadius: 999 }}>
                                {productsForList.length} товаров
                            </span>
                        </div>
                        <div style={{ color: theme.muted, fontSize: '0.92rem' }}>
                            Продукция сгруппирована по кластерам и отсортирована по итоговой оценке.
                        </div>
                    </div>

                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <Badge bg="light" text="dark" className="border" style={{ borderRadius: 999 }}>
                            <GeoAlt className="me-1" /> до {filters?.maxDistance ?? 10000} км
                        </Badge>
                        {filters?.ecoOnly && (
                            <Badge style={{ background: theme.greenSoft, color: theme.greenDark, borderRadius: 999 }}>
                                <Leaf className="me-1" /> только Эко
                            </Badge>
                        )}
                        {stats?.totalProducts > 0 && (
                            <Badge bg="light" text="dark" className="border" style={{ borderRadius: 999 }}>
                                найдено: {stats.totalProducts}
                            </Badge>
                        )}
                        <Button
                            variant="outline-primary"
                            onClick={fetchProductClusters}
                            disabled={loading}
                            style={{ borderRadius: 12 }}
                        >
                            {loading ? <Spinner size="sm" /> : <ArrowRepeat />}
                        </Button>
                    </div>
                </Card.Body>
            </Card>

            {loading ? (
                <Card className="border-0 p-5 text-center" style={{ borderRadius: 26, boxShadow: theme.shadow }}>
                    <Card.Body>
                        <Spinner animation="border" variant="success" />
                        <div className="mt-3" style={{ color: theme.muted }}>Загрузка ранжированных продуктов...</div>
                    </Card.Body>
                </Card>
            ) : productsForList.length === 0 ? (
                <Alert variant="info" className="border-0" style={{ borderRadius: 18 }}>
                    Продукты по заданным параметрам не найдены. Измените расстояние, рейтинг или фильтр Эко в общих настройках поиска.
                </Alert>
            ) : (
                <Row className="g-4">
                    <Col xl={7} lg={7}>
                        <ProductClusterChart
                            clusters={clusters}
                            onProductSelect={handleProductSelect}
                        />
                    </Col>
                    <Col xl={5} lg={5}>
                        <RankedProductsList
                            products={productsForList}
                            onProductSelect={handleProductSelect}
                            selectedProduct={selectedProduct}
                        />
                    </Col>
                </Row>
            )}

            <style>{`
                .btn-outline-primary {
                    border-color: ${theme.green};
                    color: ${theme.green};
                }
                .btn-outline-primary:hover {
                    background-color: ${theme.green};
                    border-color: ${theme.green};
                }
            `}</style>
        </Container>
    );
};

export default ProductPage;


// import React, { useState, useEffect } from 'react';
// import {
//     Container,
//     Row,
//     Col,
//     Card,
//     Button,
//     Spinner,
//     Badge,
//     Form,
//     InputGroup,
//     Alert
// } from 'react-bootstrap';
// import { GeoAlt, Star, ArrowRepeat, InfoCircle, Leaf } from 'react-bootstrap-icons';
// import GroupedProductsList from './GroupedProductsList';
// import { toast } from 'react-toastify';

// // Типы
// interface DietTable {
//     id: number;
//     name: string;
//     description: string;
// }

// interface TableObject {
//     objectId: number;
//     objectName: string;
//     varietyId?: number;
//     varietyName?: string;
//     fullName: string;
// }

// interface ProductFilters {
//     categoryId: number | null;
//     productIds: number[];
//     tableId: number | null;
//     minRating: number;
//     maxDistance: number;
//     calculateDistance: boolean;
//     saleType: 'all' | 'retail' | 'wholesale';
//     locationType: 'all' | 'market' | 'auction' | 'warehouse';
//     minQuantity: number;
//     selectedUnit: 'kg' | 'pcs';
//     ripenessCategories: number[];
//     ecoOnly: boolean;
// }

// interface ProductPageProps {
//     userLocation: { lat: number; lng: number; address: string } | null;
//     filters: {
//         minRating: number;
//         maxDistance: number;
//         calculateDistance: boolean;
//         ecoOnly: boolean;
//     };
//     onFarmerSelect?: (farmer: any) => void;
//     onFilterChange?: (filters: any) => void;
//     testMode?: boolean;
// }

// const ProductPage: React.FC<ProductPageProps> = ({
//     userLocation,
//     filters: parentFilters,
//     onFarmerSelect,
//     onFilterChange,
//     testMode = true
// }) => {
//     const [loading, setLoading] = useState(false);
//     const [clusters, setClusters] = useState<any>(null);
//     const [allProducts, setAllProducts] = useState<any[]>([]);
//     const [stats, setStats] = useState<any>(null);
//     const [categories, setCategories] = useState<any[]>([]);

//     const [dietTables, setDietTables] = useState<DietTable[]>([]);
//     const [tableObjects, setTableObjects] = useState<TableObject[]>([]);
//     const [loadingTables, setLoadingTables] = useState(false);

//     const [selectedGroup, setSelectedGroup] = useState<any>(null);
//     const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

//     const [productFilters, setProductFilters] = useState<ProductFilters>({
//         categoryId: null,
//         productIds: [],
//         tableId: null,
//         minRating: parentFilters?.minRating || 0,
//         maxDistance: parentFilters?.maxDistance || 10000,
//         calculateDistance: parentFilters?.calculateDistance !== false,
//         saleType: 'all',
//         locationType: 'all',
//         minQuantity: 0,
//         selectedUnit: 'kg',
//         ripenessCategories: [3],
//         ecoOnly: parentFilters?.ecoOnly || false
//     });

//     // Следим за изменением фильтров из родителя
//     useEffect(() => {
//         setProductFilters(prev => ({
//             ...prev,
//             ecoOnly: parentFilters?.ecoOnly || false,
//             minRating: parentFilters?.minRating || 0,
//             maxDistance: parentFilters?.maxDistance || 10000,
//             calculateDistance: parentFilters?.calculateDistance !== false
//         }));
//     }, [parentFilters?.ecoOnly, parentFilters?.minRating, parentFilters?.maxDistance, parentFilters?.calculateDistance]);

//     // Автоматическая загрузка в тестовом режиме
//     useEffect(() => {
//         if (testMode && userLocation) {
//             handleSearch();
//         }
//     }, [testMode, userLocation, productFilters.ecoOnly]);

//     // Загрузка категорий
//     useEffect(() => {
//         const fetchCategories = async () => {
//             try {
//                 const token = localStorage.getItem('userToken');
//                 const response = await fetch('http://localhost:5000/api/categories', {
//                     headers: { 'Authorization': `Bearer ${token}` }
//                 });
//                 const data = await response.json();
//                 if (data.success) {
//                     setCategories(data.categories);
//                 }
//             } catch (error) {
//                 console.error('Error fetching categories:', error);
//             }
//         };
//         fetchCategories();
//     }, []);

//     // Загрузка диетических столов
//     useEffect(() => {
//         const fetchDietTables = async () => {
//             try {
//                 setLoadingTables(true);
//                 const token = localStorage.getItem('userToken');
//                 const response = await fetch('http://localhost:5000/api/diet-tables', {
//                     headers: { 'Authorization': `Bearer ${token}` }
//                 });
//                 const data = await response.json();
//                 if (data.success) {
//                     setDietTables(data.tables);
//                 }
//             } catch (error) {
//                 console.error('Error fetching diet tables:', error);
//                 toast.error('Ошибка загрузки столов питания');
//             } finally {
//                 setLoadingTables(false);
//             }
//         };
//         fetchDietTables();
//     }, []);

//     // Загрузка продуктов для выбранного стола
//     const fetchTableProducts = async (tableId: number) => {
//         try {
//             setLoadingTables(true);
//             const token = localStorage.getItem('userToken');
//             const response = await fetch(`http://localhost:5000/api/diet-tables/${tableId}/objects`, {
//                 headers: { 'Authorization': `Bearer ${token}` }
//             });
//             const data = await response.json();
//             if (data.success) {
//                 setTableObjects(data.objects);
//             }
//         } catch (error) {
//             console.error('Error fetching table products:', error);
//             toast.error('Ошибка загрузки продуктов стола');
//         } finally {
//             setLoadingTables(false);
//         }
//     };

//     const areFiltersValid = (): boolean => {
//         if (testMode) return true;
//         return (
//             productFilters.productIds.length > 0 &&
//             productFilters.ripenessCategories.length > 0
//         );
//     };

//     const handleSearch = async () => {
//         if (!userLocation) {
//             toast.warning('Укажите адрес доставки');
//             return;
//         }

//         try {
//             setLoading(true);
//             const token = localStorage.getItem('userToken');

//             const requestBody = {
//                 lat: userLocation.lat,
//                 lng: userLocation.lng,
//                 filters: {
//                     objectIds: productFilters.productIds,
//                     testMode: testMode,
//                     maxDistance: productFilters.maxDistance,
//                     calculateDistance: productFilters.calculateDistance,
//                     minRating: productFilters.minRating,
//                     saleType: productFilters.saleType,
//                     locationType: productFilters.locationType,
//                     minQuantity: productFilters.minQuantity,
//                     ripenessCategories: productFilters.ripenessCategories,
//                     ecoOnly: productFilters.ecoOnly
//                 }
//             };

//             console.log('Sending request with ecoOnly:', productFilters.ecoOnly);

//             const response = await fetch('http://localhost:5000/api/buyer/clustered-products', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'Authorization': `Bearer ${token}`
//                 },
//                 body: JSON.stringify(requestBody)
//             });

//             const data = await response.json();
//             console.log('Received response:', data);

//             if (data.success) {
//                 if (data.needsFilters) {
//                     toast.info(data.message);
//                 } else {
//                     setClusters(data.clusters);
//                     setAllProducts(data.allProducts || []);
//                     setStats(data.stats);
//                     setSelectedGroup(null);
//                     setExpandedGroups(new Set());

//                     if (data.noProducts) {
//                         toast.info(data.message);
//                     }
//                 }
//             }
//         } catch (error) {
//             console.error('Error fetching product clusters:', error);
//             toast.error('Ошибка загрузки продуктов');
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleGroupSelect = (group: any) => {
//         setSelectedGroup(group);
//         if (onFarmerSelect) {
//             onFarmerSelect({ id: group.farmerId, name: group.farmerName });
//         }
//     };

//     const handleProductSelect = (product: any) => {
//         console.log('Selected product:', product);
//     };

//     const toggleGroupExpand = (groupId: string) => {
//         const newExpanded = new Set(expandedGroups);
//         if (newExpanded.has(groupId)) {
//             newExpanded.delete(groupId);
//         } else {
//             newExpanded.add(groupId);
//         }
//         setExpandedGroups(newExpanded);
//     };

//     const handleEcoFilterChange = (value: boolean) => {
//         if (onFilterChange) {
//             onFilterChange({ ...parentFilters, ecoOnly: value });
//         }
//         setProductFilters(prev => ({ ...prev, ecoOnly: value }));
//         // Не вызываем handleSearch здесь, так как useEffect сработает
//     };

//     if (!userLocation) {
//         return (
//             <Card className="text-center p-5">
//                 <h5>Укажите адрес доставки для просмотра продуктов</h5>
//                 <p className="text-muted">Адрес нужен для расчета расстояния до фермерских хозяйств</p>
//             </Card>
//         );
//     }

//     return (
//         <Container fluid className="px-0">
//             {/* Фильтры для продуктов */}
//             <Row className="mb-3">
//                 <Col md={12}>
//                     <Card className="shadow-sm">
//                         <Card.Body className="py-3">
//                             <Row className="align-items-center g-2">
//                                 {/* Выбор стола */}
//                                 <Col md={2}>
//                                     <Form.Select
//                                         size="sm"
//                                         value={productFilters.tableId || ''}
//                                         onChange={(e) => {
//                                             const tableId = e.target.value ? Number(e.target.value) : null;
//                                             setProductFilters({
//                                                 ...productFilters,
//                                                 tableId,
//                                                 productIds: []
//                                             });
//                                             if (tableId) {
//                                                 fetchTableProducts(tableId);
//                                             } else {
//                                                 setTableObjects([]);
//                                             }
//                                         }}
//                                         disabled={loadingTables || testMode}
//                                     >
//                                         <option value="">Выберите стол</option>
//                                         {dietTables.map((table: DietTable) => (
//                                             <option key={table.id} value={table.id}>{table.name}</option>
//                                         ))}
//                                     </Form.Select>
//                                 </Col>

//                                 {/* Выбор продуктов из стола */}
//                                 <Col md={3}>
//                                     <Form.Select
//                                         size="sm"
//                                         multiple
//                                         value={productFilters.productIds.map(String)}
//                                         onChange={(e) => {
//                                             const selectedOptions = Array.from(e.target.selectedOptions, option => Number(option.value));
//                                             setProductFilters({
//                                                 ...productFilters,
//                                                 productIds: selectedOptions
//                                             });
//                                         }}
//                                         disabled={!productFilters.tableId || tableObjects.length === 0 || loadingTables || testMode}
//                                         style={{ height: '100px' }}
//                                     >
//                                         {tableObjects.map((obj: TableObject) => (
//                                             <option key={`${obj.objectId}_${obj.varietyId || ''}`} value={obj.objectId}>
//                                                 {obj.fullName}
//                                             </option>
//                                         ))}
//                                     </Form.Select>
//                                 </Col>

//                                 {/* Категория спелости */}
//                                 <Col md={2}>
//                                     <Form.Select
//                                         size="sm"
//                                         multiple
//                                         value={productFilters.ripenessCategories.map(String)}
//                                         onChange={(e) => {
//                                             const selected = Array.from(e.target.selectedOptions, option => Number(option.value));
//                                             setProductFilters({
//                                                 ...productFilters,
//                                                 ripenessCategories: selected
//                                             });
//                                         }}
//                                         style={{ height: '100px' }}
//                                         disabled={testMode}
//                                     >
//                                         <option value="3">Спелые</option>
//                                         <option value="2">Средней спелости</option>
//                                         <option value="1">Неспелые</option>
//                                         <option value="0">Испорченные (для компоста)</option>
//                                     </Form.Select>
//                                 </Col>

//                                 {/* Тип продажи */}
//                                 <Col md={1}>
//                                     <Form.Select
//                                         size="sm"
//                                         value={productFilters.saleType}
//                                         onChange={(e) => setProductFilters({
//                                             ...productFilters,
//                                             saleType: e.target.value as 'all' | 'retail' | 'wholesale'
//                                         })}
//                                     >
//                                         <option value="all">Все типы</option>
//                                         <option value="retail">Розница</option>
//                                         <option value="wholesale">Опт</option>
//                                     </Form.Select>
//                                 </Col>

//                                 {/* Эко-фильтр */}
//                                 <Col md={1}>
//                                     <Form.Check
//                                         type="checkbox"
//                                         id="eco-certificate-filter-products"
//                                         label={
//                                             <span className="d-flex align-items-center gap-1">
//                                                 <Leaf className="text-success" size={14} />
//                                                 Эко
//                                             </span>
//                                         }
//                                         checked={productFilters.ecoOnly}
//                                         onChange={(e) => handleEcoFilterChange(e.target.checked)}
//                                     />
//                                 </Col>

//                                 {/* Единицы измерения и количество */}
//                                 <Col md={2}>
//                                     <InputGroup size="sm">
//                                         <Form.Control
//                                             type="number"
//                                             placeholder="Кол-во"
//                                             value={productFilters.minQuantity || ''}
//                                             onChange={(e) => setProductFilters({
//                                                 ...productFilters,
//                                                 minQuantity: e.target.value ? Number(e.target.value) : 0
//                                             })}
//                                             min="0"
//                                             step="0.1"
//                                         />
//                                         <InputGroup.Text>
//                                             <div style={{ display: 'flex', gap: '8px' }}>
//                                                 <Form.Check
//                                                     type="radio"
//                                                     name="unit"
//                                                     id="unit-kg"
//                                                     checked={productFilters.selectedUnit === 'kg'}
//                                                     onChange={() => setProductFilters({
//                                                         ...productFilters,
//                                                         selectedUnit: 'kg'
//                                                     })}
//                                                     label="кг"
//                                                     inline
//                                                     style={{ fontSize: '0.875rem' }}
//                                                 />
//                                                 <Form.Check
//                                                     type="radio"
//                                                     name="unit"
//                                                     id="unit-pcs"
//                                                     checked={productFilters.selectedUnit === 'pcs'}
//                                                     onChange={() => setProductFilters({
//                                                         ...productFilters,
//                                                         selectedUnit: 'pcs'
//                                                     })}
//                                                     label="шт"
//                                                     inline
//                                                     style={{ fontSize: '0.875rem' }}
//                                                 />
//                                             </div>
//                                         </InputGroup.Text>
//                                     </InputGroup>
//                                 </Col>

//                                 {/* Расстояние */}
//                                 <Col md={1}>
//                                     <Form.Select
//                                         size="sm"
//                                         value={productFilters.maxDistance}
//                                         onChange={(e) => {
//                                             setProductFilters({
//                                                 ...productFilters,
//                                                 maxDistance: Number(e.target.value)
//                                             });
//                                         }}
//                                     >
//                                         <option value="25">25 км</option>
//                                         <option value="50">50 км</option>
//                                         <option value="100">100 км</option>
//                                         <option value="200">200 км</option>
//                                         <option value="500">500 км</option>
//                                         <option value="10000">Без ограничений</option>
//                                     </Form.Select>
//                                 </Col>

//                                 {/* Кнопка поиска */}
//                                 <Col md={1}>
//                                     <Button
//                                         variant="primary"
//                                         size="sm"
//                                         onClick={() => handleSearch()}
//                                         disabled={loading || (!testMode && !areFiltersValid())}
//                                         className="w-100"
//                                     >
//                                         {loading ? <Spinner size="sm" /> : 'Найти'}
//                                     </Button>
//                                 </Col>
//                             </Row>

//                             {/* Индикатор активного Эко-фильтра */}
//                             {productFilters.ecoOnly && (
//                                 <Row className="mt-2">
//                                     <Col md={12}>
//                                         <Alert variant="success" className="py-1 px-2 small mb-0">
//                                             <Leaf size={14} className="me-1" />
//                                             Фильтр Эко-сертификатов активен - показываются только продукты от фермеров с Эко-сертификатом
//                                         </Alert>
//                                     </Col>
//                                 </Row>
//                             )}

//                             {testMode && (
//                                 <Row className="mt-2">
//                                     <Col md={12}>
//                                         <Alert variant="info" className="py-1 px-2 small mb-0">
//                                             <InfoCircle size={14} className="me-1" />
//                                             Тестовый режим: показаны все спелые продукты
//                                         </Alert>
//                                     </Col>
//                                 </Row>
//                             )}

//                             {(!testMode && !areFiltersValid()) && (
//                                 <Row className="mt-2">
//                                     <Col md={12}>
//                                         <Alert variant="info" className="py-1 px-2 small mb-0">
//                                             <InfoCircle size={14} className="me-1" />
//                                             Для поиска необходимо выбрать продукты и категорию спелости
//                                         </Alert>
//                                     </Col>
//                                 </Row>
//                             )}

//                             {stats && stats.totalProducts > 0 && (
//                                 <Row className="mt-2">
//                                     <Col md={12}>
//                                         <div className="d-flex justify-content-between small text-muted">
//                                             <span>Найдено: {stats.totalGroups} групп товаров</span>
//                                             <span>Всего товаров: {stats.totalProducts}</span>
//                                             <span>Цены: от {stats.minPrice?.toFixed(0)} до {stats.maxPrice?.toFixed(0)} руб</span>
//                                             <span>Средняя цена: {stats.avgPrice?.toFixed(0)} руб</span>
//                                         </div>
//                                     </Col>
//                                 </Row>
//                             )}
//                         </Card.Body>
//                     </Card>
//                 </Col>
//             </Row>

//             {!loading && allProducts.length === 0 && areFiltersValid() && (
//                 <Row>
//                     <Col md={12}>
//                         <Card className="text-center p-5">
//                             <h5>Продукты не найдены</h5>
//                             <p className="text-muted">
//                                 {productFilters.ecoOnly 
//                                     ? "Нет продуктов от фермеров с Эко-сертификатом, соответствующих вашему запросу."
//                                     : "Нет продуктов, соответствующих вашему запросу."
//                                 }
//                                 <br />
//                                 Вы можете создать заявку на продукт в соответствующем разделе.
//                             </p>
//                             <Button variant="outline-primary" size="sm">
//                                 Создать заявку
//                             </Button>
//                         </Card>
//                     </Col>
//                 </Row>
//             )}

//             {allProducts.length > 0 && (
//                 <Row>
//                     <Col md={12}>
//                         <GroupedProductsList
//                             products={allProducts}
//                             onGroupSelect={handleGroupSelect}
//                             onProductSelect={handleProductSelect}
//                             selectedGroup={selectedGroup}
//                             expandedGroups={expandedGroups}
//                             onToggleExpand={toggleGroupExpand}
//                         />
//                     </Col>
//                 </Row>
//             )}
//         </Container>
//     );
// };

// export default ProductPage;