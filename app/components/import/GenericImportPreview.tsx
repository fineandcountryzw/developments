'use client';

import { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';

interface GenericImportPreviewProps {
    data: any[];
    headers: string[];
    requiredFields: string[];
    onRemove: (index: number) => void;
}

export function GenericImportPreview({ data, headers, requiredFields, onRemove }: GenericImportPreviewProps) {
    const [viewAll, setViewAll] = useState(false);
    const displayData = viewAll ? data : data.slice(0, 10);

    const getMissingFields = (row: any) => {
        return requiredFields.filter(field => !row[field] || row[field].toString().trim() === '');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">
                    Preview ({data.length} records)
                </h3>
                <span className="text-sm text-gray-500">
                    {data.length > 10 && (
                        <button
                            onClick={() => setViewAll(!viewAll)}
                            className="text-blue-600 hover:underline"
                        >
                            {viewAll ? 'Show first 10' : `Show all ${data.length}`}
                        </button>
                    )}
                </span>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                #
                            </th>
                            {headers.map(header => (
                                <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {header.replace(/([A-Z])/g, ' $1').trim()}
                                </th>
                            ))}
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {displayData.map((row, idx) => {
                            const missingFields = getMissingFields(row);
                            const isValid = missingFields.length === 0;

                            return (
                                <tr key={idx} className={!isValid ? 'bg-red-50' : ''}>
                                    <td className="px-4 py-3 text-gray-500">
                                        {idx + 1}
                                    </td>
                                    {headers.map(header => {
                                        const isRequired = requiredFields.includes(header);
                                        const isMissing = isRequired && (!row[header] || row[header].toString().trim() === '');

                                        return (
                                            <td key={header} className="px-4 py-3">
                                                {isMissing ? (
                                                    <span className="text-red-500 flex items-center gap-1">
                                                        <AlertCircle size={12} /> Missing
                                                    </span>
                                                ) : (
                                                    row[header] || <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => onRemove(idx)}
                                            className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                                            title="Remove row"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {data.length > 10 && !viewAll && (
                <div className="text-center text-sm text-gray-500">
                    And {data.length - 10} more records...
                </div>
            )}

            {/* Validation Summary */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Validation Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-100">
                        <span className="text-gray-500">Valid records:</span>{' '}
                        <span className="text-green-600 font-bold">
                            {data.filter(row => getMissingFields(row).length === 0).length}
                        </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-100">
                        <span className="text-gray-500">Records with errors:</span>{' '}
                        <span className="text-red-600 font-bold">
                            {data.filter(row => getMissingFields(row).length > 0).length}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
