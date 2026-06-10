import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { BarChart, ClipboardData, Download, GeoAlt, GraphUpArrow, PieChart, PlusCircle, Sliders } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { createRegulatorLimit, getRegulatorDashboard, getRegulatorFilters } from '../../api/regulatorApi';
import { downloadCsv } from '../../api/systemHttp';

interface Props { user?: { userId: number; name: string; login: string; role: string; roleId: number } }

const theme = {
  bg: '#f6f3ed', card: '#ffffff', border: '#ebe4d8', text: '#223127', muted: '#6f7a71',
  green: '#2f6b3a', greenDark: '#244f2b', greenSoft: '#dfeadf', greenPale: '#eef5ec', orange: '#d97706',
  shadow: '0 14px 35px rgba(34, 49, 39, 0.08)'
};

const tabs = [
  { key: 'overview', label: 'Обзор', icon: <GraphUpArrow /> },
  { key: 'supply', label: 'Предложение', icon: <BarChart /> },
  { key: 'sales', label: 'Каналы продаж', icon: <PieChart /> },
  { key: 'regions', label: 'Регионы', icon: <GeoAlt /> },
  { key: 'limits', label: 'Границы', icon: <Sliders /> },
  { key: 'table', label: 'Таблица', icon: <ClipboardData /> }
];

