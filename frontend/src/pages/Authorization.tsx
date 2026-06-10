import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

import field1 from '../assets/field-1.png';
import field2 from '../assets/field-2.jpg';
import tractor from '../assets/tractor.jpg';
import warehouse from '../assets/warehouse.jpg';
import quality from '../assets/quality.jpg';
import analytics from '../assets/analytics.jpg';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import {
    Button,
    Card,
    Form,
    InputGroup,
    Spinner
} from 'react-bootstrap';

import {
    BoxArrowInRight,
    CheckCircle,
    GeoAlt,
    GraphUp,
    Leaf,
    Lock,
    Person,
    ShieldCheck
} from 'react-bootstrap-icons';

import logo from '../logo.png';

interface AuthorizationProps {
    onLogin?: (status: boolean) => void;
}

interface FormData {
    login: string;
    password: string;
}

const Authorization: React.FC<AuthorizationProps> = ({ onLogin }) => {
    const [formData, setFormData] = useState<FormData>({
        login: '',
        password: ''
    });

    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const navigate = useNavigate();

    const ui = {
        page: '#f6f3ed',
        page2: '#fbfaf6',
        top: 'rgba(255, 255, 255, 0.84)',
        card: '#ffffff',
        border: '#ebe4d8',
        text: '#223127',
        muted: '#6f7a71',
        green: '#2f6b3a',
        greenDark: '#244f2b',
        greenDeep: '#173820',
        greenSoft: '#dfeadf',
        greenPale: '#eef5ec',
        lime: '#b7d46a',
        yellow: '#f6d900',
        orange: '#d97706',
        danger: '#c2410c',
        shadow: '0 26px 70px rgba(34, 49, 39, 0.14)',
        softShadow: '0 18px 45px rgba(34, 49, 39, 0.10)',
        cardShadow: '0 24px 60px rgba(34, 49, 39, 0.16)'
    };

    const visualCards = [
        {
            label: 'Поля',
            description: 'посевы и участки',
            className: 'auth-visual-card card-tall card-a',
            backgroundImage: `url(${field1})`
        },
        {
            label: 'Урожай',
            description: 'карточки продукции',
            className: 'auth-visual-card card-medium card-b',
            backgroundImage: `url(${field2})`
        },
        {
            label: 'Склад',
            description: 'остатки и партии',
            className: 'auth-visual-card card-small card-c',
            backgroundImage: `url(${warehouse})`
        },
        {
            label: 'Участки',
            description: 'география фермеров',
            className: 'auth-visual-card card-tall card-d',
            backgroundImage: `url(${tractor})`
        },
        {
            label: 'Качество',
            description: 'проверка и сертификаты',
            className: 'auth-visual-card card-medium card-e',
            backgroundImage: `url(${quality})`
        },
        {
            label: 'Аналитика',
            description: 'рынок',
            className: 'auth-visual-card card-small card-f',
            backgroundImage: `url(${analytics})`
        }
    ];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await axios.post('http://localhost:5000/login', formData);
            const { token, user } = response.data;

            localStorage.setItem('userToken', token);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('userData', JSON.stringify(user));

            toast.success('Вы успешно вошли!');

            if (onLogin) {
                onLogin(true);
            }

            setTimeout(() => {
                navigate('/home', { replace: true });
            }, 80);

            setTimeout(() => {
                if (window.location.pathname !== '/home') {
                    window.location.replace('/home');
                }
            }, 350);
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Ошибка сервера';
            toast.error('Ошибка входа. Проверьте данные!');
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <ToastContainer position="top-right" autoClose={3000} />

            <style>
                {`
                .auth-page {
                    min-height: 100vh;
                    background:
                        radial-gradient(circle at 12% 12%, rgba(47, 107, 58, 0.13), transparent 34%),
                        radial-gradient(circle at 86% 18%, rgba(183, 212, 106, 0.18), transparent 28%),
                        radial-gradient(circle at 78% 88%, rgba(217, 119, 6, 0.08), transparent 30%),
                        linear-gradient(135deg, ${ui.page2} 0%, ${ui.page} 58%, #edf3e8 100%);
                    overflow: hidden;
                    position: relative;
                    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    color: ${ui.text};
                }

                .auth-page::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    opacity: 0.45;
                    background-image:
                        linear-gradient(rgba(47,107,58,0.06) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(47,107,58,0.06) 1px, transparent 1px);
                    background-size: 54px 54px;
                    mask-image: radial-gradient(circle at 60% 40%, black 0%, transparent 76%);
                }

                .auth-topbar {
                    height: 78px;
                    background: ${ui.top};
                    backdrop-filter: blur(18px);
                    display: flex;
                    align-items: center;
                    padding: 0 38px;
                    border-bottom: 1px solid rgba(34,49,39,0.08);
                    position: relative;
                    z-index: 5;
                }

                .auth-brand {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    color: ${ui.greenDark};
                    font-weight: 950;
                    letter-spacing: -0.04em;
                    font-size: 1.55rem;
                }

                .auth-brand-logo {
                    width: 50px;
                    height: 50px;
                    border-radius: 18px;
                    background: linear-gradient(145deg, ${ui.green} 0%, ${ui.greenDark} 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 12px 28px rgba(47,107,58,0.22);
                    border: 1px solid rgba(255,255,255,0.55);
                }

                .auth-brand-logo img {
                    width: 30px;
                    height: 30px;
                    object-fit: contain;
                }

                .auth-brand-divider {
                    height: 32px;
                    width: 1px;
                    background: rgba(34,49,39,0.18);
                    margin: 0 8px;
                }

                .auth-brand-section {
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: ${ui.green};
                    letter-spacing: -0.02em;
                }

           .auth-hero {
    min-height: calc(100vh - 78px);
    position: relative;
    display: grid;
    grid-template-columns: minmax(420px, 0.9fr) minmax(540px, 1.1fr);
    gap: 42px;
    align-items: start;
    padding: 16px 6vw 48px;
}
    .auth-left {
    padding-top: 8px;
}

                .auth-left {
                    position: relative;
                    z-index: 2;
                    max-width: 670px;
                }

                .auth-kicker {
                    white-space: nowrap;
                    width: fit-content;
                    max-width: 100%;
                    display: inline-flex;
                    align-items: center;
                    gap: 9px;
                    padding: 0.62rem 0.92rem;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.72);
                    border: 1px solid ${ui.border};
                    color: ${ui.greenDark};
                    font-weight: 850;
                    margin-bottom: 22px;
                    box-shadow: 0 10px 28px rgba(34,49,39,0.08);
                }

                .auth-kicker svg {
                    color: ${ui.green};
                }

                .auth-title {
                    color: ${ui.greenDeep};
                    font-size: clamp(2.1rem, 4.1vw, 4.45rem);
                    line-height: 1.02;
                    letter-spacing: -0.065em;
                    font-weight: 950;
                    margin-bottom: 20px;
                    max-width: 780px;
                    text-wrap: balance;
                    word-break: normal;
                    overflow-wrap: normal;
                }


                .auth-subtitle {
                    color: ${ui.muted};
                    font-size: 1.12rem;
                    line-height: 1.7;
                    max-width: 590px;
                    margin-bottom: 28px;
                    font-weight: 500;
                }

                .auth-form-card {
                    width: min(100%, 486px);
                    border: 1px solid rgba(235, 228, 216, 0.95);
                    border-radius: 32px;
                    background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.88));
                    backdrop-filter: blur(18px);
                    box-shadow: ${ui.shadow};
                    overflow: hidden;
                    position: relative;
                }

                .auth-form-card::before {
                    content: "";
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: 0;
                    height: 6px;
                    background: linear-gradient(90deg, ${ui.green} 0%, ${ui.lime} 62%, ${ui.yellow} 100%);
                }

                .auth-form-card .card-body {
                    padding: 30px;
                }

                .auth-form-title-row {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 16px;
                    margin-bottom: 22px;
                }

                .auth-form-badge {
                    width: 46px;
                    height: 46px;
                    border-radius: 17px;
                    background: ${ui.greenSoft};
                    color: ${ui.green};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .auth-field-shell {
                    border: 1px solid ${ui.border};
                    border-radius: 19px;
                    padding: 7px 9px;
                    background: #fbfaf7;
                    transition: 0.18s ease;
                }

                .auth-field-shell:focus-within {
                    border-color: ${ui.green};
                    box-shadow: 0 0 0 4px rgba(47,107,58,0.12);
                    background: #fff;
                }

                .auth-field-shell .input-group-text {
                    border: none;
                    background: transparent;
                    color: ${ui.green};
                }

                .auth-field-shell .form-control {
                    border: none;
                    background: transparent;
                    box-shadow: none;
                    color: ${ui.text};
                    height: 42px;
                    font-weight: 600;
                }

                .auth-field-shell .form-control::placeholder {
                    color: #9aa49b;
                    font-weight: 500;
                }

                .auth-submit.btn,
                .auth-submit.btn:disabled {
                    height: 58px;
                    border-radius: 19px;
                    border: none;
                    background: linear-gradient(135deg, ${ui.green} 0%, ${ui.greenDark} 100%);
                    color: #ffffff;
                    font-weight: 950;
                    box-shadow: 0 18px 34px rgba(47,107,58,0.24);
                    transition: 0.18s ease;
                }

                .auth-submit.btn:hover,
                .auth-submit.btn:focus,
                .auth-submit.btn:active,
                .auth-submit.btn:first-child:active {
                    background: linear-gradient(135deg, ${ui.greenDark} 0%, ${ui.greenDeep} 100%);
                    color: #ffffff;
                    border: none;
                    box-shadow: 0 22px 42px rgba(47,107,58,0.30);
                    transform: translateY(-1px);
                }

                .auth-submit.btn:focus-visible {
                    outline: none;
                    box-shadow: 0 22px 42px rgba(47,107,58,0.30), 0 0 0 4px rgba(47,107,58,0.18);
                }

                .auth-secondary-link {
                    color: ${ui.green};
                    font-weight: 850;
                    text-decoration: none;
                }

                .auth-secondary-link:hover {
                    color: ${ui.greenDark};
                    text-decoration: underline;
                }

                .auth-features {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 12px;
                    margin-top: 22px;
                    max-width: 600px;
                }

                .auth-feature {
                    color: ${ui.greenDark};
                    border: 1px solid rgba(47,107,58,0.12);
                    background: rgba(255,255,255,0.58);
                    backdrop-filter: blur(14px);
                    border-radius: 20px;
                    padding: 14px 15px;
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    font-size: 0.92rem;
                    font-weight: 850;
                    box-shadow: 0 12px 30px rgba(34,49,39,0.07);
                }

                .auth-feature svg {
                    color: ${ui.green};
                    flex-shrink: 0;
                }

                .auth-right {
                    position: relative;
                    z-index: 2;
                    min-height: 650px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .auth-visual-shell {
                    position: relative;
                    width: min(100%, 760px);
                    height: 670px;
                    border-radius: 42px;
                    background: linear-gradient(145deg, rgba(255,255,255,0.52), rgba(255,255,255,0.18));
                    border: 1px solid rgba(255,255,255,0.72);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.75), 0 30px 80px rgba(34,49,39,0.12);
                    overflow: visible;
                }

                .auth-visual-shell::before {
                    content: "";
                    position: absolute;
                    inset: 22px;
                    border-radius: 34px;
                    background:
                        radial-gradient(circle at 72% 16%, rgba(47,107,58,0.16), transparent 28%),
                        radial-gradient(circle at 24% 80%, rgba(183,212,106,0.25), transparent 30%),
                        linear-gradient(180deg, rgba(255,255,255,0.54), rgba(255,255,255,0.18));
                    border: 1px solid rgba(255,255,255,0.72);
                }

                .auth-visual-grid {
                    width: 100%;
                    height: 100%;
                    position: relative;
                }

                .auth-visual-card {
                    position: absolute;
                    border-radius: 28px;
                    overflow: hidden;
                    box-shadow: ${ui.cardShadow};
                    border: 5px solid rgba(255,255,255,0.82);
                    display: flex;
                    align-items: flex-end;
                    padding: 15px;
                    color: white;
                    background-size: cover;
                    background-position: center;
                    isolation: isolate;
                    transition: transform 0.18s ease, box-shadow 0.18s ease;
                }

                .auth-visual-card:hover {
                    transform: translateY(-4px) rotate(0deg);
                    box-shadow: 0 30px 70px rgba(34,49,39,0.22);
                }

                .auth-visual-card::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(23,56,32,0.62));
                    z-index: -1;
                }

                .auth-card-content {
                    width: 100%;
                }

                .auth-card-label {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.45rem 0.72rem;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.86);
                    color: ${ui.greenDark};
                    font-weight: 950;
                    font-size: 0.9rem;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.12);
                }

                .auth-card-description {
                    margin-top: 8px;
                    color: rgba(255,255,255,0.92);
                    font-weight: 750;
                    font-size: 0.86rem;
                    text-shadow: 0 2px 10px rgba(0,0,0,0.28);
                }

                .card-tall { width: 154px; height: 252px; }
                .card-medium { width: 170px; height: 184px; }
                .card-small { width: 146px; height: 146px; }

            .card-a { left: 4%; top: 180px}
.card-b { left: 18%; top: 120px;  }
.card-c { left: 28%; top: 255px;  }
.card-d { left: 45%; top: 55px;  }
.card-e { left: 62%; top: 150px;}
.card-f { left: 78%; top: 260px;  }
                .auth-map-device {
                    position: absolute;
                    left: 22%;
                    right: 5%;
                    bottom: 36px;
                    height: 244px;
                    border-radius: 34px;
                    background: #fbfdf8;
                    box-shadow: 0 28px 70px rgba(34,49,39,0.18);
                    border: 8px solid rgba(255,255,255,0.92);
                    outline: 1px solid rgba(47,107,58,0.16);
                    overflow: hidden;
                }

                .auth-map-device::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(90deg, rgba(255,255,255,0.96) 0 28%, transparent 28%),
                        linear-gradient(135deg, rgba(47,107,58,0.20), rgba(223,234,223,0.82)),
                        repeating-linear-gradient(25deg, transparent 0 42px, rgba(47,107,58,0.18) 43px 46px);
                }

                .auth-map-device::after {
                    content: "";
                    position: absolute;
                    left: 28px;
                    top: 28px;
                    width: 120px;
                    height: 14px;
                    border-radius: 999px;
                    background: #d8ded6;
                    box-shadow: 0 32px 0 #e7ebe5, 0 64px 0 #e7ebe5, 0 96px 0 #e7ebe5, 0 128px 0 #e7ebe5;
                }

                .auth-map-line {
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(28deg, transparent 45%, rgba(255,255,255,0.92) 46%, rgba(255,255,255,0.92) 47%, transparent 48%),
                        linear-gradient(-18deg, transparent 35%, rgba(255,255,255,0.75) 36%, rgba(255,255,255,0.75) 37%, transparent 38%);
                    opacity: 0.9;
                }

                .auth-map-pin {
                    position: absolute;
                    width: 15px;
                    height: 15px;
                    border-radius: 50%;
                    background: #19c743;
                    border: 2px solid white;
                    box-shadow: 0 0 0 5px rgba(25,199,67,0.20);
                }

                .pin-1 { left: 46%; top: 30%; }
                .pin-2 { left: 62%; top: 43%; }
                .pin-3 { left: 79%; top: 59%; }
                .pin-4 { left: 88%; top: 29%; }

                .auth-phone {
                    position: absolute;
                    left: 11%;
                    bottom: 82px;
                    width: 108px;
                    height: 180px;
                    border-radius: 28px;
                    background: #f9faf7;
                    border: 7px solid rgba(255,255,255,0.92);
                    outline: 1px solid rgba(47,107,58,0.18);
                    box-shadow: 0 22px 48px rgba(34,49,39,0.22);
                    overflow: hidden;
                }

                .auth-phone::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background:
                        linear-gradient(180deg, rgba(47,107,58,0.32) 0 48%, white 48%),
                        repeating-linear-gradient(90deg, transparent 0 20px, rgba(47,107,58,0.18) 21px 23px);
                }

                .auth-phone-bar {
                    position: absolute;
                    left: 14px;
                    right: 14px;
                    bottom: 28px;
                    height: 13px;
                    border-radius: 999px;
                    background: ${ui.green};
                }
.auth-title {
    display: flex;
    flex-direction: column;
    gap: 6px;
    white-space: nowrap;
    line-height: 1.02;
}

.auth-title span {
    display: block;
    white-space: nowrap;
}
.auth-title-stack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    white-space: nowrap;
}
                .auth-floating-pill {
                    position: absolute;
                    right: 12%;
                    bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 16px;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.86);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255,255,255,0.9);
                    box-shadow: 0 16px 38px rgba(34,49,39,0.14);
                    color: ${ui.greenDark};
                    font-weight: 900;
                }

                .auth-floating-pill svg {
                    color: ${ui.green};
                }

                .auth-glow {
                    position: absolute;
                    width: 410px;
                    height: 410px;
                    border-radius: 50%;
                    background: rgba(47,107,58,0.15);
                    filter: blur(72px);
                    right: 8%;
                    top: 18%;
                    pointer-events: none;
                }

                @media (max-width: 1160px) {
                    .auth-hero {
                        grid-template-columns: 1fr;
                        padding: 42px 24px 36px;
                    }

                    .auth-left {
                        max-width: 760px;
                        margin: 0 auto;
                    }

                    .auth-form-card {
                        width: min(100%, 560px);
                    }

                    .auth-right {
                        min-height: 560px;
                    }

                    .auth-visual-shell {
                        height: 540px;
                        transform: scale(0.84);
                        transform-origin: top center;
                    }
                }

                @media (max-width: 720px) {
                    .auth-topbar {
                        height: auto;
                        padding: 16px 18px;
                    }

                    .auth-brand {
                        font-size: 1.25rem;
                    }

                    .auth-brand-section {
                        font-size: 1rem;
                    }

                    .auth-hero {
                        padding: 28px 16px;
                    }

                    .auth-title {
                        font-size: 2.35rem;
                    }

                    .auth-kicker {
                        white-space: normal;
                    }

                    .auth-features {
                        grid-template-columns: 1fr;
                    }

                    .auth-right {
                        display: none;
                    }

                    .auth-form-card .card-body {
                        padding: 23px;
                    }

                    .auth-form-title-row {
                        align-items: center;
                    }
                }
                `}
            </style>

            <div className="auth-page">
                <header className="auth-topbar">
                    <div className="auth-brand">
                        <div className="auth-brand-logo">
                            <img src={logo} alt="Marplaf" />
                        </div>
                        <span>Marplaf</span>
                        <span className="auth-brand-divider" />
                        {/* <span className="auth-brand-section">Агропромышленная цифровая платформа фермеров и потребителей</span> */}
                    </div>
                </header>

                <main className="auth-hero">
                    <section className="auth-left">

                        <h1 className="auth-title">
                            <span className="auth-title-stack">
                                <span>Агропромышленная</span>
                                <span>цифровая платформа</span>
                            </span>
                            <span className="auth-title-stack">
                                <span>фермеров и</span>
                                <span>потребителей</span>
                            </span>
                        </h1>

                        <p className="auth-subtitle">
                            Авторизуйтесь, для взаимодействия с платформой
                        </p>

                        <Card className="auth-form-card border-0">
                            <Card.Body>
                                <div className="auth-form-title-row">
                                    <div>
                                        <h3 style={{ color: ui.text, fontWeight: 950, marginBottom: 6 }}>
                                            Вход в систему
                                        </h3>
                                        <div style={{ color: ui.muted, fontWeight: 500 }}>
                                            Введите данные аккаунта
                                        </div>
                                    </div>
                                </div>

                                <Form onSubmit={handleSubmit}>
                                    <Form.Group className="mb-3">
                                        <div className="auth-field-shell">
                                            <InputGroup>
                                                <InputGroup.Text>
                                                    <Person />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type="text"
                                                    name="login"
                                                    placeholder="Имя пользователя"
                                                    value={formData.login}
                                                    onChange={handleChange}
                                                    disabled={isLoading}
                                                    autoComplete="username"
                                                />
                                            </InputGroup>
                                        </div>
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <div className="auth-field-shell">
                                            <InputGroup>
                                                <InputGroup.Text>
                                                    <Lock />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    type="password"
                                                    name="password"
                                                    placeholder="Пароль"
                                                    value={formData.password}
                                                    onChange={handleChange}
                                                    disabled={isLoading}
                                                    autoComplete="current-password"
                                                />
                                            </InputGroup>
                                        </div>
                                    </Form.Group>

                                    {error && (
                                        <div className="mb-3" style={{ color: ui.danger, fontWeight: 750 }}>
                                            {error}
                                        </div>
                                    )}

                                    <Button
                                        variant="none"
                                        type="submit"
                                        disabled={isLoading}
                                        className="auth-submit w-100 d-flex align-items-center justify-content-center gap-2"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Spinner size="sm" />
                                                Вход...
                                            </>
                                        ) : (
                                            <>
                                                <BoxArrowInRight />
                                                Войти
                                            </>
                                        )}
                                    </Button>

                                    <div className="d-flex flex-wrap justify-content-between gap-2 mt-4">
                                        <Link to="/forgot-password" className="auth-secondary-link">
                                            Забыли пароль?
                                        </Link>

                                        <div>
                                            <span style={{ color: ui.muted }}>Нет аккаунта? </span>
                                            <Link to="/register" className="auth-secondary-link">
                                                Зарегистрироваться
                                            </Link>
                                        </div>
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>
                    </section>

                    <section className="auth-right" aria-hidden="true">
                        <div className="auth-glow" />

                        <div className="auth-visual-shell">
                            <div className="auth-visual-grid">
                                {visualCards.map((card) => (
                                    <div
                                        key={card.label}
                                        className={card.className}
                                        style={{
                                            backgroundImage: card.backgroundImage,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center'
                                        }}
                                    >
                                        <div className="auth-card-content">
                                            <div className="auth-card-label">{card.label}</div>
                                            <div className="auth-card-description">{card.description}</div>
                                        </div>
                                    </div>
                                ))}

                                <div className="auth-map-device">
                                    <div className="auth-map-line" />
                                    <span className="auth-map-pin pin-1" />
                                    <span className="auth-map-pin pin-2" />
                                    <span className="auth-map-pin pin-3" />
                                    <span className="auth-map-pin pin-4" />
                                </div>

                                <div className="auth-phone">
                                    <div className="auth-phone-bar" />
                                </div>

                                {/* <div className="auth-floating-pill">
                                    <CheckCircle size={19} />
                                    Данные под контролем
                                </div> */}
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
};

export default Authorization;
