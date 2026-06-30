import type { EmailDetail } from '@/services/api'

type EmailDetailDrawerProps = {
  email: EmailDetail | null
  isLoading: boolean
  isOpen: boolean
  errorMessage: string | null
  onClose: () => void
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Unknown time'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatIntent(intent: string) {
  return intent.replaceAll('_', ' ')
}

export function EmailDetailDrawer({
  email,
  isLoading,
  isOpen,
  errorMessage,
  onClose,
}: EmailDetailDrawerProps) {
  return (
    <div className={`drawer-shell${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
      <button
        type="button"
        className="drawer-shell__scrim"
        onClick={onClose}
        aria-label="Close email details"
      />

      <aside className="drawer" aria-label="Email details">
        <div className="drawer__header">
          <div>
            <p className="section-heading__eyebrow">Email detail</p>
            <h2>{email?.subject || 'Select an email'}</h2>
          </div>
          <button type="button" className="drawer__close" onClick={onClose}>
            Close
          </button>
        </div>

        {isLoading ? <div className="panel-message">Loading email details...</div> : null}
        {errorMessage ? <div className="panel-message panel-message--error">{errorMessage}</div> : null}
        {!isLoading && !errorMessage && email === null ? (
          <div className="panel-message">Choose an email from the queue to inspect its triage result.</div>
        ) : null}

        {email ? (
          <div className="drawer__content">
            <div className="drawer__facts">
              <div>
                <span>Sender</span>
                <strong>{email.sender || 'Unknown sender'}</strong>
              </div>
              <div>
                <span>Department</span>
                <strong>{email.department || 'Unassigned'}</strong>
              </div>
              <div>
                <span>Priority</span>
                <strong>{email.priority || 'Unassigned'}</strong>
              </div>
              <div>
                <span>SLA</span>
                <strong>
                  {email.sla_minutes !== null ? `${email.sla_minutes} min` : 'Not set'}
                </strong>
              </div>
            </div>

            <div className="drawer__body">
              <div className="drawer-card">
                <p className="drawer-card__label">Body</p>
                <pre>{email.body || 'No body was parsed for this message.'}</pre>
              </div>

              <div className="drawer-card">
                <p className="drawer-card__label">Prediction</p>
                {email.prediction ? (
                  <>
                    <div className="prediction-summary">
                      <strong>{formatIntent(email.prediction.intent)}</strong>
                      <span>{Math.round(email.prediction.confidence * 100)}% confidence</span>
                    </div>
                    <ul className="top-predictions">
                      {email.prediction.top3.map((item) => (
                        <li key={`${email.id}-${item.intent}`}>
                          <span>{formatIntent(item.intent)}</span>
                          <strong>{Math.round(item.confidence * 100)}%</strong>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>No prediction has been stored yet.</p>
                )}
              </div>

              <div className="drawer-card">
                <p className="drawer-card__label">Timeline</p>
                <ul className="timeline">
                  <li>
                    <span>Received</span>
                    <strong>{formatDateTime(email.received_at)}</strong>
                  </li>
                  <li>
                    <span>Processed</span>
                    <strong>{formatDateTime(email.processed_at)}</strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
