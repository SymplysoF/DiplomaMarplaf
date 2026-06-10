import React, { useState } from 'react';
import { Badge, Card, Tab, Tabs } from 'react-bootstrap';
import { BarChart, Building, Database, People } from 'react-bootstrap-icons';
import AdminOverviewPanel from './admin/AdminOverviewPanel';
import AdminUsersPanel from './admin/AdminUsersPanel';
import AdminSuppliersPanel from './admin/AdminSuppliersPanel';
import AdminSystemTables from './admin/AdminSystemTables';

interface AdminDashboardProps {
  user: {
    userId: number;
    name: string;
    login: string;
    role: string;
    roleId: number;
  };
}

const ui = {
  bg: '#f6f3ed',
  text: '#223127',
  muted: '#6f7a71',
  greenSoft: '#dfeadf',
  greenDark: '#244f2b',
  shadow: '0 14px 35px rgba(34, 49, 39, 0.08)'
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div style={{ background: ui.bg, borderRadius: 32, padding: 18 }}>
      <Card className="border-0 mb-4" style={{ borderRadius: 28, boxShadow: ui.shadow }}>
        <Card.Body style={{ padding: 24 }}>

          <h2 className="mt-3 mb-1" style={{ color: ui.text, fontWeight: 900 }}>Панель управления</h2>
          <p className="mb-0" style={{ color: ui.muted }}>
            {user.name}, здесь собраны пользователи, поставщики, справочники, товары, заявки, аукционы и логи.
          </p>
        </Card.Body>
      </Card>

      <Card className="border-0" style={{ borderRadius: 28, boxShadow: ui.shadow }}>
        <Card.Body>
          <Tabs activeKey={activeTab} onSelect={(k) => k && setActiveTab(k)} className="mb-4">
            <Tab eventKey="tables" title={<><Database className="me-1" /> Таблицы</>} />
         
            <Tab eventKey="users" title={<><People className="me-1" /> Пользователи</>} />
            <Tab eventKey="suppliers" title={<><Building className="me-1" /> Поставщики</>} />
          </Tabs>

          {activeTab === 'tables' && <AdminSystemTables />}
         
          {activeTab === 'users' && <AdminUsersPanel />}
          {activeTab === 'suppliers' && <AdminSuppliersPanel />}
        </Card.Body>
      </Card>
    </div>
  );
};

export default AdminDashboard;
