import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { recruitingAPI, employeeAPI } from '../services/api';
import {
    UserPlus,
    Briefcase,
    Users,
    Plus,
    Search,
    Filter,
    ChevronRight,
    Loader2,
    MapPin,
    Clock,
    DollarSign,
    Edit,
    Trash2,
    Eye,
    Calendar,
    Star,
    Mail,
    Phone,
    FileText
} from 'lucide-react';

const Recruiting = () => {
    const { canManageEmployees, isAdmin } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('jobs');
    const [jobs, setJobs] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showJobModal, setShowJobModal] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [jobForm, setJobForm] = useState({
        title: '',
        department: '',
        location: 'On-site',
        type: 'full-time',
        level: 'mid',
        description: '',
        requirements: [],
        salary: { min: 0, max: 0, isVisible: false }
    });

    useEffect(() => {
        fetchData();
    }, [activeTab, selectedJob]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'jobs') {
                const { data } = await recruitingAPI.getJobs({ limit: 50 });
                setJobs(data.data || []);
            } else if (selectedJob) {
                const { data } = await recruitingAPI.getCandidates(selectedJob._id, { limit: 50 });
                setCandidates(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateJob = async (e) => {
        e.preventDefault();
        try {
            await recruitingAPI.createJob(jobForm);
            setShowJobModal(false);
            setJobForm({
                title: '',
                department: '',
                location: 'On-site',
                type: 'full-time',
                level: 'mid',
                description: '',
                requirements: [],
                salary: { min: 0, max: 0, isVisible: false }
            });
            fetchData();
        } catch (error) {
            console.error('Error creating job:', error);
            showToast('Error creating job', 'error');
        }
    };

    const handleUpdateJobStatus = async (jobId, status) => {
        try {
            await recruitingAPI.updateJob(jobId, { status });
            fetchData();
        } catch (error) {
            console.error('Error updating job:', error);
        }
    };

    const handleDeleteJob = async (jobId) => {
        if (!confirm('Delete this job posting and all associated candidates?')) return;
        try {
            await recruitingAPI.deleteJob(jobId);
            fetchData();
        } catch (error) {
            console.error('Error deleting job:', error);
        }
    };

    const handleUpdateCandidateStage = async (candidateId, stage) => {
        try {
            await recruitingAPI.updateCandidateStage(candidateId, stage);
            fetchData();
            if (selectedCandidate?._id === candidateId) {
                const { data } = await recruitingAPI.getCandidate(candidateId);
                setSelectedCandidate(data.data);
            }
        } catch (error) {
            console.error('Error updating candidate:', error);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            draft: 'bg-gray-100 text-gray-600',
            open: 'bg-green-100 text-green-600',
            paused: 'bg-yellow-100 text-yellow-600',
            closed: 'bg-red-100 text-red-600',
            filled: 'bg-blue-100 text-blue-600'
        };
        return styles[status] || styles.draft;
    };

    const getStageBadge = (stage) => {
        const styles = {
            applied: 'bg-gray-100 text-gray-600',
            screening: 'bg-blue-100 text-blue-600',
            interview: 'bg-purple-100 text-purple-600',
            assessment: 'bg-yellow-100 text-yellow-600',
            offer: 'bg-green-100 text-green-600',
            hired: 'bg-emerald-100 text-emerald-600',
            rejected: 'bg-red-100 text-red-600',
            withdrawn: 'bg-gray-100 text-gray-600'
        };
        return styles[stage] || styles.applied;
    };

    const stages = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired'];

    if (!canManageEmployees) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl text-gray-600">Access Denied</h2>
                <p className="text-gray-500">You don't have permission to access recruiting.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Recruiting</h1>
                    <p className="text-gray-500">Manage job postings and candidates</p>
                </div>
                <button
                    onClick={() => setShowJobModal(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Post New Job
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    <button
                        onClick={() => {
                            setActiveTab('jobs');
                            setSelectedJob(null);
                        }}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'jobs'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Briefcase className="w-4 h-4" />
                        Job Postings
                    </button>
                    <button
                        onClick={() => setActiveTab('candidates')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'candidates'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        Candidates {selectedJob && `(${selectedJob.title})`}
                    </button>
                </nav>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
            ) : (
                <>
                    {/* Jobs Tab */}
                    {activeTab === 'jobs' && (
                        <div className="space-y-4">
                            {jobs.length === 0 ? (
                                <div className="card p-12 text-center">
                                    <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600">No job postings</h3>
                                    <p className="text-gray-500 mb-4">Create your first job posting</p>
                                    <button
                                        onClick={() => setShowJobModal(true)}
                                        className="btn btn-primary"
                                    >
                                        Post New Job
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {jobs.map(job => (
                                        <div key={job._id} className="card p-6 hover:shadow-lg transition-shadow">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="text-lg font-semibold text-gray-800">{job.title}</h3>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(job.status)}`}>
                                                            {job.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <Briefcase className="w-4 h-4" />
                                                            {job.department}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="w-4 h-4" />
                                                            {job.location}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-4 h-4" />
                                                            {job.type}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Users className="w-4 h-4" />
                                                            {job.applicantCount || 0} applicants
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedJob(job);
                                                            setActiveTab('candidates');
                                                        }}
                                                        className="btn btn-secondary text-sm"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        View Candidates
                                                    </button>
                                                    {job.status === 'draft' && (
                                                        <button
                                                            onClick={() => handleUpdateJobStatus(job._id, 'open')}
                                                            className="btn btn-primary text-sm"
                                                        >
                                                            Publish
                                                        </button>
                                                    )}
                                                    {job.status === 'open' && (
                                                        <button
                                                            onClick={() => handleUpdateJobStatus(job._id, 'closed')}
                                                            className="btn btn-secondary text-sm"
                                                        >
                                                            Close
                                                        </button>
                                                    )}
                                                    {isAdmin && (
                                                        <button
                                                            onClick={() => handleDeleteJob(job._id)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Candidates Tab */}
                    {activeTab === 'candidates' && (
                        <div className="space-y-4">
                            {!selectedJob ? (
                                <div className="card p-12 text-center">
                                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600">Select a job</h3>
                                    <p className="text-gray-500">Choose a job posting to view its candidates</p>
                                    <button
                                        onClick={() => setActiveTab('jobs')}
                                        className="btn btn-primary mt-4"
                                    >
                                        View Jobs
                                    </button>
                                </div>
                            ) : candidates.length === 0 ? (
                                <div className="card p-12 text-center">
                                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600">No candidates yet</h3>
                                    <p className="text-gray-500">Candidates will appear here when they apply</p>
                                </div>
                            ) : (
                                <>
                                    {/* Pipeline view */}
                                    <div className="grid grid-cols-6 gap-4 overflow-x-auto">
                                        {stages.map(stage => (
                                            <div key={stage} className="min-w-[200px]">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="font-medium capitalize">{stage}</h4>
                                                    <span className="text-sm text-gray-500">
                                                        {candidates.filter(c => c.stage === stage).length}
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {candidates.filter(c => c.stage === stage).map(candidate => (
                                                        <div
                                                            key={candidate._id}
                                                            onClick={() => setSelectedCandidate(candidate)}
                                                            className="card p-3 hover:shadow-md cursor-pointer transition-shadow"
                                                        >
                                                            <p className="font-medium text-sm">
                                                                {candidate.firstName} {candidate.lastName}
                                                            </p>
                                                            <p className="text-xs text-gray-500 truncate">
                                                                {candidate.email}
                                                            </p>
                                                            {candidate.rating && (
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    {[1, 2, 3, 4, 5].map(s => (
                                                                        <Star
                                                                            key={s}
                                                                            className={`w-3 h-3 ${s <= candidate.rating
                                                                                ? 'text-yellow-400 fill-yellow-400'
                                                                                : 'text-gray-300'
                                                                                }`}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Job Modal */}
            {showJobModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
                        <div className="p-6 border-b">
                            <h2 className="text-xl font-bold">Post New Job</h2>
                        </div>
                        <form onSubmit={handleCreateJob} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Job Title</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={jobForm.title}
                                        onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Department</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={jobForm.department}
                                        onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="form-label">Location</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={jobForm.location}
                                        onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Type</label>
                                    <select
                                        className="form-input"
                                        value={jobForm.type}
                                        onChange={(e) => setJobForm({ ...jobForm, type: e.target.value })}
                                    >
                                        <option value="full-time">Full-time</option>
                                        <option value="part-time">Part-time</option>
                                        <option value="contract">Contract</option>
                                        <option value="internship">Internship</option>
                                        <option value="remote">Remote</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Level</label>
                                    <select
                                        className="form-input"
                                        value={jobForm.level}
                                        onChange={(e) => setJobForm({ ...jobForm, level: e.target.value })}
                                    >
                                        <option value="entry">Entry</option>
                                        <option value="junior">Junior</option>
                                        <option value="mid">Mid</option>
                                        <option value="senior">Senior</option>
                                        <option value="lead">Lead</option>
                                        <option value="manager">Manager</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-input"
                                    rows="4"
                                    value={jobForm.description}
                                    onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowJobModal(false)}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1">
                                    Create Job
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Candidate Detail Modal */}
            {selectedCandidate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
                        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
                            <div>
                                <h2 className="text-xl font-bold">
                                    {selectedCandidate.firstName} {selectedCandidate.lastName}
                                </h2>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStageBadge(selectedCandidate.stage)}`}>
                                    {selectedCandidate.stage}
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedCandidate(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Contact Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Mail className="w-4 h-4" />
                                    {selectedCandidate.email}
                                </div>
                                {selectedCandidate.phone && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Phone className="w-4 h-4" />
                                        {selectedCandidate.phone}
                                    </div>
                                )}
                            </div>

                            {/* Experience */}
                            {selectedCandidate.experience && (
                                <div>
                                    <h4 className="font-medium mb-2">Experience</h4>
                                    <p className="text-gray-600">
                                        {selectedCandidate.experience.years} years • {selectedCandidate.experience.summary}
                                    </p>
                                </div>
                            )}

                            {/* Education */}
                            {selectedCandidate.education && (
                                <div>
                                    <h4 className="font-medium mb-2">Education</h4>
                                    <p className="text-gray-600">
                                        {selectedCandidate.education.degree} - {selectedCandidate.education.institution}
                                    </p>
                                </div>
                            )}

                            {/* Stage Actions */}
                            <div>
                                <h4 className="font-medium mb-3">Move to Stage</h4>
                                <div className="flex flex-wrap gap-2">
                                    {stages.map(stage => (
                                        <button
                                            key={stage}
                                            onClick={() => handleUpdateCandidateStage(selectedCandidate._id, stage)}
                                            className={`px-3 py-1 rounded-lg text-sm capitalize transition-colors ${selectedCandidate.stage === stage
                                                ? 'bg-primary-500 text-white'
                                                : 'bg-gray-100 hover:bg-gray-200'
                                                }`}
                                        >
                                            {stage}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => handleUpdateCandidateStage(selectedCandidate._id, 'rejected')}
                                        className="px-3 py-1 rounded-lg text-sm bg-red-100 text-red-600 hover:bg-red-200"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>

                            {/* Interviews */}
                            {selectedCandidate.interviews?.length > 0 && (
                                <div>
                                    <h4 className="font-medium mb-2">Interviews</h4>
                                    <div className="space-y-2">
                                        {selectedCandidate.interviews.map((interview, idx) => (
                                            <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <span className="capitalize font-medium">{interview.type}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs ${interview.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                                                        }`}>
                                                        {interview.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500">
                                                    {new Date(interview.scheduledAt).toLocaleString()}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Recruiting;
