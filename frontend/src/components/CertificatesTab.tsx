import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  Modal,
  Form,
  Alert,
  Spinner,
  Tabs,
  Tab
} from 'react-bootstrap';
import {
  Shield,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Upload,
  Download,
  Eye,
  Leaf,
  Flower1,
  Star,
  Map,
  Wallet,
  Trash
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { ui, chip, btnMain, btnSoft, btnDangerSoft, glassCard } from './supplierUI';
import {
  getSupplierCertificates,
  getCertificateTypes,
  requestSupplierCertificate,
  deleteSupplierCertificate
} from '../api/supplierCertificatesApi';

interface Certificate {
  id: number;
  certificate_type_id: number;
  certificate_name: string;
  certificate_description: string;
  certificate_icon: string;
  certificate_number: string;
  issued_by: string;
  issue_date: string;
  expiry_date: string;
  status: string;
  document_path: string;
  document_name: string;
  document_type: string;
  verification_comment: string;
  verifier_name: string;
  verified_at: string;
}

interface CertificateType {
  id: number;
  name: string;
  description: string;
  icon: string;
  validity_days: number;
}

const CertificatesTab: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger = 0 }) => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
  const [loading, setLoading] = useState(true);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [certificateNumber, setCertificateNumber] = useState('');
  const [issuedBy, setIssuedBy] = useState('');

  const [activeTab, setActiveTab] = useState('active');

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageData, setSelectedImageData] = useState<string | null>(null);
  const [selectedCertName, setSelectedCertName] = useState('');

  const [imageCache, setImageCache] = useState<Record<number, string>>({});
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCertificates = async () => {
    try {
      const data = await getSupplierCertificates();
      if (data.success) {
        setCertificates(data.certificates || []);
      }
    } catch {
      toast.error('Ошибка загрузки сертификатов');
    }
  };

  const fetchCertificateTypes = async () => {
    try {
      const data = await getCertificateTypes();
      if (data.success) {
        setCertificateTypes(data.types || []);
      }
    } catch {
      toast.error('Ошибка загрузки типов сертификатов');
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchCertificates(), fetchCertificateTypes()]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [refreshTrigger]);

  const getDocumentType = (cert: Certificate) =>
    cert.document_type || (cert as any).documentType || '';

  const getDocumentName = (cert: Certificate) =>
    cert.document_name || (cert as any).documentName || '';

  const getDocumentPath = (cert: Certificate) =>
    cert.document_path || (cert as any).documentPath || '';

  const isImageFile = useCallback((cert: Certificate) => {
    const documentType = getDocumentType(cert);
    const documentName = getDocumentName(cert);

    if (documentType) {
      return documentType.startsWith('image/');
    }

    const ext = documentName?.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  }, []);

  const isPdfFile = useCallback((cert: Certificate) => {
    const documentType = getDocumentType(cert);
    const documentName = getDocumentName(cert);

    if (documentType) {
      return documentType === 'application/pdf';
    }

    const ext = documentName?.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  }, []);

  const loadImageAsDataUrl = useCallback(
    async (certificateId: number, forceRefresh: boolean = false): Promise<string | null> => {
      if (!forceRefresh && imageCache[certificateId]) {
        return imageCache[certificateId];
      }

      if (loadingImages[certificateId]) {
        return null;
      }

      if (failedImages[certificateId] && !forceRefresh) {
        return null;
      }

      try {
        setLoadingImages((prev) => ({ ...prev, [certificateId]: true }));

        // FIX: real backend route
        const response = await fetch(`http://localhost:5000/api/certificates/image/${certificateId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        setImageCache((prev) => ({
          ...prev,
          [certificateId]: dataUrl
        }));

        setFailedImages((prev) => ({
          ...prev,
          [certificateId]: false
        }));

        return dataUrl;
      } catch (error) {
        console.error('Ошибка загрузки изображения сертификата:', error);

        setFailedImages((prev) => ({
          ...prev,
          [certificateId]: true
        }));

        return null;
      } finally {
        setLoadingImages((prev) => ({
          ...prev,
          [certificateId]: false
        }));
      }
    },
    [imageCache, loadingImages, failedImages]
  );

  const loadThumbnail = useCallback(
    async (cert: Certificate) => {
      if (!isImageFile(cert)) return;
      if (imageCache[cert.id]) return;
      if (loadingImages[cert.id]) return;
      if (failedImages[cert.id]) return;

      await loadImageAsDataUrl(cert.id);
    },
    [failedImages, imageCache, isImageFile, loadImageAsDataUrl, loadingImages]
  );

  useEffect(() => {
    certificates.forEach((cert) => {
      if (isImageFile(cert) && !imageCache[cert.id] && !loadingImages[cert.id] && !failedImages[cert.id]) {
        loadThumbnail(cert);
      }
    });
  }, [certificates, imageCache, loadingImages, failedImages, isImageFile, loadThumbnail]);

  const handleRequestCertificate = async () => {
    if (!selectedType || !documentFile || !certificateNumber.trim() || !issuedBy.trim()) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('certificate_type_id', String(selectedType));
      formData.append('certificate_number', certificateNumber);
      formData.append('issued_by', issuedBy);
      formData.append('document', documentFile);

      const data = await requestSupplierCertificate(formData);

      if (data.success) {
        toast.success('Заявка на сертификат отправлена');
        setShowRequestModal(false);
        setSelectedType(null);
        setDocumentFile(null);
        setCertificateNumber('');
        setIssuedBy('');
        fetchCertificates();
      } else {
        toast.error(data.message || 'Ошибка отправки заявки');
      }
    } catch {
      toast.error('Ошибка сервера');
    }
  };

  const openPreview = async (cert: Certificate) => {
    if (!isImageFile(cert)) {
      const documentPath = getDocumentPath(cert);

      if (documentPath) {
        const normalizedPath = documentPath
          .replace(/^server\//, '')
          .replace(/^\/+/, '');

        window.open(`http://localhost:5000/${normalizedPath}`, '_blank');
      } else {
        toast.error('Файл не найден');
      }
      return;
    }

    try {
      setLoadingImages((prev) => ({ ...prev, [cert.id]: true }));

      const cached = imageCache[cert.id];
      if (cached) {
        setSelectedImageData(cached);
        setSelectedCertName(cert.certificate_name);
        setShowImageModal(true);
        return;
      }

      const imageData = await loadImageAsDataUrl(cert.id, true);

      if (!imageData) {
        toast.error('Не удалось загрузить изображение');
        return;
      }

      setSelectedImageData(imageData);
      setSelectedCertName(cert.certificate_name);
      setShowImageModal(true);
    } catch {
      toast.error('Не удалось загрузить изображение');
    } finally {
      setLoadingImages((prev) => ({ ...prev, [cert.id]: false }));
    }
  };

  const handleDeleteCertificate = async (certificateId: number) => {
    try {
      setDeletingId(certificateId);

      const data = await deleteSupplierCertificate(certificateId);

      if (data.success) {
        toast.success('Сертификат удален');

        setImageCache((prev) => {
          const next = { ...prev };
          delete next[certificateId];
          return next;
        });

        setFailedImages((prev) => {
          const next = { ...prev };
          delete next[certificateId];
          return next;
        });

        fetchCertificates();
      } else {
        toast.error(data.message || 'Ошибка удаления сертификата');
      }
    } catch {
      toast.error('Ошибка сервера');
    } finally {
      setDeletingId(null);
    }
  };

  const getIconComponent = (iconName?: string, size: number = 18) => {
    switch ((iconName || '').toLowerCase()) {
      case 'leaf':
        return <Leaf size={size} style={{ color: ui.green }} />;
      case 'flower':
        return <Flower1 size={size} style={{ color: ui.purple }} />;
      case 'star':
        return <Star size={size} style={{ color: ui.gold }} />;
      case 'map':
        return <Map size={size} style={{ color: ui.blueGray }} />;
      case 'wallet':
        return <Wallet size={size} style={{ color: ui.greenDark }} />;
      default:
        return <Shield size={size} style={{ color: ui.green }} />;
    }
  };

  const grouped = useMemo(() => {
    return {
      active: certificates.filter((c) => c.status === 'approved' || c.status === 'active'),
      pending: certificates.filter((c) => c.status === 'pending'),
      rejected: certificates.filter((c) => c.status === 'rejected' || c.status === 'expired')
    };
  }, [certificates]);

  const renderStatus = (status: string) => {
    if (status === 'approved' || status === 'active') {
      return <span style={chip(ui.greenSoft, ui.greenDark)}><CheckCircle size={12} /> Активен</span>;
    }
    if (status === 'pending') {
      return <span style={chip(ui.goldSoft, ui.gold)}><Clock size={12} /> На проверке</span>;
    }
    return <span style={chip(ui.redSoft, ui.red)}><XCircle size={12} /> Отклонен</span>;
  };

  const Thumbnail: React.FC<{ cert: Certificate }> = ({ cert }) => {
    if (!isImageFile(cert)) {
      return (
        <div
          style={{
            width: 110,
            height: 128,
            borderRadius: 18,
            background: ui.greenSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {getIconComponent(cert.certificate_icon, 22)}
        </div>
      );
    }

    const imageSrc = imageCache[cert.id];
    const isLoading = loadingImages[cert.id];
    const isFailed = failedImages[cert.id];

    if (isLoading && !imageSrc) {
      return (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            border: `1px solid ${ui.border}`,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Spinner animation="border" size="sm" style={{ color: ui.green }} />
        </div>
      );
    }

    if (imageSrc) {
      return (
        <img
          src={imageSrc}
          alt={cert.certificate_name}
          style={{
            width: 360,
            height: 400,
            objectFit: 'cover',
            borderRadius: 16,
            border: `1px solid ${ui.border}`,
            background: '#fff',
            flexShrink: 0
          }}
          onError={() => {
            setImageCache((prev) => {
              const next = { ...prev };
              delete next[cert.id];
              return next;
            });
            setFailedImages((prev) => ({ ...prev, [cert.id]: true }));
          }}
        />
      );
    }

    if (isFailed) {
      return (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            background: ui.greenSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {getIconComponent(cert.certificate_icon, 22)}
        </div>
      );
    }

    return (
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          background: ui.greenSoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {getIconComponent(cert.certificate_icon, 22)}
      </div>
    );
  };

  const renderList = (list: Certificate[]) => {
    if (list.length === 0) {
      return (
        <Alert
          className="mb-0"
          style={{
            background: ui.blueGraySoft,
            color: ui.blueGray,
            border: `1px solid ${ui.border}`
          }}
        >
          В этой категории сертификатов пока нет
        </Alert>
      );
    }

    return (
      <Row className="g-4">
        {list.map((cert) => (
          <Col lg={6} key={cert.id}>
            <Card
              className="border-0 h-100"
              style={{
                borderRadius: 22,
                boxShadow: '0 14px 34px rgba(34,49,39,0.12), 0 3px 10px rgba(34,49,39,0.06)',
                border: `1px solid ${ui.border}`,
                background: '#fff'
              }}
            >
              <Card.Body className="d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div className="d-flex align-items-start gap-3">
                    <Thumbnail cert={cert} />

                    <div>
                      <div style={{ color: ui.text, fontWeight: 700 }}>
                        {cert.certificate_name}
                      </div>
                      <div className="small" style={{ color: ui.muted }}>
                        {cert.certificate_number}
                      </div>
                    </div>
                  </div>

                  {renderStatus(cert.status)}
                </div>

                <div className="mb-3" style={{ color: ui.text }}>
                  <div><strong>Выдан:</strong> {cert.issued_by || 'Не указано'}</div>
                  <div><strong>С:</strong> {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString('ru-RU') : 'Не указано'}</div>
                  <div><strong>До:</strong> {cert.expiry_date ? new Date(cert.expiry_date).toLocaleDateString('ru-RU') : 'Не указано'}</div>
                </div>

                {cert.verification_comment ? (
                  <div
                    className="mb-3"
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${ui.border}`,
                      background: '#faf9f7',
                      padding: '0.8rem 0.9rem',
                      color: ui.muted
                    }}
                  >
                    {cert.verification_comment}
                  </div>
                ) : null}

                <div className="mt-auto d-flex gap-2 flex-wrap">
                  <Button style={btnSoft()} onClick={() => openPreview(cert)}>
                    <Eye size={18} className="me-1" />
                    {isImageFile(cert) ? 'Просмотр' : isPdfFile(cert) ? 'Открыть PDF' : 'Открыть'}
                  </Button>

                  {getDocumentPath(cert) ? (
                    <Button
                      style={btnSoft()}
                      onClick={() => {
                        const documentPath = getDocumentPath(cert);
                        const normalizedPath = documentPath
                          .replace(/^server\//, '')
                          .replace(/^\/+/, '');

                        window.open(`http://localhost:5000/${normalizedPath}`, '_blank');
                      }}
                    >
                      <Download className="me-1" />
                      Скачать
                    </Button>
                  ) : null}

                  <Button
                    style={btnDangerSoft()}
                    onClick={() => handleDeleteCertificate(cert.id)}
                    disabled={deletingId === cert.id}
                  >
                    {deletingId === cert.id ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Удаление...
                      </>
                    ) : (
                      <>
                        <Trash className="me-1" />
                        Удалить
                      </>
                    )}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" style={{ color: ui.green }} />
        <p className="mt-3 mb-0" style={{ color: ui.muted }}>
          Загрузка сертификатов...
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
                <Shield className="me-2" style={{ color: ui.green }} />
                Сертификаты
              </h4>
              <div style={{ color: ui.muted }}>
                Запрашивайте, просматривайте и управляйте сертификатами поставщика
              </div>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <span style={chip(ui.greenSoft, ui.greenDark)}>
                Активных: {grouped.active.length}
              </span>
              <span style={chip(ui.goldSoft, ui.gold)}>
                На проверке: {grouped.pending.length}
              </span>
              <Button style={btnMain()} onClick={() => setShowRequestModal(true)}>
                <Plus className="me-1" />
                Запросить сертификат
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card
        className="border-0"
        style={{
          borderRadius: 24,
          boxShadow: '0 18px 42px rgba(34,49,39,0.14), 0 4px 14px rgba(34,49,39,0.08)',
          border: `1px solid ${ui.border}`,
          background: '#fff'
        }}
      >
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k || 'active')}
            className="supplier-subtabs mb-4"
          >
            <Tab eventKey="active" title="Активные">
              <div className="pt-2">{renderList(grouped.active)}</div>
            </Tab>
            <Tab eventKey="pending" title="На проверке">
              <div className="pt-2">{renderList(grouped.pending)}</div>
            </Tab>
            <Tab eventKey="rejected" title="Отклоненные / истекшие">
              <div className="pt-2">{renderList(grouped.rejected)}</div>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      <Modal show={showRequestModal} onHide={() => setShowRequestModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Запрос сертификата</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Тип сертификата *</Form.Label>
              <Form.Select
                value={selectedType || ''}
                onChange={(e) => setSelectedType(Number(e.target.value) || null)}
              >
                <option value="">Выберите тип</option>
                {certificateTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Номер сертификата *</Form.Label>
              <Form.Control
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                placeholder="Введите номер сертификата"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Кем выдан *</Form.Label>
              <Form.Control
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                placeholder="Название организации"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Документ-подтверждение *</Form.Label>
              <Form.Control
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (e.target.files && e.target.files[0]) {
                    setDocumentFile(e.target.files[0]);
                  }
                }}
              />
              <Form.Text className="text-muted">
                Загрузите скан или фото сертификата (JPG, PNG, WEBP, PDF, до 10 MB)
              </Form.Text>

              {documentFile ? (
                <div className="mt-2">
                  <span style={chip(ui.blueGraySoft, ui.blueGray)}>
                    <FileText className="me-1" size={12} />
                    {documentFile.name} ({(documentFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ) : null}
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button style={btnSoft()} onClick={() => setShowRequestModal(false)}>
            Отмена
          </Button>
          <Button style={btnMain()} onClick={handleRequestCertificate}>
            <Upload className="me-1" />
            Отправить заявку
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showImageModal}
        onHide={() => {
          setShowImageModal(false);
          setSelectedImageData(null);
        }}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <Eye className="me-2" />
            {selectedCertName}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="text-center">
          {!selectedImageData ? (
            <div className="text-center py-5">
              <Spinner animation="border" style={{ color: ui.green }} />
              <p className="mt-2">Загрузка изображения...</p>
            </div>
          ) : (
            <img
              src={selectedImageData}
              alt="Сертификат"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            style={btnSoft()}
            onClick={() => {
              setShowImageModal(false);
              setSelectedImageData(null);
            }}
          >
            Закрыть
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .supplier-subtabs.nav-tabs {
          border-bottom: none;
          gap: 10px;
          display: flex;
          flex-wrap: wrap;
        }

        .supplier-subtabs .nav-link {
          border: 1px solid ${ui.border};
          border-radius: 14px !important;
          color: ${ui.text};
          font-weight: 600;
          padding: 0.72rem 1rem;
          background: #fff;
        }

        .supplier-subtabs .nav-link.active {
          background: ${ui.green};
          color: white !important;
          border-color: ${ui.green};
          box-shadow: 0 8px 22px rgba(47, 107, 58, 0.16);
        }
      `}</style>
    </>
  );
};

export default CertificatesTab;