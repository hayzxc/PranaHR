import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { settingsAPI } from '../services/api';
import {
    Building2,
    Clock,
    Calendar,
    DollarSign,
    Bell,
    Save,
    Plus,
    Trash2,
    Loader2
} from 'lucide-react';

const Settings = () => {
    const { isAdmin } = useAuth();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('company');
    const [newHoliday, setNewHoliday] = useState({ name: '', date: '' });
    const [newDepartment, setNewDepartment] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data } = await settingsAPI.get();
            setSettings(data.data);
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data } = await settingsAPI.update(settings);
            setSettings(data.data);
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    const handleAddHoliday = async () => {
        if (!newHoliday.name || !newHoliday.date) return;
        try {
            const { data } = await settingsAPI.addHoliday(newHoliday);
            setSettings(data.data);
            setNewHoliday({ name: '', date: '' });
        } catch (error) {
            console.error('Error adding holiday:', error);
        }
    };

    const handleRemoveHoliday = async (id) => {
        try {
            const { data } = await settingsAPI.removeHoliday(id);
            setSettings(data.data);
        } catch (error) {
            console.error('Error removing holiday:', error);
        }
    };

    const handleAddDepartment = async () => {
        if (!newDepartment.trim()) return;
        try {
            const { data } = await settingsAPI.addDepartment(newDepartment);
            setSettings(data.data);
            setNewDepartment('');
        } catch (error) {
            console.error('Error adding department:', error);
        }
    };

    const handleRemoveDepartment = async (name) => {
        if (!confirm(`Remove department "${name}"?`)) return;
        try {
            const { data } = await settingsAPI.removeDepartment(name);
            setSettings(data.data);
        } catch (error) {
            console.error('Error removing department:', error);
        }
    };

    const updateSetting = (path, value) => {
        const parts = path.split('.');
        setSettings(prev => {
            const newSettings = { ...prev };
            let current = newSettings;
            for (let i = 0; i < parts.length - 1; i++) {
                current[parts[i]] = { ...current[parts[i]] };
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = value;
            return newSettings;
        });
    };

    if (!isAdmin) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl text-gray-600">Access Denied</h2>
                <p className="text-gray-500">Only administrators can access settings.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    const tabs = [
        { id: 'company', label: 'Company', icon: Building2 },
        { id: 'schedule', label: 'Work Schedule', icon: Clock },
        { id: 'leave', label: 'Leave Policy', icon: Calendar },
        { id: 'payroll', label: 'Payroll', icon: DollarSign },
        { id: 'notifications', label: 'Notifications', icon: Bell },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
                    <p className="text-gray-500">Configure your organization settings</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary flex items-center gap-2"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="card p-6">
                {activeTab === 'company' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold">Company Information</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="form-label">Company Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={settings?.companyName || ''}
                                    onChange={(e) => updateSetting('companyName', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <h4 className="font-medium mb-3">Departments</h4>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {settings?.departments?.map(dept => (
                                    <span key={dept} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                                        {dept}
                                        <button
                                            onClick={() => handleRemoveDepartment(dept)}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="New department"
                                    className="form-input flex-1"
                                    value={newDepartment}
                                    onChange={(e) => setNewDepartment(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddDepartment()}
                                />
                                <button onClick={handleAddDepartment} className="btn btn-secondary">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-medium mb-3">Holidays</h4>
                            <div className="space-y-2 mb-3">
                                {settings?.holidays?.map(holiday => (
                                    <div key={holiday._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <span className="font-medium">{holiday.name}</span>
                                            <span className="text-gray-500 ml-2">
                                                {new Date(holiday.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveHoliday(holiday._id)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Holiday name"
                                    className="form-input flex-1"
                                    value={newHoliday.name}
                                    onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                                />
                                <input
                                    type="date"
                                    className="form-input"
                                    value={newHoliday.date}
                                    onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                                />
                                <button onClick={handleAddHoliday} className="btn btn-secondary">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'schedule' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold">Work Schedule</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="form-label">Work Start Time</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={settings?.workSchedule?.workStartTime || '09:00'}
                                    onChange={(e) => updateSetting('workSchedule.workStartTime', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form-label">Work End Time</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={settings?.workSchedule?.workEndTime || '17:00'}
                                    onChange={(e) => updateSetting('workSchedule.workEndTime', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form-label">Break Duration (minutes)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={settings?.workSchedule?.breakDuration || 60}
                                    onChange={(e) => updateSetting('workSchedule.breakDuration', parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Work Days</label>
                            <div className="flex flex-wrap gap-2">
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                    <label key={day} className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={settings?.workSchedule?.workDays?.includes(day)}
                                            onChange={(e) => {
                                                const days = settings?.workSchedule?.workDays || [];
                                                if (e.target.checked) {
                                                    updateSetting('workSchedule.workDays', [...days, day]);
                                                } else {
                                                    updateSetting('workSchedule.workDays', days.filter(d => d !== day));
                                                }
                                            }}
                                            className="rounded"
                                        />
                                        {day}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'leave' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold">Leave Policy</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="form-label">Annual Leave Quota (days)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={settings?.leavePolicy?.annualLeaveQuota || 12}
                                    onChange={(e) => updateSetting('leavePolicy.annualLeaveQuota', parseInt(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="form-label">Sick Leave Quota (days)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={settings?.leavePolicy?.sickLeaveQuota || 12}
                                    onChange={(e) => updateSetting('leavePolicy.sickLeaveQuota', parseInt(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="form-label">Carry Over Limit (days)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={settings?.leavePolicy?.carryOverLimit || 5}
                                    onChange={(e) => updateSetting('leavePolicy.carryOverLimit', parseInt(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'payroll' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold">Payroll Settings</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="form-label">Pay Day (day of month)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="31"
                                    className="form-input"
                                    value={settings?.payrollSettings?.payDay || 25}
                                    onChange={(e) => updateSetting('payrollSettings.payDay', parseInt(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="form-label">Currency</label>
                                <select
                                    className="form-input"
                                    value={settings?.payrollSettings?.currency || 'IDR'}
                                    onChange={(e) => updateSetting('payrollSettings.currency', e.target.value)}
                                >
                                    <option value="IDR">IDR - Indonesian Rupiah</option>
                                    <option value="USD">USD - US Dollar</option>
                                    <option value="EUR">EUR - Euro</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Default Tax Rate (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="form-input"
                                    value={settings?.payrollSettings?.taxRate || 0}
                                    onChange={(e) => updateSetting('payrollSettings.taxRate', parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold">Notification Settings</h3>

                        <div className="space-y-4">
                            {[
                                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Send email notifications for important events' },
                                { key: 'leaveApprovalReminders', label: 'Leave Approval Reminders', desc: 'Remind managers about pending leave requests' },
                                { key: 'birthdayReminders', label: 'Birthday Reminders', desc: 'Send birthday reminders for team members' },
                                { key: 'payrollReminders', label: 'Payroll Reminders', desc: 'Remind about payroll processing deadlines' },
                            ].map(item => (
                                <label key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                                    <div>
                                        <p className="font-medium">{item.label}</p>
                                        <p className="text-sm text-gray-500">{item.desc}</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={settings?.notifications?.[item.key] ?? true}
                                        onChange={(e) => updateSetting(`notifications.${item.key}`, e.target.checked)}
                                        className="w-5 h-5 rounded text-primary-500"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
