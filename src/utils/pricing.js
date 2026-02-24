const PRICING_CONFIG = {
    materialPricing: {
        MDF: {
            baseRatePerSqFt: 18.95,
            addonRates: {
                0.125: 0,
                0.25: 5.7,
                0.375: 11.37,
                0.5: 17.06,
                0.75: 23.0,
                1: 30.0,
            },
        },
        'Mild Steel': {
            baseRatePerSqFt: 21.95,
            addonRates: {
                0.0478: 0,
                0.0747: 5.7,
                0.1046: 11.37,
            },
        },
        'Baltic Birch': {
            baseRatePerSqFt: 21.95,
            addonRates: {
                0.125: 0,
                0.25: 5.7,
                0.375: 11.37,
                0.5: 17.06,
                0.75: 20.0,
                1: 30.0,
            },
        },
        Acrylic: {
            baseRatePerSqFt: 21.95,
            addonRates: {
                0.125: 0,
                0.25: 5.7,
                0.375: 11.37,
                0.5: 17.06,
                0.75: 20.0,
                1: 30.0,
            },
        },
        'Stainless Steel': {
            baseRatePerSqFt: 32.92,
            addonRates: {
                0.0478: 0,
                0.0747: 8.55,
                0.1046: 17.06,
            },
        },
        Aluminum: {
            baseRatePerSqFt: 43.9,
            addonRates: {
                0.0403: 0,
                0.0641: 11.4,
                0.0808: 22.74,
            },
        },
    },
    hangingAddons: {
        None: 0,
        'Direct Mount (Screws or Nails)': 10,
        'Standoff Mount (Floating Look)': 30,
        'Rail or Cleat System (Hidden Mount)': 50,
        'Adhesive Mount': 15,
    },
    finishRatePerSqFt: {
        'No Finish': 0,
        Black: 5.7,
        White: 5.7,
    },
    largeItemFees: {
        midTierMinSqFt: 10,
        midTierMaxSqFt: 15,
        midTierFee: 150,
        highTierFee: 400,
    },
};

const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const round2 = (value) => Math.round(value * 100) / 100;
const THICKNESS_MATCH_EPSILON = 0.0002;

export const formatCurrency = (value) => currency.format(value || 0);

function getMaterialRates(materialType, thickness) {
    const materialConfig = PRICING_CONFIG.materialPricing[materialType];
    if (!materialConfig) {
        return { baseRatePerSqFt: 0, addonRatePerSqFt: 0 };
    }

    const matchedKey = Object.keys(materialConfig.addonRates).find(
        (key) => Math.abs(Number(key) - thickness) <= THICKNESS_MATCH_EPSILON
    );

    return {
        baseRatePerSqFt: materialConfig.baseRatePerSqFt,
        addonRatePerSqFt: matchedKey ? materialConfig.addonRates[matchedKey] : 0,
    };
}

export function calculatePriceBreakdown(config) {
    const width = Math.max(1, Number(config.width) || 1);
    const height = Math.max(1, Number(config.height) || 1);
    const thickness = Math.max(0, Number(config.thickness) || 0);
    const borderSize = Math.max(0, Number(config.borderSize) || 0);

    const areaSqFt = round2((width * height) / 144);
    const { baseRatePerSqFt, addonRatePerSqFt } = getMaterialRates(config.materialType, thickness);
    const materialBaseCost = round2(areaSqFt * baseRatePerSqFt);
    const thicknessAddonCost = round2(areaSqFt * addonRatePerSqFt);
    const baseCost = round2(materialBaseCost + thicknessAddonCost);
    const largeItemFee = areaSqFt > PRICING_CONFIG.largeItemFees.midTierMaxSqFt
        ? PRICING_CONFIG.largeItemFees.highTierFee
        : areaSqFt >= PRICING_CONFIG.largeItemFees.midTierMinSqFt
            ? PRICING_CONFIG.largeItemFees.midTierFee
            : 0;

    const finishRate = PRICING_CONFIG.finishRatePerSqFt[config.finish] ?? 0;
    const isFrameMount = config.hangingOption === 'Frame Mount (Pre-Framed Panel)';
    const hangingAddon = isFrameMount
        ? round2(baseCost * 0.5)
        : (PRICING_CONFIG.hangingAddons[config.hangingOption] || 0);

    const finishCost = round2(areaSqFt * finishRate);

    const lineItems = [
        {
            key: 'material-base',
            label: `Material base (${config.materialType} @ $${baseRatePerSqFt}/sq ft)`,
            amount: materialBaseCost
        },
        {
            key: 'thickness-addon',
            label: `Thickness/Gauge add-on ($${addonRatePerSqFt}/sq ft)`,
            amount: thicknessAddonCost
        },
        { key: 'finish', label: `Finish option (${config.finish || 'No Finish'})`, amount: finishCost },
        { key: 'hanging', label: `Hanging option (${config.hangingOption})`, amount: hangingAddon },
    ].filter(Boolean);

    if (largeItemFee > 0) {
        lineItems.push({
            key: 'large-item-fee',
            label: `Large item fee (${areaSqFt} sq ft)`,
            amount: round2(largeItemFee),
        });
    }

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

