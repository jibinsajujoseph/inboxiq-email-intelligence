import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { EmailDetailDrawer } from "@/components/EmailDetail/EmailDetailDrawer";
import { EmailList } from "@/components/EmailList/EmailList";
import { Filters, FilterChipItem } from "@/components/Filters/Filters";
import { Sidebar, PrimaryNavKey } from "@/components/Sidebar/Sidebar";
import { StatsCard } from "@/components/StatsCard/StatsCard";
import {
  fetchEmailDetail,
  fetchEmails,
  fetchStats,
  reviewEmail,
  fetchAuthStatus,
  disconnectGmail,
  type AuthStatus,
  type EmailDetail,
  type EmailListItem,
  type PaginationMeta,
  type StatsResponse,
} from "@/services/api";

const FILTER_CHIPS: FilterChipItem[] = [
  { key: "all", label: "All intents" },
  { key: "login", label: "Login", intent: "login_issue" },
  { key: "billing", label: "Billing", department: "Billing" },
  { key: "bugs", label: "Bug report", intent: "bug_report" },
  { key: "features", label: "Feature request", intent: "feature_request" },
  { key: "performance", label: "Performance", intent: "performance_issue" },
  { key: "security", label: "Security", intent: "security_concern" },
  { key: "developer", label: "Dev support", department: "Developer Support" },
];

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function DashboardPage() {
  const [activePrimaryNav, setActivePrimaryNav] =
    useState<PrimaryNavKey>("inbox");
  const [activeChipKey, setActiveChipKey] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput);
  const [page, setPage] = useState(1);

  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  const [isLoadingEmails, setIsLoadingEmails] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const activeChip =
    FILTER_CHIPS.find((c) => c.key === activeChipKey) || FILTER_CHIPS[0];

  useEffect(() => {
    const abortController = new AbortController();

    setIsLoadingEmails(true);
    setEmailError(null);

    fetchEmails(
      {
        intent: activeChip.intent,
        department: activeChip.department,
        review_status: activePrimaryNav === "review" ? "unreviewed" : undefined,
        search: deferredSearch.trim() || undefined,
        page,
        pageSize: 12,
      },
      abortController.signal,
    )
      .then((response) => {
        setEmails(response.items);
        setPagination(response.pagination);
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }
        setEmailError(
          error instanceof Error
            ? error.message
            : "Unable to load emails right now.",
        );
        setEmails([]);
        setPagination(null);
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingEmails(false);
        }
      });

    return () => abortController.abort();
  }, [
    activePrimaryNav,
    activeChip.department,
    activeChip.intent,
    deferredSearch,
    page,
    refreshTick,
  ]);

  useEffect(() => {
    const abortController = new AbortController();

    setIsLoadingStats(true);
    setStatsError(null);

    fetchStats(abortController.signal)
      .then((response) => setStats(response))
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }
        setStatsError(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard stats right now.",
        );
        setStats(null);
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingStats(false);
        }
      });

    fetchAuthStatus(abortController.signal)
      .then((response) => setAuthStatus(response))
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          console.error("Failed to fetch auth status", error);
        }
      });

    return () => abortController.abort();
  }, [refreshTick]);

  useEffect(() => {
    if (selectedEmailId === null) {
      setSelectedEmail(null);
      setDetailError(null);
      setIsLoadingDetail(false);
      return;
    }

    const abortController = new AbortController();

    setIsLoadingDetail(true);
    setDetailError(null);
    setSelectedEmail(null);

    fetchEmailDetail(selectedEmailId, abortController.signal)
      .then((response) => setSelectedEmail(response))
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }
        setDetailError(
          error instanceof Error
            ? error.message
            : "Unable to load email details right now.",
        );
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingDetail(false);
        }
      });

    return () => abortController.abort();
  }, [selectedEmailId]);

  function handlePrimaryNavSelect(key: PrimaryNavKey) {
    startTransition(() => {
      setActivePrimaryNav(key);
      setPage(1);
      setSelectedEmailId(null);
    });
  }

  function handleChipSelect(key: string) {
    startTransition(() => {
      setActiveChipKey(key);
      setPage(1);
      setSelectedEmailId(null);
    });
  }

  function handleSearchChange(value: string) {
    startTransition(() => {
      setSearchInput(value);
      setPage(1);
    });
  }

  function handleRefresh() {
    setRefreshTick((current) => current + 1);
  }

  function handleEmailSelect(emailId: number) {
    setSelectedEmailId(emailId);
  }

  function handleCloseDrawer() {
    setSelectedEmailId(null);
  }

  function handleDisconnectGmail() {
    disconnectGmail()
      .then(() => {
        setRefreshTick((current) => current + 1);
      })
      .catch((error) => {
        alert(
          error instanceof Error
            ? error.message
            : "Unable to disconnect Gmail.",
        );
      });
  }

  function handleReview(emailId: number, correctedIntent?: string) {
    reviewEmail(emailId, correctedIntent)
      .then((updatedDetail) => {
        // Optimistically remove from list if we are in the Needs Review queue
        if (activePrimaryNav === "review") {
          setEmails((prev) => prev.filter((e) => e.id !== emailId));
          setStats((prev) =>
            prev
              ? {
                  ...prev,
                  unreviewed_count: Math.max(
                    0,
                    (prev as any).unreviewed_count - 1,
                  ),
                }
              : prev,
          );
          if (selectedEmailId === emailId) {
            setSelectedEmailId(null);
          }
        } else {
          // If in inbox view, update the item in place
          setEmails((prev) =>
            prev.map((e) => {
              if (e.id === emailId) {
                return {
                  ...e,
                  prediction: {
                    ...e.prediction,
                    reviewed: true,
                    intent:
                      updatedDetail.prediction?.intent ?? e.prediction.intent,
                    department: updatedDetail.department,
                    priority: updatedDetail.priority,
                    sla_minutes: updatedDetail.sla_minutes,
                    confidence_tier: e.prediction.confidence_tier,
                  },
                };
              }
              return e;
            }),
          );
          if (selectedEmailId === emailId) {
            setSelectedEmail(updatedDetail);
          }
        }
      })
      .catch((error) => {
        alert(
          error instanceof Error
            ? error.message
            : "Failed to update review status",
        );
      });
  }

  // Define the mockup stats based on real data
  const unreviewedCount = stats?.unreviewed_count ?? 0;
  const totalEmails = stats?.total_emails ?? 0;
  const avgConfidence = stats?.avg_confidence ?? 0;

  // High priority count could theoretically be pulled from backend, but since it's not currently exposed by /stats,
  // we will show "Top department" as a placeholder for now, styled to match the mockup.
  const topDepartment = stats?.by_department?.[0];

  return (
    <div className="dashboard-shell">
      <Sidebar
        activeKey={activePrimaryNav}
        unreviewedCount={unreviewedCount}
        authStatus={authStatus}
        onSelect={handlePrimaryNavSelect}
        onDisconnect={handleDisconnectGmail}
      />

      <main className="dashboard-main">
        <Filters
          searchValue={searchInput}
          activeLabel={activeChip.label}
          chips={FILTER_CHIPS}
          activeChipKey={activeChipKey}
          authStatus={authStatus}
          onSearchChange={handleSearchChange}
          onRefresh={handleRefresh}
          onChipSelect={handleChipSelect}
        />

        {statsError ? (
          <div className="panel-message panel-message--error">{statsError}</div>
        ) : null}

        <section className="stats-grid">
          <StatsCard
            label="Needs review"
            value={isLoadingStats ? "..." : String(unreviewedCount)}
            tone="rose"
          />
          <StatsCard
            label="Processed today"
            value={isLoadingStats ? "..." : String(totalEmails)}
            tone="sun"
          />
          <StatsCard
            label="Top department"
            value={
              isLoadingStats
                ? "..."
                : topDepartment
                  ? `${topDepartment.label} (${topDepartment.count})`
                  : "No data"
            }
            tone="ink"
          />
          <StatsCard
            label="Avg confidence"
            value={isLoadingStats ? "..." : formatPercent(avgConfidence)}
            tone="mint"
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
            onReview={handleReview}
          />

          <EmailDetailDrawer
            email={selectedEmail}
            isLoading={isLoadingDetail}
            isOpen={selectedEmailId !== null}
            errorMessage={detailError}
            onClose={handleCloseDrawer}
            onReview={handleReview}
          />
        </div>
      </main>
    </div>
  );
}
