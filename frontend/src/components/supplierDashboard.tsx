import React, { useState, useEffect } from 'react';
import {
  Card,
  Spinner,
  Button
} from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  PlusCircle,
  BarChart,
  GraphUp,
  BoxSeam,
  Grid,
  Shop,
  PersonBadge,
  GeoAlt,
  PinMap,
  Envelope,
  ClipboardData,
  QuestionCircle,
  InfoCircle,
  Gear,
  HouseDoor,
  Pin
} from 'react-bootstrap-icons';

import CertificatesTab from './CertificatesTab';
import SupplierProfile from '../pages/supplierPage';
import AddPlaceTab from './addPlaceTab';
import AuctionTab from './auctionTab';
import MarketTab from './marketTab';
import MyPlacesTab from './myPlaces';
import WarehouseTab from './warehouseTab';
import MapWithCategoriesTab from './FarmersMapTab';
import SupplierCustomerRequestsTab from './SupplierCustomerRequestsTab';

interface SupplierDashboardProps {
  user: {
    userId: number;
    name: string;
    login: string;
    role: string;
    roleId: number;
  };
}

type SupplierMainTab =
  | 'profile'
  | 'add-place'
  | 'my-places'
  | 'customer-requests'
  | 'map-categories'
  | 'warehouse'
  | 'market'
  | 'auctions'
  | 'certificates'
  | 'stats';

type SidebarInfoTab = 'support' | 'about' | 'settings' | null;

