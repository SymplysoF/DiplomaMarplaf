import React, { useEffect, useMemo, useState } from 'react';
import {
  Container, Row, Col, Card, Button, Badge, Spinner, Modal, Form, InputGroup, Alert
} from 'react-bootstrap';
import { Shop, Search, Filter, GeoAlt, Cart, BoxSeam, Flower1, Tree, Droplet } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getMarketProducts } from '../../api/buyerMarketApi';
import { addToCart } from '../../api/buyerCartStorage';
import { buyerTheme as theme } from './buyerTheme';

interface MarketProduct {
  id: number;
  productName: string;
  objectName: string;
  varietyName: string;
  categoryName: string;
  wholepart: number;
  copecks: number;
  weight: number;
  quantity: number;
  unit: string;
  placeAddress: string;
  supplierName: string;
  supplierId: number;
}

const BuyerMarketPage: React.FC = () => {
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<MarketProduct | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const { t, i18n } = useTranslation();

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getMarketProducts();
      if (data.success) setProducts(data.products || []);
      else toast.error(data.message || t('buyer.market.errorLoading'));
    } catch {
      toast.error(t('common.serverError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const formatPrice = (whole: number, copecks = 0) =>
    new Intl.NumberFormat(i18n.language || 'ru-RU', { style: 'currency', currency: 'RUB' }).format(whole + copecks / 100);

  const getCategoryIcon = (cat: string) => {
    const name = cat.toLowerCase();
    if (name.includes('овощ')) return <Flower1 className="text-success" />;
    if (name.includes('фрукт')) return <Tree className="text-danger" />;
    if (name.includes('молоко')) return <Droplet className="text-primary" />;
    return <BoxSeam className="text-secondary" />;
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.categoryName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat = selectedCategory === 'all' || p.categoryName === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, searchTerm, selectedCategory]);

  const categories = Array.from(new Set(products.map((p) => p.categoryName)));

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    addToCart({
      id: selectedProduct.id,
      productName: selectedProduct.productName,
      objectName: selectedProduct.objectName,
      varietyName: selectedProduct.varietyName,
      categoryName: selectedProduct.categoryName,
      wholepart: selectedProduct.wholepart,
      copecks: selectedProduct.copecks,
      quantityAvailable: selectedProduct.quantity,
      quantity,
      unit: selectedProduct.unit,
      placeAddress: selectedProduct.placeAddress,
      supplierName: selectedProduct.supplierName,
      supplierId: selectedProduct.supplierId
    });

    toast.success(t('buyer.market.addedToCart'));
    setShowCartModal(false);
  };

  if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;

  return (
    <div style={{ background: theme.bg, borderRadius: 24, padding: 4 }}>
      <Container fluid className="px-0">
        <Row className="mb-4">
          <Col><h4><Shop className="me-2 text-success" />{t('buyer.market.title')}</h4></Col>
        </Row>

        <Card className="mb-4 border-0" style={{ boxShadow: theme.shadow, borderRadius: 20 }}>
          <Card.Body>
            <Row className="g-3">
              <Col md={6}>
                <InputGroup>
                  <InputGroup.Text><Search /></InputGroup.Text>
                  <Form.Control placeholder={t('buyer.market.searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </InputGroup>
              </Col>
              <Col md={4}>
                <InputGroup>
                  <InputGroup.Text><Filter /></InputGroup.Text>
                  <Form.Select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                    <option value="all">{t('buyer.market.allCategories')}</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </Form.Select>
                </InputGroup>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {filteredProducts.length === 0 ? (
          <Alert variant="info">{t('buyer.market.noProducts')}</Alert>
        ) : (
          <Row xs={1} md={2} xl={3} className="g-4">
            {filteredProducts.map((p) => (
              <Col key={p.id}>
                <Card className="h-100 border-0" style={{ boxShadow: theme.shadow, borderRadius: 20 }}>
                  <Card.Body>
                    <div className="d-flex justify-content-between">
                      <div>{getCategoryIcon(p.categoryName)} <Badge bg="light" text="dark">{p.categoryName}</Badge></div>
                      <Badge bg="success">{p.quantity} {p.unit}</Badge>
                    </div>

                    <h6 className="mt-3 mb-1">{p.productName}</h6>
                    <div className="text-muted small">{p.objectName} {p.varietyName}</div>
                    <div className="mt-2"><strong>{formatPrice(p.wholepart, p.copecks)}</strong> / {p.unit}</div>
                    <div className="text-muted small mt-2"><GeoAlt size={12} /> {p.placeAddress || t('common.noAddress')}</div>
                    <div className="text-muted small">{p.supplierName}</div>

                    <div className="mt-3">
                      <Button
                        variant="success"
                        onClick={() => {
                          setSelectedProduct(p);
                          setQuantity(1);
                          setShowCartModal(true);
                        }}
                      >
                        <Cart className="me-2" />
                        {t('buyer.market.addToCart')}
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        <Modal show={showCartModal} onHide={() => setShowCartModal(false)}>
          <Modal.Header closeButton><Modal.Title>{t('buyer.market.addToCartTitle')}</Modal.Title></Modal.Header>
          <Modal.Body>
            {selectedProduct && (
              <>
                <div><strong>{selectedProduct.productName}</strong></div>
                <div className="text-muted">{selectedProduct.supplierName}</div>
                <div className="mt-2">{t('buyer.market.price')}: {formatPrice(selectedProduct.wholepart, selectedProduct.copecks)}</div>

                <Form.Group className="mt-3">
                  <Form.Label>{t('buyer.market.quantity')}</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max={selectedProduct.quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </Form.Group>

                <div className="mt-3">
                  {t('buyer.market.total')}: {formatPrice(selectedProduct.wholepart * quantity, selectedProduct.copecks * quantity)}
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCartModal(false)}>{t('common.cancel')}</Button>
            <Button variant="success" onClick={handleAddToCart}>{t('common.add')}</Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </div>
  );
};

export default BuyerMarketPage;