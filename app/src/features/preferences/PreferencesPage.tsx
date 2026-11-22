import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { usePreferencesStore } from '@/store/preferencesStore';
import { parsePreferencesWithAi } from '@/services/aiStylist';
import { PageTransition } from '@/components/ui/PageTransition';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Surface } from '@/components/ui/Surface';
import { ChatDock } from '@/features/chat/ChatDock';
import { OccasionSelector } from './OccasionSelector';
import { DressCodeSelector } from './DressCodeSelector';
import { BudgetInput } from './BudgetInput';
import { StyleColorSelector } from './StyleColorSelector';
import { DepartmentSelector } from './DepartmentSelector';
import { RetailerSelector } from './RetailerSelector';

/**
 * Preference entry screen — Stories 1, 2, 3, 4 plus the charter's conversational
 * assistant.
 *
 * Every field reads and writes the same persisted store, so leaving this screen
 * and returning (the Story 9 requirement) restores exactly what the user had
 * chosen, and nothing here keeps a local copy that could drift.
 */
export function PreferencesPage() {
    const navigate = useNavigate();

    const preferences = usePreferencesStore((state) => state.preferences);
    const errors = usePreferencesStore((state) => state.errors);
    const setOccasion = usePreferencesStore((state) => state.setOccasion);
    const setDressCode = usePreferencesStore((state) => state.setDressCode);
    const setBudgetInput = usePreferencesStore((state) => state.setBudgetInput);
    const toggleStyle = usePreferencesStore((state) => state.toggleStyle);
    const toggleColor = usePreferencesStore((state) => state.toggleColor);
    const setNoColorPreference = usePreferencesStore((state) => state.setNoColorPreference);
    const setDepartment = usePreferencesStore((state) => state.setDepartment);
    const toggleRetailer = usePreferencesStore((state) => state.toggleRetailer);
    const clearRetailers = usePreferencesStore((state) => state.clearRetailers);
    const applyPatch = usePreferencesStore((state) => state.applyPatch);
    const validateAll = usePreferencesStore((state) => state.validateAll);
    const generate = usePreferencesStore((state) => state.generate);
    const chatLog = usePreferencesStore((state) => state.chatLog);
    const pushChatTurn = usePreferencesStore((state) => state.pushChatTurn);
    const aiStatus = usePreferencesStore((state) => state.aiStatus);

    function handleGenerate() {
        const isValid = validateAll();
        if (!isValid) {
            // Focus the first invalid field so keyboard and screen-reader users are
            // taken to the problem rather than left to hunt for it.
            const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
            firstInvalid?.focus();
            return;
        }

        generate();
        navigate('/results');
    }

    return (
        <PageTransition>
            <StepIndicator current={1} />

            <div className="mb-9 max-w-2xl">
                <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
                    Tell us about the occasion
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-obsidian-400">
                    Four quick choices, plus two optional ones if you want to narrow things down. Or
                    skip ahead and describe the event in the bar below — it fills in the same fields.
                </p>
            </div>

            <div className="space-y-4">
                <Surface as="section" aria-labelledby="occasion-heading">
                    <SectionHeading
                        step={1}
                        title="Occasion"
                        storyKey="VIBE-11"
                        description="Where are you going? This sets the whole mood of the outfit."
                    />
                    <OccasionSelector
                        value={preferences.occasion}
                        onChange={setOccasion}
                        error={errors.occasion}
                    />
                </Surface>

                <Surface as="section" aria-labelledby="dresscode-heading">
                    <SectionHeading
                        step={2}
                        title="Dress code"
                        storyKey="VIBE-13"
                        description="How formal is it? You can change this at any time before generating."
                    />
                    <DressCodeSelector
                        value={preferences.dressCode}
                        onChange={setDressCode}
                        error={errors.dressCode}
                    />
                </Surface>

                <Surface as="section" aria-labelledby="budget-heading">
                    <SectionHeading
                        step={3}
                        title="Budget"
                        storyKey="VIBE-14"
                        description="Total across all pieces. We will only suggest complete outfits inside it."
                    />
                    <BudgetInput
                        value={preferences.budgetInput}
                        parsedAmount={preferences.budget}
                        error={errors.budget}
                        onChange={setBudgetInput}
                    />
                </Surface>

                <Surface as="section" aria-labelledby="style-heading">
                    <SectionHeading
                        step={4}
                        title="Style & color"
                        storyKey="VIBE-15"
                        description="What you actually like wearing. Pick at least one style."
                    />
                    <StyleColorSelector
                        styles={preferences.styles}
                        colors={preferences.colors}
                        styleError={errors.styles}
                        colorError={errors.colors}
                        onToggleStyle={toggleStyle}
                        onToggleColor={toggleColor}
                        onNoColorPreference={setNoColorPreference}
                    />
                </Surface>

                {/*
                  Sprint 3 optional filters.

                  Grouped after the four required fields and below a divider labelled
                  "Optional", because they are the only inputs on this screen that
                  cannot block generation. Presenting them as a fifth and sixth step
                  would imply they are required and make the form feel longer than it
                  is.
                */}
                <div className="pt-2">
                    <div className="mb-4 flex items-center gap-3">
                        <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
                        <span className="font-data text-[0.625rem] uppercase tracking-[0.14em] text-obsidian-500">
                            Optional — narrow further
                        </span>
                        <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
                    </div>

                    <div className="space-y-4">
                        <Surface as="section" aria-labelledby="department-heading">
                            <SectionHeading
                                title="Department"
                                storyKey="SPRINT-3"
                                description="Optional. Leave on All unless you want one department only."
                            />
                            <DepartmentSelector
                                value={preferences.department}
                                onChange={setDepartment}
                            />
                        </Surface>

                        <Surface as="section" aria-labelledby="retailers-heading">
                            <SectionHeading
                                title="Preferred retailers"
                                storyKey="SPRINT-3"
                                description="Optional. Pick the shops you actually buy from, or leave it empty for everything."
                            />
                            <RetailerSelector
                                value={preferences.preferredRetailers}
                                onToggle={toggleRetailer}
                                onClear={clearRetailers}
                            />
                        </Surface>
                    </div>
                </div>
            </div>

            <div className="sticky bottom-24 mt-8 flex justify-end">
                <button
                    type="button"
                    onClick={handleGenerate}
                    className="group inline-flex items-center gap-2 rounded-pill bg-champagne px-6 py-3 font-sans text-sm font-semibold text-obsidian shadow-glow-gold transition-colors hover:bg-champagne-200"
                >
                    Generate outfits
                    <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                    />
                </button>
            </div>

            <ChatDock
                preferences={preferences}
                onApplyPatch={applyPatch}
                chatLog={chatLog}
                onPushTurn={pushChatTurn}
                onParseWithAi={parsePreferencesWithAi}
                aiStatus={aiStatus}
            />
        </PageTransition>
    );
}
