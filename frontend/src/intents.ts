export const OUT_OF_SCOPE_INTENT = "other_out_of_scope";

export const SUPPORTED_INTENT_OPTIONS = [
  { value: "login_issue", label: "Login issue" },
  { value: "billing_refund", label: "Billing refund" },
  { value: "subscription_change", label: "Subscription change" },
  { value: "bug_report", label: "Bug report" },
  { value: "feature_request", label: "Feature request" },
  { value: "integration_api", label: "Integration / API" },
  { value: "performance_issue", label: "Performance issue" },
  { value: "security_concern", label: "Security concern" },
] as const;

const INTENT_LABELS = new Map<string, string>([
  ...SUPPORTED_INTENT_OPTIONS.map(
    (option): [string, string] => [option.value, option.label],
  ),
  [OUT_OF_SCOPE_INTENT, "Other / out of scope"],
]);

export function formatIntentLabel(intent: string | null | undefined): string {
  if (!intent) {
    return "Unclassified";
  }

  return INTENT_LABELS.get(intent) ?? intent.replaceAll("_", " ");
}
