/**
 * Pure derivation of a retailer's gift + form-submission progress for the
 * admin export. No Firebase import — the export route fetches submissions,
 * drafts and gifts in bulk and calls this per retailer.
 *
 * Join keys (see the retailers list route): a submission's `retailerId` and a
 * draft's document id both equal the retailer's Firestore document id; a
 * gift's document id is the `giftId` stored on drafts/submissions.
 */

export type FormStatus = 'Not Started' | 'In Progress' | 'Submitted';

export interface RetailerProgress {
  giftSelected: string;
  status: FormStatus;
}

export function deriveRetailerProgress(input: {
  submission?: { giftName?: string | null } | null;
  draft?: { giftId?: string | null; hasFormData?: boolean } | null;
  giftNameById: Map<string, string>;
}): RetailerProgress {
  const { submission, draft, giftNameById } = input;

  // A submitted form is the final, committed state.
  if (submission) {
    return { status: 'Submitted', giftSelected: submission.giftName ?? '' };
  }

  // Otherwise, any real draft activity (a gift picked, or form data entered)
  // counts as In Progress. An empty default draft does not.
  const draftGiftId = draft?.giftId ?? null;
  const hasFormData = draft?.hasFormData ?? false;

  if (draftGiftId || hasFormData) {
    const giftSelected = draftGiftId ? (giftNameById.get(draftGiftId) ?? '') : '';
    return { status: 'In Progress', giftSelected };
  }

  return { status: 'Not Started', giftSelected: '' };
}
