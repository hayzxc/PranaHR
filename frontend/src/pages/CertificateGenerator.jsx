import { useState, useRef, useCallback, useEffect } from 'react';
import { certificateAPI } from '../services/api';
import {
    FileText,
    Download,
    Loader2,
    ClipboardList,
    MapPin,
    Thermometer,
    User,
    Calendar,
    Package,
    Ship,
    Hash,
    AlertCircle,
    PenTool,
    Undo2,
    Eraser,
} from 'lucide-react';

const INITIAL_FORM = {
    dateIssued: '',
    certificateNumber: '',
    treatmentNumber: '',
    consignmentLink: '',
    sealNumber: '',
    clientName: '',
    clientAddress: '',
    commodityDescription: '',
    commodityCountryOfOrigin: '',
    commodityQuantity: '',
    portOfLoading: '',
    destinationCountry: '',
    // Target of fumigation (multi-select)
    targetCommodity: false,
    targetContainer: false,
    targetPackaging: false,
    targetOther: false,
    targetOtherDetails: '',
    // Enclosure type (single-select)
    enclosureType: '',
    enclosureOtherDetails: '',
    // Treatment schedule
    dose: '',
    period: '',
    temperature: '',
    // Fumigation details
    appliedDose: '',
    period2: '',
    temperature2: '',
    placeOfFumigation: '',
    streetAddress: '',
    fumigationCommenced: '',
    fumigationCompleted: '',
    finalTlv: '',
    // Declaration
    fullName: '',
    signatureDate: '',
    accreditationNumber: '',
};

