import type { EmailDetail, TopPrediction } from '@/services/api'

type EmailDetailDrawerProps = {
  email: EmailDetail | null
  isLoading: boolean
  isOpen: boolean
  errorMessage: string | null
  onClose: () => void
  onReview: (emailId: number, correctedIntent?: string) => void
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

function getConfidenceStyles(tier: string | null) {
  if (tier === 'auto_routed') return { color: 'var(--color-text-success)', background: 'var(--color-background-success)' }
  if (tier === 'needs_review') return { color: 'var(--color-text-warning)', background: 'var(--color-background-warning)' }
  return { color: 'var(--color-text-danger)', background: 'var(--color-background-danger)' }
}

export function EmailDetailDrawer({
  email,
  isLoading,
  isOpen,
  errorMessage,
  onClose,
  onReview
}: EmailDetailDrawerProps) {
  const cStyle = email ? getConfidenceStyles(email.confidence_tier) : null
  const needsReviewAction = email && !email.reviewed && (email.confidence_tier === 'needs_review' || email.confidence_tier === 'manual_review')

  return (
    <div className={`drawer-shell${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
      <aside className="drawer" aria-label="Email details">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--ink)' }}>{email?.subject || 'Select an email'}</span>
          <button aria-label="Close detail" onClick={onClose} style={{ border: 'none', padding: '2px', width: 'auto', flexShrink: 0, background: 'transparent', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-tertiary)' }}>
            ✕
          </button>
        </div>

        {isLoading ? <div className="panel-message">Loading email details...</div> : null}
        {errorMessage ? <div className="panel-message panel-message--error">{errorMessage}</div> : null}
        {!isLoading && !errorMessage && email === null ? (
          <div className="panel-message" style={{ fontSize: '13px' }}>Choose an email from the queue to inspect its triage result.</div>
        ) : null}

        {email ? (
          <>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
              {email.sender || 'Unknown sender'}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {email.prediction && (
                <span style={{ fontSize: '12px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', padding: '3px 8px' }}>
                  {formatIntent(email.prediction.intent)}
                </span>
              )}
              <span style={{ fontSize: '12px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', padding: '3px 8px' }}>
                {email.department || 'Unassigned'}
              </span>
              {email.prediction && cStyle && (
                <span style={{ fontSize: '12px', fontWeight: 500, color: cStyle.color, background: cStyle.background, padding: '3px 8px', borderRadius: 'var(--border-radius-md)' }}>
                  {Math.round(email.prediction.confidence * 100)}%
                </span>
              )}
              {email.reviewed && (
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-success)', background: 'var(--color-background-success)', padding: '3px 8px', borderRadius: 'var(--border-radius-md)' }}>
                  Reviewed
                </span>
              )}
            </div>

            <table style={{ width: '100%', fontSize: '13px', marginBottom: '12px' }}>
              <tbody>
                <tr>
                  <td style={{ color: 'var(--color-text-secondary)', padding: '3px 0' }}>Priority</td>
                  <td style={{ textAlign: 'right' }}>{email.priority || 'Not set'}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-text-secondary)', padding: '3px 0' }}>SLA</td>
                  <td style={{ textAlign: 'right' }}>{email.sla_minutes !== null ? `${email.sla_minutes} min` : 'Not set'}</td>
                </tr>
                {email.was_corrected && email.original_intent && (
                  <tr>
                    <td style={{ color: 'var(--color-text-secondary)', padding: '3px 0' }}>Original Intent</td>
                    <td style={{ textAlign: 'right', textDecoration: 'line-through' }}>{formatIntent(email.original_intent)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 16px', borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {email.body || '(No body)'}
            </p>

            {needsReviewAction && email.prediction && email.prediction.top3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: '12px' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>Review needed</p>
                {email.prediction.top3.filter((t: TopPrediction) => t.intent !== email.prediction!.intent).map((alt: TopPrediction) => (
                  <button
                    key={alt.intent}
                    onClick={() => onReview(email.id, alt.intent)}
                    style={{ padding: '6px 12px', fontSize: '13px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)', cursor: 'pointer', textAlign: 'left' }}
                  >
                    Change to {formatIntent(alt.intent)}
                  </button>
                ))}
                <button
                  onClick={() => onReview(email.id)}
                  style={{ padding: '6px 12px', fontSize: '13px', borderRadius: 'var(--border-radius-md)', border: 'none', background: 'var(--color-text-success)', color: 'white', cursor: 'pointer', fontWeight: 500, textAlign: 'center' }}
                >
                  Confirm prediction
                </button>
              </div>
            )}
          </>
        ) : null}
      </aside>
    </div>
  )
}
