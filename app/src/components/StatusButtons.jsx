import { STATUS_FLOW, NON_SELLING_STATUSES } from '../lib/constants'

// Big tappable status controls. Progression + Returned/Cancelled.
export default function StatusButtons({ current, onChange, disabled }) {
  return (
    <div className="status-buttons">
      {STATUS_FLOW.map((s) => (
        <button
          key={s}
          className={current === s ? 'active' : ''}
          disabled={disabled}
          onClick={() => onChange(s)}
        >
          {s}
        </button>
      ))}
      {NON_SELLING_STATUSES.map((s) => (
        <button
          key={s}
          className={`danger ${current === s ? 'active' : ''}`}
          disabled={disabled}
          onClick={() => onChange(s)}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
