import type { EmailListItem, PaginationMeta, TopPrediction } from '@/services/api'
import { MouseEvent } from 'react'

type EmailListProps = {
  emails: EmailListItem[]
  isLoading: boolean
  errorMessage: string | null
  pagination: PaginationMeta | null
  selectedEmailId: number | null
  onSelectEmail: (emailId: number) => void
  onPageChange: (page: number) => void
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

function formatIntent(intent: string | null) {
  if (!intent) {
    return 'Unclassified'
  }
  return intent.replaceAll('_', ' ')
}

function getConfidenceStyles(tier: string | null) {
  if (tier === 'auto_routed') return { color: 'var(--color-text-success)', background: 'var(--color-background-success)' }
  if (tier === 'needs_review') return { color: 'var(--color-text-warning)', background: 'var(--color-background-warning)' }
  return { color: 'var(--color-text-danger)', background: 'var(--color-background-danger)' }
}

export function EmailList({
  emails,
  isLoading,
  errorMessage,
  pagination,
  selectedEmailId,
  onSelectEmail,
  onPageChange,
  onReview,
}: EmailListProps) {
  const canGoBack = (pagination?.page ?? 1) > 1
  const canGoForward =
    pagination !== null && pagination.page < Math.max(pagination.total_pages, 1)

  return (
    <section className="list-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>Inbox</span>
        {pagination ? (
          <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
            Showing {emails.length} of {pagination.total} messages
          </span>
        ) : null}
      </div>

      {isLoading ? <div className="panel-message">Loading latest messages...</div> : null}
      {errorMessage ? <div className="panel-message panel-message--error">{errorMessage}</div> : null}
      {!isLoading && !errorMessage && emails.length === 0 ? (
        <div className="panel-message">No emails match the current filters.</div>
      ) : null}

      <div className="email-list" role="list">
        {emails.map((email) => {
          const selected = email.id === selectedEmailId
          const cStyle = getConfidenceStyles(email.prediction.confidence_tier)
          const needsReviewAction = !email.prediction.reviewed && (email.prediction.confidence_tier === 'needs_review' || email.prediction.confidence_tier === 'manual_review')
          
          return (
            <button
              key={email.id}
              type="button"
              className={`email-row${selected ? ' is-selected' : ''}`}
              onClick={() => onSelectEmail(email.id)}
              style={{ padding: '12px 14px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email.sender || 'Unknown sender'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {formatDateTime(email.received_at)}
                </span>
              </div>

              <span style={{ display: 'block', fontSize: '14px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', marginTop: '4px' }}>
                {email.subject || '(No subject)'}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', padding: '2px 8px', whiteSpace: 'nowrap' }}>
                  {formatIntent(email.prediction.intent)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email.prediction.department || 'No department'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 500, color: cStyle.color, background: cStyle.background, padding: '2px 8px', borderRadius: 'var(--border-radius-md)', flexShrink: 0 }}>
                  {email.prediction.confidence !== null ? `${Math.round(email.prediction.confidence * 100)}%` : 'N/A'}
                </span>
              </div>

              {needsReviewAction && email.prediction.top3 && email.prediction.top3.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginRight: '4px' }}>Correct to:</span>
                  {email.prediction.top3.filter((t: TopPrediction) => t.intent !== email.prediction.intent).map((alt: TopPrediction) => (
                    <button
                      key={alt.intent}
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation()
                        onReview(email.id, alt.intent)
                      }}
                      style={{ fontSize: '12px', padding: '3px 8px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)', cursor: 'pointer' }}
                    >
                      {formatIntent(alt.intent)}
                    </button>
                  ))}
                  <button
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation()
                      onReview(email.id)
                    }}
                    style={{ marginLeft: 'auto', fontSize: '12px', padding: '3px 10px', borderRadius: 'var(--border-radius-md)', border: 'none', background: 'var(--color-text-success)', color: 'white', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Confirm original
                  </button>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {pagination ? (
        <div className="pagination">
          <button
            type="button"
            className="pagination__button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={!canGoBack}
          >
            Previous
          </button>
          <p>
            Page {pagination.page} of {Math.max(pagination.total_pages, 1)}
          </p>
          <button
            type="button"
            className="pagination__button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!canGoForward}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  )
}
