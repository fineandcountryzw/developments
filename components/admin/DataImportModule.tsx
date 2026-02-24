'use client';

import React, { useState } from 'react';
import {
    Download,
    Upload,
    Map as MapIcon,
    Users,
    CreditCard,
    LayoutDashboard,
    ArrowLeft,
    ArrowRight,
    CheckCircle,
    AlertCircle,
    FileText
} from 'lucide-react';
import { CsvUploader } from '../../app/components/import/CsvUploader';
import { GenericImportPreview } from '../../app/components/import/GenericImportPreview';
import { Button } from '../ui/button';

type ImportType = 'stands' | 'clients' | 'payments' | null;

interface ImportConfig {
    id: string;
    title: string;
    description: string;
    templateUrl: string;
    endpoint: string;
    headers: string[];
    requiredFields: string[];
    icon: any;
    color: string;
}

const IMPORT_CONFIGS: Record<string, ImportConfig> = {
    stands: {
        id: 'stands',
        title: 'Stands Inventory',
        description: 'Import physical stands, pricing, and availability status.',
        templateUrl: '/templates/stands_import.csv',
        endpoint: '/api/admin/import/past-sales',
        headers: ['standNumber', 'sizeSqm'],
        requiredFields: ['standNumber', 'sizeSqm'],
        icon: MapIcon,
        color: 'blue'
    },
    clients: {
        id: 'clients',
        title: 'Clients & Prospects',
        description: 'Bulk register clients with their contact details and IDs.',
        templateUrl: '/templates/clients_import.csv',
        endpoint: '/api/admin/import/past-sales',
        headers: ['name', 'email', 'phone', 'nationalId', 'address', 'city', 'country', 'notes'],
        requiredFields: ['name', 'email'],
        icon: Users,
        color: 'emerald'
    },
    payments: {
        id: 'payments',
        title: 'Payment History',
        description: 'Import past payments, installments, and deposits.',
        templateUrl: '/templates/payments_import.csv',
        endpoint: '/api/admin/import/past-sales',
        headers: ['clientEmail', 'standNumber', 'developmentName', 'paymentDate', 'amount', 'paymentMethod', 'reference', 'notes'],
        requiredFields: ['clientEmail', 'standNumber', 'developmentName', 'amount', 'paymentDate'],
        icon: CreditCard,
        color: 'amber'
    }
};

