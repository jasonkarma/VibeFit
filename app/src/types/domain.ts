/**
 * VibeFit domain model.
 *
 * These unions are the contract between the preference UI, the recommendation
 * engine, and the catalog. They intentionally use the display strings as the
 * literal values so catalog JSON stays human-readable and no lookup table is
 * needed to render a selection.
 */

export const OCCASIONS = ['Casual Outing', 'Work', 'Party', 'Wedding'] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const DRESS_CODES = [
    'Casual',
    'Smart Casual',
    'Business Formal',
    'Cocktail',
    'Black Tie',
] as const;
export type DressCode = (typeof DRESS_CODES)[number];

/**
 * Formality ordering, least to most formal. Drives the dress-code ladder UI and
 * the "adjacent formality level" relax strategy.
 */
export const DRESS_CODE_FORMALITY: Record<DressCode, number> = {
    Casual: 0,
    'Smart Casual': 1,
    'Business Formal': 2,
    Cocktail: 3,
    'Black Tie': 4,
};

export const STYLE_PREFERENCES = [
    'Minimalist',
    'Classic',
    'Trendy',
    'Streetwear',
    'Bohemian',
] as const;
export type StylePreference = (typeof STYLE_PREFERENCES)[number];

export const NO_COLOR_PREFERENCE = 'No Color Preference' as const;

export const COLOR_OPTIONS = [
    'Black',
    'White',
    'Navy',
    'Beige',
    'Earth Tones',
    'Colorful',
] as const;
export type ColorOption = (typeof COLOR_OPTIONS)[number];
export type ColorPreference = ColorOption | typeof NO_COLOR_PREFERENCE;

/** Swatch values used by the colour picker. "Colorful" is a multi-stop gradient. */
export const COLOR_SWATCHES: Record<ColorOption, string> = {
    Black: '#1A1A1D',
    White: '#F4F4F5',
    Navy: '#1E2A44',
    Beige: '#D6C7B0',
    'Earth Tones': '#8B6F47',
    Colorful: 'linear-gradient(135deg,#E5C158,#A855F7 55%,#34D399)',
};

export const SLOTS = ['top', 'layer', 'bottom', 'shoes', 'accessory'] as const;
export type Slot = (typeof SLOTS)[number];

/** Human labels for garment slots, used in detail views and reason strings. */
export const SLOT_LABELS: Record<Slot, string> = {
    top: 'Top',
    layer: 'Jacket / Layer',
    bottom: 'Bottom',
    shoes: 'Footwear',
    accessory: 'Accessory',
};

export interface Product {
    id: string;
    name: string;
    retailer: string;
    slot: Slot;
    /** `null` means the price is genuinely unknown — never substitute a number. */
    price: number | null;
    /** `null` means there is no valid product page — hide the shop link. */
    productUrl: string | null;
    priceRetrievedAt: string | null;
    colors: ColorOption[];
    styles: StylePreference[];
    /**
     * `null` means no real product photography is bundled. The UI must render a
     * clearly labelled prototype visual instead of a broken image.
     */
    image: string | null;
    /** Sprint 2 AR scope: only these garments get a try-on overlay. */
    arSupported: boolean;
    overlayAsset: string | null;
    notes?: string;
}

export interface Outfit {
    id: string;
    name: string;
    tagline: string;
    occasions: Occasion[];
    dressCodes: DressCode[];
    styles: StylePreference[];
    colors: ColorOption[];
    itemIds: string[];
    heroImage: string | null;
}

export interface Catalog {
    version: string;
    /** ISO date the curated sample prices were captured. */
    priceRetrievedAt: string;
    products: Product[];
    outfits: Outfit[];
}

/**
 * The four preference states from Epic 1. Guard against `null` meaning two
 * different things by using explicit empties.
 */
export interface UserPreferences {
    occasion: Occasion | null;
    dressCode: DressCode | null;
    /** Kept as the raw sanitized string so an in-progress edit survives round trips. */
    budgetInput: string;
    budget: number | null;
    styles: StylePreference[];
    colors: ColorPreference[];
}

export const EMPTY_PREFERENCES: UserPreferences = {
    occasion: null,
    dressCode: null,
    budgetInput: '',
    budget: null,
    styles: [],
    colors: [],
};

export type PreferenceErrors = Partial<
    Record<'occasion' | 'dressCode' | 'budget' | 'styles' | 'colors', string>
>;

export interface RankedOutfit {
    outfit: Outfit;
    items: Product[];
    /** Sum of known prices. Items with `price: null` are excluded. */
    knownTotal: number;
    /** False when at least one item has an unknown price. */
    priceComplete: boolean;
    /** 0–100, derived from the weighted score normalised against the maximum. */
    matchScore: number;
    reasons: string[];
    arReady: boolean;
}

export interface FilterDiagnostics {
    /** Number of outfits surviving each successive filter. */
    occasion: number;
    dressCode: number;
    budget: number;
    style: number;
    color: number;
    total: number;
}

export interface RecommendResult {
    outfits: RankedOutfit[];
    diagnostics: FilterDiagnostics;
}

export interface RelaxOption {
    id: string;
    label: string;
    description: string;
    /** How many outfits this change would surface. Always >= 1. */
    resultCount: number;
    patch: Partial<UserPreferences>;
}

export interface ChatTurn {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    /** Fields the assistant auto-updated, for the patch-feedback pills. */
    appliedFields?: string[];
    timestamp: number;
}
