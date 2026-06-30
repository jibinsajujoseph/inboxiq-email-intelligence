import { API_BASE_URL } from '@/services/api'

type SidebarItem = {
  key: string
  label: string
  hint: string
}

type SidebarProps = {
  activeKey: string
  items: SidebarItem[]
  onSelect: (key: string) => void
}

export function Sidebar({ activeKey, items, onSelect }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <p className="sidebar__eyebrow">InboxIQ</p>
        <h1>Support radar for one shared inbox.</h1>
        <p className="sidebar__copy">
          New Gmail messages flow through triage, routing, and review without
          leaving this board.
        </p>
      </div>

      <nav className="sidebar__nav" aria-label="Email filters">
        {items.map((item) => {
          const isActive = item.key === activeKey

          return (
            <button
              key={item.key}
              type="button"
              className={`sidebar__item${isActive ? ' is-active' : ''}`}
              onClick={() => onSelect(item.key)}
            >
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          )
        })}
      </nav>

      <a className="sidebar__cta" href={`${API_BASE_URL}/auth/google/connect`}>
        Connect Gmail
      </a>
    </aside>
  )
}
