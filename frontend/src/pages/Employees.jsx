import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { employeeAPI } from '../services/api';
import {
    Users,
    Search,
    Plus,
    Edit2,
    Trash2,
    X,
    Mail,
    Phone,
    Building2,
    DollarSign
} from 'lucide-react';

const Employees = () => {
    const { showToast } = useToast();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [department, setDepartment] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        department: 'Sertifikasi',
        position: '',
        salary: '',
        managerId: '',
        password: 'password123'
    });

    const departments = ['Sertifikasi', 'Finance', 'Admin/CS', 'Verifikasi', 'Teknis dan IT'];

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchEmployees();
        }, 300);
        return () => clearTimeout(timeout);
    }, [search, department]);

    const fetchEmployees = async () => {
        try {
            const params = {};
            if (search) params.search = search;
            if (department) params.department = department;

            const response = await employeeAPI.getAll(params);
            setEmployees(response.data.data);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingEmployee) {
                await employeeAPI.update(editingEmployee.id, formData);
            } else {
                await employeeAPI.create(formData);
            }
            setShowModal(false);
            resetForm();
            fetchEmployees();
        } catch (error) {
            showToast(error.response?.data?.message || 'Error saving employee', 'error');
        }
    };

    const handleEdit = (emp) => {
        setEditingEmployee(emp);
        setFormData({
            name: emp.name,
            email: emp.email,
            phone: emp.phone || '',
            department: emp.department,
            position: emp.position,
            salary: emp.salary,
            managerId: emp.manager?.id || '',
            password: ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to terminate this employee?')) {
            try {
                await employeeAPI.delete(id);
                fetchEmployees();
            } catch (error) {
                showToast(error.response?.data?.message || 'Error deleting employee', 'error');
            }
        }
    };

    const resetForm = () => {
        setEditingEmployee(null);
        setFormData({
            name: '',
            email: '',
            phone: '',
            department: 'Sertifikasi',
            position: '',
            salary: '',
            managerId: '',
            password: 'password123'
        });
    };

    const openAddModal = () => {
        resetForm();
        setShowModal(true);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Employee Management</h1>
                    <p className="text-gray-500">Manage your organization's employees</p>
                </div>
                <button onClick={openAddModal} className="btn btn-primary flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add Employee
                </button>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or ID..."
                            className="input pl-12"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="input w-full md:w-48"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                    >
                        <option value="">All Departments</option>
                        {departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Employee Table */}
            <div className="card overflow-hidden p-0">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                    </div>
                ) : employees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Users className="w-12 h-12 mb-2 text-gray-300" />
                        <p>No employees found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="table-header">Employee</th>
                                    <th className="table-header">Department</th>
                                    <th className="table-header">Position</th>
                                    <th className="table-header">Status</th>
                                    <th className="table-header">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((emp) => (
                                    <tr key={emp.id} className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="table-cell">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                                                    <span className="text-primary-600 font-semibold">
                                                        {emp.name?.[0]?.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-800">{emp.name}</p>
                                                    <p className="text-sm text-gray-500">{emp.employeeId}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-cell">{emp.department}</td>
                                        <td className="table-cell">{emp.position}</td>
                                        <td className="table-cell">
                                            <span className={`badge ${emp.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                                                {emp.status}
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(emp)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(emp.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="label">Full Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        className="input pl-12"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                        disabled={editingEmployee}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Phone</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="tel"
                                        className="input pl-12"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Department</label>
                                    <select
                                        className="input"
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    >
                                        {departments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="label">Position</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={formData.position}
                                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Salary</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="number"
                                        className="input pl-12"
                                        value={formData.salary}
                                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Reports To (Manager)</label>
                                <select
                                    className="input"
                                    value={formData.managerId}
                                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                                >
                                    <option value="">No Manager (Top Level)</option>
                                    {employees
                                        .filter(emp => !editingEmployee || emp.id !== editingEmployee.id)
                                        .map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
                                    ))}
                                </select>
                            </div>

                            {!editingEmployee && (
                                <div>
                                    <label className="label">Initial Password</label>
                                    <input
                                        type="password"
                                        className="input"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Employee will use this to login</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline flex-1">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1">
                                    {editingEmployee ? 'Save Changes' : 'Add Employee'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Employees;
