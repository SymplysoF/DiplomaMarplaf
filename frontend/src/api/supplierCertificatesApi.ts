const API_BASE_URL = 'http://localhost:5000';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`
});

export async function getSupplierCertificates() {
  const res = await fetch(`${API_BASE_URL}/api/supplier/certificates`, {
    headers: authHeaders()
  });
  return res.json();
}

export async function getCertificateTypes() {
  const res = await fetch(`${API_BASE_URL}/api/certificate/types`, {
    headers: authHeaders()
  });
  return res.json();
}

export async function requestSupplierCertificate(formData: FormData) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/certificates/request`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('userToken') || ''}`
    },
    body: formData
  });
  return res.json();
}

export async function deleteSupplierCertificate(certificateId: number) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/certificates/${certificateId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return res.json();
}

export async function getSupplierCertificatePreview(certificateId: number) {
  const res = await fetch(`${API_BASE_URL}/api/supplier/certificates/${certificateId}/preview`, {
    headers: authHeaders()
  });
  return res;
}