import { Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { CustomSelect } from "../../components/CustomSelect";
import {
  AI_PROVIDER_OPTIONS_BY_MODE,
  type AiGenerationProvider,
} from "../../lib/providers/aiGenerationDefaults";
import {
  SettingRow,
  generationModeLabels,
  generationModeNotes,
  type AiGenerationMode,
} from "./settingsPrimitives";

const providerSelectClass =
  "min-h-[2.85rem] bg-[var(--color-surface)] text-[0.95rem] font-[520]";

const providerModes: AiGenerationMode[] = [
  "image",
  "video",
  "audio",
  "lipsync",
  "videoAnalysis",
];

export function AiProvidersSettingsSection({
  currentWorkspaceName,
  isWorkspaceAdmin,
  onChangeProvider,
  onSave,
  providersByMode,
}: {
  currentWorkspaceName: string;
  isWorkspaceAdmin: boolean;
  onChangeProvider: (
    mode: AiGenerationMode,
    provider: AiGenerationProvider
  ) => void;
  onSave: (event: FormEvent) => void;
  providersByMode: Record<AiGenerationMode, AiGenerationProvider>;
}) {
  return (
    <section>
      <header className="mb-[var(--space-2)]">
        <h2 className="text-[1.3rem] font-[820] leading-[1.2] text-[var(--color-ink)]">
          AI providers
        </h2>
        <p className="mt-[0.35rem] max-w-[42rem] text-[0.92rem] leading-[1.55] text-[var(--color-muted)]">
          Choose the default generation routes for {currentWorkspaceName}.
        </p>
      </header>

      <form onSubmit={onSave}>
        {providerModes.map((mode) => (
          <SettingRow
            key={mode}
            label={generationModeLabels[mode]}
            note={generationModeNotes[mode]}
          >
            <div className="max-w-[18rem]">
              <CustomSelect
                disabled={!isWorkspaceAdmin}
                onChange={(provider) =>
                  onChangeProvider(mode, provider as AiGenerationProvider)
                }
                options={AI_PROVIDER_OPTIONS_BY_MODE[mode]}
                placeholder="Provider"
                triggerClassName={providerSelectClass}
                value={providersByMode[mode]}
              />
            </div>
          </SettingRow>
        ))}

        <div className="border-t border-[var(--color-border)] pt-[var(--space-4)]">
          <button className="primary-button" disabled={!isWorkspaceAdmin} type="submit">
            <Sparkles size={16} />
            Save AI providers
          </button>
        </div>
      </form>
    </section>
  );
}