const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ user }) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<SupplierMainTab>('profile');
  const [activeInfoPanel, setActiveInfoPanel] = useState<SidebarInfoTab>(null);
  const [supplierData, setSupplierData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [placesCount, setPlacesCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const ui = {
    navbarBg: 'rgba(255,255,255,0.88)',
    border: '#e7e2d8',
    text: '#243126',
    muted: '#6d786f',
    green: '#2f6b3a',
    greenDark: '#234f2b',
    greenSoft: '#dceadf',
    purple: '#6c56d9',
    purpleSoft: '#f1ecff',
    gold: '#9a6b00',
    goldSoft: '#fbf1d9',
    blueGray: '#44546a',
    blueGraySoft: '#eef2f7',
    red: '#c2410c',
    redSoft: '#fde7df',
    shadow: '0 10px 28px rgba(34,49,39,0.08)',
    shadowSoft: '0 8px 22px rgba(34,49,39,0.06)'
  };

  useEffect(() => {
    const fetchSupplierData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('userToken');

        const profileResponse = await fetch('http://localhost:5000/api/supplier/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const profileData = await profileResponse.json();
        if (profileData.success) {
          setSupplierData(profileData.supplier);
        }

        const placesResponse = await fetch('http://localhost:5000/api/supplier/places', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const placesData = await placesResponse.json();
        if (placesData.success) {
          setPlacesCount(placesData.places.length);
        }
      } catch (error) {
        console.error('Error fetching supplier data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSupplierData();
  }, []);

  const handlePlaceAdded = () => {
    setPlacesCount((prev) => prev + 1);
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab('my-places');
    setActiveInfoPanel(null);
  };

  const handleProductCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab('warehouse');
    setActiveInfoPanel(null);
  };
  
  const chip = (bg: string, color: string): React.CSSProperties => ({
    background: bg,
    color,
    borderRadius: 999,
    padding: '0.56rem 0.9rem',
    fontSize: '0.84rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${ui.border}`,
    lineHeight: 1
  });

  const sidebarItemStyle = (active: boolean): React.CSSProperties => ({
    width: '100%',
    borderRadius: 16,
    border: active ? `1px solid ${ui.green}` : `1px solid ${ui.border}`,
    background: active ? ui.greenSoft : 'rgba(255,255,255,0.72)',
    color: active ? ui.greenDark : ui.text,
    boxShadow: active ? '0 8px 18px rgba(47,107,58,0.10)' : 'none',
    fontWeight: 600,
    padding: '0.82rem 0.95rem',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left' as const,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)'
  });

  const renderContent = () => {
    if (activeInfoPanel === 'support') {
      return (
        <Card
          className="border-0"
          style={{ borderRadius: 24, boxShadow: ui.shadowSoft, overflow: 'hidden' }}
        >
          <Card.Body style={{ padding: '1.4rem' }}>
            <h4 style={{ color: ui.text }}>Support</h4>
            <p style={{ color: ui.muted }}>
              Здесь можно разместить поддержку: FAQ, контакты, email, Telegram, форму обращения.
            </p>

            <div className="d-flex flex-wrap gap-2 mt-3">
              <span style={chip(ui.greenSoft, ui.greenDark)}>support@marplatf.local</span>
              <span style={chip(ui.blueGraySoft, ui.blueGray)}>+7 (900) 000-00-00</span>
            </div>
          </Card.Body>
        </Card>
      );
    }

    if (activeInfoPanel === 'about') {
      return (
        <Card
          className="border-0"
          style={{ borderRadius: 24, boxShadow: ui.shadowSoft, overflow: 'hidden' }}
        >
          <Card.Body style={{ padding: '1.4rem' }}>
            <h4 style={{ color: ui.text }}>About us</h4>
            <p style={{ color: ui.muted }} className="mb-0">
              Здесь можно разместить описание платформы, правила работы поставщика,
              преимущества, документы и ссылки.
            </p>
          </Card.Body>
        </Card>
      );
    }

    if (activeInfoPanel === 'settings') {
      return (
        <Card
          className="border-0"
          style={{ borderRadius: 24, boxShadow: ui.shadowSoft, overflow: 'hidden' }}
        >
          <Card.Body style={{ padding: '1.4rem' }}>
            <h4 style={{ color: ui.text }}>Settings</h4>
            <p style={{ color: ui.muted }} className="mb-0">
              Здесь можно вывести настройки поставщика: уведомления, язык, приватность,
              отображение карточек и другие параметры.
            </p>
          </Card.Body>
        </Card>
      );
    }

    switch (activeTab) {
      case 'profile':
        return <SupplierProfile userId={user.userId} />;

      case 'add-place':
        return <AddPlaceTab onPlaceAdded={handlePlaceAdded} />;

      case 'my-places':
        return <MyPlacesTab refreshTrigger={refreshTrigger} />;

      case 'customer-requests':
        return <SupplierCustomerRequestsTab refreshTrigger={refreshTrigger} />;

      case 'map-categories':
        return <MapWithCategoriesTab refreshTrigger={refreshTrigger} />;

      case 'warehouse':
        return <WarehouseTab refreshTrigger={refreshTrigger} />;

      case 'market':
        return <MarketTab refreshTrigger={refreshTrigger} />;

      case 'auctions':
        return <AuctionTab refreshTrigger={refreshTrigger} />;

      case 'certificates':
        return <CertificatesTab refreshTrigger={refreshTrigger} />;

      case 'stats':
        return (
          <Card
            className="border-0"
            style={{ borderRadius: 24, boxShadow: ui.shadowSoft }}
          >
            <Card.Body
              className="text-center"
              style={{ padding: '2.5rem 1.5rem', borderRadius: 24 }}
            >
              <BarChart size={48} style={{ color: ui.green }} className="mb-3" />
              <h4 style={{ color: ui.text }}>{t('supplier.statisticsTitle')}</h4>
              <p style={{ color: ui.muted }} className="mb-0">
                {t('supplier.statisticsDescription')}
              </p>
            </Card.Body>
          </Card>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f7f5f0'
        }}
      >
        <div className="text-center">
          <Spinner animation="border" style={{ color: ui.green }} />
          <p className="mt-3 mb-0" style={{ color: ui.muted }}>
            {t('supplier.loadingData')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#f7f5f0',
        minHeight: '100vh',
        paddingBottom: 24
      }}
    >
      <div className="px-4 px-lg-5 pt-4">
        {/* <div
          style={{
            position: 'sticky',
            top: 18,
            zIndex: 20,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            background: ui.navbarBg,
            border: `1px solid ${ui.border}`,
            boxShadow: ui.shadow,
            borderRadius: 24,
            padding: '1rem 1.15rem',
            marginBottom: 20
          }}
        >
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: ui.greenSoft,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <HouseDoor size={20} style={{ color: ui.greenDark }} />
                </div>

                <div>
                  <h3 className="mb-0" style={{ color: ui.text }}>
                    Supplier dashboard
                  </h3>
                  <div style={{ color: ui.muted, fontSize: '0.94rem' }}>
                    {supplierData?.companyname || user.name}
                  </div>
                </div>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <span style={chip(ui.greenSoft, ui.greenDark)}>
                {t('roles.supplier')}
              </span>

              <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                {user.name}
              </span>

              <span style={chip(ui.purpleSoft, ui.purple)}>
                Участков: {placesCount}
              </span>
            </div>
          </div>
        </div> */}

        <div className="supplier-layout">
          <aside
            style={{
              position: 'sticky',
              top: 120,
              height: 'fit-content'
            }}
          >
            <Card
              className="border-0"
              style={{
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: ui.shadowSoft,
                background: 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid ${ui.border}`
              }}
            >
              <Card.Body style={{ padding: '1rem' }}>

                <div className="d-grid gap-2">
                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeTab === 'profile' && !activeInfoPanel)}
                    onClick={() => {
                      setActiveTab('profile');
                      setActiveInfoPanel(null);
                    }}
                  >
                    <PersonBadge size={18} style={{ color: ui.green }} />
                    {t('supplier.tabs.profile')}
                  </Button>


                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeTab === 'my-places' && !activeInfoPanel)}
                    onClick={() => {
                      setActiveTab('my-places');
                      setActiveInfoPanel(null);
                    }}
                  >
                    <PinMap size={18} style={{ color: ui.green }} />
                    <span className="flex-grow-1">{t('supplier.tabs.myPlaces')}</span>
                    <span style={chip(ui.greenSoft, ui.greenDark)}>{placesCount}</span>
                  </Button>
                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeTab === 'add-place' && !activeInfoPanel)}
                    onClick={() => {
                      setActiveTab('add-place');
                      setActiveInfoPanel(null);
                    }}
                  >
                    <PlusCircle size={18} style={{ color: ui.green }} />
                    {t('supplier.tabs.addPlace')}
                  </Button>

                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeTab === 'customer-requests' && !activeInfoPanel)}
                    onClick={() => {
                      setActiveTab('customer-requests');
                      setActiveInfoPanel(null);
                    }}
                  >
                    <Envelope size={18} style={{ color: ui.green }} />
                    {t('supplier.tabs.customerRequests')}
                  </Button>

                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeTab === 'map-categories' && !activeInfoPanel)}
                    onClick={() => {
                      setActiveTab('map-categories');
                      setActiveInfoPanel(null);
                    }}
                  >
                    <Grid size={18} style={{ color: ui.green }} />
                    {t('supplier.tabs.mapCategories')}
                  </Button>

                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeTab === 'warehouse' && !activeInfoPanel)}
                    onClick={() => {
                      setActiveTab('warehouse');
                      setActiveInfoPanel(null);
                    }}
                  >
                    <BoxSeam size={18} style={{ color: ui.green }} />
                    {t('supplier.tabs.warehouse')}
                  </Button>

                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeTab === 'market' && !activeInfoPanel)}
                    onClick={() => {
                      setActiveTab('market');
                      setActiveInfoPanel(null);
                    }}
                  >
                    <Shop size={18} style={{ color: ui.green }} />
                    {t('supplier.tabs.market')}
                  </Button>

                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeTab === 'auctions' && !activeInfoPanel)}
                    onClick={() => {
                      setActiveTab('auctions');
                      setActiveInfoPanel(null);
                    }}
                  >
                    <GraphUp size={18} style={{ color: ui.green }} />
                    {t('supplier.tabs.auctions')}
                  </Button>

                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeTab === 'certificates' && !activeInfoPanel)}
                    onClick={() => {
                      setActiveTab('certificates');
                      setActiveInfoPanel(null);
                    }}
                  >
                    <Shield size={18} style={{ color: ui.green }} />
                    {t('supplier.tabs.certificates')}
                  </Button>

                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeTab === 'stats' && !activeInfoPanel)}
                    onClick={() => {
                      setActiveTab('stats');
                      setActiveInfoPanel(null);
                    }}
                  >
                    <ClipboardData size={18} style={{ color: ui.green }} />
                    {t('supplier.tabs.statistics')}
                  </Button>
                </div>

                <hr style={{ borderColor: ui.border, margin: '1rem 0' }} />

                <div className="mb-3">

                </div>

                <div className="d-grid gap-2">
                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeInfoPanel === 'support')}
                    onClick={() => setActiveInfoPanel('support')}
                  >
                    <QuestionCircle size={18} style={{ color: ui.green }} />
                    Поддержка
                  </Button>


                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeInfoPanel === 'settings')}
                    onClick={() => setActiveInfoPanel('settings')}
                  >
                    <Gear size={18} style={{ color: ui.green }} />
                    Настройки
                  </Button>
                  <Button
                    variant="light"
                    style={sidebarItemStyle(activeInfoPanel === 'about')}
                    onClick={() => setActiveInfoPanel('about')}
                  >
                    <InfoCircle size={18} style={{ color: ui.green }} />
                    О нас
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </aside>

          <main>
            {renderContent()}
          </main>
        </div>
      </div>

      <style>{`
        .supplier-layout {
          display: grid;
          grid-template-columns: 290px minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 991px) {
          .supplier-layout {
            grid-template-columns: 1fr;
          }
        }

        .btn:focus,
        .btn:active {
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
};

export default SupplierDashboard;