import { Mail, UserRound } from "lucide-react";

type SettingsUser = {
  fullName: string | null;
  imageUrl: string;
  primaryEmailAddress: {
    emailAddress: string;
  } | null;
} | null | undefined;

export function ProfileSettingsSection({
  onEditProfile,
  user,
}: {
  onEditProfile: () => void;
  user: SettingsUser;
}) {
  return (
    <section>
      <header className="mb-[var(--space-2)]">
        <h2 className="text-[1.3rem] font-[820] leading-[1.2] text-[var(--color-ink)]">
          Profile
        </h2>
        <p className="mt-[0.35rem] max-w-[42rem] text-[0.92rem] leading-[1.55] text-[var(--color-muted)]">
          Manage your personal profile.
        </p>
      </header>

      <div className="border-t border-[var(--color-border)] py-[var(--space-4)]">
        <div className="flex max-w-[35rem] flex-wrap items-center gap-[var(--space-3)]">
          <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[oklch(92%_0.07_145)] text-[1rem] font-[820] uppercase text-[oklch(18%_0.04_210)]">
            {user?.imageUrl ? (
              <img
                alt={user.fullName ?? "User"}
                className="size-full object-cover"
                src={user.imageUrl}
              />
            ) : (
              <span>{user?.fullName?.[0] ?? "U"}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[1rem] font-[780] text-[var(--color-ink)]">
              {user?.fullName ?? "User"}
            </div>
            <div className="mt-[0.2rem] inline-flex max-w-full items-center gap-[var(--space-1)] text-[0.84rem] text-[var(--color-muted)]">
              <Mail size={14} />
              <span className="truncate">
                {user?.primaryEmailAddress?.emailAddress ?? "No email"}
              </span>
            </div>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={onEditProfile}
          >
            <UserRound size={16} />
            Edit profile
          </button>
        </div>
      </div>
    </section>
  );
}
