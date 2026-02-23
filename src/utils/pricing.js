const PRICING_CONFIG = {
    baseRatePerSqFt: 24,
    thicknessRatePerSqFtPerInch: 8,
    borderRatePerInchPerFoot: 1.8,
    materialMultipliers: {
        MDF: 1,
        'Baltic Birch': 1.2,
        Acrylic: 1.35,
        Aluminum: 1.55,
        'Stainless Steel': 1.85,
        'Mild Steel': 1.5,
    },
    shapeMultipliers: {
        Rectangle: 1,
        Arch: 1.15,
        Circle: 1.2,
    },
    hangingAddons: {
        None: 0,
        'Stand-offs': 28,
        'Keyhole Slots': 18,
        'Through Holes': 12,
    },
};

const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const round2 = (value) => Math.round(value * 100) / 100;

export const formatCurrency = (value) => currency.format(value || 0);

export function calculatePriceBreakdown(config) {
    const width = Math.max(1, Number(config.width) || 1);
    const height = Math.max(1, Number(config.height) || 1);
    const thickness = Math.max(0, Number(config.thickness) || 0);
    const borderSize = Math.max(0, Number(config.borderSize) || 0);

    const areaSqFt = round2((width * height) / 144);
    const baseCost = round2(areaSqFt * PRICING_CONFIG.baseRatePerSqFt);

    const materialMultiplier = PRICING_CONFIG.materialMultipliers[config.materialType] || 1;
    const shapeMultiplier = PRICING_CONFIG.shapeMultipliers[config.panelShape] || 1;
    const hangingAddon = PRICING_CONFIG.hangingAddons[config.hangingOption] || 0;

    const materialCost = round2(baseCost * (materialMultiplier - 1));
    const thicknessCost = round2(
        areaSqFt * thickness * PRICING_CONFIG.thicknessRatePerSqFtPerInch
    );
    const shapeCost = round2(baseCost * (shapeMultiplier - 1));
    const borderLinearFeet = round2((2 * (width + height)) / 12);
    const borderCost = round2(
        borderSize * borderLinearFeet * PRICING_CONFIG.borderRatePerInchPerFoot
    );

    const lineItems = [
        { key: 'base', label: `Base (${areaSqFt} sq ft @ $${PRICING_CONFIG.baseRatePerSqFt}/sq ft)`, amount: baseCost },
        { key: 'material', label: `Material adjustment (${config.materialType})`, amount: materialCost },
        { key: 'thickness', label: `Thickness add-on (${thickness}" material)`, amount: thicknessCost },
        { key: 'shape', label: `Shape adjustment (${config.panelShape})`, amount: shapeCost },
        { key: 'border', label: `Border add-on (${borderSize}" x ${borderLinearFeet} ft)`, amount: borderCost },
        { key: 'hanging', label: `Hanging option (${config.hangingOption})`, amount: hangingAddon },
    ];

    const subtotal = round2(lineItems.reduce((sum, item) => sum + item.amount, 0));
    const total = subtotal;

    return {
        areaSqFt,
        baseCost,
        lineItems,
        subtotal,
        total,
        config: {
            ...config,
            width,
            height,
            thickness,
            borderSize,
        },
    };
}