function n(value: any, digits = 1) {
  return Number(value || 0).toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function barWidth(value: any, max: number) { return max ? `${Math.min(100, Number(value || 0) / max * 100)}%` : '0%'; }

function Donut({ rows, labelKey, valueKey }: { rows: any[]; labelKey: string; valueKey: string }) {
  const colors = ['#2f6b3a', '#7da05c', '#d97706', '#49566a', '#9fb36a', '#244f2b'];
  const total = rows.reduce((s, r) => s + Number(r[valueKey] || 0), 0) || 1;
  let cursor = 0;
  const gradient = rows.map((r, idx) => {
    const start = cursor;
    const end = cursor + Number(r[valueKey] || 0) / total * 100;
    cursor = end;
    return `${colors[idx % colors.length]} ${start}% ${end}%`;
  }).join(', ');

  return <div className="d-flex align-items-center gap-3 flex-wrap"><div style={{ width: 170, height: 170, borderRadius: '50%', background: `conic-gradient(${gradient || '#dfeadf 0% 100%'})`, boxShadow: theme.shadow, position: 'relative' }}><div style={{ position: 'absolute', inset: 34, borderRadius: '50%', background: theme.card, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.greenDark, fontWeight: 900 }}>{n(total, 0)}</div></div><div style={{ flex: 1, minWidth: 220 }}>{rows.map((r, idx) => <div key={`${r[labelKey]}-${idx}`} className="d-flex align-items-center justify-content-between mb-2"><div className="d-flex align-items-center gap-2"><span style={{ width: 12, height: 12, borderRadius: 999, background: colors[idx % colors.length] }} /><span style={{ color: theme.text, fontWeight: 700 }}>{r[labelKey] || 'Не указано'}</span></div><b>{n(r[valueKey], 1)}</b></div>)}</div></div>;
}

const RegulatorDashboard: React.FC<Props> = () => {
  const [active, setActive] = useState('overview');
  const [filters, setFilters] = useState<any>({ regions: [], cultures: [], statuses: [] });
  const [params, setParams] = useState({ region: '', culture: '', status: '', dateFrom: '', dateTo: '' });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [limitModal, setLimitModal] = useState(false);
  const [limitForm, setLimitForm] = useState({ region: 'Все регионы', culture: 'Все культуры', minVolume: 100, maxVolume: 10000, minPrice: 0, maxPrice: 500 });

  const load = async () => {
    try { setLoading(true); setData(await getRegulatorDashboard(params)); }
    catch (error: any) { toast.error(error.message || 'Ошибка аналитики'); }
    finally { setLoading(false); }
  };

  useEffect(() => { getRegulatorFilters().then((d) => setFilters(d.filters || {})).catch(() => undefined); load(); }, []);

  const summary = data?.summary || {};
  const byCulture = data?.byCulture || [];
  const byRegion = data?.byRegion || [];
  const priceBands = data?.priceBands || [];
  const salesChannels = data?.salesChannels || [];
  const limits = data?.limits || [];
  const risks = data?.risks || [];
  const maxCulture = useMemo(() => Math.max(...byCulture.map((x: any) => Number(x.volume || 0)), 1), [byCulture]);
  const maxRegion = useMemo(() => Math.max(...byRegion.map((x: any) => Number(x.volume || 0)), 1), [byRegion]);
  const maxBand = useMemo(() => Math.max(...priceBands.map((x: any) => Number(x.count || 0)), 1), [priceBands]);
  const exportRows = [...byCulture.map((x: any) => ({ group: 'culture', ...x })), ...byRegion.map((x: any) => ({ group: 'region', ...x })), ...salesChannels.map((x: any) => ({ group: 'channel', ...x })), ...priceBands.map((x: any) => ({ group: 'price_band', ...x }))];

  const kpis = [
    ['Предложение', `${n(summary.offerVolume)} кг`, 'объем на рынке'],
    ['Продано', `${n(summary.salesVolume)} ед.`, 'по покупкам'],
    ['Заказы', `${n(summary.orders, 0)}`, 'записи purchases'],
    ['Аукционы', `${n(summary.auctions, 0)}`, 'активность торгов'],
    ['Средняя цена', `${n(summary.avgPrice)} ₽`, 'по карточкам'],
    ['Товаров', `${n(summary.products, 0)}`, 'карточек всего'],
    ['Дефицит', `${n(summary.deficitIndex)} кг`, 'ниже границы'],
    ['Избыток', `${n(summary.surplusIndex)} кг`, 'выше границы']
  ];

  const saveLimit = async () => {
    try { await createRegulatorLimit(limitForm); toast.success('Граница сохранена'); setLimitModal(false); await load(); }
    catch (error: any) { toast.error(error.message || 'Ошибка сохранения границы'); }
  };

  return <div style={{ background: theme.bg, borderRadius: 30, padding: 18 }}>
    <Card className="border-0 mb-3" style={{ borderRadius: 26, boxShadow: theme.shadow }}><Card.Body><Row className="g-3 align-items-end"><Col lg={2} md={4}><Form.Label>Регион</Form.Label><Form.Select value={params.region} onChange={(e) => setParams((p) => ({ ...p, region: e.target.value }))}><option value="">Все регионы</option>{(filters.regions || []).map((x: string) => <option key={x} value={x}>{x}</option>)}</Form.Select></Col><Col lg={2} md={4}><Form.Label>Культура</Form.Label><Form.Select value={params.culture} onChange={(e) => setParams((p) => ({ ...p, culture: e.target.value }))}><option value="">Все культуры</option>{(filters.cultures || []).map((x: string) => <option key={x} value={x}>{x}</option>)}</Form.Select></Col><Col lg={2} md={4}><Form.Label>Статус</Form.Label><Form.Select value={params.status} onChange={(e) => setParams((p) => ({ ...p, status: e.target.value }))}><option value="">Все</option>{(filters.statuses || []).map((x: string) => <option key={x} value={x}>{x}</option>)}</Form.Select></Col><Col lg={2} md={4}><Form.Label>С даты</Form.Label><Form.Control type="date" value={params.dateFrom} onChange={(e) => setParams((p) => ({ ...p, dateFrom: e.target.value }))} /></Col><Col lg={2} md={4}><Form.Label>По дату</Form.Label><Form.Control type="date" value={params.dateTo} onChange={(e) => setParams((p) => ({ ...p, dateTo: e.target.value }))} /></Col><Col lg={2} md={4}><div className="d-flex gap-2"><Button className="w-100" onClick={load} style={{ background: theme.green, borderColor: theme.green }}>Показать</Button><Button variant="outline-secondary" onClick={() => downloadCsv('regulator_analytics.csv', exportRows)}><Download /></Button></div></Col></Row></Card.Body></Card>

    <div className="d-flex flex-wrap gap-2 mb-3">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setActive(tab.key)} style={{ border: 'none', borderRadius: 999, padding: '0.62rem 0.95rem', background: active === tab.key ? theme.green : theme.greenPale, color: active === tab.key ? '#fff' : theme.greenDark, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: active === tab.key ? '0 12px 25px rgba(47,107,58,0.18)' : 'none' }}>{tab.icon}{tab.label}</button>)}</div>

    {loading ? <div className="text-center py-5"><Spinner animation="border" style={{ color: theme.green }} /></div> : <>
      {active === 'overview' && <><Row className="g-3 mb-3">{kpis.map(([label, value, hint]) => <Col xl={3} md={4} sm={6} key={label}><Card className="border-0 h-100" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><h3 style={{ color: theme.text, fontWeight: 900, margin: 0 }}>{value}</h3><div style={{ color: theme.text, fontWeight: 800 }}>{label}</div><small style={{ color: theme.muted }}>{hint}</small></Card.Body></Card></Col>)}</Row><Row className="g-3"><Col lg={7}><Card className="border-0 h-100" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><h5 style={{ color: theme.text, fontWeight: 900 }}>Распределение по каналам</h5><Donut rows={salesChannels} labelKey="channel" valueKey="value" /></Card.Body></Card></Col><Col lg={5}><Card className="border-0 h-100" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><h5 style={{ color: theme.text, fontWeight: 900 }}>Сигналы</h5>{risks.length === 0 ? <Alert style={{ background: theme.greenSoft, color: theme.greenDark, borderColor: theme.border }}>Критичных отклонений не выявлено.</Alert> : risks.map((risk: any, idx: number) => <Alert key={idx} variant={risk.type === 'deficit' ? 'danger' : 'warning'}><b>{risk.title}</b><div>{risk.message}</div></Alert>)}</Card.Body></Card></Col></Row></>}

      {active === 'supply' && <Row className="g-3"><Col lg={7}><Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><h5 style={{ color: theme.text, fontWeight: 900 }}>Объемы по культурам</h5>{byCulture.map((row: any) => <div key={row.culture} className="mb-3"><div className="d-flex justify-content-between"><b>{row.culture}</b><span>{n(row.volume)} кг · {n(row.avg_price)} ₽</span></div><div style={{ height: 12, background: '#eef2ef', borderRadius: 999 }}><div style={{ height: 12, width: barWidth(row.volume, maxCulture), background: theme.green, borderRadius: 999 }} /></div></div>)}</Card.Body></Card></Col><Col lg={5}><Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><h5 style={{ color: theme.text, fontWeight: 900 }}>Доля культур</h5><Donut rows={byCulture.slice(0, 8)} labelKey="culture" valueKey="volume" /></Card.Body></Card></Col></Row>}

      {active === 'sales' && <Row className="g-3"><Col lg={6}><Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><h5 style={{ color: theme.text, fontWeight: 900 }}>Каналы реализации</h5><Donut rows={salesChannels} labelKey="channel" valueKey="value" /></Card.Body></Card></Col><Col lg={6}><Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><h5 style={{ color: theme.text, fontWeight: 900 }}>Ценовые диапазоны</h5>{priceBands.map((row: any) => <div key={row.band} className="mb-3"><div className="d-flex justify-content-between"><b>{row.band} ₽</b><span>{row.count} товаров</span></div><div style={{ height: 12, background: '#eef2ef', borderRadius: 999 }}><div style={{ height: 12, width: barWidth(row.count, maxBand), background: theme.orange, borderRadius: 999 }} /></div></div>)}</Card.Body></Card></Col></Row>}

      {active === 'regions' && <Row className="g-3"><Col lg={7}><Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><h5 style={{ color: theme.text, fontWeight: 900 }}>Региональная структура</h5>{byRegion.length === 0 ? <Alert style={{ background: theme.greenSoft, color: theme.greenDark, borderColor: theme.border }}>Региональные данные не найдены.</Alert> : byRegion.map((row: any) => <div key={row.region} className="mb-3"><div className="d-flex justify-content-between"><b>{row.region}</b><span>{n(row.volume)} кг · {row.count} карточек</span></div><div style={{ height: 12, background: '#eef2ef', borderRadius: 999 }}><div style={{ height: 12, width: barWidth(row.volume, maxRegion), background: theme.greenDark, borderRadius: 999 }} /></div></div>)}</Card.Body></Card></Col><Col lg={5}><Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><h5 style={{ color: theme.text, fontWeight: 900 }}>Доля регионов</h5><Donut rows={byRegion.slice(0, 8)} labelKey="region" valueKey="volume" /></Card.Body></Card></Col></Row>}

      {active === 'limits' && <Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><div className="d-flex justify-content-between align-items-center mb-3"><h5 style={{ color: theme.text, fontWeight: 900, margin: 0 }}>Регуляторные границы</h5><Button onClick={() => setLimitModal(true)} style={{ background: theme.green, borderColor: theme.green, borderRadius: 14 }}><PlusCircle className="me-1" />Добавить</Button></div><div className="table-responsive"><Table hover className="align-middle"><thead><tr><th>Регион</th><th>Культура</th><th>Мин. объем</th><th>Макс. объем</th><th>Мин. цена</th><th>Макс. цена</th></tr></thead><tbody>{limits.map((row: any) => <tr key={row.id}><td>{row.region}</td><td>{row.culture}</td><td>{n(row.minVolume)} кг</td><td>{n(row.maxVolume)} кг</td><td>{n(row.minPrice)} ₽</td><td>{n(row.maxPrice)} ₽</td></tr>)}</tbody></Table></div></Card.Body></Card>}

      {active === 'table' && <Card className="border-0" style={{ borderRadius: 24, boxShadow: theme.shadow }}><Card.Body><h5 style={{ color: theme.text, fontWeight: 900 }}>Сводная таблица</h5><div className="table-responsive"><Table hover className="align-middle"><thead><tr><th>Группа</th><th>Название</th><th>Количество</th><th>Объем</th><th>Средняя цена</th><th>Доля</th></tr></thead><tbody>{byCulture.map((row: any) => <tr key={`culture-${row.culture}`}><td>Культура</td><td>{row.culture}</td><td>{row.count}</td><td>{n(row.volume)} кг</td><td>{n(row.avg_price)} ₽</td><td>{n(row.percent)}%</td></tr>)}{byRegion.map((row: any) => <tr key={`region-${row.region}`}><td>Регион</td><td>{row.region}</td><td>{row.count}</td><td>{n(row.volume)} кг</td><td>{n(row.avg_price)} ₽</td><td>{n(row.percent)}%</td></tr>)}</tbody></Table></div></Card.Body></Card>}
    </>}

    <Modal show={limitModal} onHide={() => setLimitModal(false)} centered><Modal.Header closeButton><Modal.Title>Новая граница</Modal.Title></Modal.Header><Modal.Body><Row className="g-3"><Col md={6}><Form.Label>Регион</Form.Label><Form.Control value={limitForm.region} onChange={(e) => setLimitForm((p) => ({ ...p, region: e.target.value }))} /></Col><Col md={6}><Form.Label>Культура</Form.Label><Form.Control value={limitForm.culture} onChange={(e) => setLimitForm((p) => ({ ...p, culture: e.target.value }))} /></Col><Col md={6}><Form.Label>Мин. объем</Form.Label><Form.Control type="number" value={limitForm.minVolume} onChange={(e) => setLimitForm((p) => ({ ...p, minVolume: Number(e.target.value) }))} /></Col><Col md={6}><Form.Label>Макс. объем</Form.Label><Form.Control type="number" value={limitForm.maxVolume} onChange={(e) => setLimitForm((p) => ({ ...p, maxVolume: Number(e.target.value) }))} /></Col><Col md={6}><Form.Label>Мин. цена</Form.Label><Form.Control type="number" value={limitForm.minPrice} onChange={(e) => setLimitForm((p) => ({ ...p, minPrice: Number(e.target.value) }))} /></Col><Col md={6}><Form.Label>Макс. цена</Form.Label><Form.Control type="number" value={limitForm.maxPrice} onChange={(e) => setLimitForm((p) => ({ ...p, maxPrice: Number(e.target.value) }))} /></Col></Row></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setLimitModal(false)}>Отмена</Button><Button onClick={saveLimit} style={{ background: theme.green, borderColor: theme.green }}>Сохранить</Button></Modal.Footer></Modal>
  </div>;
};

export default RegulatorDashboard;