const CertificateGenerator = () => {
    const [form, setForm] = useState(INITIAL_FORM);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // E-Signature state
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureData, setSignatureData] = useState(null);
    const [hasSignature, setHasSignature] = useState(false);
    const [strokeHistory, setStrokeHistory] = useState([]);
    const lastPoint = useRef(null);

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = 200;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    const getPos = useCallback((e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
        };
    }, []);

    const startDrawing = useCallback((e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        lastPoint.current = pos;
        setIsDrawing(true);
        // Save current state for undo
        setStrokeHistory(prev => [...prev, canvas.toDataURL()]);
    }, [getPos]);

    const draw = useCallback((e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPoint.current = pos;
    }, [isDrawing, getPos]);

    const stopDrawing = useCallback(() => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.closePath();
        setHasSignature(true);
        setSignatureData(canvas.toDataURL('image/png'));
    }, [isDrawing]);

    const clearSignature = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        setHasSignature(false);
        setSignatureData(null);
        setStrokeHistory([]);
    }, []);

    const undoStroke = useCallback(() => {
        if (strokeHistory.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const prevState = strokeHistory[strokeHistory.length - 1];
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            setSignatureData(canvas.toDataURL('image/png'));
        };
        img.src = prevState;
        setStrokeHistory(prev => prev.slice(0, -1));
        if (strokeHistory.length <= 1) {
            setHasSignature(false);
            setSignatureData(null);
        }
    }, [strokeHistory]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
        setError('');
        setSuccess(false);
    };

    const handleEnclosureChange = (value) => {
        setForm(prev => ({ ...prev, enclosureType: value }));
    };

    const handleGenerate = async (e) => {
        e.preventDefault();

        if (!form.certificateNumber || !form.clientName || !form.fullName) {
            setError('Certificate number, client name, and fumigator name are required.');
            return;
        }

        setGenerating(true);
        setError('');
        setSuccess(false);

        try {
            const payload = { ...form, signatureImage: signatureData || null };
            const response = await certificateAPI.generate(payload);
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Certificate_${form.certificateNumber.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setSuccess(true);
        } catch (err) {
            console.error('Generate error:', err);
            setError(err.response?.data?.message || 'Failed to generate certificate. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    const handleReset = () => {
        setForm(INITIAL_FORM);
        setError('');
        setSuccess(false);
        clearSignature();
    };

    const inputClass = 'form-input';
    const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Generate Certificate</h1>
                    <p className="text-gray-500">Methyl Bromide Fumigation Treatment Certificate</p>
                </div>
                <button
                    onClick={handleReset}
                    className="btn btn-secondary flex items-center gap-2"
                >
                    Reset Form
                </button>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
                    <Download className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">Certificate generated and downloaded successfully!</p>
                </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-6">
                {/* Section 1: Certificate Info */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Hash className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">Certificate Information</h2>
                            <p className="text-xs text-gray-500">Basic certificate identification details</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>Date Issued *</label>
                            <input type="date" name="dateIssued" value={form.dateIssued} onChange={handleChange} className={inputClass} required />
                        </div>
                        <div>
                            <label className={labelClass}>Certificate Number *</label>
                            <input type="text" name="certificateNumber" value={form.certificateNumber} onChange={handleChange} className={inputClass} placeholder="e.g., CERT-2026-001" required />
                        </div>
                        <div>
                            <label className={labelClass}>Treatment Provider ID</label>
                            <input type="text" name="treatmentNumber" value={form.treatmentNumber} onChange={handleChange} className={inputClass} placeholder="Treatment number" />
                        </div>
                    </div>
                </div>

                {/* Section 2: Consignment Details */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">Consignment Details</h2>
                            <p className="text-xs text-gray-500">Shipment and client information</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Consignment Link (Container Numbers)</label>
                            <input type="text" name="consignmentLink" value={form.consignmentLink} onChange={handleChange} className={inputClass} placeholder="Container numbers" />
                        </div>
                        <div>
                            <label className={labelClass}>Seal Numbers</label>
                            <input type="text" name="sealNumber" value={form.sealNumber} onChange={handleChange} className={inputClass} placeholder="Seal numbers" />
                        </div>
                        <div>
                            <label className={labelClass}>Client Name *</label>
                            <input type="text" name="clientName" value={form.clientName} onChange={handleChange} className={inputClass} placeholder="Client name" required />
                        </div>
                        <div>
                            <label className={labelClass}>Client Address</label>
                            <input type="text" name="clientAddress" value={form.clientAddress} onChange={handleChange} className={inputClass} placeholder="Client address" />
                        </div>
                        <div>
                            <label className={labelClass}>Commodity Description</label>
                            <input type="text" name="commodityDescription" value={form.commodityDescription} onChange={handleChange} className={inputClass} placeholder="Commodity description" />
                        </div>
                        <div>
                            <label className={labelClass}>Country of Origin</label>
                            <input type="text" name="commodityCountryOfOrigin" value={form.commodityCountryOfOrigin} onChange={handleChange} className={inputClass} placeholder="Country of origin" />
                        </div>
                        <div>
                            <label className={labelClass}>Commodity Quantity</label>
                            <input type="text" name="commodityQuantity" value={form.commodityQuantity} onChange={handleChange} className={inputClass} placeholder="Quantity" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className={labelClass}>Port of Loading</label>
                            <input type="text" name="portOfLoading" value={form.portOfLoading} onChange={handleChange} className={inputClass} placeholder="Port of loading" />
                        </div>
                        <div>
                            <label className={labelClass}>Destination Country</label>
                            <input type="text" name="destinationCountry" value={form.destinationCountry} onChange={handleChange} className={inputClass} placeholder="Destination country" />
                        </div>
                    </div>
                </div>

                {/* Section 3: Target & Enclosure */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                            <ClipboardList className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">Target & Enclosure</h2>
                            <p className="text-xs text-gray-500">Target of fumigation and enclosure type</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Target of Fumigation — Multi-select */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Target of Fumigation <span className="text-xs font-normal text-gray-400">(pick all that apply)</span></h3>
                            <div className="space-y-3">
                                {[
                                    { name: 'targetCommodity', label: 'Commodity' },
                                    { name: 'targetContainer', label: 'Container' },
                                    { name: 'targetPackaging', label: 'Packaging' },
                                    { name: 'targetOther', label: 'Other' },
                                ].map(opt => (
                                    <label key={opt.name} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 cursor-pointer transition-all">
                                        <input
                                            type="checkbox"
                                            name={opt.name}
                                            checked={form[opt.name]}
                                            onChange={handleChange}
                                            className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                                    </label>
                                ))}
                                {form.targetOther && (
                                    <input
                                        type="text"
                                        name="targetOtherDetails"
                                        value={form.targetOtherDetails}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="Specify other target..."
                                    />
                                )}
                            </div>
                        </div>

                        {/* Enclosure Type — Single-select */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Enclosure Type <span className="text-xs font-normal text-gray-400">(pick one)</span></h3>
                            <div className="space-y-3">
                                {[
                                    { value: 'sheeted', label: 'Sheeted enclosure' },
                                    { value: 'chamber', label: 'Fumigation chamber' },
                                    { value: 'unsheeted', label: 'Un-sheeted container' },
                                    { value: 'other', label: 'Other' },
                                ].map(opt => (
                                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.enclosureType === opt.value ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-200' : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'}`}>
                                        <input
                                            type="radio"
                                            name="enclosureType"
                                            value={opt.value}
                                            checked={form.enclosureType === opt.value}
                                            onChange={() => handleEnclosureChange(opt.value)}
                                            className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                                    </label>
                                ))}
                                {form.enclosureType === 'other' && (
                                    <input
                                        type="text"
                                        name="enclosureOtherDetails"
                                        value={form.enclosureOtherDetails}
                                        onChange={handleChange}
                                        className={inputClass}
                                        placeholder="Specify enclosure type..."
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 4: Treatment Schedule */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                            <Thermometer className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">Treatment Schedule</h2>
                            <p className="text-xs text-gray-500">Prescribed/specified treatment schedule</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>Dose Rate (g/m³)</label>
                            <input type="text" name="dose" value={form.dose} onChange={handleChange} className={inputClass} placeholder="Dose rate" />
                        </div>
                        <div>
                            <label className={labelClass}>Exposure Period (hours)</label>
                            <input type="text" name="period" value={form.period} onChange={handleChange} className={inputClass} placeholder="Exposure period" />
                        </div>
                        <div>
                            <label className={labelClass}>Temperature (°C)</label>
                            <input type="text" name="temperature" value={form.temperature} onChange={handleChange} className={inputClass} placeholder="Temperature" />
                        </div>
                    </div>

                    <div className="mt-5 pt-5 border-t border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Fumigation Details (Treatment Applied)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>Applied Dose (g/m³)</label>
                                <input type="text" name="appliedDose" value={form.appliedDose} onChange={handleChange} className={inputClass} placeholder="Applied dose" />
                            </div>
                            <div>
                                <label className={labelClass}>Exposure Period (hours)</label>
                                <input type="text" name="period2" value={form.period2} onChange={handleChange} className={inputClass} placeholder="Exposure period" />
                            </div>
                            <div>
                                <label className={labelClass}>Temperature (°C)</label>
                                <input type="text" name="temperature2" value={form.temperature2} onChange={handleChange} className={inputClass} placeholder="Temperature" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 5: Fumigation Location */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">Fumigation Location & Timing</h2>
                            <p className="text-xs text-gray-500">Place and schedule of fumigation</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Place of Fumigation</label>
                            <input type="text" name="placeOfFumigation" value={form.placeOfFumigation} onChange={handleChange} className={inputClass} placeholder="Full address" />
                        </div>
                        <div>
                            <label className={labelClass}>Street Address</label>
                            <input type="text" name="streetAddress" value={form.streetAddress} onChange={handleChange} className={inputClass} placeholder="Street address" />
                        </div>
                        <div>
                            <label className={labelClass}>Fumigation Commenced</label>
                            <input type="datetime-local" name="fumigationCommenced" value={form.fumigationCommenced} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Fumigation Completed</label>
                            <input type="datetime-local" name="fumigationCompleted" value={form.fumigationCompleted} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Final TLV Reading (ppm)</label>
                            <input type="text" name="finalTlv" value={form.finalTlv} onChange={handleChange} className={inputClass} placeholder="TLV reading" />
                        </div>
                    </div>
                </div>

                {/* Section 6: Declaration */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">Declaration</h2>
                            <p className="text-xs text-gray-500">Fumigator-in-charge information</p>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 mb-5">
                        <p className="text-sm text-gray-600 italic leading-relaxed">
                            I, the fumigator-in-charge declare: The fumigation certified was conducted in accordance
                            with the treatment schedule, import conditions, and all the requirements in the Methyl Bromide
                            Fumigation Methodology, and the information I have provided is true and correct.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>Full Name *</label>
                            <input type="text" name="fullName" value={form.fullName} onChange={handleChange} className={inputClass} placeholder="Fumigator full name" required />
                        </div>
                        <div>
                            <label className={labelClass}>Date</label>
                            <input type="date" name="signatureDate" value={form.signatureDate} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Accreditation Number</label>
                            <input type="text" name="accreditationNumber" value={form.accreditationNumber} onChange={handleChange} className={inputClass} placeholder="Accreditation number" />
                        </div>
                    </div>

                    {/* E-Signature Pad */}
                    <div className="mt-6 pt-5 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <PenTool className="w-4 h-4 text-green-600" />
                                <h3 className="text-sm font-semibold text-gray-700">E-Signature</h3>
                                {hasSignature && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Signed</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={undoStroke}
                                    disabled={strokeHistory.length === 0}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Undo2 className="w-3.5 h-3.5" />
                                    Undo
                                </button>
                                <button
                                    type="button"
                                    onClick={clearSignature}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                                >
                                    <Eraser className="w-3.5 h-3.5" />
                                    Clear
                                </button>
                            </div>
                        </div>
                        <div className="relative rounded-xl border-2 border-dashed border-gray-300 overflow-hidden bg-white hover:border-green-300 transition-colors">
                            <canvas
                                ref={canvasRef}
                                className="w-full cursor-crosshair touch-none"
                                style={{ height: '200px' }}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                            {!hasSignature && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <p className="text-gray-300 text-sm font-medium select-none">Draw your signature here</p>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Use your mouse or touchscreen to sign above</p>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="btn btn-secondary flex-1 md:flex-none md:w-48"
                    >
                        Reset
                    </button>
                    <button
                        type="submit"
                        disabled={generating}
                        className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <FileText className="w-5 h-5" />
                                Generate Certificate
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CertificateGenerator;
