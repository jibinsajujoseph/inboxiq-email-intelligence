import { API_BASE_URL, type AuthStatus } from "@/services/api";

export type PrimaryNavKey = "inbox" | "review";

type SidebarItem = {
  key: PrimaryNavKey;
  label: string;
  hint: string;
  count?: number;
};

type SidebarProps = {
  activeKey: PrimaryNavKey;
  unreviewedCount: number;
  authStatus: AuthStatus | null;
  onSelect: (key: PrimaryNavKey) => void;
  onDisconnect: () => void;
};

export function Sidebar({
  activeKey,
  unreviewedCount,
  authStatus,
  onSelect,
  onDisconnect,
}: SidebarProps) {
  const items: SidebarItem[] = [
    { key: "inbox", label: "Inbox", hint: "Every routed message" },
    {
      key: "review",
      label: "Needs Review",
      hint: "Low confidence items",
      count: unreviewedCount,
    },
  ];

  return (
    <aside className="sidebar">
      <div
        className="sidebar__brand"
        style={{ paddingLeft: "1.05rem", marginBottom: "0.5rem" }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(244, 240, 233, 0.9)",
          }}
        >
          InboxIQ
        </p>
      </div>

      <nav className="sidebar__nav" aria-label="Primary navigation">
        {items.map((item) => {
          const isActive = item.key === activeKey;

          return (
            <button
              key={item.key}
              type="button"
              className={`sidebar__item${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(item.key)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <span>{item.label}</span>
                <small style={{ display: "block" }}>{item.hint}</small>
              </div>
              {item.count !== undefined && item.count > 0 ? (
                <span
                  style={{
                    background: "var(--color-background-warning)",
                    color: "var(--color-text-warning)",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "12px",
                  }}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        {authStatus?.connected ? (
          <div className="sidebar__status">
            Connected as {authStatus.email ?? "your Gmail account"}
          </div>
        ) : null}

        {authStatus?.connected ? (
          <button className="sidebar__cta" type="button" onClick={onDisconnect}>
            Disconnect Gmail
          </button>
        ) : (
          <a
            className="sidebar__cta"
            href={`${API_BASE_URL}/auth/google/connect`}
          >
            Connect Gmail
          </a>
        )}
      </div>
    </aside>
  );
}
