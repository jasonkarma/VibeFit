import { CircleSlash } from 'lucide-react';
import {
    COLOR_OPTIONS,
    COLOR_SWATCHES,
    NO_COLOR_PREFERENCE,
    STYLE_PREFERENCES,
    type ColorPreference,
    type StylePreference,
} from '@/types/domain';
import { Pill } from '@/components/ui/Pill';
import { FieldError } from '@/components/ui/FieldError';

interface StyleColorSelectorProps {
    styles: StylePreference[];
    colors: ColorPreference[];
    styleError?: string;
    colorError?: string;
    onToggleStyle: (style: StylePreference) => void;
    onToggleColor: (color: ColorPreference) => void;
    onNoColorPreference: () => void;
}

/**
 * VIBE-15 — Choose Style & Color Preferences.
 *
 * Two independent multi-selects with deliberately different affordances:
 * style is an abstract taste, so it gets text pills; color is perceptual, so it
 * gets real swatches. Concrete colors and "No Color Preference" are mutually
 * exclusive per acceptance criterion 15.2, and that rule is enforced in the
 * store as well as here so no code path can violate it.
 */
export function StyleColorSelector({
    styles,
    colors,
    styleError,
    colorError,
    onToggleStyle,
    onToggleColor,
    onNoColorPreference,
}: StyleColorSelectorProps) {
    const noPreference = colors.includes(NO_COLOR_PREFERENCE);
    const concreteColors = colors.filter((c) => c !== NO_COLOR_PREFERENCE);

    return (
        <div className="space-y-7">
            <fieldset>
                <legend className="mb-3 block text-[0.8125rem] uppercase tracking-[0.08em] text-obsidian-400">
                    Style preferences
                    <span className="ml-2 normal-case tracking-normal text-obsidian-500">
                        choose at least one
                    </span>
                </legend>

                <div className="flex flex-wrap gap-2">
                    {STYLE_PREFERENCES.map((style) => (
                        <Pill
                            key={style}
                            selected={styles.includes(style)}
                            layoutGroup="style"
                            onClick={() => onToggleStyle(style)}
                        >
                            {style}
                        </Pill>
                    ))}
                </div>

                <FieldError id="styles-error">{styleError}</FieldError>
            </fieldset>

            <fieldset>
                <legend className="mb-3 block text-[0.8125rem] uppercase tracking-[0.08em] text-obsidian-400">
                    Color preferences
                    <span className="ml-2 normal-case tracking-normal text-obsidian-500">
                        pick any, or opt out
                    </span>
                </legend>

                <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((color) => (
                        <Pill
                            key={color}
                            selected={concreteColors.includes(color)}
                            layoutGroup="color"
                            swatch={COLOR_SWATCHES[color]}
                            onClick={() => onToggleColor(color)}
                        >
                            {color}
                        </Pill>
                    ))}
                </div>

                <div className="mt-3">
                    <Pill
                        selected={noPreference}
                        layoutGroup="no-color"
                        icon={<CircleSlash className="h-3.5 w-3.5" aria-hidden="true" />}
                        onClick={onNoColorPreference}
                        className="w-full justify-center sm:w-auto"
                    >
                        {NO_COLOR_PREFERENCE}
                    </Pill>
                </div>

                <FieldError id="colors-error">{colorError}</FieldError>
            </fieldset>
        </div>
    );
}