export const DataImportModule: React.FC = () => {
    const [selectedType, setSelectedType] = useState<ImportType>(null);
    const [step, setStep] = useState<'selection' | 'upload' | 'preview' | 'processing' | 'complete'>('selection');
    const [csvData, setCsvData] = useState<any[]>([]);
    const [developments, setDevelopments] = useState<any[]>([]);
    const [selectedDevelopmentId, setSelectedDevelopmentId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [batchId, setBatchId] = useState<string | null>(null);

    React.useEffect(() => {
        const fetchDevelopments = async () => {
            try {
                const response = await fetch('/api/admin/developments');
                const data = await response.json();
                if (response.ok) {
                    // API returns { success, data: [...], pagination } via apiSuccess()
                    const devs = data.data || data.developments || data;
                    setDevelopments(Array.isArray(devs) ? devs : []); // Ensure always an array
                }
            } catch (err) {
                console.error('Failed to fetch developments:', err);
            }
        };
        fetchDevelopments();
    }, []);

    const handleSelectType = (type: ImportType) => {
        setSelectedType(type);
        setStep('upload');
    };

    const handleFileAccepted = (data: any[]) => {
        setCsvData(data);
        setStep('preview');
    };

    const handleProcessImport = async () => {
        if (!selectedType) return;

        setStep('processing');
        setError(null);

        const config = IMPORT_CONFIGS[selectedType];

        try {
            const response = await fetch(config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    importType: selectedType,
                    data: csvData,
                    developmentId: selectedDevelopmentId
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Import failed. Please check the API endpoint.');
            }

            setBatchId(result.batchId);
            setStep('complete');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred during import.');
            setStep('preview');
        }
    };

    const handleReset = () => {
        setSelectedType(null);
        setStep('selection');
        setCsvData([]);
        setSelectedDevelopmentId('');
        setError(null);
        setBatchId(null);
    };

    const config = selectedType ? IMPORT_CONFIGS[selectedType] : null;

    return (
        <div className="max-w-6xl mx-auto py-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Data Import Management</h1>
                    <p className="text-gray-500 mt-1">Download templates and bulk import system data.</p>
                </div>
                {step !== 'selection' && (
                    <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
                        <LayoutDashboard size={16} /> Back to Overview
                    </Button>
                )}
            </div>

            {step === 'selection' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.values(IMPORT_CONFIGS).map((item) => (
                        <div
                            key={item.id}
                            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className={`w-12 h-12 rounded-xl bg-${item.color}-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                <item.icon className={`text-${item.color}-600`} size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h2>
                            <p className="text-gray-500 text-sm mb-6 min-h-[40px]">
                                {item.description}
                            </p>

                            <div className="space-y-3">
                                <Button
                                    className="w-full justify-center gap-2"
                                    onClick={() => handleSelectType(item.id as ImportType)}
                                >
                                    <Upload size={16} /> Start Import
                                </Button>
                                <a
                                    href={item.templateUrl}
                                    download
                                    className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 border border-gray-100 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                    <Download size={14} /> Download Template
                                </a>
                            </div>
                        </div>
                    ))}

                    {/* Guidelines Section */}
                    <div className="md:col-span-3 bg-fcCream border border-fcGold/20 rounded-2xl p-6 mt-8">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-fcGold/10 rounded-full">
                                <AlertCircle className="text-fcGold" size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-fcSlate mb-2">Data Import Rules</h3>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 text-sm text-fcSlate/70 list-disc pl-4">
                                    <li>Stands are imported into the selected Development (ensure correct context).</li>
                                    <li>CSV files should not exceed 500 rows per batch.</li>
                                    <li>Headers must exactly match the template format.</li>
                                    <li>Date format should be YYYY-MM-DD.</li>
                                    <li>Stand Numbers are normalized (whitespaces removed).</li>
                                    <li>Existing records will be updated based on unique identifiers (Emails/Stand Numbers).</li>
                                    <li>Currency values should be plain numbers (e.g., 25000 not $25,000).</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {step !== 'selection' && config && (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                    {/* Progress Indicator */}
                    <div className="flex items-center justify-center mb-10">
                        {[
                            { key: 'upload', label: 'Upload' },
                            { key: 'preview', label: 'Preview' },
                            { key: 'complete', label: 'Done' },
                        ].map((s, idx) => (
                            <React.Fragment key={s.key}>
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step === s.key || (step === 'preview' && idx === 0) || step === 'complete' || step === 'processing'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-400'
                                        }`}>
                                        {step === 'complete' && idx < 2 ? <CheckCircle size={20} /> : idx + 1}
                                    </div>
                                    <span className="text-xs font-semibold mt-2 text-gray-500 uppercase tracking-wider">{s.label}</span>
                                </div>
                                {idx < 2 && (
                                    <div className={`w-24 h-0.5 mx-4 -mt-6 ${step === 'complete' || (step === 'preview' && idx === 0) || (step === 'processing' && idx === 0)
                                        ? 'bg-blue-600'
                                        : 'bg-gray-100'
                                        }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    {step === 'upload' && (
                        <div className="max-w-xl mx-auto py-8">
                            <h3 className="text-lg font-bold text-center mb-2">Upload {config.title} CSV</h3>
                            <p className="text-gray-500 text-center text-sm mb-8">
                                Ensure your file matches the system headers. Download the template if unsure.
                            </p>
                            {selectedType === 'stands' && (
                                <div className="mb-6">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Target Development</label>
                                    <select
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={selectedDevelopmentId}
                                        onChange={(e) => setSelectedDevelopmentId(e.target.value)}
                                        required
                                    >
                                        <option value="">Select a Development...</option>
                                        {developments.map(dev => (
                                            <option key={dev.id} value={dev.id}>{dev.name}</option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500">Stands will be imported into this development.</p>
                                </div>
                            )}
                            <CsvUploader onFileAccepted={handleFileAccepted} />
                            {selectedType === 'stands' && !selectedDevelopmentId && (
                                <p className="mt-4 text-center text-sm text-red-500 font-medium">Please select a development before uploading.</p>
                            )}
                        </div>
                    )}

                    {step === 'preview' && (
                        <div>
                            <GenericImportPreview
                                data={csvData}
                                headers={config.headers}
                                requiredFields={config.requiredFields}
                                onRemove={(idx: number) => setCsvData(prev => prev.filter((_, i) => i !== idx))}
                            />

                            {error && (
                                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-center text-red-700">
                                    <AlertCircle size={20} />
                                    <p className="text-sm font-medium">{error}</p>
                                </div>
                            )}

                            <div className="flex justify-between mt-10">
                                <Button variant="ghost" onClick={() => setStep('upload')} className="flex items-center gap-2">
                                    <ArrowLeft size={16} /> New File
                                </Button>
                                <Button
                                    onClick={handleProcessImport}
                                    disabled={csvData.length === 0}
                                    className="bg-blue-600 hover:bg-blue-700 px-8 flex items-center gap-2"
                                >
                                    Finalize Import <ArrowRight size={16} />
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="text-center py-16">
                            <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6" />
                            <h3 className="text-xl font-bold text-gray-900">Processing Your Data</h3>
                            <p className="text-gray-500 mt-2">Uploading and validating {csvData.length} records. Please wait...</p>
                        </div>
                    )}

                    {step === 'complete' && (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Successful!</h2>
                            <p className="text-gray-600 mb-8">
                                Processed {csvData.length} {config.id} records successfully.
                                {batchId && <span> Batch ID: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{batchId}</code></span>}
                            </p>

                            <div className="flex flex-wrap justify-center gap-4">
                                <Button variant="outline" onClick={handleReset}>
                                    Back to Dashboard
                                </Button>
                                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setStep('upload')}>
                                    Import Another Batch
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
