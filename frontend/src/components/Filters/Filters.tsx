type FiltersProps = {
  searchValue: string
  activeLabel: string
  onSearchChange: (value: string) => void
  onRefresh: () => void
}

export function Filters({
  searchValue,
  activeLabel,
  onSearchChange,
  onRefresh,
}: FiltersProps) {
  return (
    <div className="filters-bar">
      <label className="search-field">
        <span className="search-field__label">Search inbox</span>
        <input
          type="search"
          value={searchValue}
          placeholder="Search sender, subject, or body"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <div className="filters-bar__meta">
        <span className="filter-chip">{activeLabel}</span>
        <button type="button" className="refresh-button" onClick={onRefresh}>
          Refresh data
        </button>
      </div>
    </div>
  )
}
