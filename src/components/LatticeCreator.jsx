import React, { useState, Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import {
    ChevronDown,
    ChevronUp,
    Ruler,
    Grid,
    Palette
} from 'lucide-react';
import LatticePanel from './LatticePanel';
import Navbar from './Navbar';
import PricingModal from './PricingModal';
import { calculatePriceBreakdown, formatCurrency } from '../utils/pricing';
import { downloadQuotePdf } from '../utils/quotePdf';

// --- UI Components ---

const Section = ({ title, icon: Icon, children, isOpen = true }) => {
    const [open, setOpen] = useState(isOpen);
    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white mb-4 shadow-sm">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
                <div className="flex items-center space-x-2 text-gray-700 font-semibold uppercase text-sm tracking-wide">
                    {Icon && <Icon size={18} />}
                    <span>{title}</span>
                </div>
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {open && <div className="p-4 space-y-4">{children}</div>}
        </div>
    );
};

const InputGroup = ({
    label,
    value,
    onChange,
    unit,
    step = 1,
    min = 0,
    max,
    showStepper = false,
}) => {
    const clampValue = (nextValue) => {
        const lowerBounded = Math.max(min, nextValue);
        return Number.isFinite(max) ? Math.min(max, lowerBounded) : lowerBounded;
    };

    const handleInputChange = (e) => {
        const nextValue = Number(e.target.value);
        if (Number.isNaN(nextValue)) return;
        onChange(clampValue(nextValue));
    };

    const handleBlur = () => {
        if (!Number.isFinite(value)) {
            onChange(min);
            return;
        }
        const clamped = clampValue(value);
        if (clamped !== value) {
            onChange(clamped);
        }
    };

    const adjustValue = (delta) => {
        const baseValue = Number.isFinite(value) ? value : min;
        onChange(clampValue(baseValue + delta));
    };

    return (
        <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 mb-1 uppercase">{label}</label>
            <div className="relative flex items-center">
                <input
                    type="number"
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${showStepper ? 'pr-16' : ''}`}
                />
                {unit && (
                    <span className={`absolute text-gray-400 text-xs ${showStepper ? 'right-10' : 'right-3'}`}>
                        {unit}
                    </span>
                )}
                {showStepper && (
                    <div className="absolute right-0 top-0 h-full w-8 border-l border-gray-200 flex flex-col">
                        <button
                            type="button"
                            onClick={() => adjustValue(step)}
                            className="flex-1 flex items-center justify-center hover:bg-gray-100 transition-colors"
                            aria-label={`Increase ${label}`}
                        >
                            <ChevronUp size={12} className="text-gray-500" />
                        </button>
                        <button
                            type="button"
                            onClick={() => adjustValue(-step)}
                            className="flex-1 flex items-center justify-center border-t border-gray-200 hover:bg-gray-100 transition-colors"
                            aria-label={`Decrease ${label}`}
                        >
                            <ChevronDown size={12} className="text-gray-500" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Style model button for selecting lattice patterns
const StyleButton = ({ name, path, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center p-3 border-2 rounded-lg transition-all ${active
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
    >
        <div className={`w-14 h-14 mb-2 rounded-lg border-2 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center ${active ? 'border-blue-300' : 'border-gray-200'
            }`}>
            <Grid size={24} className={active ? 'text-blue-500' : 'text-gray-400'} />
        </div>
        <span className={`text-xs font-semibold truncate w-full text-center ${active ? 'text-blue-600' : 'text-gray-600'
            }`}>{name}</span>
    </button>
);

const ColorOption = ({ color, name, active, onClick }) => (
    <button
        onClick={onClick}
        className={`group relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'border-blue-500 scale-110 shadow-md' : 'border-transparent hover:scale-105'
            }`}
    >
        <div className="w-8 h-8 rounded-full shadow-inner" style={{ backgroundColor: color }} />
        <span className="absolute -bottom-6 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
            {name}
        </span>
    </button>
);

// --- 3D Components ---

const Loader = () => {
    return (
        <Html center>
            <div className="flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-200">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Loading Model...</span>
            </div>
        </Html>
    );
};

// --- Main Component ---

const materialTypes = ['MDF', 'Mild Steel', 'Baltic Birch', 'Acrylic', 'Stainless Steel', 'Aluminum'];
const hangingOptions = [
    'None',
    'Direct Mount (Screws or Nails)',
    'Standoff Mount (Floating Look)',
    'Frame Mount (Pre-Framed Panel)',
    'Rail or Cleat System (Hidden Mount)',
    'Adhesive Mount',
];
const DEFAULT_CAMERA_CONFIG = Object.freeze({ position: [0, 0, 5], fov: 50 });
const STRONG_ZOOM_IN_Z = 5;
const STRONG_ZOOM_OUT_Z = 20;
const ZOOM_IN_STYLE_IDS = new Set([
    12, 13, 15, 17, 22, 48, 51, 57, 64, 65, 66, 68, 69, 70, 71, 72, 75, 76, 78, 79, 86, 87, 89, 91, 92, 118, 131,
]);
const ZOOM_OUT_STYLE_IDS = new Set([29]);

const getStyleIdFromPath = (stylePath = '') => {
    const match = stylePath.match(/STYLE\s+(\d+)\.glb$/i);
    return match ? Number(match[1]) : null;
};

const getThicknessOptions = (type) => {
    switch (type) {
        case 'MDF':
        case 'Baltic Birch':
        case 'Acrylic':
            return [
                { label: '1/8 inch', value: 0.125 },
                { label: '1/4 inch', value: 0.25 },
                { label: '3/8 inch', value: 0.375 },
                { label: '1/2 inch', value: 0.5 },
                { label: '3/4 inch', value: 0.75 },
                { label: '1 inch', value: 1.0 },
            ];
        case 'Stainless Steel':
        case 'Mild Steel':
            return [
                { label: '18 gauge (0.0478")', value: 0.0478 },
                { label: '14 gauge (0.0747")', value: 0.0747 },
                { label: '12 gauge (0.1046")', value: 0.1046 },
            ];
        case 'Aluminum':
            return [
                { label: '18 Gauge (0.0403")', value: 0.0403 },
                { label: '14 gauge (0.0641")', value: 0.0641 },
                { label: '12 gauge (0.0808")', value: 0.0808 },
            ];
        default:
            return [];
    }
};

function LatticeCreator() {
    const [width, setWidth] = useState(20);
    const [height, setHeight] = useState(20);
    const [selectedStyle, setSelectedStyle] = useState('/styles/STYLE 1.glb');
    const [finish, setFinish] = useState('No Finish');
    const [materialType, setMaterialType] = useState('MDF');
    const [thickness, setThickness] = useState(0.75);
    const [borderSize, setBorderSize] = useState(0.75);
    const [hangingOption, setHangingOption] = useState('None');
    const [patternSizePercent, setPatternSizePercent] = useState(50);
    const [panelShape, setPanelShape] = useState('Rectangle');
    const [styles, setStyles] = useState([]);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const controlsRef = useRef(null);

    const patternScale = useMemo(() => {
        const safePercent = Math.min(100, Math.max(1, Number(patternSizePercent) || 50));
        // UI shows 1–100%; logic minimum is 10% for render scale
        return Math.max(0.1, safePercent / 100);
    }, [patternSizePercent]);

    // Fetch style config
    useEffect(() => {
        fetch('/styles/config.json')
            .then((res) => res.json())
            .then((data) => {
                setStyles(data);
                // Ensure the selected style exists in the config, if not, select the first one
                if (data.length > 0) {
                    // Optionally check if selectedStyle is in data, but keeping default is fine
                }
            })
            .catch((err) => console.error('Failed to load style config:', err));
    }, []);

    // Update thickness when material type changes to ensure valid value
    React.useEffect(() => {
        const options = getThicknessOptions(materialType);
        if (options.length > 0 && !options.some(opt => opt.value === thickness)) {
            setThickness(options[0].value);
        }
    }, [materialType]);

    const finishes = [
        { name: 'No Finish', value: 'No Finish', color: '#B08D57' },
        { name: 'Black', value: 'Black', color: '#212121' },
        { name: 'White', value: 'White', color: '#F5F5F5' },
    ];

    const selectedFinishColor = finishes.find((item) => item.value === finish)?.color || '#B08D57';

    const selectedStyleName = useMemo(() => {
        const selected = styles.find((style) => style.path === selectedStyle);
        return selected?.name || selectedStyle;
    }, [styles, selectedStyle]);
    const cameraConfig = useMemo(() => {
        const styleId = getStyleIdFromPath(selectedStyle);

        if (styleId && ZOOM_IN_STYLE_IDS.has(styleId)) {
            return { position: [0, 0, STRONG_ZOOM_IN_Z], fov: DEFAULT_CAMERA_CONFIG.fov };
        }

        if (styleId && ZOOM_OUT_STYLE_IDS.has(styleId)) {
            return { position: [0, 0, STRONG_ZOOM_OUT_Z], fov: DEFAULT_CAMERA_CONFIG.fov };
        }

        return DEFAULT_CAMERA_CONFIG;
    }, [selectedStyle]);

    const pricingConfig = useMemo(() => ({
        width,
        height,
        panelShape,
        materialType,
        thickness,
        borderSize,
        hangingOption,
        finish,
        styleName: selectedStyleName,
    }), [
        width,
        height,
        panelShape,
        materialType,
        thickness,
        borderSize,
        hangingOption,
        finish,
        selectedStyleName,
    ]);

    const priceBreakdown = useMemo(
        () => calculatePriceBreakdown(pricingConfig),
        [pricingConfig]
    );

    const handleDownloadQuote = () => {
        downloadQuotePdf({
            config: pricingConfig,
            breakdown: priceBreakdown,
        });
    };

    return (
        <div className="flex flex-col h-screen bg-white text-gray-800 font-sans">
            {/* Header */}
            <Navbar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left Control Panel */}
                <aside className="w-full md:w-[360px] flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 overflow-y-auto p-4 custom-scrollbar order-2 md:order-1 h-1/2 md:h-auto">
                    <div className="mb-6">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Design Controls</h2>

                        <Section title="Dimensions & Shape" icon={Ruler}>
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup
                                    label="Width"
                                    value={width}
                                    onChange={setWidth}
                                    unit="inch"
                                    step={10}
                                    min={10}
                                    max={47}
                                    showStepper
                                />
                                <InputGroup
                                    label="Height"
                                    value={height}
                                    onChange={setHeight}
                                    unit="inch"
                                    step={10}
                                    min={10}
                                    max={95}
                                    showStepper
                                />
                            </div>
                            <div className="mt-4">
                                <label className="text-xs font-bold text-gray-500 mb-1 uppercase block">Shape</label>
                                <div className="relative">
                                    <select
                                        value={panelShape}
                                        onChange={(e) => setPanelShape(e.target.value)}
                                        className="w-full appearance-none border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                                    >
                                        <option value="Rectangle">Rectangle</option>
                                        <option value="Arch">Arch</option>
                                        <option value="Circle">Circle</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                </div>
                            </div>
                        </Section>

                        <Section title="Pattern & Scaling" icon={Grid}>
                            <label className="text-xs font-bold text-gray-500 mb-2 uppercase block">Select Style</label>
                            <div className="max-h-[20rem] overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 custom-scrollbar">
                                <div className="grid grid-cols-2 gap-3">
                                    {styles.map((style) => (
                                        <StyleButton
                                            key={style.path}
                                            name={style.name}
                                            path={style.path}
                                            active={selectedStyle === style.path}
                                            onClick={() => setSelectedStyle(style.path)}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="mt-4">
                                <label className="text-xs font-bold text-gray-500 mb-1 uppercase block">Pattern Size</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={patternSizePercent}
                                        onChange={(e) => setPatternSizePercent(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="relative w-24">
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            step="1"
                                            value={patternSizePercent}
                                            onChange={(e) => {
                                                const nextValue = Number(e.target.value);
                                                if (Number.isNaN(nextValue)) return;
                                                setPatternSizePercent(Math.min(100, Math.max(1, nextValue)));
                                            }}
                                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-7"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        <Section title="Material & Finish" icon={Palette}>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 uppercase block">Type</label>
                                    <div className="relative">
                                        <select
                                            value={materialType}
                                            onChange={(e) => setMaterialType(e.target.value)}
                                            className="w-full appearance-none border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                                        >
                                            {materialTypes.map((type) => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-2 uppercase block">Finish Color</label>
                                    <div className="flex flex-wrap gap-3">
                                        {finishes.map((f) => (
                                            <ColorOption
                                                key={f.value}
                                                {...f}
                                                active={finish === f.value}
                                                onClick={() => setFinish(f.value)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 uppercase block">Material Thickness</label>
                                    <div className="relative">
                                        <select
                                            value={thickness}
                                            onChange={(e) => setThickness(Number(e.target.value))}
                                            className="w-full appearance-none border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                                        >
                                            {getThicknessOptions(materialType).map((opt) => (
                                                <option key={opt.label} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup
                                        label="Border Size"
                                        value={borderSize}
                                        onChange={setBorderSize}
                                        unit="inch"
                                        min={0.25}
                                        step={0.25}
                                    />

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 uppercase block">Hanging Options</label>
                                        <div className="relative">
                                            <select
                                                value={hangingOption}
                                                onChange={(e) => setHangingOption(e.target.value)}
                                                className="w-full appearance-none border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                                            >
                                                {hangingOptions.map((opt) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Section>
                    </div>
                </aside>

                {/* Right Preview Panel */}
                <section className="flex-1 relative bg-gradient-to-br from-gray-100 to-gray-200 order-1 md:order-2 h-1/2 md:h-auto">
                    <div className="absolute top-0 left-0 right-0 p-3 bg-white/80 backdrop-blur border-b border-gray-200 z-10 flex justify-between items-center shadow-sm">
                        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Live Preview</h2>
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1 rounded bg-white border border-gray-300">
                                <span className="text-xs text-gray-500 uppercase tracking-wide mr-2">Total</span>
                                <span className="text-sm font-semibold text-gray-800">
                                    {formatCurrency(priceBreakdown?.total || 0)}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => controlsRef.current?.reset()}
                                className="text-xs bg-white border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 transition-colors"
                            >
                                Reset View
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPriceModalOpen(true)}
                                className="text-xs bg-blue-600 text-white border border-blue-700 px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                            >
                                See Pricing Breakdown
                            </button>
                        </div>
                    </div>

                    <div className="w-full h-full cursor-move">
                        <Canvas
                            gl={{ stencil: true }}
                            camera={cameraConfig}
                            onCreated={({ gl }) => {
                                gl.localClippingEnabled = true;
                            }}
                        >
                            <color
                                attach="background"
                                args={[selectedFinishColor === '#F5F5F5' ? '#333333' : '#e8e8e8']}
                            />

                            {/* HDR Environment for realistic lighting - reduced intensity */}
                          {/* <Environment preset="warehouse" environmentIntensity={0.2} /> */}

                            {/* Subtle additional lighting */}
                            <ambientLight intensity={3} />
                            {/* <directionalLight position={[5, 5, 5]} intensity={0.4} /> */}
                            {/* <directionalLight position={[-5, 5, -5]} intensity={0.2} /> */}

                            <Suspense fallback={<Loader />}>
                                <LatticePanel
                                    width={width}
                                    height={height}
                                    styleModel={selectedStyle}
                                    materialColor={selectedFinishColor}
                                    patternScale={patternScale}
                                    panelShape={panelShape}
                                    thickness={thickness}
                                    borderSize={borderSize}
                                />
                            </Suspense>

                            <OrbitControls
                                ref={controlsRef}
                                makeDefault
                                enablePan={true}
                                enableZoom={true}
                                enableRotate={true}
                                minDistance={5}
                                maxDistance={50}
                            />
                        </Canvas>
                    </div>

                    <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg border border-white/50 max-w-xs transition-opacity opacity-80 hover:opacity-100 hidden md:block">
                        <h3 className="font-bold text-gray-800 text-sm mb-1">Preview Info</h3>
                        <p className="text-xs text-gray-500">
                            Drag to rotate. Scroll to zoom. Use the controls on the left to customize your lattice.
                        </p>
                    </div>
                </section>
            </main>

            <PricingModal
                isOpen={isPriceModalOpen}
                onClose={() => setIsPriceModalOpen(false)}
                config={pricingConfig}
                breakdown={priceBreakdown}
                onDownloadPdf={handleDownloadQuote}
            />
        </div>
    );
}

export default LatticeCreator;
