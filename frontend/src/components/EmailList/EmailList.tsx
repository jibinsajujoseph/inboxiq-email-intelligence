import type { EmailListItem, PaginationMeta } from '@/services/api'

type EmailListProps = {
  emails: EmailListItem[]
  isLoading: boolean
  errorMessage: string | null
  pagination: PaginationMeta | null
  selectedEmailId: number | null
  onSelectEmail: (emailId: number) => void
  onPageChange: (page: number) => void
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

export function EmailList({
  emails,
  isLoading,
  errorMessage,
  pagination,
  selectedEmailId,
  onSelectEmail,
  onPageChange,
}: EmailListProps) {
  const canGoBack = (pagination?.page ?? 1) > 1
  const canGoForward =
    pagination !== null && pagination.page < Math.max(pagination.total_pages, 1)

  return (
    <section className="list-panel">
      <div className="section-heading">
        <div>
          <p className="section-heading__eyebrow">Queue</p>
          <h2>Incoming email triage</h2>
        </div>
        {pagination ? (
          <p className="section-heading__meta">
            Showing {emails.length} of {pagination.total}
          </p>
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

          return (
            <button
              key={email.id}
              type="button"
              className={`email-row${selected ? ' is-selected' : ''}`}
              onClick={() => onSelectEmail(email.id)}
            >
              <div className="email-row__header">
                <h3>{email.subject || '(No subject)'}</h3>
                <time dateTime={email.received_at ?? undefined}>
                  {formatDateTime(email.received_at)}
                </time>
              </div>

              <div className="email-row__meta">
                <span className="intent-pill">
                  {formatIntent(email.prediction.intent)}
                </span>
                <span>{email.prediction.department || 'No department yet'}</span>
                <span>
                  {email.prediction.confidence !== null
                    ? `${Math.round(email.prediction.confidence * 100)}% confidence`
                    : 'Pending confidence'}
                </span>
              </div>

              <div className="email-row__footer">
                <span>{email.sender || 'Unknown sender'}</span>
                <span>{email.prediction.priority || 'No priority'}</span>
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
