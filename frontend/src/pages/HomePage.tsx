import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Navbar, Nav, Button, Spinner } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode';
import { useTranslation } from 'react-i18next';
import {
    Person,
    Cart,
    HouseDoor,
    GeoAlt
} from 'react-bootstrap-icons';

import logo from '../logo.png';

import ManagerModerationDashboard from '../components/manager/ManagerModerationDashboard';
import RegulatorDashboard from '../components/regulator/RegulatorDashboard';
import AdminDashboard from '../components/adminDashboard';
import SupplierDashboard from '../components/supplierDashboard';
import UserDashboard from '../components/user';
import CustomerPage from '../components/CustomerPage';
import BuyerCartPage from '../components/buyer/BuyerCartPage';
import BuyerProfilePage from '../components/buyer/BuyerProfilePage';
import LanguageSwitcher from '../components/languageSwitcher';

interface DecodedToken {
    userId: number;
    roleId: number;
    role: string;
    username: string;
    iat: number;
    exp: number;
}

interface User {
    userId: number;
    name: string;
    login: string;
    role: string;
    roleId: number;
}

type BuyerHeaderView = 'dashboard' | 'profile' | 'cart';

const Home: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [buyerHeaderView, setBuyerHeaderViewState] = useState<BuyerHeaderView>(() => {
        const saved = sessionStorage.getItem('buyerHeaderView') as BuyerHeaderView | null;

        if (saved === 'dashboard' || saved === 'profile' || saved === 'cart') {
            return saved;
        }

        return 'dashboard';
    });

    const setBuyerHeaderView = (view: BuyerHeaderView) => {
        sessionStorage.setItem('buyerHeaderView', view);
        setBuyerHeaderViewState(view);
    };
    const navigate = useNavigate();
    const { t } = useTranslation();

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
        shadow: '0 10px 28px rgba(34,49,39,0.08)'
    };

    const chip = (bg: string, color: string): React.CSSProperties => ({
        background: bg,
        color,
        borderRadius: 999,
        padding: '0.58rem 0.9rem',
        fontSize: '0.86rem',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: `1px solid ${ui.border}`
    });

    const headerActionButton = (active: boolean): React.CSSProperties => ({
        borderRadius: 12,
        border: active ? `1px solid ${ui.green}` : `1px solid ${ui.border}`,
        background: active ? ui.green : '#fff',
        color: active ? '#fff' : ui.text,
        boxShadow: active ? '0 8px 18px rgba(47,107,58,0.16)' : 'none',
        fontWeight: 600
    });

    const getRoleLabel = (roleId?: number) => {
        if (roleId === 1) return t('roles.admin');
        if (roleId === 2) return t('roles.supplier');
        if (roleId === 3) return t('roles.buyer');
        if (roleId === 4) return 'Модератор';
        if (roleId === 5) return 'Регулятор';

        return t('roles.user');
    };

    useEffect(() => {
        const token = localStorage.getItem('userToken');
        const savedUser = localStorage.getItem('user');

        if (!token) {
            navigate('/');
            return;
        }

        try {
            const decoded = jwtDecode<DecodedToken>(token);

            let roleName = '';
            if (decoded.roleId === 1) roleName = t('roles.admin');
            else if (decoded.roleId === 2) roleName = t('roles.supplier');
            else if (decoded.roleId === 3) roleName = t('roles.buyer');
            else roleName = t('roles.user');

            if (savedUser) {
                const parsedUser = JSON.parse(savedUser);
                const userData: User = {
                    userId: decoded.userId,
                    name: parsedUser.name || decoded.username,
                    login: decoded.username,
                    role: roleName,
                    roleId: decoded.roleId
                };

                setUser(userData);
                localStorage.setItem('user', JSON.stringify(userData));
                toast.success(t('home.welcomeUser', { name: parsedUser.name || decoded.username }));
            } else {
                const newUser: User = {
                    userId: decoded.userId,
                    name: decoded.username,
                    login: decoded.username,
                    role: roleName,
                    roleId: decoded.roleId
                };

                setUser(newUser);
                localStorage.setItem('user', JSON.stringify(newUser));
                toast.success(t('home.welcomeUser', { name: decoded.username }));
            }
        } catch (error) {
            console.error('Error decoding token:', error);
            localStorage.removeItem('userToken');
            localStorage.removeItem('user');
            navigate('/');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('user');
        localStorage.removeItem('userData');

        sessionStorage.removeItem('buyerHeaderView');

        toast.info(t('home.logoutSuccess'));
        navigate('/');
    };

    const renderDashboard = () => {
        if (!user) return null;

        if (user.roleId === 1) return <AdminDashboard user={user} />;
        if (user.roleId === 2) return <SupplierDashboard user={user} />;
        if (user.roleId === 3) {
            if (buyerHeaderView === 'profile') return <BuyerProfilePage />;
            if (buyerHeaderView === 'cart') return <BuyerCartPage />;
            return <CustomerPage user={user} />;
        }
        if (user.roleId === 4) return <ManagerModerationDashboard user={user} />;
        if (user.roleId === 5) return <RegulatorDashboard user={user} />;


        return <UserDashboard user={user} />;
    };

    if (loading) {
        return (
            <Container
                className="d-flex justify-content-center align-items-center"
                style={{ height: '100vh' }}
            >
                <Spinner animation="border" variant="primary" />
            </Container>
        );
    }

    return (
        <>
            <ToastContainer position="top-right" autoClose={3000} />

            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1030,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    background: ui.navbarBg,
                    borderBottom: `1px solid ${ui.border}`,
                    boxShadow: ui.shadow
                }}
            >
                <Navbar expand="lg" className="py-3">
                    <Container fluid className="px-4 px-lg-5">
                        <Navbar.Brand
                            href="/home"
                            onClick={(e) => {
                                e.preventDefault();
                                if (user?.roleId === 3) setBuyerHeaderView('dashboard');
                            }}
                            style={{
                                color: ui.text,
                                fontWeight: 800,
                                fontSize: '1.2rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                cursor: 'pointer'
                            }}
                        >
                            <div
                                style={{
                                    width: 46,
                                    height: 46,
                                    borderRadius: '50%',
                                    background: ui.green,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    boxShadow: '0 8px 18px rgba(47,107,58,0.18)'
                                }}
                            >
                                <img
                                    src={logo}
                                    alt="Marplatf"
                                    style={{
                                        width: 28,
                                        height: 28,
                                        objectFit: 'contain'
                                    }}
                                />
                            </div>
                            Marplatf
                        </Navbar.Brand>

                        <Navbar.Toggle aria-controls="basic-navbar-nav" />

                        <Navbar.Collapse className="d-flex justify-content-center" id="basic-navbar-nav">
                            <Nav className="me-auto ms-lg-4">
                                <Nav.Link
                                    href="/home"
                                    className="fw-semibold"
                                    style={{ color: ui.text }}
                                    onClick={(e) => {
                                        if (user?.roleId === 3) {
                                            e.preventDefault();
                                            setBuyerHeaderView('dashboard');
                                        }
                                    }}
                                >
                                    <HouseDoor className="me-2" />
                                    {t('home.home')}
                                </Nav.Link>

                                {/* <Nav.Link
                                    href="/modern-farmers"
                                    className="fw-semibold"
                                    style={{ color: ui.text }}
                                >
                                    <GeoAlt className="me-2" />
                                    {t('home.farmPages')}
                                </Nav.Link> */}
                            </Nav>

                            <Nav className="ms-5 me-5 gap-2 flex-wrap navbar-nav">
                                <LanguageSwitcher />

                                <span style={chip(ui.greenSoft, ui.green)}>
                                    <Person size={14} />
                                    {getRoleLabel(user?.roleId)}
                                </span>

                                <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                                    {user?.name}
                                </span>

                                {user?.roleId === 3 && (
                                    <>
                                        <Button
                                            variant="light"
                                            size="sm"
                                            onClick={() => setBuyerHeaderView('profile')}
                                            style={headerActionButton(buyerHeaderView === 'profile')}
                                        >
                                            <Person className="me-2" />
                                            {t('home.profile')}
                                        </Button>

                                        <Button
                                            variant="light"
                                            size="sm"
                                            onClick={() => setBuyerHeaderView('cart')}
                                            style={headerActionButton(buyerHeaderView === 'cart')}
                                        >
                                            <Cart className="me-2" />
                                            {t('home.cart')}
                                        </Button>
                                    </>
                                )}

                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    className='ms-5'
                                    onClick={handleLogout}
                                    style={{ borderRadius: 12 }}
                                >
                                    {t('home.logout')}
                                </Button>
                            </Nav>
                        </Navbar.Collapse>
                    </Container>
                </Navbar>
            </div>

            <Container fluid className="px-0">
                {renderDashboard()}
            </Container>
        </>
    );
};

export default Home;