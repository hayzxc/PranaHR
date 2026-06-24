import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { documentsAPI, employeeAPI } from '../services/api';
import {
    FileText,
    Upload,
    Download,
    Search,
    Filter,
    X,
    Loader2,
    CheckCircle,
    AlertCircle,
    Clock,
    Trash2,
    Eye,
    Calendar,
    Shield,
    File,
    Image,
    FileSpreadsheet,
    Plus,
    AlertTriangle
} from 'lucide-react';

const Documents = () => {
    const { canManageEmployees, isAdmin } = useAuth();
    const { showToast } = useToast();
    const [documents, setDocuments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [filters, setFilters] = useState({
        category: '',
        verified: '',
        employee: '',
        search: ''
    });
    const [uploadForm, setUploadForm] = useState({
        employeeId: '',
        title: '',
        category: 'other',
        description: '',
        expiryDate: '',
        file: null
    });
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const categories = {
        contract: { label: 'Employment Contract', icon: FileText, color: 'blue' },
        id_card: { label: 'ID Card / KTP', icon: Shield, color: 'purple' },
        certificate: { label: 'Certificate', icon: CheckCircle, color: 'green' },
        resume: { label: 'Resume / CV', icon: File, color: 'indigo' },
        education: { label: 'Education Document', icon: FileText, color: 'yellow' },
        medical: { label: 'Medical Record', icon: AlertCircle, color: 'red' },
        tax: { label: 'Tax Document', icon: FileSpreadsheet, color: 'orange' },
        other: { label: 'Other', icon: File, color: 'gray' }
    };

    useEffect(() => {
        fetchData();
    }, [filters]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [docsRes, statsRes] = await Promise.all([
                documentsAPI.getAll(filters),
                documentsAPI.getStats()
            ]);
            setDocuments(docsRes.data.data || []);
            setStats(statsRes.data.data);

            if (canManageEmployees) {
                const empRes = await employeeAPI.getAll({ limit: 100, status: 'active' });
                setEmployees(empRes.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadForm.file || !uploadForm.employeeId || !uploadForm.title) {
            showToast('Please fill in all required fields', 'warning');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadForm.file);
            formData.append('employeeId', uploadForm.employeeId);
            formData.append('title', uploadForm.title);
            formData.append('category', uploadForm.category);
            formData.append('description', uploadForm.description);
            if (uploadForm.expiryDate) {
                formData.append('expiryDate', uploadForm.expiryDate);
            }

            await documentsAPI.upload(formData);
            setShowUploadModal(false);
            setUploadForm({
                employeeId: '',
                title: '',
                category: 'other',
                description: '',
                expiryDate: '',
                file: null
            });
            fetchData();
        } catch (error) {
            console.error('Upload error:', error);
            showToast(error.response?.data?.message || 'Error uploading document', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (doc) => {
        try {
            const response = await documentsAPI.download(doc._id);
            const blob = new Blob([response.data], { type: doc.mimetype });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.originalName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            showToast('Error downloading document', 'error');
        }
    };

    const handleVerify = async (id) => {
        try {
            await documentsAPI.verify(id);
            fetchData();
        } catch (error) {
            console.error('Verify error:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        try {
            await documentsAPI.delete(id);
            fetchData();
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const getFileIcon = (mimetype) => {
        if (mimetype?.startsWith('image/')) return Image;
        if (mimetype?.includes('pdf')) return FileText;
        if (mimetype?.includes('spreadsheet') || mimetype?.includes('excel')) return FileSpreadsheet;
        return File;
    };

    const getExpiryStatus = (doc) => {
        if (!doc.expiryDate) return null;
        const expiry = new Date(doc.expiryDate);
        const now = new Date();
        const daysUntil = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) return { status: 'expired', label: 'Expired', color: 'red' };
        if (daysUntil <= 30) return { status: 'expiring', label: `${daysUntil} days left`, color: 'yellow' };
        return { status: 'valid', label: formatDate(expiry), color: 'green' };
    };

    if (!canManageEmployees) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl text-gray-600">Access Denied</h2>
                <p className="text-gray-500">You don't have permission to access documents.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Documents</h1>
                    <p className="text-gray-500">Manage employee documents and files</p>
                </div>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <Upload className="w-4 h-4" />
                    Upload Document
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{stats?.total || 0}</p>
                            <p className="text-xs text-gray-500">Total Documents</p>
                        </div>
                    </div>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{stats?.verified || 0}</p>
                            <p className="text-xs text-gray-500">Verified</p>
                        </div>
                    </div>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{stats?.unverified || 0}</p>
                            <p className="text-xs text-gray-500">Pending</p>
                        </div>
                    </div>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{stats?.expiringSoon || 0}</p>
                            <p className="text-xs text-gray-500">Expiring Soon</p>
                        </div>
                    </div>
                </div>
                <div className="card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-800">{stats?.expired || 0}</p>
                            <p className="text-xs text-gray-500">Expired</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search documents..."
                                className="form-input pl-10"
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            />
                        </div>
                    </div>
                    <select
                        className="form-input"
                        value={filters.category}
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    >
                        <option value="">All Categories</option>
                        {Object.entries(categories).map(([key, { label }]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    <select
                        className="form-input"
                        value={filters.verified}
                        onChange={(e) => setFilters({ ...filters, verified: e.target.value })}
                    >
                        <option value="">All Status</option>
                        <option value="true">Verified</option>
                        <option value="false">Unverified</option>
                    </select>
                    <select
                        className="form-input"
                        value={filters.employee}
                        onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
                    >
                        <option value="">All Employees</option>
                        {employees.map(emp => (
                            <option key={emp._id} value={emp._id}>{emp.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Documents Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
            ) : documents.length === 0 ? (
                <div className="card p-12 text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600">No documents found</h3>
                    <p className="text-gray-500 mb-4">Upload your first document to get started</p>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="btn btn-primary"
                    >
                        Upload Document
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map(doc => {
                        const FileIcon = getFileIcon(doc.mimetype);
                        const categoryInfo = categories[doc.category] || categories.other;
                        const expiryStatus = getExpiryStatus(doc);

                        return (
                            <div key={doc._id} className="card p-4 hover:shadow-lg transition-shadow">
                                <div className="flex items-start gap-3">
                                    <div className={`w-12 h-12 rounded-xl bg-${categoryInfo.color}-100 flex items-center justify-center flex-shrink-0`}>
                                        <FileIcon className={`w-6 h-6 text-${categoryInfo.color}-600`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-800 truncate" title={doc.title}>
                                            {doc.title}
                                        </h3>
                                        <p className="text-sm text-gray-500 truncate">
                                            {doc.employee?.name} • {categoryInfo.label}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            {doc.isVerified ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-600">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-600">
                                                    <Clock className="w-3 h-3" />
                                                    Pending
                                                </span>
                                            )}
                                            {expiryStatus && (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${expiryStatus.color}-100 text-${expiryStatus.color}-600`}>
                                                    <Calendar className="w-3 h-3" />
                                                    {expiryStatus.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                                    <span className="text-xs text-gray-400">
                                        {formatFileSize(doc.filesize)} • {formatDate(doc.createdAt)}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {!doc.isVerified && isAdmin && (
                                            <button
                                                onClick={() => handleVerify(doc._id)}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                                                title="Verify Document"
                                            >
                                                <Shield className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setSelectedDocument(doc);
                                                setShowPreviewModal(true);
                                            }}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                            title="View Details"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDownload(doc)}
                                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(doc._id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg animate-fade-in">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">Upload Document</h2>
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpload} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Employee *
                                </label>
                                <select
                                    className="form-input"
                                    value={uploadForm.employeeId}
                                    onChange={(e) => setUploadForm({ ...uploadForm, employeeId: e.target.value })}
                                    required
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map(emp => (
                                        <option key={emp._id} value={emp._id}>{emp.name} ({emp.employeeId})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Document Title *
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., Employment Contract 2024"
                                    value={uploadForm.title}
                                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category
                                    </label>
                                    <select
                                        className="form-input"
                                        value={uploadForm.category}
                                        onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                                    >
                                        {Object.entries(categories).map(([key, { label }]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Expiry Date
                                    </label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={uploadForm.expiryDate}
                                        onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    className="form-input"
                                    rows={2}
                                    placeholder="Optional description..."
                                    value={uploadForm.description}
                                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    File *
                                </label>
                                <div
                                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${uploadForm.file ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
                                        }`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploadForm.file ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <FileText className="w-6 h-6 text-primary-600" />
                                            <span className="font-medium text-primary-600">{uploadForm.file.name}</span>
                                            <span className="text-sm text-gray-500">({formatFileSize(uploadForm.file.size)})</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                            <p className="text-gray-600">Click to select file</p>
                                            <p className="text-xs text-gray-400 mt-1">PDF, Images, Word, Excel (max 10MB)</p>
                                        </>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                                    onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowUploadModal(false)}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Upload
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreviewModal && selectedDocument && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">Document Details</h2>
                            <button
                                onClick={() => {
                                    setShowPreviewModal(false);
                                    setSelectedDocument(null);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-start gap-4">
                                <div className={`w-16 h-16 rounded-xl bg-${categories[selectedDocument.category]?.color || 'gray'}-100 flex items-center justify-center`}>
                                    {(() => {
                                        const FileIcon = getFileIcon(selectedDocument.mimetype);
                                        return <FileIcon className={`w-8 h-8 text-${categories[selectedDocument.category]?.color || 'gray'}-600`} />;
                                    })()}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-800">{selectedDocument.title}</h3>
                                    <p className="text-gray-500">{selectedDocument.originalName}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        {selectedDocument.isVerified ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
                                                <CheckCircle className="w-3 h-3" />
                                                Verified by {selectedDocument.verifiedBy?.email}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-600">
                                                <Clock className="w-3 h-3" />
                                                Pending Verification
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 mb-1">Employee</p>
                                    <p className="font-medium">{selectedDocument.employee?.name}</p>
                                    <p className="text-sm text-gray-500">{selectedDocument.employee?.employeeId}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 mb-1">Category</p>
                                    <p className="font-medium">{categories[selectedDocument.category]?.label || 'Other'}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 mb-1">File Size</p>
                                    <p className="font-medium">{formatFileSize(selectedDocument.filesize)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 mb-1">Uploaded</p>
                                    <p className="font-medium">{formatDate(selectedDocument.createdAt)}</p>
                                </div>
                                {selectedDocument.expiryDate && (
                                    <div className="bg-gray-50 rounded-xl p-4 col-span-2">
                                        <p className="text-xs text-gray-500 mb-1">Expiry Date</p>
                                        <p className="font-medium">{formatDate(selectedDocument.expiryDate)}</p>
                                    </div>
                                )}
                            </div>

                            {selectedDocument.description && (
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 mb-1">Description</p>
                                    <p className="text-gray-700">{selectedDocument.description}</p>
                                </div>
                            )}

                            <div className="flex gap-3">
                                {!selectedDocument.isVerified && isAdmin && (
                                    <button
                                        onClick={() => {
                                            handleVerify(selectedDocument._id);
                                            setShowPreviewModal(false);
                                        }}
                                        className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                                    >
                                        <Shield className="w-4 h-4" />
                                        Verify Document
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDownload(selectedDocument)}
                                    className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Download
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Documents;
