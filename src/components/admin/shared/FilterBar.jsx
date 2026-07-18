import { Search, X, RotateCcw } from 'lucide-react'

function optionValue(opt) {
  return typeof opt === 'object' && opt !== null ? opt.value : opt
}

function optionLabel(opt) {
  return typeof opt === 'object' && opt !== null ? opt.label : opt
}

export default function FilterBar({ controller, searchPlaceholder = 'Search records...' }) {
  const {
    config, search, setSearch, values, setValue,
    dateFrom, setDateFrom, dateTo, setDateTo, reset, activeCount, options,
  } = controller
  const { searchKeys, filters, dateKey } = config

  return (
    <div className="filter-bar">
      {searchKeys.length > 0 && (
        <div className="filter-bar__search">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="filter-bar__controls">
        {filters.map((f) => (
          <label key={f.key} className="filter-bar__field">
            <span className="filter-bar__field-label">{f.label}</span>
            <select
              value={values[f.key] ?? 'all'}
              onChange={(e) => setValue(f.key, e.target.value)}
              className={values[f.key] && values[f.key] !== 'all' ? 'is-active' : ''}
            >
              <option value="all">{f.allLabel || `All ${f.label}`}</option>
              {(options[f.key] || []).map((opt) => (
                <option key={optionValue(opt)} value={optionValue(opt)}>
                  {optionLabel(opt)}
                </option>
              ))}
            </select>
          </label>
        ))}

        {dateKey && (
          <div className="filter-bar__dates">
            <label className="filter-bar__field">
              <span className="filter-bar__field-label">From</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className={dateFrom ? 'is-active' : ''}
              />
            </label>
            <label className="filter-bar__field">
              <span className="filter-bar__field-label">To</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className={dateTo ? 'is-active' : ''}
              />
            </label>
          </div>
        )}

        <button
          type="button"
          className="filter-bar__reset"
          onClick={reset}
          disabled={activeCount === 0}
        >
          <RotateCcw size={13} />
          Reset{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      </div>
    </div>
  )
}
