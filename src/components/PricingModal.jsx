import React, { useEffect } from 'react';
import { formatCurrency } from '../utils/pricing';

const PriceRow = ({ label, value, bold = false }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100">
        <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</span>
        <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {formatCurrency(value)}
        </span>
    </div>
);

function PricingModal({ isOpen, onClose, config, breakdown, onDownloadPdf }) {
    useEffect(() => {
        if (!isOpen) return undefined;

        const handleEsc = (event) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen || !breakdown) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <button
                type="button"
                className="absolute inset-0 bg-black/45"
                onClick={onClose}
                aria-label="Close pricing modal backdrop"
            />

            <div
                role="dialog"
                aria-modal="true"
                className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-2xl border border-gray-200"
            >
                <div className="p-5 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">Pricing Breakdown</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Calculated from your current lattice configuration.
                    </p>
                </div>

                <div className="p-5 grid md:grid-cols-2 gap-5">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                            Configuration
                        </h4>
                        <div className="space-y-2 text-sm text-gray-700">
                            <p><span className="font-medium">Style:</span> {config.styleName}</p>
                            <p><span className="font-medium">Size:</span> {config.width}" x {config.height}"</p>
                            <p><span className="font-medium">Shape:</span> {config.panelShape}</p>
                            <p><span className="font-medium">Material:</span> {config.materialType}</p>
                            <p><span className="font-medium">Thickness:</span> {config.thickness}"</p>
                            <p><span className="font-medium">Border:</span> {config.borderSize}"</p>
                            <p><span className="font-medium">Hanging:</span> {config.hangingOption}</p>
                            <p><span className="font-medium">Area:</span> {breakdown.areaSqFt} sq ft</p>
                        </div>
                    </div>

                    <div>
                        {breakdown.lineItems.map((item) => (
                            <PriceRow key={item.key} label={item.label} value={item.amount} />
                        ))}
                        <PriceRow label="Subtotal" value={breakdown.subtotal} />
                        <PriceRow label="Total" value={breakdown.total} bold />
                    </div>
                </div>

                <div className="p-5 border-t border-gray-200 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={onDownloadPdf}
                        className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        Download PDF
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PricingModal;

