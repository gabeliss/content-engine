import { SignOutButton, useUser } from "@clerk/clerk-react";
import { BrainCircuit, LogOut } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { navItems } from "../app/navigation";

type NavTooltipState = {
  label: string;
  top: number;
  left: number;
};

export function Sidebar() {
  const { user } = useUser();
  const [navTooltip, setNavTooltip] = useState<NavTooltipState | null>(null);
  const navTooltipStyle = navTooltip
    ? ({
        top: `${navTooltip.top}px`,
        left: `${navTooltip.left}px`,
      } satisfies CSSProperties)
    : undefined;

  const showNavTooltip = (target: HTMLElement, label: string) => {
    if (!target.closest(".app-shell-canvas")) return;

    const rect = target.getBoundingClientRect();
    setNavTooltip({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  };

  return (
    <>
      <aside className="sidebar">
        <div className="brand-mark">
          <span className="brand-symbol">
            <BrainCircuit size={18} />
          </span>
          <span>
            Content Engine
            <small>Agent workspace</small>
          </span>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              aria-label={item.label}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              key={item.to}
              onBlur={() => setNavTooltip(null)}
              onFocus={(event) => showNavTooltip(event.currentTarget, item.label)}
              onMouseEnter={(event) => showNavTooltip(event.currentTarget, item.label)}
              onMouseLeave={() => setNavTooltip(null)}
              title={item.label}
              to={item.to}
            >
              <item.icon size={18} />
              <span className="nav-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="user-panel">
          <div className="user-meta">
            <div className="avatar">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt={user.fullName || "User"} />
              ) : (
                <span>{user?.fullName?.[0] || "U"}</span>
              )}
            </div>
            <div>
              <div className="user-name">{user?.fullName || "User"}</div>
              <div className="user-email">{user?.primaryEmailAddress?.emailAddress}</div>
            </div>
          </div>
          <SignOutButton signOutOptions={{ redirectUrl: "/" }}>
            <button className="quiet-button" type="button">
              <LogOut size={16} />
              Sign out
            </button>
          </SignOutButton>
        </div>
      </aside>

      {navTooltip ? (
        <div
          className="pointer-events-none fixed z-[60] grid w-max max-w-[min(14rem,calc(100vw-7rem))] translate-y-[-50%] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-ink)] shadow-[var(--shadow-lg)] before:absolute before:left-[-0.34rem] before:top-1/2 before:size-[0.62rem] before:translate-y-[-50%] before:rotate-45 before:border-b before:border-l before:border-[var(--color-border)] before:bg-[var(--color-surface)] before:content-['']"
          role="tooltip"
          style={navTooltipStyle}
        >
          <strong className="text-[0.8rem] font-[780] leading-[1.2]">{navTooltip.label}</strong>
        </div>
      ) : null}
    </>
  );
}
