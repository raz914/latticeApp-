import { jsPDF } from 'jspdf';
import { formatCurrency } from './pricing';

const addRow = (doc, label, value, y) => {
    doc.text(label, 14, y);
    doc.text(value, 196, y, { align: 'right' });
};

const PAGE_BOTTOM_Y = 280;

const ensureSpace = (doc, y, requiredHeight = 0) => {
    if (y + requiredHeight <= PAGE_BOTTOM_Y) return y;
    doc.addPage();
    return 20;
};

export function downloadQuotePdf({ config, breakdown, previewImageDataUrl }) {
    const doc = new jsPDF();
    const now = new Date();

    doc.setFontSize(18);
    doc.text('Lattice Quote', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Generated: ${now.toLocaleString()}`, 14, 25);
    doc.setTextColor(0);

    let y = 36;

    doc.setFontSize(12);
    doc.text('Configuration', 14, y);
    doc.setFontSize(10);

    const configurationRows = [
        ['Style', config.styleName],
        ['Size', `${config.width}" x ${config.height}"`],
        ['Shape', config.panelShape],
        ['Material', config.materialType],
        ['Finish', config.finish || 'No Finish'],
        ['Face Color', config.faceColorHex || '-'],
        ['Edge Color', config.edgeColorHex || '-'],
        ['Thickness', `${config.thickness}"`],
        ['Panel Scale', `${config.panelScalePercent ?? 0}%`],
        ['Border', `${config.borderSize}"`],
        ['Hanging', config.hangingOption],
    ];

    y += 7;
    configurationRows.forEach(([label, value]) => {
        y = ensureSpace(doc, y, 6);
        addRow(doc, label, String(value ?? ''), y);
        y += 6;
    });

    if (previewImageDataUrl) {
        y += 3;
        y = ensureSpace(doc, y, 55);
        doc.setFontSize(12);
        doc.text('Design Preview', 14, y);
        y += 4;

        try {
            const imageProps = doc.getImageProperties(previewImageDataUrl);
            const imageRatio = imageProps.width / imageProps.height;
            const maxImageWidth = 170;
            const maxImageHeight = 60;
            let renderWidth = maxImageWidth;
            let renderHeight = renderWidth / imageRatio;

            if (renderHeight > maxImageHeight) {
                renderHeight = maxImageHeight;
                renderWidth = renderHeight * imageRatio;
            }

            y = ensureSpace(doc, y, renderHeight + 6);
            const imageX = 14 + (182 - renderWidth) / 2;
            doc.addImage(previewImageDataUrl, 'PNG', imageX, y, renderWidth, renderHeight);
            y += renderHeight + 6;
        } catch {
            doc.setFontSize(10);
            doc.setTextColor(120);
            doc.text('Preview image could not be embedded.', 14, y + 2);
            doc.setTextColor(0);
            y += 8;
        }
    }

    y += 2;
    y = ensureSpace(doc, y, 12);
    doc.setFontSize(12);
    doc.text('Price Breakdown', 14, y);
    doc.setFontSize(10);
    y += 7;

    breakdown.lineItems.forEach((item) => {
        y = ensureSpace(doc, y, 6);
        addRow(doc, item.label, formatCurrency(item.amount), y);
        y += 6;
    });

    y = ensureSpace(doc, y + 2, 9);
    doc.line(14, y, 196, y);
    y += 7;
    doc.setFontSize(12);
    addRow(doc, 'Total', formatCurrency(breakdown.total), y);

    const safeTimestamp = now.toISOString().replace(/[:.]/g, '-');
    doc.save(`lattice-quote-${safeTimestamp}.pdf`);
}

