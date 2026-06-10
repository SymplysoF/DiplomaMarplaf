import React, { useMemo, useState } from 'react';
import { Card, Button, Row, Col, Form, Alert } from 'react-bootstrap';
import { Cart, Trash2, CreditCard } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getCart, updateCartQuantity, removeFromCart, clearCart } from '../../api/buyerCartStorage';
import { createMarketPurchase } from '../../api/buyerMarketApi';
import { buyerTheme as theme } from './buyerTheme';

const BuyerCartPage: React.FC = () => {
  const [items, setItems] = useState(getCart());
  const [loading, setLoading] = useState(false);
  const { t, i18n } = useTranslation();

  const formatPrice = (whole: number, copecks = 0) =>
    new Intl.NumberFormat(i18n.language || 'ru-RU', { style: 'currency', currency: 'RUB' }).format(whole + copecks / 100);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.wholepart + item.copecks / 100) * item.quantity, 0);
  }, [items]);

  const handleCheckout = async () => {
    if (items.length === 0) return;

    try {
      setLoading(true);

      for (const item of items) {
        const data = await createMarketPurchase({
          productId: item.id,
          quantity: item.quantity
        });

        if (!data.success) {
          throw new Error(data.message || `${t('buyer.cart.purchaseItemError')}: ${item.productName}`);
        }
      }

      clearCart();
      setItems([]);
      toast.success(t('buyer.cart.checkoutSuccess'));
    } catch (error: any) {
      toast.error(error.message || t('buyer.cart.checkoutError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: theme.bg, borderRadius: 24, padding: 4 }}>
      <Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}>
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 style={{ color: theme.text }}>
              <Cart className="me-2" />
              {t('buyer.cart.title')}
            </h4>

            {items.length > 0 && (
              <Button variant="outline-danger" onClick={() => { clearCart(); setItems([]); }}>
                {t('buyer.cart.clear')}
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <Alert variant="light" className="text-center py-5">
              {t('buyer.cart.empty')}
            </Alert>
          ) : (
            <>
              <div className="d-flex flex-column gap-3">
                {items.map((item) => (
                  <Card key={item.id} className="border-0" style={{ background: '#faf8f4' }}>
                    <Card.Body>
                      <Row className="align-items-center">
                        <Col md={5}>
                          <strong>{item.productName}</strong>
                          <div className="text-muted small">{item.supplierName}</div>
                          <div className="text-muted small">{item.placeAddress}</div>
                        </Col>

                        <Col md={2}>
                          {formatPrice(item.wholepart, item.copecks)}
                        </Col>

                        <Col md={2}>
                          <Form.Control
                            type="number"
                            min={1}
                            max={item.quantityAvailable}
                            value={item.quantity}
                            onChange={(e) => {
                              const next = updateCartQuantity(item.id, Number(e.target.value));
                              setItems([...next]);
                            }}
                          />
                        </Col>

                        <Col md={2}>
                          <strong>
                            {formatPrice(item.wholepart * item.quantity, item.copecks * item.quantity)}
                          </strong>
                        </Col>

                        <Col md={1} className="text-end">
                          <Button
                            variant="light"
                            onClick={() => {
                              const next = removeFromCart(item.id);
                              setItems([...next]);
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))}
              </div>

              <Card className="mt-4 border-0" style={{ background: '#fff' }}>
                <Card.Body className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="text-muted">{t('buyer.cart.total')}</div>
                    <h4 style={{ color: theme.text }}>{total.toLocaleString(i18n.language || 'ru-RU', { style: 'currency', currency: 'RUB' })}</h4>
                  </div>

                  <Button
                    onClick={handleCheckout}
                    disabled={loading}
                    style={{ background: theme.green, borderColor: theme.green, borderRadius: 12 }}
                  >
                    <CreditCard className="me-2" />
                    {loading ? t('buyer.cart.processing') : t('buyer.cart.checkout')}
                  </Button>
                </Card.Body>
              </Card>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default BuyerCartPage;