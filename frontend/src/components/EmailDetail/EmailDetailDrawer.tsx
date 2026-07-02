import { useEffect, useState } from 'react'

import { OUT_OF_SCOPE_INTENT, SUPPORTED_INTENT_OPTIONS, formatIntentLabel } from '@/intents'
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
  const [isIntentPickerOpen, setIsIntentPickerOpen] = useState(false)
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null)
  const cStyle = email ? getConfidenceStyles(email.confidence_tier) : null
  const needsReviewAction = email && !email.reviewed && (email.confidence_tier === 'needs_review' || email.confidence_tier === 'manual_review')
  const fullIntentOptions = SUPPORTED_INTENT_OPTIONS.filter((option) => option.value !== email?.prediction?.intent)
  const alternatePredictions =
    email?.prediction?.top3?.filter((t: TopPrediction) => t.intent !== email.prediction!.intent) ?? []
  const bodyLines = email?.body
    ? email.body
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : []

  useEffect(() => {
    setIsIntentPickerOpen(false)
    setSelectedIntent(fullIntentOptions[0]?.value ?? null)
  }, [email?.id, email?.prediction?.intent])

  const selectedReviewIntent = selectedIntent ?? fullIntentOptions[0]?.value ?? null

  return (
    <div className={`drawer-shell${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
      <aside className="drawer" aria-label="Email details">
        <div className="drawer__header">
          <h2>{email?.subject || 'Select an email'}</h2>
          <button aria-label="Close detail" className="drawer__close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {isLoading ? <div className="panel-message">Loading email details...</div> : null}
        {errorMessage ? <div className="panel-message panel-message--error">{errorMessage}</div> : null}
        {!isLoading && !errorMessage && email === null ? (
          <div className="panel-message" style={{ fontSize: '13px' }}>Choose an email from the queue to inspect its triage result.</div>
        ) : null}

        {email ? (
          <div className="drawer__content">
            <p className="drawer__sender">{email.sender || 'Unknown sender'}</p>

            <div className="drawer__chips">
              {email.prediction && (
                <span className="drawer__chip">
                  {formatIntentLabel(email.prediction.intent)}
                </span>
              )}
              <span className="drawer__chip">
                {email.department || 'Unassigned'}
              </span>
              {email.prediction && cStyle && (
                <span className="drawer__chip drawer__chip--confidence" style={{ color: cStyle.color, background: cStyle.background }}>
                  {Math.round(email.prediction.confidence * 100)}%
                </span>
              )}
              {email.reviewed && (
                <span className="drawer__chip drawer__chip--confidence" style={{ color: 'var(--color-text-success)', background: 'var(--color-background-success)' }}>
                  Reviewed
                </span>
              )}
            </div>

            <dl className="drawer__facts-list">
              <div className="drawer__fact-row">
                <dt>Priority</dt>
                <dd>{email.priority || 'Not set'}</dd>
              </div>
              <div className="drawer__fact-row">
                <dt>SLA</dt>
                <dd>{email.sla_minutes !== null ? `${email.sla_minutes} min` : 'Not set'}</dd>
              </div>
              <div className="drawer__fact-row">
                <dt>Received</dt>
                <dd>{formatDateTime(email.received_at)}</dd>
              </div>
              {email.processed_at ? (
                <div className="drawer__fact-row">
                  <dt>Processed</dt>
                  <dd>{formatDateTime(email.processed_at)}</dd>
                </div>
              ) : null}
              {email.was_corrected && email.original_intent ? (
                <div className="drawer__fact-row">
                  <dt>Original intent</dt>
                  <dd className="drawer__fact-value--muted">{formatIntentLabel(email.original_intent)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="drawer__message">
              {bodyLines.length > 0 ? (
                <div className="drawer__message-content">
                  {bodyLines.map((line, index) => {
                    const isImageToken = /^\[image:.*\]$/i.test(line)
                    return (
                      <p key={`${index}-${line.slice(0, 16)}`} className={isImageToken ? 'drawer__message-token' : undefined}>
                        {line}
                      </p>
                    )
                  })}
                </div>
              ) : (
                <p className="drawer__message-empty">(No body)</p>
              )}
            </div>

            {needsReviewAction && email.prediction && email.prediction.top3 && (
              <div className="drawer__review">
                <p className="drawer__review-title">Review needed</p>
                {alternatePredictions.map((alt: TopPrediction) => (
                  <button
                    key={alt.intent}
                    onClick={() => onReview(email.id, alt.intent)}
                    className="drawer__review-action"
                    type="button"
                  >
                    Change to {formatIntentLabel(alt.intent)}
                  </button>
                ))}
                {fullIntentOptions.length > 0 ? (
                  <>
                    <button
                      onClick={() => setIsIntentPickerOpen((current) => !current)}
                      className="drawer__review-action drawer__review-action--secondary"
                      type="button"
                    >
                      {isIntentPickerOpen ? 'Hide full intent list' : 'Choose another supported intent'}
                    </button>
                    {isIntentPickerOpen ? (
                      <div className="drawer__review-picker">
                        <label className="drawer__review-label" htmlFor="review-intent-select">
                          All supported intents
                        </label>
                        <select
                          id="review-intent-select"
                          className="drawer__review-select"
                          value={selectedReviewIntent ?? ''}
                          onChange={(event) => setSelectedIntent(event.target.value)}
                        >
                          {fullIntentOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => selectedReviewIntent && onReview(email.id, selectedReviewIntent)}
                          className="drawer__review-action drawer__review-action--primary"
                          type="button"
                          disabled={!selectedReviewIntent}
                        >
                          Apply selected intent
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <button
                  onClick={() => onReview(email.id, OUT_OF_SCOPE_INTENT)}
                  className="drawer__review-action drawer__review-action--secondary"
                  type="button"
                >
                  Mark as Other / out of scope
                </button>
                <p className="drawer__review-note">
                  Use this when the email does not match any of the supported product-support intents.
                </p>
                <button
                  onClick={() => onReview(email.id)}
                  className="drawer__review-confirm"
                  type="button"
                >
                  Confirm prediction
                </button>
              </div>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  )
}
