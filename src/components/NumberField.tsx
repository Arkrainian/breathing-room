interface Props {
  id: string
  label: string
  unit?: string
  value: string
  error?: string
  onChange: (value: string) => void
  hideLabel?: boolean
}

export function NumberField({ id, label, unit, value, error, onChange, hideLabel }: Props) {
  const errorId = `${id}-error`
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : 'field-label'}>
        {label}
      </label>
      <div className={`number-input${error ? ' has-error' : ''}`}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {unit && <span className="unit" aria-hidden="true">{unit}</span>}
      </div>
      {error && (
        <p id={errorId} className="error">
          {error}
        </p>
      )}
    </div>
  )
}
