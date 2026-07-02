import { useEffect, useEffectEvent, useRef, useState } from "react";

import { type AuthStatus } from "@/services/api";

export type FilterChipItem = {
  key: string;
  label: string;
  intent?: string;
  department?: string;
};

type FiltersProps = {
  searchValue: string;
  activeLabel: string;
  chips: FilterChipItem[];
  activeChipKey: string;
  authStatus: AuthStatus | null;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onChipSelect: (key: string) => void;
};

export function Filters({
  searchValue,
  chips,
  activeChipKey,
  authStatus,
  onSearchChange,
  onRefresh,
  onChipSelect,
}: FiltersProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isCondensed, setIsCondensed] = useState(false);

  const updateCondensedState = useEffectEvent((scrollTop: number) => {
    setIsCondensed(scrollTop > 48);
  });

  useEffect(() => {
    const rootElement = rootRef.current;
    const scrollContainer = rootElement?.closest(".dashboard-main");

    if (!(scrollContainer instanceof HTMLElement)) {
      return;
    }

    const handleScroll = () => {
      updateCondensedState(scrollContainer.scrollTop);
    };

    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [updateCondensedState]);

  return (
    <div className="filters-panel">
      <div className="filters-shell__status-row">
        <div className="filters-shell__account">
          {authStatus?.connected ? (
            <>
              <span className="filters-shell__account-email">
                {authStatus.email ?? "Connected"}
              </span>
              <span className="filters-shell__account-state">
                <span className="filters-shell__status-dot filters-shell__status-dot--connected"></span>
                Connected
              </span>
            </>
          ) : (
            <>
              <span className="filters-shell__account-email">Not Connected</span>
              <span className="filters-shell__account-state">
                <span className="filters-shell__status-dot"></span>
                Waiting for Gmail
              </span>
            </>
          )}
        </div>
        <div className="filters-shell__actions">
          <button onClick={onRefresh} className="filters-shell__refresh">
            Sync now
          </button>
        </div>
      </div>

      <div
        ref={rootRef}
        className={`filters-shell${isCondensed ? " is-condensed" : ""}`}
      >
        <div className="filters-shell__search-row">
          <div className="filters-shell__search">
            <input
              type="search"
              value={searchValue}
              placeholder="Search sender, subject, or body"
              onChange={(event) => onSearchChange(event.target.value)}
              className="filters-shell__search-input"
            />
          </div>
        </div>

        <div className="filters-shell__chips">
          {chips.map((chip) => {
            const isActive = chip.key === activeChipKey;
            return (
              <button
                key={chip.key}
                onClick={() => onChipSelect(chip.key)}
                className={`filters-shell__chip${isActive ? " is-active" : ""}`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
