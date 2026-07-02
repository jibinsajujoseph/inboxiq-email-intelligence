import { formatIntentLabel } from '@/intents'
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
          const alternatePredictions =
            email.prediction.top3?.filter((t: TopPrediction) => t.intent !== email.prediction.intent) ?? []
          
          return (
            <button
              key={email.id}
              type="button"
              className={`email-row${selected ? ' is-selected' : ''}`}
              onClick={() => onSelectEmail(email.id)}
            >
              <div className="email-row__header">
                <span className="email-row__sender">
                  {email.sender || 'Unknown sender'}
                </span>
                <span className="email-row__timestamp">
                  {formatDateTime(email.received_at)}
                </span>
              </div>

              <span className="email-row__subject">
                {email.subject || '(No subject)'}
              </span>

              <div className="email-row__meta">
                <span className="email-row__pill">
                  {formatIntentLabel(email.prediction.intent)}
                </span>
                <span className="email-row__department">
                  {email.prediction.department || 'No department'}
                </span>
                <span
                  className="email-row__confidence"
                  style={{ color: cStyle.color, background: cStyle.background }}
                >
                  {email.prediction.confidence !== null ? `${Math.round(email.prediction.confidence * 100)}%` : 'N/A'}
                </span>
              </div>

              <div className="email-row__footer">
                {needsReviewAction && alternatePredictions.length > 0 ? (
                  <>
                    <span className="email-row__footer-note">Correct to:</span>
                    {alternatePredictions.map((alt: TopPrediction) => (
                      <button
                        key={alt.intent}
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation()
                          onReview(email.id, alt.intent)
                        }}
                        className="email-row__action"
                      >
                        {formatIntentLabel(alt.intent)}
                      </button>
                    ))}
                    <button
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation()
                        onReview(email.id)
                      }}
                      className="email-row__confirm"
                    >
                      Confirm original
                    </button>
                  </>
                ) : (
                  <span className="email-row__footer-note">
                    {email.prediction.reviewed ? 'Reviewed and confirmed' : 'Open the message to inspect full routing details'}
                  </span>
                )}
              </div>
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
