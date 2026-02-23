import { jsPDF } from 'jspdf';
import { formatCurrency } from './pricing';

const addRow = (doc, label, value, y) => {
    doc.text(label, 14, y);
    doc.text(value, 196, y, { align: 'right' });
};

export function downloadQuotePdf({ config, breakdown }) {
    const doc = new jsPDF();
    const now = new Date();

    doc.setFontSize(18);
    doc.text('Lattice Quote', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(`Generated: ${now.toLocaleString()}`, 14, 25);
    doc.setTextColor(0);

    doc.setFontSize(12);
    doc.text('Configuration', 14, 36);
    doc.setFontSize(10);
    addRow(doc, 'Style', config.styleName, 43);
    addRow(doc, 'Size', `${config.width}" x ${config.height}"`, 49);
    addRow(doc, 'Shape', config.panelShape, 55);
    addRow(doc, 'Material', config.materialType, 61);
    addRow(doc, 'Thickness', `${config.thickness}"`, 67);
    addRow(doc, 'Border', `${config.borderSize}"`, 73);
    addRow(doc, 'Hanging', config.hangingOption, 79);

    doc.setFontSize(12);
    doc.text('Price Breakdown', 14, 92);
    doc.setFontSize(10);

    let y = 99;
    breakdown.lineItems.forEach((item) => {
        addRow(doc, item.label, formatCurrency(item.amount), y);
        y += 6;
    });

    y += 2;
    doc.line(14, y, 196, y);
    y += 7;
    doc.setFontSize(12);
    addRow(doc, 'Total', formatCurrency(breakdown.total), y);

    const safeTimestamp = now.toISOString().replace(/[:.]/g, '-');
    doc.save(`lattice-quote-${safeTimestamp}.pdf`);
}

