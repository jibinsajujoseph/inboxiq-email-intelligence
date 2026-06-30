import { type AuthStatus } from '@/services/api'

export type FilterChipItem = {
  key: string
  label: string
  intent?: string
  department?: string
}

type FiltersProps = {
  searchValue: string
  activeLabel: string
  chips: FilterChipItem[]
  activeChipKey: string
  authStatus: AuthStatus | null
  onSearchChange: (value: string) => void
  onRefresh: () => void
  onChipSelect: (key: string) => void
}

export function Filters({
  searchValue,
  chips,
  activeChipKey,
  authStatus,
  onSearchChange,
  onRefresh,
  onChipSelect,
}: FiltersProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {authStatus?.connected ? (
            <>
              <span style={{ fontSize: '16px', fontWeight: 500 }}>{authStatus.email}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-text-success)', display: 'inline-block' }}></span>
                Connected
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '16px', fontWeight: 500 }}>Not Connected</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-text-secondary)', display: 'inline-block' }}></span>
                Waiting for Gmail
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          <button onClick={onRefresh} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            Sync now
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="search"
            value={searchValue}
            placeholder="Search sender, subject, or body"
            onChange={(event) => onSearchChange(event.target.value)}
            style={{ width: '100%', paddingLeft: '1rem', minHeight: '3.4rem', borderRadius: '1rem', border: '1px solid var(--color-border-tertiary)' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '1rem' }}>
        {chips.map(chip => {
          const isActive = chip.key === activeChipKey
          return (
            <button
              key={chip.key}
              onClick={() => onChipSelect(chip.key)}
              style={{
                border: 'none',
                background: isActive ? 'var(--color-background-secondary)' : 'transparent',
                fontWeight: isActive ? 500 : 400,
                padding: '6px 12px',
                borderRadius: 'var(--border-radius-md)',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
