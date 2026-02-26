import React, { useEffect, useState, FormEvent } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { KYCDocument } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const DOC_TYPES = [
  { value: 'passport',     label: '🛂 Passport' },
  { value: 'national_id',  label: '🪪 National ID' },
  { value: 'drivers_license', label: '🚗 Driver\'s License' },
  { value: 'utility_bill', label: '🏠 Utility Bill' },
  { value: 'bank_statement', label: '🏦 Bank Statement' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function docStatusBadge(status: string) {
  if (status === 'verified') return 'badge badge-success';
  if (status === 'rejected') return 'badge badge-danger';
  return 'badge badge-warning';
}

const KYC: React.FC = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload form
  const [docType, setDocType] = useState('passport');
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDocuments = async () => {
    try {
      const res = await apiClient.get<KYCDocument[]>('/kyc/documents');
      setDocuments(res.data);
    } catch {
      setError('Failed to load KYC documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    setUploadMsg(null);
    if (!fileUrl.trim()) { setUploadMsg({ type: 'error', text: 'Please enter a document URL.' }); return; }
    setUploading(true);
    try {
      await apiClient.post('/kyc/documents', { doc_type: docType, file_url: fileUrl });
      setUploadMsg({ type: 'success', text: 'Document submitted for verification!' });
      setFileUrl('');
      await fetchDocuments();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Upload failed.';
      setUploadMsg({ type: 'error', text: msg });
    } finally {
      setUploading(false);
    }
  };

  const kycStatus = user?.kyc_status ?? 'pending';

  const steps = [
    {
      title: 'Account Created',
      desc: 'Your account has been created successfully.',
      icon: '✅',
      iconClass: 'done',
    },
    {
      title: 'Submit Documents',
      desc: 'Upload a government-issued ID and proof of address.',
      icon: documents.length > 0 ? '✅' : '📋',
      iconClass: documents.length > 0 ? 'done' : 'todo',
    },
    {
      title: 'Document Review',
      desc: 'Our compliance team reviews your documents (1-2 business days).',
      icon: kycStatus === 'pending' && documents.length > 0 ? '⏳' : kycStatus === 'verified' ? '✅' : '📋',
      iconClass: kycStatus === 'pending' && documents.length > 0 ? 'pending' : kycStatus === 'verified' ? 'done' : 'todo',
    },
    {
      title: 'Verification Complete',
      desc: 'Full platform access unlocked after KYC approval.',
      icon: kycStatus === 'verified' ? '✅' : '🔒',
      iconClass: kycStatus === 'verified' ? 'done' : 'todo',
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>KYC Verification</h1>
          <p>Complete identity verification to unlock full platform access</p>
        </div>
        <span className={`kyc-status-badge ${kycStatus}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
          {kycStatus === 'verified' ? '✅ Verified' : kycStatus === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
        </span>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {kycStatus === 'rejected' && (
        <div className="alert alert-danger">
          ❌ Your KYC was rejected. Please re-submit your documents with clear, valid images.
        </div>
      )}

      {kycStatus === 'verified' && (
        <div className="alert alert-success">
          ✅ Your identity is fully verified! You have access to all platform features.
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Verification progress */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Verification Progress</div>
          </div>
          {steps.map((step, i) => (
            <div key={i} className="kyc-step">
              <div className={`kyc-step-icon ${step.iconClass}`}>{step.icon}</div>
              <div className="kyc-step-body">
                <div className="kyc-step-title">{step.title}</div>
                <div className="kyc-step-desc">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Upload form */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Upload Document</div>
          </div>

          {uploadMsg && (
            <div className={`alert alert-${uploadMsg.type === 'success' ? 'success' : 'danger'}`}>
              {uploadMsg.text}
            </div>
          )}

          <form onSubmit={handleUpload}>
            <div className="form-group">
              <label className="form-label">Document Type</label>
              <select
                className="form-control"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Document URL</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://storage.example.com/doc.pdf"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
              <p className="form-hint">
                Upload your document to a cloud storage service and paste the URL here.
              </p>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={uploading}>
              {uploading ? <LoadingSpinner size="sm" /> : '📤 Submit Document'}
            </button>
          </form>

          <div className="alert alert-info" style={{ marginTop: '16px' }}>
            ℹ️ Accepted formats: PDF, JPG, PNG. Max size: 10MB. Documents must be clear and unobstructed.
          </div>
        </div>
      </div>

      {/* Documents list */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Submitted Documents</div>
            <div className="card-subtitle">{documents.length} document(s) uploaded</div>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Document Type</th>
                <th>Status</th>
                <th>File URL</th>
                <th>Verified At</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No documents submitted yet. Upload your first document above.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const typeLabel = DOC_TYPES.find((d) => d.value === doc.doc_type)?.label ?? doc.doc_type;
                  return (
                    <tr key={doc.kyc_document_id}>
                      <td style={{ fontWeight: 600 }}>{typeLabel}</td>
                      <td><span className={docStatusBadge(doc.status)}>{doc.status}</span></td>
                      <td>
                        {doc.file_url ? (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '12px', color: 'var(--color-primary)' }}>
                            View Document 🔗
                          </a>
                        ) : (
                          <span style={{ color: 'var(--color-text-light)' }}>—</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                        {doc.verified_at ? formatDate(doc.verified_at) : '—'}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                        {formatDate(doc.kyc_document_id)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Requirements info */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="card-header">
          <div className="card-title">📋 KYC Requirements</div>
        </div>
        <div className="grid-2">
          <div>
            <p style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Required Documents</p>
            {['Government-issued photo ID (Passport or National ID)', 'Proof of address (Utility bill or Bank statement — dated within 3 months)'].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-success)', marginTop: '1px' }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Document Guidelines</p>
            {[
              'All documents must be in English or accompanied by a certified translation',
              'Documents must be clearly legible — all corners visible',
              'No black-and-white photocopies',
              'No expired documents',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-warning)', marginTop: '1px' }}>•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default KYC;
