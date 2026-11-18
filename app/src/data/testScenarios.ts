import type { ColorPreference, DressCode, Occasion, StylePreference } from '@/types/domain';

/**
 * The ten predefined test scenarios referenced in the Project Charter success
 * criteria: "In at least 8 of 10 predefined test scenarios, recommendations meet
 * the stated event, dress code, and total clothing budget."
 *
 * Scenario 5 is the deliberate negative case: no outfit can satisfy Business
 * Formal streetwear under $80, so it must produce the empty state rather than a
 * blank or broken screen.
 */
export interface TestScenario {
    id: number;
    label: string;
    occasion: Occasion;
    dressCode: DressCode;
    budget: number;
    styles: StylePreference[];
    colors: ColorPreference[];
    /** Minimum outfits a healthy engine should surface. 0 = expect empty state. */
    expectsMinResults: number;
    note: string;
}

export const TEST_SCENARIOS: TestScenario[] = [
    {
        id: 1,
        label: 'Relaxed weekend, tight budget',
        occasion: 'Casual Outing',
        dressCode: 'Casual',
        budget: 120,
        styles: ['Minimalist'],
        colors: ['Beige'],
        expectsMinResults: 2,
        note: 'Cheap everyday pieces in a neutral palette.',
    },
    {
        id: 2,
        label: 'Business formal, wide budget',
        occasion: 'Work',
        dressCode: 'Business Formal',
        budget: 400,
        styles: ['Classic'],
        colors: ['Navy'],
        expectsMinResults: 2,
        note: 'Full tailoring including a blazer must fit under $400.',
    },
    {
        id: 3,
        label: 'Cocktail party',
        occasion: 'Party',
        dressCode: 'Cocktail',
        budget: 250,
        styles: ['Trendy'],
        colors: ['Black'],
        expectsMinResults: 2,
        note: 'Two black cocktail looks land just under the ceiling.',
    },
    {
        id: 4,
        label: 'Black tie wedding',
        occasion: 'Wedding',
        dressCode: 'Black Tie',
        budget: 500,
        styles: ['Classic'],
        colors: ['Black'],
        expectsMinResults: 2,
        note: 'Most formal scenario; the tuxedo outfit is $2 under budget.',
    },
    {
        id: 5,
        label: 'Impossible combination (negative case)',
        occasion: 'Work',
        dressCode: 'Business Formal',
        budget: 80,
        styles: ['Streetwear'],
        colors: ['Colorful'],
        expectsMinResults: 0,
        note: 'Must render the empty state with relax actions, never a blank screen.',
    },
    {
        id: 6,
        label: 'Wedding with no colour preference',
        occasion: 'Wedding',
        dressCode: 'Cocktail',
        budget: 250,
        styles: ['Bohemian'],
        colors: ['No Color Preference'],
        expectsMinResults: 2,
        note: 'Includes an outfit with an unknown price; total must exclude it.',
    },
    {
        id: 7,
        label: 'Smart casual streetwear',
        occasion: 'Casual Outing',
        dressCode: 'Smart Casual',
        budget: 150,
        styles: ['Streetwear'],
        colors: ['No Color Preference'],
        expectsMinResults: 2,
        note: 'Colour preference explicitly disabled.',
    },
    {
        id: 8,
        label: 'Party, earth tones',
        occasion: 'Party',
        dressCode: 'Casual',
        budget: 200,
        styles: ['Bohemian'],
        colors: ['Earth Tones'],
        expectsMinResults: 1,
        note: 'Narrow palette against a cheaper budget.',
    },
    {
        id: 9,
        label: 'Work smart casual, beige',
        occasion: 'Work',
        dressCode: 'Smart Casual',
        budget: 300,
        styles: ['Minimalist'],
        colors: ['Beige'],
        expectsMinResults: 3,
        note: 'Widest match set; exercises the diversity pass.',
    },
    {
        id: 10,
        label: 'Very tight casual budget',
        occasion: 'Casual Outing',
        dressCode: 'Casual',
        budget: 90,
        styles: ['Trendy'],
        colors: ['White'],
        expectsMinResults: 1,
        note: 'Two outfits fit under $90 by a narrow margin.',
    },
];
