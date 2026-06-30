import { startTransition, useDeferredValue, useEffect, useState } from 'react'

import { EmailDetailDrawer } from '@/components/EmailDetail/EmailDetailDrawer'
import { EmailList } from '@/components/EmailList/EmailList'
import { Filters } from '@/components/Filters/Filters'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { StatsCard } from '@/components/StatsCard/StatsCard'
import {
  fetchEmailDetail,
  fetchEmails,
  fetchStats,
  type EmailDetail,
  type EmailListItem,
  type PaginationMeta,
  type StatsResponse,
} from '@/services/api'

type SidebarFilter = {
  key: string
  label: string
  hint: string
  intent?: string
  department?: string
}

const SIDEBAR_FILTERS: SidebarFilter[] = [
  { key: 'all', label: 'All', hint: 'Every routed message' },
  { key: 'login', label: 'Login Issues', hint: 'Urgent access problems', intent: 'login_issue' },
  { key: 'billing', label: 'Billing', hint: 'Refunds and plan changes', department: 'Billing' },
  { key: 'bugs', label: 'Bug Reports', hint: 'Product defects', intent: 'bug_report' },
  { key: 'features', label: 'Feature Requests', hint: 'Customer ideas', intent: 'feature_request' },
  { key: 'performance', label: 'Performance', hint: 'Slowdowns and instability', intent: 'performance_issue' },
  { key: 'security', label: 'Security', hint: 'Critical concerns', intent: 'security_concern' },
  { key: 'developer', label: 'Developer Support', hint: 'API and integration help', department: 'Developer Support' },
]

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function DashboardPage() {
  const [activeFilterKey, setActiveFilterKey] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const deferredSearch = useDeferredValue(searchInput)
  const [page, setPage] = useState(1)

  const [emails, setEmails] = useState<EmailListItem[]>([])
  const [pagination, setPagination] = useState<PaginationMeta | null>(null)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null)

  const [isLoadingEmails, setIsLoadingEmails] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  const [emailError, setEmailError] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const activeFilter =
    SIDEBAR_FILTERS.find((item) => item.key === activeFilterKey) ?? SIDEBAR_FILTERS[0]

  useEffect(() => {
    const abortController = new AbortController()

    setIsLoadingEmails(true)
    setEmailError(null)

    fetchEmails(
      {
        intent: activeFilter.intent,
        department: activeFilter.department,
        search: deferredSearch.trim() || undefined,
        page,
        pageSize: 12,
      },
      abortController.signal,
    )
      .then((response) => {
        setEmails(response.items)
        setPagination(response.pagination)
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return
        }

        setEmailError(
          error instanceof Error
            ? error.message
            : 'Unable to load emails right now.',
        )
        setEmails([])
        setPagination(null)
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingEmails(false)
        }
      })

    return () => abortController.abort()
  }, [activeFilter.department, activeFilter.intent, deferredSearch, page, refreshTick])

  useEffect(() => {
    const abortController = new AbortController()

    setIsLoadingStats(true)
    setStatsError(null)

    fetchStats(abortController.signal)
      .then((response) => setStats(response))
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return
        }

        setStatsError(
          error instanceof Error
            ? error.message
            : 'Unable to load dashboard stats right now.',
        )
        setStats(null)
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingStats(false)
        }
      })

    return () => abortController.abort()
  }, [refreshTick])

  useEffect(() => {
    if (selectedEmailId === null) {
      setSelectedEmail(null)
      setDetailError(null)
      setIsLoadingDetail(false)
      return
    }

    const abortController = new AbortController()

    setIsLoadingDetail(true)
    setDetailError(null)
    setSelectedEmail(null)

    fetchEmailDetail(selectedEmailId, abortController.signal)
      .then((response) => setSelectedEmail(response))
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return
        }

        setDetailError(
          error instanceof Error
            ? error.message
            : 'Unable to load email details right now.',
        )
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingDetail(false)
        }
      })

    return () => abortController.abort()
  }, [selectedEmailId])

  function handleSidebarSelect(key: string) {
    startTransition(() => {
      setActiveFilterKey(key)
      setPage(1)
      setSelectedEmailId(null)
    })
  }

  function handleSearchChange(value: string) {
    startTransition(() => {
      setSearchInput(value)
      setPage(1)
    })
  }

  function handleRefresh() {
    setRefreshTick((current) => current + 1)
  }

  function handleEmailSelect(emailId: number) {
    setSelectedEmailId(emailId)
  }

  function handleCloseDrawer() {
    setSelectedEmailId(null)
  }

  const topDepartment = stats?.by_department[0]
  const secondDepartment = stats?.by_department[1]

  return (
    <div className="dashboard-shell">
      <Sidebar
        activeKey={activeFilter.key}
        items={SIDEBAR_FILTERS}
        onSelect={handleSidebarSelect}
      />

      <main className="dashboard-main">
        <section className="hero-panel">
          <div>
            <p className="hero-panel__eyebrow">Dashboard</p>
            <h2>Inbox flow, intent confidence, and routing pressure in one place.</h2>
          </div>
          <p className="hero-panel__copy">
            Track what the classifier is seeing, spot the queues building up,
            and open any message for the full triage record.
          </p>
        </section>

        <Filters
          searchValue={searchInput}
          activeLabel={activeFilter.label}
          onSearchChange={handleSearchChange}
          onRefresh={handleRefresh}
        />

        {statsError ? <div className="panel-message panel-message--error">{statsError}</div> : null}

        <section className="stats-grid">
          <StatsCard
            label="Total emails"
            value={
              isLoadingStats ? '...' : String(stats?.total_emails ?? 0)
            }
            tone="sun"
          />
          <StatsCard
            label="Average confidence"
            value={
              isLoadingStats
                ? '...'
                : formatPercent(stats?.avg_confidence ?? 0)
            }
            tone="mint"
          />
          <StatsCard
            label="Top department"
            value={
              isLoadingStats
                ? '...'
                : topDepartment
                  ? `${topDepartment.label} · ${topDepartment.count}`
                  : 'No data'
            }
            tone="ink"
          />
          <StatsCard
            label="Next busiest"
            value={
              isLoadingStats
                ? '...'
                : secondDepartment
                  ? `${secondDepartment.label} · ${secondDepartment.count}`
                  : 'No data'
            }
            tone="rose"
          />
        </section>

        <div className="workspace-grid">
          <EmailList
            emails={emails}
            isLoading={isLoadingEmails}
            errorMessage={emailError}
            pagination={pagination}
            selectedEmailId={selectedEmailId}
            onSelectEmail={handleEmailSelect}
            onPageChange={setPage}
          />

          <EmailDetailDrawer
            email={selectedEmail}
            isLoading={isLoadingDetail}
            isOpen={selectedEmailId !== null}
            errorMessage={detailError}
            onClose={handleCloseDrawer}
          />
        </div>
      </main>
    </div>
  )
}
