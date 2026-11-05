export const feedbackCategories = ['bug', 'idea', 'other'] as const;
export type FeedbackCategory = typeof feedbackCategories[number];
export type FeedbackDraft = { rating: number; category: FeedbackCategory; message: string };
export type FeedbackMetadata = { appVersion: string; platform: string; language: string };
export type FeedbackPayload = {
  user_id: string; client_report_id: string; rating: number; category: FeedbackCategory;
  message: string; app_version: string; platform: string; language: string;
};

export function validateFeedback(draft: FeedbackDraft): string {
  if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5) return 'Choose a rating from 1 to 5.';
  if (!feedbackCategories.includes(draft.category)) return 'Choose a feedback category.';
  if (!draft.message.trim()) return 'Tell us what worked or what we should improve.';
  if (draft.message.trim().length > 2000) return 'Keep your review within 2,000 characters.';
  return '';
}

// A report identifier is only for retry deduplication, never authentication.
export function createFeedbackReportId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function feedbackPayload(draft: FeedbackDraft, userId: string, reportId: string, metadata: FeedbackMetadata): FeedbackPayload {
  const invalid = validateFeedback(draft);
  if (invalid) throw new Error(invalid);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error('Sign in to send your review.');
  if (!/^[a-z0-9-]{10,80}$/.test(reportId)) throw new Error('Could not prepare your report. Try again.');
  return {
    user_id: userId, client_report_id: reportId, rating: draft.rating, category: draft.category,
    message: draft.message.trim(), app_version: metadata.appVersion.slice(0, 80),
    platform: metadata.platform.slice(0, 20), language: metadata.language.slice(0, 10),
  };
}

export function feedbackAlreadyDelivered(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '23505' && !!error.message?.includes('beta_feedback_user_report_key');
}

export function formatFeedbackReport(draft: FeedbackDraft, metadata: FeedbackMetadata): string {
  const invalid = validateFeedback(draft);
  if (invalid) throw new Error(invalid);
  return `PipWise beta review\nRating: ${draft.rating}/5\nCategory: ${draft.category}\nApp: ${metadata.appVersion} · ${metadata.platform} · ${metadata.language}\n\n${draft.message.trim()}`;
}
